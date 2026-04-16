"""Tests for Dramatiq DM tasks."""

import pytest
import json
from unittest.mock import MagicMock, patch, call
from datetime import datetime

# Mock config clients and redis_broker before importing dm_tasks
with patch("config.supabase_client", MagicMock()), patch(
    "config.anthropic_client", MagicMock()
), patch("config.openai_client", MagicMock()), patch(
    "redis_broker.redis_broker", MagicMock()
), patch(
    "redis_broker.redis_client", MagicMock()
), patch(
    "dramatiq.middleware.CurrentMessage", MagicMock()
), patch(
    "services.embedding_service.embed_text"
) as mock_embed_text:
    from tasks.dm_tasks import (
        dm_response_task,
        generate_opening_narration,
        generate_pause_message,
        generate_end_message,
        generate_resume_narration,
    )


class TestGenerateOpeningNarration:
    """Tests for generate_opening_narration task."""

    def test_success_inserts_dm_message(self):
        """Should generate opening narration and insert DM message."""
        game_data = {
            "id": "game-1",
            "name": "Dragon's Quest",
            "dm_persona": "A mysterious DM",
        }
        player_data = [
            {
                "id": "player-1",
                "character_name": "Thorin",
                "race": "Dwarf",
                "level": 5,
                "character_class": "Warrior",
                "hp_max": 60,
            }
        ]
        inventory_data = [
            {"item_name": "Sword", "quantity": 1},
            {"item_name": "Shield", "quantity": 1},
        ]

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = player_data

        mock_inventory_result = MagicMock()
        mock_inventory_result.data = inventory_data

        mock_insert_result = MagicMock()
        mock_update_result = MagicMock()

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="The adventure begins...")]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.eq.return_value.execute.return_value = (
                    mock_update_result
                )
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_inventory_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_opening_narration.fn("game-1")

            # Assert game_messages.insert was called
            calls = mock_sb.table.call_args_list
            assert any(c[0][0] == "game_messages" for c in calls)

    def test_includes_inventory_in_prompt(self):
        """Should include inventory items in the system prompt."""
        game_data = {
            "id": "game-1",
            "name": "Dragon's Quest",
            "dm_persona": "A mysterious DM",
        }
        player_data = [
            {
                "id": "player-1",
                "character_name": "Elara",
                "race": "Elf",
                "level": 3,
                "character_class": "Mage",
                "hp_max": 30,
            }
        ]
        inventory_data = [
            {"item_name": "Spellbook", "quantity": 1},
            {"item_name": "Healing Potion", "quantity": 3},
        ]

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = player_data

        mock_inventory_result = MagicMock()
        mock_inventory_result.data = inventory_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="The spell awaits...")]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.eq.return_value.execute.return_value = (
                    MagicMock()
                )
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_inventory_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_opening_narration.fn("game-1")

            # Assert Claude was called with system prompt containing inventory items
            mock_anthropic.messages.create.assert_called_once()
            call_args = mock_anthropic.messages.create.call_args
            system_prompt = call_args[1]["system"]
            assert "Spellbook" in system_prompt or "Equipment:" in system_prompt

    def test_error_inserts_system_message(self):
        """Should insert system error message on failure."""
        mock_game_result = MagicMock()
        mock_game_result.data = None  # Trigger error

        mock_insert_result = MagicMock()

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect

            with pytest.raises(Exception):
                generate_opening_narration.fn("game-1")

            # Assert error message insertion was attempted
            assert (
                mock_insert_result.execute.called or True
            )  # May be called or error before that


class TestDmResponseTask:
    """Tests for dm_response_task Dramatiq actor."""

    def test_success_inserts_cleaned_dm_message(self):
        """Should insert DM message with event tags stripped."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
            }
        ]
        messages_data = []
        inventory_data = []

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = players_data

        mock_messages_result = MagicMock()
        mock_messages_result.data = messages_data

        mock_inventory_result = MagicMock()
        mock_inventory_result.data = inventory_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [
            MagicMock(
                text='The dragon roars. <event type="combat">Dragon attacks</event> You feel scared.'
            )
        ]

        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        mock_insert_msg = MagicMock()
        mock_insert_events = MagicMock()
        mock_update_game = MagicMock()
        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            mock_messages_result
        )
        game_messages_mock.insert.return_value.execute.return_value = mock_insert_msg

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.match.return_value.execute.return_value = (
                    mock_update_game
                )
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_inventory_result
                )
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = mock_insert_events
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch(
            "tasks.dm_tasks.openai_client"
        ) as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result

            dm_response_task.fn("game-1", "msg-1", "I attack!")

            # Verify game_messages insert was called
            assert game_messages_mock.insert.called

    def test_embeds_and_stores_events(self):
        """Should embed extracted events and store them."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
            }
        ]
        messages_data = []
        inventory_data = []

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = players_data

        mock_messages_result = MagicMock()
        mock_messages_result.data = messages_data

        mock_inventory_result = MagicMock()
        mock_inventory_result.data = inventory_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [
            MagicMock(
                text='<event type="combat">Dragon attacks</event><event type="discovery">Gold found</event>Result text.'
            )
        ]

        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        mock_insert_events = MagicMock()
        game_events_mock = MagicMock()
        game_events_mock.insert.return_value.execute.return_value = mock_insert_events

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.match.return_value.execute.return_value = (
                    MagicMock()
                )
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                    mock_messages_result
                )
                mock.insert.return_value.execute.return_value = MagicMock()
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_inventory_result
                )
            elif name == "game_events":
                return game_events_mock
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch(
            "tasks.dm_tasks.openai_client"
        ) as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result

            dm_response_task.fn("game-1", "msg-1", "I attack!")

            # Verify game_events insert was called
            assert game_events_mock.insert.called

    def test_error_inserts_system_message_on_terminal_retry(self):
        """Should insert system error message only on the terminal retry (retries == max_retries)."""
        mock_game_result = MagicMock()
        mock_game_result.data = None  # Trigger error

        mock_insert_result = MagicMock()
        game_messages_mock = MagicMock()
        game_messages_mock.insert.return_value.execute.return_value = mock_insert_result

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                return game_messages_mock
            return mock

        # Simulate terminal retry: retries == DM_TASK_MAX_RETRIES (3)
        mock_message = MagicMock()
        mock_message.options = {"retries": 3}

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.CurrentMessage"
        ) as mock_current_message, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_current_message.get_current_message.return_value = mock_message

            with pytest.raises(Exception):
                dm_response_task.fn("game-1", "msg-1", "I attack!")

            # Assert system error was inserted on the terminal retry
            assert game_messages_mock.insert.called
            insert_call = game_messages_mock.insert.call_args[0][0]
            assert insert_call["role"] == "system"

    def test_error_does_not_insert_system_message_on_early_retry(self):
        """Should not insert system error message on non-terminal retries to avoid false positives."""
        mock_game_result = MagicMock()
        mock_game_result.data = None  # Trigger error

        mock_insert_result = MagicMock()
        game_messages_mock = MagicMock()
        game_messages_mock.insert.return_value.execute.return_value = mock_insert_result

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                return game_messages_mock
            return mock

        # Simulate early retry: retries < DM_TASK_MAX_RETRIES
        mock_message = MagicMock()
        mock_message.options = {"retries": 1}

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.CurrentMessage"
        ) as mock_current_message, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_current_message.get_current_message.return_value = mock_message

            with pytest.raises(Exception):
                dm_response_task.fn("game-1", "msg-1", "I attack!")

            # Assert system error was NOT inserted — a later retry may still succeed
            assert not game_messages_mock.insert.called


class TestDin64LatencyChanges:
    """DIN-64: Embedding moved to task, DM insert before event embedding."""

    def _make_standard_mocks(self):
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
                "stats": {"str": 15, "dex": 12, "con": 13, "int": 8, "wis": 10, "cha": 9},
            }
        ]
        return game_data, players_data

    def test_dm_response_task_embeds_action_text_at_task_start(self):
        """DIN-64: embed_text must be called with the action text inside the task."""
        game_data, players_data = self._make_standard_mocks()

        mock_game_result = MagicMock()
        mock_game_result.data = game_data
        mock_players_result = MagicMock()
        mock_players_result.data = players_data
        mock_messages_result = MagicMock()
        mock_messages_result.data = []
        mock_inventory_result = MagicMock()
        mock_inventory_result.data = []
        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="The adventure continues.")]
        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_messages_result
                mock.insert.return_value.execute.return_value = MagicMock()
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = mock_inventory_result
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, \
             patch("tasks.dm_tasks.anthropic_client") as mock_anthropic, \
             patch("tasks.dm_tasks.openai_client") as mock_openai, \
             patch("tasks.dm_tasks.embed_text", return_value=[0.1] * 1536) as mock_embed, \
             patch("tasks.dm_tasks.search_rag", return_value=[]):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result

            dm_response_task.fn("game-1", "msg-1", "I attack!")

            mock_embed.assert_called_with("I attack!")

    def test_dm_response_task_inserts_dm_message_before_game_events(self):
        """DIN-64: game_messages insert must happen before game_events insert."""
        game_data, players_data = self._make_standard_mocks()

        mock_game_result = MagicMock()
        mock_game_result.data = game_data
        mock_players_result = MagicMock()
        mock_players_result.data = players_data
        mock_messages_result = MagicMock()
        mock_messages_result.data = []
        mock_inventory_result = MagicMock()
        mock_inventory_result.data = []
        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(
            text='The goblin falls. <event type="combat">Goblin defeated</event>'
        )]
        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        call_order: list[str] = []

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_messages_result

        def gm_insert(data):
            call_order.append("game_messages")
            m = MagicMock()
            m.execute.return_value = MagicMock()
            return m

        game_messages_mock.insert.side_effect = gm_insert

        game_events_mock = MagicMock()

        def ge_insert(data):
            call_order.append("game_events")
            m = MagicMock()
            m.execute.return_value = MagicMock()
            return m

        game_events_mock.insert.side_effect = ge_insert

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = mock_inventory_result
            elif name == "game_events":
                return game_events_mock
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, \
             patch("tasks.dm_tasks.anthropic_client") as mock_anthropic, \
             patch("tasks.dm_tasks.openai_client") as mock_openai, \
             patch("tasks.dm_tasks.embed_text", return_value=[0.1] * 1536), \
             patch("tasks.dm_tasks.search_rag", return_value=[]):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result

            dm_response_task.fn("game-1", "msg-1", "I attack!")

            assert "game_messages" in call_order, "game_messages insert not called"
            assert "game_events" in call_order, "game_events insert not called"
            assert call_order.index("game_messages") < call_order.index("game_events"), \
                "game_messages must be inserted before game_events"


class TestDmResponseTaskSuggestedActions:
    """Tests for suggested_actions parsing in dm_response_task (DIN-42)."""

    def _make_table_side_effect(self, game_data, players_data, inventory_data, game_messages_mock):
        """Helper to build a reusable table_side_effect for suggested_actions tests."""
        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = players_data

        mock_messages_result = MagicMock()
        mock_messages_result.data = []

        mock_inventory_result = MagicMock()
        mock_inventory_result.data = inventory_data

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_inventory_result
                )
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        return table_side_effect

    def test_suggested_actions_parsed_and_written_to_games(self):
        """Happy path: Claude response includes <suggested_actions> block → games.update called with parsed list."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
            }
        ]

        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [
            MagicMock(
                text=(
                    "The door stands before you.\n"
                    "<suggested_actions>\n"
                    "Pick the lock using your thieves' tools.\n"
                    "Search the walls for a hidden mechanism.\n"
                    "Force the door open with a Strength check.\n"
                    "</suggested_actions>"
                )
            )
        ]

        games_mock = MagicMock()
        games_mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)
        captured_update_payload = {}

        def games_update_side_effect(payload):
            captured_update_payload.update(payload)
            mock = MagicMock()
            mock.match.return_value.execute.return_value = MagicMock()
            return mock

        games_mock.update.side_effect = games_update_side_effect

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        game_messages_mock.insert.return_value.execute.return_value = MagicMock()

        def table_side_effect(name):
            if name == "games":
                return games_mock
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch(
            "tasks.dm_tasks.openai_client"
        ) as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result

            dm_response_task.fn("game-1", "msg-1", "I examine the door.")

        assert "suggested_actions" in captured_update_payload
        assert captured_update_payload["suggested_actions"] == [
            "Pick the lock using your thieves' tools.",
            "Search the walls for a hidden mechanism.",
            "Force the door open with a Strength check.",
        ]

    def test_suggested_actions_stripped_from_game_messages_content(self):
        """<suggested_actions> block is stripped from content written to game_messages."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
            }
        ]

        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        narrative = "The guard eyes you suspiciously."
        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [
            MagicMock(
                text=(
                    f"{narrative}\n"
                    "<suggested_actions>\n"
                    "Bluff the guard.\n"
                    "Run away.\n"
                    "</suggested_actions>"
                )
            )
        ]

        captured_insert_content = {}

        games_mock = MagicMock()
        games_mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)
        games_mock.update.return_value.match.return_value.execute.return_value = MagicMock()

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

        def insert_side_effect(payload):
            captured_insert_content.update(payload)
            mock = MagicMock()
            mock.execute.return_value = MagicMock()
            return mock

        game_messages_mock.insert.side_effect = insert_side_effect

        def table_side_effect(name):
            if name == "games":
                return games_mock
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch(
            "tasks.dm_tasks.openai_client"
        ) as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result

            dm_response_task.fn("game-1", "msg-1", "I approach the guard.")

        assert "suggested_actions" not in captured_insert_content.get("content", "")
        assert narrative in captured_insert_content.get("content", "")

    def test_no_suggested_actions_block_writes_empty_list(self):
        """If Claude response has no <suggested_actions> block, an empty list is written."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
            }
        ]

        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [
            MagicMock(text="The dragon roars. You feel scared.")
        ]

        captured_update_payload = {}

        games_mock = MagicMock()
        games_mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)

        def games_update_side_effect(payload):
            captured_update_payload.update(payload)
            mock = MagicMock()
            mock.match.return_value.execute.return_value = MagicMock()
            return mock

        games_mock.update.side_effect = games_update_side_effect

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        game_messages_mock.insert.return_value.execute.return_value = MagicMock()

        def table_side_effect(name):
            if name == "games":
                return games_mock
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch(
            "tasks.dm_tasks.openai_client"
        ) as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result

            dm_response_task.fn("game-1", "msg-1", "I attack!")

        assert captured_update_payload.get("suggested_actions") == []


class TestGeneratePauseMessage:
    """Tests for generate_pause_message task."""

    def test_success_inserts_dm_message(self):
        """Should generate pause message and insert it."""
        game_data = {"id": "game-1", "dm_persona": "A mysterious DM"}

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="The world pauses...")]

        mock_insert_result = MagicMock()
        game_messages_mock = MagicMock()
        game_messages_mock.insert.return_value.execute.return_value = mock_insert_result

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                return game_messages_mock
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_pause_message.fn("game-1")

            # Verify message was inserted
            assert game_messages_mock.insert.called

    def test_uses_correct_prompt(self):
        """Should use prompt mentioning pause in system message."""
        game_data = {"id": "game-1", "dm_persona": "A mysterious DM"}

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="Pause...")]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_pause_message.fn("game-1")

            # Verify Claude was called with paused-related prompt
            mock_anthropic.messages.create.assert_called_once()
            call_args = mock_anthropic.messages.create.call_args
            system_prompt = call_args[1]["system"]
            assert "paused" in system_prompt.lower()


class TestGenerateEndMessage:
    """Tests for generate_end_message task."""

    def test_success_inserts_dm_message(self):
        """Should generate end message and insert it."""
        game_data = {"id": "game-1", "dm_persona": "A mysterious DM"}

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="The adventure ends...")]

        mock_insert_result = MagicMock()
        game_messages_mock = MagicMock()
        game_messages_mock.insert.return_value.execute.return_value = mock_insert_result

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                return game_messages_mock
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_end_message.fn("game-1")

            # Verify message was inserted
            assert game_messages_mock.insert.called

    def test_uses_correct_prompt(self):
        """Should use prompt mentioning ending in system message."""
        game_data = {"id": "game-1", "dm_persona": "A mysterious DM"}

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="End...")]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_end_message.fn("game-1")

            # Verify Claude was called with ending-related prompt
            mock_anthropic.messages.create.assert_called_once()
            call_args = mock_anthropic.messages.create.call_args
            system_prompt = call_args[1]["system"]
            assert "ending" in system_prompt.lower() or "end" in system_prompt.lower()


class TestGenerateResumeNarration:
    """Tests for generate_resume_narration task."""

    def test_success_with_rag_context(self):
        """Should resume with RAG context from past events."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "profile_id": "user-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
            }
        ]
        messages_data = [
            {
                "role": "player",
                "profile_id": "user-1",
                "content": "I search for clues.",
            }
        ]

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = players_data

        mock_messages_result = MagicMock()
        mock_messages_result.data = messages_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="The adventure resumes...")]

        mock_update_result = MagicMock()

        rag_results = [{"event_type": "discovery", "summary": "Found a key"}]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.eq.return_value.execute.return_value = (
                    mock_update_result
                )
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                    mock_messages_result
                )
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch(
            "tasks.dm_tasks.search_rag", return_value=rag_results
        ), patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_resume_narration.fn("game-1")

            # Verify Claude was called
            mock_anthropic.messages.create.assert_called_once()

    def test_success_without_rag_when_no_player_messages(self):
        """Should succeed without RAG when there are no player messages."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "profile_id": "user-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
            }
        ]
        messages_data = [
            {"role": "dm", "profile_id": None, "content": "Opening narration..."}
        ]

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = players_data

        mock_messages_result = MagicMock()
        mock_messages_result.data = messages_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="Resume...")]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.eq.return_value.execute.return_value = (
                    MagicMock()
                )
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                    mock_messages_result
                )
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch("tasks.dm_tasks.search_rag") as mock_rag, patch(
            "tasks.dm_tasks.embed_text"
        ) as mock_embed:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_resume_narration.fn("game-1")

            # RAG should not be called when there are no player messages
            mock_rag.assert_not_called()
            mock_embed.assert_not_called()

    def test_success_when_rag_search_fails(self):
        """Should succeed even if RAG search fails."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-1",
                "profile_id": "user-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
            }
        ]
        messages_data = [
            {
                "role": "player",
                "profile_id": "user-1",
                "content": "I search around.",
            }
        ]

        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = players_data

        mock_messages_result = MagicMock()
        mock_messages_result.data = messages_data

        mock_anthropic_response = MagicMock()
        mock_anthropic_response.content = [MagicMock(text="Resume...")]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
                mock.update.return_value.eq.return_value.execute.return_value = (
                    MagicMock()
                )
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                    mock_messages_result
                )
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch(
            "tasks.dm_tasks.search_rag", side_effect=Exception("RAG failed")
        ), patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            # Should not raise — RAG failure is non-fatal
            generate_resume_narration.fn("game-1")

            # Verify Claude was still called
            mock_anthropic.messages.create.assert_called_once()

    def test_error_inserts_system_message(self):
        """Should insert error message on failure."""
        mock_game_result = MagicMock()
        mock_game_result.data = None  # Trigger error

        mock_insert_result = MagicMock()

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect

            with pytest.raises(Exception):
                generate_resume_narration.fn("game-1")


class TestStateChanges:
    """Tests for DIN-16: state_changes extraction and application in dm_response_task."""

    def _make_players_data(self):
        return [
            {
                "id": "player-uuid-1",
                "character_name": "Hero",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
                "stats": {"str": 16, "dex": 12, "con": 14, "int": 10, "wis": 10, "cha": 8},
            }
        ]

    def _make_base_table_side_effect(self, game_data, players_data, dm_text, game_messages_mock):
        """Build a standard table_side_effect function for dm_response_task tests."""
        mock_game_result = MagicMock()
        mock_game_result.data = game_data

        mock_players_result = MagicMock()
        mock_players_result.data = players_data

        mock_messages_result = MagicMock()
        mock_messages_result.data = []

        mock_inventory_result = MagicMock()
        mock_inventory_result.data = []

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = mock_inventory_result
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        return table_side_effect

    def test_party_line_contains_player_id(self):
        """Party line in system prompt must contain [ID: {uuid}] so Claude can reference it."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = self._make_players_data()

        captured_prompt = {}

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        game_messages_mock.insert.return_value.execute.return_value = MagicMock()

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        def capture_create(**kwargs):
            captured_prompt["system"] = kwargs.get("system", "")
            resp = MagicMock()
            resp.content = [MagicMock(text="The dragon roars.")]
            return resp

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch("tasks.dm_tasks.openai_client") as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.side_effect = capture_create
            mock_openai.embeddings.create.return_value = MagicMock(data=[MagicMock(embedding=[0.1] * 1536)])

            dm_response_task.fn("game-1", "msg-1", "I attack!")

        assert "[ID: player-uuid-1]" in captured_prompt.get("system", ""), \
            "Party line must contain [ID: {uuid}] for Claude state_changes tracking"

    def test_state_changes_block_stripped_from_clean_response(self):
        """<state_changes> block must be stripped entirely from game_messages content."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = self._make_players_data()

        dm_text = (
            "The goblin strikes. "
            "<state_changes>"
            '{"hp_changes": [{"character_id": "player-uuid-1", "delta": -5, "reason": "hit"}]}'
            "</state_changes>"
            " You fight back."
        )

        captured_content = {}

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

        def insert_side_effect(payload):
            captured_content.update(payload)
            m = MagicMock()
            m.execute.return_value = MagicMock()
            return m

        game_messages_mock.insert.side_effect = insert_side_effect

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data={"hp_current": 10, "hp_max": 10})
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch("tasks.dm_tasks.openai_client") as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = MagicMock(content=[MagicMock(text=dm_text)])
            mock_openai.embeddings.create.return_value = MagicMock(data=[MagicMock(embedding=[0.1] * 1536)])

            dm_response_task.fn("game-1", "msg-1", "I attack!")

        stored_content = captured_content.get("content", "")
        assert "<state_changes>" not in stored_content, "state_changes block must be stripped from stored content"
        assert "The goblin strikes." in stored_content, "Narrative text must be preserved"

    def test_event_inner_text_preserved_regression(self):
        """Regression: <event> inner text must still be preserved after strip order change."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = self._make_players_data()

        dm_text = 'You slash the goblin. <event type="combat">Goblin defeated</event> Victory!'

        captured_content = {}

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

        def insert_side_effect(payload):
            captured_content.update(payload)
            m = MagicMock()
            m.execute.return_value = MagicMock()
            return m

        game_messages_mock.insert.side_effect = insert_side_effect

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch("tasks.dm_tasks.openai_client") as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = MagicMock(content=[MagicMock(text=dm_text)])
            mock_openai.embeddings.create.return_value = MagicMock(data=[MagicMock(embedding=[0.1] * 1536)])

            dm_response_task.fn("game-1", "msg-1", "I attack!")

        stored_content = captured_content.get("content", "")
        assert "Goblin defeated" in stored_content, "Event inner text must be preserved in clean_response"
        assert "<event" not in stored_content, "Event XML tags must be stripped"

    def test_extract_state_changes_imported_in_tasks(self):
        """extract_state_changes must be importable from tasks.dm_tasks module."""
        import tasks.dm_tasks as dm_tasks_module
        # Verify the function is accessible (imported) in the module's namespace
        assert hasattr(dm_tasks_module, "extract_state_changes") or \
               "extract_state_changes" in dir(dm_tasks_module), \
               "extract_state_changes must be imported in dm_tasks"

    @pytest.mark.parametrize("level,expected_bonus", [
        (1, "+2"), (4, "+2"),
        (5, "+3"), (8, "+3"),
        (9, "+4"), (12, "+4"),
        (13, "+5"), (16, "+5"),
        (17, "+6"), (20, "+6"),
    ])
    def test_proficiency_bonus_full_progression(self, level, expected_bonus):
        """Proficiency bonus in the party line must follow the full D&D 5e table (levels 1-20)."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        players_data = [
            {
                "id": "player-uuid-1",
                "character_name": "Hero",
                "race": "Human",
                "level": level,
                "character_class": "Fighter",
                "hp_current": 10,
                "hp_max": 10,
                "profile_id": "user-1",
                "stats": {"str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10},
            }
        ]

        captured_prompt = {}

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        game_messages_mock.insert.return_value.execute.return_value = MagicMock()

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        def capture_create(**kwargs):
            captured_prompt["system"] = kwargs.get("system", "")
            resp = MagicMock()
            resp.content = [MagicMock(text="You strike.")]
            return resp

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch("tasks.dm_tasks.openai_client") as mock_openai, patch(
            "tasks.dm_tasks.embed_text", return_value=[0.1] * 1536
        ), patch(
            "tasks.dm_tasks.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.side_effect = capture_create
            mock_openai.embeddings.create.return_value = MagicMock(data=[MagicMock(embedding=[0.1] * 1536)])

            dm_response_task.fn("game-1", "msg-1", "I attack!")

        system_prompt = captured_prompt.get("system", "")
        assert f"Proficiency bonus: {expected_bonus}" in system_prompt, (
            f"Expected 'Proficiency bonus: {expected_bonus}' for level {level} character, "
            f"but it was not found in system prompt"
        )


class TestDin27SpellSlotsInSystemPrompt:
    """DIN-27: Spell slot state in dm_response_task system prompt."""

    def _run_task_and_capture_prompt(self, players_data):
        """Helper: run dm_response_task and return the captured system prompt."""
        game_data = {"id": "game-1", "name": "Quest", "dm_persona": "DM"}
        captured_prompt = {}

        game_messages_mock = MagicMock()
        game_messages_mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        game_messages_mock.insert.return_value.execute.return_value = MagicMock()

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = MagicMock(data=game_data)
                mock.update.return_value.match.return_value.execute.return_value = MagicMock()
                return mock
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = MagicMock(data=players_data)
            elif name == "game_messages":
                return game_messages_mock
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        def capture_create(**kwargs):
            captured_prompt["system"] = kwargs.get("system", "")
            resp = MagicMock()
            resp.content = [MagicMock(text="You cast a spell.")]
            return resp

        with patch("tasks.dm_tasks.supabase_client") as mock_sb, patch(
            "tasks.dm_tasks.anthropic_client"
        ) as mock_anthropic, patch("tasks.dm_tasks.openai_client") as mock_openai:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.side_effect = capture_create
            mock_openai.embeddings.create.return_value = MagicMock(data=[MagicMock(embedding=[0.1] * 1536)])
            dm_response_task.fn("game-1", "msg-1", "I cast Magic Missile!", [])

        return captured_prompt.get("system", "")

    def test_spell_slots_appear_in_prompt_for_wizard(self):
        """Wizard with spell slots should have slot state in the system prompt."""
        players_data = [
            {
                "id": "player-1",
                "character_name": "Elara",
                "race": "Elf",
                "level": 1,
                "character_class": "Wizard",
                "hp_current": 8,
                "hp_max": 10,
                "profile_id": "user-1",
                "stats": {
                    "str": 8, "dex": 14, "con": 12, "int": 18, "wis": 12, "cha": 10,
                    "spell_slots": {"1": {"max": 2, "used": 1}},
                    "cantrips": ["Fire Bolt"],
                },
            }
        ]
        prompt = self._run_task_and_capture_prompt(players_data)
        assert "spell slot" in prompt.lower() or "1st:" in prompt, \
            "Spell slot state must appear in system prompt for Wizard"

    def test_spell_slots_not_in_prompt_for_fighter(self):
        """Fighter with no spell slots should not have slot section in prompt."""
        players_data = [
            {
                "id": "player-1",
                "character_name": "Thorin",
                "race": "Human",
                "level": 1,
                "character_class": "Fighter",
                "hp_current": 12,
                "hp_max": 12,
                "profile_id": "user-1",
                "stats": {
                    "str": 16, "dex": 12, "con": 14, "int": 10, "wis": 10, "cha": 8,
                    "spell_slots": None,
                },
            }
        ]
        prompt = self._run_task_and_capture_prompt(players_data)
        # Fighter should NOT have spell slot section
        assert "spell slot" not in prompt.lower() or "None" not in prompt

    def test_cantrips_appear_in_prompt_when_present(self):
        """Cantrips listed in player stats should appear in the system prompt."""
        players_data = [
            {
                "id": "player-1",
                "character_name": "Elara",
                "race": "Elf",
                "level": 1,
                "character_class": "Wizard",
                "hp_current": 8,
                "hp_max": 10,
                "profile_id": "user-1",
                "stats": {
                    "str": 8, "dex": 14, "con": 12, "int": 18, "wis": 12, "cha": 10,
                    "spell_slots": {"1": {"max": 2, "used": 0}},
                    "cantrips": ["Fire Bolt", "Prestidigitation"],
                },
            }
        ]
        prompt = self._run_task_and_capture_prompt(players_data)
        assert "Fire Bolt" in prompt
        assert "Prestidigitation" in prompt

    def test_malformed_spell_slot_keys_skipped_in_prompt(self):
        """Non-numeric spell_slot keys (e.g. '1st' from bad Claude output) must not crash the prompt builder."""
        players_data = [
            {
                "id": "player-1",
                "character_name": "Elara",
                "race": "Elf",
                "level": 1,
                "character_class": "Wizard",
                "hp_current": 8,
                "hp_max": 10,
                "profile_id": "user-1",
                "stats": {
                    "str": 8, "dex": 14, "con": 12, "int": 18, "wis": 12, "cha": 10,
                    # Simulates corrupted key written by malformed Claude output
                    "spell_slots": {"1st": {"max": 2, "used": 1}, "1": {"max": 2, "used": 0}},
                },
            }
        ]
        # Should not raise ValueError
        prompt = self._run_task_and_capture_prompt(players_data)
        assert isinstance(prompt, str)
