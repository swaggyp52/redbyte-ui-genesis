---
doc_status: current
last_validated: 2026-05-03
owner: Connor Angiel
used_by_claude: true
role: canonical IDE product debt register
---

# RedByte IDE Product Debt Register

This file is the canonical owner for current IDE product debt: what is proven, what remains unsatisfying, what is risky to touch, and what needs browser or screenshot proof before cleanup.

## Current Stable Truths

- Project is the front-door dashboard for the product spine `Project -> Design -> Verify -> Map Pins / Hardware -> Export`, and that workflow ownership is documented in [docs/IDE_SYSTEM_MAP.md](./IDE_SYSTEM_MAP.md) and the surface specs under `docs/ide/`.
- Project dashboard / continuity behavior has direct tests, and the low-level bridge no longer owns the top of the home surface.
- Design idle inspector overview exists and has direct tests; the canvas remains the primary structural-authoring surface.
- Verify Observe vs Compare language is explicit in the UI, and the stimulus workbench now has a first authoring-clarity pass (`Test stimulus`, mode summary, section guidance, compare-check explainer).
- Basys3 `CLK100MHZ` on `W5` is the authoritative board clock. Verify auto-runs it by default, manual pulses remain an explicit override, and exported `testbench.vhd` owns a free-running `clock_gen` process for the board clock.
- The board-clock browser proof gate exists in `tests/e2e/board-clock-browser-proof.spec.ts` and was already committed on `origin/main` before this pass.
- Hardware and Export both received structural passes that improved workflow shape, but neither surface is clean enough to call finished; both still carry density debt.
- `ide-root.css` is still the primary legacy style system, and `ide-polish-pass.css` is still an additive overlay. Neither file should be pruned casually.
- Screenshot tooling and IDE screenshot baseline tests already exist, but they are optional by default and are not yet strong enough to authorize broad CSS deletion.

## Open Issues by Priority

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
- Status: **Partially resolved (2026-05-03)** — Export now leads with a stronger trust/draft readiness hero, explicit handoff summary rows (Design/Board/Mapping/Verification/Artifacts/Export state), a numbered Vivado handoff path, collapsed generated previews, and demoted detailed diagnostics/proof metadata. Remaining debt: final visual balance pass plus deliberate screenshot strategy before any global CSS pruning.

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
- Status: Needs browser proof

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
- Status: Needs browser proof

### RB-DEBT-006 - Global CSS remains geological debt (strategy-first)

- Severity: High
- Category: CSS debt
- Surface: Global CSS
- Current evidence: measured inventory now comes from `pnpm css:audit:ide` (`scripts/ide-css-audit.mjs`), not handwritten header notes.
- `ide-root.css`: `32,875` lines, `5,522` selector entries, `4,086` unique selectors.
- `ide-polish-pass.css`: `1,715` lines, `286` selector entries, `282` unique selectors.
- Exact selector overlap between root/polish: `5` selectors (`:root[data-redbyte-mode='ide']`, `.ide-root`, `.ide-hw-workflow-ribbon`, `.ide-export-left-col`, `.ide-export-summary-hero`).
- Broad substring selectors in root: `2` (`[class*="ide-verify-"][class*="-banner"]`, `[class*="ide-verify-"][class*="-notice"]`).
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

1. ~~Convert IDE screenshot baselines from optional evidence into an intentional safety net for the authority surfaces.~~ **Done** (`tests/e2e/ide-surface-baselines.spec.ts`, 2026-05-02)
2. ~~Do a screenshot-backed Export readiness-density pass.~~ **Partially done** (2026-05-03) - finish with a small visual balance/polish check only.
3. Execute the CSS strategy instrumentation pass first (inventory + risk map + guardrail docs), then run one surface-scoped cleanup at a time with proof.
4. Do a short Hardware follow-up polish pass only if Export changes reveal cross-surface drift.
5. Revisit Verify workbench layout only after screenshot-gated CSS strategy is in place, while keeping board-clock truth locked.

### RB-DEBT-011 - Project first-load renders black main content area (F-P2)

- Severity: High
- Category: UI/UX - Routing/render
- Surface: Project
- Current evidence: Browser audit 2026-05-03 — navigating to `/` shows the top bar and left rail but a completely black main content region. Clicking "Project" in the left rail causes the dashboard to render correctly. DOM snapshot confirms all content exists (heading, next-action card, status chips); the problem is activation/visibility, not missing data.
- How to reproduce or inspect: Navigate to `http://localhost:5173/` in dev or `http://127.0.0.1:4173/os/` in preview. Main content area is black. Click "Project" in the left rail — content appears.
- Why it matters: First screen a student sees looks like a crash. Destroys first-impression trust.
- Risk if touched: Low to medium. Likely an initial-mode initialization issue in the IDE root component.
- Suggested next pass: Check `IdeApp.tsx` (or equivalent) for how the initial active mode is set on mount. Confirm that `/` or `/os/` routes initialize to `project` mode immediately so the Project surface renders without user interaction.
- Tests/browser proof needed: Browser proof: navigate to `/`, confirm Project content visible without any click. Rerun `ide-surface-baselines.spec.ts` (2/2) and `board-clock-browser-proof.spec.ts` (1/1).
- Files likely involved: `packages/rb-apps/src/apps/IdeApp.tsx`, route initialization logic, `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`.
- Status: Open (confirmed in browser 2026-05-03)

### RB-DEBT-012 - Developer chrome toggles (Rails/Console/Toolbar) visible on student surfaces (global)

- Severity: Low
- Category: UI/UX - Chrome visibility
- Surface: All
- Current evidence: Browser audit 2026-05-03 — "Rails On", "Console On", "Toolbar On", "Verify rows On" toggles appear in the top-right of all surfaces including Project (which has no concept of rails or console). They appear with different subsets per surface but are always visible. These are debug/developer controls, not student-facing.
- How to reproduce or inspect: Open any surface. Top-right area shows toggle buttons next to BUILD badge.
- Why it matters: Adds visual noise; if a student accidentally toggles "Rails Off" or "Console Off" they get an unexpected layout change with no recovery path shown.
- Risk if touched: Medium. Tests may depend on toggled panel DOM accessibility. Confirm all tests use data-testid selectors before gating the toggles.
- Suggested next pass: Gate behind a developer/instructor mode (e.g. `?dev=true` query param). In default mode, hide entirely. Do not attempt until Slice 1 and Slice 2 from the product flow model are done.
- Tests/browser proof needed: Confirm all tests that interact with rail/console/toolbar panels still pass after the toggle buttons are hidden (tests should use data-testid, not toggle button visibility).
- Files likely involved: Chrome toggle host component in `packages/rb-apps/src/apps/ide/`, `packages/rb-apps/src/apps/ide/ide-polish-pass.css`.
- Status: Open (confirmed in browser 2026-05-03)