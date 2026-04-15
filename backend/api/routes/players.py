"""Players endpoints: create and manage player characters."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from config import supabase_client
from api.dependencies import get_current_user
from utils.dnd import calculate_hp_max, CLASS_STARTING_INVENTORY, get_spell_slots
from constants import GAME_STATUS_LOBBY

logger = logging.getLogger(__name__)

router = APIRouter()

CHARACTER_CLASSES = [
    "Fighter",
    "Wizard",
    "Rogue",
    "Cleric",
    "Ranger",
    "Barbarian",
    "Paladin",
    "Druid",
    "Bard",
    "Monk",
    "Sorcerer",
    "Warlock",
]


class StatBlock(BaseModel):
    """D&D ability scores (1-20 each)."""

    str: int = Field(ge=1, le=20)
    dex: int = Field(ge=1, le=20)
    con: int = Field(ge=1, le=20)
    int_: int = Field(ge=1, le=20, alias="int")
    wis: int = Field(ge=1, le=20)
    cha: int = Field(ge=1, le=20)

    model_config = {"populate_by_name": True}


class UpsertPlayerRequest(BaseModel):
    """Request to create or update a player character."""

    character_name: str = Field(min_length=1, max_length=50)
    character_class: str
    race: str = "Human"
    level: int = Field(ge=1, le=20, default=1)
    stats: StatBlock

    @field_validator("character_class")
    @classmethod
    def validate_class(cls, v: str) -> str:
        if v not in CHARACTER_CLASSES:
            raise ValueError(f"Must be one of: {CHARACTER_CLASSES}")
        return v


class PlayerOut(BaseModel):
    """Player character response."""

    id: str
    game_id: str
    profile_id: str
    character_name: str
    character_class: str
    race: str
    level: int
    hp_current: int
    hp_max: int
    stats: dict
    status: str
    joined_at: str


@router.post("/{game_id}/players", response_model=PlayerOut, status_code=200)
async def upsert_player(
    game_id: str,
    body: UpsertPlayerRequest,
    current_user: str = Depends(get_current_user),
):
    """Create or update a player character in a game.

    Ensures only one character per user per game (via upsert conflict key).
    Only allows character creation in 'lobby' status to prevent game-in-progress modifications.
    Calculates level-1 HP using SRD 5e Hit Die + CON modifier.
    """
    game_result = (
        supabase_client.table("games")
        .select("id, status, created_by")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not game_result.data:
        raise HTTPException(status_code=404, detail="Game not found")

    game = game_result.data
    if game["status"] != GAME_STATUS_LOBBY:
        raise HTTPException(status_code=403, detail="Game is not in lobby")

    # For MVP, any authenticated user can create a character in a lobby game.
    # Invite validation happens at signup time (POST /api/auth/signup),
    # not at character creation time.

    hp_max = calculate_hp_max(body.character_class, body.stats.con)
    stats_dict = body.stats.model_dump(by_alias=True)

    raw_slots = get_spell_slots(body.character_class, body.level)
    if not raw_slots:
        # None for non-casters; {} for casters with no slots at this level (e.g. Paladin level 1)
        stats_dict["spell_slots"] = None
    else:
        stats_dict["spell_slots"] = {
            str(lvl): {"max": raw_slots.get(lvl, 0), "used": 0}
            for lvl in range(1, 4)
        }
    upsert_result = (
        supabase_client.table("players")
        .upsert(
            {
                "game_id": game_id,
                "profile_id": current_user,
                "character_name": body.character_name,
                "character_class": body.character_class,
                "race": body.race,
                "level": body.level,
                "stats": stats_dict,
                "hp_max": hp_max,
                "hp_current": hp_max,
            },
            on_conflict="game_id,profile_id",
        )
        .select(
            "id, game_id, profile_id, character_name, character_class, "
            "race, level, hp_current, hp_max, stats, status, joined_at"
        )
        .single()
        .execute()
    )

    if not upsert_result.data:
        raise HTTPException(status_code=500, detail="Failed to upsert player")

    # Populate starting inventory (best-effort — failure should not block the upsert)
    try:
        player_id = upsert_result.data["id"]
        # Delete any existing inventory for this player (handles class changes)
        supabase_client.table("player_inventory").delete().eq(
            "player_id", player_id
        ).execute()
        # Insert new starting inventory for the selected class
        starting_items = CLASS_STARTING_INVENTORY.get(body.character_class, [])
        if starting_items:
            rows = [
                {
                    "player_id": player_id,
                    "item_name": item["item_name"],
                    "quantity": item["quantity"],
                }
                for item in starting_items
            ]
            supabase_client.table("player_inventory").insert(rows).execute()
    except Exception as e:
        logger.warning(
            "Failed to populate inventory for player %s: %s",
            upsert_result.data.get("id"),
            e,
        )

    return upsert_result.data


@router.get("/{game_id}/players/inventory")
async def get_player_inventory(
    game_id: str,
    current_user: str = Depends(get_current_user),
):
    """Get inventory items for the current player in a game."""
    # Find the player for this user in this game
    player_result = (
        supabase_client.table("players")
        .select("id")
        .eq("game_id", game_id)
        .eq("profile_id", current_user)
        .maybe_single()
        .execute()
    )

    if not player_result.data:
        return []

    player_id = player_result.data["id"]

    # Fetch inventory items
    inventory_result = (
        supabase_client.table("player_inventory")
        .select("id, player_id, item_name, quantity, properties, created_at")
        .eq("player_id", player_id)
        .order("item_name")
        .execute()
    )

    return inventory_result.data or []
