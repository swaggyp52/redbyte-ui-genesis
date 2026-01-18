# RedByte ECE Lab Platform — Master Plan

**Owner**: Connor Angiel
**Last Updated**: 2026-01-17
**Status**: Active Development

---

## Current State Snapshot

### What Works Now

| Component | Status | Location |
| --------- | ------ | -------- |
| 3-Gate Verification Chain | PASSING | OPS_GREEN_LOCK.md |
| FPGA Proof Core Library | Complete | packages/rb-fpga-proof-core/ |
| Lab Ingest Agent | Complete | packages/rb-fpga-proof-core/scripts/lab-ingest.js |
| Lab Examiner UI (Instructor) | Complete | packages/rb-apps/src/apps/LabExaminerApp.tsx |
| Bundle Schema (.rb-lab.zip) | Defined | manifest.json + proofs/ |
| Fixture Test Infrastructure | Complete | packages/ops/labs/fixtures/ |

### What Needs Work

| Component | Status | Priority |
| --------- | ------ | -------- |
| api/server.mjs endpoints | Empty/Minimal | HIGH |
| Student-facing Lab UI | Not started | HIGH |
| Diff endpoint (POST /api/labs/diff) | Not started | MEDIUM |
| Submission history for students | Not started | LOW |

---

## Invariants / Contracts (DO NOT BREAK)

### Architecture Locks

1. **Canonical Server**: `api/server.mjs` ONLY (no packages/ops-server resurrection)
2. **ops-server DISABLED**: packages/ops-server must stay disabled (noop scripts)
3. **UI Purity**: No fs/path/child_process/express imports in packages/rb-apps
4. **Public Site**: Never spawns agent; grading runs locally via ops server only

### Data Contracts

5. **Verdict Semantics**: 0=PASS, 1=FAIL, 2=INVALID (immutable)
6. **Bundle Schema**: manifest.json, capsule.json, events.ndjson, activity.json (always present)
7. **SSE Log Format**: [JSON] prefix lines + [FINAL] marker; raw text allowed but must not crash UI

### Verification Chain

8. **3 Hard Gates** (must pass after every meaningful change):
   - Gate 1: `pnpm -r build`
   - Gate 2: `pnpm agent:verify`
   - Gate 3: `pnpm ops:student-export-fixture-test`

---

## Milestone Map

### Phase 1: Foundation (COMPLETE)

- [x] Extract fpga-proof-core library
- [x] Implement lab ingest pipeline (agent:lab)
- [x] Create .rb-lab.zip bundle support
- [x] Lock 3-gate verification chain
- [x] Create Lab Examiner instructor UI

### Phase 2: Student Experience (IN PROGRESS)

- [ ] Populate api/server.mjs with required endpoints
- [ ] Create student-facing Lab UI (export + self-grade)
- [ ] Wire UI to ops server endpoints
- [ ] Add automation hooks for agent compatibility

### Phase 3: Diff & Comparison

- [ ] Implement POST /api/labs/diff endpoint
- [ ] Add diff button to Lab Examiner UI
- [ ] Golden proof comparison mode

### Phase 4: Polish & Deploy

- [ ] Submission history (student view)
- [ ] Error handling improvements
- [ ] Production deployment validation

---

## Next 2 Sessions

### Session A: Server + Student UI Foundation

**Objective**: Get api/server.mjs working and create student-facing UI skeleton

**Files to touch**:

- `api/server.mjs` — Populate with /health, /api/labs/ingest, /api/labs/runs endpoints
- `packages/rb-apps/src/apps/StudentLabApp.tsx` — New student-facing component
- `packages/rb-apps/src/apps/StudentLabApp.module.css` — Styles
- `packages/rb-apps/src/index.ts` — Export new component

**Validation**:

```powershell
pnpm -r build 2>&1 | Select-Object -Last 40
pnpm agent:verify 2>&1 | Select-Object -Last 80
pnpm ops:student-export-fixture-test 2>&1 | Select-Object -Last 80
```

**Risk**: Importing Node modules in UI code would break build. Mitigate with lint check.

### Session B: Export Workflow + Self-Grade

**Objective**: Students can export .rb-lab.zip and run local self-grade

**Files to touch**:

- `packages/rb-apps/src/apps/StudentLabApp.tsx` — Add export + self-grade tabs
- `api/server.mjs` — Add /api/labs/export endpoint (if needed)
- Integration with existing agent:lab pipeline

**Validation**: Same 3 gates + manual test of export flow

**Risk**: Bundle format mismatch. Mitigate by testing against fixture.

---

## Agent-First Development Rules

Every feature must "pay rent" through automation:

1. **Ops Server Endpoint**: Feature must be callable via HTTP
2. **Agent Pipeline Hook**: agent:lab or similar must be able to invoke it
3. **Fixture Test**: New functionality needs test coverage in ops/labs/fixtures

No UI-only features. If it can't be automated, it doesn't ship.

---

## Task Template

When adding tasks, use this format:

```markdown
### Task: [Name]

**Objective**: One sentence describing the goal

**Files likely touched**:
- path/to/file1.ts
- path/to/file2.tsx

**Validation commands**:
```powershell
pnpm -r build 2>&1 | Select-Object -Last 40
pnpm agent:verify 2>&1 | Select-Object -Last 80
pnpm ops:student-export-fixture-test 2>&1 | Select-Object -Last 80
```

**Risk note**: What could accidentally break contracts
```

---

## Quick Reference

### Run 3 Gates

```powershell
pnpm -r build 2>&1 | Select-Object -Last 40
pnpm agent:verify 2>&1 | Select-Object -Last 80
pnpm ops:student-export-fixture-test 2>&1 | Select-Object -Last 80
```

### Start Dev Server

```powershell
pnpm dev
```

### Start Ops Server

```powershell
pnpm ops:server
```

### Run Lab Ingest

```powershell
pnpm agent:lab -- --mode student-export --submission ./path/to/bundle
```

---

**Maintained by**: Claude Code (Master Planner Mode)
