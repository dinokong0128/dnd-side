"""
DM orchestration service — RAG search and action validation.
Embedding and Claude calls happen in the Dramatiq worker (dm_tasks.py).
This module handles synchronous pre-processing before enqueueing.
"""

import json
import logging
import re
from typing import Any
from config import supabase_client
from constants import GAME_STATUS_ACTIVE, PLAYER_STATUS_DEAD

logger = logging.getLogger(__name__)


def validate_action(action: Any, player: dict, game: dict) -> None:
    """
    Validate a player action against current game state.
    Raises ValueError if the action is invalid.
    Add game-rule checks here as the game evolves.
    """
    if not action.action_text or not action.action_text.strip():
        raise ValueError("Action text cannot be empty")
    if len(action.action_text) > 2000:
        raise ValueError("Action text exceeds 2000 character limit")
    if game.get("status") != GAME_STATUS_ACTIVE:
        raise ValueError(f"Game is not active (status: {game.get('status')})")
    if player.get("status") == PLAYER_STATUS_DEAD:
        raise ValueError("Dead players cannot take actions")


def search_rag(
    game_id: str, embedding: list[float], top_k: int = 5
) -> list[dict[str, Any]]:
    """
    Cosine similarity search on game_events using pgvector <=> operator.
    Returns the top_k most relevant past events for RAG context injection.
    """
    result = supabase_client.rpc(
        "match_game_events",
        {"p_game_id": game_id, "p_embedding": embedding, "p_top_k": top_k},
    ).execute()
    return result.data or []


def extract_events_from_response(dm_response: str) -> list[dict[str, str]]:
    """
    Parse <event type="...">...</event> markers out of Claude's DM response.
    Returns list of {"type": str, "description": str} dicts.
    """
    pattern = r'<event\s+type=["\']([^"\']+)["\']>(.*?)</event>'
    matches = re.findall(pattern, dm_response, re.DOTALL)
    return [
        {"type": event_type.strip(), "description": description.strip()}
        for event_type, description in matches
    ]


def extract_state_changes(dm_response: str) -> dict:
    """
    Parse the <state_changes>...</state_changes> JSON block from Claude's DM response.
    Returns the parsed dict, or {} if the block is absent or malformed (non-fatal).
    """
    pattern = r'<state_changes>(.*?)</state_changes>'
    match = re.search(pattern, dm_response, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(1).strip())
    except (json.JSONDecodeError, ValueError):
        logger.warning("extract_state_changes: failed to parse JSON block")
        return {}


def apply_state_changes(state_changes: dict) -> None:
    """
    Apply mechanical state mutations from a <state_changes> block to the DB.
    All operations are best-effort — failures are logged but do NOT propagate.
    Uses service role client (bypasses RLS).
    """
    # HP changes
    for change in state_changes.get("hp_changes", []):
        try:
            character_id = change["character_id"]
            delta = int(change["delta"])
            player = (
                supabase_client.table("players")
                .select("hp_current, hp_max")
                .eq("id", character_id)
                .single()
                .execute()
            )
            hp_current = player.data["hp_current"]
            hp_max = player.data["hp_max"]
            new_hp = max(0, min(hp_max, hp_current + delta))
            supabase_client.table("players").update({"hp_current": new_hp}).eq(
                "id", character_id
            ).execute()
        except Exception as e:
            logger.error(f"apply_state_changes: hp_changes failed for {change}: {e}")

    # Inventory additions
    for item in state_changes.get("inventory_add", []):
        try:
            existing = (
                supabase_client.table("player_inventory")
                .select("id, quantity")
                .eq("player_id", item["character_id"])
                .eq("item_name", item["item_name"])
                .execute()
            )
            if existing.data:
                new_qty = existing.data[0]["quantity"] + item.get("quantity", 1)
                supabase_client.table("player_inventory").update(
                    {"quantity": new_qty}
                ).eq("id", existing.data[0]["id"]).execute()
            else:
                supabase_client.table("player_inventory").insert(
                    {
                        "player_id": item["character_id"],
                        "item_name": item["item_name"],
                        "quantity": item.get("quantity", 1),
                    }
                ).execute()
        except Exception as e:
            logger.error(f"apply_state_changes: inventory_add failed for {item}: {e}")

    # Inventory removals
    for item in state_changes.get("inventory_remove", []):
        try:
            existing = (
                supabase_client.table("player_inventory")
                .select("id, quantity")
                .eq("player_id", item["character_id"])
                .eq("item_name", item["item_name"])
                .execute()
            )
            if not existing.data:
                continue
            row = existing.data[0]
            new_qty = row["quantity"] - item.get("quantity", 1)
            if new_qty <= 0:
                supabase_client.table("player_inventory").delete().eq(
                    "id", row["id"]
                ).execute()
            else:
                supabase_client.table("player_inventory").update(
                    {"quantity": new_qty}
                ).eq("id", row["id"]).execute()
        except Exception as e:
            logger.error(
                f"apply_state_changes: inventory_remove failed for {item}: {e}"
            )
