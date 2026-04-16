# backend/api/routes/events.py
"""
GET /games/{gameId}/events — SSE stream for DM responses (DIN-66).

Subscribes to the Redis pub/sub channel `stream:{gameId}` and forwards
messages to the browser as Server-Sent Events until a `{"type": "done"}`
message is received.

In DIN-66: one subscriber — the acting player's browser.
In DIN-67: N subscribers — all connected players. No backend changes
needed; Redis pub/sub handles the fan-out natively.
"""

import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from api.dependencies import get_current_user
from config import redis_async_client

logger = logging.getLogger(__name__)

router = APIRouter()


STREAM_CHANNEL_PREFIX = "stream"


@router.get("/{gameId}/events")
async def game_events_stream(
    gameId: str,
    current_user: str = Depends(get_current_user),
):
    """
    Open an SSE connection and forward pub/sub messages for this game.

    Closes automatically when a `done` event is received from the backend
    streaming coroutine (or when the client disconnects).
    """
    channel = f"{STREAM_CHANNEL_PREFIX}:{gameId}"

    async def _subscribe() -> AsyncGenerator[str, None]:
        pubsub = redis_async_client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                data = message["data"]
                text = data.decode() if isinstance(data, (bytes, bytearray)) else data
                yield f"data: {text}\n\n"
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    continue
                if payload.get("type") == "done":
                    break
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                logger.warning(
                    f"[events] pubsub.unsubscribe failed for {channel}",
                    exc_info=True,
                )
            try:
                await pubsub.aclose()
            except Exception:
                logger.warning(
                    f"[events] pubsub.aclose failed for {channel}",
                    exc_info=True,
                )

    return StreamingResponse(
        _subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
