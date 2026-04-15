# backend/tasks/dm_tasks.py
"""
Dramatiq tasks for async work:
- dm_response_task: Call Claude, extract events, broadcast
- aggregation_task: Background summaries of long campaigns
"""

import math
import dramatiq
from typing import List, Dict, Any
import json
from datetime import datetime
import logging
import re

from config import supabase_client, anthropic_client, openai_client
import redis_broker  # noqa: F401 — ensure broker is set before defining actors
from dramatiq.middleware import CurrentMessage
from services.dm_service import (
    extract_events_from_response,
    extract_state_changes,
    apply_state_changes,
    extract_dice_rolls,
    search_rag,
)
from services.embedding_service import embed_text
from constants import MESSAGE_ROLE_DM, MESSAGE_ROLE_SYSTEM, EVENT_SOURCE_CLAUDE

logger = logging.getLogger(__name__)

DM_TASK_MAX_RETRIES = 3


@dramatiq.actor(max_retries=DM_TASK_MAX_RETRIES, min_backoff=1000)
def dm_response_task(
    game_id: str,
    message_id: str,
    action_text: str,
    rag_context: List[Dict[str, Any]],
):
    """
    Async Dramatiq task: Process DM response

    1.  Fetch game state + players
    1b. Fetch last 20 messages for history context
    1c. Fetch player inventory for each player
    2.  Build Claude system prompt with history, inventory, RAG context
    3.  Call Claude API
    4.  Extract events from raw response
    5.  Embed events
    6.  Strip event markers from displayed message
    7.  Insert cleaned DM response to game_messages
    8.  Insert events to game_events
    9.  Update game timestamp

    On failure: insert system error message, then re-raise for Dramatiq retry.
    If fails 3 times: dead-letter queue (requires manual review)
    """

    logger.info(f"[dm_response_task] Starting for game={game_id}, message={message_id}")

    try:
        # Step 1: Fetch game state
        game = (
            supabase_client.table("games")
            .select("*")
            .match({"id": game_id})
            .single()
            .execute()
        )

        players = (
            supabase_client.table("players")
            .select("*")
            .match({"game_id": game_id})
            .execute()
        )

        # Step 1b: Fetch last 20 messages for context
        recent_messages = (
            supabase_client.table("game_messages")
            .select("role, profile_id, content")
            .eq("game_id", game_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )

        # Reverse to chronological order and format
        message_history = []
        for msg in reversed(recent_messages.data or []):
            if msg["role"] == "dm":
                message_history.append(f"DM: {msg['content']}")
            elif msg["role"] == "player":
                # Find character name for this profile_id
                player_name = next(
                    (
                        p["character_name"]
                        for p in players.data
                        if p.get("profile_id") == msg.get("profile_id")
                    ),
                    "Unknown Player",
                )
                message_history.append(f"{player_name}: {msg['content']}")
            # Skip system messages in context

        message_history_text = (
            "\n\n".join(message_history) if message_history else "No messages yet."
        )

        def _ability_mod(score: int) -> str:
            """Format an ability score modifier with sign (e.g. +3 or -1)."""
            m = math.floor((score - 10) / 2)
            return f"{m:+d}"

        # Step 1c: Fetch player inventory
        party_lines = []
        for p in players.data:
            inv = (
                supabase_client.table("player_inventory")
                .select("item_name, quantity")
                .eq("player_id", p["id"])
                .execute()
            )

            items = (
                ", ".join(
                    (
                        f"{i['item_name']} (x{i['quantity']})"
                        if i["quantity"] > 1
                        else i["item_name"]
                    )
                    for i in (inv.data or [])
                )
                or "no equipment"
            )

            stats = p.get("stats") or {}
            str_score = stats.get("str", 10)
            dex_score = stats.get("dex", 10)
            con_score = stats.get("con", 10)
            int_score = stats.get("int", 10)
            wis_score = stats.get("wis", 10)
            cha_score = stats.get("cha", 10)

            level = p.get("level", 1)
            if level >= 17:
                prof_bonus = 6
            elif level >= 13:
                prof_bonus = 5
            elif level >= 9:
                prof_bonus = 4
            elif level >= 5:
                prof_bonus = 3
            else:
                prof_bonus = 2

            party_lines.append(
                f"- {p['character_name']} [ID: {p['id']}], Level {level} "
                f"{p.get('race', 'Human')} {p['character_class']}.\n"
                f"  HP: {p['hp_current']}/{p['hp_max']}.\n"
                f"  STR {str_score} ({_ability_mod(str_score)}), DEX {dex_score} ({_ability_mod(dex_score)}), "
                f"CON {con_score} ({_ability_mod(con_score)}),\n"
                f"  INT {int_score} ({_ability_mod(int_score)}), WIS {wis_score} ({_ability_mod(wis_score)}), "
                f"CHA {cha_score} ({_ability_mod(cha_score)})\n"
                f"  Proficiency bonus: +{prof_bonus}\n"
                f"  Equipment: {items}"
            )

        # Step 2: Build Claude system prompt
        system_prompt = f"""You are {game.data['dm_persona']}. You are the Dungeon Master for a D&D 5e campaign called "{game.data['name']}".

CURRENT PARTY:
{chr(10).join(party_lines)}

RECENT SESSION HISTORY (last 20 messages, oldest first):
---
{message_history_text}
---

RELEVANT PAST EVENTS (Context from RAG):
{json.dumps(rag_context, indent=2) if rag_context else "No past events yet."}

RULES:
1. Respond in character as the DM — never break the fourth wall
2. Be vivid and engaging but keep responses to 2–3 short paragraphs (~100 words total)
3. Account for character abilities, equipment, and class features when narrating outcomes
4. If the player's action requires a skill check, narrate the attempt and outcome (you decide the result)
5. If important story events occur, mark them inline:
   <event type="combat|discovery|dialogue|death|milestone">Brief factual description</event>
6. End with a clear invitation for the party to act
7. Do not list game mechanics or stat changes — narrate them naturally
8. When your narration causes HP changes or inventory changes, emit a <state_changes> block
   AFTER your narrative text and BEFORE the <suggested_actions> block:
   <state_changes>
   {{
     "hp_changes": [{{"character_id": "<ID from party list>", "delta": -8, "reason": "goblin attack"}}],
     "inventory_add": [{{"character_id": "<ID>", "item_name": "Gold Coin", "quantity": 50}}],
     "inventory_remove": [{{"character_id": "<ID>", "item_name": "Torch", "quantity": 1}}]
   }}
   </state_changes>
   All fields are optional — only include fields that changed. Omit the block entirely if no state changes occur.
   character_id must be the exact UUID from the party list above (e.g. [ID: abc-123]).
   delta is signed: negative for damage, positive for healing.
9. After your narrative response, produce 2–10 short suggested actions the player could
   take next (imperative mood, ~10 words each). Wrap them in:
   <suggested_actions>
   Pick the lock using your thieves' tools.
   Search the walls for a hidden mechanism.
   </suggested_actions>
10. DICE ROLLS: When you resolve a dice roll (ability check, saving throw, attack, or damage),
   embed the result BEFORE your narrative text using this exact format:
   <dice_rolls>
   [
     {{
       "type": "dice_roll",
       "die": "d20",
       "count": 1,
       "result": <integer 1–20>,
       "modifier": <signed integer, 0 if none>,
       "total": <result + modifier>,
       "label": "<human-readable label, e.g. Stealth Check>",
       "dc": <integer, only for checks/saves>,
       "success": <true|false, only when dc is present>,
       "advantage": <true|false, only when relevant>,
       "all_rolls": [<roll1>, <roll2>]
     }}
   ]
   </dice_rolls>
   Rules: result must satisfy 1 ≤ result ≤ (count × die_sides). Include one entry per distinct roll.

The acting player's action:
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

        # Step 4: Extract events and dice rolls from response
        events = extract_events_from_response(dm_response)
        logger.info(f"[dm_response_task] Extracted {len(events)} events")

        # Step 4b: Extract and apply state changes (HP, inventory)
        state_changes = extract_state_changes(dm_response)
        if state_changes:
            apply_state_changes(state_changes)
            logger.info(
                f"[dm_response_task] Applied state changes: {list(state_changes.keys())}"
            )

        dice_rolls = extract_dice_rolls(dm_response)
        logger.info(f"[dm_response_task] Extracted {len(dice_rolls)} dice rolls")

        # Step 5: Embed events
        event_rows = []
        for event in events:
            event_embedding = openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=event["description"],
                dimensions=1536,
            )

            event_rows.append(
                {
                    "game_id": game_id,
                    "event_type": event["type"],
                    "summary": event["description"],
                    "embedding": event_embedding.data[0].embedding,
                    "source": EVENT_SOURCE_CLAUDE,
                }
            )

        # Step 6: Parse and strip suggested_actions block
        suggested_match = re.search(
            r'<suggested_actions>(.*?)</suggested_actions>',
            dm_response,
            flags=re.DOTALL,
        )
        suggested_actions: list[str] = []
        if suggested_match:
            suggested_actions = [
                line.strip()
                for line in suggested_match.group(1).splitlines()
                if line.strip()
            ]

        # Strip suggested_actions block from response before further processing
        dm_response_no_suggestions = re.sub(
            r'<suggested_actions>.*?</suggested_actions>',
            '',
            dm_response,
            flags=re.DOTALL,
        ).strip()

        # Strip event markers from the displayed message (keep inner text via \1)
        response_no_events = re.sub(
            r'<event\s+type=["\'][^"\']+["\']>(.*?)</event>',
            r"\1",
            dm_response_no_suggestions,
            flags=re.DOTALL,
        ).strip()

        # Strip <state_changes> block entirely (machine-readable, not for display)
        response_no_state = re.sub(
            r'<state_changes>.*?</state_changes>',
            '',
            response_no_events,
            flags=re.DOTALL,
        ).strip()

        # Strip <dice_rolls> block — stored separately in dice_rolls column
        clean_response = re.sub(
            r'<dice_rolls>.*?</dice_rolls>',
            '',
            response_no_state,
            flags=re.DOTALL,
        ).strip()

        # Step 7: Insert DM response to game_messages
        response_message = {
            "game_id": game_id,
            "profile_id": None,
            "role": MESSAGE_ROLE_DM,
            "content": clean_response,
            "dice_rolls": dice_rolls if dice_rolls else None,
        }

        supabase_client.table("game_messages").insert(response_message).execute()
        logger.info("[dm_response_task] Inserted DM response")

        # Step 8: Insert events to game_events
        if event_rows:
            supabase_client.table("game_events").insert(event_rows).execute()
            logger.info(f"[dm_response_task] Inserted {len(event_rows)} events")

        # Step 9: Update game state (including suggested actions)
        supabase_client.table("games").update(
            {
                "updated_at": datetime.utcnow().isoformat(),
                "suggested_actions": suggested_actions,
            }
        ).match({"id": game_id}).execute()

        logger.info(f"[dm_response_task] Success! game_id={game_id}")

    except Exception as e:
        logger.error(f"[dm_response_task] Error: {str(e)}", exc_info=True)

        # Only insert a system error message on the terminal retry so users never see a
        # false failure that later disappears when a subsequent retry succeeds.
        # CurrentMessage.get_current_message() is None when called outside Dramatiq
        # (e.g. directly in tests), which we treat as a non-terminal attempt.
        try:
            msg = CurrentMessage.get_current_message()
            retries_so_far = msg.options.get("retries", 0) if msg else 0
            if retries_so_far >= DM_TASK_MAX_RETRIES:
                supabase_client.table("game_messages").insert(
                    {
                        "game_id": game_id,
                        "role": MESSAGE_ROLE_SYSTEM,
                        "profile_id": None,
                        "content": "The Dungeon Master encountered an error. Please try your action again.",
                    }
                ).execute()
        except Exception:
            logger.error("[dm_response_task] Failed to insert error message")

        raise  # Let Dramatiq retry


@dramatiq.actor(max_retries=3, min_backoff=1000)
def generate_opening_narration(game_id: str):
    """
    Generate the opening narration for a new session.
    Called when host starts the game (lobby → active).
    """
    logger.info(f"[generate_opening_narration] Starting for game={game_id}")

    try:
        # 1. Fetch game
        game = (
            supabase_client.table("games")
            .select("id, name, dm_persona")
            .eq("id", game_id)
            .single()
            .execute()
        )

        # 2. Fetch all players with their inventory
        players = (
            supabase_client.table("players")
            .select("id, character_name, race, level, character_class, hp_max")
            .eq("game_id", game_id)
            .execute()
        )

        party_lines = []
        for p in players.data or []:
            # Fetch inventory for this player
            inv = (
                supabase_client.table("player_inventory")
                .select("item_name, quantity")
                .eq("player_id", p["id"])
                .execute()
            )

            items = (
                ", ".join(
                    (
                        f"{i['item_name']} (x{i['quantity']})"
                        if i["quantity"] > 1
                        else i["item_name"]
                    )
                    for i in (inv.data or [])
                )
                or "no equipment"
            )

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
        logger.info(
            f"[generate_opening_narration] Claude responded: {len(dm_response)} chars"
        )

        # 5. Insert DM message
        supabase_client.table("game_messages").insert(
            {
                "game_id": game_id,
                "role": "dm",
                "profile_id": None,
                "content": dm_response,
            }
        ).execute()

        # 6. Update game timestamp
        supabase_client.table("games").update(
            {
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", game_id).execute()

        logger.info(f"[generate_opening_narration] Success! game_id={game_id}")

    except Exception as e:
        logger.error(f"[generate_opening_narration] Error: {str(e)}", exc_info=True)
        # Insert error message so clients know something went wrong
        try:
            supabase_client.table("game_messages").insert(
                {
                    "game_id": game_id,
                    "role": "system",
                    "profile_id": None,
                    "content": "The Dungeon Master encountered an error while preparing the adventure. Please try starting the session again.",
                }
            ).execute()
        except Exception:
            logger.error("[generate_opening_narration] Failed to insert error message")
        raise  # Let Dramatiq retry


@dramatiq.actor(max_retries=2, min_backoff=1000)
def generate_pause_message(game_id: str):
    """Generate a short in-world pause message."""
    logger.info(f"[generate_pause_message] Starting for game={game_id}")
    try:
        game = (
            supabase_client.table("games")
            .select("dm_persona")
            .eq("id", game_id)
            .single()
            .execute()
        )

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=256,
            system=(
                f"You are {game.data['dm_persona']}. The session is being paused. "
                "Write a single evocative sentence (in-world, no meta-commentary) "
                "that signals a pause in the adventure. Do not end the story — "
                "imply it continues soon."
            ),
            messages=[{"role": "user", "content": "Pause the session."}],
        )

        supabase_client.table("game_messages").insert(
            {
                "game_id": game_id,
                "role": "dm",
                "profile_id": None,
                "content": response.content[0].text,
            }
        ).execute()

        logger.info(f"[generate_pause_message] Success for game={game_id}")
    except Exception as e:
        logger.error(f"[generate_pause_message] Error: {str(e)}", exc_info=True)
        # Best-effort — don't insert error message, status is already changed
        raise


@dramatiq.actor(max_retries=2, min_backoff=1000)
def generate_end_message(game_id: str):
    """Generate a short in-world closing narration."""
    logger.info(f"[generate_end_message] Starting for game={game_id}")
    try:
        game = (
            supabase_client.table("games")
            .select("dm_persona")
            .eq("id", game_id)
            .single()
            .execute()
        )

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=(
                f"You are {game.data['dm_persona']}. The session is ending. "
                "Write 2–3 sentences (in-world, no meta-commentary) that give "
                "the party a sense of narrative conclusion for this chapter. "
                "It may be bittersweet, triumphant, or mysterious — match the "
                "campaign tone."
            ),
            messages=[{"role": "user", "content": "End the session."}],
        )

        supabase_client.table("game_messages").insert(
            {
                "game_id": game_id,
                "role": "dm",
                "profile_id": None,
                "content": response.content[0].text,
            }
        ).execute()

        logger.info(f"[generate_end_message] Success for game={game_id}")
    except Exception as e:
        logger.error(f"[generate_end_message] Error: {str(e)}", exc_info=True)
        raise


RESUME_CONTEXT_MESSAGES = 20


@dramatiq.actor(max_retries=3, min_backoff=1000)
def generate_resume_narration(game_id: str):
    """
    Generate a resume narration with full RAG context.
    First real exercise of the RAG pipeline:
    1. Fetch last 20 messages
    2. Embed the latest player message
    3. Cosine-similarity search on game_events
    4. Build prompt with both context sources
    5. Call Claude
    """
    logger.info(f"[generate_resume_narration] Starting for game={game_id}")

    try:
        # 1. Fetch game
        game = (
            supabase_client.table("games")
            .select("id, name, dm_persona")
            .eq("id", game_id)
            .single()
            .execute()
        )

        # 2. Fetch all players
        players = (
            supabase_client.table("players")
            .select(
                "id, profile_id, character_name, race, level, character_class, hp_current, hp_max"
            )
            .eq("game_id", game_id)
            .execute()
        )

        party_lines = []
        for p in players.data or []:
            party_lines.append(
                f"- {p['character_name']}, Level {p.get('level', 1)} "
                f"{p.get('race', 'Human')} {p['character_class']}. "
                f"HP: {p['hp_current']}/{p['hp_max']}"
            )
        party_roster = "\n".join(party_lines)

        # 3. Fetch last 20 messages
        recent_messages = (
            supabase_client.table("game_messages")
            .select("role, profile_id, content")
            .eq("game_id", game_id)
            .order("created_at", desc=True)
            .limit(RESUME_CONTEXT_MESSAGES)
            .execute()
        )

        # Build a profile_id → character_name map for message formatting
        player_name_map = {
            p["profile_id"]: p["character_name"]
            for p in (players.data or [])
            if p.get("profile_id") and p.get("character_name")
        }

        # Reverse to chronological order and format
        message_history_lines = []
        last_player_message = None
        for msg in reversed(recent_messages.data or []):
            if msg["role"] == "dm":
                message_history_lines.append(f"DM: {msg['content']}")
            elif msg["role"] == "player":
                name = player_name_map.get(msg.get("profile_id"), "Unknown Player")
                message_history_lines.append(f"{name}: {msg['content']}")
                last_player_message = msg["content"]  # Track latest player message
            # Skip system messages in context

        message_history_text = (
            "\n\n".join(message_history_lines)
            if message_history_lines
            else "No messages yet."
        )

        # 4. RAG: embed latest player message and search game_events
        rag_text = ""
        if last_player_message:
            try:
                query_embedding = embed_text(last_player_message)
                rag_results = search_rag(game_id, query_embedding, top_k=5)

                if rag_results:
                    rag_lines = []
                    for event in rag_results:
                        rag_lines.append(
                            f"- [{event.get('event_type', 'event')}] {event.get('summary', '')}"
                        )
                    rag_text = "\n".join(rag_lines)
            except Exception as rag_error:
                logger.warning(
                    f"[generate_resume_narration] RAG search failed (non-fatal): {rag_error}"
                )
                # Continue without RAG — message history alone is sufficient

        # 5. Build system prompt
        rag_section = (
            f"""Relevant past events from campaign memory:
---
{rag_text}
---"""
            if rag_text
            else "No past campaign events recorded yet."
        )

        system_prompt = f"""You are {game.data['dm_persona']}. You are resuming a D&D 5e campaign session called "{game.data['name']}" after a pause.

Party:
{party_roster}

Recent session history (last {RESUME_CONTEXT_MESSAGES} messages, oldest first):
---
{message_history_text}
---

{rag_section}

Your task: Write a brief resume narration. Requirements:
1. Open in-world — no meta-commentary ("Welcome back", "Last session", etc.)
2. Convey that time has passed or the party has had a moment to breathe
3. Briefly reestablish where the party is and what they were doing
4. Reference at least one specific past event or detail from the history above
5. End with a clear invitation to act

Write 2–3 paragraphs."""

        # 6. Call Claude
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=system_prompt,
            messages=[{"role": "user", "content": "Resume the adventure."}],
        )

        dm_response = response.content[0].text
        logger.info(
            f"[generate_resume_narration] Claude responded: {len(dm_response)} chars"
        )

        # 7. Insert DM message
        supabase_client.table("game_messages").insert(
            {
                "game_id": game_id,
                "role": "dm",
                "profile_id": None,
                "content": dm_response,
            }
        ).execute()

        # 8. Update game timestamp
        supabase_client.table("games").update(
            {
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", game_id).execute()

        logger.info(f"[generate_resume_narration] Success! game_id={game_id}")

    except Exception as e:
        logger.error(f"[generate_resume_narration] Error: {str(e)}", exc_info=True)
        try:
            supabase_client.table("game_messages").insert(
                {
                    "game_id": game_id,
                    "role": "system",
                    "profile_id": None,
                    "content": "The Dungeon Master encountered an error while resuming the adventure. The host can try resuming again.",
                }
            ).execute()
        except Exception:
            logger.error("[generate_resume_narration] Failed to insert error message")
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
    _messages = (  # noqa: F841
        supabase_client.table("game_messages")
        .select("*")
        .match({"game_id": game_id})
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )

    # TODO: Call Claude to summarize
    # Insert summary to a new table: campaign_summaries

    logger.info(f"[aggregation_task] Complete for game={game_id}")

