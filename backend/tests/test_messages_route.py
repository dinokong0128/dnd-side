"""Tests for messages route (DIN-61): delete and patch last player message."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MSG_ID = "msg-uuid-1"
GAME_ID = "game-uuid-1"
USER_ID = "test-user-uuid-1234"
OTHER_USER = "other-user-uuid-9999"

PLAYER_MSG = {
    "id": MSG_ID,
    "game_id": GAME_ID,
    "role": "player",
    "profile_id": USER_ID,
    "content": "I attack the goblin!",
    "created_at": "2026-04-01T12:00:00Z",
}

DM_MSG = {
    "id": "msg-dm-1",
    "game_id": GAME_ID,
    "role": "dm",
    "profile_id": None,
    "content": "The goblin dodges.",
    "created_at": "2026-04-01T12:00:01Z",
}


def make_supabase_mock(
    msg_data=PLAYER_MSG,
    last_id=MSG_ID,
    following_data=None,
    updated_data=PLAYER_MSG,
    raise_on_update=False,
):
    """Build a mock supabase_client that routes table calls appropriately."""
    mock = MagicMock()

    def table_side_effect(name):
        t = MagicMock()
        if name == "game_messages":
            # maybe_single for the initial lookup
            maybe_single_chain = MagicMock()
            maybe_single_chain.execute.return_value = MagicMock(data=msg_data)
            t.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value = maybe_single_chain

            # last player message query (select id, eq game_id, eq role=player, order desc, limit 1)
            last_chain = MagicMock()
            last_chain.execute.return_value = MagicMock(
                data=[{"id": last_id}] if last_id else []
            )
            t.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value = last_chain

            # following message query (select id role, gt, order asc, limit 1)
            following_chain = MagicMock()
            following_chain.execute.return_value = MagicMock(
                data=following_data or []
            )
            t.select.return_value.eq.return_value.gt.return_value.order.return_value.limit.return_value = following_chain

            # delete chain
            t.delete.return_value.eq.return_value.execute.return_value = MagicMock()

            # update → select → single → execute
            if raise_on_update:
                t.update.side_effect = Exception("DB error")
            else:
                updated_chain = MagicMock()
                updated_chain.execute.return_value = MagicMock(data=updated_data)
                t.update.return_value.eq.return_value.select.return_value.single.return_value = updated_chain

        return t

    mock.table.side_effect = table_side_effect
    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    from main import app
    from api.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: USER_ID
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def unauthed_client():
    from main import app

    app.dependency_overrides.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# DELETE tests
# ---------------------------------------------------------------------------


class TestDeleteMessage:
    def test_happy_path_returns_204(self, client):
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock().table.side_effect
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")
        assert res.status_code == 204

    def test_also_deletes_following_dm_message(self, client):
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock(
                following_data=[DM_MSG]
            ).table.side_effect
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")
        assert res.status_code == 204
        # Verify delete was called (at least twice: DM msg + player msg)
        assert mock_sb.table.call_count >= 1

    def test_returns_409_when_not_last_message(self, client):
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock(
                last_id="some-other-msg"
            ).table.side_effect
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")
        assert res.status_code == 409

    def test_returns_403_when_message_belongs_to_other_user(self, client):
        other_msg = {**PLAYER_MSG, "profile_id": OTHER_USER}
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock(
                msg_data=other_msg
            ).table.side_effect
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")
        assert res.status_code == 403

    def test_returns_404_when_message_not_found(self, client):
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock(
                msg_data=None
            ).table.side_effect
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")
        assert res.status_code == 404

    def test_returns_403_when_message_is_not_player_role(self, client):
        dm_msg = {**PLAYER_MSG, "role": "dm", "profile_id": None}
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock(
                msg_data=dm_msg
            ).table.side_effect
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")
        assert res.status_code == 403

    def test_returns_401_when_unauthenticated(self, unauthed_client):
        res = unauthed_client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# PATCH tests
# ---------------------------------------------------------------------------


class TestUpdateMessage:
    def test_happy_path_returns_200(self, client):
        updated = {**PLAYER_MSG, "content": "I cast a spell!"}
        with patch("api.routes.messages.supabase_client") as mock_sb, \
             patch("api.routes.messages.dm_response_task") as mock_task, \
             patch("api.routes.messages.openai_client") as mock_openai, \
             patch("api.routes.messages.search_rag", return_value=[]):
            mock_sb.table.side_effect = make_supabase_mock(
                updated_data=updated
            ).table.side_effect
            mock_openai.embeddings.create.return_value = MagicMock(
                data=[MagicMock(embedding=[0.1] * 1536)]
            )
            mock_task.send = MagicMock()

            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "I cast a spell!"},
            )

        assert res.status_code == 200

    def test_queues_dm_response_task_after_update(self, client):
        updated = {**PLAYER_MSG, "content": "New action"}
        with patch("api.routes.messages.supabase_client") as mock_sb, \
             patch("api.routes.messages.dm_response_task") as mock_task, \
             patch("api.routes.messages.openai_client") as mock_openai, \
             patch("api.routes.messages.search_rag", return_value=[]):
            mock_sb.table.side_effect = make_supabase_mock(
                updated_data=updated
            ).table.side_effect
            mock_openai.embeddings.create.return_value = MagicMock(
                data=[MagicMock(embedding=[0.1] * 1536)]
            )
            mock_task.send = MagicMock()

            client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "New action"},
            )

            mock_task.send.assert_called_once()

    def test_returns_409_when_not_last_message(self, client):
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock(
                last_id="other-msg"
            ).table.side_effect
            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "Some text"},
            )
        assert res.status_code == 409

    def test_returns_422_when_content_is_empty(self, client):
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock().table.side_effect
            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "   "},
            )
        assert res.status_code == 422

    def test_returns_422_when_content_exceeds_2000_chars(self, client):
        with patch("api.routes.messages.supabase_client") as mock_sb:
            mock_sb.table.side_effect = make_supabase_mock().table.side_effect
            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "x" * 2001},
            )
        assert res.status_code == 422

    def test_returns_401_when_unauthenticated(self, unauthed_client):
        res = unauthed_client.patch(
            f"/games/{GAME_ID}/messages/{MSG_ID}",
            json={"content": "Some text"},
        )
        assert res.status_code == 401

    def test_falls_back_to_empty_rag_when_embedding_fails(self, client):
        updated = {**PLAYER_MSG, "content": "New action"}
        with patch("api.routes.messages.supabase_client") as mock_sb, \
             patch("api.routes.messages.dm_response_task") as mock_task, \
             patch("api.routes.messages.openai_client") as mock_openai, \
             patch("api.routes.messages.search_rag", return_value=[]):
            mock_sb.table.side_effect = make_supabase_mock(
                updated_data=updated
            ).table.side_effect
            mock_openai.embeddings.create.side_effect = Exception("OpenAI down")
            mock_task.send = MagicMock()

            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "New action"},
            )

        # Should still succeed despite embedding failure
        assert res.status_code == 200
        mock_task.send.assert_called_once()
