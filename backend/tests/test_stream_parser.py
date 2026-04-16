"""Tests for backend.services.stream_parser.StreamParser (DIN-66)."""

from services.stream_parser import StreamParser, KNOWN_TAGS


def _feed_all(parser: StreamParser, chunks: list[str]) -> list[dict]:
    """Feed a sequence of chunks and also flush at the end, returning all events."""
    events: list[dict] = []
    for c in chunks:
        events.extend(parser.feed(c))
    events.extend(parser.flush())
    return events


class TestPlainText:
    def test_single_chunk_plain_text(self):
        parser = StreamParser()
        events = _feed_all(parser, ["The goblin lunges forward with a snarl."])
        assert events == [
            {"type": "chunk", "text": "The goblin lunges forward with a snarl."}
        ]

    def test_multiple_chunks_concatenate_text(self):
        parser = StreamParser()
        events = _feed_all(parser, ["The goblin ", "lunges forward ", "with a snarl."])
        combined = "".join(e["text"] for e in events if e["type"] == "chunk")
        assert combined == "The goblin lunges forward with a snarl."

    def test_empty_chunk_is_noop(self):
        parser = StreamParser()
        assert parser.feed("") == []
        assert parser.flush() == []


class TestDiceRollsBlock:
    def test_complete_dice_rolls_block_in_one_chunk(self):
        parser = StreamParser()
        raw = (
            'Rolling for stealth... <dice_rolls>[{"die":"d20","result":15}]</dice_rolls>'
            " You sneak past."
        )
        events = _feed_all(parser, [raw])
        block = next(e for e in events if e["type"] == "block")
        assert block["tag"] == "dice_rolls"
        assert block["content"] == '[{"die":"d20","result":15}]'
        chunks = "".join(e["text"] for e in events if e["type"] == "chunk")
        assert "Rolling for stealth... " in chunks
        assert " You sneak past." in chunks
        # Raw XML never appears in narrative chunks.
        assert "<dice_rolls>" not in chunks
        assert "</dice_rolls>" not in chunks

    def test_dice_rolls_block_split_across_chunks(self):
        parser = StreamParser()
        chunks = [
            "Rolling for stealth...",
            " <dice_",
            'rolls>[{"die":"d20","result":',
            '15}]</dice_',
            "rolls> You sneak past.",
        ]
        events = _feed_all(parser, chunks)
        blocks = [e for e in events if e["type"] == "block"]
        assert len(blocks) == 1
        assert blocks[0]["tag"] == "dice_rolls"
        assert "15" in blocks[0]["content"]


class TestEventBlock:
    def test_event_block_with_attributes(self):
        parser = StreamParser()
        raw = '<event type="combat">The goblin falls.</event>'
        events = _feed_all(parser, [raw])
        blocks = [e for e in events if e["type"] == "block"]
        assert len(blocks) == 1
        assert blocks[0]["tag"] == "event"
        assert blocks[0]["attributes"] == {"type": "combat"}
        assert blocks[0]["content"] == "The goblin falls."

    def test_event_block_mixed_with_text(self):
        parser = StreamParser()
        raw = 'Before. <event type="discovery">Found a key</event> After.'
        events = _feed_all(parser, [raw])
        chunks = "".join(e.get("text", "") for e in events if e["type"] == "chunk")
        blocks = [e for e in events if e["type"] == "block"]
        assert "Before. " in chunks
        assert " After." in chunks
        assert len(blocks) == 1
        assert blocks[0]["attributes"] == {"type": "discovery"}


class TestSuggestedActionsBlock:
    def test_suggested_actions_plain(self):
        parser = StreamParser()
        raw = (
            "The path forks.\n<suggested_actions>\nGo left.\nGo right.\n"
            "</suggested_actions>"
        )
        events = _feed_all(parser, [raw])
        blocks = [e for e in events if e["type"] == "block"]
        assert len(blocks) == 1
        assert blocks[0]["tag"] == "suggested_actions"
        assert "Go left." in blocks[0]["content"]
        assert "Go right." in blocks[0]["content"]


class TestStateChangesBlock:
    def test_state_changes_block(self):
        parser = StreamParser()
        raw = '<state_changes>{"hp_changes":[{"character_id":"x","delta":-8}]}</state_changes>'
        events = _feed_all(parser, [raw])
        blocks = [e for e in events if e["type"] == "block"]
        assert len(blocks) == 1
        assert blocks[0]["tag"] == "state_changes"
        assert "hp_changes" in blocks[0]["content"]


class TestUnknownTagsPassThrough:
    def test_unknown_tags_are_treated_as_text(self):
        """A tag name not in KNOWN_TAGS should stay as narrative text."""
        parser = StreamParser()
        raw = "Hello <p>World</p>"
        events = _feed_all(parser, [raw])
        blocks = [e for e in events if e["type"] == "block"]
        chunks = "".join(e["text"] for e in events if e["type"] == "chunk")
        assert blocks == []
        assert "<p>World</p>" in chunks


class TestLookahead:
    def test_plain_text_held_back_for_lookahead(self):
        """A partial '<' at the tail of a chunk must be held back."""
        parser = StreamParser()
        parser.feed("The world churns. <")
        events_2 = parser.feed("dice_rolls>[]</dice_rolls> Continue.")
        events_3 = parser.flush()
        all_events = events_2 + events_3

        blocks = [e for e in all_events if e["type"] == "block"]
        assert len(blocks) == 1
        assert blocks[0]["tag"] == "dice_rolls"
        assert blocks[0]["content"] == "[]"

    def test_long_text_emits_progressively(self):
        """A long no-tag chunk should emit everything except the lookahead."""
        parser = StreamParser()
        big = "A" * 300
        events = parser.feed(big)
        emitted = "".join(e["text"] for e in events if e["type"] == "chunk")
        assert len(emitted) >= 300 - 60


class TestFlushBehavior:
    def test_flush_drops_incomplete_tag(self):
        parser = StreamParser()
        parser.feed('<dice_rolls>[{"die":"d20"')
        events = parser.flush()
        assert all(e["type"] != "block" for e in events)
        for e in events:
            if e["type"] == "chunk":
                assert "<dice_rolls>" not in e["text"]

    def test_flush_emits_trailing_plain_text(self):
        parser = StreamParser()
        parser.feed("Small tail.")
        events = parser.flush()
        assert events == [{"type": "chunk", "text": "Small tail."}]


class TestKnownTags:
    def test_known_tags_set(self):
        assert KNOWN_TAGS == {
            "event",
            "suggested_actions",
            "state_changes",
            "dice_rolls",
        }
