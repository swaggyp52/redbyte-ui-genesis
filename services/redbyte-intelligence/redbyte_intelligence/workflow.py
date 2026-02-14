from __future__ import annotations

import json
from typing import Any

from .models import IntelligenceRequest, IntelligenceResponse


def _to_text(result: Any) -> str:
    text = getattr(result, "text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()
    return str(result)


async def run_orchestration(agents: dict[str, Any], request: IntelligenceRequest) -> IntelligenceResponse:
    compare_payload = json.dumps(request.compare.model_dump(), ensure_ascii=False)
    evidence_payload = json.dumps(request.evidence.model_dump(), ensure_ascii=False)
    coach_payload = json.dumps(request.coach.model_dump(), ensure_ascii=False)
    repair_payload = json.dumps(request.repair.model_dump(), ensure_ascii=False)

    diff_result = await agents["diff"].run(f"Analyze compare payload: {compare_payload}")
    evidence_result = await agents["evidence"].run(f"Analyze evidence payload: {evidence_payload}")
    coach_result = await agents["coach"].run(f"Coach using context: {coach_payload}")
    repair_result = await agents["repair"].run(f"Suggest fixes for: {repair_payload}")

    stitched = {
        "diff": _to_text(diff_result),
        "evidence": _to_text(evidence_result),
        "coach": _to_text(coach_result),
        "repair": _to_text(repair_result),
        "request": request.model_dump(),
    }

    summary_prompt = (
        "Build RedByte response envelope JSON with keys: "
        "verdict(match|mismatch|pending), top_mismatches(string[]), first_mismatch(string), "
        "guidance(string[]), repair_suggestions(string[]).\n"
        f"Input data: {json.dumps(stitched, ensure_ascii=False)}"
    )

    final_result = await agents["orchestrator"].run(summary_prompt)
    final_text = _to_text(final_result)

    try:
        parsed = json.loads(final_text)
    except json.JSONDecodeError:
        parsed = {
            "verdict": "pending",
            "top_mismatches": request.compare.top_mismatches,
            "first_mismatch": (
                str(request.compare.first_mismatch_tick)
                if request.compare.first_mismatch_tick is not None
                else "n/a"
            ),
            "guidance": [final_text],
            "repair_suggestions": [],
        }

    return IntelligenceResponse.model_validate(parsed)
