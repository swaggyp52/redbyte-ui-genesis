from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field

from .config import load_config
from .tracing import configure_logging, trace_scope

load_dotenv(override=False)
config = load_config()
configure_logging(config.log_level)

app = FastAPI(title="RedByte Intelligence Core", version="0.1.0")


class AnalyzeTraces(BaseModel):
    sim: str | None = None
    hw: str | None = None


class AnalyzeGate(BaseModel):
    code: str | None = None
    severity: str | None = None
    title: str | None = None
    message: str | None = None


class AnalyzeRequest(BaseModel):
    projectId: str | None = None
    labId: str = "freeplay"
    stage: Literal["build", "simulate", "hardware", "submit"] = "build"
    projectSummary: str = ""
    traces: AnalyzeTraces | None = None
    gates: list[AnalyzeGate] = Field(default_factory=list)
    userIntent: str = "explain-next-step"


class AnalyzeAction(BaseModel):
    label: str
    title: str | None = None
    why: str | None = None
    fixIntent: str | None = None
    severity: Literal["blocking", "warning"] | None = None
    intent: str = "open-stage"
    targetStage: Literal["build", "simulate", "hardware", "submit"] | None = None
    targetTestId: str | None = None


class AnalyzeResponse(BaseModel):
    summary: str
    actions: list[AnalyzeAction] = Field(default_factory=list)
    confidence: float
    citations: list[str] | None = None
    debug: dict


def _load_curriculum() -> dict:
    data_path = Path(__file__).resolve().parents[1] / "data" / "curriculum.json"
    try:
        text = data_path.read_text(encoding="utf-8")
        return json.loads(text)
    except Exception:
        return {}


CURRICULUM = _load_curriculum()


def _stage_payload(lab_id: str, stage: str) -> tuple[dict, str, bool]:
    freeplay = CURRICULUM.get("freeplay", {})
    freeplay_stage = freeplay.get("stages", {}).get(stage, {})
    source = "freeplay"
    used_fallback = True

    if lab_id in CURRICULUM:
        lab_stage = CURRICULUM[lab_id].get("stages", {}).get(stage, {})
        if lab_stage:
            return lab_stage, lab_id, False

    if freeplay_stage:
        return freeplay_stage, source, used_fallback

    default_stage = {
        "nextStep": "Continue the current stage checklist and capture one verifiable artifact.",
        "why": "A small verified artifact keeps progress deterministic.",
        "mistakes": [
            "Moving forward without evidence.",
            "Ignoring stage-specific checks.",
            "Not documenting observed behavior.",
        ],
        "action": {"label": "Open current stage", "targetStage": stage, "targetTestId": None},
    }
    return default_stage, "default", True


def _infer_fix_intent(code: str, stage: str) -> str:
    normalized = (code or "").strip().lower()
    if any(token in normalized for token in ("profile", "preset", "constraints", "xdc")):
        return "hardware.configureProfile"
    if any(token in normalized for token in ("board", "bitstream", "program", "hardware", "toolchain")):
        return "hardware.captureTrace"
    if any(token in normalized for token in ("wave", "probe", "simulate", "sim", "synth")):
        return "simulate.configureProbes"
    if any(token in normalized for token in ("top", "port", "build", "syntax", "module")):
        return "build.openTopModule"
    if stage == "submit":
        return "submit.reviewGates"
    return "build.openTopModule"


def _build_evidence_response(payload: AnalyzeRequest) -> AnalyzeResponse:
    stage_info, source, fallback_used = _stage_payload(payload.labId.strip() or "freeplay", "submit")
    blocking_gates = [gate for gate in payload.gates if (gate.severity or "").lower() == "block"]
    warning_gates = [gate for gate in payload.gates if (gate.severity or "").lower() != "block"]

    if len(payload.gates) == 0:
        return AnalyzeResponse(
            summary="I can't see submit gate failures yet. Run submission preflight so I can explain blocking and warning issues.",
            actions=[
                AnalyzeAction(
                    label="Open submit gates",
                    title="Run submit preflight",
                    why="Gate output is required for grounded explanations.",
                    fixIntent="submit.reviewGates",
                    severity="warning",
                    intent="open-stage",
                    targetStage="submit",
                    targetTestId="lab-workspace-anchor-submit-generate",
                ),
            ],
            confidence=0.62,
            citations=[f"curriculum:{source}#submit"],
            debug={
                "source": source,
                "fallbackUsed": fallback_used,
                "mode": "evidence",
                "grounding": [f"curriculum:{source}#submit", "gate:missing"],
            },
        )

    actions: list[AnalyzeAction] = []
    grounding: list[str] = [f"curriculum:{source}#submit"]
    for gate in [*blocking_gates, *warning_gates][:3]:
        title = (gate.title or gate.code or "Gate issue").strip()
        detail = (gate.message or "This gate failed without additional detail.").strip()
        severity = "blocking" if (gate.severity or "").lower() == "block" else "warning"
        fix_intent = _infer_fix_intent(gate.code or "", payload.stage)
        target_stage = "submit" if fix_intent == "submit.reviewGates" else (
            "hardware" if fix_intent.startswith("hardware") else "simulate" if fix_intent.startswith("simulate") else "build"
        )
        target_test_id = (
            "lab-workspace-anchor-submit-generate" if target_stage == "submit"
            else "lab-workspace-anchor-hardware-board-detect" if target_stage == "hardware"
            else "lab-workspace-anchor-simulate-probes" if target_stage == "simulate"
            else "lab-workspace-anchor-build-top-module"
        )
        actions.append(
            AnalyzeAction(
                label=title,
                title=title,
                why=detail,
                fixIntent=fix_intent,
                severity=severity,
                intent="open-stage",
                targetStage=target_stage,
                targetTestId=target_test_id,
            ),
        )
        grounding.append(f"gate:{gate.code or 'unknown'}")

    summary = (
        "You're blocked because one or more submit gates are failing."
        if len(blocking_gates) > 0
        else "You have warnings in submit gates that can lower confidence in your evidence."
    )
    why_hint = stage_info.get("why", "Submission gates keep grading and reproducibility deterministic.")
    confidence = 0.9 if len(blocking_gates) > 0 else 0.85

    return AnalyzeResponse(
        summary=f"{summary}\nWhy it matters: {why_hint}",
        actions=actions,
        confidence=confidence,
        citations=[f"curriculum:{source}#submit"],
        debug={
            "source": source,
            "fallbackUsed": fallback_used,
            "mode": "evidence",
            "grounding": grounding,
            "projectSummary": payload.projectSummary,
            "projectId": payload.projectId,
            "gateCount": len(payload.gates),
            "blockingCount": len(blocking_gates),
            "warningCount": len(warning_gates),
        },
    )


def _build_response(payload: AnalyzeRequest) -> AnalyzeResponse:
    stage_info, source, fallback_used = _stage_payload(payload.labId.strip() or "freeplay", payload.stage)
    mistakes = stage_info.get("mistakes", [])
    top_mistakes = [entry for entry in mistakes if isinstance(entry, str)][:3]
    why = stage_info.get("why", "")
    summary_lines = [
        stage_info.get("nextStep", "Continue the current stage checklist."),
        f"Why it matters: {why}" if isinstance(why, str) and why.strip() else "Why it matters: keep this stage deterministic before moving on.",
    ]
    if top_mistakes:
        summary_lines.append("Common mistakes: " + "; ".join(top_mistakes))

    action_raw = stage_info.get("action", {}) if isinstance(stage_info.get("action", {}), dict) else {}
    action = AnalyzeAction(
        label=str(action_raw.get("label", "Open current stage")),
        intent="open-stage",
        targetStage=(action_raw.get("targetStage") if action_raw.get("targetStage") in {"build", "simulate", "hardware", "submit"} else payload.stage),
        targetTestId=(str(action_raw.get("targetTestId")) if action_raw.get("targetTestId") else None),
    )

    has_gate_blockers = any((gate.severity or "").lower() == "block" for gate in payload.gates)
    confidence = 0.9 if source not in {"default", "freeplay"} else 0.76
    if has_gate_blockers:
        confidence = max(0.72, confidence - 0.08)

    return AnalyzeResponse(
        summary="\n".join(summary_lines),
        actions=[action],
        confidence=round(confidence, 2),
        citations=[f"curriculum:{source}#{payload.stage}"],
        debug={
            "source": source,
            "fallbackUsed": fallback_used,
            "labId": payload.labId,
            "stage": payload.stage,
            "userIntent": payload.userIntent,
            "gateCount": len(payload.gates),
            "traceFlags": {
                "sim": bool(payload.traces and payload.traces.sim),
                "hw": bool(payload.traces and payload.traces.hw),
            },
        },
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "redbyte-intelligence", "trace": config.trace_enabled}


@app.post("/v1/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    with trace_scope("v1.analyze", enabled=config.trace_enabled):
        is_evidence_mode = (
            request.userIntent.strip().lower() in {"explain-issues", "evidence-explain"}
            or request.stage == "submit"
            or len(request.gates) > 0
        )
        if is_evidence_mode:
            return _build_evidence_response(request)
        return _build_response(request)
