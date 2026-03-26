"""Game domain model."""
from pydantic import BaseModel
from typing import Optional


class Game(BaseModel):
    """Represents a D&D game session."""
    id: str
    name: str
    dm_persona: str
    status: str
    created_at: str
