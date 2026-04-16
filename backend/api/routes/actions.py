# backend/api/routes/actions.py
"""
Actions endpoint: POST /games/{gameId}/actions (DIN-66 — SSE via Redis pub/sub).

POST /actions returns 202 JSON immediately after inserting the player message
and spawning a background coroutine. The coroutine calls Claude with stream=True
and publishes every parsed SSE event (chunk / block / done) to the Redis
channel `stream:{game_id}`. The acting player's browser subscribes via the
separate GET /events endpoint (see api/routes/events.py). When the stream
finishes, this module inserts the complete DM message to game_messages
(firing Supabase Realtime for other connected clients) and enqueues
`dm_bookkeeping_task` for event embedding + suggested_actions persistence.

Why two endpoints?
- The single-endpoint approach ties the stream to the acting player's HTTP
  request. Redis pub/sub naturally fans out to N subscribers on the same
  channel. DIN-67 (multiplayer streaming) needs only the frontend to wire
  all players to /events — the backend is already ready.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from config import supabase_client, anthropic_async_client, redis_async_client
from api.dependencies import get_current_user
from models.action import ActionInput, ActionResponse
from services.dm_service import (
    validate_action,
    search_rag,
    build_dm_system_prompt,
)
from services.embedding_service import embed_text
from services.stream_parser import StreamParser
from tasks.dm_tasks import dm_bookkeeping_task
from constants import MESSAGE_ROLE_PLAYER, MESSAGE_ROLE_DM, MESSAGE_ROLE_SYSTEM

logger = logging.getLogger(__name__)

router = APIRouter()


STREAM_CHANNEL_PREFIX = "stream"


_STRIP_TAG_BLOCKS = re.compile(
    r"<(?:suggested_actions|state_changes|dice_rolls)>.*?</(?:suggested_actions|state_changes|dice_rolls)>",
    re.DOTALL,
)
_STRIP_EVENT_BLOCKS = re.compile(
    r"<event\s+type=[\"'][^\"']+[\"']>(.*?)</event>",
    re.DOTALL,
)


def _strip_all_known_tags(text: str) -> str:
    """Remove structured blocks from a raw Claude response for display.

    Preserves inner text of <event> wrappers; fully removes dice_rolls,
    state_changes, and suggested_actions blocks.
    """
    text = _STRIP_TAG_BLOCKS.sub("", text)
    text = _STRIP_EVENT_BLOCKS.sub(r"\1", text)
    return text.strip()


def _extract_dice_rolls_for_row(raw_response: str) -> list[dict] | None:
    """Parse dice rolls for persistence on the DM message row. None if none."""
    from services.dm_service import extract_dice_rolls

    dice = extract_dice_rolls(raw_response)
    return dice if dice else None


async def _stream_to_redis(
    game_id: str,
    action_text: str,
    system_prompt: str,
) -> None:
    """
    Background coroutine: call Claude and publish SSE events to Redis pub/sub.

    Runs concurrently via `asyncio.create_task` so the POST /actions handler
    can return 202 immediately. All subscribers on `stream:{game_id}` receive
    the events — native N-subscriber fan-out with no extra plumbing. A final
    `{"type": "done"}` is always published (even on errors) so subscribers
    can close their connections cleanly.
    """
    channel = f"{STREAM_CHANNEL_PREFIX}:{game_id}"
    parser = StreamParser()
    full_parts: list[str] = []

    async def _publish(event: dict[str, Any]) -> None:
        await redis_async_client.publish(channel, json.dumps(event))

    try:
        async with anthropic_async_client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": action_text}],
        ) as stream:
            async for text in stream.text_stream:
                full_parts.append(text)
                for evt in parser.feed(text):
                    await _publish(evt)

        for evt in parser.flush():
            await _publish(evt)

        # Persist the complete DM message (fires Supabase Realtime for
        # other players or reconciliation of the streaming bubble).
        raw = "".join(full_parts)
        clean = _strip_all_known_tags(raw)
        dice_rolls = _extract_dice_rolls_for_row(raw)

        await asyncio.to_thread(
            lambda: supabase_client.table("game_messages")
            .insert(
                {
                    "game_id": game_id,
                    "role": MESSAGE_ROLE_DM,
                    "profile_id": None,
                    "content": clean,
                    "dice_rolls": dice_rolls,
                }
            )
            .execute()
        )

        # Enqueue post-stream bookkeeping (event embedding, suggested_actions).
        dm_bookkeeping_task.send(game_id=game_id, dm_response=raw)

    except Exception as e:
        logger.error(
            f"[_stream_to_redis] Error for game={game_id}: {e}", exc_info=True
        )
        # Surface a user-visible system message so the retry CTA shows up.
        try:
            await asyncio.to_thread(
                lambda: supabase_client.table("game_messages")
                .insert(
                    {
                        "game_id": game_id,
                        "role": MESSAGE_ROLE_SYSTEM,
                        "profile_id": None,
                        "content": "The Dungeon Master encountered an error. Please try your action again.",
                    }
                )
                .execute()
            )
        except Exception:
            logger.exception(
                "[_stream_to_redis] failed to insert system error message"
            )
    finally:
        # Subscribers wait for a done event to close cleanly.
        try:
            await _publish({"type": "done"})
        except Exception:
            logger.exception("[_stream_to_redis] failed to publish done event")


@router.post("/{gameId}/actions", response_model=ActionResponse, status_code=202)
async def create_action(
    gameId: str,
    action: ActionInput,
    current_user: str = Depends(get_current_user),
):
    """
    Player submits an action — fire-and-forget streaming (DIN-66).

    Synchronous preamble (runs before 202 response):
        1. Verify player is in this game & game is active
        2. Insert the player message to game_messages (fires Realtime)
        3. Embed action + RAG search
        4. Fetch party, messages, inventory in parallel
        5. Build Claude system prompt

    Then spawns `_stream_to_redis` via asyncio.create_task and returns 202.
    The acting player's browser opens GET /events to subscribe to the stream.
    """
    try:
        player = (
            supabase_client.table("players")
            .select("*")
            .match({"game_id": gameId, "profile_id": current_user})
            .single()
            .execute()
        )

        if not player.data:
            raise HTTPException(status_code=403, detail="Player not in this game")

        game = (
            supabase_client.table("games")
            .select("*")
            .match({"id": gameId})
            .single()
            .execute()
        )

        try:
            validate_action(action, player.data, game.data)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        # ---- Insert player message (fires Realtime) ---- #
        message_id = str(uuid.uuid4())
        supabase_client.table("game_messages").insert(
            {
                "game_id": gameId,
                "profile_id": current_user,
                "role": MESSAGE_ROLE_PLAYER,
                "content": action.action_text,
            }
        ).execute()

        # ---- Embed + RAG (non-fatal) ---- #
        try:
            action_embedding = embed_text(action.action_text)
            rag_context = search_rag(gameId, action_embedding, top_k=5)
        except Exception as e:
            logger.warning(
                f"[create_action] RAG search failed (fallback to empty): {e}"
            )
            rag_context = []

        # ---- Fetch party + messages + inventory ---- #
        def _fetch_players():
            return (
                supabase_client.table("players")
                .select("*")
                .match({"game_id": gameId})
                .execute()
            )

        def _fetch_recent_messages():
            return (
                supabase_client.table("game_messages")
                .select("role, profile_id, content")
                .eq("game_id", gameId)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            f_players = executor.submit(_fetch_players)
            f_messages = executor.submit(_fetch_recent_messages)
            players_result = f_players.result()
            recent_messages_result = f_messages.result()

        player_ids = [p["id"] for p in (players_result.data or [])]
        inv_by_player: dict[str, list[dict]] = {}
        if player_ids:
            try:
                all_inv = (
                    supabase_client.table("player_inventory")
                    .select("player_id, item_name, quantity")
                    .in_("player_id", player_ids)
                    .execute()
                )
                for item in all_inv.data or []:
                    inv_by_player.setdefault(item["player_id"], []).append(item)
            except Exception as e:
                logger.warning(
                    f"[create_action] inventory fetch failed (non-fatal): {e}"
                )

        system_prompt = build_dm_system_prompt(
            game=game.data,
            players=players_result.data or [],
            inv_by_player=inv_by_player,
            recent_messages=recent_messages_result.data or [],
            rag_context=rag_context,
            action_text=action.action_text,
        )

        # Fire-and-forget: the coroutine owns inserting the DM message on
        # completion and enqueuing bookkeeping. Subscribers on /events see
        # tokens in real time.
        asyncio.create_task(
            _stream_to_redis(gameId, action.action_text, system_prompt)
        )

        return ActionResponse(
            message_id=message_id,
            game_id=gameId,
            status="queued",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing action: {str(e)}"
        )
