"""
DM orchestration service — RAG search and action validation.
Embedding and Claude calls happen in the Dramatiq worker (dm_tasks.py).
This module handles synchronous pre-processing before enqueueing.
"""

import json
import logging
import math
import os
import random
import re
from typing import Any
import httpx
from config import supabase_client
from constants import GAME_STATUS_ACTIVE, PLAYER_STATUS_DEAD
from utils.dnd import XP_THRESHOLDS

logger = logging.getLogger(__name__)


def _ability_mod(score: int) -> str:
    """Format an ability score modifier with sign (e.g. +3 or -1)."""
    m = math.floor((score - 10) / 2)
    return f"{m:+d}"


def _proficiency_bonus(level: int) -> int:
    """D&D 5e proficiency bonus progression."""
    if level >= 17:
        return 6
    if level >= 13:
        return 5
    if level >= 9:
        return 4
    if level >= 5:
        return 3
    return 2


def _generate_dice_pool() -> dict[str, list[int]]:
    """
    Generate server-side random dice results for injection into the Claude prompt.

    Claude is instructed to consume these in order rather than inventing results.
    This ensures rolls follow the correct probability distribution for each die
    type — e.g. multi-die totals (4d6) follow a bell curve, not Claude's biased
    "plausible-looking" cluster around middle values.

    Pool sizes are generous enough to cover any realistic combat encounter:
    8 × d20 for checks/attacks/saves, plus 4–6 of each damage die.
    """
    return {
        "d20": [random.randint(1, 20) for _ in range(8)],
        "d12": [random.randint(1, 12) for _ in range(4)],
        "d10": [random.randint(1, 10) for _ in range(4)],
        "d8":  [random.randint(1, 8)  for _ in range(4)],
        "d6":  [random.randint(1, 6)  for _ in range(6)],
        "d4":  [random.randint(1, 4)  for _ in range(4)],
    }

def build_dm_system_prompt(
    game: dict,
    players: list[dict],
    inv_by_player: dict[str, list[dict]],
    recent_messages: list[dict],
    rag_context: list[dict],
    action_text: str,
) -> str:
    """
    Build the Claude system prompt for a player action (DIN-66).

    Shared by both the streaming /actions route and `dm_response_task`
    (non-streaming narration paths). Pure function — no I/O. `recent_messages`
    must be in newest-first order (matches the DB ordering); this function
    reverses it internally for chronological prompt inclusion.
    """
    message_history: list[str] = []
    for msg in reversed(recent_messages or []):
        if msg["role"] == "dm":
            message_history.append(f"DM: {msg['content']}")
        elif msg["role"] == "player":
            player_name = next(
                (
                    p["character_name"]
                    for p in players
                    if p.get("profile_id") == msg.get("profile_id")
                ),
                "Unknown Player",
            )
            message_history.append(f"{player_name}: {msg['content']}")

    message_history_text = (
        "\n\n".join(message_history) if message_history else "No messages yet."
    )

    party_lines: list[str] = []
    for p in players:
        inv = inv_by_player.get(p["id"], [])
        items = (
            ", ".join(
                (
                    f"{i['item_name']} (x{i['quantity']})"
                    if i["quantity"] > 1
                    else i["item_name"]
                )
                for i in inv
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
        prof_bonus = _proficiency_bonus(level)

        party_line = (
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

        spell_slots = stats.get("spell_slots")
        if spell_slots:
            _ordinals = {1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th"}
            slot_parts = []
            for lvl_key in sorted(
                (k for k in spell_slots.keys() if isinstance(k, str) and k.isdigit()),
                key=int,
            ):
                slot = spell_slots[lvl_key]
                lvl_int = int(lvl_key)
                if slot.get("max", 0) > 0:
                    remaining = slot["max"] - slot.get("used", 0)
                    ordinal = _ordinals.get(lvl_int, f"{lvl_int}th")
                    slot_parts.append(f"{ordinal}: {remaining}/{slot['max']}")
            if slot_parts:
                party_line += f"\n  Spell slots: {', '.join(slot_parts)}"

            cls_lower = p.get("character_class", "").lower()
            _caster_ability = {
                "wizard": int_score, "sorcerer": cha_score, "bard": cha_score,
                "cleric": wis_score, "druid": wis_score, "ranger": wis_score,
                "paladin": cha_score, "warlock": cha_score,
            }
            if cls_lower in _caster_ability:
                sp_ability = _caster_ability[cls_lower]
                sp_mod = math.floor((sp_ability - 10) / 2)
                spell_dc = 8 + prof_bonus + sp_mod
                spell_atk = prof_bonus + sp_mod
                party_line += f"\n  Spell save DC: {spell_dc} | Spell attack: {spell_atk:+d}"

        cantrips = stats.get("cantrips")
        if cantrips:
            party_line += f"\n  Cantrips (unlimited): {', '.join(cantrips)}"

        party_lines.append(party_line)

    # Generate a fresh random dice pool for this action.
    # Claude will consume values in order rather than inventing results.
    _pool = _generate_dice_pool()
    _dice_pool_text = "\n".join(
        f"  {die}: {chr(32).join(str(r) for r in results)}"
        for die, results in _pool.items()
    )

    return f"""You are {game['dm_persona']}. You are the Dungeon Master for a D&D 5e campaign called "{game['name']}".

CURRENT PARTY:
{chr(10).join(party_lines)}

RECENT SESSION HISTORY (last 20 messages, oldest first):
---
{message_history_text}
---

RELEVANT PAST EVENTS (Context from RAG):
{json.dumps(rag_context, indent=2) if rag_context else "No past events yet."}

PRE-ROLLED DICE POOL — use these values in order, never invent your own results:
{_dice_pool_text}

RULES:
1. Respond in character as the DM — never break the fourth wall
2. Be vivid and engaging. Keep your response to 100 words (highly preferred).
   One paragraph if the action is simple (highly preferred), two ONLY if the stakes are high.
3. Account for character abilities, equipment, and class features when narrating outcomes
4. When a player's action requires an ability check or saving throw: determine the relevant ability and apply proficiency if the character's class would grant it for this skill, pick an appropriate DC (Very Easy 5 / Easy 10 / Medium 15 / Hard 20), take the next d20 value from the DICE POOL above, and embed the full roll in a <dice_rolls> block (see Rule 10). Narrate the outcome consistent with the success value. Read ability scores from the party list above — do not guess or invent modifiers.
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
   take the next value from the appropriate column in the PRE-ROLLED DICE POOL above.
   NEVER invent your own result — always consume the next unused pool value in order.
   Embed the roll BEFORE your narrative text using this exact format:
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
       "dc": <integer, only for ability checks/saves>,
       "ac": <integer, only for attack rolls — use instead of dc>,
       "success": <true|false, required when dc or ac is present>,
       "advantage": <true|false, only when relevant>,
       "all_rolls": [<roll1>, <roll2>]
     }}
   ]
   </dice_rolls>
   Rules: result must match the value taken from the DICE POOL. Include one entry per distinct roll.
   For attack rolls use "ac" (not "dc"). For ability checks/saves use "dc" (not "ac").
11. COMBAT RULES:
   - When a player declares a combat action, adjudicate the exchange narratively:
     1. Roll player attack (d20 + STR/DEX mod + proficiency if proficient) vs target AC
     2. On a hit: roll damage dice per weapon type, add modifier
     3. Narrate enemy reaction and counterattack if applicable
     4. Embed ALL rolls in <dice_rolls> block (attack + damage + enemy rolls as separate entries)
     5. Emit <state_changes> with hp_changes for all HP deltas in the exchange
   - Use SRD 5e weapon damage for player characters based on their equipment list
   - Invent plausible NPC ACs by creature type: Goblin 13, Bandit 12, Orc 13, Guard 16
   - Critical Hit (natural 20): double the damage dice (e.g. 2d8 instead of 1d8),
     add modifier once, note it explicitly in narration
   - Critical Miss (natural 1): automatic miss, narrate the fumble
   - At 0 HP: narrate unconsciousness; prompt Death Saving Throw on next player action
   - Death Saving Throw: d20, no modifier, dc: 10, label: "Death Saving Throw"
12. XP AWARDS: When players defeat enemies or complete objectives, award XP via the
   xp_awards field in <state_changes>. Use SRD 5e encounter XP values as a guide.
   Award XP to all players present.
   Format: "xp_awards": [{{"character_id": "<ID>", "amount": 100, "reason": "Defeated goblin"}}]
   Typical values: Goblin 50 XP, Bandit 100 XP, Orc 100 XP, completing a minor quest 150–300 XP.

The acting player's action:
"{action_text}"
"""


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


_VALID_DICE = frozenset({"d4", "d6", "d8", "d10", "d12", "d20", "d100"})
_INT_FIELDS = ("count", "result", "modifier", "total")


def _validate_roll_entry(entry: Any) -> bool:
    """Return True if entry is a well-formed dice roll dict."""
    if not isinstance(entry, dict):
        return False
    if entry.get("die") not in _VALID_DICE:
        return False
    for field in _INT_FIELDS:
        if not isinstance(entry.get(field), int):
            return False
    if not isinstance(entry.get("label"), str):
        return False
    return True


def extract_dice_rolls(dm_response: str) -> list[dict]:
    """
    Parse all <dice_rolls>[...]</dice_rolls> blocks from Claude's DM response.
    Merges entries from multiple blocks, validates each entry, and drops
    malformed ones. Returns [] if no valid entries are found.
    Non-fatal: errors are logged as warnings.
    """
    raw_blocks = re.findall(r"<dice_rolls>(.*?)</dice_rolls>", dm_response, re.DOTALL)
    if not raw_blocks:
        return []
    if len(raw_blocks) > 1:
        logger.warning(
            "[extract_dice_rolls] Found %d dice_rolls blocks; merging all",
            len(raw_blocks),
        )
    merged: list[dict] = []
    for block in raw_blocks:
        try:
            parsed = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("[extract_dice_rolls] Failed to parse block: %s", exc)
            continue
        if not isinstance(parsed, list):
            logger.warning(
                "[extract_dice_rolls] dice_rolls block is not a JSON array; skipping"
            )
            continue
        for entry in parsed:
            if _validate_roll_entry(entry):
                merged.append(entry)
            else:
                logger.warning(
                    "[extract_dice_rolls] Dropping malformed roll entry: %s", entry
                )
    return merged


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


def extract_state_changes(dm_response: str) -> dict:
    """
    Parse the <state_changes>...</state_changes> JSON block from Claude's DM response.
    Returns the parsed dict, or {} if the block is absent or malformed (non-fatal).
    """
    pattern = r'<state_changes>(.*?)</state_changes>'
    match = re.search(pattern, dm_response, re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(1).strip())
    except (json.JSONDecodeError, ValueError):
        logger.warning("extract_state_changes: failed to parse JSON block")
        return {}
    if not isinstance(parsed, dict):
        logger.warning(
            "extract_state_changes: expected JSON object, got %s", type(parsed).__name__
        )
        return {}
    return parsed


def broadcast_level_up_available(game_id: str, character_id: str, new_level: int) -> None:
    """Broadcast level_up_available event to Supabase Realtime channel via REST API."""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_role_key:
        logger.warning("broadcast_level_up_available: missing SUPABASE_URL or key; skipping")
        return
    try:
        httpx.post(
            f"{supabase_url}/realtime/v1/api/broadcast",
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json",
            },
            json={
                "messages": [{
                    "topic": f"realtime:game:{game_id}",
                    "event": "level_up_available",
                    "payload": {
                        "type": "level_up_available",
                        "character_id": character_id,
                        "new_level": new_level,
                    },
                }]
            },
            timeout=5.0,
        )
    except Exception as e:
        logger.error(f"broadcast_level_up_available: failed for game={game_id}: {e}")


def apply_state_changes(state_changes: dict, game_id: str | None = None) -> None:
    """
    Apply mechanical state mutations from a <state_changes> block to the DB.
    All operations are best-effort — failures are logged but do NOT propagate.
    Uses service role client (bypasses RLS).
    """
    # HP changes
    for change in state_changes.get("hp_changes", []):
        try:
            character_id = change["character_id"]
            delta = int(change["delta"])
            player = (
                supabase_client.table("players")
                .select("hp_current, hp_max")
                .eq("id", character_id)
                .single()
                .execute()
            )
            hp_current = player.data["hp_current"]
            hp_max = player.data["hp_max"]
            new_hp = max(0, min(hp_max, hp_current + delta))
            supabase_client.table("players").update({"hp_current": new_hp}).eq(
                "id", character_id
            ).execute()
        except Exception as e:
            logger.error(f"apply_state_changes: hp_changes failed for {change}: {e}")

    # Inventory additions
    for item in state_changes.get("inventory_add", []):
        try:
            existing = (
                supabase_client.table("player_inventory")
                .select("id, quantity")
                .eq("player_id", item["character_id"])
                .eq("item_name", item["item_name"])
                .execute()
            )
            if existing.data:
                new_qty = existing.data[0]["quantity"] + item.get("quantity", 1)
                supabase_client.table("player_inventory").update(
                    {"quantity": new_qty}
                ).eq("id", existing.data[0]["id"]).execute()
            else:
                supabase_client.table("player_inventory").insert(
                    {
                        "player_id": item["character_id"],
                        "item_name": item["item_name"],
                        "quantity": item.get("quantity", 1),
                    }
                ).execute()
        except Exception as e:
            logger.error(f"apply_state_changes: inventory_add failed for {item}: {e}")

    # Spell slot usage
    for change in state_changes.get("spell_slot_use", []):
        try:
            character_id = change["character_id"]
            slot_level = str(change["slot_level"])
            player = (
                supabase_client.table("players")
                .select("stats")
                .eq("id", character_id)
                .single()
                .execute()
            )
            stats = player.data.get("stats") or {}
            spell_slots = stats.get("spell_slots") or {}
            slot = spell_slots.get(slot_level, {"max": 0, "used": 0})
            new_used = min(slot["used"] + 1, slot["max"])
            spell_slots[slot_level] = {**slot, "used": new_used}
            stats["spell_slots"] = spell_slots
            supabase_client.table("players").update({"stats": stats}).eq(
                "id", character_id
            ).execute()
        except Exception as e:
            logger.error(f"apply_state_changes: spell_slot_use failed for {change}: {e}")

    # Spell slot recharge (long rest)
    for change in state_changes.get("spell_slots_recharge", []):
        try:
            character_id = change["character_id"]
            player = (
                supabase_client.table("players")
                .select("stats")
                .eq("id", character_id)
                .single()
                .execute()
            )
            stats = player.data.get("stats") or {}
            spell_slots = stats.get("spell_slots") or {}
            recharged = {
                level: {**slot_data, "used": 0}
                for level, slot_data in spell_slots.items()
            }
            stats["spell_slots"] = recharged
            supabase_client.table("players").update({"stats": stats}).eq(
                "id", character_id
            ).execute()
        except Exception as e:
            logger.error(f"apply_state_changes: spell_slots_recharge failed for {change}: {e}")

    # XP awards (DIN-28)
    for award in state_changes.get("xp_awards", []):
        try:
            character_id = award["character_id"]
            amount = int(award["amount"])
            player = (
                supabase_client.table("players")
                .select("stats, level")
                .eq("id", character_id)
                .single()
                .execute()
            )
            stats = player.data.get("stats") or {}
            current_xp = stats.get("xp") or 0
            new_xp = current_xp + amount
            stats["xp"] = new_xp
            supabase_client.table("players").update({"stats": stats}).eq(
                "id", character_id
            ).execute()

            # Check level threshold
            current_level = player.data.get("level", 1)
            next_level = current_level + 1
            next_threshold = XP_THRESHOLDS.get(next_level)
            if next_threshold is not None and new_xp >= next_threshold and game_id:
                broadcast_level_up_available(game_id, character_id, next_level)
        except Exception as e:
            logger.error(f"apply_state_changes: xp_awards failed for {award}: {e}")

    # Inventory removals
    for item in state_changes.get("inventory_remove", []):
        try:
            existing = (
                supabase_client.table("player_inventory")
                .select("id, quantity")
                .eq("player_id", item["character_id"])
                .eq("item_name", item["item_name"])
                .execute()
            )
            if not existing.data:
                continue
            row = existing.data[0]
            new_qty = row["quantity"] - item.get("quantity", 1)
            if new_qty <= 0:
                supabase_client.table("player_inventory").delete().eq(
                    "id", row["id"]
                ).execute()
            else:
                supabase_client.table("player_inventory").update(
                    {"quantity": new_qty}
                ).eq("id", row["id"]).execute()
        except Exception as e:
            logger.error(
                f"apply_state_changes: inventory_remove failed for {item}: {e}"
            )

