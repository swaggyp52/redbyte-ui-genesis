---
type: architecture
status: active
area: infrastructure
updated: 2026-03-29
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
For Design workflow hierarchy work: [[Design Surface]]

---

## What is the next action

**Verify is closed.** UX clarity pass (A/B/C), Verify debug pass, and render-suite cleanup are all done. Render baseline: 52 PASS / 9 suites / 0 red. Do not reopen Verify in this thread.

Canonical next-phase roadmap:

- `docs/roadmap/redbyte-classroom-gap-handoff.md`

Latest completed Design slice:

- `2026-03-29` - left dock simplification landed; search plus core parts now lead the Design first look, while Board Resources and Live Inputs default to collapsed and board search still auto-reveals inventory when needed.

Next Design chrome action:

- blank-state guidance de-duplication

Use its recommended implementation order:

1. **Workflow spine + shared step authority** - Project, left rail, pipeline strip, headers, and CTAs must agree on done / blocked / next / why
2. **Design-surface interaction** - editor legitimacy for wires, selection, undo/redo, dense circuits, and sequential authoring
3. **Hardware/export failure truth** - actionable failure taxonomy, recovery paths, and artifact/readiness clarity
4. **Onboarding / empty-state** - first-run clarity, required vs optional steps, and known-good starter authority
5. **Sequential / clocked trust** - consistent timing language and proof across Verify, Export, and Hardware

Examples, starters, and classroom ops should ride inside those tracks as proof obligations, not as separate top-tier roadmap lanes.

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

## Test baseline (2026-03-26) - 168 pure-logic passing + 52 render passing (all green)

```
export-authority-chain-contract  49   signal-inventory-contract   18
invalidation-contract            10   buildVerifySessionViewModel  5
projectRuntime.verify-authority  15   verifyHints                 16
verifyScenario                   30   diagnostics.contract         4
basys3-port-lint                  2   basys3-port-naming-phase1   10
audit-determinism                 1   verifyContract.reset         8
```

Render harness (all 9 suites green):

- `verifySurface-fail-state` 3 - `verifySurface.failure-context` 2 - `verifySurface.authoring` 11
- `verifySurface.three-panel` 3 - `verifySurface.workstation` 23 - `verifySurface.hints-bridge` 3
- `verifySurface.failure-patterns` 5 - `verifySurface.waveform-priority` 1 - `verifySurface.combo-kmap-provenance` 1

---

## Architecture map

**Active:** [[Design Surface]] - [[Verify Engine]] - [[Connection Model]] - [[Verify Hint System]] - [[Test Infrastructure]] - [[Note Schema]] - [[Workspace Routing]] - [[Automation Strategy]]

**Stubs (expand when touching):** [[Export Contracts]] - [[Signal Inventory]] - [[Authority Chain]] - [[Bridge Protocol]] - [[Basys 3 Mapping]]

**Decisions:** [[ADR-001 Enforce Structured Connection Format]] - [[ADR-002 Truth Table Selection Does Not Auto-Switch Tabs]]

**Recent export truth fixes (resolved 2026-03-26, preserve and do not reopen):**
- [[BUG-007 Export Verify Gate Tone Mismatch]] - stale-after-pass export state is advisory `STALE`, not a red blocker (`b5cf70c7`)
- [[BUG-008 Export Vivado Steps Mismatch Download Label]] - visible Vivado steps now prioritize the normal Open Project flow (`849eca4f`)
- [[BUG-009 Export RBEV Diagnostics Shown When Blocked]] - advisory RBEV evidence no longer appears inside hard-blocker lists (`88d7a30f`)
