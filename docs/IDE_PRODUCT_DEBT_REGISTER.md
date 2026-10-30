---
doc_status: current
last_validated: 2026-10-28
owner: Connor Angiel
used_by_claude: true
role: canonical IDE product debt register
---

# RedByte IDE Product Debt Register

This file owns IDE product debt. The current composition is the P2.6C Studio continuation; source, contracts and current tests establish behavior. The dated July and earlier entries below preserve reproduction history and do not restore an older shell, disclosure or dock contract.

## Current disposition - 2026-09-30

- The user journey is Project -> Design -> Simulate -> Board & Constraints -> Build & Export. Internal route IDs remain project/design/verify/hardware/export; Import is a utility.
- The current shell uses the workspace rail and object tabs. Compact Design has an explicit inspector reveal; the library remains available while placing components and Wire mode preserves canvas geometry.
- Canonical snapshots preserve original sources, hierarchy, captured constraint sets and active selection. Captured mapping sets own their restored assignments; raw Tcl remains reference-only. The shared recording model keeps selected, previous compatible, historical and stale recordings distinct.
- Authored checks, exploratory input controls, replay and failure disclosures have separate owners. Human case labels do not change execution ticks. Board preview, actual export ZIP and embedded manifest must agree with the active mapping.
- The finite local completion checklist and its evidence are in [the Studio finish ticket](release/product-hardening-ticket-2026-09-12-p2-6c-studio-finish.md). [The local candidate walkthrough](release/local-candidate-quickstart.md) describes supported use and backup boundaries.
- Remaining debt includes raw rb-apps typecheck (570 diagnostics), extended human/classroom acceptance, fresh-machine Windows verification, unsigned distribution, browser storage quota/eviction and print-manual regeneration. Browser E0 does not establish Vivado E1, programming E2 or observed-board E3.
- Legacy root/polish CSS still participates in the product. Broad deletion remains unsafe; any future cleanup needs scoped source and browser evidence.
- 2026-10-20: the Meridian investigation and P1 studio slice filed RB-DEBT-013 to RB-DEBT-027 (below). The studio entry is isolated from the legacy cascade; it does not change the classic workbench debt above.
- 2026-10-25: the Meridian Atlas completion pass filed RB-DEBT-028 (below).
- 2026-10-28: owner acceptance of 1.0.0-rc.7 fixed RB-DEBT-030 in rc.8 and filed RB-DEBT-032 to RB-DEBT-034 (below; decision document `docs/validation/v1-owner-acceptance-dossier-2026-10-28.md`).
- 2026-10-30: PR #88's classroom chain (12 stages red since the 2026-10-20 seal) filed RB-DEBT-035 and RB-DEBT-036 (below); the space, status-line and camera fixes are recorded in the V1 contract entry of that date and in `docs/validation/test-debt.md`.

## Historical July 2026 stable truths

These statements describe the July reconstruction, not the current Studio composition.

- The product authority is exactly `Project -> Design -> Verify -> Map Pins -> Export`; Import is a separate utility and not a sixth progress stage.
- Unified Workbench v3 removes the proof ribbon, bottom status footer, injected product-spine header, permanent workflow side rail, onboarding overlay, and core `details` disclosures. The persistent shell is one product bar, one horizontal five-stage navigator, and one active workbench; Import remains a separate utility.
- Project is an action-first home rather than a readiness-card dashboard. First launch exposes one dominant `Start a Lab` path; loaded state exposes Continue plus direct alternate project paths without an orientation overlay or duplicate identity authority.
- Design is canvas-first with three stable regions: a 212px component library, the dominant circuit canvas, and a 256px selection/repair inspector at the laptop reference widths. The retired Hide/Show dock controls are absent.
- Verify has one Run authority and stable Signals, testbench, and waveform/evidence regions. Observe remains non-proof trace evidence; Compare remains expected-output proof; failure recovery exposes direct testbench-versus-design repair choices without hiding them in a disclosure.
- Basys3 `CLK100MHZ` on `W5` is the authoritative board clock. Verify auto-runs it by default, manual pulses remain an explicit override, and exported `testbench.vhd` owns a free-running `clock_gen` process for the board clock.
- The board-clock browser proof gate exists in `tests/e2e/board-clock-browser-proof.spec.ts` and was already committed on `origin/main` before this pass.
- Map Pins is mapping-table first with a compact selected-signal-to-board-resource-to-package-pin consequence chain; Export is readiness and handoff first. Both retain the browser-E0 boundary and do not claim Vivado E1, programming E2, or board observation E3.
- `ide-root.css` is still the primary legacy style system, and `ide-polish-pass.css` is still an additive overlay. Neither file should be pruned casually.
- Unified Workbench v3 has deterministic multi-viewport browser gates, focused surface tests, and retained screenshot evidence. That proof is sufficient for this bounded reconstruction, but it still does not authorize broad deletion from the legacy CSS strata.

## Historical July 2026 Unified Workbench v3 debt

- **Design space target:** the enforced laptop floor is 62% of the full viewport. The measured canvas is 63.1% at `1366x768` and 65.0% at `1440x900`; the separate 70% strategic laptop target remains unmet.
- **Usability evidence:** blind Student A and B flows completed locally. Student C stopped after native Import confirmation when browser control became unavailable, and the XOR flow has automated browser proof only. The usability lab is therefore partial.
- **CSS authority:** the legacy root/polish files were reduced, but the total tracked CSS tree grew because v3 introduced surface-owned styles. Broad CSS deletion remains unsafe; keep each future change surface-scoped and browser-proven.
- **Release boundary:** the v3 reconstruction is local source and browser-E0 proof only. It has not been pushed or deployed, and no new Vivado E1, Basys3 programming E2, or observed-board E3 evidence was produced.
- **Next product sequence:** after explicit approval and branch review/sync, rebase the Guided 4-Bit Adder work, then build Hardware Mapping Assistant v2. Fresh hardware certification remains a separate proof lane.

## Historical Debt Ledger

The entries below preserve reproduction history and risk context. July dispositions explain that reconstruction; the current September disposition and linked finish ticket take precedence for the present candidate.

### RB-DEBT-001 - Hardware / Map Pins workspace still reads too dense

- Severity: High
- Category: UI/UX
- Surface: Hardware
- Current evidence: Initial 2026-05-02 audit showed right-inspector/XDC dominance at `1366x768`. A 2026-05-03 layout pass reduced default inspector density, added explicit board-task framing, and moved XDC/diagnostics/preflight details behind collapsed sections. Remaining debt is now mostly visual balance tuning, not workflow ambiguity.
- How to reproduce or inspect: Start the playground, load `2-Bit Up Counter (Basys3)`, open `Map Pins`, inspect the default layout at `1366x768`, then compare center-board prominence against the left mapping rail and right-side selected-signal / board-resource / XDC sections.
- Why it matters: Hardware is supposed to feel like the student's pin-binding job, not a split diagnostics page with a narrow mapping strip.
- Risk if touched: High. Hardware shares workflow truth and mapping authority with Export; layout changes can easily hide board truth or break the mapping -> XDC explanation chain.
- Suggested next pass: Screenshot-backed Hardware density cleanup focused on board/table/inspector hierarchy and stage emphasis, not mapping semantics.
- Tests/browser proof needed: Enforced hardware screenshots at `1366x768` and `1920x1080`, plus a browser proof that row selection, board highlight, and XDC preview stay coherent.
- Files likely involved: `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`, `packages/rb-apps/src/apps/ide/surfaces/hardware/HardwareSurfacePrimitives.tsx`, `packages/rb-apps/src/apps/ide/ide-root.css`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`, `tests/e2e/ide-screenshot-baseline.spec.ts`.
- Status: **Partially resolved (2026-05-03)** — map-mode default is now task-first (concise no-selection inspector, collapsed advanced sections, clearer row action affordances, and explicit board-task copy). Hardware no longer reads like a permanent debug panel. Remaining work: minor visual tuning after Export density pass.
- Follow-up (2026-05-05): mapped signal rows now separate circuit signal identity, role chips, mapped status, board binding/package pin, and the Edit Mapping action. Browser audit at `1366x768` and `1920x1080` confirmed the rows no longer read as a cramped debug-badge run while the Basys3 board remains the visual anchor.

- Follow-up (local 2026-07-13, browser-E0 validated): Map Pins now begins with the mapping table and direct signal-to-Basys3-resource-to-package-pin action loop. Board reference, XDC explanation, and after-mapping tools are secondary; mapping authority and generated XDC semantics are unchanged. The after-state conflict repair path was not manually replayed after implementation.
- V3 disposition (2026-07-15): **Closed as a general density finding; bounded follow-up remains.** Unified Workbench v3 keeps the mapping table primary, compresses the selected consequence chain, widens board switch hit targets, and browser-proves conflict repair. Hardware Mapping Assistant v2 is the next planned capability slice, not evidence that the current page is still the May 2026 error-like layout.

### RB-DEBT-002 - Export still splits attention between readiness and diagnostics

- Severity: High
- Category: Product flow
- Surface: Export
- Current evidence: Live browser audit on 2026-05-02 at `1366x768` still shows duplicated readiness language (`Run Verify before relying on this handoff`) across the hero and handoff summary while a dense right rail competes with the main handoff story. The surface is improved, but it still reads half like a readiness page and half like a diagnostics console.
- How to reproduce or inspect: Load `2-Bit Up Counter (Basys3)`, open `Export`, and inspect the first screen before scrolling into artifact previews.
- Why it matters: Export is the final handoff surface. If the first screen does not make the dominant next action and package trust story obvious, students will treat the page like a generic diagnostics dump.
- Risk if touched: High. Export owns submission/program handoff truth and shares readiness language with Hardware.
- Suggested next pass: Screenshot-backed Export density cleanup that strengthens the readiness hero, trims duplicated summary copy, and demotes advanced diagnostics until after the dominant next action is clear.
- Tests/browser proof needed: Enforced export screenshots at `1366x768` and `1920x1080`, plus focused browser proof that the primary CTA and artifact workspace remain reachable and honest.
- Files likely involved: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`, `packages/rb-apps/src/apps/ide/surfaces/export/ExportSurfacePrimitives.tsx`, `packages/rb-apps/src/apps/ide/ide-root.css`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`, `tests/e2e/ide-screenshot-baseline.spec.ts`.
- Status: **Resolved (2026-05-05)** — commit `4a248098` (`fix(export): clarify draft versus trusted export`). Export summary card now names the current tier (`summaryStateTitle`: "Draft export available", "Export ready to build", "Trusted export ready"), next-action dock names the specific repair action (`nextActionTitleDistinct`), and trust consequence explains how to resolve (`nextActionDetailDistinct`). 18 trust-clarity tests pass; 3 export gates pass. Remaining visual/density debt (layout balance, CSS) is tracked in RB-DEBT-006 and RB-DEBT-007.

- Follow-up (2026-05-05): Export handoff hierarchy now splits the command-strip export state from the hero handoff summary. The command strip may say "Draft export available"; the summary says "Vivado handoff package generated"; the next-action dock owns the Verify repair path. Browser audit at `1366x768` and `1920x1080` confirmed the duplicate Draft heading is gone while Draft vs Trusted and Map Pins vs Verify boundaries remain explicit.

- Follow-up (2026-05-06): Export now includes a compact Vivado evidence diagnostics section that separates E0 package generation, E1 Vivado build/bitstream, E2 board programming, and E3 observed behavior. Browser audit on the 2-Bit Up Counter at `1366x768` and `1920x1080` confirmed the ladder is visible, E2 explicitly does not prove behavior, E3 remains manual-observation required, warning classes are listed, and no E3 overclaim is shown.

- Follow-up (local 2026-07-13, browser-E0 validated): Export now opens on one readiness decision and one state-appropriate recovery/build/download action. Generated-file browsing, diagnostics, Vivado instructions, and proof metadata are secondary; draft/trusted and E0/E1/E2/E3 boundaries remain intact.

### RB-DEBT-003 - Verify stimulus authoring is clearer but still structurally heavy

- Severity: Medium
- Category: UI/UX
- Surface: Verify
- Current evidence: Commit `826a4f92` added a real `Test stimulus` header, authoring sections, mode-aware copy, and compare-check explanation text. A 2026-05-03 follow-up layout pass then tightened command hierarchy, compacted stimulus framing, improved clock-policy control grouping, added a collapsible signal rail, and improved waveform pre-run guidance while preserving board-clock and export semantics. A second hardening slice on 2026-05-03 fixed command-row hit interception (`Run` click blocker) and a first-run -> post-run hook-order crash, then revalidated browser + board-clock + export gates.
- How to reproduce or inspect: Load a sequential project such as `2-Bit Up Counter (Basys3)`, open Verify, and compare first-run readability against the underlying grid density once the student starts editing rows.
- Why it matters: Verify is the proof-authoring surface. Students still need a clearer visual path from clock policy to driven inputs to checked outputs without breaking the deterministic semantics that are now proven.
- Risk if touched: Very high if semantics drift. Board-clock policy detection, manual overrides, waveform behavior, Compare freshness, and export testbench generation must not change casually.
- Suggested next pass: Minor visual tuning only (spacing and copy), plus screenshot-proof hardening before any broader Verify CSS cleanup.
- Tests/browser proof needed: ScenarioBuilder focused tests, board-clock browser proof gate rerun, and full-surface screenshots before broader CSS pruning in Verify.
- Files likely involved: `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`, `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `packages/rb-apps/src/apps/ide/surfaces/verify/VerifySurfacePrimitives.tsx`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`, `tests/e2e/board-clock-browser-proof.spec.ts`.
- Status: **Partially resolved (2026-05-03)** - Verify now presents a clearer two-column workbench (compact stimulus strip, collapsed-by-default guidance + rail, cleaner clock panel grouping, stronger waveform pre-run guidance) with command-row/runtime stability fixes and board-clock/browser/export proof gates rerun green. Clock section further trimmed on 2026-05-03 (second pass): redundant Detected/Mode/Reset detail lines hidden via CSS so full cases grid is visible without scrolling. Remaining debt: small visual polish only, no semantic changes.

- Follow-up (local 2026-07-13, browser-E0 validated): Verify has one command-bar Run authority, compact/disclosed session context, and a repaired Observe-only to Compare-checks transition. Focused repair/wrong-build/testbench gates and the full classroom aggregate pass.
- V3 disposition (2026-07-15): **Closed for the v3 reconstruction.** Verify now presents stable Signals, testbench, and waveform/evidence regions; makes row authoring visually direct; keeps Compare truth distinct from Observe evidence; and places stale/wrong-scenario recovery above secondary utilities. Repeated-use usability remains bounded by the partial student lab rather than by a known structural blocker.

### RB-DEBT-004 - Design workbench still needs a screenshot-backed polish pass

- Severity: Medium
- Category: UI/UX
- Surface: Design
- Current evidence: The idle inspector overview and Verify-linked messaging are materially better, but the live browser surface still reads visually flat in calm state and the overall workbench composition needs a screenshot-backed review before any CSS simplification.
- How to reproduce or inspect: Open Design on a starter project, inspect the calm/default workspace state, then compare how much visual hierarchy the canvas, tool row, and idle inspector actually communicate.
- Why it matters: Design is the core authoring surface. If it feels spatially weak or generic, later cleanup passes tend to reintroduce extra chrome instead of strengthening the existing hierarchy.
- Risk if touched: Medium. Design has strong test coverage, but broad CSS edits still risk replay, inspector, or tool-row regressions.
- Suggested next pass: Browser-backed Design polish review after screenshot baselines are enforceable, with emphasis on canvas primacy and calm-state hierarchy.
- Tests/browser proof needed: Enforced Design screenshots at `1366x768` and `1920x1080`; rerun Design workstation suites after any UI pass.
- Files likely involved: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`, `packages/rb-apps/src/apps/ide/ide-root.css`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`, `tests/e2e/ide-screenshot-baseline.spec.ts`.
- Status: Partially resolved with multi-viewport browser-E0 proof; minor visual tuning and repeated-use review remain.
- Follow-up (2026-05-06): starter-loaded guidance now uses a compact default hierarchy. The visible row keeps starter identity, next action, and Verify/Project actions; long summary and expected behavior move behind `Starter brief`. Browser audit at `1366x768` and `1920x1080` confirmed the starter banner no longer collapses the canvas to a 15-49px strip; the 1366 starter canvas is now about 120px. Remaining Design debt: left library density, generic/skinny inspector usefulness, and the existing stacked-inspector layout at 1366px.
- Follow-up (2026-05-06): idle Design inspector now shows a compact current-I/O readout with input/output labels, package pin aliases, live values, and an explicit Verify-proof boundary. `ide:gate:design-correctness-contract` was reconciled from stale live-state-table selectors to current quick-input + inspector I/O selectors, restoring truth-table coverage for Signal Tour and Logic Gates. Remaining Design debt: left library density and broader screenshot-backed composition review.

- Follow-up (local 2026-07-13, browser-E0 validated): Design now gives the circuit canvas first-order space, keeps only core editing controls direct, allows the library to collapse, and waits for a selection/repair context before opening the inspector. Four-viewport professional proof and the Design-focused/classroom gates pass.
- V3 disposition (2026-07-15): **Superseded and closed for current composition.** Library, canvas, and inspector are stable visible regions; the old collapse/restore model is retired. Laptop canvas measurements clear the enforced 62% full-viewport floor, while the distinct 70% strategic target remains open.

### RB-DEBT-005 - Project home is improved but still needs a low-risk continuity audit

- Severity: Low
- Category: Product flow
- Surface: Project
- Current evidence: Project is now a proper dashboard/home surface with a collapsed bridge disclosure, but examples / recent-work / advanced-detail hierarchy still needs periodic browser review so low-level details do not leak back into the top story.
- How to reproduce or inspect: Open Project Home and a loaded project at desktop viewports, then verify that the dominant hero, next action, and secondary details still read as one coherent front-door story.
- Why it matters: Project is the product's orientation surface. Drift here misroutes students before they ever reach Design or Verify.
- Risk if touched: Low to medium. Project has direct tests, but wording or hierarchy regressions can still reintroduce dashboard clutter.
- Suggested next pass: Keep this as a screenshot-backed continuity check, not a styling sprint.
- Tests/browser proof needed: Enforced Project screenshots and existing project surface suites.
- Files likely involved: `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`, `packages/rb-apps/src/apps/ide/components/ProjectSurfacePrimitives.tsx`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`, `tests/e2e/ide-screenshot-baseline.spec.ts`.
- Status: Partially resolved with first/loaded multi-viewport browser-E0 continuity proof.

- Follow-up (local 2026-07-13, browser-E0 validated): Project first launch is rebuilt around `Start your circuit` and one dominant action; loaded state emphasizes Continue with alternate paths disclosed. Professional-rebrand and full classroom continuity gates pass.
- V3 disposition (2026-07-15): **Closed for the v3 reconstruction.** Project has one editable identity authority, one dominant first-launch action, direct loaded-project paths, visible continuity state, and no orientation overlay or core disclosure controls. The student-lab limitation is tracked globally rather than as a Project-specific continuity blocker.

### RB-DEBT-006 - Global CSS remains geological debt (strategy-first)

- Severity: High
- Category: CSS debt
- Surface: Global CSS
- Current evidence: measured inventory now comes from `pnpm css:audit:ide` (`scripts/ide-css-audit.mjs`), not handwritten header notes.
- Final 2026-07-15 audit snapshot: `ide-root.css` has `36,053` lines and `6,078` selector entries; `ide-polish-pass.css` has `6,127` lines and `1,250` selector entries. The audit reports zero errors and zero warnings.
- Checkpoint-to-v3 legacy root/polish change: `42,617 -> 42,180` lines (`-437`) and `4,787 -> 4,631` `!important` declarations (`-156`). Exact selector overlap remains `5 -> 5`.
- Checkpoint-to-v3 total tracked CSS change: `+4,088 / -453`, or `+3,635` net lines, and `4,820 -> 4,904` `!important` declarations (`+84`). This is not a total-CSS cleanup claim: the growth comes from new surface-owned v3 styles, including 240 new `!important` declarations.
- Broad substring selectors in root: `2` (`[class*="ide-verify-"][class*="-banner"]`, `[class*="ide-verify-"][class*="-notice"]`).
- The local recomposition deletes the playground CSS mirror (`apps/playground/src/ide/ide-root.css`) so the app no longer carries a second 825-line shell override source.
- `theme/redbyte-primitives.css` is the scoped professional primitive layer (`704` lines in the final snapshot) with `0` `!important` declarations, `0` test-id selectors, and `0` broad class-substring selectors. It does not erase the remaining root/polish geological debt.
- Repeated raw color literals are still high in root (for example `rgba(255,255,255,0.06)` appears `44` times), confirming token drift risk.
- Guardrail policy now enforced in `pnpm css:audit:ide`:
- `ide-polish-pass.css` broad substring selectors (for example `[class*='...']`, `[class^='...']`) are **forbidden** and fail the audit (non-zero exit).
- `ide-root.css` broad substring selectors remain **legacy-warning only** in this phase (reported, not failing).
- Root/polish overlap is **warning-only** in this phase; baseline expected overlap is documented as `5`, and audit warns when this increases.
- Guardrail wiring status: `pnpm css:audit:ide` is now part of `pnpm verify:gates` so normal gate runs fail fast on polish selector regressions.
- How to reproduce or inspect: Read the header block in `packages/rb-apps/src/apps/ide/ide-polish-pass.css` and inspect the size and section strata in `packages/rb-apps/src/apps/ide/ide-root.css`.
- Why it matters: CSS debt is the main reason future UI passes are risky. Blind deletion will almost certainly regress one of the authority surfaces.
- Risk if touched: Very high. This is the most dangerous cleanup area in the repo without surface baselines.
- Suggested next pass: Keep strategy-first sequencing.
- 1. Lock metrics and risk map with `pnpm css:audit:ide` before each CSS slice.
- 2. Restrict every cleanup batch to one surface scope (Project, Design, Verify, Hardware, Export) with no cross-surface deletions.
- 3. Require baseline browser proof (`tests/e2e/ide-surface-baselines.spec.ts`) before/after each slice.
- 4. Prefer tokenization + selector dedupe over large deletions; delete only selectors proven dead inside the scoped slice.
- 5. Keep guardrails strict: no new broad substring selectors in polish; treat root broad selectors and overlap growth as explicit debt warnings until the cleanup phase upgrades those checks.
- Tests/browser proof needed: Mandatory screenshot baselines for Project / Design / Verify / Hardware / Export at at least `1366x768` and `1920x1080` before any serious deletion.
- Files likely involved: `packages/rb-apps/src/apps/ide/ide-root.css`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`, `tests/e2e/ide-screenshot-baseline.spec.ts`, `scripts/verify-gates-classroom.ts`.
- Status: In progress (instrumented) — strategy tooling and measurable baseline now exist; deletion-first cleanup remains blocked.

- Local 2026-07-15 status: legacy root/polish authority shrank and its exact overlap did not increase, while the total tracked CSS tree grew as v3 moved composition rules into surface-owned files. Broad deletion-first cleanup remains blocked; future work must separate legacy-strata reduction from total-tree growth and prove one surface at a time.

### RB-DEBT-007 - Screenshot and browser proof coverage exists, but it is not yet a trusted safety net

- Severity: High
- Category: Testing debt
- Surface: Tests
- Current evidence: `tests/e2e/ide-screenshot-baseline.spec.ts` already covers all six IDE modes, but it is skipped by default unless `SCREENSHOT_STRICT=1` and `CI_FAST` is unset. `tests/e2e/board-clock-browser-proof.spec.ts` proves the board-clock flow, but there is no equivalent mandatory browser or screenshot safety net for the next Hardware / Export density pass.
- How to reproduce or inspect: Read `tests/e2e/ide-screenshot-baseline.spec.ts`, `tests/e2e/board-clock-browser-proof.spec.ts`, and `scripts/verify-gates-classroom.ts`.
- Why it matters: The repo already has the beginnings of the right safety net. The current problem is that future agents can still skip it and then claim CSS or density cleanup is safe.
- Risk if touched: Medium. The infrastructure exists; the main risk is adding flaky visual gates without deterministic setup.
- Suggested next pass: Promote screenshot baselines from optional evidence to a deliberate gate for the authority surfaces, with deterministic setup and agreed viewport coverage.
- Tests/browser proof needed: Enforced screenshots for all authority surfaces, explicit `1366x768` coverage, and at least one stable browser proof per risky workflow slice.
- Files likely involved: `tests/e2e/ide-surface-baselines.spec.ts`, `tests/e2e/ide-screenshot-baseline.spec.ts`, `tests/e2e/board-clock-browser-proof.spec.ts`, `scripts/verify-gates-classroom.ts`, `playwright.config.ts`, `playwright.dev.config.ts`.
- Status: **Resolved** — `tests/e2e/ide-surface-baselines.spec.ts` added 2026-05-02. DOM-landmark gate covers all 5 authority surfaces (Project, Design, Verify, Hardware, Export) at `1366x768` and `1920x1080`. 2/2 pass. Screenshots saved as test artifacts. Pixel-diff baselines remain optional via `SCREENSHOT_STRICT=1`. Hardware and Export density cleanup may now proceed.

### RB-DEBT-008 - BUG-003 naming is still easy to misread even though the literal `React.act` failure is closed

- Severity: High
- Category: Docs/brain
- Surface: Tests
- Current evidence: `05 Bugs/BUG-003 React.act Infrastructure Failure.md` is a closed audit note, but repo docs and working memory still use `BUG-003 family` as shorthand for the broader pre-existing render-suite baseline. `AI_STATE.md` remains the live owner for the current baseline counts (`1120 / 1149` pass, `28` fail, `1` skipped in the 2026-05-02 UI audit entry), while older notes still carry historical framing.
- How to reproduce or inspect: Read `05 Bugs/BUG-003 React.act Infrastructure Failure.md`, `AI_STATE.md`, `03 Architecture/Test Infrastructure.md`, `CLAUDE.md`, and the Obsidian engineering brain.
- Why it matters: This is a repo-truth problem, not just a test problem. Agents can easily misread the closed literal bug as a reason to ignore the still-open render-family baseline, or vice versa.
- Risk if touched: Low if documentation only; high if someone tries to "fix BUG-003" by blindly bumping dependencies.
- Suggested next pass: Keep the literal bug closed, keep the broader baseline tracked separately, and only change the naming once the render-family baseline is actually retired.
- Tests/browser proof needed: Focused failing-suite inventory if the baseline changes; do not use blanket dependency churn as proof.
- Files likely involved: `05 Bugs/BUG-003 React.act Infrastructure Failure.md`, `AI_STATE.md`, `03 Architecture/Test Infrastructure.md`, `01 Dashboard/RedByte Engineering Brain.md`, `CLAUDE.md`.
- Status: Open

### RB-DEBT-009 - `build:unified` still has a Windows `dist/` lock failure mode

- Severity: Medium
- Category: Build/deploy
- Surface: Build/deploy
- Current evidence: Multiple 2026-05-02 `AI_STATE.md` entries record that the app build and merge complete, but the final root `dist/` verification can fail because Windows is holding the directory lock. Output is still written to `dist.staged`.
- How to reproduce or inspect: Run `pnpm -s build:unified` from Windows after normal product work and inspect whether the final root `dist/` handoff step can clear the existing directory.
- Why it matters: This is the canonical root build path. If it intermittently fails for environment reasons, it weakens final signoff and encourages incomplete verification claims.
- Risk if touched: Medium. The fix is probably process/script handling, not product code, but it affects canonical verification language.
- Suggested next pass: Isolate the exact lock owner and harden `scripts/unified-build.mjs` or the surrounding workflow so environment failures are explicit and recoverable.
- Tests/browser proof needed: A reproducible script-level check or documented recovery path; no product UI tests required.
- Files likely involved: `scripts/unified-build.mjs`, `package.json`, `AI_STATE.md`, any build handoff docs that claim `build:unified` is canonical.
- Status: Blocked by dist lock

### RB-DEBT-010 - Browser gate setup still needs clearer onboarding and click-path doctrine

- Severity: Medium
- Category: Testing debt
- Surface: Docs
- Current evidence: The board-clock browser proof gate suppresses onboarding with `localStorage['rb-onboarding-v1-seen'] = '1'`. Earlier manual browser proof notes also recorded overlay click interception when synthetic center clicks hit the shell/status layer instead of the intended element.
- How to reproduce or inspect: Read `tests/e2e/board-clock-browser-proof.spec.ts` and the 2026-05-02 board-clock browser proof entries in `AI_STATE.md`.
- Why it matters: Browser gates become flaky when each pass rediscovers its own startup state and click strategy.
- Risk if touched: Medium. Gate determinism needs a standard approach, but ad hoc workarounds can hide real product issues if applied too broadly.
- Suggested next pass: Standardize deterministic startup helpers for onboarding and shell readiness, then investigate remaining overlay-interception cases before expanding browser-gate coverage.
- Tests/browser proof needed: Keep the board-clock browser proof passing while introducing shared helper utilities for startup determinism.
- Files likely involved: `tests/e2e/board-clock-browser-proof.spec.ts`, `tests/e2e/ide-screenshot-baseline.spec.ts`, shared Playwright helpers, `AI_STATE.md`.
- Status: Open

## Next High-Leverage Passes

1. Obtain explicit approval, then review and sync the local v3 branch without weakening the evidence boundary.
2. Rebase the Guided 4-Bit Adder work onto the accepted v3 composition.
3. Build Hardware Mapping Assistant v2 as the next bounded product slice.
4. Complete the interrupted Student C Import flow and run a blind XOR authoring trial.
5. Continue CSS reduction only in surface-scoped, browser-proven slices; keep fresh Vivado/Basys3 certification separate.

### RB-DEBT-011 - Project first-load renders black main content area (F-P2)

- Severity: High
- Category: UI/UX - Routing/render
- Surface: Project
- Current evidence: **Resolved 2026-05-03.** Browser checks now show immediate Project/home content on first load at both `/` and `/os/` (1366x768 and 1920x1080), including clean-storage and saved-project restore paths.
- Historical reproduction (closed): navigate to the old May 2026 build at `/` or `/os/`; the main content area appeared black until Project was selected in the then-current side rail. Unified Workbench v3 has no permanent workflow side rail.
- Why it matters: First screen a student sees looks like a crash. Destroys first-impression trust.
- Risk if touched: Low to medium. Likely an initial-mode initialization issue in the IDE root component.
- Root cause: Mode selection had multiple dynamic write paths (`handleSafeLoadIntoIde`, diagnostic routing payloads, CTA mode handoff) without a shared runtime canonicalizer. In stale/legacy mode-value scenarios, the shell could mount with a non-canonical mode path, producing a blank-looking main workspace until a manual Project click forced a valid mode.
- Fix behavior: `startupMode.ts` now exports `normalizeIdeMode`/`isIdeMode`; `IdeApp.tsx` canonicalizes dynamic mode updates and self-heals invalid state to `project` via `activeMode`. Startup tests now cover `/`, `/os/`, and invalid mode fallback. `ide-surface-baselines.spec.ts` explicitly verifies first-load Project content before cross-surface navigation.
- Tests/browser proof needed: `pnpm -w exec vitest run ...startupMode.test.ts ...ideApp.labday-wiring.test.tsx` pass; `pnpm -w exec playwright test tests/e2e/ide-surface-baselines.spec.ts` pass; manual browser verification on `/` and `/os/` at 1366x768 + 1920x1080 pass.
- Files likely involved: `packages/rb-apps/src/apps/IdeApp.tsx`, route initialization logic, `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`.
- Status: **Resolved** (fixed + validated 2026-05-03)

### RB-DEBT-012 - Developer chrome toggles (Rails/Console/Toolbar) visible on student surfaces (global)

- Severity: Low
- Category: UI/UX - Chrome visibility
- Surface: All
- Historical evidence: Browser audit 2026-05-03 showed "Rails On", "Console On", "Toolbar On", and "Verify rows On" toggles in the top-right of student surfaces. That composition is superseded.
- Current inspection: Unified Workbench v3 exposes none of those developer chrome toggles. Its shell and workspace gates assert zero visible retired rail/dock controls while keeping stable surface work regions.
- Why it matters: Adds visual noise; if a student accidentally toggles "Rails Off" or "Console Off" they get an unexpected layout change with no recovery path shown.
- Risk if touched: Medium. Tests may depend on toggled panel DOM accessibility. Confirm all tests use data-testid selectors before gating the toggles.
- Suggested next pass: Gate behind a developer/instructor mode (e.g. `?dev=true` query param). In default mode, hide entirely. Do not attempt until Slice 1 and Slice 2 from the product flow model are done.
- Tests/browser proof needed: Confirm all tests that interact with rail/console/toolbar panels still pass after the toggle buttons are hidden (tests should use data-testid, not toggle button visibility).
- Files likely involved: Chrome toggle host component in `packages/rb-apps/src/apps/ide/`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`.
- Status: **Resolved by Unified Workbench v3 (2026-07-15).** The historical controls are absent from the current student shell; no developer-mode gating follow-up is required for this finding.

## Meridian investigation findings - 2026-10-20

Filed from the Meridian architecture investigation and the P1 studio slice (local, uncommitted beyond the sealed baseline `64bf7aa93`). C = confirmed in code or live; H = hypothesis that needs a test before any fix. None of these blocks the flag-gated studio slice; each names the phase that should address it.

### RB-DEBT-013 - Hierarchical VHDL exports unsupported primitives as constant `'0'` (C)

- Severity: High (silent wrong hardware)
- Current evidence: `packages/rb-apps/src/apps/ide/hierarchicalVhdl.ts:431-446` - `gateExpression` falls through to `default: return "'0'"`; unconnected boundary outputs also become `'0'` (`:239-241`).
- Why it matters: a module instance with an unsupported primitive emits syntactically valid VHDL that ties the signal low instead of failing closed.
- Next step (P2, before the Source lens shows hierarchical designs): fail export with a named diagnostic for unsupported primitives; add an emitter golden.
- Status: Open

### RB-DEBT-014 - Engine v2 feedback evaluation order may depend on node array order (H)

- Severity: Medium
- Current evidence: v2 evaluates feedback graphs in node array order (`packages/rb-logic-core/src/CircuitEngine.ts`, evaluation loop) while the project codec re-sorts nodes on save (`projectFormat.ts`).
- Why it matters: the same RunIdentity could produce different results before and after a reload for order-sensitive feedback circuits.
- Next step (P2 test, P5 fix): an order-permutation fixture with feedback, compared before/after save and reload.
- Status: Fixed on claude/redbyte-v1-reliability (824a346c5; integrated b5c67f3e2). Kahn over strongly connected components; every permutation records identically (CircuitEngine.orderIndependence, runDeterminism.nodeOrder). Engine v3; manual 4.3 documents the order.

### RB-DEBT-015 - Saved components (CompositeNode) may be missing from the Run worker (H)

- Severity: Medium
- Current evidence: "Save as component" registers CompositeNodes in the main-thread registry (`projectRuntime.ts` component registration); the worker engine builds its own registry.
- Why it matters: a worker Run could skip or mis-evaluate a saved component while main-thread Explore works.
- Next step (P2): one worker-versus-main differential test with a saved component.
- Status: Open (hypothesis)

### RB-DEBT-016 - Locale-sensitive sorts feed irHash and RunIdentity (H)

- Severity: Medium
- Current evidence: `localeCompare` in `packages/rb-logic-core/src/ir/elaborator.ts:185-195` and `packages/rb-apps/src/apps/ide/runDeterminism.ts:39`.
- Why it matters: identities could differ between browser locales; the codec already uses codepoint order.
- Next step (P2/P5): codepoint comparison behind an explicit identity/engine version bump; old identities fail closed.
- Status: Fixed on claude/redbyte-v1-reliability (708540e80, 693556aa3, b5c67f3e2). Codepoint order for identities, the persisted IO row, fingerprints and module order; identityCollationAudit, identityLocale (4 collations: irHash, RunIdentity, replay fingerprint, canonical row, mixed-case modules) and exampleIdentity.golden (15 examples).

### RB-DEBT-017 - Production ships the `window.__RB_*` store hooks (C)

- Severity: Medium
- Current evidence: `projectRuntime.ts:5491-5493` assigns `window.__RB_PROJECT_RUNTIME__` unconditionally; the logic-view and circuit stores do the same. Gates read these hooks hundreds of times.
- Next step (P2-P3): a versioned `__REDBYTE_TEST__` facade, gates migrated to it, then build-flag gating.
- Status: Open

### RB-DEBT-018 - Candidate packaging copies the whole local `dist` (C)

- Severity: Medium
- Current evidence: `scripts/package-candidate.mjs:18` copies `dist` recursively; the local `dist` held stale files and sourcemaps from earlier builds during the investigation.
- Next step (P0/P2): build into a clean directory and copy a manifest-listed file set.
- Status: Open

### RB-DEBT-019 - Classic Design culling drops long wires whose endpoints are both off-screen (C)

- Severity: Low
- Current evidence: `packages/rb-logic-view/src/LogicCanvas.tsx:451-459` keeps a connection only when one endpoint node is visible. The pure scene package offers segment-viewport culling instead (`rb-logic-view/src/scene/cull.ts` `cullScene`, unit-tested); the studio sheet does not cull yet and draws every net and symbol (321 symbols and 7,686 SVG elements on the fan-out fixture).
- Next step (P3): retire with the classic canvas, or reuse `cullScene`.
- Status: Open

### RB-DEBT-020 - One click on a recorded stimulus lane edits the scenario (C, live)

- Severity: High (inspection mutates authored data)
- Current evidence: during the 2026-10-20 walkthrough a single inspection click on the EN stimulus lane changed the scenario ("The scenario changed after this run..."). Editable and recorded lanes look alike.
- Next step: separate editing affordance (explicit edit mode or handle), and a gate that one click never mutates a scenario.
- Status: Fixed on claude/redbyte-v1-reliability (merge 6e85a1475). Proven in the browser by the determinism, studio-coherence and student journeys (build 2026-10-28).

### RB-DEBT-021 - Orthogonal routes can pass through gate bodies (C)

- Severity: Low
- Current evidence: on the counter the CLK route crossed XOR0's body. The studio passes `avoidBodiesOnLegs` (opt-in, default byte-stable); extra body clearance made routes worse and was reverted.
- Next step (P4): channel reservation in the router with route goldens.
- Status: Mitigated in the studio only

### RB-DEBT-022 - Stale entry points and copy (C)

- Current evidence: the Run menu "Run Simulation (Observe)" still builds a trace-only run (`IdeApp.tsx:2863`); starter goals still say "In Verify / Run Compare"; Ctrl+K is not listed in the shortcuts modal; `workbench.command-palette.open` is declared (`ideCommandRegistry.ts:14`) but never registered.
- Next step (P3): retire or relabel with the studio keymap; list Ctrl+K.
- Status: Open

### RB-DEBT-023 - A navigation right after an import can reopen the previous project (C, workbench persistence)

- Severity: Low in ordinary use, High for scripted proofs (wrong project measured or shown)
- Current evidence: two of three runs of `scripts/perf/meridian-baseline.mjs` that navigated immediately after the workbench import of the 321-node fixture (in-memory project name confirmed) reopened the previous 13-node counter - in the workbench pages too, not only the studio (their fan-out Run took the counter's 130 ms). The runtime writes the session to IndexedDB asynchronously after `set()` (`durableProjectStorage.ts`, `runtimePersistence.flush`) and registers no `pagehide`/`beforeunload` flush. On the production build the stored session named the fixture 12 ms after the in-memory import (299 ms -> 311 ms); the script now waits for that record and every later run measured the fixture.
- Next step (P4, with the persistence work): flush or block navigation while a session write is pending; a navigation-race test (import, navigate within the pending window, compare project identity).
- Resolution (2026-10-27, `claude/p1-023-durable-nav`): `runtimePersistence` is revisioned. Every requested write takes the next revision synchronously (`currentRevision`); a revision is acknowledged (`acknowledgedRevision`, `whenDurable`) only when every write up to it has completed its IndexedDB transaction, a later landed snapshot of a record covering its earlier revisions; a failed write rejects its waiters, at once for a late waiter, and leaves the acknowledged revision unchanged until a retry lands. Session metadata (`rb.ide.sessionMeta.v1`) is written by `writeAfterRuntime`: it lands only after every earlier write of the working session, and records `runtimeRevision`, the stored revision of the runtime record it follows (optional; older metadata without it opens as before). `SessionStorageBackend` gains `revision(key)`. At boot, metadata ahead of the stored record shows `ide-session-unfinished` (role alert) and opens the stored session. The workbench leave guard and save indicator include unacknowledged writes; ErrorBoundary Reload App waits for the last change, and on a failure says why and offers Reload anyway; the Meridian rail links (Project, Package, Classic) wait the same way, with `meridian-leave-notice` and Leave anyway on failure, and the studio asks on `beforeunload` while a change is unacknowledged. No timers or sleeps. Proof: `durableProjectStorage.revisions` (9), `ideApp.durableSession` (4), `railNavigation` (3) over a held multi-document disk on which unload drops uncommitted transactions; native IndexedDB revisions, interruption and recovery in `rb-e2e/storage-transaction-journey.mjs`.
- Status: Fixed on claude/redbyte-v1-reliability (a52d38962, 409bfac3c). packages/rb-e2e/durable-navigation-journey.mjs: import then reload (normal and slow disk), import then Meridian, rapid switching, failed write and retry, browser restart, metadata ahead of its record. The original race is pinned by unit tests; in the browser only the metadata-ahead step separates the builds.

### RB-DEBT-024 - Studio scrub and Time-lens open cost at 321 nodes (C)

- Severity: Medium (scale)
- Current evidence: `scripts/perf/meridian-baseline.mjs`, fan-out fixture (321 nodes, 7,686 sheet SVG elements). Final production run: 3-tick scrub 203 ms (p95 frame 49.9 ms), Simulate preset 86 ms with a 62 ms long task, studio open 489 ms with 285 ms of long tasks. Dev server: 3-tick scrub 584 ms, Simulate preset 399 ms. On the production build the counter stays under 25 ms per stage switch and scrubs 6 ticks in 27 ms. Value writes are imperative, but each Moment change still re-derives values and re-renders lens/inspector React state.
- Next step (P2/P5): memoize per-tick value frames; diff `data-value` writes by changed nets only; re-measure against this baseline.
- Status: Open

### RB-DEBT-025 - `crash-guard.test.tsx` hangs the vitest worker (C, present at the sealed baseline)

- Severity: Medium (test infrastructure: a focused or root run over `packages/rb-logic-view/src` never prints its summary)
- Current evidence: `packages/rb-logic-view/src/__tests__/crash-guard.test.tsx` alone runs until the 200 s bound and ends with "Worker exited unexpectedly" under Node 20.19.0 / vitest 2.1.8. The same file loaded from a pristine `64bf7aa93` worktree hangs identically, and the test and `LogicCanvas.tsx` are byte-identical to that baseline, so the Meridian slice did not cause it. The other 20 rb-logic-view test files pass. It renders the classic `LogicCanvas` with a mocked malformed view store.
- Next step: isolate the render loop or open handle under the mock (classic canvas; outside the studio slice), then restore it to the routine focused run.
- Status: Fixed (2026-10-28). Root cause: the test mocked useUiTickStore without honouring its selector, so LogicCanvas read a fresh object as uiTick on every render; the endless effect loop ran the worker out of memory. The mock now behaves like the store; the malformed-selection guard remains under test.

### RB-DEBT-026 - The studio mirrors IdeApp's export-project derivation (C, deletion deadline P4)

- Severity: Medium (two derivations of one document can drift)
- Current evidence: `packages/rb-apps/src/apps/ide/ideExportProject.ts` rebuilds the workbench export project (top HDL, constraint text, IO mapping, schedule contract) from runtime state field by field, mirroring IdeApp's `hierarchyHdl` / `hdlText` / `xdcText` / `exportProject` / `liveScheduleContract` memos, so studio Runs carry the same schedule contract and the same blocking-design rule (`ideDesignBlocking.ts`). Three private helpers moved verbatim out of IdeApp into that module, and `buildCurrentVerifyReplayHash` with its helpers moved verbatim into `verifyReplayHash.ts`; IdeApp imports and re-exports them. Classic-versus-studio RunIdentity and output-digest parity is gate-checked on the counter only.
- Next step (P4, with the lazy derivation graph): one shared derivation consumed by IdeApp and the studio; delete the mirror. Until then, add hierarchical and sequential-in-module parity fixtures to the slice gate.
- Resolution (2026-10-28): `ideExportProject.ts` is the one derivation. IdeApp's `hdlText`, `hierarchyHdl`, `projectIoMapping` and hand-built `exportProject` memos are deleted; IdeApp memoizes `deriveIdeExportHdl` (generated VHDL) apart from `assembleIdeExportProject` (so editing stimulus does not regenerate HDL), and the studio calls `buildIdeExportProject` (the two in one call). Workbench-only `meta` (guided-lab id, student name, IdeApp's derived scenario authority) is passed in, so the export bytes are unchanged. `exportDerivation.parity.test.tsx` renders IdeApp on ten fixtures (combinational, full adder, enabled register, counter, reusable module, register inside a module, nested hierarchy, incomplete starter, unsupported MUX4, imported VHDL) and clicks Simulate's Run on the nine Simulate offers (it refuses MUX4 at its entry): the classic and studio Runs hand the Run owner the same schedule contract, replay hash, stimulus and clock policy and record the same RunIdentity, output digest and checks, or both refuse naming the part; a source scan fails if IdeApp derives the export itself. Mutation check: building the classic contract without the hierarchy is caught by the register-inside-a-module fixture.
- Review correction (2026-10-28, rc.6 adversarial review): the test compared `assembleIdeExportProject(state, deriveIdeExportHdl(state))` with `buildIdeExportProject(state)`, which is the same expression, and it never read IdeApp's own export project: a mutation that dropped the hierarchy from IdeApp's call shipped one VHDL file instead of two or three and the test stayed green. It also asserted only agreement, so a mistake shared by both sides passed. Now each fixture reads the project IdeApp autosaves and requires it (meta aside) to equal the shared derivation, states by hand its schedule (combinational or clocked, and which elaborated register), the module sources its export ships, and for the four fixtures whose expectations are worked out in the file (both registers, nested hierarchy, imported VHDL) that the Run passes them; an eleventh fixture runs Simulate on imported HDL the importer cannot rebuild and requires every output sample to be `X`. Both mutations are caught: IdeApp without the hierarchy fails the three hierarchical fixtures; a schedule read from the top level only fails the register-inside-a-module fixture.
- Residual (tracked, not a mirror): `meta.scenarioAuthority` is IdeApp's derived authority in the workbench export and the stored runtime field elsewhere; Simulate labels event rows (`event-01`) that the studio leaves unlabelled (stimulus, identity and digest agree).
- Status: Fixed on claude/redbyte-v1-reliability (2026-10-28).

### RB-DEBT-027 - The domain entry still reaches the `@redbyte/rb-utils` barrel (C)

- Severity: Low now, blocking for P2 content islands
- Current evidence: `domainBoundary.test.ts` walks rb-apps and rb-logic-view and treats other @redbyte packages as leaves; the `@redbyte/rb-utils` barrel re-exports zustand stores, so importing `@redbyte/rb-apps/domain` is free of React components and stylesheets but not of every store module. Recorded in the `domain.ts` header.
- Next step (P2): split rb-utils into pure and store subpaths, then extend the walker into it.
- Status: Open

### RB-DEBT-028 - "Unconnected · read as 0" is not true for every input (C)

- Severity: Low (a misleading inspector line on rare registers; the studio's explanations avoid the claim)
- Current evidence: `unconnectedInputPins` (rb-studio-kernel `resolver.ts`) marks every undriven input, and the studio inspector and sheet say "unconnected · read as 0". The behaviours do not all default to 0 (`rb-logic-core/src/builtins.ts`, `readFirstNumber` fallbacks): a DFlipFlop reads an unconnected EN as 1, and a Register1/RegisterBus/StateBank reads an unconnected EN as 1 unless its config sets `hasEnable`, in which case it reads 0. Data, clock and reset inputs default to 0. The shipped examples wire every EN they draw, so no shipped design shows the wrong line.
- Next step (P2): derive the read-as value per pin from the behaviour's own fallback (a shared table exported next to `readFirstNumber`), say "unconnected · read as 1" where that is the fallback, and add a unit test per sequential type.
- Status: Fixed on claude/redbyte-v1-reliability (207832975 + 973d9c8a4). The engine reads EN per configuration; the Signal Journey, Meridian inspector and status count use describeInputPin; engine v3; v2 recordings read "Engine changed" and are refused for Reproduce.

### RB-DEBT-029 - Schematic pin targets are 16 px tall at 100% (C)

- Severity: Low (pointer precision; keyboard wiring and the endpoint picker exist)
- Current evidence: `SchematicNodeView` gives each pin a 24 x 16 world-unit hit rectangle that extends 6 units past the pin end, so two symbols placed pin-end to pin-end share hit area and the later-drawn pin wins (the nested-adder layout). The July gate `ide-design-port-target-authority` asked for 24 x 24 targets and dense-port clusters; it targets markup that no longer exists and is not in `verify:gates`.
- Next step (P2): decide the pin target contract for the schematic (WCAG 2.5.8 spacing exception or 24 px targets), resolve overlapping targets to the pin whose stub holds the pointer, then rewrite or retire the July gate against it.
- Acceptance (2026-10-28, rc.7 package at 1440x900, 100%): a part's pins are 32 px apart, so 24 px circles centred on adjacent targets do not intersect and the WCAG 2.5.8 spacing exception holds for pins on one part; the overlap remains where two symbols meet pin-end to pin-end. Kept post-release (dossier section 5).
- Status: Open

### RB-DEBT-030 - Wire guidance needs its own row when the inspector is open at 1366 or 1440 (C)

- Severity: Low (one 22 px move of the canvas when Wire is chosen; none while wiring)
- Current evidence (2026-10-28, after the rc.6 review): the cue in the command row is the Wire badge and Cancel only; its message is in the status line (below). With the inspector open the row is 766-840 px and cannot hold the tools, the badge with Cancel, and Explore/Test, so the header takes its own row for the whole of Wire mode and choosing Wire moves the canvas once. Guidance stays off the canvas. (The July gate `ide-design-port-target-authority` that asserted header placement targets markup that no longer exists; see RB-DEBT-029.)
- Next step (P2): a compact Wire state in the tool segment itself (badge and Cancel there, message in the status line) so no width change can move the canvas.
- Partial resolution (2026-10-28, rc.6 review): sharing the row left the message 13 px of 230 at 1280x650 (93-232 px of a 500 px refusal at 990-1150 px rows), with no live region. The message now lives in the status line's announced hint slot (`role="status"`). A long refusal takes a second line inside the line's own height (14 px at 1.05 with a pixel for descenders: 30.4 of the 31 px inside the 2rem line and its border), so the bar stays 32 px. Measured in full at 1440, 1366, 1280 (16 and 24 px text), 1024 and 720x450 at 16 px (the 140-character output-to-output refusal is two lines in 826 px at 1280x650); at 720x450 with 24 px text the 85-character no-destination refusal needs three lines and shows two with an ellipsis, the whole text in its title and its announcement. A repeated identical refusal is a new element, so it is announced again. Esc cancels and Cancel share one cell of one size (measured identical armed and unarmed), so arming a wire cannot rewrap the row. `design-core-authoring` requires the idle guidance and the longest refusal in full, the status line's height unchanged by the refusal, and the canvas and cue still when a wire is armed. Remaining: the badge and Cancel still sit in the header, which takes its own row in Wire mode where the commands leave no room for them (the inspector open at 1366 or 1440).
- Correction and resolution (2026-10-28, owner acceptance of rc.7): with the inspector open at 1440x900 and 1366x768 the header row came and went with every wire, because a finished wire returns to Select, so the target pin moved 44 px on choosing Wire, on arming and on a refusal, not once (`.redbyte/releases/redbyte-1.0.0-rc.8-evidence/probes/wire-narrow-rc7.json`). rc.8 (`a29573231`) puts the whole Wire cue in the status line's hint slot: the badge, the message (two lines at most), More for a refusal that does not fit (it shows the refusal whole on a line of its own until the next wire event) and Cancel; the command row never holds a tool's cue. On rc.8 no pin moves at 1440, 1366, 1280 or 1024 px (`wire-narrow-rc8.json`). Journey `design-workspace-stability` (red on rc.7) keeps every pin and the command row still over three wires at both sizes with the inspector open, and reads the longest refusal whole through More at 720x450.
- Status: Fixed in 1.0.0-rc.8 (owner acceptance pending)

### RB-DEBT-031 - The status line wraps in a narrow window with enlarged text, changing the workspace height (C)

- Severity: Low (narrow windows and enlarged text only; at 720 px and wider with 16 or 24 px text the line holds one row)
- Current evidence: since the rc.6 review the status line wraps rather than drawing Show left / right panel over the Problems handle (rc.6 overlapped them by 13 px at 720x450 with 32 px text and left the bar at 480 and 375 px). Its grid row is `auto`, so where the controls do not fit on one line, a change in what the line holds (the problems label gaining a note count, a reveal appearing when a panel is hidden) can add or remove a line and change the workspace height by one line; an untouched framed sheet then re-centres. Measured line heights: 32 px at 720x450 with 16 px text, 48 px (one line) with 24 px, 105 px (two lines) with 32 px; 157 px at 375 px with 32 px text. The Wire tool's hint never causes a wrap (its slot takes only left-over room).
- Next step (P2): shorter labels for the line's controls in a narrow container (a container query on the status line), so the line keeps one row down to 720 px at 200% text.
- Acceptance (2026-10-28, rc.7 and rc.8 packages, `.redbyte/releases/redbyte-1.0.0-rc.8-evidence/probes/wire-narrow-*.json`): at classroom sizes the line holds one row. With 150% text it grows 5 px (48 to 53) while a wire is armed at 1024x640 (both candidates) and, since rc.8 put the Wire badge and Cancel in it, at 1280x650; no pin moves (the sheet keeps its top). At 720x450 the Design workspace is taller than the window and scrolls (the surface grid sits 346 px down after Fit), so the toolbar is out of view and reaching it scrolls the circuit; at 720x450 with 150% text the Start page's preview pane collapses to 0 px and the status line covers Open starter (keyboard only). Kept post-release (dossier V10).
- Status: Open

### RB-DEBT-032 - REDBYTE_REQUIRE_GHDL=1 does not cover four GHDL suites (C)

- Severity: Medium for evidence (a qualification without GHDL would pass with more skips instead of failing); none for the product
- Current evidence (2026-10-28, `.redbyte/releases/redbyte-1.0.0-rc.8-evidence/qual-delta/ghdl-negative-control.log`): with `REDBYTE_REQUIRE_GHDL=1` and `REDBYTE_GHDL` naming a missing file, eight GHDL suites fail (47 tests) as their headers promise, but `testbench.ghdl-execution`, `register-config-authority.agreement`, `hdl-export.fail-closed` and `vivado-e1-harness` gate on their own `existsSync` check with `describe.skipIf(!ghdlAvailable)` and never read `ghdlRequired`, so they skip (16 more skips). The rc.7 and rc.8 qualifications ran GHDL: their skip counts are the GHDL-present ones.
- Next step: use the shared `ghdlHarness` probe in those four suites and fail when `ghdlRequired` and GHDL is absent; keep the negative control in the qualification script.
- Status: Open

### RB-DEBT-033 - 1.0 acceptance findings: student-facing polish (C)

- Severity: Medium (none blocks a task; several confuse a first-time student)
- Current evidence: `docs/validation/v1-owner-acceptance-dossier-2026-10-28.md` section 4, V3-V14 and C1-C9, each with a screenshot from the rc.7 or rc.8 package and steps to reproduce: problem counts that disagree and board-mapping errors shown while designing (V3), internal ids in student text (V4), duplicate default names (V5), Board drawing overlaps and its SW2 recommendation (V6, V7), Save without a name (V8), double-click into an instance (V9), the 720x450 layouts (V10), a repeated refusal sentence and overlapping labels in Problems (V11), the import Mode label (V12), Meridian's hierarchy drawing (V13), the hierarchical starter's framing (V14).
- Next step: the dossier's section 11.D gives each an acceptance criterion; V3, V4 and V8 first.
- Status: Open

### RB-DEBT-034 - Eight browser journeys no release run includes are stale (C)

- Severity: Low (no product defect; dead test surface that reads as coverage)
- Current evidence (2026-10-28, `.redbyte/releases/redbyte-1.0.0-rc.8-evidence/unrun-journeys/`): `a11y-scale`, `bench-board-sync`, `compare-verdict`, `pin-planner`, `runs-document`, `shell-status-authority`, `signature` and `sim-provider` fail identically on rc.7 and rc.8 and were last edited 2026-09-05 to 09-08. Two target a removed surface (`ide-vcb-workspace-bench`); one waits for `VerifyResultsSummary`, which nothing renders; two expect the VCD tools outside the "Imported evidence" disclosure (`vcd-analyzer` passes); one reads the runs table's first cell (the run number) as the verdict; one expects a run readout no caller has passed to the status bar since 2026-09-02; one reads the Board binding chain with innerText inside a collapsed disclosure (the chain follows keyboard selection: `acceptance-board-detail2`). The other eight unrun journeys pass on rc.8, `nested-create-module` among them.
- Next step: retire the four whose subjects are gone or covered; rewrite `runs-document`, `pin-planner` and `shell-status-authority` against the current contracts if their subjects matter, then add the passing ones to a release run.
- Status: Open

### RB-DEBT-035 - The view dock can cover the bottom of the circuit after the inspector slides the view (C)

- Severity: Low (a pin label partly hidden in one starter; no control or value is lost)
- Current evidence (2026-10-30, triage of PR #88 at 055c83bc9): on the signal-tour starter at 1366x768, selecting LD0 opens the inspector, which would cover LD0, so the view slides; the view dock (Fit, Selection, zoom: 12px inset, 40px tall, lower left) then hides the lower 8px of `sw3_node`'s "W17" pin label (`elementFromPoint` returns `ide-design-viewdock`). Fit keeps a symmetric 48px margin around node geometry, and pin aliases hang below that geometry. logic-gates and the other six starters are clear at load, at Fit and after selection. No gate can see it: `ide-design-canvas-direct-workbench.mjs` checks that camera controls do not overlap nodes or wires against the toolbar's rectangle, which the dock left on 2026-10-05.
- Next step: point that gate's camera-control host at `ide-design-viewdock` (measured clean for logic-gates at both classroom sizes), then keep the dock's corner clear when framing (count pin aliases in the frame's bounds, or reserve the dock's height at the bottom of the frame).
- Status: Open

### RB-DEBT-036 - Simulate Details: the mismatch table's Review column is clipped by its panel (C)

- Severity: Low (the Review buttons remain reachable by keyboard; part of the column is not drawn)
- Current evidence (2026-10-30): in Details > Checks the mismatch table's five unbreakable columns need 367px at the 15/16px type scale, wider than the inspector-hosted panel (313-347px at 1093-1440 widths), whose `overflow: hidden` clips the Review column by about 54px at 1093x614, 44px at 1366x768 and 20px at 1440x900 (24px already at a46d7ed01). PR #88 gave the panel one `minmax(0, 1fr)` column, so the repair panel and its actions now fit; the table itself still overflows its cell.
- Next step: wrap the table in the existing `.ide-table-wrap` horizontal scroller, or tighten its inspector padding, and add the Review column to `ide-verify-postrun-workbench-usability`'s reachable controls.
- Status: Open
