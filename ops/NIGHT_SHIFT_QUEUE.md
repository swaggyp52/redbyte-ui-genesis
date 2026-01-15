# Night Shift Queue

**Last Updated**: 2026-01-14 23:10 UTC  
**Active Branch**: `feat/labs-phase-2a` (27 tests pass, ready for commit)

---

## Queue Rules

- One ticket = one branch = one PR
- Agent picks highest priority `READY` ticket
- Mark `IN_PROGRESS` when starting, `PR_OPEN` when done, `DONE` when merged
- Mark `BLOCKED` if uncertain/failing tests not caused by changes
- Max 2 tickets per night shift (safety limit — DO NOT RAISE without adding more verification)

## NO_REFACTOR Convention

**DEFAULT**: Workers must refuse large diffs unless ticket explicitly states `ALLOW_REFACTOR`.

- "Large diff" = >100 lines changed OR touches >3 files unrelated to goal
- If worker proposes refactor not in ticket: FAIL and log reason
- Morning-you decides if refactors are worth it, not overnight-agent

---

## [P0] [IN_PROGRESS] PHASE 2a: Lab Definition Schema + Parser
**Status**: IN_PROGRESS (Implementer complete, awaiting commit)  
**Branch**: `feat/labs-phase-2a`  
**Goal**: Create lab definition schema + JSON parser with validation  
**Files**:
- `packages/rb-logic-core/src/labs/labDefinition.ts` (new)
- `packages/rb-logic-core/src/labs/labParser.ts` (new)
- `packages/rb-logic-core/src/__tests__/lab-schema.test.tsx` (new)

**Acceptance**:
- ✅ Lab schema supports: labId, version, title, description, type, instructions, checkpoints
- ✅ Parser validates with detailed errors
- ✅ 27 tests pass (valid/invalid/examples)
- ✅ Build green

**Constraints**:
- New files only (non-breaking)
- No refactors
- No changes to existing code

**Next**: Commit + push + open PR with proof

---

## [P0] [READY] PHASE 2b: LabApp Component
**Status**: READY (blocked by 2a)  
**Branch**: `feat/labs-phase-2b` (create when 2a merged)  
**Goal**: Standalone LabApp component with instructions + editor + checkpoints  
**Files**:
- `packages/rb-apps/src/apps/LabApp.tsx` (new, ~400 lines)
- `packages/rb-apps/src/stores/labStore.ts` (new, Zustand)
- `packages/rb-apps/src/hooks/useLabSession.ts` (new)
- `packages/rb-apps/src/__tests__/lab-app.test.tsx` (new)

**Acceptance**:
- Lab opens with instructions visible + circuit editor side-by-side
- Checkpoint button triggers validation with pass/fail UI
- Checkpoint progress saved to localStorage per labId
- Session restore on close/reopen
- Title shows "Lab: [title] · [progress]"

**Constraints**:
- Use existing LogicPlaygroundApp patterns
- No changes to circuit engine
- Non-singleton (multiple lab windows allowed)
- Follow Window/Shell contracts from AI_STATE.md

**Reference**: See ARCHITECTURAL_REPORT_2026_01_14.md section 2.2

---

## [P0] [READY] PHASE 2c: Export Capsule Builder
**Status**: READY (blocked by 2b)  
**Branch**: `feat/labs-phase-2c`  
**Goal**: Export capsule schema + JSON builder with metadata  
**Files**:
- `packages/rb-logic-core/src/capsule/capsuleSchema.ts` (new)
- `packages/rb-logic-core/src/capsule/capsuleBuilder.ts` (new)
- `packages/rb-apps/src/components/ExportCapsuleModal.tsx` (new)
- `packages/rb-logic-core/src/__tests__/capsule-builder.test.tsx` (new)

**Acceptance**:
- Capsule structure: labId, version, studentName, timestamp, gitSha, appVersion, circuitSnapshot, checkpointResults
- circuitSnapshot preserves gates + connections in deterministic JSON
- Export button → modal → copy JSON or download .rbcapsule
- Round-trip test: export + re-import → identical circuit

**Constraints**:
- Deterministic serialization (same circuit = same JSON bytes)
- Git SHA injection at build time (fallback to appVersion if not available)
- No telemetry in v0 (optional field for future)

**Reference**: See ARCHITECTURAL_REPORT_2026_01_14.md section 2.3

---

## [P1] [READY] PHASE 2d: Checkpoint Validator
**Status**: READY (blocked by 2c)  
**Branch**: `feat/labs-phase-2d`  
**Goal**: Checkpoint validation engine + UI integration  
**Files**:
- `packages/rb-logic-core/src/checkpoint/checkpointValidator.ts` (new)
- `packages/rb-apps/src/components/CheckpointPanel.tsx` (new)
- `packages/rb-logic-core/src/__tests__/checkpoint-validator.test.tsx` (new)

**Acceptance**:
- Validator checks gate count, gate types, output count
- Deterministic pass/fail from circuit state + checkpoint definition
- UI shows checkpoint status (not attempted / in progress / passed)
- Pass → green badge + time logged
- Fail → red badge + feedback (e.g., "Need 2 ORs, got 1")

**Constraints**:
- Start with gate count only (topology validation in v1)
- All checkpoints accessible (no forced progression)
- Feedback messages structured around specific checks

**Reference**: See ARCHITECTURAL_REPORT_2026_01_14.md section 2.4

---

## [P2] [PARKED] System Search Registry Fixes
**Status**: PARKED (8 test failures, not blocking labs)  
**Goal**: Fix system-search.test.tsx registry initialization failures  
**Files**: `packages/rb-shell/src/__tests__/system-search.test.tsx`  
**Acceptance**: All 8 system-search tests pass  
**Constraints**: Test setup issue, not runtime bug. Low priority.

---

## Template for New Tickets

```markdown
## [P0/P1/P2] [READY/IN_PROGRESS/BLOCKED/PR_OPEN/DONE] Ticket Title
**Status**: READY  
**Branch**: `feat/descriptive-slug`  
**Goal**: One-sentence description  
**Files**:
- path/to/file1.ts (new/edit)
- path/to/file2.tsx (new/edit)

**Acceptance**:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests pass
- [ ] Build green

**Constraints**:
- Minimal diffs only
- No refactors unless required
- Follow AI_STATE.md invariants

**Reference**: (link to spec/issue if any)
```
