---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 classroom rehearsal protocol
---

# RedByte Classroom Rehearsal

This document defines the Phase 3F browser classroom rehearsal for Product Trust Reset v2 PR #78.

## Commands

```powershell
pnpm -s rehearsal:classroom-30
pnpm -s rehearsal:classroom-verify
pnpm -s rehearsal:classroom-recovery
```

Each command launches one local preview and runs 30 isolated browser contexts. Evidence is written under:

```text
.redbyte/rehearsal/phase-3f/
```

The output includes JSON and Markdown summaries for pass/fail counts, duration, per-profile status, and explicit proof limits.

## Scenarios

| Command | Scenario | Purpose |
|---|---|---|
| `rehearsal:classroom-30` | `full` | Create/load starter, rename, Verify PASS, reload restore, corrupt-storage recovery |
| `rehearsal:classroom-verify` | `verify` | 30-context Verify PASS and reload restore endurance |
| `rehearsal:classroom-recovery` | `recovery` | 30-context reload restore and corrupt-storage recovery |

## Current Evidence

The latest Phase 3F local run wrote:

- `.redbyte/rehearsal/phase-3f/classroom-full-30.md`: `30` passed, `0` failed.
- `.redbyte/rehearsal/phase-3f/classroom-verify-30.md`: `30` passed, `0` failed.
- `.redbyte/rehearsal/phase-3f/classroom-recovery-30.md`: `30` passed, `0` failed.

## Acceptance

For each profile:

- a fresh browser context starts from clean storage
- the Logic Gates starter loads
- project rename saves through current persistence
- Verify can reach Compare PASS where the scenario requires it
- reload restores the project identity and graph
- saved runtime and project snapshot keys exist
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
- journaled storage commits or rolling snapshots

The current Phase 3F implementation adds a visible multi-tab overwrite warning, but full conflict resolution remains a future durability slice.

## Attribution

Connor Angiel
