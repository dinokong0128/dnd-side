"""Markdown report generator for eval runs."""

import logging
from pathlib import Path

from evals.schema import AXES, RunReport

logger = logging.getLogger(__name__)


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


def generate_report(
    run_report: RunReport,
    output_path: Path | None = None,
    baseline_means: dict[str, float] | None = None,
) -> str:
    """Render a RunReport to a markdown string and optionally write to output_path."""
    lines: list[str] = []

    # Header
    lines.append("# Eval Run Report")
    lines.append("")
    lines.append(f"**Run ID:** {run_report.run_id}")
    lines.append(f"**Target:** {run_report.target_name}")
    lines.append(f"**Model:** {run_report.model}")
    lines.append(f"**Scenarios:** {len(run_report.scenario_results)}")
    lines.append("")

    # Aggregate table
    lines.append("## Aggregate Scores")
    lines.append("")
    lines.append("| Axis | Mean Score | vs Baseline |")
    lines.append("|------|-----------|-------------|")
    for axis in AXES:
        key = f"{axis}_mean"
        current_val = run_report.aggregate.get(key)
        baseline_val = baseline_means.get(axis) if baseline_means else None
        flag = _regression_flag(current_val, baseline_val)
        baseline_str = _fmt_score(baseline_val) if baseline_val is not None else "—"
        lines.append(f"| {axis} | {_fmt_score(current_val)} | {baseline_str}{flag} |")

    adv_pass = run_report.aggregate.get("adversarial_gate_pass_count", 0)
    adv_fail = run_report.aggregate.get("adversarial_gate_fail_count", 0)
    lines.append("")
    lines.append(f"**Adversarial gate:** {adv_pass} passed / {adv_fail} failed")
    lines.append("")

    # Per-scenario detail
    lines.append("## Per-Scenario Results")
    lines.append("")

    for sr in run_report.scenario_results:
        lines.append(f"### {sr.scenario_id}")
        lines.append("")
        lines.append(f"- **Adversarial gate:** {'✅ passed' if sr.adversarial_gate_passed else '❌ failed'}")
        if sr.continuity_score is not None:
            lines.append(f"- **Continuity score:** {sr.continuity_score:.2f}")
        lines.append("")

        for i, tr in enumerate(sr.turn_results):
            lines.append(f"#### Turn {i + 1}")
            lines.append("")
            lines.append("**Rubric scores:**")
            lines.append("")
            lines.append("| Axis | Score | Samples |")
            lines.append("|------|-------|---------|")
            for axis in AXES:
                score = _fmt_score(tr.rubric_scores.get(axis))
                samples = tr.rubric_samples.get(axis, [])
                samples_str = ", ".join(str(s) for s in samples)
                lines.append(f"| {axis} | {score} | {samples_str} |")
            lines.append("")
            excerpt = tr.dm_response.narration[:200].replace("\n", " ")
            lines.append(f"**DM response excerpt:** {excerpt}")
            lines.append("")

            if tr.adversarial_results:
                lines.append("**Adversarial checks:**")
                for check_result in tr.adversarial_results:
                    status = "✅" if check_result.get("passed") else "❌"
                    lines.append(
                        f"- {status} `{check_result.get('check_type')}`: {check_result.get('rationale', '')}"
                    )
                lines.append("")

        if sr.errors:
            lines.append("**Errors:**")
            for err in sr.errors:
                lines.append(f"- {err}")
            lines.append("")

    # Errors section
    all_errors = [
        (sr.scenario_id, err)
        for sr in run_report.scenario_results
        for err in sr.errors
    ]
    if all_errors:
        lines.append("## Errors")
        lines.append("")
        for scenario_id, err in all_errors:
            lines.append(f"- **{scenario_id}:** {err}")
        lines.append("")

    md = "\n".join(lines)

    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(md)
        logger.info("Report written to %s", output_path)

    return md
