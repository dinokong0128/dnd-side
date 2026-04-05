"""Tests for the games API routes."""
import pytest
from unittest.mock import MagicMock, patch
from tests.conftest import SAMPLE_GAME


class TestCreateGame:
    """Tests for POST /games."""

    def test_create_game_success(self, client):
        """Should create a game and return 201."""
        mock_result = MagicMock()
        mock_result.data = SAMPLE_GAME

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = mock_result

            response = client.post("/games/", json={
                "name": "Dragon's Lair",
                "dm_persona": "A dark and mysterious DM.",
            })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Dragon's Lair"
        assert data["dm_persona"] == "A dark and mysterious DM."
        assert data["id"] == "game-uuid-1"

    def test_create_game_with_default_persona(self, client):
        """Should use default dm_persona when not provided."""
        mock_result = MagicMock()
        mock_result.data = {
            **SAMPLE_GAME,
            "dm_persona": "A classic high-fantasy D&D adventure.",
        }

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = mock_result
            response = client.post("/games/", json={"name": "Test Game"})

        assert response.status_code == 201

    def test_create_game_missing_name_returns_422(self, client):
        """Should return 422 when name is missing."""
        response = client.post("/games/", json={"dm_persona": "Some persona"})
        assert response.status_code == 422

    def test_create_game_empty_body_returns_422(self, client):
        """Should return 422 when body is empty."""
        response = client.post("/games/", json={})
        assert response.status_code == 422

    def test_create_game_db_failure_returns_500(self, client):
        """Should return 500 when database insert fails."""
        mock_result = MagicMock()
        mock_result.data = None

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = mock_result
            response = client.post("/games/", json={"name": "Test Game"})

        assert response.status_code == 500

    def test_create_game_unauthorized(self, unauthed_client):
        """Should return 401 when no auth token is provided."""
        response = unauthed_client.post("/games/", json={"name": "Test"})
        assert response.status_code == 401


class TestListGames:
    """Tests for GET /games."""

    def test_list_games_returns_user_games(self, client):
        """Should return games owned by the authenticated user."""
        mock_result = MagicMock()
        mock_result.data = [SAMPLE_GAME]

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
            response = client.get("/games/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Dragon's Lair"

    def test_list_games_returns_empty_list(self, client):
        """Should return empty list when user has no games."""
        mock_result = MagicMock()
        mock_result.data = []

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
            response = client.get("/games/")

        assert response.status_code == 200
        assert response.json() == []

    def test_list_games_returns_none_as_empty(self, client):
        """Should handle None data gracefully."""
        mock_result = MagicMock()
        mock_result.data = None

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
            response = client.get("/games/")

        assert response.status_code == 200
        assert response.json() == []

    def test_list_games_multiple(self, client):
        """Should return multiple games."""
        game2 = {**SAMPLE_GAME, "id": "game-uuid-2", "name": "Dungeon Crawl"}
        mock_result = MagicMock()
        mock_result.data = [SAMPLE_GAME, game2]

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
            response = client.get("/games/")

        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_list_games_unauthorized(self, unauthed_client):
        """Should return 401 when no auth token is provided."""
        response = unauthed_client.get("/games/")
        assert response.status_code == 401


class TestGetGame:
    """Tests for GET /games/{game_id}."""

    def test_get_game_success(self, client):
        """Should return a single game by ID."""
        mock_result = MagicMock()
        mock_result.data = SAMPLE_GAME

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
            response = client.get("/games/game-uuid-1")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "game-uuid-1"
        assert data["name"] == "Dragon's Lair"

    def test_get_game_not_found(self, client):
        """Should return 404 when game doesn't exist."""
        mock_result = MagicMock()
        mock_result.data = None

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
            response = client.get("/games/nonexistent-uuid")

        assert response.status_code == 404
        assert response.json()["detail"] == "Game not found"

    def test_get_game_unauthorized(self, unauthed_client):
        """Should return 401 when no auth token is provided."""
        response = unauthed_client.get("/games/game-uuid-1")
        assert response.status_code == 401
