"""Level-up endpoint: POST /games/{game_id}/level-up."""

import logging
import math
import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from config import supabase_client
from api.dependencies import get_current_user
from utils.dnd import HIT_DICE_BY_CLASS, SPELL_SLOTS_BY_CLASS_LEVEL

logger = logging.getLogger(__name__)

router = APIRouter()

_PROFICIENCY_BONUS_BY_LEVEL: dict[int, int] = {
    1: 2, 2: 2, 3: 2, 4: 2,
    5: 3, 6: 3, 7: 3, 8: 3,
    9: 4, 10: 4, 11: 4, 12: 4,
    13: 5, 14: 5, 15: 5, 16: 5,
    17: 6, 18: 6, 19: 6, 20: 6,
}


class LevelUpRequest(BaseModel):
    character_id: str
    hp_choice: str  # "roll" | "average"


class LevelUpResponse(BaseModel):
    level: int
    hp_max: int
    hp_gained: int


@router.post("/{game_id}/level-up", response_model=LevelUpResponse)
async def level_up(
    game_id: str,
    body: LevelUpRequest,
    current_user: str = Depends(get_current_user),
):
    """Confirm a level-up: increment level, increase HP, update spell slots."""
    if body.hp_choice not in ("roll", "average"):
        raise HTTPException(status_code=422, detail="hp_choice must be 'roll' or 'average'")

    # Fetch character, verify ownership
    player_result = (
        supabase_client.table("players")
        .select("id, game_id, profile_id, character_class, level, hp_current, hp_max, stats")
        .eq("game_id", game_id)
        .eq("id", body.character_id)
        .maybe_single()
        .execute()
    )

    if not player_result.data:
        raise HTTPException(status_code=404, detail="Character not found in this game")

    player = player_result.data

    if player["profile_id"] != current_user:
        raise HTTPException(status_code=403, detail="You do not own this character")

    current_level = player["level"]
    new_level = current_level + 1
    character_class = player["character_class"]
    stats = player.get("stats") or {}
    con_score = stats.get("con", 10)
    con_mod = math.floor((con_score - 10) / 2)

    # Determine hit die sides for this class
    die_sides = HIT_DICE_BY_CLASS.get(character_class.lower(), 8)

    # Server-side HP roll (never trust client value)
    if body.hp_choice == "roll":
        roll = random.randint(1, die_sides)
    else:
        roll = math.ceil(die_sides / 2)

    hp_gained = max(1, roll + con_mod)
    new_hp_max = player["hp_max"] + hp_gained
    new_hp_current = player["hp_current"] + hp_gained

    # Update spell slots for new level
    new_spell_slots = None
    class_slots = SPELL_SLOTS_BY_CLASS_LEVEL.get(character_class.lower())
    if class_slots is not None:
        raw_slots = class_slots.get(min(new_level, 5), {})
        if raw_slots:
            new_spell_slots = {
                str(lvl): {"max": count, "used": 0}
                for lvl, count in raw_slots.items()
            }
        else:
            new_spell_slots = {}

    # Update proficiency bonus if level crossed a threshold
    new_prof = _PROFICIENCY_BONUS_BY_LEVEL.get(new_level, 2)
    stats["proficiency_bonus"] = new_prof

    if new_spell_slots is not None:
        stats["spell_slots"] = new_spell_slots

    supabase_client.table("players").update({
        "level": new_level,
        "hp_max": new_hp_max,
        "hp_current": new_hp_current,
        "stats": stats,
    }).eq("id", body.character_id).execute()

    logger.info(
        f"[level_up] {player['character_class']} {body.character_id} "
        f"levelled to {new_level}, hp_gained={hp_gained}"
    )

    return LevelUpResponse(level=new_level, hp_max=new_hp_max, hp_gained=hp_gained)
