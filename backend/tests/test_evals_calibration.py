"""Tests for calibration agreement math (DIN-68) — pure math, no mocks."""

import pytest
from evals.calibration import compute_agreement, CalibrationResult


class TestComputeAgreement:
    """Tests for calibration agreement computation."""

    def test_perfect_agreement(self):
        """100% agreement when judge and human scores are identical."""
        human = {("r1", "rule_compliance"): 4, ("r1", "narrative_coherence"): 3}
        judge = {("r1", "rule_compliance"): 4.0, ("r1", "narrative_coherence"): 3.0}
        result = compute_agreement(human, judge)
        assert result.overall_pct >= 100.0

    def test_agreement_within_one_point(self):
        """Pair with judge=4.0, human=3 is within ±1 so counted as agreeing."""
        human = {("r1", "rule_compliance"): 3}
        judge = {("r1", "rule_compliance"): 4.0}
        result = compute_agreement(human, judge)
        assert result.overall_pct >= 100.0

    def test_disagreement_beyond_one_point(self):
        """Pair with judge=5.0, human=2 is > ±1 so counted as disagreeing."""
        human = {("r1", "rule_compliance"): 2}
        judge = {("r1", "rule_compliance"): 5.0}
        result = compute_agreement(human, judge)
        assert result.overall_pct == 0.0

    def test_na_excluded_from_both_sides(self):
        """Pairs where both sides are N/A are skipped, not counted."""
        human = {("r1", "rule_compliance"): "N/A"}
        judge = {("r1", "rule_compliance"): "N/A"}
        result = compute_agreement(human, judge)
        assert result.total_pairs == 0

    def test_na_on_one_side_is_disagreement(self):
        """N/A on one side but integer on the other counts as disagreement."""
        human = {("r1", "rule_compliance"): 4}
        judge = {("r1", "rule_compliance"): "N/A"}
        result = compute_agreement(human, judge)
        assert result.overall_pct == 0.0

    def test_pass_criteria_met(self):
        """CalibrationResult.passed is True when ≥80% agreement and no bias > 0.5."""
        human = {(f"r{i}", "rule_compliance"): 4 for i in range(10)}
        judge = {(f"r{i}", "rule_compliance"): 4.0 for i in range(10)}
        result = compute_agreement(human, judge)
        assert result.passed is True

    def test_fail_when_agreement_below_80pct(self):
        """CalibrationResult.passed is False when agreement < 80%."""
        human = {}
        judge = {}
        for i in range(8):
            human[(f"r{i}", "rule_compliance")] = 5
            judge[(f"r{i}", "rule_compliance")] = 1.0  # disagree
        for i in range(8, 10):
            human[(f"r{i}", "rule_compliance")] = 4
            judge[(f"r{i}", "rule_compliance")] = 4.0  # agree
        result = compute_agreement(human, judge)
        assert result.passed is False

    def test_per_axis_bias_computed(self):
        """Per-axis bias = mean(judge - human) for non-N/A pairs."""
        human = {("r1", "narrative_coherence"): 3, ("r2", "narrative_coherence"): 3}
        judge = {("r1", "narrative_coherence"): 4.0, ("r2", "narrative_coherence"): 4.0}
        result = compute_agreement(human, judge)
        assert abs(result.per_axis_bias.get("narrative_coherence", 0) - 1.0) < 0.01
