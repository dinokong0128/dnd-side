"""Eval runner: load scenarios, seed DB, invoke targets, collect results, generate report."""

import argparse
import asyncio
import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml

from config import supabase_client
from evals.adversarial import run_checks
from evals.judges import (
    judge_turn,
    judge_continuity,
    DEFAULT_JUDGE_MODEL,
    DEFAULT_SAMPLE_SIZE,
)
from evals.report import generate_report
from evals.schema import (
    AXES,
    DMResponse,
    RunReport,
    Scenario,
    ScenarioResult,
    TurnResult,
)
from evals.targets import CurrentTarget, DMTarget
from services.dm_service import apply_state_changes
from services.embedding_service import embed_text

logger = logging.getLogger(__name__)

_EVALS_DIR = Path(__file__).parent
_REPORTS_DIR = _EVALS_DIR / "reports"
_SCENARIOS_FILE = _EVALS_DIR / "golden_scenarios.yaml"


def load_scenarios(path: Path = _SCENARIOS_FILE) -> list[Scenario]:
    """Load and validate all scenarios from the YAML file."""
    raw = yaml.safe_load(path.read_text()) or []
    return [Scenario.model_validate(item) for item in raw]


def _load_fixture(fixture_path: str) -> dict:
    """Load a fixture JSON file relative to the evals directory."""
    full_path = _EVALS_DIR / fixture_path
    return json.loads(full_path.read_text())


def _seed_scenario(scenario: Scenario, scenario_game_id: str) -> None:
    """
    Seed isolated DB state for a scenario run.
    Inserts game, players, player_inventory, and game_events rows.
    All IDs are generated fresh — fixture `id` fields are null/placeholders.
    """
    fixture = _load_fixture(scenario.seed_state_file)

    # Insert game row
    game_row = {**fixture["game"], "id": scenario_game_id}
    supabase_client.table("games").insert(game_row).execute()
    logger.debug("[runner] Seeded game %s", scenario_game_id)

    # Insert players; map fixture player index → generated player_id
    player_id_map: dict[int, str] = {}
    for idx, player_template in enumerate(fixture.get("players", [])):
        player_id = str(uuid.uuid4())
        player_id_map[idx] = player_id
        player_row = {
            **player_template,
            "id": player_id,
            "game_id": scenario_game_id,
            "profile_id": player_template.get("profile_id") or str(uuid.uuid4()),
        }
        supabase_client.table("players").insert(player_row).execute()

    # Insert player_inventory
    for idx, inv_item in enumerate(fixture.get("player_inventory", [])):
        player_idx = inv_item.get("player_index", 0)
        player_id = player_id_map.get(player_idx, player_id_map.get(0))
        inv_row = {
            "id": str(uuid.uuid4()),
            "player_id": player_id,
            "item_name": inv_item["item_name"],
            "quantity": inv_item.get("quantity", 1),
        }
        supabase_client.table("player_inventory").insert(inv_row).execute()

    # Embed and insert seed_events (compute real embeddings for RAG testing)
    for seed_event in scenario.seed_events:
        embedding = embed_text(seed_event.content)
        event_row = {
            "id": str(uuid.uuid4()),
            "game_id": scenario_game_id,
            "event_type": "milestone",
            "summary": seed_event.content,
            "embedding": embedding,
            "source": "claude",
        }
        supabase_client.table("game_events").insert(event_row).execute()


def _teardown_scenario(scenario_game_id: str) -> None:
    """Delete all rows for this scenario game_id in FK-safe order."""
    # Fetch player IDs first so we can delete inventory without a subquery
    try:
        player_rows = (
            supabase_client.table("players")
            .select("id")
            .eq("game_id", scenario_game_id)
            .execute()
        )
        player_ids = [r["id"] for r in (player_rows.data or [])]
        if player_ids:
            supabase_client.table("player_inventory").delete().in_(
                "player_id", player_ids
            ).execute()
    except Exception as e:
        logger.warning("[runner] Teardown warning for player_inventory: %s", e)

    for table in ("game_messages", "game_events", "players"):
        try:
            supabase_client.table(table).delete().eq("game_id", scenario_game_id).execute()
        except Exception as e:
            logger.warning("[runner] Teardown warning for %s: %s", table, e)
    try:
        supabase_client.table("games").delete().eq("id", scenario_game_id).execute()
    except Exception as e:
        logger.warning("[runner] Teardown warning for games: %s", e)


async def _run_scenario(
    scenario: Scenario,
    target: DMTarget,
    judge_model: str,
    sample_size: int,
) -> ScenarioResult:
    scenario_game_id = str(uuid.uuid4())
    errors: list[str] = []
    turn_results: list[TurnResult] = []
    adversarial_gate_passed = True

    try:
        _seed_scenario(scenario, scenario_game_id)

        prior_context = ""
        current_state: dict = _load_fixture(scenario.seed_state_file)

        for i, turn in enumerate(scenario.turns):
            try:
                dm_response: DMResponse = await target.respond(scenario_game_id, turn.action)

                # Build prior_context for judge (accumulate narration)
                if prior_context:
                    prior_context += f"\n\nPlayer: {turn.action}"
                else:
                    prior_context = f"Player: {turn.action}"

                # Score this turn
                turn_score = judge_turn(
                    prior_context=prior_context,
                    action=turn.action,
                    dm_response=dm_response.narration,
                    state_snapshot=current_state,
                    expected_capabilities=turn.expected_capabilities,
                    judge_model=judge_model,
                    sample_size=sample_size,
                )

                # Run adversarial checks
                adv_results = []
                if scenario.adversarial_checks:
                    after_state = {**current_state, **dm_response.state_updates}
                    adv_results = run_checks(
                        scenario.adversarial_checks,
                        current_state,
                        after_state,
                        dm_response.narration,
                        dm_response.state_updates,
                    )
                    if any(not r.get("passed") for r in adv_results):
                        adversarial_gate_passed = False

                turn_result = TurnResult(
                    turn_index=i,
                    dm_response=dm_response,
                    rubric_scores=turn_score.rubric_scores,
                    rubric_samples=turn_score.rubric_samples,
                    adversarial_results=adv_results,
                )
                turn_results.append(turn_result)

                # Update context + state for next turn
                prior_context += f"\nDM: {dm_response.narration}"

                if len(scenario.turns) > 1 and dm_response.state_updates:
                    try:
                        apply_state_changes(dm_response.state_updates, game_id=scenario_game_id)
                        current_state.update(dm_response.state_updates)
                    except Exception as se:
                        fallback_states = scenario.fallback_states
                        if i < len(fallback_states):
                            current_state = fallback_states[i]
                            errors.append(
                                f"Turn {i}: state parse failed; using fallback state. Error: {se}"
                            )
                        else:
                            errors.append(f"Turn {i}: state parse failed; no fallback. Error: {se}")

            except Exception as e:
                logger.error("[runner] Error in scenario %s turn %d: %s", scenario.id, i, e)
                errors.append(f"Turn {i}: {e}")

    finally:
        _teardown_scenario(scenario_game_id)

    # Cross-turn continuity score for multi-turn scenarios
    continuity_score: float | None = None
    if len(scenario.turns) > 1 and turn_results:
        try:
            continuity_score = judge_continuity(
                scenario=scenario,
                turn_results=turn_results,
                judge_model=judge_model,
            )
        except Exception as e:
            errors.append(f"Continuity scoring failed: {e}")

    return ScenarioResult(
        scenario_id=scenario.id,
        turn_results=turn_results,
        continuity_score=continuity_score,
        adversarial_gate_passed=adversarial_gate_passed,
        errors=errors,
    )


def _compute_aggregate(scenario_results: list[ScenarioResult]) -> dict:
    """Compute per-axis means and adversarial gate counts across all results."""
    axis_sums: dict[str, list[float]] = {axis: [] for axis in AXES}
    continuity_scores: list[float] = []
    adv_pass = 0
    adv_fail = 0

    for sr in scenario_results:
        for tr in sr.turn_results:
            for axis in AXES:
                val = tr.rubric_scores.get(axis)
                if val is not None:
                    axis_sums[axis].append(val)
        if sr.continuity_score is not None:
            continuity_scores.append(sr.continuity_score)
        if sr.adversarial_gate_passed:
            adv_pass += 1
        else:
            adv_fail += 1

    aggregate: dict = {}
    for axis in AXES:
        vals = axis_sums[axis]
        aggregate[f"{axis}_mean"] = (sum(vals) / len(vals)) if vals else None
    if continuity_scores:
        aggregate["continuity_mean"] = sum(continuity_scores) / len(continuity_scores)
    aggregate["adversarial_gate_pass_count"] = adv_pass
    aggregate["adversarial_gate_fail_count"] = adv_fail
    return aggregate


async def run_eval(
    target: DMTarget,
    scenarios: list[Scenario],
    output_dir: Path,
    judge_model: str = DEFAULT_JUDGE_MODEL,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
) -> RunReport:
    """Run all scenarios and produce a RunReport."""
    run_id = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    scenario_results: list[ScenarioResult] = []

    for scenario in scenarios:
        logger.info("[runner] Running scenario: %s", scenario.id)
        result = await _run_scenario(scenario, target, judge_model, sample_size)
        scenario_results.append(result)

    aggregate = _compute_aggregate(scenario_results)
    run_report = RunReport(
        run_id=run_id,
        target_name=target.name,
        model=getattr(target, "model", "unknown"),
        scenario_results=scenario_results,
        aggregate=aggregate,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / f"run_{run_id}.md"

    # Load baseline for diff
    baseline_path = output_dir / "baseline.md"
    baseline_means = _parse_baseline(baseline_path) if baseline_path.exists() else None

    generate_report(run_report, output_path=report_path, baseline_means=baseline_means)
    logger.info("[runner] Report written to %s", report_path)

    return run_report


def _parse_baseline(baseline_path: Path) -> dict[str, float]:
    axis_means: dict[str, float] = {}
    in_aggregate = False
    for line in baseline_path.read_text().splitlines():
        if "## Aggregate Scores" in line:
            in_aggregate = True
            continue
        if in_aggregate and line.startswith("## "):
            break
        if in_aggregate and "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 2 and parts[0] in AXES:
                try:
                    axis_means[parts[0]] = float(parts[1])
                except ValueError:
                    pass
    return axis_means


def update_baseline(run_report: RunReport, output_dir: Path, reason: str) -> None:
    """Copy the latest run report to baseline.md and update baseline_history.md."""
    run_id = run_report.run_id
    run_file = output_dir / f"run_{run_id}.md"
    baseline_file = output_dir / "baseline.md"
    history_file = output_dir / "baseline_history.md"

    if run_file.exists():
        shutil.copy(run_file, baseline_file)
        logger.info("[runner] Baseline updated from %s", run_file)
    else:
        logger.warning("[runner] Run file not found: %s", run_file)
        return

    entry = f"| {run_id} | {reason} |\n"
    if not history_file.exists():
        history_file.write_text(
            "# Baseline History\n\n| Run ID | Reason |\n|--------|--------|\n" + entry
        )
    else:
        history_file.write_text(history_file.read_text() + entry)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Run DM response eval harness")
    parser.add_argument("--target", default="current", choices=["current"])
    parser.add_argument("--model", default="claude-sonnet-4-20250514")
    parser.add_argument("--output", type=Path, default=_REPORTS_DIR)
    parser.add_argument("--scenario", help="Run only a single scenario by ID")
    parser.add_argument("--sample-size", type=int, default=DEFAULT_SAMPLE_SIZE)
    parser.add_argument("--judge-model", default=DEFAULT_JUDGE_MODEL)
    parser.add_argument("--update-baseline", action="store_true")
    parser.add_argument("--reason", default="", help="Reason for baseline update")
    args = parser.parse_args()

    if args.target == "current":
        target = CurrentTarget(model=args.model)
    else:
        raise ValueError(f"Unknown target: {args.target}")

    all_scenarios = load_scenarios()
    if args.scenario:
        scenarios = [s for s in all_scenarios if s.id == args.scenario]
        if not scenarios:
            raise SystemExit(f"Scenario '{args.scenario}' not found")
    else:
        scenarios = all_scenarios

    run_report = asyncio.run(
        run_eval(
            target=target,
            scenarios=scenarios,
            output_dir=args.output,
            judge_model=args.judge_model,
            sample_size=args.sample_size,
        )
    )

    if args.update_baseline:
        if not args.reason:
            raise SystemExit("--reason is required with --update-baseline")
        update_baseline(run_report, args.output, args.reason)


if __name__ == "__main__":
    main()
