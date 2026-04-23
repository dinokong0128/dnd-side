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
_STRIP_SCENE_TAG = re.compile(r"<scene(?:\s[^>]*)?\/>")

_SCENE_TYPE_RE = re.compile(r'type=["\']([^"\']+)["\']')
_SCENE_MOOD_RE = re.compile(r'mood=["\']([^"\']+)["\']')
_SCENE_TAG_RE = re.compile(r"<scene(\s[^>]*)?\/>")


def _strip_all_known_tags(text: str) -> str:
    """Remove structured blocks from a raw Claude response for display.

    Preserves inner text of <event> wrappers; fully removes dice_rolls,
    state_changes, suggested_actions, and scene blocks.
    """
    text = _STRIP_TAG_BLOCKS.sub("", text)
    text = _STRIP_EVENT_BLOCKS.sub(r"\1", text)
    text = _STRIP_SCENE_TAG.sub("", text)
    return text.strip()


def _extract_scene_from_raw(raw: str) -> tuple[str | None, str | None]:
    """Extract scene_type and scene_mood from a raw Claude response.

    Returns (scene_type, scene_mood) where either may be None.
    """
    m = _SCENE_TAG_RE.search(raw)
    if not m:
        return None, None
    attrs_str = m.group(1) or ""
    type_m = _SCENE_TYPE_RE.search(attrs_str)
    mood_m = _SCENE_MOOD_RE.search(attrs_str)
    scene_type = type_m.group(1) if type_m else None
    scene_mood = mood_m.group(1) if mood_m else None
    return scene_type, scene_mood


def _extract_dice_rolls_for_row(raw_response: str) -> list[dict] | None:
    """Parse dice rolls for persistence on the DM message row. None if none."""
    from services.dm_service import extract_dice_rolls

    dice = extract_dice_rolls(raw_response)
    return dice if dice else None


async def _stream_to_redis(
    game_id: str,
    action_text: str,
    profile_id: str,
) -> None:
    """
    Background coroutine: build the prompt, call Claude, publish SSE events.

    Runs concurrently via `asyncio.create_task` so the POST /actions handler
    can return 202 immediately after persisting the player row. All preamble
    (DB fetches for game/party/history/inventory, OpenAI embedding, pgvector
    RAG, system-prompt construction) now happens here — moved off the 202
    hot path to minimize the gap between Send-click and "DM is writing".

    All subscribers on `stream:{game_id}` receive the events — native
    N-subscriber fan-out with no extra plumbing. A final `{"type": "done"}`
    is always published (even on errors) so subscribers can close cleanly.

    `profile_id` is accepted for parity with the handler and future per-player
    RAG; it is currently unused by the prompt builder.
    """
    # profile_id used below to identify the acting player for DIN-74 Part B
    channel = f"{STREAM_CHANNEL_PREFIX}:{game_id}"
    parser = StreamParser()
    full_parts: list[str] = []

    async def _publish(event: dict[str, Any]) -> None:
        await redis_async_client.publish(channel, json.dumps(event))

    try:
        # ---- Fetch game + party + recent messages in parallel ---- #
        def _fetch_game():
            return (
                supabase_client.table("games")
                .select("*")
                .match({"id": game_id})
                .single()
                .execute()
            )

        def _fetch_players():
            return (
                supabase_client.table("players")
                .select("*")
                .match({"game_id": game_id})
                .execute()
            )

        def _fetch_recent_messages():
            return (
                supabase_client.table("game_messages")
                .select("role, profile_id, content, scene_type, scene_mood")
                .eq("game_id", game_id)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )

        loop = asyncio.get_event_loop()
        game_result, players_result, recent_messages_result = await asyncio.gather(
            loop.run_in_executor(None, _fetch_game),
            loop.run_in_executor(None, _fetch_players),
            loop.run_in_executor(None, _fetch_recent_messages),
        )

        # ---- Fetch inventory (depends on players) ---- #
        player_ids = [p["id"] for p in (players_result.data or [])]
        inv_by_player: dict[str, list[dict]] = {}
        if player_ids:
            try:
                all_inv = await asyncio.to_thread(
                    lambda: supabase_client.table("player_inventory")
                    .select("player_id, item_name, quantity")
                    .in_("player_id", player_ids)
                    .execute()
                )
                for item in all_inv.data or []:
                    inv_by_player.setdefault(item["player_id"], []).append(item)
            except Exception as e:
                logger.warning(
                    f"[_stream_to_redis] inventory fetch failed (non-fatal): {e}"
                )

        # ---- Embed + RAG (non-fatal) ---- #
        try:
            action_embedding = embed_text(action_text)
            rag_context = search_rag(game_id, action_embedding, top_k=5)
        except Exception as e:
            logger.warning(
                f"[_stream_to_redis] RAG search failed (fallback to empty): {e}"
            )
            rag_context = []

        # ---- Build system prompt ---- #
        all_players = players_result.data or []
        acting_player = next(
            (p for p in all_players if p.get("profile_id") == profile_id), None
        )
        system_prompt = build_dm_system_prompt(
            game=game_result.data,
            players=all_players,
            inv_by_player=inv_by_player,
            recent_messages=recent_messages_result.data or [],
            rag_context=rag_context,
            action_text=action_text,
            acting_player=acting_player,
        )

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
        scene_type, scene_mood = _extract_scene_from_raw(raw)

        msg_row: dict[str, Any] = {
            "game_id": game_id,
            "role": MESSAGE_ROLE_DM,
            "profile_id": None,
            "content": clean,
            "dice_rolls": dice_rolls,
        }
        if scene_type is not None:
            msg_row["scene_type"] = scene_type
        if scene_mood is not None:
            msg_row["scene_mood"] = scene_mood

        await asyncio.to_thread(
            lambda: supabase_client.table("game_messages")
            .insert(msg_row)
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

    Then spawns `_stream_to_redis` via asyncio.create_task and returns 202.
    All DB fetches beyond player/game, the OpenAI embedding, pgvector RAG,
    and prompt construction happen inside the coroutine — off the 202 hot
    path so the "DM is writing" bubble opens within ~50–100ms of Send.

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
        if action.client_id is not None:
            try:
                message_id = str(uuid.UUID(action.client_id))
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="client_id must be a valid UUID"
                )
        else:
            message_id = str(uuid.uuid4())
        supabase_client.table("game_messages").insert(
            {
                "id": message_id,
                "game_id": gameId,
                "profile_id": current_user,
                "role": MESSAGE_ROLE_PLAYER,
                "content": action.action_text,
            }
        ).execute()

        # Fire-and-forget: the coroutine builds the prompt, owns inserting
        # the DM message on completion, and enqueues bookkeeping. Subscribers
        # on /events see tokens in real time.
        asyncio.create_task(
            _stream_to_redis(gameId, action.action_text, current_user)
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
