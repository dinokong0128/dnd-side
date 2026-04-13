"""Messages endpoints: delete and update individual game messages."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from config import supabase_client, openai_client
from api.dependencies import get_current_user
from constants import MESSAGE_ROLE_PLAYER, MESSAGE_ROLE_DM
from services.dm_service import search_rag
from tasks.dm_tasks import dm_response_task
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

ACTION_MAX_LENGTH = 2000


class MessageUpdateInput(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Content cannot be empty")
        if len(v) > ACTION_MAX_LENGTH:
            raise ValueError(f"Content exceeds {ACTION_MAX_LENGTH} characters")
        return v


def _get_last_player_message(game_id: str, message_id: str) -> dict:
    """
    Fetch and validate that message_id is the last player message in the game.
    Raises HTTPException if not found, not a player message, or not the last message.
    """
    msg = (
        supabase_client.table("game_messages")
        .select("id, game_id, role, profile_id, content, created_at")
        .eq("id", message_id)
        .eq("game_id", game_id)
        .maybe_single()
        .execute()
    )
    if not msg.data:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.data["role"] != MESSAGE_ROLE_PLAYER:
        raise HTTPException(status_code=403, detail="Can only edit or delete player messages")

    last = (
        supabase_client.table("game_messages")
        .select("id")
        .eq("game_id", game_id)
        .eq("role", MESSAGE_ROLE_PLAYER)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not last.data or last.data[0]["id"] != message_id:
        raise HTTPException(
            status_code=409,
            detail="Can only edit or delete the last player message in the game",
        )
    return msg.data


@router.delete("/{gameId}/messages/{messageId}", status_code=204)
async def delete_message(
    gameId: str,
    messageId: str,
    current_user: str = Depends(get_current_user),
):
    """Delete the last player message (and any immediately following DM message)."""
    msg = _get_last_player_message(gameId, messageId)

    if msg["profile_id"] != current_user:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")

    following = (
        supabase_client.table("game_messages")
        .select("id, role")
        .eq("game_id", gameId)
        .gt("created_at", msg["created_at"])
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    if following.data and following.data[0]["role"] == MESSAGE_ROLE_DM:
        supabase_client.table("game_messages").delete().eq(
            "id", following.data[0]["id"]
        ).execute()

    supabase_client.table("game_messages").delete().eq("id", messageId).execute()


@router.patch("/{gameId}/messages/{messageId}", status_code=200)
async def update_message(
    gameId: str,
    messageId: str,
    payload: MessageUpdateInput,
    current_user: str = Depends(get_current_user),
):
    """Update the last player message content and re-queue DM response."""
    msg = _get_last_player_message(gameId, messageId)

    if msg["profile_id"] != current_user:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")

    following = (
        supabase_client.table("game_messages")
        .select("id, role")
        .eq("game_id", gameId)
        .gt("created_at", msg["created_at"])
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    if following.data and following.data[0]["role"] == MESSAGE_ROLE_DM:
        supabase_client.table("game_messages").delete().eq(
            "id", following.data[0]["id"]
        ).execute()

    updated = (
        supabase_client.table("game_messages")
        .update({"content": payload.content})
        .eq("id", messageId)
        .select("id, game_id, role, profile_id, content, created_at")
        .single()
        .execute()
    )

    try:
        embedding = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=payload.content,
            dimensions=1536,
        )
        rag_context = search_rag(gameId, embedding.data[0].embedding, top_k=5)
    except Exception as e:
        logger.warning(f"[update_message] Embedding failed, falling back to no RAG: {e}")
        rag_context = []

    dm_response_task.send(
        game_id=gameId,
        message_id=messageId,
        action_text=payload.content,
        rag_context=rag_context,
    )

    return updated.data
