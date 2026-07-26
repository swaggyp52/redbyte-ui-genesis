---
doc_status: current
last_validated: 2026-07-15
owner: Connor Angiel
used_by_claude: true
role: canonical IDE product debt register
---

# RedByte IDE Product Debt Register

This file is the canonical owner for current IDE product debt: what is proven, what remains unsatisfying, what is risky to touch, and what needs browser or screenshot proof before cleanup. The current composition is Unified Workbench v3. Dated entries below remain as a historical debt ledger; they do not restore an older shell, disclosure, or collapsible-dock contract.

## Current Stable Truths

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

## Current Unified Workbench v3 Debt

- **Design space target:** the enforced laptop floor is 62% of the full viewport. The measured canvas is 63.1% at `1366x768` and 65.0% at `1440x900`; the separate 70% strategic laptop target remains unmet.
- **Usability evidence:** blind Student A and B flows completed locally. Student C stopped after native Import confirmation when browser control became unavailable, and the XOR flow has automated browser proof only. The usability lab is therefore partial.
- **CSS authority:** the legacy root/polish files were reduced, but the total tracked CSS tree grew because v3 introduced surface-owned styles. Broad CSS deletion remains unsafe; keep each future change surface-scoped and browser-proven.
- **Release boundary:** the v3 reconstruction is local source and browser-E0 proof only. It has not been pushed or deployed, and no new Vivado E1, Basys3 programming E2, or observed-board E3 evidence was produced.
- **Next product sequence:** after explicit approval and branch review/sync, rebase the Guided 4-Bit Adder work, then build Hardware Mapping Assistant v2. Fresh hardware certification remains a separate proof lane.

## Historical Debt Ledger

The entries below preserve reproduction history and risk context. Each affected surface carries a 2026-07-15 v3 disposition; those dispositions and the current-debt section above win over older wording.

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
