"""Tests for the events SSE route (DIN-66)."""

import json
from unittest.mock import MagicMock, patch, AsyncMock


def _messages_iter(messages: list[dict]):
    """Async iterator yielding a fixed sequence of pubsub messages."""

    class _Iter:
        def __init__(self, items):
            self._items = list(items)
            self._idx = 0

        def __aiter__(self):
            return self

        async def __anext__(self):
            if self._idx >= len(self._items):
                # Block indefinitely — real pubsub.listen() blocks forever;
                # we reach here only if the consumer didn't break on `done`.
                raise StopAsyncIteration
            item = self._items[self._idx]
            self._idx += 1
            return item

    return _Iter(messages)


def _build_pubsub_mock(messages: list[dict]) -> MagicMock:
    """Build a mock pubsub object matching redis.asyncio.client.PubSub's API."""
    pubsub = MagicMock()
    pubsub.subscribe = AsyncMock()
    pubsub.unsubscribe = AsyncMock()
    pubsub.aclose = AsyncMock()
    pubsub.listen = MagicMock(return_value=_messages_iter(messages))
    return pubsub


def _read_sse(body: bytes) -> list[dict]:
    """Parse SSE body into a list of event dicts."""
    text = body.decode() if isinstance(body, (bytes, bytearray)) else body
    events: list[dict] = []
    for frame in text.split("\n\n"):
        for line in frame.split("\n"):
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass
    return events


class TestEventsRoute:
    """Tests for GET /games/{gameId}/events."""

    def test_success_forwards_chunks_until_done(self, client):
        """Chunks from Redis pub/sub are proxied to the client as SSE."""
        pub_msgs = [
            {
                "type": "message",
                "data": json.dumps({"type": "chunk", "text": "Hello "}).encode(),
            },
            {
                "type": "message",
                "data": json.dumps({"type": "chunk", "text": "world."}).encode(),
            },
            {
                "type": "message",
                "data": json.dumps({"type": "done"}).encode(),
            },
        ]
        pubsub = _build_pubsub_mock(pub_msgs)

        with patch("api.routes.events.redis_async_client") as mock_redis:
            # `pubsub()` is sync on redis.asyncio clients — force MagicMock
            # (patch may auto-convert to AsyncMock for methods it infers).
            mock_redis.pubsub = MagicMock(return_value=pubsub)

            response = client.get("/games/game-1/events")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers.get("x-accel-buffering") == "no"

        events = _read_sse(response.content)
        assert {"type": "chunk", "text": "Hello "} in events
        assert {"type": "chunk", "text": "world."} in events
        assert events[-1] == {"type": "done"}

        # We subscribed + unsubscribed + closed cleanly.
        pubsub.subscribe.assert_awaited_once_with("stream:game-1")
        pubsub.unsubscribe.assert_awaited()
        pubsub.aclose.assert_awaited()

    def test_skips_non_message_types(self, client):
        """Non-message entries from pubsub.listen() are ignored."""
        pub_msgs = [
            {"type": "subscribe", "data": b""},
            {"type": "message", "data": json.dumps({"type": "chunk", "text": "ok"}).encode()},
            {"type": "message", "data": json.dumps({"type": "done"}).encode()},
        ]
        pubsub = _build_pubsub_mock(pub_msgs)

        with patch("api.routes.events.redis_async_client") as mock_redis:
            mock_redis.pubsub = MagicMock(return_value=pubsub)
            response = client.get("/games/game-1/events")

        events = _read_sse(response.content)
        assert len(events) == 2  # chunk + done, subscribe was skipped

    def test_block_events_forwarded(self, client):
        """block events (dice_rolls etc.) are forwarded unchanged."""
        pub_msgs = [
            {
                "type": "message",
                "data": json.dumps(
                    {
                        "type": "block",
                        "tag": "dice_rolls",
                        "attributes": {},
                        "content": '[{"die":"d20","result":15}]',
                    }
                ).encode(),
            },
            {"type": "message", "data": json.dumps({"type": "done"}).encode()},
        ]
        pubsub = _build_pubsub_mock(pub_msgs)

        with patch("api.routes.events.redis_async_client") as mock_redis:
            mock_redis.pubsub = MagicMock(return_value=pubsub)
            response = client.get("/games/game-1/events")

        events = _read_sse(response.content)
        blocks = [e for e in events if e["type"] == "block"]
        assert len(blocks) == 1
        assert blocks[0]["tag"] == "dice_rolls"

    def test_unauthorized_without_token(self, unauthed_client):
        """401 when no bearer token is present."""
        response = unauthed_client.get("/games/game-1/events")
        assert response.status_code == 401
