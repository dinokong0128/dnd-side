"""
Supabase query helpers used by routes and workers.
All queries use the service role client (bypasses RLS).
"""

from typing import Optional
from config import supabase_client


def get_player_in_game(game_id: str, player_id: str) -> Optional[dict]:
    """Fetch a player record within a specific game."""
    result = (
        supabase_client.table("players")
        .select("*")
        .eq("game_id", game_id)
        .eq("id", player_id)
        .maybe_single()
        .execute()
    )
    return result.data


def get_game(game_id: str) -> Optional[dict]:
    """Fetch a game by ID."""
    result = (
        supabase_client.table("games")
        .select("*")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    return result.data


def insert_message(
    game_id: str, role: str, content: str, profile_id: Optional[str] = None
) -> dict:
    """Insert a message into the game_messages table."""
    result = (
        supabase_client.table("game_messages")
        .insert(
            {
                "game_id": game_id,
                "role": role,
                "content": content,
                "profile_id": profile_id,
            }
        )
        .select("*")
        .single()
        .execute()
    )
    return result.data
