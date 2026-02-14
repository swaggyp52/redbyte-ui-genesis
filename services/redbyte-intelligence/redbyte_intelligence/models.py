from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class CompareSnapshot(BaseModel):
    has_sim_trace: bool = False
    has_hardware_trace: bool = False
    top_mismatches: list[str] = Field(default_factory=list)
    first_mismatch_tick: int | None = None


class EvidenceSnapshot(BaseModel):
    bundle_present: bool = False
    verdict: Literal["ready", "warning", "blocked", "unknown"] = "unknown"
    issues: list[str] = Field(default_factory=list)


class CoachingContext(BaseModel):
    lab_id: str = "freeplay"
    stage: Literal["build", "simulate", "hardware", "submit"] = "build"
    concept: str | None = None
    common_mistake: str | None = None


class RepairContext(BaseModel):
    hdl_excerpt: str | None = None
    error_messages: list[str] = Field(default_factory=list)


class IntelligenceRequest(BaseModel):
    compare: CompareSnapshot = Field(default_factory=CompareSnapshot)
    evidence: EvidenceSnapshot = Field(default_factory=EvidenceSnapshot)
    coach: CoachingContext = Field(default_factory=CoachingContext)
    repair: RepairContext = Field(default_factory=RepairContext)


class IntelligenceResponse(BaseModel):
    verdict: Literal["match", "mismatch", "pending"]
    top_mismatches: list[str] = Field(default_factory=list)
    first_mismatch: str = "n/a"
    guidance: list[str] = Field(default_factory=list)
    repair_suggestions: list[str] = Field(default_factory=list)
    trace_id: str | None = None
