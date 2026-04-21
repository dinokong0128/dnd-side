"""Judge calibration: compare judge scores vs human scores."""

import argparse
import json
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class CalibrationResult:
    overall_pct: float
    total_pairs: int
    agreed_pairs: int
    per_axis_bias: dict[str, float]
    passed: bool


def compute_agreement(
    human_scores: dict[tuple, int | str],
    judge_scores: dict[tuple, float | str],
) -> CalibrationResult:
    """
    Compute agreement between human and judge scores.

    Keys are (response_id, axis) tuples.
    Values are int (1–5) for human, float (1.0–5.0) for judge, or "N/A".

    Agreement = % of pairs where |judge - human| <= 1.
    Both-N/A pairs are skipped entirely.
    One-side-N/A pairs count as disagreements.

    Pass criteria:
      - overall_pct >= 80.0
      - no per-axis bias > 0.5
    """
    all_keys = set(human_scores.keys()) | set(judge_scores.keys())
    agreed = 0
    total = 0
    axis_diffs: dict[str, list[float]] = {}

    for key in all_keys:
        h = human_scores.get(key, "N/A")
        j = judge_scores.get(key, "N/A")

        if h == "N/A" and j == "N/A":
            continue  # skip both-N/A

        total += 1

        if h == "N/A" or j == "N/A":
            # one side is N/A → disagree, no bias contribution
            continue

        h_float = float(h)
        j_float = float(j)
        diff = abs(j_float - h_float)
        if diff <= 1.0:
            agreed += 1

        _, axis = key
        axis_diffs.setdefault(axis, []).append(j_float - h_float)

    overall_pct = (agreed / total * 100.0) if total > 0 else 0.0

    per_axis_bias: dict[str, float] = {}
    for axis, diffs in axis_diffs.items():
        per_axis_bias[axis] = sum(diffs) / len(diffs)

    max_bias = max((abs(b) for b in per_axis_bias.values()), default=0.0)
    passed = overall_pct >= 80.0 and max_bias <= 0.5

    return CalibrationResult(
        overall_pct=overall_pct,
        total_pairs=total,
        agreed_pairs=agreed,
        per_axis_bias=per_axis_bias,
        passed=passed,
    )


def run_calibration(human_path: Path, judge_path: Path) -> CalibrationResult:
    """Load score files and compute calibration result."""
    human_raw = json.loads(human_path.read_text())
    judge_raw = json.loads(judge_path.read_text())

    human_scores = {(k["response_id"], k["axis"]): k["score"] for k in human_raw}
    judge_scores = {(k["response_id"], k["axis"]): k["score"] for k in judge_raw}

    return compute_agreement(human_scores, judge_scores)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run judge calibration check")
    parser.add_argument("--human", required=True, type=Path)
    parser.add_argument("--judge", required=True, type=Path)
    args = parser.parse_args()

    result = run_calibration(args.human, args.judge)
    print(f"Overall agreement: {result.overall_pct:.1f}% ({result.agreed_pairs}/{result.total_pairs})")
    print(f"Per-axis bias: {result.per_axis_bias}")
    print(f"Passed: {result.passed}")
    if not result.passed:
        exit(1)
