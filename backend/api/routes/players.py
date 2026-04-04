"""Players endpoints: create and manage player characters."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from config import supabase_client
from api.dependencies import get_current_user
from utils.dnd import calculate_hp_max

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

    Validates that the game exists and is in lobby status.
    Calculates HP max based on class and CON modifier.
    Upserts the player row using (game_id, profile_id) as the conflict key.
    """
    # Fetch and validate game
    game_result = (
        supabase_client.table("games")
        .select("id, status")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not game_result.data:
        raise HTTPException(status_code=404, detail="Game not found")

    game = game_result.data
    if game["status"] != "lobby":
        raise HTTPException(status_code=403, detail="Game is not in lobby")

    # Calculate HP max
    hp_max = calculate_hp_max(body.character_class, body.stats.con)

    # Upsert player
    stats_dict = body.stats.model_dump(by_alias=True)
    upsert_result = (
        supabase_client.table("players")
        .upsert(
            {
                "game_id": game_id,
                "profile_id": current_user,
                "character_name": body.character_name,
                "character_class": body.character_class,
                "stats": stats_dict,
                "hp_max": hp_max,
                "hp_current": hp_max,
            },
            on_conflict="game_id,profile_id",
        )
        .select("*")
        .single()
        .execute()
    )

    if not upsert_result.data:
        raise HTTPException(status_code=500, detail="Failed to upsert player")

    return upsert_result.data
