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
    updated_at: str


@router.post("/", response_model=GameOut, status_code=201)
async def create_game(
    payload: CreateGameInput,
    current_user: str = Depends(get_current_user),
):
    """Create a new game owned by the authenticated user."""
    result = (
        supabase_client.table("games")
        .insert({"name": payload.name, "dm_persona": payload.dm_persona, "created_by": current_user})
        .select("id, name, dm_persona, status, created_by, created_at, updated_at")
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
        .select("id, name, dm_persona, status, created_by, created_at, updated_at")
        .eq("created_by", current_user)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/{game_id}", response_model=GameOut)
async def get_game(game_id: str, current_user: str = Depends(get_current_user)):
    """Retrieve a single game by ID."""
    result = (
        supabase_client.table("games")
        .select("id, name, dm_persona, status, created_by, created_at, updated_at")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Game not found")
    return result.data


@router.post("/{game_id}/start", response_model=dict)
async def start_game(
    game_id: str,
    current_user: str = Depends(get_current_user),
):
    """Start a game session — transitions lobby → active and enqueues opening narration."""
    # 1. Fetch game
    game = (
        supabase_client.table("games")
        .select("id, status, created_by")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not game.data:
        raise HTTPException(status_code=404, detail="Game not found")

    # 2. Validate caller is host
    if game.data["created_by"] != current_user:
        raise HTTPException(status_code=403, detail="Only the host can start the game")

    # 3. Validate status — if already active with no messages, allow re-enqueue (narration may have failed)
    if game.data["status"] == "active":
        existing_messages = (
            supabase_client.table("game_messages")
            .select("id")
            .eq("game_id", game_id)
            .limit(1)
            .execute()
        )
        if existing_messages.data:
            raise HTTPException(status_code=409, detail="Game is already active")
        # No messages yet — opening narration never delivered, re-enqueue
        from tasks.dm_tasks import generate_opening_narration
        generate_opening_narration.send(game_id)
        return {"status": "active"}
    elif game.data["status"] != "lobby":
        raise HTTPException(status_code=409, detail=f"Game is not in lobby status (current: {game.data['status']})")

    # 4. Validate at least one player with a character
    players = (
        supabase_client.table("players")
        .select("id, character_name")
        .eq("game_id", game_id)
        .execute()
    )
    players_with_characters = [p for p in (players.data or []) if p.get("character_name")]
    if not players_with_characters:
        raise HTTPException(status_code=400, detail="At least one player must have a character before starting")

    # 5. Update status
    supabase_client.table("games").update({
        "status": "active",
    }).eq("id", game_id).execute()

    # 6. Enqueue opening narration
    from tasks.dm_tasks import generate_opening_narration
    generate_opening_narration.send(game_id)

    return {"status": "active"}


@router.post("/{game_id}/pause", response_model=dict)
async def pause_game(
    game_id: str,
    current_user: str = Depends(get_current_user),
):
    """Pause an active game session."""
    game = (
        supabase_client.table("games")
        .select("id, status, created_by")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not game.data:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.data["created_by"] != current_user:
        raise HTTPException(status_code=403, detail="Only the host can pause the game")
    if game.data["status"] != "active":
        raise HTTPException(status_code=409, detail=f"Can only pause an active game (current: {game.data['status']})")

    supabase_client.table("games").update({
        "status": "paused",
    }).eq("id", game_id).execute()

    # Best-effort DM message — status change is already committed
    from tasks.dm_tasks import generate_pause_message
    generate_pause_message.send(game_id)

    return {"status": "paused"}


@router.post("/{game_id}/end", response_model=dict)
async def end_game(
    game_id: str,
    current_user: str = Depends(get_current_user),
):
    """Permanently end a game session."""
    game = (
        supabase_client.table("games")
        .select("id, status, created_by")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not game.data:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.data["created_by"] != current_user:
        raise HTTPException(status_code=403, detail="Only the host can end the game")
    if game.data["status"] not in ("active", "paused"):
        raise HTTPException(status_code=409, detail=f"Can only end an active or paused game (current: {game.data['status']})")

    supabase_client.table("games").update({
        "status": "ended",
    }).eq("id", game_id).execute()

    # Best-effort DM message
    from tasks.dm_tasks import generate_end_message
    generate_end_message.send(game_id)

    return {"status": "ended"}


@router.post("/{game_id}/resume", response_model=dict)
async def resume_game(
    game_id: str,
    current_user: str = Depends(get_current_user),
):
    """Resume a paused game session."""
    game = (
        supabase_client.table("games")
        .select("id, status, created_by")
        .eq("id", game_id)
        .maybe_single()
        .execute()
    )
    if not game.data:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.data["created_by"] != current_user:
        raise HTTPException(status_code=403, detail="Only the host can resume the game")
    if game.data["status"] != "paused":
        raise HTTPException(status_code=409, detail=f"Can only resume a paused game (current: {game.data['status']})")

    supabase_client.table("games").update({
        "status": "active",
    }).eq("id", game_id).execute()

    from tasks.dm_tasks import generate_resume_narration
    generate_resume_narration.send(game_id)

    return {"status": "active"}
