"""Tests for the DM orchestration service."""
import pytest
from unittest.mock import MagicMock, patch

# Mock config.supabase_client before importing dm_service to avoid
# real Supabase client initialization during test collection.
with patch("config.supabase_client", MagicMock()):
    from services.dm_service import validate_action, search_rag, extract_events_from_response


class TestValidateAction:
    """Tests for validate_action()."""

    def _make_action(self, text: str = "I attack the dragon!"):
        """Helper to create a mock action object."""
        action = MagicMock()
        action.action_text = text
        return action

    def test_valid_action_passes(self):
        """Should not raise for a valid action."""
        action = self._make_action("I swing my sword!")
        player = {"status": "alive"}
        game = {"status": "active"}
        validate_action(action, player, game)  # Should not raise

    def test_empty_action_text_raises(self):
        """Should raise ValueError for empty action text."""
        action = self._make_action("")
        player = {"status": "alive"}
        game = {"status": "active"}
        with pytest.raises(ValueError, match="cannot be empty"):
            validate_action(action, player, game)

    def test_whitespace_only_action_raises(self):
        """Should raise ValueError for whitespace-only action text."""
        action = self._make_action("   ")
        player = {"status": "alive"}
        game = {"status": "active"}
        with pytest.raises(ValueError, match="cannot be empty"):
            validate_action(action, player, game)

    def test_action_text_exceeds_limit_raises(self):
        """Should raise ValueError when action text exceeds 2000 characters."""
        action = self._make_action("x" * 2001)
        player = {"status": "alive"}
        game = {"status": "active"}
        with pytest.raises(ValueError, match="exceeds 2000 character limit"):
            validate_action(action, player, game)

    def test_action_text_at_limit_passes(self):
        """Should not raise when action text is exactly 2000 characters."""
        action = self._make_action("x" * 2000)
        player = {"status": "alive"}
        game = {"status": "active"}
        validate_action(action, player, game)  # Should not raise

    def test_inactive_game_raises(self):
        """Should raise ValueError when game is not active or lobby."""
        action = self._make_action("I attack!")
        player = {"status": "alive"}
        game = {"status": "ended"}
        with pytest.raises(ValueError, match="not active"):
            validate_action(action, player, game)

    def test_lobby_game_raises(self):
        """Should raise ValueError when game is in lobby status."""
        action = self._make_action("I prepare.")
        player = {"status": "alive"}
        game = {"status": "lobby"}
        with pytest.raises(ValueError, match="not active"):
            validate_action(action, player, game)

    def test_dead_player_raises(self):
        """Should raise ValueError when player is dead."""
        action = self._make_action("I attack!")
        player = {"status": "dead"}
        game = {"status": "active"}
        with pytest.raises(ValueError, match="Dead players cannot take actions"):
            validate_action(action, player, game)

    def test_alive_player_passes(self):
        """Should not raise when player status is alive."""
        action = self._make_action("I cast a spell!")
        player = {"status": "alive"}
        game = {"status": "active"}
        validate_action(action, player, game)  # Should not raise


class TestExtractEventsFromResponse:
    """Tests for extract_events_from_response()."""

    def test_single_event(self):
        """Should parse a single event."""
        text = 'The dragon roars. <event type="combat">Dragon attacks the party</event> The cave shakes.'
        events = extract_events_from_response(text)
        assert len(events) == 1
        assert events[0]["type"] == "combat"
        assert events[0]["description"] == "Dragon attacks the party"

    def test_multiple_events(self):
        """Should parse multiple events."""
        text = (
            '<event type="combat">Thorin strikes the goblin</event> '
            'The treasure glows. '
            '<event type="discovery">Party finds the Amulet of Power</event>'
        )
        events = extract_events_from_response(text)
        assert len(events) == 2
        assert events[0]["type"] == "combat"
        assert events[1]["type"] == "discovery"

    def test_no_events(self):
        """Should return empty list when no events are present."""
        text = "The DM describes a peaceful meadow. Nothing eventful happens."
        events = extract_events_from_response(text)
        assert events == []

    def test_event_with_single_quotes(self):
        """Should parse events using single quotes."""
        text = "<event type='milestone'>Party reaches level 5</event>"
        events = extract_events_from_response(text)
        assert len(events) == 1
        assert events[0]["type"] == "milestone"
        assert events[0]["description"] == "Party reaches level 5"

    def test_event_with_multiline_content(self):
        """Should parse events with multiline descriptions."""
        text = '<event type="dialogue">The king speaks:\nYou are brave adventurers.</event>'
        events = extract_events_from_response(text)
        assert len(events) == 1
        assert "king speaks" in events[0]["description"]

    def test_event_description_is_stripped(self):
        """Should strip whitespace from event descriptions."""
        text = '<event type="combat">  Sword clashes ring out  </event>'
        events = extract_events_from_response(text)
        assert events[0]["description"] == "Sword clashes ring out"

    def test_event_type_is_stripped(self):
        """Should strip whitespace from event types."""
        text = '<event type=" combat ">Battle begins</event>'
        events = extract_events_from_response(text)
        assert events[0]["type"] == "combat"

    def test_all_event_types(self):
        """Should handle all expected event types."""
        types = ["combat", "discovery", "dialogue", "death", "milestone"]
        for event_type in types:
            text = f'<event type="{event_type}">Something happened</event>'
            events = extract_events_from_response(text)
            assert len(events) == 1
            assert events[0]["type"] == event_type


class TestSearchRag:
    """Tests for search_rag()."""

    @patch("services.dm_service.supabase_client")
    def test_search_rag_calls_rpc(self, mock_sb):
        """Should call the match_game_events RPC with correct params."""
        mock_sb.rpc.return_value.execute.return_value = MagicMock(data=[
            {"id": "evt-1", "event_type": "combat", "summary": "Fight", "similarity": 0.9},
        ])

        embedding = [0.1] * 1536
        results = search_rag("game-uuid-1", embedding, top_k=3)

        mock_sb.rpc.assert_called_once_with(
            "match_game_events",
            {"p_game_id": "game-uuid-1", "p_embedding": embedding, "p_top_k": 3},
        )
        assert len(results) == 1
        assert results[0]["event_type"] == "combat"

    @patch("services.dm_service.supabase_client")
    def test_search_rag_returns_empty_on_none(self, mock_sb):
        """Should return empty list when RPC returns None data."""
        mock_sb.rpc.return_value.execute.return_value = MagicMock(data=None)

        results = search_rag("game-uuid-1", [0.1] * 1536)
        assert results == []

    @patch("services.dm_service.supabase_client")
    def test_search_rag_default_top_k(self, mock_sb):
        """Should default to top_k=5."""
        mock_sb.rpc.return_value.execute.return_value = MagicMock(data=[])

        search_rag("game-uuid-1", [0.1] * 1536)

        call_args = mock_sb.rpc.call_args
        assert call_args[0][1]["p_top_k"] == 5

    @patch("services.dm_service.supabase_client")
    def test_search_rag_returns_multiple_results(self, mock_sb):
        """Should return multiple matching events."""
        mock_sb.rpc.return_value.execute.return_value = MagicMock(data=[
            {"id": "evt-1", "event_type": "combat", "summary": "Fight 1", "similarity": 0.95},
            {"id": "evt-2", "event_type": "discovery", "summary": "Found item", "similarity": 0.85},
            {"id": "evt-3", "event_type": "dialogue", "summary": "NPC talk", "similarity": 0.75},
        ])

        results = search_rag("game-uuid-1", [0.1] * 1536, top_k=3)
        assert len(results) == 3
