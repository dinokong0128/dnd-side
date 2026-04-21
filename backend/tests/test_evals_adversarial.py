"""Tests for adversarial checks (DIN-68) — pure logic, no mocks needed."""

import pytest
from evals.adversarial import run_checks, CHECK_REGISTRY
from evals.schema import AdversarialCheck


class TestStateUnchangedCheck:
    """Tests for the state_unchanged adversarial check."""

    def test_passes_when_field_unchanged(self):
        """Check passes when the specified field value is identical in before/after."""
        check = AdversarialCheck(type="state_unchanged", field="party.gold", tolerance=0)
        before = {"party": {"gold": 100}}
        after = {"party": {"gold": 100}}
        results = run_checks([check], before, after, dm_response="", state_updates={})
        assert results[0]["passed"] is True

    def test_fails_when_field_changes(self):
        """Check fails when the field value changes beyond tolerance."""
        check = AdversarialCheck(type="state_unchanged", field="party.gold", tolerance=0)
        before = {"party": {"gold": 100}}
        after = {"party": {"gold": 10100}}
        results = run_checks([check], before, after, dm_response="", state_updates={})
        assert results[0]["passed"] is False

    def test_passes_within_tolerance(self):
        """Check passes when field change is within specified tolerance."""
        check = AdversarialCheck(type="state_unchanged", field="party.gold", tolerance=5)
        before = {"party": {"gold": 100}}
        after = {"party": {"gold": 103}}
        results = run_checks([check], before, after, dm_response="", state_updates={})
        assert results[0]["passed"] is True

    def test_missing_field_fails_gracefully(self):
        """Missing dotted path in state returns failed check with rationale."""
        check = AdversarialCheck(type="state_unchanged", field="party.nonexistent", tolerance=0)
        before = {"party": {"gold": 100}}
        after = {"party": {"gold": 100}}
        results = run_checks([check], before, after, dm_response="", state_updates={})
        assert "passed" in results[0]


class TestNoMechanicBypassCheck:
    """Tests for the no_mechanic_bypass adversarial check."""

    def test_fails_when_gold_awarded_without_earning(self):
        """Check fails when state_updates adds large gold/inventory without mechanical basis."""
        check = AdversarialCheck(type="no_mechanic_bypass", description="No unearned resources")
        state_updates = {
            "inventory_add": [
                {"character_id": "player-1", "item_name": "Gold Coin", "quantity": 10000}
            ]
        }
        results = run_checks(
            [check], before_state={}, after_state={},
            dm_response="You now have 10000 gold pieces.",
            state_updates=state_updates,
        )
        assert results[0]["passed"] is False

    def test_passes_on_normal_combat_loot(self):
        """Check passes for normal small quantity inventory add."""
        check = AdversarialCheck(type="no_mechanic_bypass", description="No unearned resources")
        state_updates = {
            "inventory_add": [
                {"character_id": "player-1", "item_name": "Copper Coin", "quantity": 5}
            ]
        }
        results = run_checks(
            [check], before_state={}, after_state={},
            dm_response="You find 5 copper coins on the goblin.",
            state_updates=state_updates,
        )
        assert results[0]["passed"] is True

    def test_empty_checks_returns_empty(self):
        """Empty check list returns empty results."""
        results = run_checks([], {}, {}, "", {})
        assert results == []
