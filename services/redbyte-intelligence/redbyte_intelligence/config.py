from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class IntelligenceConfig:
    project_endpoint: str
    default_model: str
    orchestrator_model: str
    diff_model: str
    evidence_model: str
    coach_model: str
    repair_model: str
    host: str
    port: int
    trace_enabled: bool
    log_level: str


def _read(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def load_config() -> IntelligenceConfig:
    default_model = _read("AZURE_AI_MODEL_DEPLOYMENT_NAME", "")
    project_endpoint = _read("AZURE_AI_PROJECT_ENDPOINT", "")

    return IntelligenceConfig(
        project_endpoint=project_endpoint,
        default_model=default_model,
        orchestrator_model=_read("REDBYTE_ORCH_MODEL", default_model),
        diff_model=_read("REDBYTE_DIFF_MODEL", default_model),
        evidence_model=_read("REDBYTE_EVIDENCE_MODEL", default_model),
        coach_model=_read("REDBYTE_COACH_MODEL", default_model),
        repair_model=_read("REDBYTE_REPAIR_MODEL", default_model),
        host=_read("REDBYTE_INTELLIGENCE_HOST", "127.0.0.1"),
        port=int(_read("REDBYTE_INTELLIGENCE_PORT", "8087") or "8087"),
        trace_enabled=_read("REDBYTE_TRACE_ENABLED", "1") not in {"0", "false", "False"},
        log_level=_read("REDBYTE_LOG_LEVEL", "INFO"),
    )
