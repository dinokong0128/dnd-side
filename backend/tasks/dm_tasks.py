# backend/tasks/dm_tasks.py
"""
Dramatiq tasks for async work:
- dm_response_task: Call Claude, extract events, broadcast
- aggregation_task: Background summaries of long campaigns
"""
import dramatiq
from typing import List, Dict, Any
import json
import uuid
from datetime import datetime
import logging

from config import supabase_client, anthropic_client, openai_client
import redis_broker  # noqa: F401 — ensure broker is set before defining actors
from services.dm_service import extract_events_from_response

logger = logging.getLogger(__name__)

@dramatiq.actor(max_retries=3, min_backoff=1000)
def dm_response_task(
    game_id: str,
    action_id: str,
    action_text: str,
    player_id: str,
    rag_context: List[Dict[str, Any]],
):
    """
    Async Dramatiq task: Process DM response
    
    1. Fetch game state + relevant events
    2. Build Claude system prompt with RAG context
    3. Call Claude API
    4. Extract events from response (JSON markers)
    5. Embed events
    6. Insert DM response to game_messages
    7. Insert events to game_events
    8. Update game state
    
    If fails 3 times: dead-letter queue (requires manual review)
    """
    
    logger.info(f"[dm_response_task] Starting for game={game_id}, action={action_id}")
    
    try:
        # Step 1: Fetch game state
        game = supabase_client.table("games").select("*").match(
            {"id": game_id}
        ).single().execute()
        
        players = supabase_client.table("players").select("*").match(
            {"game_id": game_id}
        ).execute()
        
        # Step 2: Build Claude system prompt
        system_prompt = f"""
You are the Dungeon Master for a multiplayer D&D campaign.
Game: {game.data['name']}
Setting: {game.data['setting']}
Campaign: {game.data['campaign_description']}

CURRENT PARTY:
{json.dumps([{
    'name': p['character_name'],
    'class': p['class'],
    'level': p['level'],
    'health': p['stats']['health'] if p['stats'] else 'Unknown',
} for p in players.data], indent=2)}

RELEVANT PAST EVENTS (Context from RAG):
{json.dumps(rag_context, indent=2)}

RULES:
- Respond in character as the DM
- Be engaging and descriptive
- Track game state changes (health, inventory, position)
- If important story events happen, mark them with:
  <event type="combat|discovery|dialogue|death|milestone">Event description</event>
- Keep responses to 2-3 paragraphs

PLAYER ACTION:
{player_id} says: "{action_text}"
"""
        
        # Step 3: Call Claude API
        response = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=500,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": action_text,
                }
            ],
        )
        
        dm_response = response.content[0].text
        logger.info(f"[dm_response_task] Claude responded: {len(dm_response)} chars")
        
        # Step 4: Extract events from response
        events = extract_events_from_response(dm_response)
        logger.info(f"[dm_response_task] Extracted {len(events)} events")
        
        # Step 5: Embed events
        event_rows = []
        for event in events:
            event_embedding = openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=event['description'],
                dimensions=1536,
            )
            
            event_rows.append({
                "game_id": game_id,
                "event_type": event['type'],
                "description": event['description'],
                "created_at": datetime.utcnow().isoformat(),
                "vector": event_embedding.data[0].embedding,  # pgvector column
            })
        
        # Step 6: Insert DM response to game_messages
        response_message = {
            "game_id": game_id,
            "player_id": None,  # DM messages have no player
            "message_type": "dm_response",
            "content": dm_response,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        supabase_client.table("game_messages").insert(response_message).execute()
        logger.info(f"[dm_response_task] Inserted DM response")
        
        # Step 7: Insert events to game_events
        if event_rows:
            supabase_client.table("game_events").insert(event_rows).execute()
            logger.info(f"[dm_response_task] Inserted {len(event_rows)} events")
        
        # Step 8: Update game state (if needed)
        # Example: Increment turn counter, update player health, etc.
        supabase_client.table("games").update({
            "last_dm_response": datetime.utcnow().isoformat(),
            "turn_count": game.data.get('turn_count', 0) + 1,
        }).match({"id": game_id}).execute()
        
        logger.info(f"[dm_response_task] Success! game_id={game_id}")
        
    except Exception as e:
        logger.error(f"[dm_response_task] Error: {str(e)}", exc_info=True)
        # Dramatiq will retry up to 3 times with exponential backoff
        raise

@dramatiq.actor()
def aggregation_task(game_id: str):
    """
    Background task: Summarize long campaigns
    
    Called periodically (e.g., after 50 messages) to generate:
    - Campaign summary
    - Key events
    - Character arcs
    
    Useful for RAG context size management
    """
    logger.info(f"[aggregation_task] Running for game={game_id}")
    
    # Fetch recent messages
    messages = supabase_client.table("game_messages").select("*").match(
        {"game_id": game_id}
    ).order("created_at", desc=True).limit(50).execute()
    
    # TODO: Call Claude to summarize
    # Insert summary to a new table: campaign_summaries
    
    logger.info(f"[aggregation_task] Complete for game={game_id}")
