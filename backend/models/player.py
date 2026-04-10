"""Player domain model."""

from pydantic import BaseModel
from typing import Any


class Player(BaseModel):
    """Represents a player in a D&D game."""

    id: str
    game_id: str
    profile_id: str
    character_name: str
    character_class: str
    race: str = "Human"
    level: int = 1
    hp_current: int
    hp_max: int
    stats: dict[str, Any]
    status: str
