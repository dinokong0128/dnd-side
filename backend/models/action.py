"""Action input/output models."""
from pydantic import BaseModel


class ActionInput(BaseModel):
    """Player action submitted to the DM."""
    player_id: str
    action_text: str
    action_type: str = "general"


class ActionResponse(BaseModel):
    """Immediate response confirming action was queued."""
    action_id: str
    game_id: str
    status: str = "queued"
    message: str = "Action received, processing DM response..."
