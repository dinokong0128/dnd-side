# backend/api/routes/actions.py
"""
Actions endpoint: POST /games/{gameId}/actions
Validates action, embeds, queues Dramatiq task
"""

from fastapi import APIRouter, Depends, HTTPException
import logging
import uuid

from config import supabase_client, openai_client
from api.dependencies import get_current_user
from models.action import ActionInput, ActionResponse
from services.dm_service import validate_action, search_rag
from tasks.dm_tasks import dm_response_task
from constants import MESSAGE_ROLE_PLAYER

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{gameId}/actions", response_model=ActionResponse, status_code=202)
async def create_action(
    gameId: str,
    action: ActionInput,
    current_user: str = Depends(get_current_user),
):
    """
    Player sends action → Backend queues DM response task

    Flow:
    1. Validate action (Pydantic)
    2. Check player is in game & valid player_id
    3. Insert action to game_messages table
    4. Embed action text via OpenAI
    5. RAG search on game_events
    6. Queue Dramatiq task: dm_response_task(game_id, action_id)
    7. Return 202 Accepted immediately

    DM response happens async in worker → broadcast via Supabase Realtime
    """

    try:
        # Step 1: Verify player is in this game
        player = (
            supabase_client.table("players")
            .select("*")
            .match({"game_id": gameId, "profile_id": current_user})
            .single()
            .execute()
        )

        if not player.data:
            raise HTTPException(status_code=403, detail="Player not in this game")

        # Step 2: Validate action against game rules
        game = (
            supabase_client.table("games")
            .select("*")
            .match({"id": gameId})
            .single()
            .execute()
        )

        validate_action(action, player.data, game.data)

        # Step 3: Generate message_id
        message_id = str(uuid.uuid4())

        # Step 4: Insert action to game_messages
        message_row = {
            "game_id": gameId,
            "profile_id": current_user,
            "role": MESSAGE_ROLE_PLAYER,
            "content": action.action_text,
        }

        supabase_client.table("game_messages").insert(message_row).execute()

        # Step 5: Embed action text + RAG search (falls back to empty context on failure)
        try:
            embedding = openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=action.action_text,
                dimensions=1536,
            )
            embedding_vector = embedding.data[0].embedding
            rag_context = search_rag(gameId, embedding_vector, top_k=5)
        except Exception as e:
            logger.warning(
                f"[create_action] OpenAI embedding failed (fallback to no RAG): {e}"
            )
            rag_context = []

        # Step 6: Queue Dramatiq task with max_retries
        # Task will handle Claude call, event extraction, response broadcast
        dm_response_task.send(
            game_id=gameId,
            message_id=message_id,
            action_text=action.action_text,
            rag_context=rag_context,  # Pre-computed context
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
