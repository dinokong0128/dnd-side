"""Message domain model."""

from pydantic import BaseModel
from typing import Optional


class Message(BaseModel):
    """Represents a message in a game's chat log."""

    id: str
    game_id: str
    role: str
    profile_id: Optional[str]
    content: str
    created_at: str
