---
type: architecture
status: active
area: infrastructure
updated: 2026-06-16
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

Current as of 2026-06-16:

- Current browser-first source of truth is the repo cockpit, especially `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, and `docs/plans/2026-06-12-redbyte-product-issue-index.md`.
- Project Identity Editing v1 is closed by `ide:gate:project-identity-editing`: top bar, upper Project identity strip, loaded Project title, and adjacent Rename affordances now edit the user-owned project title, while the starter/source label stays distinct.
- Still open for browser-first ownership: side-dock proportions, awkward collapsed side labels, and the broader card-heavy/static interaction model. Reinspect live app before selecting one contained gateable defect.
- Hardware proof is still board-gated; do not claim fresh Vivado/Basys3 E1-E3 evidence from browser screenshots.

BUG-003 is now project shorthand for the pre-existing render-family baseline, not just the older literal `React.act` crash note. Current workspace version is `@testing-library/react@16.3.2`; use `AI_STATE.md` for the live full-suite counts and failure shape, and do not treat those failures as regressions from new work unless the baseline moves.

Current product-debt owner: `docs/IDE_PRODUCT_DEBT_REGISTER.md`.

Current as of 2026-05-02:

- Proven stable: Basys3 `CLK100MHZ` / `W5` auto-board-clock behavior, board-clock browser proof gate, exported VHDL `clock_gen`, and the first Verify ScenarioBuilder clarity pass.
- Still open: Hardware / Map Pins density, Export readiness-density competition, global CSS geological debt, optional screenshot baselines, BUG-003-family naming drift, and the Windows `build:unified` `dist/` lock caveat.
- Do not casually reopen board-clock semantics during UI cleanup. Treat that slice as proven unless new executable proof says otherwise.

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
| **Now** | Use `docs/IDE_PRODUCT_DEBT_REGISTER.md` as the canonical owner for open IDE debt and sequence next UI slices from that file |
| **Next** | Fill certification matrix for `golden-basys3-switch-and` and custom rows (E2+E3) |
| **Next** | Turn screenshot baselines into a real safety net before `ide-root.css` pruning or broader density cleanup |
| **Blocked** | E2/E3 proof requires connected bench (Vivado 2024.2 + Digilent cable) |
| **Blocked** | `build:unified` can fail final root `dist/` verification on Windows due to an environment lock even when build + merge succeed |
| **Waiting** | Hardware / Export density follow-up after coverage exists |
| **Waiting** | ScenarioBuilderPanel density follow-up after coverage exists |
| **Done** | ScenarioBuilderPanel authoring clarity pass (`826a4f92`) |
| **Done** | Board-clock Verify fidelity — Basys3 `CLK100MHZ` / `W5` now auto-runs in Verify and exported VHDL testbenches own a free-running board-clock process |
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

## Test baseline references

Current full-suite baseline lives in `AI_STATE.md`. That file is the live source for focused counts, full IDE counts, and the current BUG-003-family baseline.

Screenshot/browser proof truth now lives alongside that baseline in `docs/IDE_PRODUCT_DEBT_REGISTER.md`. Read both before proposing CSS cleanup or another cross-surface UI pass.

Historical pure-logic milestone (2026-03-26) — 168 pure-logic passing

```
export-authority-chain-contract  49   signal-inventory-contract   18
invalidation-contract            10   buildVerifySessionViewModel  5
projectRuntime.verify-authority  15   verifyHints                 16
verifyScenario                   30   diagnostics.contract         4
basys3-port-lint                  2   basys3-port-naming-phase1   10
audit-determinism                 1   verifyContract.reset         8
```

Component render coverage is usable under the current harness, but the broader pre-existing BUG-003 family baseline is still tracked at the full-suite level in `AI_STATE.md`.

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
