"""Tests for the eval runner (DIN-68)."""

import asyncio
import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock, call

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
        TurnResult,
    )
    from evals.runner import load_scenarios, _compute_aggregate, update_baseline, _parse_baseline


class TestScenarioSchema:
    """Schema validation tests."""

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


class TestComputeAggregate:
    """Tests for _compute_aggregate."""

    def _make_turn_result(self, scores: dict) -> TurnResult:
        return TurnResult(
            turn_index=0,
            dm_response=DMResponse(narration="Test.", state_updates={}, metadata={}),
            rubric_scores=scores,
            rubric_samples={axis: [] for axis in scores},
        )

    def test_axis_means_computed(self):
        """Per-axis means calculated correctly across multiple turn results."""
        sr = ScenarioResult(
            scenario_id="test",
            turn_results=[
                self._make_turn_result({"rule_compliance": 4.0, "narrative_coherence": 5.0,
                                        "state_correctness": None, "hallucination": 3.0, "voice_consistency": 4.0}),
                self._make_turn_result({"rule_compliance": 2.0, "narrative_coherence": 3.0,
                                        "state_correctness": None, "hallucination": 5.0, "voice_consistency": 4.0}),
            ],
        )
        agg = _compute_aggregate([sr])
        assert abs(agg["rule_compliance_mean"] - 3.0) < 0.01
        assert abs(agg["narrative_coherence_mean"] - 4.0) < 0.01
        assert agg["state_correctness_mean"] is None

    def test_adversarial_gate_counts(self):
        """Adversarial gate pass/fail counts are correct."""
        sr1 = ScenarioResult(scenario_id="s1", adversarial_gate_passed=True)
        sr2 = ScenarioResult(scenario_id="s2", adversarial_gate_passed=False)
        agg = _compute_aggregate([sr1, sr2])
        assert agg["adversarial_gate_pass_count"] == 1
        assert agg["adversarial_gate_fail_count"] == 1


class TestUpdateBaseline:
    """Tests for update_baseline."""

    def test_copies_run_to_baseline(self, tmp_path):
        """update_baseline copies run file to baseline.md."""
        run_id = "2026-04-21T00-00-00"
        run_file = tmp_path / f"run_{run_id}.md"
        run_file.write_text("# Report\n\nContent here.")

        report = RunReport(
            run_id=run_id,
            target_name="current",
            model="claude-sonnet-4-20250514",
            scenario_results=[],
            aggregate={},
        )
        update_baseline(report, tmp_path, reason="Initial baseline")

        baseline = tmp_path / "baseline.md"
        assert baseline.exists()
        assert "Content here." in baseline.read_text()

    def test_creates_baseline_history(self, tmp_path):
        """update_baseline creates baseline_history.md with reason entry."""
        run_id = "2026-04-21T00-00-00"
        (tmp_path / f"run_{run_id}.md").write_text("# Report")

        report = RunReport(
            run_id=run_id,
            target_name="current",
            model="claude-sonnet-4-20250514",
            scenario_results=[],
            aggregate={},
        )
        update_baseline(report, tmp_path, reason="Test reason")

        history = tmp_path / "baseline_history.md"
        assert history.exists()
        assert "Test reason" in history.read_text()


class TestParseBaseline:
    """Tests for _parse_baseline — ensures it only reads the aggregate section."""

    def _write_baseline(self, tmp_path, content: str) -> Path:
        p = tmp_path / "baseline.md"
        p.write_text(content)
        return p

    def test_reads_aggregate_axis_means(self, tmp_path):
        """Parses axis scores from the aggregate table."""
        md = (
            "# Eval Run Report\n\n"
            "## Aggregate Scores\n\n"
            "| Axis | Mean Score | vs Baseline |\n"
            "|------|-----------|-------------|\n"
            "| rule_compliance | 4.50 | — |\n"
            "| narrative_coherence | 3.80 | — |\n"
            "| state_correctness | N/A | — |\n"
            "| hallucination | 4.00 | — |\n"
            "| voice_consistency | 4.20 | — |\n\n"
            "## Per-Scenario Results\n\n"
            "### skill_lockpick_basic\n\n"
            "#### Turn 1\n\n"
            "| Axis | Score | Samples |\n"
            "|------|-------|---------- |\n"
            "| rule_compliance | 5.00 | 5, 5, 5 |\n"
            "| narrative_coherence | 2.00 | 2, 2, 2 |\n"
        )
        baseline_path = self._write_baseline(tmp_path, md)
        result = _parse_baseline(baseline_path)
        assert abs(result["rule_compliance"] - 4.50) < 0.01
        assert abs(result["narrative_coherence"] - 3.80) < 0.01

    def test_stops_at_per_scenario_section(self, tmp_path):
        """Per-turn rows after ## Per-Scenario Results do NOT overwrite aggregate values."""
        md = (
            "## Aggregate Scores\n\n"
            "| rule_compliance | 4.50 | — |\n"
            "| narrative_coherence | 3.80 | — |\n\n"
            "## Per-Scenario Results\n\n"
            "| rule_compliance | 1.00 | 1, 1, 1 |\n"
            "| narrative_coherence | 1.00 | 1, 1, 1 |\n"
        )
        baseline_path = self._write_baseline(tmp_path, md)
        result = _parse_baseline(baseline_path)
        # Must use aggregate values, not per-turn values
        assert abs(result["rule_compliance"] - 4.50) < 0.01
        assert abs(result["narrative_coherence"] - 3.80) < 0.01

    def test_returns_empty_dict_if_no_aggregate_section(self, tmp_path):
        """Returns empty dict when baseline has no aggregate section."""
        md = "# Some Report\n\nNo tables here.\n"
        baseline_path = self._write_baseline(tmp_path, md)
        result = _parse_baseline(baseline_path)
        assert result == {}
