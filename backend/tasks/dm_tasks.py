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
    message_id: str,
    action_text: str,
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

    logger.info(f"[dm_response_task] Starting for game={game_id}, message={message_id}")
    
    try:
        # Step 1: Fetch game state
        game = supabase_client.table("games").select("*").match(
            {"id": game_id}
        ).single().execute()
        
        players = supabase_client.table("players").select("*").match(
            {"game_id": game_id}
        ).execute()
        
        # Step 2: Build Claude system prompt
        system_prompt = f"""You are {game.data['dm_persona']}. You are the Dungeon Master for a D&D 5e campaign called "{game.data['name']}".

CURRENT PARTY:
{chr(10).join(f"- {p['character_name']}, Level {p.get('level', 1)} {p.get('race', 'Human')} {p['character_class']}. HP: {p['hp_current']}/{p['hp_max']}" for p in players.data)}

RELEVANT PAST EVENTS (Context from RAG):
{json.dumps(rag_context, indent=2) if rag_context else "No past events yet."}

RULES:
- Respond in character as the DM — never break the fourth wall
- Be vivid and engaging but keep responses to 2–3 paragraphs
- If important story events happen, mark them with:
  <event type="combat|discovery|dialogue|death|milestone">Brief factual description</event>
- End with a clear invitation for the party to act

PLAYER ACTION:
"{action_text}"
"""
        
        # Step 3: Call Claude API
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
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
                "summary": event['description'],
                "embedding": event_embedding.data[0].embedding,
                "source": "claude",
            })
        
        # Step 6: Insert DM response to game_messages
        response_message = {
            "game_id": game_id,
            "profile_id": None,
            "role": "dm",
            "content": dm_response,
        }

        supabase_client.table("game_messages").insert(response_message).execute()
        logger.info(f"[dm_response_task] Inserted DM response")
        
        # Step 7: Insert events to game_events
        if event_rows:
            supabase_client.table("game_events").insert(event_rows).execute()
            logger.info(f"[dm_response_task] Inserted {len(event_rows)} events")
        
        # Step 8: Update game state
        supabase_client.table("games").update({
            "updated_at": datetime.utcnow().isoformat(),
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
