"""Games endpoints: create, list, and retrieve games."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from config import supabase_client
from api.dependencies import get_current_user

router = APIRouter()


class CreateGameInput(BaseModel):
    """Input for creating a new game."""
    name: str
    dm_persona: str = "A classic high-fantasy D&D adventure."


class GameOut(BaseModel):
    """Game response model."""
    id: str
    name: str
    dm_persona: str
    status: str
    created_by: str
    created_at: str


@router.post("/", response_model=GameOut, status_code=201)
async def create_game(
    payload: CreateGameInput,
    current_user: str = Depends(get_current_user),
):
    """Create a new game owned by the authenticated user."""
    result = (
        supabase_client.table("games")
        .insert({"name": payload.name, "dm_persona": payload.dm_persona, "created_by": current_user})
        .select("id, name, dm_persona, status, created_by, created_at")
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create game")
    return result.data


@router.get("/", response_model=list[GameOut])
async def list_games(current_user: str = Depends(get_current_user)):
    """List all games created by the authenticated user."""
    result = (
        supabase_client.table("games")
        .select("id, name, dm_persona, status, created_by, created_at")
        .eq("created_by", current_user)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/{game_id}", response_model=GameOut)
async def get_game(game_id: str, current_user: str = Depends(get_current_user)):
    """Retrieve a single game by ID."""
    result = (
        supabase_client.table("games")
        .select("id, name, dm_persona, status, created_by, created_at")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Game not found")
    return result.data
