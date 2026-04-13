---
type: decision
status: active
area: verify
updated: 2026-04-12
related:
  - "[[Verify Engine]]"
  - "[[Design Surface]]"
---

# ADR-005 Verify Schedule Contract Owns Sequential Clock Authority

## Context

Sequential clock semantics were already partially modeled in `VerifyScheduleContract`, but the surrounding surfaces were still allowed to drift.

- `VerifySurface` mixed `lastRun?.scheduleContract`, local helper insertion logic, and per-surface naming when deciding which clock to show or generate
- `bringupArtifacts.ts` had its own alternating-clock parity path for sequential starter vectors
- `DesignSurface` inferred live clock identity with `/clk|clock/i` label heuristics instead of using contract-backed timing guidance

This meant the same authored case/tick could be sampled under one authoritative clock contract in Verify while helper/default vectors or Design narration used a different local interpretation.

## Options Considered

### Option A — Let each surface infer the clock locally

Keep helper insertion, starter generation, and Design narration free to infer the clock from labels, `lastRun`, or local parity math.

Rejected because it preserves the current contradiction: sequential sampling can still be explained or generated differently across surfaces.

### Option B — Add a second Design-owned clock interpretation layer

Let Verify own run-time clock semantics, but let Design keep its own narration logic for live simulation and replay.

Rejected because it creates two authorities for one student-facing concept and guarantees future drift.

### Option C — Make the Verify schedule contract plus one shared helper module the only clock authority

Use one active `VerifyScheduleContract` plus shared helper functions to drive helper insertion, starter generation, and Design clock narration.

Chosen because it keeps one canonical sequential model across authoring, replay, and helper/default generation.

## Decision

RedByte uses one canonical sequential clock model.

- `VerifyScheduleContract` is the authoritative source for clock identity and sampling semantics across Verify and Design
- `resolveActiveScheduleContract(...)` selects the active contract: prefer the live contract when the last run is stale, hashless, or from a different circuit; otherwise use the matching run contract
- helper/default sequential clock vectors are generated only through the shared `clockAuthority.ts` module
- helper/default parity is absolute by sampled tick and starts low at `t0`
- the canonical rising edge is `0 -> 1`
- selected case/tick means the sampled state for that authored case; Design may narrate that state, but it may not reinterpret the clock locally

## Consequences

### Positive

- Verify helper buttons, bring-up starter vectors, and Design live clock narration now refer to the same clock model
- non-regex labels such as `Phase Driver` can still narrate the authoritative clock because Design consumes timing guidance rather than guessing from display text
- future sequential helpers have one obvious integration point instead of duplicating parity logic

### Negative

- any new sequential helper/default path must thread timing guidance or an active schedule contract; label heuristics are no longer acceptable
- surfaces that previously reached into `lastRun?.scheduleContract` directly now need to resolve the active contract first