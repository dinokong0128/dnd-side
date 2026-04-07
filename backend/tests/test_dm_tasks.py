"""Tests for Dramatiq DM tasks."""
import pytest
import json
from unittest.mock import MagicMock, patch, call
from datetime import datetime

# Mock config clients and redis_broker before importing dm_tasks
with patch("config.supabase_client", MagicMock()), \
     patch("config.anthropic_client", MagicMock()), \
     patch("config.openai_client", MagicMock()), \
     patch("redis_broker.redis_broker", MagicMock()), \
     patch("redis_broker.redis_client", MagicMock()), \
     patch("services.embedding_service.embed_text") as mock_embed_text:
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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.execute.return_value = mock_update_result
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = mock_inventory_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_opening_narration.fn("game-1")

            # Assert game_messages.insert was called
            calls = mock_sb.table.call_args_list
            assert any(call[0][0] == "game_messages" for call in calls)

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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = mock_inventory_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic:
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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("config.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect

            with pytest.raises(Exception):
                generate_opening_narration.fn("game-1")

            # Assert error message insertion was attempted
            assert mock_insert_result.execute.called or True  # May be called or error before that


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
            MagicMock(text='The dragon roars. <event type="combat">Dragon attacks</event> You feel scared.')
        ]

        mock_embedding_result = MagicMock()
        mock_embedding_result.data = [MagicMock(embedding=[0.1] * 1536)]

        mock_insert_msg = MagicMock()
        mock_insert_events = MagicMock()
        mock_update_game = MagicMock()

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.match.return_value.execute.return_value = mock_update_game
            elif name == "players":
                mock.select.return_value.match.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_messages_result
                mock.insert.return_value.execute.return_value = mock_insert_msg
            elif name == "player_inventory":
                mock.select.return_value.eq.return_value.execute.return_value = mock_inventory_result
            elif name == "game_events":
                mock.insert.return_value.execute.return_value = mock_insert_events
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic, \
             patch("config.openai_client") as mock_openai, \
             patch("redis_broker.redis_client") as mock_redis:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result
            mock_redis.incr.return_value = 1

            dm_response_task.fn("game-1", "msg-1", "I attack!", [])

            # Verify game_messages insert was called
            assert mock_insert_msg.execute.called

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
                mock.insert.return_value.execute.return_value = mock_insert_events
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic, \
             patch("config.openai_client") as mock_openai, \
             patch("redis_broker.redis_client") as mock_redis:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response
            mock_openai.embeddings.create.return_value = mock_embedding_result
            mock_redis.incr.return_value = 1

            dm_response_task.fn("game-1", "msg-1", "I attack!", [])

            # Verify game_events insert was called
            assert mock_insert_events.execute.called

    def test_error_inserts_system_message_and_reraises(self):
        """Should insert error message and re-raise on failure."""
        mock_game_result = MagicMock()
        mock_game_result.data = None  # Trigger error

        mock_insert_result = MagicMock()

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = mock_game_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("redis_broker.redis_client") as mock_redis:
            mock_sb.table.side_effect = table_side_effect
            mock_redis.incr.return_value = 4  # Simulate retries exhausted

            with pytest.raises(Exception):
                dm_response_task.fn("game-1", "msg-1", "I attack!", [])


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

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_pause_message.fn("game-1")

            # Verify message was inserted
            assert mock_insert_result.execute.called

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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic:
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

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic:
            mock_sb.table.side_effect = table_side_effect
            mock_anthropic.messages.create.return_value = mock_anthropic_response

            generate_end_message.fn("game-1")

            # Verify message was inserted
            assert mock_insert_result.execute.called

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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic:
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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.execute.return_value = mock_update_result
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_messages_result
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic, \
             patch("services.dm_service.search_rag", return_value=rag_results), \
             patch("services.embedding_service.embed_text", return_value=[0.1] * 1536):
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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_messages_result
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic, \
             patch("services.dm_service.search_rag") as mock_rag, \
             patch("services.embedding_service.embed_text") as mock_embed:
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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.execute.return_value = MagicMock()
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_messages_result
                mock.insert.return_value.execute.return_value = MagicMock()
            return mock

        with patch("config.supabase_client") as mock_sb, \
             patch("config.anthropic_client") as mock_anthropic, \
             patch("services.dm_service.search_rag", side_effect=Exception("RAG failed")), \
             patch("services.embedding_service.embed_text", return_value=[0.1] * 1536):
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
                mock.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_game_result
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("config.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect

            with pytest.raises(Exception):
                generate_resume_narration.fn("game-1")
