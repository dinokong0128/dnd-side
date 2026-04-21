# DM Response Eval Harness — Runbook

**Version:** 1.0
**Established:** DIN-68
**Related:** `docs/EVALS_RUBRIC.md`, `backend/evals/`

---

## How to Run

### Full Eval (All 25 Scenarios)

```bash
cd backend/
python -m evals.runner \
  --target current \
  --model claude-sonnet-4-20250514 \
  --output evals/reports/
```

This will:
1. Load all 25 scenarios from `evals/golden_scenarios.yaml`
2. Seed isolated DB state per scenario (real embeddings via OpenAI)
3. Invoke the DM code path
4. Score each turn with Claude Haiku (5 axes × 3 samples)
5. Teardown all seeded rows
6. Write `evals/reports/run_<iso_timestamp>.md`

**Expected cost:** ~$1–1.50 (DM calls + judge calls)
**Expected wall clock:** ~4–8 minutes

### Single Scenario (for debugging)

```bash
python -m evals.runner \
  --target current \
  --scenario skill_lockpick_basic \
  --sample-size 1 \
  --output evals/reports/
```

`--sample-size 1` speeds up iteration — use `--sample-size 3` for production runs.

### Calibration Check

```bash
python -m evals.calibration \
  --human evals/calibration/human_scores.json \
  --judge evals/calibration/judge_scores.json
```

---

## How to Interpret the Report

Each run produces `reports/run_<timestamp>.md` with:

1. **Aggregate scores table** — per-axis means across all scenarios, with diff vs. baseline
2. **Adversarial gate summary** — number of scenarios with binary checks passing/failing
3. **Per-scenario detail** — per-turn rubric scores and DM response excerpts

**Regression flags (⚠️):** Any axis that drops > 0.3 below baseline is flagged. Any adversarial gate failure is a blocking concern.

**The 5 axes (see `docs/EVALS_RUBRIC.md` for full definitions):**
- `rule_compliance` — correct 5e SRD mechanics
- `narrative_coherence` — logical flow from action
- `state_correctness` — accurate HP/inventory tracking (N/A for pure dialogue)
- `hallucination` — **INVERTED: 5 = no hallucination**
- `voice_consistency` — tone/register matches DM persona (N/A for very short responses)

---

## How to Add a New Scenario

1. Open `backend/evals/golden_scenarios.yaml`
2. Add a new entry following the schema in `schema.py`
3. Think through these four questions before writing:
   - **Which axes are N/A per turn?** Pure dialogue → `state_correctness` N/A. Very short responses → `voice_consistency` N/A.
   - **Is this covered by an existing scenario?** Check existing IDs before adding.
   - **Single-turn or multi-turn?** Default to single-turn. Use multi-turn only if you're testing state propagation, cross-turn voice, or narrative callbacks.
   - **Heavy seed or real multi-turn?** For RAG recall tests, seed `seed_events` on a single-turn scenario. Use multi-turn only when propagation itself is the thing under test.
4. Validate by running a single-scenario smoke test:
   ```bash
   python -m evals.runner --scenario <your-new-id> --sample-size 1
   ```

**Scenario ID convention:** `<category>_<slug>` — e.g. `skill_lockpick_basic`, `rule_edge_advantage_stacking`

---

## Baseline Update Policy

The baseline (`evals/reports/baseline.md`) is the reference point for all regression comparisons.

**Update the baseline explicitly only when:**
- A prompt change, model upgrade, or RAG improvement is intentional and the eval results confirm improvement
- A calibration update changes the judge prompt (invalidates prior scores)

**Never update the baseline automatically.** Use the `--update-baseline` flag with an explicit reason:

```bash
python -m evals.runner \
  --target current \
  --output evals/reports/ \
  --update-baseline \
  --reason "Upgraded to claude-sonnet-4-20250514; confirmed improvement on all axes"
```

This copies the run file to `baseline.md` and appends to `baseline_history.md`.

**Regression policy:**
- Regression > 0.3 on any axis average → requires explicit justification in PR description
- Any adversarial binary gate failure → blocks merge

---

## Suite Growth Policy

- **Initial suite:** 25 scenarios — covers all categories meaningfully
- **Growth trigger:** every production bug that could have been caught by an eval → add a scenario in the fix PR (standard "bug → regression test" discipline)
- **Target ceiling:** ~60 scenarios before revisiting sampling strategies (subset per PR, full suite nightly)
- **Scenarios are cheap:** ~15 min each; lean toward adding rather than deliberating

---

## CI Gating Posture (Current: Manual)

Evals run **manually for now**. The author-discipline policy (PRs touching DM code path include eval results in PR description) is how regressions are caught.

Automated CI gating is a deliberate follow-up once:
- The harness has been used on ≥3 real PRs without infra-related failures
- Cost per run is confirmed stable at the estimated $1–1.50 range
- A sampling strategy is decided (full suite vs. category subset per PR)

---

## Multi-Turn Parse-Failure Policy

Multi-turn scenarios depend on parsing the DM's `state_updates` from turn N to feed turn N+1.

**Policy:**
- Each turn is parsed independently and scored on its own merits
- On parse failure at turn N: the runner logs the failure, falls back to the `fallback_states[N]` entry defined in the scenario, and continues into turn N+1
- Turns after a fallback are flagged in the report as `[fallback state]`
- If a scenario omits `fallback_states`, a parse failure fails the scenario outright

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/evals/golden_scenarios.yaml` | All 25 scenarios |
| `backend/evals/fixtures/states/` | Game state fixtures used by scenarios |
| `backend/evals/reports/baseline.md` | Current baseline (reference for regression) |
| `backend/evals/reports/baseline_history.md` | Baseline update log |
| `backend/evals/calibration/human_scores.json` | Dino's hand scores (50 entries) |
| `backend/evals/calibration/judge_scores.json` | Judge mean scores for calibration |
| `docs/EVALS_RUBRIC.md` | Full rubric with per-score anchors |
