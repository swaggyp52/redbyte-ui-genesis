---
type: architecture
status: active
area: infrastructure
updated: 2026-04-26
related:
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
  - "[[Note Schema]]"
  - "[[Session Log]]"
  - "[[Support Matrix]]"
  - "[[Session Template]]"
  - "[[Project Surface]]"
  - "[[Design Surface]]"
  - "[[Verify Engine]]"
  - "[[Verify Design Loop]]"
  - "[[Hardware Surface]]"
  - "[[Export Contracts]]"
---

# RedByte Engineering Brain

---

## What is broken right now

BUG-003 render-harness variant is pre-existing: `@testing-library/react@16.1` incompatibility breaks component render tests. Do not treat as a regression from new work. Fix: upgrade to `^17.0.0`.

```dataview
TABLE area, priority, status
FROM "05 Bugs"
WHERE status = "open" OR status = "investigating" OR status = "blocked"
SORT priority DESC
```

---

## What system am I working in?

Pick one — this is your workspace for today:

| Mode | Open these notes |
|---|---|
| **Verify Debug** | [[Verify Engine]] - [[Verify Hint System]] - `05 Bugs/` (verify area) |
| **Export + Vivado** | [[Connection Model]] - [[Export Contracts]] - [[Basys 3 Mapping]] |
| **Architecture + Planning** | [[Canonical Notes Policy]] - `04 Decisions/` - this dashboard |

Full routing details: [[Workspace Routing]]

---

## What Claude should read before acting

Always:

- [[Canonical Notes Policy]] — before creating any note
- [[Note Schema]] — before writing any Properties block
- [[Claude Session Mode]] — if this is a new session
- `docs/ACTIVE_WORK.md` — current priority ladder and in-flight work

For verify work: [[Verify Engine]] + [[Verify Hint System]]  
For export work: [[Connection Model]] + [[Export Contracts]]  
For project workflow / onboarding work: [[Project Surface]]  
For test work: [[Test Infrastructure]]  
For Design workflow work: [[Design Surface]]  
For Hardware / Map Pins work: [[Hardware Surface]] + [[Export Contracts]] + [[Basys 3 Mapping]]  
For cross-surface authoring loop work: [[Verify Design Loop]] + [[Design Surface]] + [[Verify Engine]]

---

## Workflow map

- [[Project Surface]] = front door, current state, next-action authority
- [[Design Surface]] = circuit authoring, structural inspection, replay-backed explanation
- [[Verify Engine]] = scenario/procedure authoring, stimulus control, optional assertions, waveform evidence
- [[Verify Design Loop]] = the handoff contract between waveform evidence and structural explanation
- [[Hardware Surface]] = physical I/O mapping, board readiness, program handoff context
- [[Export Contracts]] = deterministic artifact and submission/program package handoff

---

## Active Work Board

→ Recent session history: [[Session Log]]  
→ Release certification detail: [[Support Matrix]] · `docs/ACTIVE_WORK.md`

| Status | Item |
|--------|------|
| **Now** | E2/E3 matrix completion — needs connected Basys3 bench |
| **Next** | Fill certification matrix for `golden-basys3-switch-and` and `signal-tour` (E2+E3) |
| **Next** | BUG-003: upgrade `@testing-library/react` to `^17.0.0` |
| **Blocked** | E2/E3 proof requires connected bench (Vivado 2024.2 + Digilent cable) |
| **Waiting** | `golden-basys3-switch-and` E2 + E3 |
| **Waiting** | `signal-tour` E2 + E3 |
| **Done** | Security-lock import/export spine hardening (`845cffdd`) |
| **Done** | Vivado export fidelity hardening (`be52fb09`) |
| **Done** | Board clock semantics — CLK100MHZ→W5 canonical (`69e89999`) |
| **Done** | Repo operating system reset — CLAUDE.md, ACTIVE_WORK.md, stale headers |

---

## RC1 Release Truth (freeze: 2026-04-23)

| Row | E1 | E2 | E3 |
|-----|----|----|-----|
| `golden-basys3-switch-and` | ✓ certified | — bench needed | — |
| `signal-tour` | ✓ certified | — bench needed | — |
| `two-bit-counter` (CLK100MHZ→W5) | ✓ certified | ✓ live bench proof | pending TA checklist |

Full tier detail: [[Support Matrix]] · `docs/STUDENT_RELEASE_READINESS.md`  
RC1 freeze doc: `docs/RC1_STUDENT_RELEASE_FREEZE.md`

---

## Session workflow

```
Start  -> [[Session Template]] (copy, fill date + goal)
Orient -> [[Session Startup Checklist]]
Work   -> [[Claude Session Mode]]
Tests  -> [[Post Run Extraction]]
End    -> [[Session Shutdown Checklist]] then update [[Session Log]]
```

---

## Install status

| Item | Status |
|---|---|
| `CLAUDE.md` | Rewritten as repo constitution (2026-04-26) — imports `docs/ACTIVE_WORK.md` |
| `redbyte-obsidian-maintainer` skill | Installed at `.claude/skills/redbyte-obsidian-maintainer/SKILL.md` |
| Dataview plugin | Needs install in Obsidian |
| Workspaces | Create: Verify Debug - Export + Vivado - Architecture + Planning |
| Post-test hooks | Not yet — use checklists manually first |

Full install order: [[Operational Readiness Review]]

---

## Test baseline (2026-03-26) — 168 pure-logic passing

```
export-authority-chain-contract  49   signal-inventory-contract   18
invalidation-contract            10   buildVerifySessionViewModel  5
projectRuntime.verify-authority  15   verifyHints                 16
verifyScenario                   30   diagnostics.contract         4
basys3-port-lint                  2   basys3-port-naming-phase1   10
audit-determinism                 1   verifyContract.reset         8
```

Component render tests: pre-existing failures due to React 19 / `@testing-library/react` incompatibility. Do not treat as regressions.

Key milestones preserved in test naming:
- B-13 Phase 3 (`b89959c0`): `ide-vcb-run` is the only Run action in Verify
- B-14 Slice 1 (`05514e78`): `VerifyFirstRunPanel` yields to canvas once vectors exist

---

## Architecture map

**Active:** [[Design Surface]] - [[Project Surface]] - [[Verify Engine]] - [[Connection Model]] - [[Verify Hint System]] - [[Test Infrastructure]] - [[Note Schema]] - [[Workspace Routing]] - [[Automation Strategy]]

**Stubs (expand when touching):** [[Export Contracts]] - [[Signal Inventory]] - [[Authority Chain]] - [[Bridge Protocol]] - [[Basys 3 Mapping]]

**Decisions:** [[ADR-001 Enforce Structured Connection Format]] - [[ADR-002 Truth Table Selection Does Not Auto-Switch Tabs]] - [[ADR-004 Stimulus-First Observation Default]] - [[ADR-005 Verify Schedule Contract Owns Sequential Clock Authority]]

**Export truth fixes (resolved 2026-03-26 — do not reopen):**
- [[BUG-013 Basys3 Export Port Sanitizer Produced Vivado-Illegal Identifiers]] — port sanitizer fixed
- [[BUG-012 Basys3 Switch and Button Clock Buffer Inference]] — `CLOCK_BUFFER_TYPE NONE` on switch inputs
- [[BUG-011 Export Testbench Stable-ID Stimulus Drift]] — stable vector ids on entity refs
- [[BUG-007 Export Verify Gate Tone Mismatch]] — stale-after-pass is advisory, not red blocker
- [[BUG-008 Export Vivado Steps Mismatch Download Label]] — Open Project flow prioritized
- [[BUG-009 Export RBEV Diagnostics Shown When Blocked]] — advisory RBEV removed from blocker lists
