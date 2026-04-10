"""Tests for the database service helpers."""

import pytest
from unittest.mock import MagicMock, patch


class TestGetPlayerInGame:
    """Tests for get_player_in_game()."""

    @patch("services.db_service.supabase_client")
    def test_returns_player_when_found(self, mock_sb):
        """Should return player data when player exists in game."""
        player_data = {
            "id": "player-1",
            "game_id": "game-1",
            "profile_id": "user-1",
            "character_name": "Thorin",
        }
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data=player_data
        )

        from services.db_service import get_player_in_game

        result = get_player_in_game("game-1", "player-1")

        assert result is not None
        assert result["id"] == "player-1"
        assert result["character_name"] == "Thorin"

    @patch("services.db_service.supabase_client")
    def test_returns_none_when_not_found(self, mock_sb):
        """Should return None when player is not in game."""
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data=None
        )

        from services.db_service import get_player_in_game

        result = get_player_in_game("game-1", "nonexistent-player")

        assert result is None

    @patch("services.db_service.supabase_client")
    def test_queries_correct_table(self, mock_sb):
        """Should query the players table."""
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data=None
        )

        from services.db_service import get_player_in_game

        get_player_in_game("game-1", "player-1")

        mock_sb.table.assert_called_with("players")


class TestGetGame:
    """Tests for get_game()."""

    @patch("services.db_service.supabase_client")
    def test_returns_game_when_found(self, mock_sb):
        """Should return game data when game exists."""
        game_data = {
            "id": "game-1",
            "name": "Dragon's Lair",
            "status": "active",
        }
        mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data=game_data
        )

        from services.db_service import get_game

        result = get_game("game-1")

        assert result is not None
        assert result["name"] == "Dragon's Lair"

    @patch("services.db_service.supabase_client")
    def test_returns_none_when_not_found(self, mock_sb):
        """Should return None when game doesn't exist."""
        mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data=None
        )

        from services.db_service import get_game

        result = get_game("nonexistent")

        assert result is None

    @patch("services.db_service.supabase_client")
    def test_queries_correct_table(self, mock_sb):
        """Should query the games table."""
        mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data=None
        )

        from services.db_service import get_game

        get_game("game-1")

        mock_sb.table.assert_called_with("games")


class TestInsertMessage:
    """Tests for insert_message()."""

    @patch("services.db_service.supabase_client")
    def test_inserts_message_with_all_fields(self, mock_sb):
        """Should insert a message with game_id, role, content, profile_id."""
        message_data = {
            "id": "msg-1",
            "game_id": "game-1",
            "role": "player",
            "content": "I attack!",
            "profile_id": "user-1",
        }
        mock_sb.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = MagicMock(
            data=message_data
        )

        from services.db_service import insert_message

        result = insert_message("game-1", "player", "I attack!", profile_id="user-1")

        assert result["id"] == "msg-1"
        assert result["content"] == "I attack!"

    @patch("services.db_service.supabase_client")
    def test_inserts_message_without_profile_id(self, mock_sb):
        """Should insert a DM message with profile_id=None."""
        message_data = {
            "id": "msg-2",
            "game_id": "game-1",
            "role": "dm",
            "content": "The dragon roars!",
            "profile_id": None,
        }
        mock_sb.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = MagicMock(
            data=message_data
        )

        from services.db_service import insert_message

        result = insert_message("game-1", "dm", "The dragon roars!")

        assert result["profile_id"] is None
        assert result["role"] == "dm"

    @patch("services.db_service.supabase_client")
    def test_insert_passes_correct_data(self, mock_sb):
        """Should pass the correct data to Supabase insert."""
        mock_sb.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = MagicMock(
            data={"id": "msg-1"}
        )

        from services.db_service import insert_message

        insert_message("game-1", "player", "Hello!", profile_id="user-1")

        insert_call = mock_sb.table.return_value.insert
        insert_call.assert_called_once_with(
            {
                "game_id": "game-1",
                "role": "player",
                "content": "Hello!",
                "profile_id": "user-1",
            }
        )
