# DM Response Evaluation Rubric

**Version:** 1.0
**Last calibrated:** TBD (blocks on DIN-68 initial baseline)
**Applies to:** All golden scenarios in `backend/evals/golden_scenarios.yaml`

## Purpose

This document defines how DM responses are scored in the eval harness. It serves two audiences:

1. **Humans** (Dino during calibration, contributors adding scenarios) — provides rationale and examples for consistent scoring
2. **The judge LLM** (Claude Haiku) — the "Judge Prompt Anchors" section at the bottom is the literal text injected into the judge prompt

**Versioning caveat:** Any change to the judge prompt anchors or rubric definitions invalidates prior eval runs. On change: bump the version number here and re-run calibration before updating the baseline.

---

## Scoring Scale

All axes use a **1–5 integer scale**. Fractional scores are forbidden at the per-call level — fractional averages emerge only from the mean of the 3 judge samples per axis per turn.

A sixth value, **N/A**, is permitted when an axis genuinely doesn't apply to a turn (e.g., State Correctness on a pure dialogue turn with no state changes). N/A is excluded from axis averages rather than scored as 5.

## Score Semantics

| Score | Meaning |
|-------|---------|
| **5** | Excellent. No issues. Production-quality. |
| **4** | Good. Minor issue, player likely won't notice. |
| **3** | Acceptable. Noticeable issue but game still functions. |
| **2** | Bad. Significant issue that damages play experience. |
| **1** | Unacceptable. Response is broken on this axis. |
| **N/A** | Axis does not apply to this turn. |

---

## The 5 Axes

### 1. Rule Compliance

**Does the DM correctly apply 5e SRD rules?**

Covers: which ability score to roll, correct DC setting, correct modifier application, correct damage calculation, correct spell mechanics, proficiency bonus scaling by level, advantage/disadvantage rules, condition effects.

| Score | Definition | Example |
|-------|------------|---------|
| **5** | Invoked the correct mechanic with correct DC, ability score, modifier, and any situational rules | Lockpick attempt → "Make a DEX (Thieves' Tools) check against DC 15" with correct PB added |
| **4** | Correct mechanic, one minor numerical error (DC off by ±2, one missed situational modifier) | Lockpick at DC 17 when SRD guidance is DC 15; otherwise correct |
| **3** | Adjacent-correct mechanic — same ability tree, wrong specific check | Called for a DEX (Acrobatics) check when DEX (Thieves' Tools) was right |
| **2** | Failed to invoke a mechanic when one was required, OR invoked one when unnecessary | Player attempts to pick lock; DM just narrates success with no check |
| **1** | Fabricated a mechanic that doesn't exist in 5e, or fundamentally violated a core rule | "Roll a Charisma (Lockpicking) check with disadvantage from being wet" |

**N/A when:** Turn is pure narration/dialogue with no mechanical trigger (e.g., ambient description, NPC small-talk).

---

### 2. Narrative Coherence

**Does the response follow logically from the prior context and the player's action?**

Covers: cause-and-effect between action and response, continuity with established facts in the scene, internal consistency within the response itself, appropriate response length and focus.

| Score | Definition | Example |
|-------|------------|---------|
| **5** | Response follows from action and prior context; no contradictions; logical flow | Player swings sword → DM describes the swing, impact, consequence in order |
| **4** | Mostly coherent; one minor inconsistency or awkward transition | Describes enemy as "falling back" but later in same paragraph has them advancing |
| **3** | Noticeable gap or minor contradiction but story still works | Player asked about the door; DM answers about the window, then pivots back to door |
| **2** | Significant logical gap, or contradicts established context | Player is in the tavern; DM describes forest ambience |
| **1** | Nonsensical or self-contradictory within the response | Paragraph 1 says the bandit is dead; paragraph 2 has the bandit attacking |

**N/A when:** Never — coherence always applies.

---

### 3. State Correctness

**Are HP, inventory, location, conditions, and other tracked state correctly reflected in the response?**

Covers: HP math, spell slot depletion, inventory adds/removes, location tracking, status conditions, gold/currency, initiative order, remaining uses of abilities.

| Score | Definition | Example |
|-------|------------|---------|
| **5** | All state updates accurate; response correctly reflects current state | Fighter at 12 HP takes 5 damage → narration + state update both show 7 HP |
| **4** | One minor tracking error (off-by-one on HP, forgot to decrement one use) | HP correct but forgot to note the 1st-level slot was spent on the spell |
| **3** | Multiple minor errors, or one meaningful one | Damage applied to wrong character; HP correct on intended target |
| **2** | Significant error affecting gameplay (wrong heal amount, wrong location, wrong spell slot level) | Player cast Cure Wounds at 2nd level; DM applies 1st-level healing |
| **1** | State completely wrong, contradicts established prior state, or invents state | Fighter's HP doubles with no explanation; inventory item appears unprompted |

**N/A when:** Turn has no state-affecting action (pure dialogue, exploration without interaction).

---

### 4. Hallucination (Inverted)

**Did the DM invent entities, events, or facts not established in prior context?**

**IMPORTANT: This axis is inverted. 5 = NO hallucination. 1 = HEAVILY hallucinated.**

Covers: inventing NPC names/backstories, inventing prior events the party "remembers," inventing items not in inventory, inventing world lore not established, misquoting established facts.

| Score | Definition | Example |
|-------|------------|---------|
| **5** | No invented entities, events, or facts beyond reasonable ambient detail | Party enters tavern → DM describes scene using only established setting facts |
| **4** | One trivial invention — harmless generic flavor that doesn't constrain future play | DM names a background patron "Old Bram" who was never established; has no plot impact |
| **3** | One noticeable invention that could constrain future play | DM gives an unnamed NPC a specific backstory not established, player may reference it later |
| **2** | Significant fabrication — invented a prior event or item that materially affects play | "As you may recall, you swore an oath to the Duchess…" — no such oath was sworn |
| **1** | Substantially fabricated; contradicts established world or history | Invents a past session the party "remembers"; references an item the party never had |

**N/A when:** Never — hallucination always applies, even to minimal responses.

---

### 5. Voice Consistency

**Does the DM maintain consistent tone, pacing, and register?**

Covers: formal vs. casual diction, descriptive density, pacing (action vs. exposition), narrative person (second-person vs. third-person shifts), genre register (dark fantasy vs. slapstick).

**For single-turn scenarios:** compare against the system prompt's persona specification (current DM system prompt is the source of truth — do not inline it here; treat the prompt as the voice spec).

**For multi-turn scenarios:** compare against both the system prompt and prior turns in the scenario.

| Score | Definition | Example |
|-------|------------|---------|
| **5** | Tone, pacing, register all consistent with spec and prior turns | Dark fantasy register maintained: "The flickering torchlight reveals…" |
| **4** | Mostly consistent; one slight shift in tone | Drops briefly into casual register mid-paragraph but recovers |
| **3** | Noticeable shift but still recognizably the same DM | Prior turns were atmospheric; this turn is business-like stat-reporting |
| **2** | Significant voice shift (formal ↔ casual, dark ↔ cheerful) | Previous turn: ominous tavern. This turn: "lol the bartender is super chill" |
| **1** | Completely different voice; feels like a different narrator | System prompt specifies atmospheric dark fantasy; DM responds in modern boardgame rules-lawyer voice |

**N/A when:** Response is too short or mechanical to assess voice (e.g., a pure "Roll a DEX save, DC 14.").

---

## Cross-Turn Continuity Score (Multi-Turn Only)

Multi-turn scenarios receive **one additional score** evaluating arc-level coherence across the full sequence. This is scored once per scenario, not per turn.

**Evaluates:**

- **Callback recognition** — Does later narration acknowledge earlier events appropriately?
- **Stated-fact consistency** — Does turn 3 contradict a fact established in turn 1?
- **Narrative momentum** — Do the turns build into a coherent arc, or read as disconnected vignettes?
- **State arc** — Does the state evolution across turns make sense? (e.g., HP loss → eventual death saves reads naturally)

Scored 1–5 using the same semantics as the per-turn axes. Not inverted.

| Score | Definition |
|-------|------------|
| **5** | Turns read as a coherent arc; callbacks land; no cross-turn contradictions |
| **4** | Minor continuity issue (one missed callback opportunity, one subtle inconsistency) |
| **3** | Noticeable discontinuity — a significant fact from turn N is forgotten in turn N+2 |
| **2** | Significant cross-turn contradiction or complete miss on a required callback |
| **1** | Turns feel like independent responses; no arc; major contradictions |

---

## Calibration Procedure

Before a new judge prompt (or rubric revision) can be used for an updated baseline:

1. **Select 10 responses** from the scenario suite spanning categories and quality levels
2. **Dino hand-scores** each response on all 5 axes (50 scores total)
3. **Run the judge** on the same 10 responses at 3 samples per axis (150 judge calls, averaged → 50 total mean judge scores to compare)
4. **Compare** using `calibration.py`:
   - **Pass criterion 1:** ≥ 80% of the 50 axis-response pairs must agree within ±1 point
   - **Pass criterion 2:** No axis has systematic bias > 0.5 points (judge consistently high or low)
5. **On failure:** iterate on the Judge Prompt Anchors section below, re-run, until passing

Calibration artifacts (human scores, judge scores, agreement table) are committed alongside the baseline run.

---

## Adding a New Scenario

When authoring a scenario in `golden_scenarios.yaml`, think through:

1. **Which axes are N/A for each turn?** Not every axis applies to every turn. Flag these via `expected_capabilities` to hint the judge.
2. **Is this covered by an existing scenario?** If a near-duplicate exists, consider strengthening the existing one instead of adding a new one.
3. **Single-turn or multi-turn?** Default to single-turn unless you're specifically testing state propagation, cross-turn voice, or narrative callbacks.
4. **Heavy seed vs. real multi-turn?** For RAG recall tests, heavy `seed_events` on a single-turn scenario is usually cheaper and more reliable than a multi-turn run.

---

## Judge Prompt Anchors

**This is the literal text injected into the judge prompt. Edit with care — changes invalidate calibration.**

```
You are a D&D 5e response quality evaluator. You will score a single DM response on one axis.

AXIS: {axis_name}
DEFINITION: {axis_one_liner}

SCORE ON A 1-5 INTEGER SCALE:

{anchors_for_this_axis}

IMPORTANT RULES:
- Output an integer 1-5, or the string "N/A" if the axis does not apply to this turn.
- Do not output fractional scores (no 4.5, no 3.5).
- {axis_specific_warning}   <-- e.g. for hallucination: "Remember: 5 = NO hallucination. 1 = HEAVILY hallucinated."
- Consider only the current turn for per-turn scoring. Prior turns are context, not subjects.

INPUT:
  Prior context: {prior_context}
  Player action: {action}
  DM response: {dm_response}
  Expected capabilities: {expected_capabilities}
  Current game state: {state_snapshot}

OUTPUT FORMAT (strict JSON, no prose outside the JSON):
  {"score": <1|2|3|4|5|"N/A">, "brief_rationale": "<one short sentence, max 20 words>"}
```

The `{anchors_for_this_axis}` placeholder is filled with the relevant axis's definition table from the sections above. The `brief_rationale` field is retained in judge output for debugging and to benefit from light chain-of-thought — do not remove it without re-calibration.

One axis is scored per judge call (5 axes × 3 samples = 15 calls per turn, plus 3 calls for cross-turn continuity on multi-turn scenarios). This is intentional: all-axes-in-one-call was considered and rejected to avoid axis bleed-through.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | TBD | Initial rubric established with DIN-68 |
