"""DMTarget Protocol and concrete target implementations."""

import logging
import re
import time
from typing import Protocol, runtime_checkable

from config import anthropic_client, supabase_client
from evals.schema import DMResponse
from services.dm_service import (
    build_dm_system_prompt,
    search_rag,
    extract_state_changes,
)
from services.embedding_service import embed_text

logger = logging.getLogger(__name__)

_BLOCK_PATTERNS = [
    r"<state_changes>.*?</state_changes>",
    r"<dice_rolls>.*?</dice_rolls>",
    r"<suggested_actions>.*?</suggested_actions>",
]


def _strip_structured_blocks(text: str) -> str:
    """Strip all XML structured blocks from DM response text."""
    for pattern in _BLOCK_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.DOTALL)
    # Replace event tags but keep inner text
    text = re.sub(
        r'<event\s+type=["\'][^"\']+["\']>(.*?)</event>',
        r"\1",
        text,
        flags=re.DOTALL,
    )
    return text.strip()


@runtime_checkable
class DMTarget(Protocol):
    name: str

    async def respond(self, game_id: str, action: str) -> DMResponse:
        """Invoke DM for the given game and action; return narration + state + metadata."""
        ...


class CurrentTarget:
    """Wraps the production DM code path (steps 0–4b) without persistence."""

    name = "current"

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.model = model

    async def respond(self, game_id: str, action: str) -> DMResponse:
        t0 = time.monotonic()

        # Step 0: Embed + RAG
        action_embedding = embed_text(action)
        rag_results = search_rag(game_id, action_embedding, top_k=5)
        retrieved_event_ids = [r.get("id") for r in rag_results if r.get("id")]

        # Step 1: Fetch game state
        game = (
            supabase_client.table("games")
            .select("*")
            .match({"id": game_id})
            .single()
            .execute()
        )
        players = (
            supabase_client.table("players")
            .select("*")
            .match({"game_id": game_id})
            .execute()
        )
        recent_messages = (
            supabase_client.table("game_messages")
            .select("role, profile_id, content")
            .eq("game_id", game_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        player_ids = [p["id"] for p in (players.data or [])]
        inv_by_player: dict[str, list] = {}
        if player_ids:
            all_inv = (
                supabase_client.table("player_inventory")
                .select("player_id, item_name, quantity")
                .in_("player_id", player_ids)
                .execute()
            )
            for item in all_inv.data or []:
                inv_by_player.setdefault(item["player_id"], []).append(item)

        # Step 2: Build prompt
        system_prompt = build_dm_system_prompt(
            game=game.data,
            players=players.data or [],
            inv_by_player=inv_by_player,
            recent_messages=recent_messages.data or [],
            rag_context=rag_results,
            action_text=action,
        )

        # Step 3: Call Claude (temperature=0 for reproducibility)
        try:
            response = anthropic_client.messages.create(
                model=self.model,
                max_tokens=1024,
                temperature=0,
                system=system_prompt,
                messages=[{"role": "user", "content": action}],
            )
        except Exception as e:
            logger.error("[CurrentTarget] Claude API call failed for game=%s: %s", game_id, e)
            raise

        raw_response = response.content[0].text
        latency_ms = int((time.monotonic() - t0) * 1000)
        tokens_used = response.usage.input_tokens + response.usage.output_tokens
        logger.info("[CurrentTarget] game=%s tokens=%d latency_ms=%d", game_id, tokens_used, latency_ms)

        # Step 4: Extract state changes
        state_updates = extract_state_changes(raw_response)

        # Step 5: Strip blocks for clean narration
        narration = _strip_structured_blocks(raw_response)

        return DMResponse(
            narration=narration,
            state_updates=state_updates,
            metadata={
                "retrieved_event_ids": retrieved_event_ids,
                "tokens_used": tokens_used,
                "latency_ms": latency_ms,
            },
        )
