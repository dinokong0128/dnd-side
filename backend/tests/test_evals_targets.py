"""Tests for DMTarget implementations (DIN-68)."""

import pytest
from unittest.mock import MagicMock, patch

with patch("config.supabase_client", MagicMock()), \
     patch("config.anthropic_client", MagicMock()), \
     patch("config.openai_client", MagicMock()):
    from evals.targets import CurrentTarget, DMTarget, _strip_structured_blocks
    from evals.schema import DMResponse


CANNED_NARRATION = (
    "You approach the lock carefully."
    "<state_changes>{\"hp_changes\": [{\"character_id\": \"player-1\", \"delta\": -5, \"reason\": \"trap\"}]}</state_changes>"
    "<event type=\"discovery\">Player found a hidden passage.</event>"
    "<dice_rolls>[{\"type\":\"dice_roll\",\"die\":\"d20\",\"count\":1,\"result\":14,\"modifier\":3,\"total\":17,\"label\":\"Perception\"}]</dice_rolls>"
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
            chain = mock_tbl.select.return_value.eq.return_value.order.return_value.limit.return_value
            chain.execute.return_value = mock_messages
        elif name == "player_inventory":
            mock_tbl.select.return_value.in_.return_value.execute.return_value = mock_inventory
        return mock_tbl

    mock_sb.table.side_effect = table_side_effect

    mock_rpc = MagicMock()
    mock_rpc.execute.return_value.data = []
    mock_sb.rpc.return_value = mock_rpc

    return mock_sb


class TestStripStructuredBlocks:
    """Tests for the _strip_structured_blocks helper."""

    def test_strips_state_changes(self):
        raw = "Narration text.<state_changes>{}</state_changes>More text."
        result = _strip_structured_blocks(raw)
        assert "<state_changes>" not in result
        assert "Narration text." in result

    def test_strips_dice_rolls(self):
        raw = "Text.<dice_rolls>[...]</dice_rolls>End."
        result = _strip_structured_blocks(raw)
        assert "<dice_rolls>" not in result

    def test_strips_suggested_actions(self):
        raw = "Text.<suggested_actions>\nDo something.\n</suggested_actions>"
        result = _strip_structured_blocks(raw)
        assert "<suggested_actions>" not in result

    def test_keeps_event_inner_text(self):
        raw = '<event type="combat">Big fight happened.</event>'
        result = _strip_structured_blocks(raw)
        assert "<event" not in result
        assert "Big fight happened." in result


class TestCurrentTarget:
    """Tests for CurrentTarget wrapping the production DM code path."""

    def test_implements_dm_target_protocol(self):
        """CurrentTarget implements DMTarget Protocol."""
        target = CurrentTarget(model="claude-sonnet-4-20250514")
        assert isinstance(target, DMTarget)

    def test_name_is_current(self):
        assert CurrentTarget.name == "current"

    async def test_respond_returns_dm_response(self):
        """respond() returns a DMResponse with narration, state_updates, metadata."""
        mock_anthropic = _make_mock_anthropic()
        mock_sb = _make_mock_supabase()

        with patch("evals.targets.anthropic_client", mock_anthropic), \
             patch("evals.targets.supabase_client", mock_sb), \
             patch("evals.targets.embed_text", return_value=[0.1] * 1536), \
             patch("evals.targets.search_rag", return_value=[]):
            target = CurrentTarget(model="claude-sonnet-4-20250514")
            result = await target.respond("game-1", "I pick the lock.")

        assert isinstance(result, DMResponse)
        assert isinstance(result.narration, str)
        assert len(result.narration) > 0

    async def test_metadata_tokens_used_reflects_usage(self):
        """metadata.tokens_used = input_tokens + output_tokens from Claude response."""
        mock_anthropic = _make_mock_anthropic()
        mock_sb = _make_mock_supabase()

        with patch("evals.targets.anthropic_client", mock_anthropic), \
             patch("evals.targets.supabase_client", mock_sb), \
             patch("evals.targets.embed_text", return_value=[0.1] * 1536), \
             patch("evals.targets.search_rag", return_value=[]):
            target = CurrentTarget(model="claude-sonnet-4-20250514")
            result = await target.respond("game-1", "I look around.")

        # 80 input + 120 output = 200 total
        assert result.metadata["tokens_used"] == 200

    async def test_state_updates_parsed_from_response(self):
        """state_updates contains parsed hp_changes from a canned <state_changes> block."""
        mock_anthropic = _make_mock_anthropic(CANNED_NARRATION)
        mock_sb = _make_mock_supabase()

        with patch("evals.targets.anthropic_client", mock_anthropic), \
             patch("evals.targets.supabase_client", mock_sb), \
             patch("evals.targets.embed_text", return_value=[0.1] * 1536), \
             patch("evals.targets.search_rag", return_value=[]):
            target = CurrentTarget(model="claude-sonnet-4-20250514")
            result = await target.respond("game-1", "I touch the trap.")

        assert "hp_changes" in result.state_updates
        assert result.state_updates["hp_changes"][0]["delta"] == -5

    async def test_narration_strips_structured_blocks(self):
        """narration field has all XML blocks stripped."""
        mock_anthropic = _make_mock_anthropic(CANNED_NARRATION)
        mock_sb = _make_mock_supabase()

        with patch("evals.targets.anthropic_client", mock_anthropic), \
             patch("evals.targets.supabase_client", mock_sb), \
             patch("evals.targets.embed_text", return_value=[0.1] * 1536), \
             patch("evals.targets.search_rag", return_value=[]):
            target = CurrentTarget(model="claude-sonnet-4-20250514")
            result = await target.respond("game-1", "I touch the trap.")

        assert "<state_changes>" not in result.narration
        assert "<dice_rolls>" not in result.narration
        assert "<suggested_actions>" not in result.narration

    async def test_no_db_insert_called(self):
        """CurrentTarget.respond never calls insert on game_messages or game_events."""
        mock_anthropic = _make_mock_anthropic()
        mock_sb = _make_mock_supabase()
        insert_tables: list[str] = []

        original_side_effect = mock_sb.table.side_effect

        def tracking_side_effect(name):
            mock_tbl = original_side_effect(name)
            original_insert = mock_tbl.insert

            def tracking_insert(*args, **kwargs):
                insert_tables.append(name)
                return original_insert(*args, **kwargs)

            mock_tbl.insert = tracking_insert
            return mock_tbl

        mock_sb.table.side_effect = tracking_side_effect

        with patch("evals.targets.anthropic_client", mock_anthropic), \
             patch("evals.targets.supabase_client", mock_sb), \
             patch("evals.targets.embed_text", return_value=[0.1] * 1536), \
             patch("evals.targets.search_rag", return_value=[]):
            target = CurrentTarget(model="claude-sonnet-4-20250514")
            await target.respond("game-1", "I do something.")

        assert "game_messages" not in insert_tables
        assert "game_events" not in insert_tables
