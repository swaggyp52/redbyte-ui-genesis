# RedByte UI Art Direction and Surface Recomposition

Date: 2026-05-12

## Product Hardening Ticket

- Title: RedByte IDE art direction and surface hierarchy pass
- Owner: Codex
- Surface: Project, Design, Verify, Hardware / Map Pins, Export, Import, IDE shell
- Journey segment: Project -> Design -> Verify -> Hardware / Map Pins -> Export, with Import as recovery
- Mode: product hardening
- Environment:
  - Fresh browser profile: Playwright Chromium with e2e localStorage setup
  - OS: Windows
  - Browser: Chromium via Playwright
  - Node: repo-managed local environment
  - pnpm: workspace commands only
- Obsidian note: not updated in this sprint
- Linked GitHub issue: none

## Problem

- Observed behavior: RedByte product gates are strong, but the IDE still reads as a generic left-rail workbench with many equal-weight boxes. Desktop surfaces are functional but visually competitive. The narrow viewport currently shows the workbench shifted off-screen, with content clipped and the top bar controls colliding.
- Expected behavior: RedByte should feel like a serious digital logic lab workbench. Each surface should have one clear focal object, one secondary context layer, one advanced/background layer, and one obvious next action.
- Why this matters: Beginner ECE141 students need to understand what matters now: choose a starter, edit a circuit, run Compare, map Basys3 pins, produce an E0 Vivado package, or restore a project. Visual competition makes those states harder to trust even when the underlying gates pass.
- Severity: P2 overall; narrow viewport clipping is P1 for small-screen usability.

## Reproduction

- Run the browser surface baseline gate:
  - `pnpm exec playwright test --config playwright.dev.config.ts tests/e2e/ide-surface-baselines.spec.ts --project=chromium --retries=0`
- Run the current UI audit capture:
  - Playwright Chromium against the Vite dev server, screenshots under `.redbyte/product-immersion/sprint6-ui-art-direction/`
- Reproducibility: always in the audited layout.
- First known version: 7175ccfba1492e4eebd7598fad65c03eac1c1292.

## Scope

In scope:

- IDE shell layout and workflow navigation presentation.
- Project, Design, Verify, Hardware / Map Pins, Export, and Import visual hierarchy.
- CSS/design tokens, surface framing, data-testid additions, accessibility labels.
- A browser gate for the first art-direction pass.

Out of scope:

- Typecheck drift cleanup.
- `build:unified` redirect drift.
- Circuit engine, simulator, starter semantics, Vivado exporter behavior.
- E0/E1/E2/E3 evidence semantics.
- Install scripts, manuals, MarcusRPI, or repo cleanup.

## Preflight

| Item | Result |
| --- | --- |
| Branch | `product/redbyte-ui-art-direction-1` |
| Base commit | `7175ccfba1492e4eebd7598fad65c03eac1c1292` |
| Working tree at start | Clean |
| Known passing baseline | `pnpm install --frozen-lockfile`, `pnpm start:smoke`, `pnpm -s ide:gate:ece141-starter-verify-export`, `pnpm -s ide:gate:ece141-product-immersion` |
| Known failing baseline | `pnpm typecheck` fails in pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift |
| Browser tool | Playwright Chromium |
| Screenshot path | `.redbyte/product-immersion/sprint6-ui-art-direction/` |

## Current UI Audit

| Surface | Current focal point | Correct focal point? | Visual noise | Missing hierarchy | Generic pattern | Student risk | Suggested direction | Severity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IDE shell | Vertical icon rail and top breadcrumb compete with surface content. | Partly. Workflow access matters, but the rail dominates too much. | Rail labels, step badges, top build/save chips. | No compact whole-workflow stage map. | Left rail plus workbench. | Student reads navigation before lab task. | Convert the rail into a lighter lab-flow map and add a compact proof ribbon. | P2 |
| Project | Status card, metrics row, and mapping panel all compete. | Partly. The next course action should dominate. | Many box boundaries and chips. | Certified starter path is not the clear center once a project is loaded. | Dashboard status grid. | Student may not know whether Project is a start path or status dashboard. | Stage Project as a lab path with a dominant next action and quieter metrics. | P2 |
| Design | Toolbar, starter banner, canvas, left dock, inspector all compete. | Mostly. Canvas is visible but not calm enough. | Dense tool chrome, rail inventory, inspector block. | Circuit bench should be the dominant object. | Tool wrapped in panels. | Beginner may treat support chrome as the task. | Preserve canvas behavior but recenter workspace and quiet secondary surfaces. | P2 |
| Verify | Run button is visible, but command rows, stimulus, clock policy, waveform area compete. | Partly. Proof result / run plan should dominate. | Dense control strip, nested panels, many chips. | Proof state is present but not visually owned by one object. | Diagnostics workbench. | Students can miss what Compare proves versus what remains E0-only. | Make Verify read as a proof lane: one run/proof focal area, details secondary. | P2 |
| Hardware / Map Pins | Header, side dock, summary cards, board resource row, mapping focus all compete. | Partly. Board + mapping should dominate. | Side guidance card, resource cards, hide toggles. | Board/mapping physical relationship should be central. | Board form plus cards. | Students can miss the selected signal and next action. | Treat board and selected mapping as one workbench, table as inspector. | P2 |
| Export | Draft export hero appears, but E0 handoff competes with hidden/toggle sections. | Partly. E0 package readiness should dominate. | Needs Review chip, hero, handoff, kit summary all similar weight. | E0 versus external E1/E2/E3 should be clearer visually. | Generic download/status page. | Student may over-trust draft export or miss Verify repair path. | Make E0 handoff the hero, external evidence a separate quieter lane. | P2 |
| Import | Restore path is clearer than older surfaces but still uses workflow rail plus multiple cards. | Mostly. Restore is central. | Left import workflow plus duplicate "Start with ZIP" panels. | Manifest restore vs reconstruction could be more visually layered. | Upload wizard cards. | Student may not distinguish safe preview from replacement. | Center restore/recovery and demote advanced import modes. | P2 |
| Narrow viewport | Left rail and top controls remain fixed while content overflows to the right. | No. The current lab task is mostly off-screen. | Top chip collision and clipped workbench. | No small-screen stacking model. | Desktop rail compressed into mobile. | Blocks normal use on narrow screens. | Stack top bar, make stage map horizontal, and let workbench content fill viewport. | P1 |

## RedByte Interface Architecture

Metaphor: Course Lab Workbench.

RedByte should feel like a layered digital logic lab bench:

1. Workbench center: the current lab task. Project chooses the path, Design owns the circuit, Verify owns proof, Hardware owns board mapping, Export owns E0 handoff, Import owns restore.
2. Proof ribbon: compact persistent state for Design, Verify, Mapping, Export, and Evidence. It should be visible without becoming a second dashboard.
3. Context inspector: details that matter only after selecting a signal, artifact, diagnostic, or restore input.
4. Lab-flow navigator: Project -> Design -> Verify -> Map Pins -> Export, with Import as a utility/recovery path. This should guide the student without becoming the primary visual object.
5. Activity/recovery layer: stale, failed, imported, or draft states. These should explain the next repair action without dominating clean states.

Primary object model:

| Surface | Primary object | Secondary context | Advanced/background |
| --- | --- | --- | --- |
| Project | Certified lab path or next action | Project identity and metrics | Raw mapping/project diagnostics |
| Design | Circuit canvas | Starter context and selected signal | Raw compiler/debug detail |
| Verify | Compare run/proof state | Timing/stimulus explanation | Full waveform/diagnostics detail |
| Hardware | Basys3 board plus selected mapping | Mapping counts and signal inspector | Resource catalog and generated XDC |
| Export | E0 handoff readiness | Package contents and repair path | Detailed artifact previews |
| Import | Restore/recovery action | Supported formats and safety boundary | Raw parse/reconstruction details |

Visual hierarchy rules:

- One focal object per surface.
- No more than two competing panels above the fold.
- Evidence state is always visible but not visually louder than the active task.
- Next action is always obvious.
- Advanced diagnostics default to collapsed or recessed.
- Beginner copy comes first; technical copy comes second.
- E0 is a RedByte package claim only; E1/E2/E3 stay external.

## Surface Redesign Targets

Project:

- Make the course path and next action central.
- Stage certified starters as a progression, not as an equal catalog.
- Reduce metric/card competition.

Design:

- Preserve the current canvas-first behavior.
- Make the circuit canvas read as the bench, not as one card among many.
- Keep left library and inspector secondary.

Verify:

- Make Run/Compare and proof state the dominant object.
- Keep clock/reset policy visible for the counter but quieter than the proof action.
- Keep diagnostics available but secondary.

Hardware / Map Pins:

- Make board mapping feel physical and concrete.
- Pair mapping summary with selected signal context.
- Keep manual mapping discoverable without making the resource catalog dominant.

Export:

- Make E0 handoff the primary visual object.
- Present E1/E2/E3 as external evidence boundaries below it.
- Make stale/draft repair paths obvious.

Import:

- Make restore/recovery the primary object.
- Explain full-fidelity RedByte manifest restore separately from Vivado ZIP reconstruction.
- Keep corrupt/unsupported recovery calm and actionable.

## Design System Direction

Additive CSS roles only:

- `--rb-lab-bg-base`
- `--rb-lab-bg-workbench`
- `--rb-lab-bg-proof`
- `--rb-lab-bg-hardware`
- `--rb-lab-bg-export`
- `--rb-lab-border-subtle`
- `--rb-lab-accent-flow`
- `--rb-lab-accent-proof`
- `--rb-lab-accent-hardware`
- `--rb-lab-accent-export`
- `--rb-lab-state-draft`
- `--rb-lab-state-current`
- `--rb-lab-state-stale`
- `--rb-lab-state-external`
- `--rb-lab-depth-1`
- `--rb-lab-depth-2`

The first pass should use calmer grouping, larger gutters, stronger stage hierarchy, and fewer visible borders. It should not add decorative gradients, broad glass effects, or unrelated visuals.

## Fix Selection

| Issue | Severity | Why course-blocking? | Fix now? | Files likely touched | Gate/test |
| --- | --- | --- | --- | --- | --- |
| Narrow viewport clips core workbench and top bar controls collide. | P1 | A student on a small laptop or split-screen cannot use the workflow reliably. | Yes | `ide-root.css`, `ide-polish-pass.css`, shell components if needed | `pnpm -s ide:gate:ece141-ui-art-direction` |
| Heavy left rail makes the app read as generic navigation instead of lab flow. | P2 | It dilutes the workflow hierarchy. | Yes | `IdeLeftRail.tsx`, CSS | `pnpm -s ide:gate:ece141-ui-art-direction` |
| No compact cross-surface proof ribbon. | P2 | Students must infer design/verify/mapping/export status from scattered cards. | Yes, small additive pass | `IdeApp.tsx`, CSS | `pnpm -s ide:gate:ece141-ui-art-direction` |
| Project/Export/Import surfaces contain duplicate or equal-weight surface cards. | P2 | Students may miss the next required action or evidence boundary. | Partial, CSS/layout hierarchy only | CSS plus minimal data-testid additions | Existing product gates plus new UI gate |
| Design, Verify, and Hardware still have dense support chrome. | P2 | The primary lab task competes with support panels. | Partial, CSS-only first pass | CSS | Existing product gates plus new UI gate |

## Human Design Review Checklist

- Is there one clear focal point per surface?
- Can a beginner tell what to do next in 3 seconds?
- Is the workflow stage obvious?
- Are advanced details visually secondary?
- Does it avoid generic sidebar/card-dashboard behavior?
- Does it feel like a digital logic lab workbench?
- Does Verify feel trustworthy?
- Does Hardware feel connected to the Basys3 board?
- Does Export clearly say E0 only?
- Are E1/E2/E3 external?
- Is the narrow viewport usable?
- Are there fewer equal-weight boxes?
- Does the UI breathe?
- Does it feel serious, not toy-like?
- Does it feel approachable, not like a developer debug tool?

## Validation Log

Baseline:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | No lockfile changes. |
| `pnpm start:smoke` | PASS | Smoke server returned HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | PASS | Existing Logic Gates workflow gate. |
| `pnpm -s ide:gate:ece141-product-immersion` | PASS | Existing product immersion gate. |
| `pnpm typecheck` | FAIL | Pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift. |
| `pnpm exec playwright test --config playwright.dev.config.ts tests/e2e/ide-surface-baselines.spec.ts --project=chromium --retries=0` | PASS | Current browser audit screenshots captured under `artifacts/surface-baselines/`. |

## Implemented Changes

| Area | Change | Evidence boundary |
| --- | --- | --- |
| IDE shell | Added a compact proof ribbon with Design, Verify, Mapping, Export, and Evidence state. | UI state only; no workflow semantics changed. |
| Lab flow | Added a horizontal lab-flow map above the workbench and kept the existing left rail as secondary navigation. | Existing route and mode behavior preserved. |
| Design system | Added additive lab-workbench CSS roles for workbench, proof, board, export, current/stale/draft/external states, depth, and gutters. | Styling-only; no product state semantics changed. |
| Project | Reweighted certified starters and next-action surfaces through CSS so the lab path reads as the center. | Starter definitions unchanged. |
| Design | Recentered the canvas/workbench layer and recessed support chrome. | Circuit editor behavior unchanged. |
| Verify | Reweighted Compare/pass surfaces as proof objects while preserving clock/reset copy and diagnostics. | Compare behavior unchanged. |
| Hardware / Map Pins | Reweighted board mapping as the physical workbench and kept the mapping table as supporting context. | Mapping data and manual edit behavior unchanged. |
| Export | Reweighted the E0 readiness hero and evidence rows; E1/E2/E3 remain external. | Exporter and E0/E1/E2/E3 semantics unchanged. |
| Import | Reweighted restore/recovery framing and retained supported-format copy. | Import behavior unchanged. |
| Narrow viewport | Added a stacked small-screen layout for top bar, proof ribbon, rail, and workbench to prevent horizontal overflow. | Existing surfaces remain reachable. |

## New Gate

Added:

- `pnpm -s ide:gate:ece141-ui-art-direction`
- `tests/e2e/ece141-ui-art-direction.spec.ts`

The gate asserts:

- Lab-flow/proof ribbon is visible.
- Certified starter path is present and ordered.
- Logic Gates can still load into Design.
- Verify Compare still passes and proof state updates in the ribbon.
- Hardware shows the Basys3 board and mapping workbench.
- Export keeps E0-ready framing and external E1/E2/E3 evidence boundaries.
- Import keeps restore/recovery framing.
- Narrow viewport has no severe horizontal overflow.
- Screenshots are captured under `.redbyte/product-immersion/sprint6-ui-art-direction/`.

Required human-review screenshots captured:

- `redbyte-project-course-path.png`
- `redbyte-design-workbench.png`
- `redbyte-verify-pass-state.png`
- `redbyte-hardware-map-pins.png`
- `redbyte-export-e0-ready.png`
- `redbyte-import-recovery.png`
- `redbyte-narrow-viewport.png`

## Final Validation Log

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile up to date. |
| `pnpm start:smoke` | PASS | Served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | PASS | Existing Logic Gates Verify -> Export gate passed. |
| `pnpm -s ide:gate:ece141-product-immersion` | PASS | Four workflow product immersion gate passed. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | PASS | Counter clock/reset and E0 export evidence gate passed. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | PASS | Manual Map Pins edit and starter recovery gate passed. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | PASS | 2-Bit Counter Compare pass and E0-only Export gate passed. |
| `pnpm -s ide:gate:ece141-project-persistence` | PASS | Project persistence and stale evidence gate passed. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | PASS | Import/export recovery gate passed. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | PASS | Certified starter E0 Vivado ZIP inspection gate passed. |
| `pnpm -s ui:lab-starter-load-gate` | PASS | 8 starter-load tests passed. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | PASS | 2 Playwright tests passed; screenshots captured. |
| Focused Vitest surface suite | PASS | 66 passed, 1 skipped across IdeApp wiring, Project, Verify command bar, Hardware, Export, and Import tests. |
| `pnpm rb:doc:validate` | PASS | 36 passed, 0 failed after sprint docs. |
| `pnpm rb:encoding:check` | PASS | No mojibake markers found. |
| `git diff --check` | PASS | No whitespace errors. |
| `pnpm typecheck` | Expected FAIL | Known pre-existing `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift; no new UI-specific failure was isolated. |

## Remaining UI Issues

- P1: This sprint fixes severe narrow viewport overflow, but each surface still needs a dedicated small-screen design review after human screenshot review.
- P2: The old left rail still exists as secondary navigation; the new proof ribbon provides the lab-flow identity, but a future pass should decide whether the rail can collapse further.
- P2: Design, Verify, and Hardware still contain dense advanced panels; this pass reweights them instead of fully restructuring each surface.
- P2: Project starter progression is visually clearer, but advanced/deferred starter taxonomy can still be separated more deliberately.

## Next Recommended Sprint

Run a focused surface hierarchy pass after human review:

- Each RedByte surface must have one primary focal object.
- Each surface gets one secondary context layer.
- Each surface gets one advanced/collapsed detail layer.
- Each surface has one obvious next action.
- Do not add features or change behavior.
