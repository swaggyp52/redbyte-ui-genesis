# RedByte CI Gates Policy (Phase 4)

## Purpose

This document defines which deterministic gates are **SAFE** to require on every PR (blocking) vs. which should remain **NON-BLOCKING** (scheduled/manual) to prevent classroom disruption.

## Blocking Gates (Required on PR)

These gates are **pure, deterministic, fast** and catch critical regressions:

### Build Gate
- **Command**: `pnpm -r build`
- **Rationale**: Catches TypeScript errors, build configuration issues, and dependency problems. Fast (~30s), deterministic, no flake.
- **Enforcement**: **REQUIRED** on every PR; blocking merge.

### Core Engine Gates (Simulation Determinism)
- **Commands**:
  - `pnpm sim:repeatability-gate` - Verifies tick-based simulation is deterministic
  - `pnpm sim:loop-detection-gate` - Validates combinational loop detection
  - `pnpm sim:probe-stability-gate` - Ensures probe recorder bounded buffer
- **Rationale**: Core simulation correctness. Pure logic tests, no UI, no timers. Fast (<5s each).
- **Enforcement**: **REQUIRED** on every PR; blocking merge.

### Project Format Gates (No Data Loss)
- **Commands**:
  - `pnpm rbproj:roundtrip-gate` - Export/import idempotence
  - `pnpm proj:autosave-recovery-gate` - Autosave recovery determinism
  - `pnpm proj:undo-redo-gate` - Undo/redo reversibility
- **Rationale**: Prevents student data loss. Deterministic, fast (<5s each).
- **Enforcement**: **REQUIRED** on every PR; blocking merge.

### OS Stability Gates (Windowing)
- **Commands**:
  - `pnpm os:window-raise-gate` - Window focus/z-index determinism
  - `pnpm os:error-boundary-gate` - Error boundary catches crashes
  - `pnpm os:performance-mode-gate` - Performance mode toggle works
  - `pnpm os:instrument-hz-gate` - Instrument throttling determinism
- **Rationale**: OS-level stability, no UI rendering, pure state tests. Fast (<5s each).
- **Enforcement**: **REQUIRED** on every PR; blocking merge.

### Hardware Bridge Gates (Dry-Run)
- **Commands**:
  - `pnpm bridge:dryrun-gate` - Bridge dry-run mode works
  - `pnpm hw:mode-fallback-gate` - HW→SIM fallback determinism
- **Rationale**: Hardware workflow determinism in dry-run mode. No real hardware needed. Fast (<5s each).
- **Enforcement**: **REQUIRED** on every PR; blocking merge.

### Phase 4 Workflow Gates (NEW)
- **Commands**:
  - `pnpm lab:workflow-export-verify-gate` - Lab export/import roundtrip
  - `pnpm lab:probe-sampling-gate` - Probe sampling determinism (500 ticks)
  - `pnpm hw:dryrun-program-flow-gate` - Hardware programming flow in dry-run
- **Rationale**: Student workflow integrity. Pure service-layer tests, no browser. Fast (<10s each).
- **Enforcement**: **RECOMMENDED** on every PR after stabilization period (initially non-blocking).

## Non-Blocking Gates (Scheduled/Manual)

These gates are **valuable but expensive or environment-sensitive**:

### Heavy Operations Gates
- **Commands**:
  - `pnpm ops:diff-gate` - End-to-end lab diffing with backend
  - `pnpm ops:student-export-fixture-test` - Full student export validation
- **Rationale**: Requires Node backend, PowerShell scripts, heavy I/O. Slower (>30s).
- **Enforcement**: **NON-BLOCKING**. Run on scheduled CI (nightly) or manual workflow.

### Evidence Determinism Gates
- **Commands**:
  - `pnpm rbx:evidence-determinism-gate` - Validates .rbx.zip capsule metadata
- **Rationale**: Requires golden hash management, may need manual updates. Slower (~15s).
- **Enforcement**: **NON-BLOCKING**. Run on scheduled CI (nightly) or manual workflow.

### E2E Playwright Gates (Deferred)
- **Commands**: (Not yet implemented)
  - Cross-browser matrix (Chrome/Firefox/Edge)
  - Render storm baseline E2E
  - Visual regression tests
- **Rationale**: Browser automation is slow, flaky, and environment-sensitive. Risk > benefit for blocking PR.
- **Enforcement**: **NON-BLOCKING**. Manual pre-release smoke tests only.

## Classroom Risk Mitigation

### Why Pure Gates Win
- **No browser dependencies**: jsdom-only or pure Node tests avoid GPU/WebGL crashes
- **No timers**: Deterministic tick-based tests avoid wall-clock flake
- **No UI rendering**: Service-layer tests avoid React update depth issues
- **Fast feedback**: <60s total gate time keeps PR iteration smooth

### Why Heavy Gates Stay Non-Blocking
- **Backend coupling**: Ops gates require server startup, slow down PR feedback
- **Golden hash churn**: Evidence gates need manual updates when format evolves
- **Playwright flake**: E2E browser tests are inherently unreliable in CI

## CI Workflow Structure

### PR Workflow (Blocking)
```yaml
name: PR Gates (Blocking)
on: [pull_request]
jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm sim:repeatability-gate
      - run: pnpm sim:loop-detection-gate
      - run: pnpm sim:probe-stability-gate
      - run: pnpm rbproj:roundtrip-gate
      - run: pnpm proj:autosave-recovery-gate
      - run: pnpm proj:undo-redo-gate
      - run: pnpm os:window-raise-gate
      - run: pnpm os:error-boundary-gate
      - run: pnpm os:performance-mode-gate
      - run: pnpm os:instrument-hz-gate
      - run: pnpm bridge:dryrun-gate
      - run: pnpm hw:mode-fallback-gate
      - run: pnpm lab:workflow-export-verify-gate
      - run: pnpm lab:probe-sampling-gate
      - run: pnpm hw:dryrun-program-flow-gate
```

### Nightly Workflow (Non-Blocking)
```yaml
name: Nightly Heavy Gates
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:
jobs:
  heavy-gates:
    runs-on: windows-latest  # PowerShell scripts
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm ops:diff-gate
      - run: pnpm ops:student-export-fixture-test
      - run: pnpm rbx:evidence-determinism-gate
```

## Stabilization Period

**Phase 4 gates start as NON-BLOCKING** to observe flake rate:
1. Add gates to package.json (done)
2. Run manually for 1 week (validate determinism)
3. Add to non-blocking nightly workflow
4. After 10+ consecutive green runs → promote to blocking PR workflow

## Summary

**Blocking gates = Fast + Pure + Deterministic**
- Build + core sim + project format + OS stability + bridge dry-run + Phase 4 workflow gates
- Total runtime: <90s
- Zero tolerance for flake

**Non-blocking gates = Slow or Environment-Sensitive**
- Ops backend tests + evidence validation + Playwright E2E (future)
- Run nightly or pre-release
- Acceptable flake rate: <5%

This policy ensures **classroom stability** while maintaining **fast PR feedback**.
