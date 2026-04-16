"""Tests for DIN-27: SPELL_SLOTS_BY_CLASS_LEVEL and get_spell_slots helper."""

import pytest

from utils.dnd import SPELL_SLOTS_BY_CLASS_LEVEL, get_spell_slots


class TestSpellSlotsByClassLevel:
    """Structural tests for the SPELL_SLOTS_BY_CLASS_LEVEL lookup table."""

    def test_wizard_level_1_has_two_first_level_slots(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["wizard"][1][1] == 2

    def test_wizard_level_3_has_second_level_slots(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["wizard"][3][2] == 2

    def test_wizard_level_5_has_third_level_slots(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["wizard"][5][3] == 2

    def test_full_casters_identical_to_wizard(self):
        """Cleric, Druid, Sorcerer, Bard share the same progression as Wizard."""
        for cls in ("cleric", "druid", "sorcerer", "bard"):
            assert SPELL_SLOTS_BY_CLASS_LEVEL[cls] == SPELL_SLOTS_BY_CLASS_LEVEL["wizard"], \
                f"{cls} progression should match wizard"

    def test_paladin_level_1_has_no_slots(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["paladin"][1] == {}

    def test_paladin_level_2_gains_slots(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["paladin"][2][1] == 2

    def test_ranger_level_1_has_no_slots(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["ranger"][1] == {}

    def test_warlock_level_1_has_one_slot(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["warlock"][1][1] == 1

    def test_warlock_level_3_upgrades_to_second_level_slots(self):
        assert SPELL_SLOTS_BY_CLASS_LEVEL["warlock"][3][2] == 2
        assert 1 not in SPELL_SLOTS_BY_CLASS_LEVEL["warlock"][3]

    def test_non_casters_are_none(self):
        for cls in ("fighter", "barbarian", "rogue", "monk"):
            assert SPELL_SLOTS_BY_CLASS_LEVEL[cls] is None, \
                f"{cls} should be None (non-caster)"


class TestGetSpellSlots:
    """Tests for get_spell_slots(character_class, level)."""

    def test_wizard_level_1_returns_two_first_slots(self):
        result = get_spell_slots("Wizard", 1)
        assert result == {1: 2}

    def test_wizard_level_3_returns_first_and_second(self):
        result = get_spell_slots("Wizard", 3)
        assert result == {1: 4, 2: 2}

    def test_case_insensitive_lookup(self):
        """Should accept 'Fighter', 'fighter', 'FIGHTER' all as the same class."""
        assert get_spell_slots("Fighter", 1) is None
        assert get_spell_slots("fighter", 1) is None
        assert get_spell_slots("FIGHTER", 1) is None

    def test_non_caster_returns_none(self):
        for cls in ("Fighter", "Barbarian", "Rogue", "Monk"):
            assert get_spell_slots(cls, 1) is None, f"Expected None for {cls}"

    def test_paladin_level_1_returns_empty_dict(self):
        """Paladin/Ranger with no slots yet should return {} (not None)."""
        result = get_spell_slots("Paladin", 1)
        assert result == {}

    def test_paladin_level_2_returns_slots(self):
        result = get_spell_slots("Paladin", 2)
        assert result == {1: 2}

    def test_warlock_level_3_pact_magic(self):
        result = get_spell_slots("Warlock", 3)
        assert result == {2: 2}

    def test_unknown_class_returns_none(self):
        assert get_spell_slots("Beastmaster", 1) is None

    def test_level_above_5_caps_at_5(self):
        """MVP only covers levels 1–5; levels beyond 5 should cap at 5."""
        result_5 = get_spell_slots("Wizard", 5)
        result_10 = get_spell_slots("Wizard", 10)
        assert result_5 == result_10
