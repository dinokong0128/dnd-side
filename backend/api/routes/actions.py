# backend/api/routes/actions.py
"""
Actions endpoint: POST /games/{gameId}/actions
Validates action, embeds, queues Dramatiq task
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

from config import supabase_client, openai_client, settings
from api.dependencies import get_current_user
from services.dm_service import validate_action, search_rag
from tasks.dm_tasks import dm_response_task

router = APIRouter()

# Models
class ActionInput(BaseModel):
    """Player action input"""
    player_id: str
    action_text: str
    action_type: str = "general"  # "spell", "attack", "dialogue", "general"

class ActionResponse(BaseModel):
    """Immediate response confirming action queued"""
    action_id: str
    game_id: str
    status: str = "queued"
    message: str = "Action received, processing DM response..."

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
        player = supabase_client.table("players").select("*").match(
            {"game_id": gameId, "player_id": action.player_id}
        ).single().execute()
        
        if not player.data:
            raise HTTPException(
                status_code=403,
                detail="Player not in this game"
            )
        
        # Step 2: Validate action against game rules
        game = supabase_client.table("games").select("*").match(
            {"id": gameId}
        ).single().execute()
        
        validate_action(action, player.data, game.data)
        
        # Step 3: Generate action_id
        action_id = str(uuid.uuid4())
        
        # Step 4: Insert action to game_messages
        message_row = {
            "game_id": gameId,
            "player_id": action.player_id,
            "message_type": "action",
            "content": action.action_text,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        supabase_client.table("game_messages").insert(message_row).execute()
        
        # Step 5: Embed action text
        embedding = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=action.action_text,
            dimensions=1536,
        )
        embedding_vector = embedding.data[0].embedding
        
        # Step 6: RAG search for relevant events
        rag_context = search_rag(gameId, embedding_vector, top_k=5)
        
        # Step 7: Queue Dramatiq task with max_retries
        # Task will handle Claude call, event extraction, response broadcast
        dm_response_task.send(
            game_id=gameId,
            action_id=action_id,
            action_text=action.action_text,
            player_id=action.player_id,
            rag_context=rag_context,  # Pre-computed context
        )
        
        return ActionResponse(
            action_id=action_id,
            game_id=gameId,
            status="queued",
            message="Action received! DM is thinking...",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing action: {str(e)}"
        )
