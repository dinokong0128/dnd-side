"""Pydantic models for the eval harness schema."""

from typing import Literal
from pydantic import BaseModel, field_validator


class AdversarialCheck(BaseModel):
    type: Literal["state_unchanged", "no_mechanic_bypass"]
    field: str | None = None
    tolerance: float | None = None
    description: str | None = None


class Turn(BaseModel):
    action: str
    expected_capabilities: list[str] = []


class SeedEvent(BaseModel):
    turn_offset: int
    content: str

    @field_validator("turn_offset")
    @classmethod
    def must_be_negative(cls, v: int) -> int:
        if v >= 0:
            raise ValueError("turn_offset must be negative (relative to scenario start)")
        return v


class Scenario(BaseModel):
    id: str
    category: Literal["skill_check", "combat", "social", "continuity", "rule_edge", "adversarial"]
    description: str
    seed_state_file: str
    seed_events: list[SeedEvent] = []
    turns: list[Turn]
    adversarial_checks: list[AdversarialCheck] = []
    fallback_states: list[dict] = []

    @field_validator("turns")
    @classmethod
    def at_least_one_turn(cls, v: list[Turn]) -> list[Turn]:
        if len(v) < 1:
            raise ValueError("Scenario must have at least one turn")
        return v


class DMResponse(BaseModel):
    narration: str
    state_updates: dict = {}
    metadata: dict = {}


class TurnResult(BaseModel):
    turn_index: int
    dm_response: DMResponse
    rubric_scores: dict[str, float | None] = {}
    rubric_samples: dict[str, list] = {}
    adversarial_results: list[dict] = []


class ScenarioResult(BaseModel):
    scenario_id: str
    turn_results: list[TurnResult] = []
    continuity_score: float | None = None
    adversarial_gate_passed: bool = True
    errors: list[str] = []


class RunReport(BaseModel):
    run_id: str
    target_name: str
    model: str
    scenario_results: list[ScenarioResult] = []
    aggregate: dict = {}
