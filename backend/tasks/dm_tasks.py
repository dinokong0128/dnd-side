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
from constants import MESSAGE_ROLE_DM, EVENT_SOURCE_CLAUDE

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
                "source": EVENT_SOURCE_CLAUDE,
            })
        
        # Step 6: Insert DM response to game_messages
        response_message = {
            "game_id": game_id,
            "profile_id": None,
            "role": MESSAGE_ROLE_DM,
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

@dramatiq.actor(max_retries=3, min_backoff=1000)
def generate_opening_narration(game_id: str):
    """
    Generate the opening narration for a new session.
    Called when host starts the game (lobby → active).
    """
    logger.info(f"[generate_opening_narration] Starting for game={game_id}")

    try:
        # 1. Fetch game
        game = supabase_client.table("games").select(
            "id, name, dm_persona"
        ).eq("id", game_id).single().execute()

        # 2. Fetch all players with their inventory
        players = supabase_client.table("players").select(
            "id, character_name, race, level, character_class, hp_max"
        ).eq("game_id", game_id).execute()

        party_lines = []
        for p in (players.data or []):
            # Fetch inventory for this player
            inv = supabase_client.table("player_inventory").select(
                "item_name, quantity"
            ).eq("player_id", p["id"]).execute()

            items = ", ".join(
                f"{i['item_name']} (x{i['quantity']})" if i["quantity"] > 1 else i["item_name"]
                for i in (inv.data or [])
            ) or "no equipment"

            party_lines.append(
                f"- {p['character_name']}, a Level {p.get('level', 1)} {p.get('race', 'Human')} {p['character_class']}. "
                f"HP: {p['hp_max']}. Equipment: {items}"
            )

        party_roster = "\n".join(party_lines)
        party_size = len(players.data or [])

        # 3. Build system prompt
        system_prompt = f"""You are {game.data['dm_persona']}. You are the Dungeon Master for a D&D 5e campaign called "{game.data['name']}".

The party consists of {party_size} adventurer(s):
{party_roster}

Open the session with an immersive narration. Requirements:
1. Establish the setting and atmosphere vividly
2. Acknowledge each character by name and hint at their role
3. Present the opening situation or hook
4. End with a clear invitation for the party to act

Write 3–4 paragraphs. Do not break the fourth wall."""

        # 4. Call Claude
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": "Begin the adventure."}],
        )

        dm_response = response.content[0].text
        logger.info(f"[generate_opening_narration] Claude responded: {len(dm_response)} chars")

        # 5. Insert DM message
        supabase_client.table("game_messages").insert({
            "game_id": game_id,
            "role": "dm",
            "profile_id": None,
            "content": dm_response,
        }).execute()

        # 6. Update game timestamp
        supabase_client.table("games").update({
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", game_id).execute()

        logger.info(f"[generate_opening_narration] Success! game_id={game_id}")

    except Exception as e:
        logger.error(f"[generate_opening_narration] Error: {str(e)}", exc_info=True)
        # Insert error message so clients know something went wrong
        try:
            supabase_client.table("game_messages").insert({
                "game_id": game_id,
                "role": "system",
                "profile_id": None,
                "content": "The Dungeon Master encountered an error while preparing the adventure. Please try starting the session again.",
            }).execute()
        except Exception:
            logger.error("[generate_opening_narration] Failed to insert error message")
        raise  # Let Dramatiq retry


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
