---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: whole-app product immersion audit for RedByte IDE
---

# RedByte Whole-App Product Immersion Audit

Date: 2026-06-12
Repo path: `C:\Users\conno\OneDrive\Documents\RedByte FPGA`
Branch at audit start: `main`
Audited commit at start: `3bd05c67`
Remote posture at start: `main...origin/main [ahead 2]`
Tracked worktree at start: clean
Node observed: `v24.15.0`
Repo-pinned Node: `.nvmrc` = `20.19.0`
pnpm observed: `10.24.0` through `corepack pnpm`
Vivado path checked: `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`
Vivado installed at checked path: no

This audit was a product-brain and whole-app immersion pass. It did not change product source, tests, golden fixtures, or generated baselines.

## Evidence Gathered

### Local server and browser commands

The manual in-app browser pass used the documented Windows launcher:

```powershell
Start-Process powershell.exe -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File",".\Start-RedByte.ps1","-NoOpen","-SkipInstall","-Port","5199"
```

URL: `http://127.0.0.1:5199/`
Viewport: `1366x768`

The automated clean-context pass used a separate Vite server because the in-app browser context could not reliably clear local storage:

```powershell
corepack pnpm --filter @redbyte/playground exec vite --host 127.0.0.1 --port 4173 --strictPort
```

URL: `http://127.0.0.1:4173/`

### Browser and gate evidence

| Evidence | Result |
|---|---|
| In-app browser Project -> Design -> Verify manual walkthrough | Completed. No console/page-error findings observed. Captured first-launch, Project, Design, Verify observe, Verify compare pass, intentional failure, and attempted repair screenshots. |
| `corepack pnpm exec playwright test --config playwright.dev.config.ts tests/e2e/ece141-product-immersion.spec.ts --project=chromium --retries=0` | Passed: 4 tests. |
| `corepack pnpm exec playwright test --config playwright.dev.config.ts tests/e2e/ece141-vivado-artifacts.spec.ts --project=chromium --retries=0` | Passed: 1 test. Downloaded and inspected E0-only Vivado ZIP packages for certified starters. |
| `corepack pnpm exec playwright test --config playwright.dev.config.ts tests/e2e/ece141-import-export-recovery.spec.ts --project=chromium --retries=0` | Passed: 2 tests. |
| `corepack pnpm -s ide:gate:blank-canvas-product-proof` | Initially failed because its helper spawns bare `pnpm` on Windows and this shell exposes pnpm only through `corepack pnpm`. After adding an ignored temporary PATH shim under `.redbyte/product-immersion/2026-06-12-whole-app-audit/tool-shim/pnpm.cmd`, the unchanged gate passed. |

### Screenshot and artifact locations

Manual in-app browser screenshots:

- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/01-first-launch-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/03-project-dismissed-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/04-logic-gates-after-load-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/05-verify-logic-gates-before-run-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/06-verify-logic-gates-observe-run-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/07-verify-logic-gates-compare-pass-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/08-verify-logic-gates-intentional-fail-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/09-verify-logic-gates-repaired-pass-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/09b-verify-logic-gates-repaired-final-1366x768.png`
- `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/10-verify-logic-gates-reset-rerun-1366x768.png`

Automated product-immersion screenshots and findings:

- `.redbyte/product-immersion/empty-project-findings.json`
- `.redbyte/product-immersion/logic-gates-findings.json`
- `.redbyte/product-immersion/half-adder-findings.json`
- `.redbyte/product-immersion/sequential-findings.json`
- `.redbyte/product-immersion/screenshots/*.png`

Vivado package inspection artifacts:

- `.redbyte/product-immersion/sprint5-vivado-artifacts/downloads/*.zip`
- `.redbyte/product-immersion/sprint5-vivado-artifacts/extracted/**/top.vhd`
- `.redbyte/product-immersion/sprint5-vivado-artifacts/extracted/**/top.xdc`
- `.redbyte/product-immersion/sprint5-vivado-artifacts/extracted/**/README.txt`
- `.redbyte/product-immersion/sprint5-vivado-artifacts/extracted/**/EXPECTED_IO.json`

## Product Readiness Verdict

RedByte has a credible deterministic student workflow spine:

`Project -> Design -> Verify -> Map Pins / Hardware -> Export`

The core technical promise is much stronger than a prototype: starter workflows load, Verify Compare can pass, intentional failures are explainable, mapping state participates in trust, E0 Vivado packages are structurally coherent, project persistence/import/export recovery pass, and a blank-canvas AND workflow can reach Verify PASS and Export.

The product is not yet ready for unsupervised classroom or commercial deployment. The largest blockers are not missing core engines; they are student-facing coherence issues in first-viewport layout, recovery from failure edits, export action clarity, hardware mapping visibility, and evidence-tier language. A first-time student can reach the good path, but too much of the important state is offscreen, crowded, or phrased for maintainers rather than learners.

## Surface Audit

| Surface | What works | Product problem | Severity |
|---|---|---|---|
| Project | Launches cleanly; recommended starters are present; onboarding can be dismissed. | Primary starter action is below the first viewport at 1366x768, and the proof ribbon says `Mapping 0 missing` before a circuit exists. | P1 |
| Design | Blank canvas and starter project paths are reachable; empty-state quick action can create an AND circuit; circuit health is visible. | For starter projects, the first viewport is dominated by palette, toolbar, banner, circuit health, and inspector. The actual circuit graph is not visible without scrolling. | P1 |
| Verify | Observe and Compare modes are real; compare pass reports aligned checks; intentional mismatch explains signal, tick, expected, and observed values. | The run deck is crowded/truncated, and the expected-output edit repair path can leave stale failure state or a disabled run button in the dirty in-app context. | P1 |
| Map Pins / Hardware | Mapping state exists and participates in readiness; automated tests verify mapped starter paths. | The first viewport hides the map table and board diagram. Left-dock prose collapses into narrow stacked words. A "Ready to map" card can appear even when the project is already mapped. | P1 |
| Export | E0 package generation is honest; downloaded packages include VHDL, XDC, Vivado TCL, project manifest, README, and EXPECTED_IO. | First viewport can say "Ready to Build" while the rail still says `Export Draft`; primary download/build action is not visible immediately. | P1 |
| Import | Import entry is visible; import/export recovery gate passes in clean browser context. | Import is visually polished but not yet proven as a broad HDL/Vivado migration flow in this audit. | P2 |
| Evidence tiers | E0 versus E1-E3 boundary is explicit in UI and package README. | The language is honest, but still abstract for new students unless paired with concrete next actions. | P2 |
| Dev/runtime chrome | Build hash, saved status, question/help affordance, workflow status, and mode footer are visible. | Some labels are useful to maintainers but can feel like debug chrome in a student product. | P3 |

## Workflow Audit

| Workflow | Result | Notes |
|---|---|---|
| A. First launch on a clean profile | Pass with UX issues | Project surface loads, onboarding appears, and no console errors were observed. Primary starter action is not fully first-viewport obvious. |
| B. Build a simple combinational circuit from scratch | Pass through blank-canvas gate | `ide:gate:blank-canvas-product-proof` reset to blank canvas, added IO + AND through real UI click, ran Observe, saved outputs, ran Compare PASS, checked map rows, and reached Export with a download button. The gate required a temporary ignored `pnpm.cmd` shim because the harness spawns bare `pnpm` on Windows. |
| C. Use a starter and complete Verify | Pass | Logic Gates and Half Adder starters complete Verify Compare PASS in clean contexts. Manual pass also confirmed an intentional Logic Gates failure is explained clearly. |
| D. Sequential/clocked starter | Pass with scope boundary | Two Bit Counter and Security Lock starter screenshots confirm clock/auto-clock UI and sequential/deferred language. This is not a hardware-observed proof. |
| E. Stale state and edited expectations | Partial / issue found | Intentional expected-output edit created a clear FAIL. Repair attempts in the same dirty in-app browser context left stale mismatch/run state. Clean contexts still passed starter workflows. |
| F. Design mistakes and missing wiring | Partial | Circuit health and empty-state controls are visible, but this pass did not deeply exercise every manual wiring and correction path beyond the blank-canvas AND quick action. |
| G. Project recovery/persistence | Pass | `ece141-import-export-recovery.spec.ts` passed project persistence and recovery smoke tests. |
| H. Vivado export readiness | E0 pass only | `ece141-vivado-artifacts.spec.ts` inspected ZIP structure and semantic parity. No Vivado install or Basys3 board proof was available on this desktop. |

## Top Product Issues

### P1: Design does not show the designed circuit in the first viewport

- Surface: Design
- Journey segment: starter project load, first inspection
- Environment: Windows, in-app browser and Playwright Chromium, 1366x768
- Observed behavior: Logic Gates and Half Adder starter Design screenshots show the toolbar, library, health row, and inspector before the actual circuit graph.
- Expected behavior: The first Design viewport should make the current circuit the main object, with tools supporting it instead of displacing it.
- Why this matters: Students need to inspect what loaded before trusting Verify, mapping, or Export.
- Evidence: `.redbyte/product-immersion/screenshots/logic-gates-design.png`, `.redbyte/product-immersion/screenshots/half-adder-design.png`
- Minimum acceptance proof: At 1366x768, loading a starter shows meaningful circuit nodes and at least one connection without scrolling; existing product-immersion and screenshot gates still pass.

### P1: Hardware mapping hides the board and table below the fold

- Surface: Map Pins / Hardware
- Journey segment: post-Verify mapping inspection
- Environment: Windows, Playwright Chromium, 1366x768
- Observed behavior: Logic Gates map screenshot does not show the mapping table or Basys3 board diagram in the first viewport. The left dock text wraps into narrow word columns.
- Expected behavior: First viewport should show the board interaction target and mapping table, with current mapped state unmistakable.
- Why this matters: Mapping is the bridge between simulation and physical hardware. If it looks hidden or contradictory, students cannot build trust.
- Evidence: `.redbyte/product-immersion/screenshots/logic-gates-map-pins.png`
- Minimum acceptance proof: Map Pins first viewport shows mapped rows, the board affordance, and an unambiguous mapped/ready state for the certified starters.

### P1: Verify expected-output repair can leave stale failed state in a dirty browser context

- Surface: Verify
- Journey segment: fail, edit expected value, rerun
- Environment: Windows, in-app browser, 1366x768, same context after intentional mismatch
- Observed behavior: After intentionally flipping `LD0` expected output at tick 0, Verify correctly reported FAIL. Clicking the expected cell back and rerunning left the surface in a stale/running or repeated-failure state in the same context.
- Expected behavior: A student should be able to repair an expected value and rerun to a terminal PASS/FAIL without stale disabled controls.
- Why this matters: Failure repair is the most important learning loop. A stuck repair path causes students to distrust their own fix.
- Evidence: `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/08-verify-logic-gates-intentional-fail-1366x768.png`, `09*.png`, `10-verify-logic-gates-reset-rerun-1366x768.png`
- Minimum acceptance proof: A focused browser test flips one expected output, confirms FAIL, restores the expected value, reruns, and reaches PASS with no stale disabled run button.

### P1: Export readiness and action hierarchy are not first-viewport clear

- Surface: Export
- Journey segment: after Verify PASS and mapped state
- Environment: Windows, Playwright Chromium, 1366x768
- Observed behavior: Export can say "Ready to Build" while the lab-flow rail still says `Export Draft`; the primary download/build action and artifact preview are below the first viewport.
- Expected behavior: Export should show one current trust state and the primary next action immediately after a proven workflow.
- Why this matters: Export is the handoff to Vivado. Contradictory or hidden action state weakens confidence at the most consequential point.
- Evidence: `.redbyte/product-immersion/screenshots/logic-gates-export-ready.png`, `.redbyte/product-immersion/screenshots/half-adder-export-evidence.png`
- Minimum acceptance proof: For a certified starter after Verify PASS and mapped state, the first Export viewport shows current trust state, primary download/build action, and E0 boundary without contradictory rail text.

### P1: Project first launch delays the recommended start action

- Surface: Project
- Journey segment: first launch, course entry
- Environment: Windows, in-app browser and Playwright Chromium, 1366x768
- Observed behavior: Recommended starter path is present, but the main call to load a starter can sit below the first viewport. The proof ribbon says `Mapping 0 missing` even before a circuit exists.
- Expected behavior: A first-time student should see the recommended next action and a neutral no-circuit state immediately.
- Why this matters: The first 30 seconds determine whether the product feels like a classroom tool or a dashboard with hidden work.
- Evidence: `.redbyte/product-immersion/screenshots/surface-project-launch.png`, `.redbyte/product-immersion/2026-06-12-whole-app-audit/screenshots/03-project-dismissed-1366x768.png`
- Minimum acceptance proof: Clean first launch at 1366x768 shows the recommended starter CTA and avoids misleading missing-mapping copy until a circuit exists.

## Secondary Gaps

- The product has many strong controls, but not all of them were exhaustively exercised in this audit. Manual wiring, undo/redo/delete, fit, code/split modes, custom HDL import, and every board pin assignment variant need focused follow-up.
- Import entry is visible and recovery gates pass, but broad Vivado ZIP import fidelity was not manually inspected across multiple projects.
- Vivado package content is structurally credible, but this desktop did not run Vivado or hardware proof. E1/E2/E3 claims remain externally gated.
- Several docs now form a useful cockpit, but future agents still need an explicit product-brain map to avoid reviving stale OS-era or aspirational docs.

## What Should Not Be Reopened From This Audit

- The core Project -> Design -> Verify -> Map Pins / Hardware -> Export spine is the right spine.
- E0-only export language is directionally correct and should not be weakened.
- Vivado remains downstream; RedByte should not pretend to synthesize, implement, program, or observe hardware without external proof.
- The product needs student-facing hardening, not a new product concept or a new `.redbyte-brain/` directory.

## Recommended Next Slices

1. Fix first-viewport hierarchy for Project, Design, Hardware, and Export.
2. Add a focused Verify failure-repair regression test before changing the repair behavior.
3. Make Export trust/action state singular and first-viewport visible.
4. Run the Vivado/Basys3 E1/E2/E3 proof restoration only on a machine with Vivado 2024.2 and real Basys3 hardware.
5. Use `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md` as the doc-routing map for future product agents.

