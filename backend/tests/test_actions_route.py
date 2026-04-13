"""Tests for the actions API route."""

import pytest
from unittest.mock import MagicMock, patch
from tests.conftest import SAMPLE_GAME, SAMPLE_PLAYER


class TestCreateAction:
    """Tests for POST /games/{gameId}/actions."""

    def test_create_action_success(self, client):
        """Should accept a valid action and return 202."""
        mock_player_result = MagicMock()
        mock_player_result.data = SAMPLE_PLAYER
        mock_game_result = MagicMock()
        mock_game_result.data = SAMPLE_GAME
        mock_insert_result = MagicMock()
        mock_insert_result.data = {"id": "msg-1"}

        def table_side_effect(name):
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_player_result
                )
            elif name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("api.routes.actions.supabase_client") as mock_sb, patch(
            "api.routes.actions.openai_client"
        ) as mock_openai, patch(
            "api.routes.actions.dm_response_task"
        ) as mock_task, patch(
            "api.routes.actions.search_rag", return_value=[]
        ):
            mock_sb.table.side_effect = table_side_effect

            mock_embedding = MagicMock()
            mock_embedding.data = [MagicMock(embedding=[0.1] * 1536)]
            mock_openai.embeddings.create.return_value = mock_embedding

            response = client.post(
                "/games/game-uuid-1/actions",
                json={
                    "action_text": "I attack the dragon!",
                },
            )

        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "queued"
        assert data["game_id"] == "game-uuid-1"
        assert "message_id" in data
        mock_task.send.assert_called_once()

    def test_create_action_player_not_in_game(self, client):
        """Should return 403 when player is not in the game."""
        mock_player_result = MagicMock()
        mock_player_result.data = None

        with patch("api.routes.actions.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.match.return_value.single.return_value.execute.return_value = (
                mock_player_result
            )

            response = client.post(
                "/games/game-uuid-1/actions",
                json={
                    "action_text": "I attack!",
                },
            )

        assert response.status_code == 403

    def test_create_action_missing_action_text(self, client):
        """Should return 422 when action_text is missing."""
        response = client.post(
            "/games/game-uuid-1/actions",
            json={
                "player_id": "player-uuid-1",
            },
        )
        assert response.status_code == 422

    def test_create_action_unauthorized(self, unauthed_client):
        """Should return 401 when no auth token is provided."""
        response = unauthed_client.post(
            "/games/game-uuid-1/actions",
            json={
                "player_id": "player-uuid-1",
                "action_text": "I attack!",
            },
        )
        assert response.status_code == 401

    def test_create_action_embedding_failure_still_queues_task(self, client):
        """Should return 202 and queue the task even when OpenAI embedding fails."""
        mock_player_result = MagicMock()
        mock_player_result.data = SAMPLE_PLAYER
        mock_game_result = MagicMock()
        mock_game_result.data = SAMPLE_GAME
        mock_insert_result = MagicMock()
        mock_insert_result.data = {"id": "msg-1"}

        def table_side_effect(name):
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_player_result
                )
            elif name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":
                mock.insert.return_value.execute.return_value = mock_insert_result
            return mock

        with patch("api.routes.actions.supabase_client") as mock_sb, patch(
            "api.routes.actions.openai_client"
        ) as mock_openai, patch(
            "api.routes.actions.dm_response_task"
        ) as mock_task:
            mock_sb.table.side_effect = table_side_effect
            mock_openai.embeddings.create.side_effect = Exception("OpenAI down")

            response = client.post(
                "/games/game-uuid-1/actions",
                json={"action_text": "I attack the dragon!"},
            )

        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "queued"
        mock_task.send.assert_called_once()
        # Verify rag_context was passed as empty list (fallback)
        call_kwargs = mock_task.send.call_args[1]
        assert call_kwargs["rag_context"] == []

    def test_create_action_invalid_game_state(self, client):
        """Should return 500 when game is not active."""
        mock_player_result = MagicMock()
        mock_player_result.data = SAMPLE_PLAYER
        ended_game = {**SAMPLE_GAME, "status": "ended"}
        mock_game_result = MagicMock()
        mock_game_result.data = ended_game

        def table_side_effect(name):
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_player_result
                )
            elif name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            return mock

        with patch("api.routes.actions.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect

            response = client.post(
                "/games/game-uuid-1/actions",
                json={
                    "action_text": "I attack!",
                },
            )

        assert response.status_code == 500
        assert "not active" in response.json()["detail"]
