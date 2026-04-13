"""Tests for messages route: DELETE and PATCH /games/{gameId}/messages/{messageId}."""

import pytest
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GAME_ID = "game-uuid-1"
MSG_ID = "msg-uuid-1"
USER_ID = "test-user-uuid-1234"

PLAYER_MSG = {
    "id": MSG_ID,
    "game_id": GAME_ID,
    "role": "player",
    "profile_id": USER_ID,
    "content": "I attack the goblin!",
    "created_at": "2026-04-10T10:00:00Z",
}

DM_MSG = {
    "id": "dm-msg-uuid",
    "game_id": GAME_ID,
    "role": "dm",
    "profile_id": None,
    "content": "The goblin dodges.",
    "created_at": "2026-04-10T10:01:00Z",
}


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _build_gm_mock(
    target_msg=PLAYER_MSG,
    last_msg_id=MSG_ID,
    following_msg=None,
    updated_msg=None,
):
    """Build a reusable game_messages mock with common chain stubs."""
    gm = MagicMock()

    # maybe_single — fetch by id+game_id
    gm.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data=target_msg
    )

    # order+limit — last message in game
    gm.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"id": last_msg_id}] if last_msg_id else []
    )

    # gt+order+limit — following DM message
    gm.select.return_value.eq.return_value.gt.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[following_msg] if following_msg else []
    )

    # delete chain
    gm.delete.return_value.eq.return_value.execute.return_value = MagicMock()

    # update+select+single (for PATCH)
    gm.update.return_value.eq.return_value.select.return_value.single.return_value.execute.return_value = MagicMock(
        data=updated_msg or PLAYER_MSG
    )

    return gm


def _make_supabase(gm):
    """Build a supabase_client mock that returns gm for game_messages calls."""
    sb = MagicMock()
    sb.table.side_effect = lambda name: gm if name == "game_messages" else MagicMock()
    return sb


# ---------------------------------------------------------------------------
# DELETE tests
# ---------------------------------------------------------------------------


class TestDeleteMessage:
    def test_happy_path_204(self, client):
        """DELETE the last player message → 204."""
        gm = _build_gm_mock()

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")

        assert res.status_code == 204

    def test_also_deletes_following_dm_message(self, client):
        """DELETE removes both the player message and any immediately following DM message."""
        gm = _build_gm_mock(following_msg=DM_MSG)

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")

        assert res.status_code == 204
        # delete() must be called for both the DM message and the player message
        assert gm.delete.call_count >= 2

    def test_409_when_not_last_message(self, client):
        """DELETE returns 409 when the message is not the last in the game."""
        gm = _build_gm_mock(last_msg_id="some-other-msg-id")

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")

        assert res.status_code == 409
        assert "last message" in res.json()["detail"].lower()

    def test_403_when_different_user(self, client):
        """DELETE returns 403 when message belongs to a different user."""
        other_msg = {**PLAYER_MSG, "profile_id": "other-user-uuid"}
        gm = _build_gm_mock(target_msg=other_msg)

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")

        assert res.status_code == 403

    def test_404_when_message_not_found(self, client):
        """DELETE returns 404 when message doesn't exist."""
        gm = _build_gm_mock(target_msg=None)

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")

        assert res.status_code == 404

    def test_403_when_message_is_not_player_role(self, client):
        """DELETE returns 403 when trying to delete a DM/system message."""
        dm_message = {**PLAYER_MSG, "role": "dm", "profile_id": None}
        gm = _build_gm_mock(target_msg=dm_message)

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")

        assert res.status_code == 403

    def test_401_unauthed(self, unauthed_client):
        """DELETE returns 401 when not authenticated."""
        gm = _build_gm_mock()

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = unauthed_client.delete(f"/games/{GAME_ID}/messages/{MSG_ID}")

        assert res.status_code == 401


# ---------------------------------------------------------------------------
# PATCH tests
# ---------------------------------------------------------------------------


class TestPatchMessage:
    def test_happy_path_200(self, client):
        """PATCH the last player message → 200 with updated message."""
        updated = {**PLAYER_MSG, "content": "I search for traps."}
        gm = _build_gm_mock(updated_msg=updated)

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)), patch(
            "api.routes.messages.dm_response_task"
        ) as mock_task, patch(
            "api.routes.messages.openai_client"
        ) as mock_openai, patch(
            "api.routes.messages.search_rag", return_value=[]
        ):
            mock_openai.embeddings.create.return_value = MagicMock(
                data=[MagicMock(embedding=[0.1] * 1536)]
            )
            mock_task.send = MagicMock()

            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "I search for traps."},
            )

        assert res.status_code == 200
        assert res.json()["content"] == "I search for traps."

    def test_dm_response_task_send_called(self, client):
        """PATCH calls dm_response_task.send with updated content."""
        gm = _build_gm_mock()

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)), patch(
            "api.routes.messages.dm_response_task"
        ) as mock_task, patch(
            "api.routes.messages.openai_client"
        ) as mock_openai, patch(
            "api.routes.messages.search_rag", return_value=[]
        ):
            mock_openai.embeddings.create.return_value = MagicMock(
                data=[MagicMock(embedding=[0.1] * 1536)]
            )
            mock_task.send = MagicMock()

            client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "I search for traps."},
            )

            mock_task.send.assert_called_once_with(
                game_id=GAME_ID,
                message_id=MSG_ID,
                action_text="I search for traps.",
                rag_context=[],
            )

    def test_409_when_not_last_message(self, client):
        """PATCH returns 409 when the message is not the last in the game."""
        gm = _build_gm_mock(last_msg_id="other-msg")

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "New content"},
            )

        assert res.status_code == 409

    def test_422_empty_content(self, client):
        """PATCH returns 422 when content is empty."""
        gm = _build_gm_mock()

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "   "},
            )

        assert res.status_code == 422

    def test_401_unauthed(self, unauthed_client):
        """PATCH returns 401 when not authenticated."""
        gm = _build_gm_mock()

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)):
            res = unauthed_client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "New content"},
            )

        assert res.status_code == 401

    def test_embedding_failure_falls_back_to_no_rag(self, client):
        """PATCH still queues DM task even if embedding fails."""
        gm = _build_gm_mock()

        with patch("api.routes.messages.supabase_client", _make_supabase(gm)), patch(
            "api.routes.messages.dm_response_task"
        ) as mock_task, patch(
            "api.routes.messages.openai_client"
        ) as mock_openai, patch(
            "api.routes.messages.search_rag", return_value=[]
        ):
            mock_openai.embeddings.create.side_effect = Exception("Embedding unavailable")
            mock_task.send = MagicMock()

            res = client.patch(
                f"/games/{GAME_ID}/messages/{MSG_ID}",
                json={"content": "I cast magic missile."},
            )

        assert res.status_code == 200
        mock_task.send.assert_called_once_with(
            game_id=GAME_ID,
            message_id=MSG_ID,
            action_text="I cast magic missile.",
            rag_context=[],
        )
