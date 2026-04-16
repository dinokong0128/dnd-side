# backend/services/stream_parser.py
"""
Streaming XML-tag parser for Claude DM responses (DIN-66).

Claude emits narrative text interleaved with structured XML tags:
    <event type="...">...</event>
    <suggested_actions>...</suggested_actions>
    <state_changes>...</state_changes>
    <dice_rolls>...</dice_rolls>

This parser wraps the token stream and emits SSE-ready dicts:
    {"type": "chunk", "text": "..."}                           — plain narrative text
    {"type": "block", "tag": "...", "attributes": {...},
                      "content": "..."}                         — complete tag pair

Plain text is held back by a ~60-char lookahead window so a tag whose leading
`<` arrived in one chunk and whose name arrived in the next still resolves
correctly. Incomplete tags at end-of-stream are discarded (never leaked as
raw XML to the client).
"""

from __future__ import annotations

import re
from typing import Any


KNOWN_TAGS: frozenset[str] = frozenset(
    {"event", "suggested_actions", "state_changes", "dice_rolls"}
)

# Characters held back in the buffer before emitting a chunk event. Must exceed
# the longest known tag name + angle bracket + some attribute room. 60 ≈ 15
# typical Claude tokens — small enough to feel live.
_LOOKAHEAD = 60

_TAG_PATTERN = re.compile(
    r"<(" + "|".join(sorted(KNOWN_TAGS, key=len, reverse=True)) + r")[\s>]"
)

_ATTR_RE = re.compile(r"""(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')""")


class StreamParser:
    """Stateful parser that consumes Claude's text stream chunk-by-chunk."""

    def __init__(self) -> None:
        self.buffer: str = ""

    def feed(self, chunk: str) -> list[dict[str, Any]]:
        """Feed one raw text chunk from Claude; return list of SSE event dicts."""
        self.buffer += chunk
        events: list[dict[str, Any]] = []

        while True:
            m = _TAG_PATTERN.search(self.buffer)

            if m is None:
                # No known tag opening — emit everything except the lookahead.
                safe = max(0, len(self.buffer) - _LOOKAHEAD)
                if safe > 0:
                    events.append({"type": "chunk", "text": self.buffer[:safe]})
                    self.buffer = self.buffer[safe:]
                break

            # Flush any plain text before the tag.
            if m.start() > 0:
                events.append({"type": "chunk", "text": self.buffer[: m.start()]})
                self.buffer = self.buffer[m.start() :]

            result = self._extract_block(self.buffer)
            if result is None:
                # Tag is incomplete — wait for more data. The partial tag
                # stays in the buffer and will be retried on the next feed().
                break

            events.append(result["event"])
            self.buffer = self.buffer[result["consumed"] :]

        return events

    def flush(self) -> list[dict[str, Any]]:
        """
        Call once the upstream stream ends. Emits remaining plain text and
        drops any incomplete tag fragment (never leaked as raw XML).
        """
        events: list[dict[str, Any]] = []
        remaining = self.buffer
        self.buffer = ""

        if not remaining:
            return events

        stripped = remaining.lstrip()
        # If remaining content starts with a `<`, assume it's an incomplete
        # tag fragment and discard it — it's not narration-safe.
        if stripped and not stripped.startswith("<"):
            events.append({"type": "chunk", "text": remaining})
        return events

    # ---- internals ---------------------------------------------------- #

    def _extract_block(self, text: str) -> dict[str, Any] | None:
        """
        Try to parse a complete `<tag [attrs]>content</tag>` at the start of
        `text`. Returns {"event": {...}, "consumed": int} or None if the
        block is incomplete.
        """
        tag_names = "|".join(re.escape(t) for t in KNOWN_TAGS)
        open_re = re.compile(rf"^<({tag_names})((?:\s[^>]*)?)>")
        open_m = open_re.match(text)
        if not open_m:
            return None

        tag_name = open_m.group(1)
        attrs_str = open_m.group(2).strip()

        close_re = re.compile(rf"</{re.escape(tag_name)}>")
        close_m = close_re.search(text, open_m.end())
        if not close_m:
            return None

        content = text[open_m.end() : close_m.start()]
        consumed = close_m.end()

        attributes: dict[str, str] = {}
        for attr_m in _ATTR_RE.finditer(attrs_str):
            name = attr_m.group(1)
            value = (
                attr_m.group(2) if attr_m.group(2) is not None else attr_m.group(3)
            )
            attributes[name] = value

        return {
            "event": {
                "type": "block",
                "tag": tag_name,
                "attributes": attributes,
                "content": content,
            },
            "consumed": consumed,
        }
