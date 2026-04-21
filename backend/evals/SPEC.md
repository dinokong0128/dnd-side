# DIN-68 Eval Harness — Spec

## Acceptance Criteria

1. New `backend/evals/` module with: `golden_scenarios.yaml`, `fixtures/states/*.json`,
   `targets.py`, `runner.py`, `judges.py`, `adversarial.py`, `calibration.py`, `report.py`
2. CLI: `python -m backend.evals.runner --target current --model claude-sonnet-4-20250514 --output reports/`
3. CLI flag `--update-baseline --reason "..."` for explicit baseline updates
4. Reports stored in `backend/evals/reports/` with ISO timestamp; committed to git
5. `docs/EVALS.md` — runbook: how to run, interpret, add scenarios, baseline policy
6. `docs/EVALS_RUBRIC.md` — full 5-axis rubric with per-score anchors
7. Judge calibration: 10 hand-scored responses, ≥80% within ±1, no axis bias > 0.5
8. Initial baseline run committed after calibration passes
9. Adversarial scenarios produce both rubric scores and binary pass/fail gate results
10. No GitHub Actions integration — CI gating is a deferred follow-up

## Layer Mock Boundaries

### runner.py tests
- Mock: `anthropic_client`, `openai_client`, `supabase_client` (same as `test_dm_tasks.py`)
- Mock: `embed_text`, `judges.judge_turn`, `judges.judge_continuity`
- Call runner logic directly (no Dramatiq broker)

### judges.py tests
- Mock: `anthropic_client` only
- Return canned JSON scores

### adversarial.py tests
- Pure logic, no mocks needed
- Hand-craft before/after state dicts

### calibration.py tests
- Pure math on dicts, no mocks

### report.py tests
- Filesystem only, no mocks (use tmp_path)

### targets.py tests
- Mock: `anthropic_client`, `supabase_client`, `embed_text`
- Follow `test_dm_tasks.py` pattern
