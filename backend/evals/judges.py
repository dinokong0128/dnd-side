"""LLM-as-judge: score DM responses on 5 axes using Claude Haiku."""

import json
import logging
from dataclasses import dataclass

from config import anthropic_client
from evals.schema import AXES, Scenario, TurnResult

logger = logging.getLogger(__name__)

DEFAULT_JUDGE_MODEL = "claude-haiku-4-5-20251001"
DEFAULT_SAMPLE_SIZE = 3

_NO_EXTRA_RULES = "Apply the rubric anchors as written; no special overrides for this axis."

# Axis definitions for the judge prompt
_AXIS_DEFS = {
    "rule_compliance": {
        "one_liner": "Does the DM correctly apply 5e SRD rules?",
        "warning": _NO_EXTRA_RULES,
        "anchors": """| Score | Definition | Example |
|-------|------------|---------|
| 5 | Invoked the correct mechanic with correct DC, ability score, modifier, and situational rules | Lockpick → "DEX (Thieves' Tools) check DC 15" with correct PB |
| 4 | Correct mechanic, one minor numerical error | DC 17 when SRD guidance is 15 |
| 3 | Adjacent-correct mechanic — same ability tree, wrong specific check | DEX (Acrobatics) when DEX (Thieves' Tools) was right |
| 2 | Failed to invoke a mechanic when required, or invoked one when unnecessary | Player picks lock; DM just narrates success with no check |
| 1 | Fabricated a non-existent mechanic or violated a core rule | "Roll Charisma (Lockpicking)" |

N/A when: Turn is pure narration/dialogue with no mechanical trigger.""",
    },
    "narrative_coherence": {
        "one_liner": "Does the response follow logically from prior context and the player's action?",
        "warning": "Coherence always applies; this axis is never N/A.",
        "anchors": """| Score | Definition | Example |
|-------|------------|---------|
| 5 | Follows from action and context; no contradictions; logical flow | Player swings → DM describes swing, impact, consequence in order |
| 4 | Mostly coherent; one minor inconsistency | Describes enemy "falling back" but later advancing |
| 3 | Noticeable gap but story still works | Answered about window when asked about door, then pivoted back |
| 2 | Significant logical gap or contradicts established context | Player in tavern; DM describes forest |
| 1 | Nonsensical or self-contradictory | Paragraph 1: bandit dead; Paragraph 2: bandit attacking |

N/A when: Never.""",
    },
    "state_correctness": {
        "one_liner": "Are HP, inventory, location, conditions, and other tracked state correctly reflected?",
        "warning": _NO_EXTRA_RULES,
        "anchors": """| Score | Definition | Example |
|-------|------------|---------|
| 5 | All state updates accurate; response correctly reflects current state | Fighter at 12 HP takes 5 → narration + state show 7 HP |
| 4 | One minor tracking error | HP correct but forgot to decrement one spell slot use |
| 3 | Multiple minor errors, or one meaningful one | Damage applied to wrong character |
| 2 | Significant error affecting gameplay | Cure Wounds at 2nd level; DM applies 1st-level healing |
| 1 | State completely wrong or contradicts prior state | Fighter HP doubles with no explanation |

N/A when: Turn has no state-affecting action (pure dialogue, exploration without interaction).""",
    },
    "hallucination": {
        "one_liner": "Did the DM invent entities, events, or facts not established in prior context?",
        "warning": "IMPORTANT: This axis is INVERTED. 5 = NO hallucination. 1 = HEAVILY hallucinated. Hallucination always applies; never N/A.",
        "anchors": """| Score | Definition | Example |
|-------|------------|---------|
| 5 | No invented entities, events, or facts beyond ambient detail | DM uses only established setting facts |
| 4 | One trivial invention — harmless generic flavor, no plot impact | Names a background patron not established; no impact |
| 3 | One noticeable invention that could constrain future play | Unnamed NPC given specific backstory |
| 2 | Significant fabrication affecting play | "As you may recall, you swore an oath…" — no oath was sworn |
| 1 | Substantially fabricated; contradicts established world | References an item the party never had |

N/A when: Never.""",
    },
    "voice_consistency": {
        "one_liner": "Does the DM maintain consistent tone, pacing, and register?",
        "warning": _NO_EXTRA_RULES,
        "anchors": """| Score | Definition | Example |
|-------|------------|---------|
| 5 | Tone, pacing, register all consistent with spec and prior turns | Dark fantasy register maintained |
| 4 | Mostly consistent; one slight shift | Drops briefly into casual register mid-paragraph |
| 3 | Noticeable shift but still recognizably same DM | Prior turns atmospheric; this turn business-like |
| 2 | Significant voice shift (formal ↔ casual, dark ↔ cheerful) | Previous ominous; this turn "lol the bartender is chill" |
| 1 | Completely different voice; different narrator | System prompt: dark fantasy; DM responds in modern rules-lawyer voice |

N/A when: Response is too short or mechanical to assess voice.""",
    },
}

assert set(_AXIS_DEFS.keys()) == set(AXES), (
    f"_AXIS_DEFS and AXES are out of sync: "
    f"extra={set(_AXIS_DEFS) - set(AXES)}, missing={set(AXES) - set(_AXIS_DEFS)}"
)

_JUDGE_PROMPT_TEMPLATE = """You are a D&D 5e response quality evaluator. You will score a single DM response on one axis.

AXIS: {axis_name}
DEFINITION: {axis_one_liner}

SCORE ON A 1-5 INTEGER SCALE:

{anchors_for_this_axis}

IMPORTANT RULES:
- Output an integer 1-5, or the string "N/A" if the axis does not apply to this turn.
- Do not output fractional scores (no 4.5, no 3.5).
- {axis_specific_warning}
- Consider only the current turn for per-turn scoring. Prior turns are context, not subjects.

INPUT:
  Prior context: {prior_context}
  Player action: {action}
  DM response: {dm_response}
  Expected capabilities: {expected_capabilities}
  Current game state: {state_snapshot}

OUTPUT FORMAT (strict JSON, no prose outside the JSON):
  {{"score": <1|2|3|4|5|"N/A">, "brief_rationale": "<one short sentence, max 20 words>"}}"""

_CONTINUITY_PROMPT_TEMPLATE = """You are a D&D 5e response quality evaluator. Evaluate the arc-level coherence of a multi-turn DM sequence.

SCORE ON A 1-5 INTEGER SCALE:

| Score | Definition |
|-------|------------|
| 5 | Turns read as a coherent arc; callbacks land; no cross-turn contradictions |
| 4 | Minor continuity issue (one missed callback, one subtle inconsistency) |
| 3 | Noticeable discontinuity — a significant fact from turn N forgotten in turn N+2 |
| 2 | Significant cross-turn contradiction or complete miss on required callback |
| 1 | Turns feel like independent responses; no arc; major contradictions |

Evaluates:
- Callback recognition (later narration acknowledges earlier events)
- Stated-fact consistency (turn 3 does not contradict turn 1)
- Narrative momentum (turns build into coherent arc)
- State arc (HP/condition evolution makes sense)

INPUT:
  Scenario description: {scenario_description}
  Full turn sequence (player action + DM response per turn):
{turn_sequence}

OUTPUT FORMAT (strict JSON, no prose outside the JSON):
  {{"score": <1|2|3|4|5>, "brief_rationale": "<one short sentence, max 20 words>"}}"""


def _call_judge(prompt: str, judge_model: str) -> int | str:
    """Call Claude Haiku for a single judge score; return int or 'N/A'."""
    try:
        response = anthropic_client.messages.create(
            model=judge_model,
            max_tokens=64,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:
        logger.warning("[judges] API call failed: %s", e)
        return "N/A"
    raw = response.content[0].text.strip()
    try:
        parsed = json.loads(raw)
        score = parsed.get("score", "N/A")
        if score == "N/A":
            return "N/A"
        return int(score)
    except (json.JSONDecodeError, ValueError, TypeError):
        logger.warning("[judges] Failed to parse judge response: %s", raw[:200])
        return "N/A"


def _score_axis(
    axis: str,
    prior_context: str,
    action: str,
    dm_response: str,
    state_snapshot: dict,
    expected_capabilities: list[str],
    judge_model: str,
    sample_size: int,
) -> tuple[float | None, list[int | str]]:
    """Run `sample_size` judge calls for one axis; return (mean, samples)."""
    axis_def = _AXIS_DEFS[axis]
    truncated_context = prior_context[-500:] if prior_context else ""
    truncated_action = action[:500]
    truncated_response = dm_response[:1000]
    truncated_state = json.dumps(state_snapshot, default=str)[:500]
    if len(prior_context) > 500 or len(dm_response) > 1000:
        logger.debug("[judges] Prompt inputs truncated for axis %s (context=%d, response=%d)",
                     axis, len(prior_context), len(dm_response))
    prompt = _JUDGE_PROMPT_TEMPLATE.format(
        axis_name=axis,
        axis_one_liner=axis_def["one_liner"],
        anchors_for_this_axis=axis_def["anchors"],
        axis_specific_warning=axis_def["warning"],
        prior_context=truncated_context,
        action=truncated_action,
        dm_response=truncated_response,
        expected_capabilities=", ".join(expected_capabilities),
        state_snapshot=truncated_state,
    )

    samples: list[int | str] = []
    for _ in range(sample_size):
        score = _call_judge(prompt, judge_model)
        # Retry once on N/A
        if score == "N/A":
            score = _call_judge(prompt, judge_model)
        samples.append(score)

    numeric = [s for s in samples if isinstance(s, int)]
    mean_score = (sum(numeric) / len(numeric)) if numeric else None
    return mean_score, samples


@dataclass
class TurnScore:
    rubric_scores: dict[str, float | None]
    rubric_samples: dict[str, list]


def judge_turn(
    prior_context: str,
    action: str,
    dm_response: str,
    state_snapshot: dict,
    expected_capabilities: list[str],
    judge_model: str = DEFAULT_JUDGE_MODEL,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
) -> TurnScore:
    """Score a single DM turn on all 5 axes. Returns TurnScore with means + raw samples."""
    rubric_scores: dict[str, float | None] = {}
    rubric_samples: dict[str, list] = {}

    for axis in AXES:
        mean, samples = _score_axis(
            axis=axis,
            prior_context=prior_context,
            action=action,
            dm_response=dm_response,
            state_snapshot=state_snapshot,
            expected_capabilities=expected_capabilities,
            judge_model=judge_model,
            sample_size=sample_size,
        )
        rubric_scores[axis] = mean
        rubric_samples[axis] = samples

    return TurnScore(rubric_scores=rubric_scores, rubric_samples=rubric_samples)


def judge_continuity(
    scenario: Scenario,
    turn_results: list[TurnResult],
    judge_model: str = DEFAULT_JUDGE_MODEL,
) -> float:
    """Score cross-turn continuity for a multi-turn scenario. Returns float 1.0–5.0."""
    lines = []
    for i, tr in enumerate(turn_results):
        action = scenario.turns[i].action if i < len(scenario.turns) else "?"
        narration = tr.dm_response.narration[:300]
        lines.append(f"Turn {i + 1}:\n  Player: {action}\n  DM: {narration}")

    turn_sequence = "\n\n".join(lines)
    prompt = _CONTINUITY_PROMPT_TEMPLATE.format(
        scenario_description=scenario.description[:300],
        turn_sequence=turn_sequence,
    )

    score = _call_judge(prompt, judge_model)
    if score == "N/A":
        score = _call_judge(prompt, judge_model)
    if isinstance(score, int):
        return float(score)
    return 3.0  # neutral fallback if both attempts return N/A or fail to parse
