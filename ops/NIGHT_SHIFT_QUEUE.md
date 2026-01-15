# Night Shift Queue

**Last Updated**: 2026-01-14 23:45 UTC  
**Current Phase**: ECE Lab App + FPGA Bridge MVP (Phase H0 + H2)  
**Read These First**:
- [NIGHT_SHIFT_FINAL_DIRECTIVE.md](../docs/NIGHT_SHIFT_FINAL_DIRECTIVE.md) ← START HERE (complete implementation guide)
- [ECE_LAB_COMPLETE_UX.md](../docs/ECE_LAB_COMPLETE_UX.md) (full student-instructor journey)
- [ECE_LAB_ROADMAP.md](../docs/ECE_LAB_ROADMAP.md) (architecture context)
- [BRIDGE_MVP.md](../docs/BRIDGE_MVP.md) (wire protocol spec)

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

---

## ECE LAB + BRIDGE TICKETS (Phase H0–H2)

**Context**: See [ECE_LAB_ROADMAP.md](../docs/ECE_LAB_ROADMAP.md) and [BRIDGE_MVP.md](../docs/BRIDGE_MVP.md)

These tickets implement a complete lab runtime + hardware bridge (stub mode).

---

### [P0] [DONE] ECE-LAB-H0.1: Lab Session State Machine
**Status**: DONE (merged)  
**Branch**: `feat/ece-lab-h0.1-session-state`  
**Commit**: f3c32dcb  
**Goal**: Zustand store for lab session lifecycle, checkpoint tracking, persistence  
**Files**:
- `packages/rb-logic-core/src/lab/LabSession.ts` (new) — interfaces
- `packages/rb-logic-core/src/lab/sessionStore.ts` (new) — Zustand store
- `packages/rb-logic-core/src/__tests__/lab-session.test.tsx` (new)

**Acceptance**:
- [x] Session can be created with labId, studentId
- [x] Session persists to localStorage (create, save, load, destroy)
- [x] Checkpoint results accumulate + update individually
- [x] Session can be restored from JSON capsule snapshot
- [x] All tests pass (24 tests passing), no memory leaks

**Proof Artifacts**:
- Test output: 24 passing, 0 failures
- Build: ✓ (869 modules)
- Lint: ✓
- Circuit snapshot stored as deterministic JSON for round-trip

**Constraints**:
- [x] New files only, no existing changes
- [x] Use Zustand (existing pattern in codebase)
- [x] localStorage keys: `redbyte.lab.session.${sessionId}`

**Reference**: [ECE_LAB_ROADMAP.md § Phase H0.1](../docs/ECE_LAB_ROADMAP.md#h01-lab-session-state-machine)

---

### [P0] [IN_PROGRESS] ECE-LAB-H0.2: Checkpoint Evaluator
### [P0] [DONE] ECE-LAB-H0.2: Checkpoint Evaluator
**Status**: DONE (merged)  
**Branch**: `feat/ece-lab-h0.2-evaluator`  
**Commit**: 955e7600  
**Goal**: Generic checkpoint evaluation engine (truth table, structure, constraints)  
**Files**:
- `packages/rb-logic-core/src/lab/CheckpointDef.ts` (new) — schema
- `packages/rb-logic-core/src/lab/evaluateCheckpoint.ts` (new) — main evaluator
- `packages/rb-logic-core/src/lab/structureChecker.ts` (new) — gate/constraint checking
- `packages/rb-logic-core/src/__tests__/checkpoint-evaluator.test.tsx` (new, 22 tests)

**Acceptance**:
- [x] Truth table: correct pass/fail for all vector matches + mismatches
- [x] Constraint checks: gate count, required parts, forbidden parts
- [x] Structure checks: correct part detection (AND, OR, NOT, etc.)
- [x] Stability settling: wait before probing if enabled
- [x] Performance: 100 vectors in <500ms (way under 10ms target)
- [x] All tests pass (22 passing)

**Proof Artifacts**:
- Test output: 22 passing, 0 failures
- Build: ✓ (869 modules)
- Lint: ✓

**Constraints**:
- [x] New files only
- [x] No changes to circuit engine
- [x] Reuse existing gate/node types from logic-core

**Reference**: [ECE_LAB_ROADMAP.md § Phase H0.2](../docs/ECE_LAB_ROADMAP.md#h02-checkpoint-evaluator)

---

### [P0] [DONE] ECE-LAB-H0.3: Export Capsule v0→v1
**Status**: DONE (Commit: 7e6043bc)  
**Branch**: `feat/ece-lab-h0.3-capsule-export`  
**Goal**: Serialize session + circuit + results into downloadable CapsuleV1 JSON  
**Files**:
- `packages/rb-logic-core/src/lab/CapsuleV1.ts` (new) — interfaces + schema
- `packages/rb-logic-core/src/lab/capsuleExporter.ts` (new) — exporter + validator
- `packages/rb-logic-core/src/__tests__/capsule-exporter.test.tsx` (new) — 27 tests
- `packages/rb-logic-core/src/lab/index.ts` (new) — exports

**Acceptance**:
- ✅ Exported capsule includes: labId, version, studentId, timestamp, circuit snapshot, checkpoint results
- ✅ Capsule passes schema validation (CapsuleV1 interface enforced)
- ✅ Blob prepared for download with correct MIME type
- ✅ Round-trip: export + parse = identical structure (2 tests)
- ✅ Integrity checksums: circuit hash + checksumInput hash (deterministic)
- ✅ Deep copy circuit (no shared references, 4 tests)
- ✅ Capsule verification detects tampering (3 tests)
- ✅ Edge cases: empty circuits, no checkpoints, 150-node circuits (3 tests)
- ✅ All 27 tests passing (100%)
- ✅ Build green (872 modules)

**Proof**:
- Test output: `pnpm test -- capsule-exporter` → 27/27 passing
- Build output: `pnpm build` → All packages built successfully (no errors)
- Commit: 7e6043bc "feat: ECE Lab H0.3 - Capsule Export (Session Serialization)"

**Reference**: [ECE_LAB_ROADMAP.md § Phase H0.3](../docs/ECE_LAB_ROADMAP.md#h03-export-capsule-v0--v1)

---

### [P0] [IN_PROGRESS] ECE-LAB-H0.4: Import + Replay (Instructor View)
**Status**: IN_PROGRESS (unblocked by H0.3)  
**Branch**: `feat/ece-lab-h0.4-import-replay`  
**Goal**: Instructor can drag-drop student capsule + see read-only replay  
**Files**:
- `packages/rb-apps/src/lab/CapsuleImporter.tsx` (new) — file handler
- `packages/rb-apps/src/lab/ReplayView.tsx` (new) — read-only viewer
- `packages/rb-logic-core/src/__tests__/capsule-import.test.tsx` (new)

**Acceptance**:
- [ ] Capsule file drag-drop + JSON parsing
- [ ] Circuit reconstructed identically from snapshot
- [ ] Checkpoint results displayed with pass/fail badges
- [ ] Replay view is read-only (no circuit editing)
- [ ] Graceful errors for corrupt capsules
- [ ] All tests pass

**Constraints**:
- New files only
- No changes to existing LogicLabApp
- Reuse circuit visualization (read-only mode)

**Reference**: [ECE_LAB_ROADMAP.md § Phase H0.4](../docs/ECE_LAB_ROADMAP.md#h04-import--replay-grading-workflow)

---

### [P0] [READY] ECE-LAB-H0.6: LogicLabApp UI Shell
**Status**: READY (after H0.4)  
**Branch**: `feat/ece-lab-h0.6-ui-shell`  
**Goal**: Rework placeholder LogicLabApp.tsx into functional lab environment  
**Files**:
- `packages/rb-apps/src/apps/LogicLabApp.tsx` (edit) — main component + layout
- `packages/rb-apps/src/lab/CheckpointList.tsx` (new) — checkpoint list
- `packages/rb-apps/src/lab/InstructionsPanel.tsx` (new) — instructions + hints
- `packages/rb-apps/src/__tests__/logic-lab-app.test.tsx` (new)

**Acceptance**:
- [ ] Layout: header (title, difficulty, timer) | left (instructions, hints) | right (editor, checkpoints)
- [ ] Instructions markdown render
- [ ] Checkpoint list shows all with pass/fail badges
- [ ] "Run Checks (Sim)" button wired to evaluator
- [ ] "Export Submit" button downloads capsule
- [ ] "Import Capsule" button loads and shows replay
- [ ] Responsive on 16:9 displays
- [ ] All tests pass

**Constraints**:
- Edit LogicLabApp.tsx only (keep existing placeholder)
- Reuse circuit editor from LogicPlaygroundApp
- No refactors to other apps

**Reference**: [ECE_LAB_ROADMAP.md § Phase H0.6](../docs/ECE_LAB_ROADMAP.md#h06-logiclab-ui-shell)

---

### [P1] [READY] ECE-LAB-H1.1: Hardware Target Abstraction
**Status**: READY (after H0.6)  
**Branch**: `feat/ece-lab-h1.1-target-abstraction`  
**Goal**: Generic interface for sim + hardware targets  
**Files**:
- `packages/rb-logic-core/src/lab/Target.ts` (new) — interfaces + SimTarget implementation
- `packages/rb-logic-core/src/lab/targetRegistry.ts` (new) — registry
- `packages/rb-logic-core/src/__tests__/target.test.tsx` (new)

**Acceptance**:
- [ ] Target interface: kind, name, getCapabilities(), runVectors()
- [ ] SimTarget wraps existing logic core evaluation
- [ ] Registry allows lookup + iteration
- [ ] Checkpoint schema extended: `.targets: string[]`
- [ ] All tests pass

**Constraints**:
- New files only
- SimTarget reuses existing circuit evaluation
- HardwareTarget stub (placeholder for H2)

**Reference**: [ECE_LAB_ROADMAP.md § Phase H1.1](../docs/ECE_LAB_ROADMAP.md#h11-hardware-target-interface)

---

### [P1] [READY] ECE-LAB-H2.1: Bridge Local Service (Stub)
**Status**: READY  
**Branch**: `feat/ece-lab-h2.1-bridge-service`  
**Goal**: Node.js WebSocket service (127.0.0.1:31888) with stub backend  
**Files**:
- `tools/redbyte-bridge/package.json` (new)
- `tools/redbyte-bridge/src/server.ts` (new)
- `tools/redbyte-bridge/src/backends/stub.ts` (new)
- `tools/redbyte-bridge/src/handlers/*.ts` (new, 6 files: hello, ping, session_start, batch_run, session_end, device_list)
- `tools/redbyte-bridge/src/types.ts` (new)
- `tools/redbyte-bridge/.env.example` (new)
- `tools/redbyte-bridge/README.md` (new)

**Acceptance**:
- [ ] Service starts on port 31888 without errors
- [ ] Responds to hello/ping with correct protocol
- [ ] session_start creates valid sessionId
- [ ] batch_run with echo/invert backends correct
- [ ] Proper error responses for invalid messages
- [ ] Logs JSON (one line per message)
- [ ] Can run in background (detached)
- [ ] Manual smoke test: curl/websocat connections work

**Constraints**:
- Stub backend only (no serial in MVP)
- device_list returns empty array
- No authentication (localhost only)
- Use ws library or native WebSocket

**Reference**: [BRIDGE_MVP.md § Backend, Server, Messages](../docs/BRIDGE_MVP.md)

---

### [P1] [READY] ECE-LAB-H2.2: BridgeClient Adapter
**Status**: READY (after H2.1)  
**Branch**: `feat/ece-lab-h2.2-bridge-client`  
**Goal**: TypeScript client for Bridge; graceful fallback when unavailable  
**Files**:
- `packages/rb-logic-core/src/lab/bridge/BridgeClient.ts` (new)
- `packages/rb-logic-core/src/lab/bridge/errors.ts` (new)
- `packages/rb-logic-core/src/__tests__/bridge-client.test.tsx` (new)

**Acceptance**:
- [ ] `static async connect(port?)`: opens WS, sends hello, waits for ack
- [ ] `isConnected()`: returns boolean
- [ ] `getCapabilities()`: returns capabilities or null if disconnected
- [ ] `startSession(target, options)`: returns sessionId
- [ ] `batchRun(sessionId, spec, vectors)`: returns results
- [ ] `endSession(sessionId)`: closes session
- [ ] `onDisconnect(callback)`: listener for disconnect events
- [ ] Reconnection logic: exponential backoff, max 5 attempts
- [ ] Stub mode: falls back to SimTarget if bridge unavailable
- [ ] All tests pass (mocked bridge)

**Constraints**:
- New files only
- Can be in rb-logic-core or separate rb-bridge-client package
- TypeScript strict mode
- No external deps beyond existing (ws optional in browser, not used)

**Reference**: [BRIDGE_MVP.md § RedByte Client Integration](../docs/BRIDGE_MVP.md#redbyte-client-integration)

---

### [P1] [READY] ECE-LAB-H2.3: Lab App Bridge Integration
**Status**: READY (after H2.2)  
**Branch**: `feat/ece-lab-h2.3-bridge-integration`  
**Goal**: Wire BridgeClient into LogicLabApp + checkpoint UI  
**Files**:
- `packages/rb-apps/src/hooks/useBridge.ts` (new) — React hook
- `packages/rb-apps/src/lab/TargetSelector.tsx` (new) — UI dropdown
- `packages/rb-apps/src/apps/LogicLabApp.tsx` (edit) — integrate useBridge, show selector

**Acceptance**:
- [ ] useBridge hook connects on mount, handles reconnect
- [ ] TargetSelector dropdown shows "Simulation" always
- [ ] TargetSelector shows "Hardware" only when bridge connected
- [ ] Checkpoint "Run Checks" button respects selected target
- [ ] Hardware results tagged in export capsule
- [ ] Disconnect during run: graceful error, no crash
- [ ] "Hardware: Connected/Offline" indicator displayed
- [ ] All tests pass

**Constraints**:
- Edit LogicLabApp.tsx and add new files
- No changes to checkpoint evaluator
- Reuse existing Result/Badge components

**Reference**: [BRIDGE_MVP.md § RedByte Client Integration](../docs/BRIDGE_MVP.md#redbyte-client-integration) + [ECE_LAB_ROADMAP.md § H2.3](../docs/ECE_LAB_ROADMAP.md#h23-lab-app-integration)

---

### [P1] [READY] ECE-LAB-H2.4: Smoke Test (E2E)
**Status**: READY (after H2.3)  
**Branch**: `feat/ece-lab-h2.4-smoke-test`  
**Goal**: Headless Playwright test: bridge connect → run checkpoint → export  
**Files**:
- `tests/bridge-e2e.spec.ts` (new)

**Acceptance**:
- [ ] Test setup: start bridge server (stub mode)
- [ ] Test 1: Browser connects, "Hardware: Connected" appears
- [ ] Test 2: Select hardware target, run checkpoint, verify hardware tag in result
- [ ] Test 3: Disconnect bridge mid-run, UI recovers gracefully
- [ ] Test 4: Export capsule includes hardware evidence
- [ ] Test passes on CI
- [ ] No flakes (< 30 second run time)

**Constraints**:
- New file only
- No changes to existing test setup
- Must clean up bridge process on teardown

**Reference**: [ECE_LAB_ROADMAP.md § H2.4](../docs/ECE_LAB_ROADMAP.md#h24-smoke-test)

---

## [P2] [PARKED] System Search Registry Fixes
**Status**: PARKED (8 test failures, not blocking labs)  
**Goal**: Fix system-search.test.tsx registry initialization failures  
**Files**: `packages/rb-shell/src/__tests__/system-search.test.tsx`  
**Acceptance**: All 8 system-search tests pass  
**Constraints**: Test setup issue, not runtime bug. Low priority.


## QUALITY GOVERNOR TICKETS (Baseline Failures)

**Context**: Discovered by Quality Governor scan on 2026-01-14 (main branch baseline)  
**Evidence**: ops/proof/quality-2026-01-14-*.log

---

### [P0] [IN_PROGRESS] QUALITY-001: Fix App Registry Search Integration
**Status**: IN_PROGRESS (CRITICAL - blocks user search functionality)  
**Branch**: `fix/quality-app-registry-search`  
**Goal**: App registry returns empty results in tests → fix search integration  
**Found By**: Quality Governor Scan C (Tests) - 2026-01-14  
**Evidence**: ops/proof/quality-2026-01-14-tests.log (8 failures total, 7 from app registry)

**Files**:
- `packages/rb-shell/src/__tests__/file-search.test.ts` (failing test)
- `packages/rb-shell/src/__tests__/system-search.test.tsx` (6 failing tests)
- Investigation TBD: AppRegistry.ts, search filter logic, test setup

**Failures**:
1. file-search.test.ts line 248: "expected 0 to be greater than 0" (results.apps.length)
2-7. system-search.test.tsx lines 13, 22, 30, 84, 123, 155: All app registry queries return empty arrays or undefined

**Acceptance**:
- [x] Investigate why AppRegistry returns 0 results in test environment
- [x] Fix test setup OR fix AppRegistry initialization
- [x] All 7 app registry search tests pass
- [x] No regression in working tests (full suite passing; skips unchanged)
- [x] Build remains green (872 modules)
- [x] Capture before/after test output to ops/proof/

**Validation**:
- Targeted tests passing: file-search.test.ts, system-search.test.tsx
- Full suite after P1 switch fix: all passing (705), 41 skipped
- Proof: ops/proof/quality-2026-01-14-tests-app-registry-fix.log; ops/proof/quality-2026-01-14-tests-after-p0.log; ops/proof/quality-2026-01-14-tests-after-p1.log; ops/proof/quality-2026-01-14-build-after-p0.log

**Constraints**:
- Minimal diff (NO_REFACTOR unless blocking)
- Root cause must be documented in commit message
- Fix test environment OR production code, not both unless required
- No changes to search API contract

**Reproduction**:
```powershell
pnpm test file-search.test.ts
pnpm test system-search.test.tsx
```

**Reference**: ops/proof/quality-2026-01-14-SUMMARY.md (P0 triage)

---

### [P1] [READY] QUALITY-002: Align Switch Toggle Testid
**Status**: READY  
**Branch**: `fix/quality-switch-toggle-testid`  
**Goal**: Fix testid mismatch in replay-lock.test.tsx  
**Found By**: Quality Governor Scan C (Tests) - 2026-01-14  
**Evidence**: ops/proof/quality-2026-01-14-tests.log (1 failure)

**Files**:
- `packages/rb-logic-view/src/__tests__/replay-lock.test.tsx` (failing test)
- Investigation TBD: Switch component rendering logic

**Failure**:
- Line 81: "Unable to find element by [data-testid='switch-toggle-sw1']"
- Actual testid rendered: `switch-toggle-overlay-sw1`

**Acceptance**:
- [ ] Investigate: Should test use `switch-toggle-overlay-sw1` OR component render `switch-toggle-sw1`?
- [ ] Fix test OR component (choose based on API contract)
- [ ] replay-lock.test.tsx passes
- [ ] No regression in other switch toggle tests
- [ ] Build green

**Constraints**:
- One-line fix preferred
- Document decision: Change test vs change component (commit message)
- No changes to switch toggle API

**Reproduction**:
```powershell
pnpm test replay-lock.test.tsx
```

**Reference**: ops/proof/quality-2026-01-14-SUMMARY.md (P1 triage)

---

### [P1] [READY] QUALITY-003: Clean AppRegistry Import Pattern
**Status**: READY  
**Branch**: `fix/quality-appregistry-import`  
**Goal**: Fix AppRegistry.ts dynamic/static import warning  
**Found By**: Quality Governor Scan D (Warnings) - 2026-01-14  
**Evidence**: ops/proof/quality-2026-01-14-warnings.log (1 warning)

**Files**:
- `packages/rb-apps/src/AppRegistry.ts` (warning source)
- `packages/rb-apps/src/index.ts` (dynamic import)
- Investigation TBD: AppStoreApp.tsx, TerminalApp.tsx (static imports)

**Warning**:
```
(!) C:/Users/conno/redbyte-ui/packages/rb-apps/src/AppRegistry.ts is dynamically 
imported by packages/rb-apps/src/index.ts but also statically imported by...
```

**Acceptance**:
- [ ] Investigate: Why is AppRegistry both dynamically and statically imported?
- [ ] Fix: Use consistent import pattern (all static OR all dynamic)
- [ ] Build warning eliminated
- [ ] No runtime regression (app registry still works)
- [ ] Build green (872 modules)

**Constraints**:
- NO_REFACTOR (minimal diff only)
- Prefer changing import sites over changing exports
- Document decision in commit message

**Reproduction**:
```powershell
pnpm -r build | Select-String "dynamically imported"
```

**Reference**: ops/proof/quality-2026-01-14-SUMMARY.md (P1 triage)

---

### [P1] [READY] QUALITY-004: Resolve React 19 + Zustand Infinite Loop
**Status**: READY (technical debt: 4 test files with FIXME comments)  
**Branch**: `fix/quality-react19-zustand-loop`  
**Goal**: Fix infinite loop in React 19 + Zustand tests (4 tests currently skipped)  
**Found By**: Quality Governor Scan F (Static) - 2026-01-14  
**Evidence**: ops/proof/quality-2026-01-14-SUMMARY.md

**Files**:
- `packages/rb-apps/src/__tests__/app-launch.test.tsx` (line 27: FIXME comment)
- `packages/rb-apps/src/__tests__/logic-playground.test.tsx` (line 85: FIXME comment)
- `packages/rb-apps/src/__tests__/os-playground-flow.test.tsx` (line 28: FIXME comment)
- `packages/rb-apps/src/__tests__/playground-palette-interaction.test.tsx` (line 377: FIXME comment)

**Issue**:
```tsx
// FIXME: React 19 + Zustand infinite loop issue
// Tests skipped due to state update loops
```

**Acceptance**:
- [ ] Investigate: Why does React 19 + Zustand cause infinite loops in these tests?
- [ ] Fix: Update Zustand patterns OR downgrade React OR isolate state updates
- [ ] Re-enable 4 skipped tests
- [ ] All 4 tests pass
- [ ] No infinite loops in test runs
- [ ] Build green

**Constraints**:
- ALLOW_REFACTOR (may require Zustand store changes)
- Document root cause in commit message
- No breaking changes to store API
- Consider Zustand v5 patterns if needed

**Reproduction**:
```powershell
# Tests currently skipped with FIXME comments
grep -r "FIXME: React 19" packages/rb-apps/src/__tests__/
```

**Reference**: ops/proof/quality-2026-01-14-SUMMARY.md (P1 triage)

---

### [P2] [READY] QUALITY-005: Address Implementation TODOs
**Status**: READY (low priority - feature requests)  
**Branch**: `feat/quality-implementation-todos`  
**Goal**: Address 4 TODO comments for future features  
**Found By**: Quality Governor Scan F (Static) - 2026-01-14  
**Evidence**: ops/proof/quality-2026-01-14-SUMMARY.md

**TODOs**:
1. LogicPlaygroundApp.tsx line 2900: "TODO: Implement component highlighting"
2. LogicPlaygroundApp.tsx line 3286: "TODO: Load CE example pack"
3. view-window-matrix.spec.ts line 493: "TODO: Implement localStorage autosave hook integration"
4. vitest.config.ts line 35: "TODO: Fix LogicCanvas async state updates to eliminate warnings"

**Acceptance**:
- [ ] Evaluate: Which TODOs are worth implementing now?
- [ ] Implement OR convert to GitHub issues for backlog
- [ ] Remove TODO comments after action taken
- [ ] Tests pass
- [ ] Build green

**Constraints**:
- P2 priority (defer until after P0/P1 cleared)
- ALLOW_REFACTOR if implementing features
- Consider creating separate tickets per TODO

**Reference**: ops/proof/quality-2026-01-14-SUMMARY.md (P2 triage)

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
