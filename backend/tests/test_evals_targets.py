"""Tests for DMTarget implementations (DIN-68)."""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

# Guard: mock config clients before importing targets module
with patch("config.supabase_client", MagicMock()), \
     patch("config.anthropic_client", MagicMock()), \
     patch("config.openai_client", MagicMock()):
    from evals.targets import CurrentTarget, DMTarget
    from evals.schema import DMResponse


CANNED_NARRATION = (
    "You approach the lock. "
    "<state_changes>{\"hp_changes\": [{\"character_id\": \"player-1\", \"delta\": -5, \"reason\": \"trap\"}]}</state_changes>"
    "<event type=\"discovery\">Player found a hidden passage.</event>"
    "<suggested_actions>\nExplore the passage.\n</suggested_actions>"
)


def _make_mock_anthropic(text: str = CANNED_NARRATION):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=text)]
    mock_response.usage.input_tokens = 80
    mock_response.usage.output_tokens = 120
    mock_client.messages.create.return_value = mock_response
    return mock_client


def _make_mock_supabase():
    mock_sb = MagicMock()
    mock_game = MagicMock()
    mock_game.data = {
        "id": "game-1",
        "name": "Test Game",
        "dm_persona": "A testing DM.",
        "status": "active",
    }
    mock_players = MagicMock()
    mock_players.data = [
        {
            "id": "player-1",
            "game_id": "game-1",
            "profile_id": "profile-1",
            "character_name": "Thorin",
            "character_class": "Fighter",
            "race": "Dwarf",
            "level": 5,
            "hp_current": 30,
            "hp_max": 44,
            "stats": {"str": 16, "dex": 10, "con": 14, "int": 8, "wis": 12, "cha": 10},
        }
    ]
    mock_messages = MagicMock()
    mock_messages.data = []
    mock_inventory = MagicMock()
    mock_inventory.data = []

    def table_side_effect(name):
        mock_tbl = MagicMock()
        if name == "games":
            mock_tbl.select.return_value.match.return_value.single.return_value.execute.return_value = mock_game
        elif name == "players":
            mock_tbl.select.return_value.match.return_value.execute.return_value = mock_players
        elif name == "game_messages":
            mock_tbl.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_messages
        elif name == "player_inventory":
            mock_tbl.select.return_value.in_.return_value.execute.return_value = mock_inventory
        return mock_tbl

    mock_sb.table.side_effect = table_side_effect
    return mock_sb


class TestCurrentTarget:
    """Tests for CurrentTarget wrapping the production DM code path."""

    def test_implements_dm_target_protocol(self):
        """CurrentTarget implements DMTarget Protocol."""
        target = CurrentTarget(model="claude-sonnet-4-20250514")
        assert isinstance(target, DMTarget)

    @pytest.mark.skip(reason="Pending targets implementation — async respond")
    def test_respond_returns_dm_response(self):
        """respond() returns a DMResponse with narration, state_updates, metadata."""
        pass

    @pytest.mark.skip(reason="Pending targets implementation — async respond")
    def test_metadata_tokens_used_reflects_usage(self):
        """metadata.tokens_used = input_tokens + output_tokens from Claude response."""
        pass

    @pytest.mark.skip(reason="Pending targets implementation — async respond")
    def test_state_updates_parsed_from_response(self):
        """state_updates contains parsed hp_changes from a canned <state_changes> block."""
        pass

    @pytest.mark.skip(reason="Pending targets implementation — async respond")
    def test_narration_strips_structured_blocks(self):
        """narration field has all XML blocks stripped."""
        pass

    @pytest.mark.skip(reason="Pending targets implementation — async respond")
    def test_no_db_insert_called(self):
        """CurrentTarget.respond never calls supabase.table(...).insert(...)."""
        pass
