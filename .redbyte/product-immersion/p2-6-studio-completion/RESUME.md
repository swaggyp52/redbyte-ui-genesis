# RedByte P2.6 — Studio Completion → P2.6B Studio Coherence — RESUME

> Single continuation point for P2.6 / P2.6B. Newest entry at the top. Canonical repo docs still win:
> `docs/ACTIVE_WORK.md` = project truth · this file = session continuation · PR #86 = review truth.

## 2026-09-12 — P2.6B opened: studio coherence / Design–Simulate partnership (Fable 5.1, desktop) — IN FLIGHT

**Label: P2.6 PHASE 0 CLOSED / PRE-FLIGHT RETIRED / CLASSROOM PASS 2 CLASSIFIED / P2.6B STUDIO
COHERENCE IN FLIGHT / PR #86 DRAFT / NO MERGE / NO PRODUCTION.**

### Exact source truth

| Fact | Value |
|---|---|
| Branch | `claude/redbyte-studio-completion-p2-6-q7m3v8`, branched from PR #85 head `2d3160131` |
| PR | [#86](https://github.com/swaggyp52/redbyte-ui-genesis/pull/86) draft, base `claude/redbyte-operational-workbench-convergence-w9k2r4` |
| Commits since the last pushed head `2909cecd9` | `4a0abec0a` harness recognises the current Simulate stimulus · `a26378370` Pre-flight retired, Board Check the one after-mapping check · (this session) gate fix + docs |
| Typecheck | 770, fingerprint `1165a0a5faf044e6` at every commit (unchanged from PR #85 head) |
| Format version | 1, untouched. Goldens untouched. PR #85 and #84 untouched. `main` untouched. |
| Dev server | `http://[::1]:5173/` — playground Vite; restart with `corepack pnpm --filter @redbyte/playground dev` (background) |
| Built dist | `apps/playground/dist` built at `a26378370` (rebuild before any gate run after a commit) |
| Vivado | not installed on this machine (`C:\Xilinx` absent) — E1 blocked |
| Baseline worktree | `.redbyte/worktrees/base-f35c` at `2d3160131`, sharing this clone's `node_modules`; never recursively delete it, nor `.redbyte/worktrees/before-d688` |

### Phase 0 (closed this session)

1. Pre-flight retired at `a26378370`; every hardwareSurface suite + trust-clarity + history-authority
   green (89/89 + 43/43); CSS audit 0/0; `git diff --check` clean (the mixed-EOL history-authority
   test was patched byte-wise, 3-line diff).
2. Classroom pass 2 at `2909cecd9` (one head, fresh build, harness fix): 21/71. Classification in
   the P2.6 ticket. Not a lost capability among the 50; one real defect (Design left dock "Board I/O"
   tab laid out past a 218px strip); 45 Category B against P2.5 decisions that P2.6B replaces again.
3. Migrated gates at `a26378370`: `examples-contract` PASS, `student-loop-contract` PASS,
   `hardware-checklist-contract` PASS (it now opens a starter first and reveals the collapsed dock).
4. `repo:status --skip-build` at `a26378370`: passes 7 checks, stops at check 8 `IDE Bring-Up
   Contract` = `ide-bringup-contract.test.ts` "expected 'project-vectors' to be 'verify-run'" — the
   P2.5L test-debt entry (`docs/validation/test-debt.md:78`, value-or-copy), unchanged by P2.6.
   The remaining ~28 repo:status checks are therefore unmeasured by that runner.

### P2.6B plan (the owner's 2026-09-12 direction; the unit of work is the Design–Simulate loop)

Phase 1 contract amendment → Phase 2 shell/panel foundation → Phase 3 Design (Explore, dominant
circuit, Split, contextual inspector, Test this design) → Phase 4 Simulate (one Run, one instrument,
one inspector, recording history, provenance, failure flow) → Phase 5 linked investigation →
Phase 6 Project navigation owner → Phase 7 Board/Package polish (Board Check recomposition:
status line, rail with its way back, light frame, steps table) → Phase 8 Start/import → Phase 9
scale/a11y → Phase 10 validation convergence. Acceptance = the twelve journeys in the brief;
the next checkpoint must show Design + Simulate as a coherent pair at 1280x650.

### Measured facts for the next owners (do not re-measure, act)

- Board Check at 1440x900 (fresh profile): command hero 111px (title + description restating the
  hidden readiness callout, five 12px chips at rgba(188,206,224,.76) on white), rail 30px,
  provenance summary 11px uppercase at rgba(130,170,210,.52), dark chrome banner 66px, board
  workspace forced to `clamp(430px, 100vh - 210px, 740px) !important` (ide-polish-pass.css:3309)
  around a 798x334 SVG, exit banner at y=962 under an `overflow-y: hidden` 788px panel body
  (`order: 5`, ide-root.css:22660), checklist in a dock that opens collapsed (`leftDockMode`
  collapsed at HardwareSurface.tsx:3001; the strip's control is `ide-show-left-dock`).
- Design left dock: tabs Components / Hierarchy / Sources / Board I/O in a 218px `wb-toolwindow-tabs`
  strip (`overflow-x: auto; scrollbar-width: none`, design-instrument.css:543) — scrollWidth 314,
  "Board I/O" at x 315–392 outside a dock ending at 320.
- Retired shell selectors still asserted by gates: `ide-topbar-help-btn` (Help is `ide-menu-help`),
  `ide-board-chip` (deliberately absent per `workflowStages.authority.test.tsx:84`).

### Must not be reset

The branch is pushed through `2909cecd9`; the two Phase 0 commits are local until pushed this
session. Do not reset to the remote checkpoint.
