# Product Hardening Ticket: Startup / Project Entry / Starter-Load Determinism

## Ticket

- Title: Startup / Project entry / starter-load determinism
- Date: 2026-04-21
- Owner: Connor Angiel
- Surface: Project + Design + shared shell / workflow spine
- Journey segment: Startup / first run; Project entry / project selection
- Mode: Student
- Environment:
  - Fresh machine / clean browser profile: targeted; replayed in a clean Playwright browser context against the local dev server
  - OS: Windows
  - Browser: Chromium (Playwright/local)
  - Node: `v20.19.0`
  - pnpm: `10.24.0`
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - Starter selection and first-run project entry feel rough.
  - Loading a starter, specifically the Lab 8 starter, does not always make the authoritative design change obvious on the Design surface.
  - The student can be left uncertain about which project is active, whether the starter actually loaded, and what the next action is.
- Expected behavior:
  - Selecting a starter deterministically replaces the active project authority, visibly updates the schematic, and confirms which starter is now active.
  - The transition from Project -> Design should make the new active design obvious without requiring extra clicks or inference.
- Why this matters:
  - This is a Project-surface trust and Design-surface coherence break on the first high-value student path.
  - A lab-machine first run that feels ambiguous weakens product legitimacy even when the underlying code is technically correct.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Boot the IDE on the default route.
  2. Use the Project surface starter flow.
  3. Load the Lab 8 starter.
  4. Observe whether the active project context, surface transition, and Design schematic change are immediate and unmistakable.
- Reproducibility: always
- First known version or date: reported by user on 2026-04-21

## Evidence

- Screenshot / recording: `artifacts/startup-project-entry-lab8-after-hardening.png`
- Console excerpt: runtime replay summary showed `mode=Design`, `project=Lab 8 Starter — Security Lock FSM`, and `nextAction=Connect ENTER (SW5) to the CLK pin of EVERY DFlipFlop`
- Test / gate output:
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/ideApp.labday-wiring.test.tsx -t "Lab 8 starter|holds starter replacement"` -> pass
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx` -> pass
- Additional artifacts: local runtime replay against `http://127.0.0.1:5173/os/?mode=project`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` §4.1 Global Shell Contract, §4.2 Project Surface, §4.3 Design Surface
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` §6 shell/workflow, §7.1 Project Surface
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` workflow coherence and product-legitimacy framing
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` surface responsibility table; runtime authority map
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phase 1 and Project-entry pass criterion

## Acceptance Proof

- Minimum acceptance proof:
  - Selecting/loading a starter project reliably updates the active design state.
  - The Design schematic visibly changes without extra interaction.
  - The active project/starter is clearly reflected in the UI.
  - The next action after load is obvious.
- Required test / gate command(s):
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/ideApp.labday-wiring.test.tsx -t "Lab 8 starter|holds starter replacement"`
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/designSurface.blankState.test.tsx`
- Required manual proof:
  - runtime replay of Project -> Lab 8 starter -> Design
- Screenshot or recording expectation:
  - capture or explicit runtime confirmation of the post-load Project and Design states

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/release/manual-assignment-qa-script.md`
  - `AI_STATE.md`
- Docs that must be updated if behavior changes:
  - this ticket
  - any current-truth doc whose described starter-load behavior changes
  - `AI_STATE.md`

## Disposition

- Status: fixed
- Fix PR / commit: none
- Notes:
  - Reproduced in the running app: starter load updated the top bar, but the Design handoff did not explicitly confirm what changed or what the student should do next.
  - Root cause: Project starter buttons were splitting the flow across two owners. `ProjectSurface.tsx` forced `onOpenDesign()` directly while `IdeApp.tsx` separately owned example loading and overwrite confirmation. That allowed the UI to jump toward Design before starter authority was fully settled, and Design had no dedicated starter-loaded confirmation surface.
  - Fix implemented:
    - `packages/rb-apps/src/apps/IdeApp.tsx`
    - `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
    - `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
    - `packages/rb-apps/src/apps/ide/ide-root.css`
    - `packages/rb-apps/src/apps/ide/__tests__/ideApp.labday-wiring.test.tsx`
  - This slice remains intentionally narrow: startup, project entry, starter-load determinism, and the immediate Project -> Design handoff.

## Attribution

Connor Angiel
