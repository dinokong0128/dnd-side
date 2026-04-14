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


def extract_dice_rolls(dm_response: str) -> list[dict]:
    """
    Parse <dice_rolls>[...]</dice_rolls> block from Claude's DM response.
    Returns list of dice roll dicts, or [] if block is absent or malformed.
    Non-fatal: errors are logged as warnings and an empty list is returned.
    """
    match = re.search(r"<dice_rolls>(.*?)</dice_rolls>", dm_response, re.DOTALL)
    if not match:
        return []
    try:
        rolls = json.loads(match.group(1).strip())
        if not isinstance(rolls, list):
            logger.warning("[extract_dice_rolls] dice_rolls block is not a JSON array")
            return []
        return rolls
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("[extract_dice_rolls] Failed to parse dice_rolls block: %s", exc)
        return []


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
