"""Tests for the invites API routes."""

import pytest
from unittest.mock import MagicMock, patch
from tests.conftest import SAMPLE_GAME

SAMPLE_INVITE = {
    "id": "invite-uuid-1",
    "code": "abc123def456ghi7",
    "game_id": "game-uuid-1",
    "created_at": "2026-04-05T10:00:00Z",
    "used_at": None,
}

LOBBY_GAME = {**SAMPLE_GAME, "status": "lobby"}


class TestCreateInvite:
    """Tests for POST /games/{game_id}/invites."""

    def test_create_invite_success(self, client):
        """Should create an invite and return 201 with code and invite_url."""
        mock_game_result = MagicMock()
        mock_game_result.data = LOBBY_GAME

        mock_insert_result = MagicMock()
        mock_insert_result.data = [SAMPLE_INVITE]

        with patch("api.routes.invites.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_game_result
            )
            mock_sb.table.return_value.insert.return_value.execute.return_value = (
                mock_insert_result
            )

            response = client.post("/games/game-uuid-1/invites")

        assert response.status_code == 201
        data = response.json()
        assert "code" in data
        assert "invite_url" in data

    def test_create_invite_game_not_found(self, client):
        """Should return 404 when game does not exist."""
        mock_game_result = MagicMock()
        mock_game_result.data = None

        with patch("api.routes.invites.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_game_result
            )

            response = client.post("/games/nonexistent-uuid/invites")

        assert response.status_code == 404
        assert response.json()["detail"] == "Game not found"

    def test_create_invite_not_creator(self, client):
        """Should return 403 when user is not the game creator."""
        mock_game_result = MagicMock()
        mock_game_result.data = {**LOBBY_GAME, "created_by": "other-user-uuid"}

        with patch("api.routes.invites.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_game_result
            )

            response = client.post("/games/game-uuid-1/invites")

        assert response.status_code == 403
        assert response.json()["detail"] == "Only the game creator can generate invites"

    def test_create_invite_game_not_in_lobby(self, client):
        """Should return 403 when game is not in lobby status."""
        mock_game_result = MagicMock()
        mock_game_result.data = {**SAMPLE_GAME, "status": "active"}

        with patch("api.routes.invites.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_game_result
            )

            response = client.post("/games/game-uuid-1/invites")

        assert response.status_code == 403
        assert (
            response.json()["detail"] == "Can only invite players when game is in lobby"
        )

    def test_create_invite_db_failure(self, client):
        """Should return 500 when database insert fails."""
        mock_game_result = MagicMock()
        mock_game_result.data = LOBBY_GAME

        mock_insert_result = MagicMock()
        mock_insert_result.data = None

        with patch("api.routes.invites.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_game_result
            )
            mock_sb.table.return_value.insert.return_value.execute.return_value = (
                mock_insert_result
            )

            response = client.post("/games/game-uuid-1/invites")

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to create invite"

    def test_create_invite_unauthorized(self, unauthed_client):
        """Should return 401 when no auth token is provided."""
        response = unauthed_client.post("/games/game-uuid-1/invites")
        assert response.status_code == 401

    def test_invite_url_contains_code(self, client):
        """The invite_url in the response should contain the generated code."""
        mock_game_result = MagicMock()
        mock_game_result.data = LOBBY_GAME

        mock_insert_result = MagicMock()
        mock_insert_result.data = [SAMPLE_INVITE]

        with patch("api.routes.invites.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_game_result
            )
            mock_sb.table.return_value.insert.return_value.execute.return_value = (
                mock_insert_result
            )

            response = client.post("/games/game-uuid-1/invites")

        assert response.status_code == 201
        data = response.json()
        assert data["code"] in data["invite_url"]
        assert "/auth/signup?code=" in data["invite_url"]
