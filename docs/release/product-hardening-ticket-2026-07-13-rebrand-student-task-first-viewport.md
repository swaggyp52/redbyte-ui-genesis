# Product Hardening Ticket: Rebrand Student Task First Viewport

## Ticket

- Title: Keep selected-node edit actions in the classroom first viewport
- Date: 2026-07-13
- Owner: Connor Angiel
- Surface: Design right inspector
- Journey segment: Project starter -> Half Adder -> Design -> select AND gate -> edit selection
- Mode: `design`
- Environment:
  - Fresh machine / clean browser profile: yes (fresh browser context and isolated Git worktree)
  - OS: remote Ubuntu 24.04.4; local Windows
  - Browser: remote Chrome Headless Shell 145.0.7632.6 / Playwright Chromium 1208
  - Node: 20.19.0
  - pnpm: 10.24.0
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior: Required run `29297816036` measured `[data-testid="ide-design-inspector-edit-group"]` at `top=607`, `bottom=898`, `height=291`, and `visibleHeight=161` in a `1366x768` viewport.
- Expected behavior: Selection identity is followed immediately by usable primary edit actions, with the edit group beginning before `viewport.height - 180` and without reducing text or control targets.
- Why this matters: Copy, duplicate, rename, trace, and gate-swap actions are the direct student task after selecting a circuit part. Starting them below the first classroom viewport makes the normal authoring loop look unavailable.
- Severity: release blocker

## Reproduction

- Exact repro steps:
  1. Build the playground from `dd00346c954a61fca3ab722dda362c26b073a634` under Node 20.19.0 and pnpm 10.24.0.
  2. Open the Project surface in a fresh `1366x768` browser context.
  3. Load the Half Adder starter.
  4. Select the AND gate on the Design canvas.
  5. Measure `[data-testid="ide-design-inspector-edit-group"]` before scrolling the inspector.
- Reproducibility: native Windows renders the baseline edit group at `top=567` and passes with only `21px` of threshold margin. In a controlled isolation experiment, changing only the selected inspector to Verdana grows the identity from `373.531px` to `414.031px` and moves the edit group to `top=607.031`, reproducing the remote geometry.
- First known version or date: professional rebrand main SHA `dd00346c9`, 2026-07-13

## Evidence

- Screenshot / recording: local baseline capture under ignored `.redbyte/product-immersion/rebrand-release-recovery/before-1366x768.png`; the remote workflow uploaded no screenshot or artifact.
- Console excerpt: `1366x768: edit actions start too low {"top":607,"left":1130,"right":1327,"bottom":898,"width":197,"height":291,"visibleWidth":197,"visibleHeight":161}`
- Test / gate output: `corepack pnpm -s ide:gate:student-task-completion-flow` failed in Classroom Truth Gates run `29297816036`, job `86975034891`.
- Additional artifacts: local baseline/after geometry, the font-isolation metrics, manual action results, and viewport evidence are recorded under ignored `.redbyte/product-immersion/rebrand-release-recovery/`.

## Root Cause

- Classification: confirmed product-geometry fragility plus a locally isolated font-metric trigger; the exact font selected by remote Chromium is an inference because the workflow recorded no remote screenshot or computed font metrics.
- The action group retains the same `197x291` size locally and remotely; only its vertical position changes by 40px.
- The rebranded inspector puts a prose-heavy selection card after a fixed `51px` Hide-row cost and before Actions, leaving only `21px` of native-Windows threshold margin. At the narrow inspector width, the controlled wider-font experiment wraps the duplicated identity type and Board mapping fact, growing the card by the exact 40px seen remotely.
- Fresh browser contexts, unique preview origins, cleared storage, mutually exclusive selector branches, and one rendered instance of each relevant test ID rule out prior-gate state and hidden-selector contamination.

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` — canvas-first authoring and direct student action hierarchy
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` — Design selection and editing loop
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` — first-viewport classroom usability
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`, `docs/ide/SURFACE_CONFORMANCE.md`, `docs/ide/02-design.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/rehearsal/failure-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof: At `1366x768`, the compact selected-item identity precedes Actions, secondary teaching/reference details follow Actions, the unchanged edit-group threshold passes, and the canvas remains the dominant work object.
- Required test / gate command(s): playground build; three consecutive `ide:gate:student-task-completion-flow` runs; closest professional/layout guards; focused Design Vitest; full `classroom:gate`; docs, encoding, and diff checks.
- Required manual proof: Load Half Adder, select AND, use each relevant edit action, and inspect for overlap, nested-scroll traps, readable text, and canvas usability at `1366x768`, `1440x900`, and a `1094x614` CSS-pixel viewport equivalent to a 125% stress condition.
- Screenshot or recording expectation: ignored local before/after captures plus geometry JSON under `.redbyte/product-immersion/rebrand-release-recovery/`.

## Docs Review

- Docs that must be reviewed if behavior changes: `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/ide/02-design.md`
- Docs that must be updated if behavior changes: the same three current-truth documents

## Disposition

- Status: fixed; local acceptance proof complete
- Fix PR / commit: this release-recovery commit
- Local proof: frozen playground build; three consecutive focused gates; seven adjacent product/layout gates; focused Design Vitest (`45/45`); full `classroom:gate` (`846706ms`); docs (`29/29`), encoding, and diff checks; manual action replay at `1366x768`, `1440x900`, and the `1094x614` 125%-equivalent viewport.
- Notes: The original `editGroup.top < viewport.height - 180` threshold is unchanged. Remote checks, exact production identity, and production task replay remain delivery proof; broader Professional Rebrand Completion is not part of this repair.

## Attribution

Connor Angiel
