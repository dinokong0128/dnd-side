"""Invite endpoints: generate invite codes for games."""

import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from config import settings, supabase_client
from api.dependencies import get_current_user

router = APIRouter()


class InviteOut(BaseModel):
    """Invite response model."""

    code: str
    invite_url: str


@router.post("/{game_id}/invites", response_model=InviteOut, status_code=201)
async def create_invite(
    game_id: str,
    current_user: str = Depends(get_current_user),
):
    """Generate an invite code for a game. Only the game creator can do this."""
    # Verify game exists and user is the creator
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
    if game["created_by"] != current_user:
        raise HTTPException(
            status_code=403, detail="Only the game creator can generate invites"
        )

    if game["status"] != "lobby":
        raise HTTPException(
            status_code=403, detail="Can only invite players when game is in lobby"
        )

    # Generate a URL-safe random code
    code = secrets.token_urlsafe(16)

    # Insert invite row (service role bypasses RLS)
    insert_result = (
        supabase_client.table("invites")
        .insert({"code": code, "game_id": game_id})
        .execute()
    )
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Failed to create invite")

    # Build the invite URL
    # Use FRONTEND_URL env var, fall back to localhost for dev
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    invite_url = f"{frontend_url}/auth/signup?code={code}"

    return {"code": code, "invite_url": invite_url}
