"""Tests for the LLM-as-judge module (DIN-68)."""

import json
import pytest
from unittest.mock import MagicMock, call, patch

with patch("config.anthropic_client", MagicMock()):
    from evals.judges import judge_turn, judge_continuity, _score_axis
    from evals.schema import AXES, Scenario, Turn, TurnResult, DMResponse


def _make_anthropic_mock(score: int | str = 4):
    """Return a mock anthropic client that always returns the given score."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(text=json.dumps({"score": score, "brief_rationale": "Looks good"}))
    ]
    mock_client.messages.create.return_value = mock_response
    return mock_client


def _make_na_then_valid_mock():
    """Return a mock that returns N/A first, then a valid score on retry."""
    mock_client = MagicMock()
    na_resp = MagicMock()
    na_resp.content = [MagicMock(text=json.dumps({"score": "N/A", "brief_rationale": "Not applicable"}))]
    valid_resp = MagicMock()
    valid_resp.content = [MagicMock(text=json.dumps({"score": 3, "brief_rationale": "OK"}))]
    mock_client.messages.create.side_effect = [na_resp, valid_resp] * 50
    return mock_client


def _make_bad_json_mock():
    """Return a mock that returns unparseable JSON on first call, valid on second."""
    mock_client = MagicMock()
    bad_resp = MagicMock()
    bad_resp.content = [MagicMock(text="not valid json at all")]
    valid_resp = MagicMock()
    valid_resp.content = [MagicMock(text=json.dumps({"score": 3, "brief_rationale": "OK"}))]
    mock_client.messages.create.side_effect = [bad_resp, valid_resp] * 50
    return mock_client


class TestJudgeTurn:
    """Tests for judge_turn: scoring a single DM response turn."""

    def test_makes_three_calls_per_axis(self):
        """judge_turn calls the judge LLM at least 3 times per axis (15+ calls for 5 axes)."""
        mock_client = _make_anthropic_mock(4)
        with patch("evals.judges.anthropic_client", mock_client):
            result = judge_turn(
                prior_context="Party enters the dungeon.",
                action="I try to pick the lock.",
                dm_response="You carefully manipulate the lock. It clicks open.",
                state_snapshot={},
                expected_capabilities=["skill_check"],
                sample_size=3,
            )
        # Each axis calls the API sample_size times, but N/A retries may add more.
        # At minimum: 5 axes * 3 samples = 15 calls, possibly more due to retries.
        assert mock_client.messages.create.call_count >= 15
        assert len(result.rubric_scores) == 5
        for axis in AXES:
            assert axis in result.rubric_scores

    def test_mean_calculation_from_samples(self):
        """Mean of [3, 4, 5] = 4.0 for an axis."""
        scores = [3, 4, 5]
        mock_client = MagicMock()
        responses = [
            MagicMock(content=[MagicMock(text=json.dumps({"score": s, "brief_rationale": "x"}))])
            for s in scores * 10  # enough for all axes
        ]
        mock_client.messages.create.side_effect = responses

        with patch("evals.judges.anthropic_client", mock_client):
            # Test _score_axis directly for deterministic behavior
            mean, samples = _score_axis(
                axis="rule_compliance",
                prior_context="",
                action="Attack!",
                dm_response="You strike the goblin.",
                state_snapshot={},
                expected_capabilities=[],
                judge_model="claude-haiku-4-5-20251001",
                sample_size=3,
            )
        assert samples[:3] == [3, 4, 5]
        assert abs(mean - 4.0) < 0.01

    def test_na_excluded_from_mean(self):
        """N/A samples are excluded; mean computed over remaining non-N/A samples."""
        mock_client = MagicMock()
        # First call: N/A → retry → 4; second call: N/A → retry → 4; third: 4 directly
        responses = []
        for _ in range(3):
            responses.append(MagicMock(content=[MagicMock(text=json.dumps({"score": "N/A", "brief_rationale": "n/a"}))]))
            responses.append(MagicMock(content=[MagicMock(text=json.dumps({"score": 4, "brief_rationale": "good"}))]))
        mock_client.messages.create.side_effect = responses * 10

        with patch("evals.judges.anthropic_client", mock_client):
            mean, samples = _score_axis(
                axis="state_correctness",
                prior_context="",
                action="I heal myself.",
                dm_response="HP restored.",
                state_snapshot={},
                expected_capabilities=["state_update"],
                judge_model="claude-haiku-4-5-20251001",
                sample_size=3,
            )
        # After N/A retry, each slot should resolve to 4
        numeric = [s for s in samples if isinstance(s, int)]
        assert len(numeric) > 0, "Retry should have resolved N/A to numeric scores"
        assert abs(mean - sum(numeric) / len(numeric)) < 0.01

    def test_parse_retry_on_malformed_json(self):
        """On malformed JSON from judge, retries once; records N/A if both fail."""
        mock_client = _make_bad_json_mock()
        with patch("evals.judges.anthropic_client", mock_client):
            mean, samples = _score_axis(
                axis="hallucination",
                prior_context="",
                action="Look around.",
                dm_response="You see nothing unusual.",
                state_snapshot={},
                expected_capabilities=[],
                judge_model="claude-haiku-4-5-20251001",
                sample_size=3,
            )
        # Should have 3 samples (some may be N/A due to parse failure, some 3 after retry)
        assert len(samples) == 3

    def test_hallucination_axis_not_inverted(self):
        """Hallucination score 5 = no hallucination; returned as-is (not inverted)."""
        mock_client = _make_anthropic_mock(5)
        with patch("evals.judges.anthropic_client", mock_client):
            mean, samples = _score_axis(
                axis="hallucination",
                prior_context="",
                action="Look at the guard.",
                dm_response="The guard stands at attention.",
                state_snapshot={},
                expected_capabilities=[],
                judge_model="claude-haiku-4-5-20251001",
                sample_size=3,
            )
        assert all(s == 5 for s in samples if isinstance(s, int))
        assert mean == 5.0

    def test_returns_turn_score_with_all_axes(self):
        """TurnScore.rubric_scores contains keys for all 5 axes."""
        mock_client = _make_anthropic_mock(4)
        with patch("evals.judges.anthropic_client", mock_client):
            result = judge_turn(
                prior_context="Context.",
                action="I attack.",
                dm_response="You hit for 8 damage.",
                state_snapshot={"hp": 40},
                expected_capabilities=["combat"],
                sample_size=1,
            )
        assert set(result.rubric_scores.keys()) == set(AXES)
        assert set(result.rubric_samples.keys()) == set(AXES)


class TestJudgeContinuity:
    """Tests for judge_continuity: cross-turn coherence scoring."""

    def test_returns_single_float_score(self):
        """judge_continuity returns a float between 1.0 and 5.0."""
        mock_client = _make_anthropic_mock(4)
        scenario = Scenario.model_validate({
            "id": "test_continuity",
            "category": "combat",
            "description": "Combat scenario.",
            "seed_state_file": "fixtures/states/tavern_low_level.json",
            "seed_events": [],
            "turns": [
                {"action": "I attack!", "expected_capabilities": ["combat"]},
                {"action": "I attack again!", "expected_capabilities": ["combat"]},
            ],
        })
        dm_resp = DMResponse(narration="You strike!", state_updates={}, metadata={})
        tr1 = TurnResult(turn_index=0, dm_response=dm_resp, rubric_scores={}, rubric_samples={})
        tr2 = TurnResult(turn_index=1, dm_response=dm_resp, rubric_scores={}, rubric_samples={})

        with patch("evals.judges.anthropic_client", mock_client):
            score = judge_continuity(scenario=scenario, turn_results=[tr1, tr2])
        assert 1.0 <= score <= 5.0

    def test_model_parameter_forwarded(self):
        """judge_model parameter is passed to the anthropic client create call."""
        mock_client = _make_anthropic_mock(3)
        scenario = Scenario.model_validate({
            "id": "test",
            "category": "social",
            "description": "Social test.",
            "seed_state_file": "fixtures/states/tavern_low_level.json",
            "seed_events": [],
            "turns": [
                {"action": "I talk.", "expected_capabilities": []},
                {"action": "I talk more.", "expected_capabilities": []},
            ],
        })
        dm_resp = DMResponse(narration="NPC responds.", state_updates={}, metadata={})
        turn_results = [
            TurnResult(turn_index=i, dm_response=dm_resp, rubric_scores={}, rubric_samples={})
            for i in range(2)
        ]

        custom_model = "claude-haiku-4-5-20251001"
        with patch("evals.judges.anthropic_client", mock_client):
            judge_continuity(scenario=scenario, turn_results=turn_results, judge_model=custom_model)

        call_kwargs = mock_client.messages.create.call_args_list[-1][1]
        assert call_kwargs.get("model") == custom_model or (
            mock_client.messages.create.call_args_list[-1][0]
            and mock_client.messages.create.call_args_list[-1][0][0] == custom_model
        )
