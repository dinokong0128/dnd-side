"""Tests for player inventory population and read endpoint."""

import pytest
from unittest.mock import MagicMock, patch

SAMPLE_GAME_LOBBY = {
    "id": "game-uuid-1",
    "name": "Dragon's Lair",
    "dm_persona": "A dark and mysterious DM.",
    "status": "lobby",
    "created_at": "2026-03-22T10:00:00Z",
    "created_by": "test-user-uuid-1234",
}

SAMPLE_UPSERT_RESULT = {
    "id": "player-uuid-1",
    "game_id": "game-uuid-1",
    "profile_id": "test-user-uuid-1234",
    "character_name": "Thorin",
    "character_class": "Fighter",
    "race": "Human",
    "level": 1,
    "hp_current": 12,
    "hp_max": 12,
    "stats": {"str": 16, "dex": 12, "con": 14, "int": 10, "wis": 10, "cha": 8},
    "status": "active",
    "joined_at": "2026-03-22T10:00:00Z",
}

SAMPLE_INVENTORY = [
    {
        "id": "inv-1",
        "player_id": "player-uuid-1",
        "item_name": "Chain Mail",
        "quantity": 1,
        "properties": None,
        "created_at": "2026-03-22T10:00:00Z",
    },
    {
        "id": "inv-2",
        "player_id": "player-uuid-1",
        "item_name": "Explorer's Pack",
        "quantity": 1,
        "properties": None,
        "created_at": "2026-03-22T10:00:00Z",
    },
    {
        "id": "inv-3",
        "player_id": "player-uuid-1",
        "item_name": "Handaxe",
        "quantity": 5,
        "properties": None,
        "created_at": "2026-03-22T10:00:00Z",
    },
    {
        "id": "inv-4",
        "player_id": "player-uuid-1",
        "item_name": "Longsword",
        "quantity": 1,
        "properties": None,
        "created_at": "2026-03-22T10:00:00Z",
    },
    {
        "id": "inv-5",
        "player_id": "player-uuid-1",
        "item_name": "Shield",
        "quantity": 1,
        "properties": None,
        "created_at": "2026-03-22T10:00:00Z",
    },
]

PLAYER_POST_BODY = {
    "character_name": "Thorin",
    "character_class": "Fighter",
    "stats": {"str": 16, "dex": 12, "con": 14, "int": 10, "wis": 10, "cha": 8},
}


def _make_table_router(games_mock, players_mock, inventory_mock):
    """Return a side_effect function that routes table() calls by name."""

    def table_router(name):
        return {
            "games": games_mock,
            "players": players_mock,
            "player_inventory": inventory_mock,
        }[name]

    return table_router


class TestInventoryPopulation:
    """Tests for inventory population during player upsert."""

    def test_upsert_player_populates_inventory_for_fighter(self, client):
        """Should delete old inventory and insert Fighter starting items after upsert."""
        # Games table mock
        games_mock = MagicMock()
        game_result = MagicMock()
        game_result.data = SAMPLE_GAME_LOBBY
        games_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
            game_result
        )

        # Players table mock
        players_mock = MagicMock()
        upsert_result = MagicMock()
        upsert_result.data = SAMPLE_UPSERT_RESULT
        players_mock.upsert.return_value.select.return_value.single.return_value.execute.return_value = (
            upsert_result
        )

        # Inventory table mock
        inventory_mock = MagicMock()
        delete_result = MagicMock()
        delete_result.data = []
        inventory_mock.delete.return_value.eq.return_value.execute.return_value = (
            delete_result
        )
        insert_result = MagicMock()
        insert_result.data = SAMPLE_INVENTORY
        inventory_mock.insert.return_value.execute.return_value = insert_result

        with patch("api.routes.players.supabase_client") as mock_sb:
            mock_sb.table.side_effect = _make_table_router(
                games_mock, players_mock, inventory_mock
            )

            response = client.post("/games/game-uuid-1/players", json=PLAYER_POST_BODY)

        assert response.status_code == 200
        assert response.json()["character_class"] == "Fighter"

        # Verify inventory delete was called
        inventory_mock.delete.assert_called_once()
        # Verify inventory insert was called with 5 Fighter items
        inventory_mock.insert.assert_called_once()
        inserted_rows = inventory_mock.insert.call_args[0][0]
        assert len(inserted_rows) == 5
        item_names = {row["item_name"] for row in inserted_rows}
        assert "Longsword" in item_names
        assert "Shield" in item_names
        assert "Chain Mail" in item_names

    def test_upsert_player_inventory_failure_does_not_crash(self, client):
        """Inventory population failure should not prevent player upsert from succeeding."""
        # Games table mock
        games_mock = MagicMock()
        game_result = MagicMock()
        game_result.data = SAMPLE_GAME_LOBBY
        games_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
            game_result
        )

        # Players table mock
        players_mock = MagicMock()
        upsert_result = MagicMock()
        upsert_result.data = SAMPLE_UPSERT_RESULT
        players_mock.upsert.return_value.select.return_value.single.return_value.execute.return_value = (
            upsert_result
        )

        # Inventory table mock — delete raises an exception
        inventory_mock = MagicMock()
        inventory_mock.delete.return_value.eq.return_value.execute.side_effect = (
            Exception("DB error")
        )

        with patch("api.routes.players.supabase_client") as mock_sb:
            mock_sb.table.side_effect = _make_table_router(
                games_mock, players_mock, inventory_mock
            )

            response = client.post("/games/game-uuid-1/players", json=PLAYER_POST_BODY)

        # Should still succeed — inventory is best-effort
        assert response.status_code == 200
        assert response.json()["character_name"] == "Thorin"


class TestGetPlayerInventory:
    """Tests for GET /games/{game_id}/players/inventory."""

    def test_get_inventory_success(self, client):
        """Should return inventory items for the current player."""
        # Players table mock
        players_mock = MagicMock()
        player_result = MagicMock()
        player_result.data = {"id": "player-uuid-1"}
        players_mock.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
            player_result
        )

        # Inventory table mock
        inventory_mock = MagicMock()
        inv_result = MagicMock()
        inv_result.data = SAMPLE_INVENTORY
        inventory_mock.select.return_value.eq.return_value.order.return_value.execute.return_value = (
            inv_result
        )

        with patch("api.routes.players.supabase_client") as mock_sb:
            mock_sb.table.side_effect = lambda name: {
                "players": players_mock,
                "player_inventory": inventory_mock,
            }[name]

            response = client.get("/games/game-uuid-1/players/inventory")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
        assert data[0]["item_name"] == "Chain Mail"

    def test_get_inventory_no_player_returns_empty(self, client):
        """Should return empty array when player not found in game."""
        players_mock = MagicMock()
        player_result = MagicMock()
        player_result.data = None
        players_mock.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
            player_result
        )

        with patch("api.routes.players.supabase_client") as mock_sb:
            mock_sb.table.side_effect = lambda name: {"players": players_mock}[name]

            response = client.get("/games/game-uuid-1/players/inventory")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_inventory_unauthorized(self, unauthed_client):
        """Should return 401 when no auth token is provided."""
        response = unauthed_client.get("/games/game-uuid-1/players/inventory")
        assert response.status_code == 401


class TestSpellSlotsOnUpsert:
    """DIN-27: spell_slots populated in players.stats on upsert."""

    def test_wizard_upsert_includes_spell_slots_in_stats(self, client):
        """Wizard character creation must populate spell_slots in stats."""
        # Games table mock
        games_mock = MagicMock()
        game_result = MagicMock()
        game_result.data = SAMPLE_GAME_LOBBY
        games_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = game_result

        # Players table mock — capture the upsert payload
        captured_stats = {}

        players_mock = MagicMock()
        wizard_result = MagicMock()
        wizard_result.data = {
            **SAMPLE_UPSERT_RESULT,
            "character_class": "Wizard",
            "stats": {"str": 8, "dex": 14, "con": 12, "int": 18, "wis": 12, "cha": 10,
                      "spell_slots": {"1": {"max": 2, "used": 0}, "2": {"max": 0, "used": 0}, "3": {"max": 0, "used": 0}}},
        }

        def upsert_side_effect(payload, **kwargs):
            captured_stats.update(payload)
            m = MagicMock()
            m.select.return_value.single.return_value.execute.return_value = wizard_result
            return m

        players_mock.upsert.side_effect = upsert_side_effect

        inventory_mock = MagicMock()
        inventory_mock.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        inventory_mock.insert.return_value.execute.return_value = MagicMock(data=[])

        with patch("api.routes.players.supabase_client") as mock_sb:
            mock_sb.table.side_effect = _make_table_router(
                games_mock, players_mock, inventory_mock
            )
            response = client.post(
                "/games/game-uuid-1/players",
                json={
                    "character_name": "Elara",
                    "character_class": "Wizard",
                    "stats": {"str": 8, "dex": 14, "con": 12, "int": 18, "wis": 12, "cha": 10},
                },
            )

        assert response.status_code == 200
        stats = captured_stats.get("stats", {})
        assert "spell_slots" in stats, "spell_slots must be in stats for Wizard"
        assert stats["spell_slots"] is not None
        assert "1" in stats["spell_slots"]
        assert stats["spell_slots"]["1"]["max"] == 2

    def test_fighter_upsert_has_null_spell_slots(self, client):
        """Fighter upsert should set spell_slots to None in stats."""
        games_mock = MagicMock()
        game_result = MagicMock()
        game_result.data = SAMPLE_GAME_LOBBY
        games_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = game_result

        captured_stats = {}

        players_mock = MagicMock()
        fighter_result = MagicMock()
        fighter_result.data = SAMPLE_UPSERT_RESULT

        def upsert_side_effect(payload, **kwargs):
            captured_stats.update(payload)
            m = MagicMock()
            m.select.return_value.single.return_value.execute.return_value = fighter_result
            return m

        players_mock.upsert.side_effect = upsert_side_effect

        inventory_mock = MagicMock()
        inventory_mock.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        inventory_mock.insert.return_value.execute.return_value = MagicMock(data=[])

        with patch("api.routes.players.supabase_client") as mock_sb:
            mock_sb.table.side_effect = _make_table_router(
                games_mock, players_mock, inventory_mock
            )
            response = client.post(
                "/games/game-uuid-1/players",
                json=PLAYER_POST_BODY,  # Fighter
            )

        assert response.status_code == 200
        stats = captured_stats.get("stats", {})
        assert "spell_slots" in stats, "spell_slots key must exist in stats for all classes"
        assert stats["spell_slots"] is None, "Fighter should have spell_slots=None"
