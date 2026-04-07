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


class TestStartGame:
    """Tests for POST /games/{game_id}/start."""

    def test_start_game_success(self, client):
        """Should start a game in lobby status and queue opening narration."""
        from tests.conftest import SAMPLE_PLAYER

        mock_game_result = MagicMock()
        lobby_game = {**SAMPLE_GAME, "status": "lobby"}
        mock_game_result.data = lobby_game

        mock_players_result = MagicMock()
        mock_players_result.data = [SAMPLE_PLAYER]

        mock_update_result = MagicMock()
        mock_update_result.data = {**SAMPLE_GAME, "status": "active"}

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.select.return_value.single.return_value.execute.return_value = mock_update_result
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb, \
             patch("tasks.dm_tasks.generate_opening_narration") as mock_task:
            mock_sb.table.side_effect = table_side_effect

            response = client.post("/games/game-uuid-1/start")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        mock_task.send.assert_called_once_with("game-uuid-1")

    def test_start_game_not_host_returns_403(self, client):
        """Should return 403 when user is not the host."""
        mock_game_result = MagicMock()
        other_user_game = {**SAMPLE_GAME, "created_by": "other-user-uuid"}
        mock_game_result.data = other_user_game

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/start")

        assert response.status_code == 403

    def test_start_game_not_lobby_returns_409(self, client):
        """Should return 409 when game is not in lobby status."""
        mock_game_result = MagicMock()
        mock_game_result.data = SAMPLE_GAME  # status='active'

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/start")

        assert response.status_code == 409

    def test_start_game_no_players_returns_400(self, client):
        """Should return 400 when game has no players."""
        from tests.conftest import SAMPLE_PLAYER

        mock_game_result = MagicMock()
        lobby_game = {**SAMPLE_GAME, "status": "lobby"}
        mock_game_result.data = lobby_game

        mock_players_result = MagicMock()
        mock_players_result.data = []  # Empty players list

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect
            response = client.post("/games/game-uuid-1/start")

        assert response.status_code == 400

    def test_start_game_not_found_returns_404(self, client):
        """Should return 404 when game doesn't exist."""
        mock_game_result = MagicMock()
        mock_game_result.data = None

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/start")

        assert response.status_code == 404

    def test_start_game_re_enqueue_if_active_no_messages(self, client):
        """Should re-enqueue task if game is already active with no messages."""
        from tests.conftest import SAMPLE_PLAYER

        mock_game_result = MagicMock()
        mock_game_result.data = SAMPLE_GAME  # status='active'

        mock_players_result = MagicMock()
        mock_players_result.data = [SAMPLE_PLAYER]

        mock_messages_result = MagicMock()
        mock_messages_result.data = []

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.execute.return_value = mock_messages_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb, \
             patch("tasks.dm_tasks.generate_opening_narration") as mock_task:
            mock_sb.table.side_effect = table_side_effect
            response = client.post("/games/game-uuid-1/start")

        assert response.status_code == 200
        mock_task.send.assert_called_once_with("game-uuid-1")

    def test_start_game_active_with_messages_returns_409(self, client):
        """Should return 409 if game is active with existing messages."""
        from tests.conftest import SAMPLE_PLAYER

        mock_game_result = MagicMock()
        mock_game_result.data = SAMPLE_GAME  # status='active'

        mock_players_result = MagicMock()
        mock_players_result.data = [SAMPLE_PLAYER]

        mock_messages_result = MagicMock()
        mock_messages_result.data = [{"id": "msg-1", "content": "Greetings!"}]

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            elif name == "players":
                mock.select.return_value.eq.return_value.execute.return_value = mock_players_result
            elif name == "game_messages":
                mock.select.return_value.eq.return_value.execute.return_value = mock_messages_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect
            response = client.post("/games/game-uuid-1/start")

        assert response.status_code == 409


class TestPauseGame:
    """Tests for POST /games/{game_id}/pause."""

    def test_pause_game_success(self, client):
        """Should pause an active game and queue pause message."""
        mock_game_result = MagicMock()
        mock_game_result.data = SAMPLE_GAME  # status='active'

        mock_update_result = MagicMock()
        mock_update_result.data = {**SAMPLE_GAME, "status": "paused"}

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.select.return_value.single.return_value.execute.return_value = mock_update_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb, \
             patch("tasks.dm_tasks.generate_pause_message") as mock_task:
            mock_sb.table.side_effect = table_side_effect
            response = client.post("/games/game-uuid-1/pause")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "paused"
        mock_task.send.assert_called_once_with("game-uuid-1")

    def test_pause_game_not_host_returns_403(self, client):
        """Should return 403 when user is not the host."""
        mock_game_result = MagicMock()
        other_user_game = {**SAMPLE_GAME, "created_by": "other-user-uuid"}
        mock_game_result.data = other_user_game

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/pause")

        assert response.status_code == 403

    def test_pause_game_not_active_returns_409(self, client):
        """Should return 409 when game is not in active status."""
        for status in ["lobby", "paused", "ended"]:
            mock_game_result = MagicMock()
            mock_game_result.data = {**SAMPLE_GAME, "status": status}

            with patch("api.routes.games.supabase_client") as mock_sb:
                mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
                response = client.post("/games/game-uuid-1/pause")

            assert response.status_code == 409

    def test_pause_game_not_found_returns_404(self, client):
        """Should return 404 when game doesn't exist."""
        mock_game_result = MagicMock()
        mock_game_result.data = None

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/pause")

        assert response.status_code == 404


class TestEndGame:
    """Tests for POST /games/{game_id}/end."""

    def test_end_game_from_active_success(self, client):
        """Should end an active game."""
        mock_game_result = MagicMock()
        mock_game_result.data = SAMPLE_GAME  # status='active'

        mock_update_result = MagicMock()
        mock_update_result.data = {**SAMPLE_GAME, "status": "ended"}

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.select.return_value.single.return_value.execute.return_value = mock_update_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect
            response = client.post("/games/game-uuid-1/end")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ended"

    def test_end_game_from_paused_success(self, client):
        """Should end a paused game."""
        mock_game_result = MagicMock()
        paused_game = {**SAMPLE_GAME, "status": "paused"}
        mock_game_result.data = paused_game

        mock_update_result = MagicMock()
        mock_update_result.data = {**SAMPLE_GAME, "status": "ended"}

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.select.return_value.single.return_value.execute.return_value = mock_update_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.side_effect = table_side_effect
            response = client.post("/games/game-uuid-1/end")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ended"

    def test_end_game_not_host_returns_403(self, client):
        """Should return 403 when user is not the host."""
        mock_game_result = MagicMock()
        other_user_game = {**SAMPLE_GAME, "created_by": "other-user-uuid"}
        mock_game_result.data = other_user_game

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/end")

        assert response.status_code == 403

    def test_end_game_from_lobby_returns_409(self, client):
        """Should return 409 when game is in lobby status."""
        mock_game_result = MagicMock()
        lobby_game = {**SAMPLE_GAME, "status": "lobby"}
        mock_game_result.data = lobby_game

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/end")

        assert response.status_code == 409

    def test_end_game_from_ended_returns_409(self, client):
        """Should return 409 when game is already ended."""
        mock_game_result = MagicMock()
        ended_game = {**SAMPLE_GAME, "status": "ended"}
        mock_game_result.data = ended_game

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/end")

        assert response.status_code == 409

    def test_end_game_not_found_returns_404(self, client):
        """Should return 404 when game doesn't exist."""
        mock_game_result = MagicMock()
        mock_game_result.data = None

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/end")

        assert response.status_code == 404


class TestResumeGame:
    """Tests for POST /games/{game_id}/resume."""

    def test_resume_game_success(self, client):
        """Should resume a paused game and queue resume narration."""
        mock_game_result = MagicMock()
        paused_game = {**SAMPLE_GAME, "status": "paused"}
        mock_game_result.data = paused_game

        mock_update_result = MagicMock()
        mock_update_result.data = {**SAMPLE_GAME, "status": "active"}

        def table_side_effect(name):
            mock = MagicMock()
            if name == "games":
                mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
                mock.update.return_value.eq.return_value.select.return_value.single.return_value.execute.return_value = mock_update_result
            return mock

        with patch("api.routes.games.supabase_client") as mock_sb, \
             patch("tasks.dm_tasks.generate_resume_narration") as mock_task:
            mock_sb.table.side_effect = table_side_effect
            response = client.post("/games/game-uuid-1/resume")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        mock_task.send.assert_called_once_with("game-uuid-1")

    def test_resume_game_not_host_returns_403(self, client):
        """Should return 403 when user is not the host."""
        mock_game_result = MagicMock()
        other_user_game = {**SAMPLE_GAME, "created_by": "other-user-uuid"}
        mock_game_result.data = other_user_game

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/resume")

        assert response.status_code == 403

    def test_resume_game_not_paused_returns_409(self, client):
        """Should return 409 when game is not in paused status."""
        for status in ["active", "lobby", "ended"]:
            mock_game_result = MagicMock()
            mock_game_result.data = {**SAMPLE_GAME, "status": status}

            with patch("api.routes.games.supabase_client") as mock_sb:
                mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
                response = client.post("/games/game-uuid-1/resume")

            assert response.status_code == 409

    def test_resume_game_not_found_returns_404(self, client):
        """Should return 404 when game doesn't exist."""
        mock_game_result = MagicMock()
        mock_game_result.data = None

        with patch("api.routes.games.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_game_result
            response = client.post("/games/game-uuid-1/resume")

        assert response.status_code == 404
