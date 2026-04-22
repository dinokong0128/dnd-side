"""Action input/output models."""

from pydantic import BaseModel


class ActionInput(BaseModel):
    """Player action submitted to the DM."""

    action_text: str
    client_id: str | None = None


class ActionResponse(BaseModel):
    """Immediate response confirming action was queued."""

    message_id: str
    game_id: str
    status: str = "queued"
