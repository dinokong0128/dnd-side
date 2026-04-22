"""Tests for the actions API route (DIN-66: fire-and-forget → Redis pub/sub)."""

from unittest.mock import MagicMock, patch
from tests.conftest import SAMPLE_GAME, SAMPLE_PLAYER


def _build_supabase_mock():
    """Supabase table() side-effect that responds to every call in the flow."""
    mock_player_result = MagicMock()
    mock_player_result.data = SAMPLE_PLAYER
    mock_game_result = MagicMock()
    mock_game_result.data = SAMPLE_GAME
    mock_insert_result = MagicMock()
    mock_insert_result.data = {"id": "msg-1"}
    mock_messages_result = MagicMock()
    mock_messages_result.data = []
    mock_players_result = MagicMock()
    mock_players_result.data = [SAMPLE_PLAYER]
    mock_inventory_result = MagicMock()
    mock_inventory_result.data = []

    def table_side_effect(name):
        mock = MagicMock()
        if name == "players":
            mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                mock_player_result
            )
            mock.select.return_value.match.return_value.execute.return_value = (
                mock_players_result
            )
        elif name == "games":
            mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                mock_game_result
            )
        elif name == "game_messages":
            mock.insert.return_value.execute.return_value = mock_insert_result
            mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                mock_messages_result
            )
        elif name == "player_inventory":
            mock.select.return_value.in_.return_value.execute.return_value = (
                mock_inventory_result
            )
        return mock

    return table_side_effect


class TestCreateAction:
    """Tests for POST /games/{gameId}/actions — 202 fire-and-forget (DIN-66)."""

    def test_create_action_returns_202_json(self, client):
        """Valid action returns 202 with a queued ActionResponse JSON body."""
        captured_coros = []

        def fake_create_task(coro):
            captured_coros.append(coro)
            coro.close()
            return MagicMock()

        with patch("api.routes.actions.supabase_client") as mock_sb, patch(
            "api.routes.actions.asyncio.create_task", side_effect=fake_create_task
        ), patch("api.routes.actions.embed_text") as mock_embed, patch(
            "api.routes.actions.search_rag"
        ) as mock_rag:
            mock_sb.table.side_effect = _build_supabase_mock()
            mock_embed.return_value = [0.0] * 1536
            mock_rag.return_value = []

            response = client.post(
                "/games/game-uuid-1/actions",
                json={"action_text": "I attack the dragon!"},
            )

        assert response.status_code == 202
        body = response.json()
        assert body["status"] == "queued"
        assert body["game_id"] == "game-uuid-1"
        assert "message_id" in body

        # The streaming coroutine is spawned — not a Dramatiq task.
        assert len(captured_coros) == 1

    def test_create_action_does_not_enqueue_dm_response_task(self, client):
        """DIN-66: dm_response_task is preserved for other paths, not used here."""

        def _close(coro):
            coro.close()
            return MagicMock()

        with patch("api.routes.actions.supabase_client") as mock_sb, patch(
            "api.routes.actions.asyncio.create_task", side_effect=_close
        ), patch("api.routes.actions.embed_text") as mock_embed, patch(
            "api.routes.actions.search_rag"
        ) as mock_rag:
            mock_sb.table.side_effect = _build_supabase_mock()
            mock_embed.return_value = [0.0] * 1536
            mock_rag.return_value = []

            # If actions.py accidentally imported dm_response_task, any .send
            # invocation would show up as a call on this patched symbol.
            with patch("tasks.dm_tasks.dm_response_task") as mock_dm_task:
                response = client.post(
                    "/games/game-uuid-1/actions",
                    json={"action_text": "attack"},
                )

                assert response.status_code == 202
                mock_dm_task.send.assert_not_called()

    def test_create_action_inserts_player_message(self, client):
        """Player message is inserted to game_messages (fires Realtime)."""
        captured_inserts: list[dict] = []

        mock_player_result = MagicMock(data=SAMPLE_PLAYER)
        mock_game_result = MagicMock(data=SAMPLE_GAME)
        mock_messages_result = MagicMock(data=[])
        mock_players_result = MagicMock(data=[SAMPLE_PLAYER])
        mock_inventory_result = MagicMock(data=[])

        def table_side_effect(name):
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_player_result
                )
                mock.select.return_value.match.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":

                def capture_insert(row):
                    captured_inserts.append(row)
                    return MagicMock(execute=MagicMock(return_value=MagicMock()))

                mock.insert.side_effect = capture_insert
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                    mock_messages_result
                )
            elif name == "player_inventory":
                mock.select.return_value.in_.return_value.execute.return_value = (
                    mock_inventory_result
                )
            return mock

        def _close(coro):
            coro.close()
            return MagicMock()

        with patch("api.routes.actions.supabase_client") as mock_sb, patch(
            "api.routes.actions.asyncio.create_task", side_effect=_close
        ), patch("api.routes.actions.embed_text") as mock_embed, patch(
            "api.routes.actions.search_rag"
        ) as mock_rag:
            mock_sb.table.side_effect = table_side_effect
            mock_embed.return_value = [0.0] * 1536
            mock_rag.return_value = []

            response = client.post(
                "/games/game-uuid-1/actions",
                json={"action_text": "I attack!"},
            )

        assert response.status_code == 202
        player_inserts = [r for r in captured_inserts if r.get("role") == "player"]
        assert len(player_inserts) == 1
        assert player_inserts[0]["content"] == "I attack!"
        assert player_inserts[0]["game_id"] == "game-uuid-1"

    def test_create_action_spawns_stream_task(self, client):
        """The spawned coroutine is the streaming pub/sub task."""
        captured_coros = []

        def fake_create_task(coro):
            captured_coros.append(coro)
            # Close the coroutine so it doesn't produce RuntimeWarning.
            coro.close()
            return MagicMock()

        with patch("api.routes.actions.supabase_client") as mock_sb, patch(
            "api.routes.actions.asyncio.create_task", side_effect=fake_create_task
        ), patch("api.routes.actions.embed_text") as mock_embed, patch(
            "api.routes.actions.search_rag"
        ) as mock_rag:
            mock_sb.table.side_effect = _build_supabase_mock()
            mock_embed.return_value = [0.0] * 1536
            mock_rag.return_value = []

            response = client.post(
                "/games/game-uuid-1/actions",
                json={"action_text": "I attack the dragon!"},
            )

        assert response.status_code == 202
        assert len(captured_coros) == 1

    def test_create_action_player_not_in_game(self, client):
        """403 if the player is not in the game."""
        mock_player_result = MagicMock()
        mock_player_result.data = None

        with patch("api.routes.actions.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.match.return_value.single.return_value.execute.return_value = (
                mock_player_result
            )
            response = client.post(
                "/games/game-uuid-1/actions",
                json={"action_text": "I attack!"},
            )
        assert response.status_code == 403

    def test_create_action_missing_action_text(self, client):
        response = client.post(
            "/games/game-uuid-1/actions",
            json={"player_id": "player-uuid-1"},
        )
        assert response.status_code == 422

    def test_create_action_unauthorized(self, unauthed_client):
        response = unauthed_client.post(
            "/games/game-uuid-1/actions",
            json={"action_text": "I attack!"},
        )
        assert response.status_code == 401

    def test_create_action_uses_provided_client_id(self, client):
        """Supplied client_id UUID is used as the inserted row's id and returned."""
        captured_inserts: list[dict] = []

        mock_player_result = MagicMock(data=SAMPLE_PLAYER)
        mock_game_result = MagicMock(data=SAMPLE_GAME)
        mock_messages_result = MagicMock(data=[])
        mock_players_result = MagicMock(data=[SAMPLE_PLAYER])
        mock_inventory_result = MagicMock(data=[])

        def table_side_effect(name):
            mock = MagicMock()
            if name == "players":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_player_result
                )
                mock.select.return_value.match.return_value.execute.return_value = (
                    mock_players_result
                )
            elif name == "games":
                mock.select.return_value.match.return_value.single.return_value.execute.return_value = (
                    mock_game_result
                )
            elif name == "game_messages":

                def capture_insert(row):
                    captured_inserts.append(row)
                    return MagicMock(execute=MagicMock(return_value=MagicMock()))

                mock.insert.side_effect = capture_insert
                mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                    mock_messages_result
                )
            elif name == "player_inventory":
                mock.select.return_value.in_.return_value.execute.return_value = (
                    mock_inventory_result
                )
            return mock

        def _close(coro):
            coro.close()
            return MagicMock()

        client_id = "11111111-2222-3333-4444-555555555555"

        with patch("api.routes.actions.supabase_client") as mock_sb, patch(
            "api.routes.actions.asyncio.create_task", side_effect=_close
        ), patch("api.routes.actions.embed_text") as mock_embed, patch(
            "api.routes.actions.search_rag"
        ) as mock_rag:
            mock_sb.table.side_effect = table_side_effect
            mock_embed.return_value = [0.0] * 1536
            mock_rag.return_value = []

            response = client.post(
                "/games/game-uuid-1/actions",
                json={"action_text": "I attack!", "client_id": client_id},
            )

        assert response.status_code == 202
        player_inserts = [r for r in captured_inserts if r.get("role") == "player"]
        assert len(player_inserts) == 1
        assert player_inserts[0]["id"] == client_id
        assert response.json()["message_id"] == client_id

    def test_create_action_rejects_invalid_client_id(self, client):
        """Malformed client_id returns 400 with a UUID-mentioning detail."""
        with patch("api.routes.actions.supabase_client") as mock_sb:
            mock_sb.table.side_effect = _build_supabase_mock()

            response = client.post(
                "/games/game-uuid-1/actions",
                json={"action_text": "I attack!", "client_id": "not-a-uuid"},
            )

        assert response.status_code == 400
        assert "UUID" in response.json()["detail"]

    def test_create_action_invalid_game_state_returns_422(self, client):
        """When the game is not active, validate_action raises and returns 422."""
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
                json={"action_text": "I attack!"},
            )

        assert response.status_code == 422
        assert "not active" in response.json()["detail"]
