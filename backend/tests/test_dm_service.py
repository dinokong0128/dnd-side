"""Tests for the DM orchestration service."""

import pytest
from unittest.mock import MagicMock, patch

# Mock config.supabase_client before importing dm_service to avoid
# real Supabase client initialization during test collection.
with patch("config.supabase_client", MagicMock()):
    from services.dm_service import (
        validate_action,
        search_rag,
        extract_events_from_response,
        extract_state_changes,
        apply_state_changes,
        extract_dice_rolls,
        build_dm_system_prompt,
    )


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
            "The treasure glows. "
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
        mock_sb.rpc.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "evt-1",
                    "event_type": "combat",
                    "summary": "Fight",
                    "similarity": 0.9,
                },
            ]
        )

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
        mock_sb.rpc.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "evt-1",
                    "event_type": "combat",
                    "summary": "Fight 1",
                    "similarity": 0.95,
                },
                {
                    "id": "evt-2",
                    "event_type": "discovery",
                    "summary": "Found item",
                    "similarity": 0.85,
                },
                {
                    "id": "evt-3",
                    "event_type": "dialogue",
                    "summary": "NPC talk",
                    "similarity": 0.75,
                },
            ]
        )

        results = search_rag("game-uuid-1", [0.1] * 1536, top_k=3)
        assert len(results) == 3


class TestExtractStateChanges:
    """Tests for extract_state_changes()."""

    def test_valid_block_returns_parsed_dict(self):
        """Should parse a valid <state_changes> block and return a dict."""
        text = """Some narrative.
<state_changes>
{"hp_changes": [{"character_id": "abc-123", "delta": -8, "reason": "goblin attack"}]}
</state_changes>
More text."""
        result = extract_state_changes(text)
        assert result == {"hp_changes": [{"character_id": "abc-123", "delta": -8, "reason": "goblin attack"}]}

    def test_no_block_returns_empty_dict(self):
        """Should return {} when no <state_changes> block is present."""
        text = "The dragon roars. Nothing changes mechanically."
        result = extract_state_changes(text)
        assert result == {}

    def test_malformed_json_returns_empty_dict(self):
        """Should return {} on malformed JSON — no exception raised."""
        text = "<state_changes>not valid json {</state_changes>"
        result = extract_state_changes(text)
        assert result == {}

    def test_only_hp_changes_field(self):
        """Should return dict with only hp_changes if that's all that's present."""
        text = '<state_changes>{"hp_changes": [{"character_id": "x", "delta": 5, "reason": "heal"}]}</state_changes>'
        result = extract_state_changes(text)
        assert "hp_changes" in result
        assert "inventory_add" not in result
        assert "inventory_remove" not in result

    def test_all_fields_present(self):
        """Should return dict with all three field types."""
        data = {
            "hp_changes": [{"character_id": "p1", "delta": -4, "reason": "trap"}],
            "inventory_add": [{"character_id": "p1", "item_name": "Gold Coin", "quantity": 10}],
            "inventory_remove": [{"character_id": "p1", "item_name": "Torch", "quantity": 1}],
        }
        import json
        text = f"<state_changes>{json.dumps(data)}</state_changes>"
        result = extract_state_changes(text)
        assert result == data

    def test_empty_block_returns_empty_dict(self):
        """Should return {} for empty state_changes block."""
        text = "<state_changes>{}</state_changes>"
        result = extract_state_changes(text)
        assert result == {}

    def test_multiline_block_parsed(self):
        """Should parse a multiline JSON block."""
        text = """<state_changes>
{
  "hp_changes": [
    {"character_id": "uuid-1", "delta": -10, "reason": "fire damage"}
  ]
}
</state_changes>"""
        result = extract_state_changes(text)
        assert result["hp_changes"][0]["delta"] == -10

    def test_non_dict_json_returns_empty_dict(self):
        """Should return {} when Claude emits valid JSON that is not an object (e.g. array).
        Without this guard, apply_state_changes would receive a list and raise AttributeError
        on the first .get() call, crashing the entire DM task.
        """
        for payload in ["[]", "[1, 2, 3]", '"just a string"', "42", "true", "null"]:
            text = f"<state_changes>{payload}</state_changes>"
            result = extract_state_changes(text)
            assert result == {}, f"Expected {{}} for payload {payload!r}, got {result!r}"


class TestApplyStateChanges:
    """Tests for apply_state_changes()."""

    @patch("services.dm_service.supabase_client")
    def test_hp_delta_clamped_and_written(self, mock_sb):
        """HP delta should be applied and clamped to [0, hp_max]."""
        player_mock = MagicMock()
        player_mock.data = {"hp_current": 20, "hp_max": 30}
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = player_mock
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        apply_state_changes({"hp_changes": [{"character_id": "player-1", "delta": -8, "reason": "hit"}]})

        mock_sb.table.return_value.update.assert_called_once_with({"hp_current": 12})

    @patch("services.dm_service.supabase_client")
    def test_hp_clamped_at_zero(self, mock_sb):
        """HP should not go below 0 regardless of delta."""
        player_mock = MagicMock()
        player_mock.data = {"hp_current": 5, "hp_max": 30}
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = player_mock
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        apply_state_changes({"hp_changes": [{"character_id": "p1", "delta": -100, "reason": "massive damage"}]})

        mock_sb.table.return_value.update.assert_called_once_with({"hp_current": 0})

    @patch("services.dm_service.supabase_client")
    def test_hp_clamped_at_hp_max(self, mock_sb):
        """HP should not exceed hp_max."""
        player_mock = MagicMock()
        player_mock.data = {"hp_current": 28, "hp_max": 30}
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = player_mock
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        apply_state_changes({"hp_changes": [{"character_id": "p1", "delta": 50, "reason": "potion"}]})

        mock_sb.table.return_value.update.assert_called_once_with({"hp_current": 30})

    @patch("services.dm_service.supabase_client")
    def test_inventory_add_new_item_inserts(self, mock_sb):
        """Adding an item not in inventory should call insert."""
        existing_mock = MagicMock()
        existing_mock.data = []  # No existing item

        inventory_mock = MagicMock()
        inventory_mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing_mock
        inventory_mock.insert.return_value.execute.return_value = MagicMock()

        def table_side(name):
            if name == "player_inventory":
                return inventory_mock
            return MagicMock()

        mock_sb.table.side_effect = table_side

        apply_state_changes({"inventory_add": [{"character_id": "p1", "item_name": "Iron Key", "quantity": 1}]})

        inventory_mock.insert.assert_called()

    @patch("services.dm_service.supabase_client")
    def test_inventory_add_existing_item_increments_quantity(self, mock_sb):
        """Adding an existing item should increment its quantity."""
        existing_mock = MagicMock()
        existing_mock.data = [{"id": "inv-1", "quantity": 3}]

        inventory_mock = MagicMock()
        inventory_mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing_mock
        inventory_mock.update.return_value.eq.return_value.execute.return_value = MagicMock()

        def table_side(name):
            if name == "player_inventory":
                return inventory_mock
            return MagicMock()

        mock_sb.table.side_effect = table_side

        apply_state_changes({"inventory_add": [{"character_id": "p1", "item_name": "Gold Coin", "quantity": 10}]})

        inventory_mock.update.assert_called_with({"quantity": 13})

    @patch("services.dm_service.supabase_client")
    def test_inventory_remove_to_zero_deletes_row(self, mock_sb):
        """Removing all quantity of an item should delete the row."""
        existing_mock = MagicMock()
        existing_mock.data = [{"id": "inv-1", "quantity": 1}]

        inventory_mock = MagicMock()
        inventory_mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing_mock
        inventory_mock.delete.return_value.eq.return_value.execute.return_value = MagicMock()

        def table_side(name):
            if name == "player_inventory":
                return inventory_mock
            return MagicMock()

        mock_sb.table.side_effect = table_side

        apply_state_changes({"inventory_remove": [{"character_id": "p1", "item_name": "Torch", "quantity": 1}]})

        inventory_mock.delete.assert_called()

    @patch("services.dm_service.supabase_client")
    def test_inventory_remove_nonexistent_item_no_error(self, mock_sb):
        """Removing a non-existent item should not raise."""
        existing_mock = MagicMock()
        existing_mock.data = []  # Item doesn't exist

        def table_side(name):
            mock = MagicMock()
            mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing_mock
            return mock

        mock_sb.table.side_effect = table_side

        # Should not raise
        apply_state_changes({"inventory_remove": [{"character_id": "p1", "item_name": "Nonexistent", "quantity": 1}]})

    @patch("services.dm_service.supabase_client")
    def test_inventory_failure_does_not_raise(self, mock_sb):
        """DB failure on inventory operations should be swallowed (best-effort)."""
        def table_side(name):
            mock = MagicMock()
            mock.select.return_value.eq.return_value.eq.return_value.execute.side_effect = Exception("DB error")
            return mock

        mock_sb.table.side_effect = table_side

        # Should not raise — inventory operations are best-effort
        apply_state_changes({"inventory_add": [{"character_id": "p1", "item_name": "Sword", "quantity": 1}]})

    @patch("services.dm_service.supabase_client")
    def test_empty_state_changes_is_noop(self, mock_sb):
        """Empty dict should do nothing — no DB calls."""
        apply_state_changes({})
        mock_sb.table.assert_not_called()


class TestExtractDiceRolls:
    """Tests for extract_dice_rolls()."""

    VALID_BLOCK = """Some DM narration.
<dice_rolls>
[
  {
    "type": "dice_roll",
    "die": "d20",
    "count": 1,
    "result": 14,
    "modifier": 3,
    "total": 17,
    "label": "Stealth Check",
    "dc": 15,
    "success": true
  }
]
</dice_rolls>
More narration."""

    def test_extracts_valid_block(self):
        """Should parse dice_rolls array from a valid block."""
        rolls = extract_dice_rolls(self.VALID_BLOCK)
        assert len(rolls) == 1
        assert rolls[0]["die"] == "d20"
        assert rolls[0]["total"] == 17
        assert rolls[0]["label"] == "Stealth Check"
        assert rolls[0]["success"] is True

    def test_returns_empty_list_when_no_block(self):
        """Should return [] when no <dice_rolls> block is present."""
        rolls = extract_dice_rolls("Just a normal DM response with no dice.")
        assert rolls == []

    def test_returns_empty_list_on_malformed_json(self):
        """Should return [] gracefully when JSON is invalid."""
        bad = "<dice_rolls>not valid json</dice_rolls>"
        rolls = extract_dice_rolls(bad)
        assert rolls == []

    def test_returns_empty_list_on_empty_array(self):
        """Should return [] for an empty array block."""
        rolls = extract_dice_rolls("<dice_rolls>[]</dice_rolls>")
        assert rolls == []

    def test_extracts_multiple_rolls(self):
        """Should parse multiple dice roll entries."""
        text = """<dice_rolls>
[
  {"type": "dice_roll", "die": "d20", "count": 1, "result": 8, "modifier": 2, "total": 10, "label": "Attack Roll"},
  {"type": "dice_roll", "die": "d6", "count": 1, "result": 4, "modifier": 3, "total": 7, "label": "Longsword Damage"}
]
</dice_rolls>"""
        rolls = extract_dice_rolls(text)
        assert len(rolls) == 2
        assert rolls[0]["die"] == "d20"
        assert rolls[1]["die"] == "d6"

    def test_merges_multiple_blocks(self):
        """Should merge rolls from multiple <dice_rolls> blocks."""
        text = (
            '<dice_rolls>[{"die":"d20","count":1,"result":10,"modifier":2,"total":12,"label":"Attack"}]</dice_rolls>'
            " Narration. "
            '<dice_rolls>[{"die":"d6","count":1,"result":3,"modifier":0,"total":3,"label":"Damage"}]</dice_rolls>'
        )
        rolls = extract_dice_rolls(text)
        assert len(rolls) == 2
        assert rolls[0]["die"] == "d20"
        assert rolls[1]["die"] == "d6"

    def test_drops_entry_with_invalid_die_type(self):
        """Should drop entries whose 'die' field is not in the valid set."""
        text = (
            '<dice_rolls>[{"die":"d7","count":1,"result":4,"modifier":0,"total":4,"label":"Bad Die"}]</dice_rolls>'
        )
        assert extract_dice_rolls(text) == []

    def test_drops_entry_with_non_integer_numeric_field(self):
        """Should drop entries where a required numeric field is a string."""
        text = (
            '<dice_rolls>[{"die":"d20","count":1,"result":"14","modifier":2,"total":16,"label":"Check"}]</dice_rolls>'
        )
        assert extract_dice_rolls(text) == []

    def test_drops_malformed_entries_keeps_valid(self):
        """Should keep valid entries and drop malformed ones in the same block."""
        text = """<dice_rolls>
[
  {"die": "d20", "count": 1, "result": 18, "modifier": 3, "total": 21, "label": "Attack"},
  {"die": "d99", "count": 1, "result": 5, "modifier": 0, "total": 5, "label": "Bad"},
  {"die": "d8", "count": 1, "result": 6, "modifier": 1, "total": 7, "label": "Damage"}
]
</dice_rolls>"""
        rolls = extract_dice_rolls(text)
        assert len(rolls) == 2
        assert rolls[0]["die"] == "d20"
        assert rolls[1]["die"] == "d8"


class TestApplyStateChangesSpellSlots:
    """DIN-27: apply_state_changes handlers for spell_slot_use and spell_slots_recharge."""

    @patch("services.dm_service.supabase_client")
    def test_spell_slot_use_increments_used(self, mock_sb):
        """spell_slot_use should increment used by 1 for the specified slot level."""
        player_stats = {
            "str": 10, "dex": 10, "con": 10, "int": 18, "wis": 10, "cha": 10,
            "spell_slots": {"1": {"max": 2, "used": 0}},
        }
        player_mock = MagicMock()
        player_mock.data = {"stats": player_stats}
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = player_mock
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        apply_state_changes({
            "spell_slot_use": [
                {"character_id": "player-1", "slot_level": 1, "spell_name": "Magic Missile"}
            ]
        })

        update_call = mock_sb.table.return_value.update.call_args[0][0]
        assert update_call["stats"]["spell_slots"]["1"]["used"] == 1

    @patch("services.dm_service.supabase_client")
    def test_spell_slot_use_capped_at_max(self, mock_sb):
        """Used should not exceed max even if cast multiple times."""
        player_stats = {
            "str": 10, "dex": 10, "con": 10, "int": 18, "wis": 10, "cha": 10,
            "spell_slots": {"1": {"max": 2, "used": 2}},
        }
        player_mock = MagicMock()
        player_mock.data = {"stats": player_stats}
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = player_mock
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        apply_state_changes({
            "spell_slot_use": [
                {"character_id": "player-1", "slot_level": 1, "spell_name": "Magic Missile"}
            ]
        })

        update_call = mock_sb.table.return_value.update.call_args[0][0]
        assert update_call["stats"]["spell_slots"]["1"]["used"] == 2  # Capped at max

    @patch("services.dm_service.supabase_client")
    def test_spell_slots_recharge_resets_used_to_zero(self, mock_sb):
        """spell_slots_recharge should reset all used counts to 0."""
        player_stats = {
            "str": 10, "dex": 10, "con": 10, "int": 18, "wis": 10, "cha": 10,
            "spell_slots": {
                "1": {"max": 4, "used": 3},
                "2": {"max": 2, "used": 2},
            },
        }
        player_mock = MagicMock()
        player_mock.data = {"stats": player_stats}
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = player_mock
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        apply_state_changes({
            "spell_slots_recharge": [{"character_id": "player-1"}]
        })

        update_call = mock_sb.table.return_value.update.call_args[0][0]
        recharged = update_call["stats"]["spell_slots"]
        assert recharged["1"]["used"] == 0
        assert recharged["2"]["used"] == 0

    @patch("services.dm_service.supabase_client")
    def test_spell_slot_use_db_failure_is_best_effort(self, mock_sb):
        """DB failure during spell_slot_use should not raise — best-effort."""
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("DB error")

        # Should not raise
        apply_state_changes({
            "spell_slot_use": [{"character_id": "player-1", "slot_level": 1, "spell_name": "Fireball"}]
        })


# ---------------------------------------------------------------------------
# Helpers shared by the new DIN-74 test classes
# ---------------------------------------------------------------------------

def _make_game(name: str = "Test Game", dm_persona: str = "A stern DM") -> dict:
    return {"name": name, "dm_persona": dm_persona}


def _make_player(
    pid: str = "p1",
    character_name: str = "Thorin",
    character_class: str = "Fighter",
    hp_current: int = 10,
    hp_max: int = 10,
    level: int = 1,
    race: str = "Dwarf",
    stats: dict | None = None,
) -> dict:
    return {
        "id": pid,
        "profile_id": f"profile-{pid}",
        "character_name": character_name,
        "character_class": character_class,
        "hp_current": hp_current,
        "hp_max": hp_max,
        "level": level,
        "race": race,
        "stats": stats or {},
    }


# ---------------------------------------------------------------------------
# DIN-74 Part A — CURRENT SCENE block injection
# ---------------------------------------------------------------------------

class TestBuildDmSystemPromptSceneContinuity:
    """DIN-74 Part A: CURRENT SCENE block injection in build_dm_system_prompt."""

    def test_injects_current_scene_block_from_dm_message(self):
        """CURRENT SCENE block renders when most recent DM message has a scene."""
        game = _make_game()
        players = [_make_player()]
        recent = [
            {
                "role": "dm",
                "profile_id": None,
                "content": "The throne room looms.",
                "scene_type": "throne_room",
                "scene_mood": "tense",
            },
            {
                "role": "player",
                "profile_id": "profile-p1",
                "content": "I bow.",
                "scene_type": None,
                "scene_mood": None,
            },
        ]
        prompt = build_dm_system_prompt(game, players, {}, recent, [], "I step forward")
        assert "CURRENT SCENE:" in prompt
        assert "throne_room" in prompt
        assert "tense" in prompt

    def test_omits_current_scene_when_no_prior_messages(self):
        """CURRENT SCENE block is omitted when there are no DM messages with scene."""
        game = _make_game()
        players = [_make_player()]
        prompt = build_dm_system_prompt(game, players, {}, [], [], "I look around")
        assert "CURRENT SCENE:" not in prompt

    def test_uses_most_recent_scene_only(self):
        """When multiple DM messages have scenes, newest-first wins."""
        game = _make_game()
        players = [_make_player()]
        recent = [
            {
                "role": "dm",
                "profile_id": None,
                "content": "Cave walls close in.",
                "scene_type": "cave",
                "scene_mood": "tense",
            },
            {
                "role": "dm",
                "profile_id": None,
                "content": "You leave the tavern.",
                "scene_type": "tavern",
                "scene_mood": None,
            },
        ]
        prompt = build_dm_system_prompt(game, players, {}, recent, [], "I continue")
        assert "cave" in prompt
        scene_section = prompt.split("CURRENT SCENE:")[1].split("\n\n")[0]
        assert "tavern" not in scene_section

    def test_handles_scene_type_without_mood(self):
        """Mood is optional — omit from output when mood is None."""
        game = _make_game()
        players = [_make_player()]
        recent = [
            {
                "role": "dm",
                "profile_id": None,
                "content": "Tavern bustle.",
                "scene_type": "tavern",
                "scene_mood": None,
            },
        ]
        prompt = build_dm_system_prompt(game, players, {}, recent, [], "I order ale")
        scene_section = prompt.split("CURRENT SCENE:")[1].split("\n\n")[0]
        assert "tavern" in scene_section
        assert "mood:" not in scene_section.lower()

    def test_skips_player_messages_without_scene(self):
        """Player messages with no scene_type should not contribute to CURRENT SCENE."""
        game = _make_game()
        players = [_make_player()]
        recent = [
            {
                "role": "player",
                "profile_id": "profile-p1",
                "content": "I attack.",
                "scene_type": None,
                "scene_mood": None,
            },
        ]
        prompt = build_dm_system_prompt(game, players, {}, recent, [], "I dodge")
        assert "CURRENT SCENE:" not in prompt


# ---------------------------------------------------------------------------
# DIN-74 Part B — acting_player param + Rule 9 dual blocks
# ---------------------------------------------------------------------------

class TestBuildDmSystemPromptActingPlayer:
    """DIN-74 Part B: acting_player threading in build_dm_system_prompt."""

    def test_references_acting_player_name_and_id_in_prompt(self):
        """Rule 9 must reference the acting player so Claude knows who to tailor for."""
        game = _make_game()
        acting = _make_player(pid="p1", character_name="Elara")
        prompt = build_dm_system_prompt(
            game, [acting], {}, [], [], "I cast light", acting_player=acting
        )
        assert "Elara" in prompt
        assert "p1" in prompt

    def test_rule_9_mentions_both_block_types(self):
        """Rule 9 text must describe both tailored and generic blocks."""
        game = _make_game()
        acting = _make_player(pid="p1", character_name="T")
        prompt = build_dm_system_prompt(
            game, [acting], {}, [], [], "I attack", acting_player=acting
        )
        assert "character_id=" in prompt
        assert 'generic="true"' in prompt

    def test_build_prompt_works_without_acting_player(self):
        """Backward compat: acting_player=None should not break prompt building."""
        game = _make_game()
        players = [_make_player()]
        prompt = build_dm_system_prompt(game, players, {}, [], [], "I look around")
        assert "You are" in prompt
        assert "RULES:" in prompt
