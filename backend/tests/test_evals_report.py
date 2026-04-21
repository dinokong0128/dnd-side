"""Tests for the markdown report generator (DIN-68) — filesystem only."""

import pytest
from pathlib import Path
from evals.schema import RunReport, ScenarioResult, TurnResult, DMResponse
from evals.report import generate_report


class TestGenerateReport:
    """Tests for generate_report: renders RunReport to markdown string."""

    def _make_run_report(self) -> RunReport:
        dm_response = DMResponse(
            narration="You pick the lock successfully.",
            state_updates={},
            metadata={"retrieved_event_ids": [], "tokens_used": 100, "latency_ms": 450},
        )
        turn_result = TurnResult(
            turn_index=0,
            dm_response=dm_response,
            rubric_scores={
                "rule_compliance": 4.0,
                "narrative_coherence": 5.0,
                "state_correctness": None,
                "hallucination": 5.0,
                "voice_consistency": 4.0,
            },
            rubric_samples={
                "rule_compliance": [4, 4, 4],
                "narrative_coherence": [5, 5, 5],
                "state_correctness": ["N/A", "N/A", "N/A"],
                "hallucination": [5, 5, 5],
                "voice_consistency": [4, 4, 4],
            },
            adversarial_results=[],
        )
        scenario_result = ScenarioResult(
            scenario_id="skill_lockpick_basic",
            turn_results=[turn_result],
            continuity_score=None,
            adversarial_gate_passed=True,
            errors=[],
        )
        return RunReport(
            run_id="2026-04-21T00:00:00",
            target_name="current",
            model="claude-sonnet-4-20250514",
            scenario_results=[scenario_result],
            aggregate={
                "rule_compliance_mean": 4.0,
                "narrative_coherence_mean": 5.0,
                "adversarial_gate_pass_count": 0,
                "adversarial_gate_fail_count": 0,
            },
        )

    def test_report_contains_run_id(self):
        """Generated markdown includes the run ID."""
        report = self._make_run_report()
        md = generate_report(report)
        assert "2026-04-21T00:00:00" in md

    def test_report_contains_scenario_id(self):
        """Generated markdown includes scenario ID in per-scenario section."""
        report = self._make_run_report()
        md = generate_report(report)
        assert "skill_lockpick_basic" in md

    def test_report_contains_axis_scores(self):
        """Generated markdown includes axis mean scores."""
        report = self._make_run_report()
        md = generate_report(report)
        assert "rule_compliance" in md

    def test_report_contains_dm_excerpt(self):
        """Generated markdown includes first 200 chars of DM narration."""
        report = self._make_run_report()
        md = generate_report(report)
        assert "You pick the lock successfully" in md

    def test_report_writes_to_file(self, tmp_path):
        """generate_report can write output to a file path."""
        report = self._make_run_report()
        out_file = tmp_path / "run_test.md"
        generate_report(report, output_path=out_file)
        assert out_file.exists()
        assert "skill_lockpick_basic" in out_file.read_text()
