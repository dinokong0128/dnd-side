"""Markdown report generator for eval runs."""

import logging
from pathlib import Path

from evals.schema import RunReport, ScenarioResult

logger = logging.getLogger(__name__)

AXES = [
    "rule_compliance",
    "narrative_coherence",
    "state_correctness",
    "hallucination",
    "voice_consistency",
]


def _fmt_score(val: float | None) -> str:
    if val is None:
        return "N/A"
    return f"{val:.2f}"


def _regression_flag(current: float | None, baseline: float | None) -> str:
    if current is None or baseline is None:
        return ""
    if (baseline - current) > 0.3:
        return " ⚠️"
    return ""


def _load_baseline(output_dir: Path) -> dict[str, float] | None:
    baseline_path = output_dir / "baseline.md"
    if not baseline_path.exists():
        return None
    # Parse axis means from baseline header table
    axis_means: dict[str, float] = {}
    in_table = False
    for line in baseline_path.read_text().splitlines():
        if "## Aggregate Scores" in line:
            in_table = True
        if in_table and "|" in line and not line.startswith("| Axis"):
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 2 and parts[0] in AXES:
                try:
                    axis_means[parts[0]] = float(parts[1])
                except ValueError:
                    pass
    return axis_means if axis_means else None


def generate_report(
    run_report: RunReport,
    output_path: Path | None = None,
    baseline_means: dict[str, float] | None = None,
) -> str:
    """Render a RunReport to a markdown string and optionally write to output_path."""
    lines: list[str] = []

    # Header
    lines.append(f"# Eval Run Report")
    lines.append(f"")
    lines.append(f"**Run ID:** {run_report.run_id}")
    lines.append(f"**Target:** {run_report.target_name}")
    lines.append(f"**Model:** {run_report.model}")
    lines.append(f"**Scenarios:** {len(run_report.scenario_results)}")
    lines.append(f"")

    # Aggregate table
    lines.append(f"## Aggregate Scores")
    lines.append(f"")
    lines.append(f"| Axis | Mean Score | vs Baseline |")
    lines.append(f"|------|-----------|-------------|")
    for axis in AXES:
        key = f"{axis}_mean"
        current_val = run_report.aggregate.get(key)
        baseline_val = baseline_means.get(axis) if baseline_means else None
        flag = _regression_flag(current_val, baseline_val)
        baseline_str = _fmt_score(baseline_val) if baseline_val is not None else "—"
        lines.append(f"| {axis} | {_fmt_score(current_val)} | {baseline_str}{flag} |")

    adv_pass = run_report.aggregate.get("adversarial_gate_pass_count", 0)
    adv_fail = run_report.aggregate.get("adversarial_gate_fail_count", 0)
    lines.append(f"")
    lines.append(f"**Adversarial gate:** {adv_pass} passed / {adv_fail} failed")
    lines.append(f"")

    # Per-scenario detail
    lines.append(f"## Per-Scenario Results")
    lines.append(f"")

    for sr in run_report.scenario_results:
        lines.append(f"### {sr.scenario_id}")
        lines.append(f"")
        lines.append(f"- **Adversarial gate:** {'✅ passed' if sr.adversarial_gate_passed else '❌ failed'}")
        if sr.continuity_score is not None:
            lines.append(f"- **Continuity score:** {sr.continuity_score:.2f}")
        lines.append(f"")

        for i, tr in enumerate(sr.turn_results):
            lines.append(f"#### Turn {i + 1}")
            lines.append(f"")
            lines.append(f"**Rubric scores:**")
            lines.append(f"")
            lines.append(f"| Axis | Score | Samples |")
            lines.append(f"|------|-------|---------|")
            for axis in AXES:
                score = _fmt_score(tr.rubric_scores.get(axis))
                samples = tr.rubric_samples.get(axis, [])
                samples_str = ", ".join(str(s) for s in samples)
                lines.append(f"| {axis} | {score} | {samples_str} |")
            lines.append(f"")
            excerpt = tr.dm_response.narration[:200].replace("\n", " ")
            lines.append(f"**DM response excerpt:** {excerpt}")
            lines.append(f"")

            if tr.adversarial_results:
                lines.append(f"**Adversarial checks:**")
                for check_result in tr.adversarial_results:
                    status = "✅" if check_result.get("passed") else "❌"
                    lines.append(
                        f"- {status} `{check_result.get('check_type')}`: {check_result.get('rationale', '')}"
                    )
                lines.append(f"")

        if sr.errors:
            lines.append(f"**Errors:**")
            for err in sr.errors:
                lines.append(f"- {err}")
            lines.append(f"")

    # Errors section
    all_errors = [
        (sr.scenario_id, err)
        for sr in run_report.scenario_results
        for err in sr.errors
    ]
    if all_errors:
        lines.append(f"## Errors")
        lines.append(f"")
        for scenario_id, err in all_errors:
            lines.append(f"- **{scenario_id}:** {err}")
        lines.append(f"")

    md = "\n".join(lines)

    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(md)
        logger.info("Report written to %s", output_path)

    return md
