"""Tests for POST /games/{game_id}/level-up endpoint (DIN-28)."""

import pytest
from unittest.mock import MagicMock, patch


FIGHTER_PLAYER = {
    "id": "player-1",
    "game_id": "game-1",
    "profile_id": "test-user-uuid-1234",  # matches conftest mock_auth_user
    "character_name": "Thorin",
    "character_class": "Fighter",
    "level": 1,
    "hp_current": 12,
    "hp_max": 12,
    "stats": {"str": 18, "dex": 10, "con": 16, "int": 8, "wis": 12, "cha": 9, "xp": 300},
}

WIZARD_PLAYER = {
    "id": "player-2",
    "game_id": "game-1",
    "profile_id": "test-user-uuid-1234",
    "character_name": "Elara",
    "character_class": "Wizard",
    "level": 1,
    "hp_current": 7,
    "hp_max": 7,
    "stats": {"str": 8, "dex": 14, "con": 6, "int": 18, "wis": 12, "cha": 10, "xp": 300},
}


class TestLevelUpEndpoint:
    """Tests for POST /games/{game_id}/level-up."""

    def test_level_up_increments_level_and_hp(self, client, mock_supabase):
        """Successful roll path: level, hp_max, hp_current all increase correctly."""
        # Fighter: hit die d10. CON 16 → mod +3. Server rolls 8 → hp_gain = 8+3 = 11.
        with patch("api.routes.level_up.supabase_client") as mock_sb, \
             patch("random.randint", return_value=8):
            mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value \
                .maybe_single.return_value.execute.return_value = MagicMock(data=FIGHTER_PLAYER)
            mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = \
                MagicMock(data={**FIGHTER_PLAYER, "level": 2, "hp_max": 23, "hp_current": 23})

            response = client.post(
                "/games/game-1/level-up",
                json={"character_id": "player-1", "hp_choice": "roll"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["level"] == 2
        assert data["hp_gained"] == 11   # 8 roll + 3 CON
        assert data["hp_max"] == 23      # 12 + 11

    def test_hp_gain_minimum_1(self, client, mock_supabase):
        """hp_gain floors at 1 even with roll=1 and negative CON modifier."""
        # Wizard: d6, CON 6 → mod -2. Roll 1 → max(1, 1-2) = max(1, -1) = 1.
        with patch("api.routes.level_up.supabase_client") as mock_sb, \
             patch("random.randint", return_value=1):
            mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value \
                .maybe_single.return_value.execute.return_value = MagicMock(data=WIZARD_PLAYER)
            mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = \
                MagicMock(data={**WIZARD_PLAYER, "level": 2, "hp_max": 8, "hp_current": 8})

            response = client.post(
                "/games/game-1/level-up",
                json={"character_id": "player-2", "hp_choice": "roll"},
            )

        assert response.status_code == 200
        assert response.json()["hp_gained"] == 1

    def test_server_roll_uses_class_hit_die(self, client, mock_supabase):
        """Server calls random.randint(1, hit_die_sides) — never trusts client roll."""
        with patch("api.routes.level_up.supabase_client") as mock_sb, \
             patch("random.randint") as mock_randint:
            mock_randint.return_value = 6
            mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value \
                .maybe_single.return_value.execute.return_value = MagicMock(data=FIGHTER_PLAYER)
            mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = \
                MagicMock(data={**FIGHTER_PLAYER, "level": 2, "hp_max": 21, "hp_current": 21})

            client.post(
                "/games/game-1/level-up",
                json={"character_id": "player-1", "hp_choice": "roll"},
            )

        # Fighter hit die = d10
        mock_randint.assert_called_once_with(1, 10)

    def test_caller_must_own_character(self, client, mock_supabase):
        """Returns 403 when the character belongs to a different user."""
        other_player = {**FIGHTER_PLAYER, "profile_id": "another-user-uuid"}

        with patch("api.routes.level_up.supabase_client") as mock_sb:
            mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value \
                .maybe_single.return_value.execute.return_value = MagicMock(data=other_player)

            response = client.post(
                "/games/game-1/level-up",
                json={"character_id": "player-1", "hp_choice": "roll"},
            )

        assert response.status_code == 403
