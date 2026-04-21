"""Tests for the eval runner (DIN-68)."""

import pytest
from unittest.mock import MagicMock, patch

# Guard imports to avoid real API client initialization
with patch("config.supabase_client", MagicMock()), \
     patch("config.anthropic_client", MagicMock()), \
     patch("config.openai_client", MagicMock()):
    from evals.schema import (
        Scenario,
        Turn,
        SeedEvent,
        AdversarialCheck,
        DMResponse,
        ScenarioResult,
        RunReport,
    )


class TestScenarioSchema:
    """Schema validation tests — must be green before runner implementation."""

    def test_valid_single_turn_scenario(self):
        """A minimal single-turn scenario parses correctly."""
        data = {
            "id": "skill_lockpick_basic",
            "category": "skill_check",
            "description": "Player attempts to pick a lock.",
            "seed_state_file": "fixtures/states/tavern_low_level.json",
            "seed_events": [],
            "turns": [
                {
                    "action": "I try to pick the lock with my thieves' tools.",
                    "expected_capabilities": ["skill_check"],
                }
            ],
            "adversarial_checks": [],
        }
        scenario = Scenario.model_validate(data)
        assert scenario.id == "skill_lockpick_basic"
        assert len(scenario.turns) == 1

    def test_valid_multi_turn_scenario(self):
        """A multi-turn scenario with seed events parses correctly."""
        data = {
            "id": "continuity_iron_key_recall",
            "category": "continuity",
            "description": "Player finds a key and uses it later.",
            "seed_state_file": "fixtures/states/mid_campaign_dungeon.json",
            "seed_events": [
                {"turn_offset": -15, "content": "Party found an iron key."},
            ],
            "turns": [
                {
                    "action": "I examine the door for a keyhole.",
                    "expected_capabilities": ["perception_check"],
                },
                {
                    "action": "I try the iron key on the door.",
                    "expected_capabilities": ["rag_recall", "narrative_payoff"],
                },
            ],
            "adversarial_checks": [],
        }
        scenario = Scenario.model_validate(data)
        assert len(scenario.turns) == 2
        assert scenario.seed_events[0].turn_offset == -15

    def test_scenario_requires_at_least_one_turn(self):
        """Scenario with empty turns list fails validation."""
        data = {
            "id": "bad_scenario",
            "category": "skill_check",
            "description": "No turns.",
            "seed_state_file": "fixtures/states/tavern_low_level.json",
            "seed_events": [],
            "turns": [],
            "adversarial_checks": [],
        }
        with pytest.raises(Exception):
            Scenario.model_validate(data)

    def test_seed_event_requires_negative_turn_offset(self):
        """SeedEvent with non-negative turn_offset fails validation."""
        with pytest.raises(Exception):
            SeedEvent.model_validate({"turn_offset": 0, "content": "Bad event."})

    def test_invalid_category_rejected(self):
        """Scenario with unknown category fails validation."""
        data = {
            "id": "bad_cat",
            "category": "not_a_real_category",
            "description": "Test.",
            "seed_state_file": "fixtures/states/tavern_low_level.json",
            "seed_events": [],
            "turns": [{"action": "Do something.", "expected_capabilities": []}],
            "adversarial_checks": [],
        }
        with pytest.raises(Exception):
            Scenario.model_validate(data)

    def test_adversarial_check_state_unchanged(self):
        """AdversarialCheck of type state_unchanged parses correctly."""
        check = AdversarialCheck.model_validate(
            {"type": "state_unchanged", "field": "party.gold", "tolerance": 0}
        )
        assert check.type == "state_unchanged"
        assert check.field == "party.gold"

    def test_dm_response_structure(self):
        """DMResponse parses with required fields."""
        response = DMResponse.model_validate(
            {
                "narration": "You deftly pick the lock.",
                "state_updates": {},
                "metadata": {
                    "retrieved_event_ids": [],
                    "tokens_used": 100,
                    "latency_ms": 500,
                },
            }
        )
        assert response.narration == "You deftly pick the lock."
        assert response.metadata["tokens_used"] == 100


class TestRunnerSeedAndTeardown:
    """Runner seeding and teardown behavior."""

    @pytest.mark.skip(reason="Pending runner implementation")
    def test_single_turn_seed_run_teardown(self):
        """Runner seeds DB, runs single turn, tears down all rows."""
        pass

    @pytest.mark.skip(reason="Pending runner implementation")
    def test_multi_turn_state_propagation(self):
        """Runner applies state updates between turns for multi-turn scenarios."""
        pass

    @pytest.mark.skip(reason="Pending runner implementation")
    def test_teardown_runs_on_exception(self):
        """Teardown executes even when target.respond raises."""
        pass

    @pytest.mark.skip(reason="Pending runner implementation")
    def test_parse_failure_uses_fallback_state(self):
        """When state parse fails in turn N, fallback_states entry is used for turn N+1."""
        pass
