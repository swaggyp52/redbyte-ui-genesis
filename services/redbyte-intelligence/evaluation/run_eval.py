from __future__ import annotations

import json
from pathlib import Path

from redbyte_intelligence.models import IntelligenceResponse


def load_dataset(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def score_response(actual: IntelligenceResponse, expected: dict) -> dict:
    verdict_ok = actual.verdict == expected.get("verdict")
    mismatch_overlap = len(set(actual.top_mismatches) & set(expected.get("top_mismatches", [])))
    return {
        "verdict_ok": verdict_ok,
        "mismatch_overlap": mismatch_overlap,
        "guidance_non_empty": bool(actual.guidance),
    }


def main() -> None:
    dataset_path = Path(__file__).resolve().parents[1] / "dataset" / "intelligence_eval.jsonl"
    rows = load_dataset(dataset_path)
    print(f"Loaded {len(rows)} eval rows from {dataset_path}")
    print("Evaluation runner scaffold is ready; wire service invocation in next step.")


if __name__ == "__main__":
    main()
