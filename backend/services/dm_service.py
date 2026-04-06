"""
DM orchestration service — RAG search and action validation.
Embedding and Claude calls happen in the Dramatiq worker (dm_tasks.py).
This module handles synchronous pre-processing before enqueueing.
"""
import re
from typing import Any
from config import supabase_client


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
    if game.get("status") != "active":
        raise ValueError(f"Game is not active (status: {game.get('status')})")
    if player.get("status") == "dead":
        raise ValueError("Dead players cannot take actions")


def search_rag(game_id: str, embedding: list[float], top_k: int = 5) -> list[dict[str, Any]]:
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
