---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 classroom rehearsal protocol
---

# RedByte Classroom Rehearsal

This document defines the browser classroom rehearsal for Product Trust Reset v2 PR #78. Phase 3F established the 30-context rehearsal; Phase 3H extends the script with project storage waves. Phase 3I adds current-build identity assertions and deliberate fault injection for the harness itself.

## Commands

```powershell
pnpm -s rehearsal:classroom-30
pnpm -s rehearsal:classroom-verify
pnpm -s rehearsal:classroom-recovery
pnpm -s rehearsal:classroom-fault-injection
```

Each command launches one local preview and runs 30 isolated browser contexts. Evidence is written under:

```text
.redbyte/rehearsal/phase-3h/
```

The output includes JSON and Markdown summaries for pass/fail counts, duration, per-profile status, and explicit proof limits.

## Scenarios

| Command | Scenario | Purpose |
|---|---|---|
| `rehearsal:classroom-30` | `full` | Create/load starter, rename, Verify PASS, reload restore, corrupt-storage recovery |
| `rehearsal:classroom-verify` | `verify` | 30-context Verify PASS and reload restore endurance |
| `rehearsal:classroom-recovery` | `recovery` | 30-context reload restore and corrupt-storage recovery |

## Current Evidence

The latest completed tracked Phase 3H evidence is:

- `.redbyte/rehearsal/phase-3h/classroom-full-30.md`: `30` passed, `0` failed.

The Phase 3I harness-validity evidence is:

- `.redbyte/rehearsal/phase-3i/classroom-fault-injection.md`: six deliberate faults detected.

Each successful Phase 3H profile records storage waves:

- G: committed save journal exists
- H: last-known-good runtime exists
- I: at least one recovery point exists
- J: saved snapshot and index exist
- K: runtime key exists after reload

Each successful Phase 3I normal rehearsal profile also asserts that the rendered root build SHA matches current Git HEAD. The fault-injection wrapper rebuilds first, then proves the rehearsal fails for:

- wrong visible build SHA
- visible error boundary
- mutated Course-check editability
- stale PASS that remains trusted
- cross-context state leakage
- post-reload page error

## Acceptance

For each profile:

- a fresh browser context starts from clean storage
- the Logic Gates starter loads
- project rename saves through current persistence
- Verify can reach Compare PASS where the scenario requires it
- reload restores the project identity and graph
- saved runtime and project snapshot keys exist
- Phase 3H storage waves G-K pass
- rendered build SHA matches current Git HEAD
- corrupt runtime/session storage does not crash the app
- corrupt runtime/session storage does not resurrect trusted PASS
- browser console/page errors fail the profile

## Proof Boundary

This is browser E0 rehearsal. It does not prove:

- Vivado synthesis/implementation/bitstream generation
- Basys3 programming
- physical board observation
- cloud sync
- roster/account behavior

Phase 3H adds browser-local journal, last-known-good, recovery points, quota recovery UI, and dirty update guard proof. Phase 3I proves the rehearsal harness can fail on wrong-build, error-boundary, authority-mutation, stale-trust, state-leak, and reload-error classes. It does not prove backend sync, full collaborative conflict merge UI, screen-reader certification, Vivado/Basys3 proof, or physical classroom observation.

## Attribution

Connor Angiel
