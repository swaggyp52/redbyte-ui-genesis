---
type: architecture
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
  - "[[Note Schema]]"
  - "[[Verify Engine]]"
  - "[[2026-03-25 Verify Refactor Plan]]"
---

# RedByte Engineering Brain

---

## What is broken right now

BUG-003 is closed. The `React.act` crash documented there no longer reproduces in the current repo state.

```dataview
TABLE area, priority, status
FROM "05 Bugs"
WHERE status = "open" OR status = "investigating" OR status = "blocked"
SORT priority DESC
```

---

## What system am I working in?

Pick one - this is your workspace for today:

| Mode | Open these notes |
|---|---|
| **Verify Debug** | [[Verify Engine]] - [[Verify Hint System]] - `05 Bugs/` (verify area) |
| **Export + Vivado** | [[Connection Model]] - [[Export Contracts]] - [[Basys 3 Mapping]] |
| **Architecture + Planning** | [[Canonical Notes Policy]] - `04 Decisions/` - this dashboard |

Full routing details: [[Workspace Routing]]

---

## What Claude should read before acting

Always:

- [[Canonical Notes Policy]] - before creating any note
- [[Note Schema]] - before writing any Properties block
- [[Claude Session Mode]] - if this is a new session

For verify work: [[Verify Engine]] + [[Verify Hint System]]
For export work: [[Connection Model]] + [[Export Contracts]]
For test work: [[Test Infrastructure]]

---

## What is the next action

**Verify refactor close-out and BUG-003 audit are complete** - do not treat either area as emergency work without new evidence.

1. [[2026-03-25 Verify Refactor Plan]] - keep as the historical close-out record for the Verify chapter
2. [[BUG-003 React.act Infrastructure Failure]] - treat as a closed audit note, not as a reason for speculative dependency churn
3. [[Test Infrastructure]] - if render-suite cleanup is needed later, treat the remaining red suites as normal behavior/test drift unless the literal `React.act` error returns

---

## Session workflow

```
Start -> [[Session Startup Checklist]]
Work  -> [[Claude Session Mode]]
Tests -> [[Post Run Extraction]]
End   -> [[Session Shutdown Checklist]]
```

---

## Install status

| Item | Status |
|---|---|
| `CLAUDE.md` | Present in repo root |
| `redbyte-obsidian-maintainer` skill | Installed at `.claude/skills/redbyte-obsidian-maintainer/SKILL.md` |
| Dataview plugin | Needs install in Obsidian |
| Workspaces | Create: Verify Debug - Export + Vivado - Architecture + Planning |
| Post-test hooks | Not yet - use checklists manually first |

Full install order: [[Operational Readiness Review]]

---

## Test baseline (2026-03-25) - 168 pure-logic passing + 42 render passing

```
export-authority-chain-contract  49   signal-inventory-contract   18
invalidation-contract            10   buildVerifySessionViewModel  5
projectRuntime.verify-authority  15   verifyHints                 16
verifyScenario                   30   diagnostics.contract         4
basys3-port-lint                  2   basys3-port-naming-phase1   10
audit-determinism                 1   verifyContract.reset         8
```

Render harness audit:

- `verifySurface-fail-state` 3 PASS
- `verifySurface.failure-context` 2 PASS
- `verifySurface.authoring` 11 PASS
- `verifySurface.three-panel` 3 PASS
- `verifySurface.workstation` 23 PASS
- `verifySurface.hints-bridge` remains red for a suite-specific DOM expectation mismatch, not a React.act crash

---

## Architecture map

**Active:** [[Verify Engine]] - [[Connection Model]] - [[Verify Hint System]] - [[Test Infrastructure]] - [[Note Schema]] - [[Workspace Routing]] - [[Automation Strategy]]

**Stubs (expand when touching):** [[Export Contracts]] - [[Signal Inventory]] - [[Authority Chain]] - [[Bridge Protocol]] - [[Basys 3 Mapping]]

**Decisions:** [[ADR-001 Enforce Structured Connection Format]]
