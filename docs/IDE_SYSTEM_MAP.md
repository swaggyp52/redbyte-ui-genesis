# RedByte IDE System Map

> Living reference for the IDE codebase. Update when surfaces, authorities, or gates change.

**Release / certification:** Instructor-facing “what is safe for students right now” (starter matrix, E0–E3 tiers, Vivado proof links) lives in `docs/STUDENT_RELEASE_READINESS.md`, `docs/RC1_STUDENT_RELEASE_FREEZE.md`, and `docs/release/vivado-basys3-certification-matrix.md`.

---

## 0. Documentation Authority Map

This section routes product truth to existing canonical docs so RedByte does not grow parallel dated definitions for the same promise.

| Truth type | Canonical owner | Update when |
|------------|-----------------|-------------|
| Current working state, latest bench result, immediate priorities | `AI_STATE.md` for session history; `docs/ACTIVE_WORK.md` for the cockpit | Any meaningful agent batch, proof run, blocker, or priority change |
| Current stable truths and open IDE product debt | `docs/IDE_PRODUCT_DEBT_REGISTER.md` | Stable proofs land, open surface debt changes, browser audits change the ranking, or cleanup preconditions change |
| CSS debt inventory and overlap/risk metrics | `scripts/ide-css-audit.mjs` via `pnpm css:audit:ide`; summarized in `AI_STATE.md` and `docs/IDE_PRODUCT_DEBT_REGISTER.md` | Any CSS strategy pass, selector-pruning plan, or surface cleanup where deletion risk must be measured before edits |
| Active V1 product promise, product boundaries, non-goals, target readiness vocabulary, and execution order | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` | RedByte's V1 promise, workflow spine, supported/caveated scope, proof obligation, or work order changes |
| Older broad target-state contract | `docs/contracts/RedByte_Product_Contract.md` | Historical/broader target context changes; do not let it override the V1 reset queue |
| Surface responsibilities, runtime authorities, state-flow ownership, gate inventory | This file plus `docs/ide/SURFACE_CONFORMANCE.md` | Surface ownership, runtime authority, workflow-state language, or required gates change |
| User-facing instructions and current product behavior | `docs/manuals/RedByte_Product_Manual.md` | Student-visible workflow, terms, export/hardware instructions, or supported behavior changes |
| Manual claim governance | `docs/manuals/MANUAL_TRACEABILITY_MATRIX.md`, `docs/manuals/MANUAL_CLAIM_AUDIT.md`, `docs/manuals/MANUAL_CONFORMANCE.md` | Manual claims are added, removed, softened, or newly proven |
| Release readiness | `docs/STUDENT_RELEASE_READINESS.md`, `docs/RC1_STUDENT_RELEASE_FREEZE.md`, `docs/lab-day-vivado-basys3-readiness.md` | Student-safe posture, class assignment advice, or RC/lab-day limits change |
| Certification/support matrix | `docs/release/vivado-basys3-certification-matrix.md` | L0/E0/E1/E2/E3 status, support posture, or log paths change |
| Actual proof logs and board observations | `docs/release/proof/*.md` plus `out/vivado-cert/` logs | Vivado build, programming, or board observation evidence is produced |
| Hardening tickets | `docs/release/product-hardening-ticket-*.md` or GitHub product-hardening issues | A concrete product bug/blocker has repro, violated truth source, and acceptance proof |
| Historical/reference docs | `docs/DOC_INDEX.md` decides which stale or OS-era docs are excluded from default context | Only historical cleanup or legacy-shell work should edit or rely on them |

Do not create a new product-definition, whole-app-audit, or proof-matrix doc when one of the owners above can hold the truth cleanly. The 2026-06-13 V1 contract reset is the active exception because it replaced the near-term product execution order; future changes should update the V1 contract, execution program, work queue, or issue index instead of creating parallel roadmaps. Use `docs/IDE_PRODUCT_DEBT_REGISTER.md` for persistent UI/CSS/testing debt instead of scattering that truth across session summaries.

---

## 1. Surfaces and Responsibilities

| Surface | File | Responsibility |
|---------|------|----------------|
| Public Start | `public/start.html`, `apps/playground/src/boot/ide-bootstrap.ts` | Professional browser entry that explains the five-stage RedByte workflow and opens the IDE through one dominant action. It is not a workflow stage and does not own project readiness. |
| Project | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | Textual engineering overview and control point for **Project -> Design -> Verify -> Map Pins -> Export**. Loaded state explains identity, target, design size, Verify evidence, mapping progress, package state, blocker, and one recommendation. Build Fresh / Open Starter / Import / Open Existing remain directly reachable without making students manage core disclosures. |
| Design | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` | Canvas-first structural authoring and live simulation in stable library / canvas / inspector regions. A direct toolbar and context-preserving camera actions support graph editing; constrained widths move selected details below the canvas automatically rather than exposing layout toggles. Design remains editable without a local bridge agent. |
| Verify | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | Simulation Studio and testbench-document owner for named cases, stimulus, expected/observed outputs, clock policy, Observe evidence, Compare proof, waveform/results, and repair routing. One command authority owns Run; `Edit expected` stays separate from `Inspect Design` and structural `Open Design` repair. |
| Map Pins (internal hardware mode) | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | Stable Basys3 assignment workspace. A row's `Assign`, `Edit`, or `Resolve` action opens the resource selector; `Save assignment` commits project signal -> board resource -> package pin truth. The board is reference-only, and coherent mappings continue to Export. |
| Export | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | Stable downstream package decision, file browser/preview, and Vivado handoff owner. Export reads Design, Verify, and Map Pins readiness, presents blocked/draft/ready consequence, routes repair through `Open Export` where applicable, and keeps trusted `Download Package` separate from `Download draft`. `Open technical evidence` remains secondary. |
| Import utility | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | Safe horizontal Upload -> Review -> Apply recovery. ZIP, Paste HDL, and conditional Paste XDC are source choices inside Upload; Review precedes explicit Apply confirmation. Import stays outside the numbered stage navigator, preserves active work until confirmation, and cancel performs no replacement. |

### Historical Unified Workbench v3 local candidate (2026-07-15)

- **Persistent shell:** `IdeApp.tsx`, `IdeTopBar.tsx`, `IdeStageNav.tsx`, and `IdeWorkbenchShell.tsx` compose the product bar, exactly five horizontal stages, and the active workbench. `IdeLeftRail`, passive onboarding overlay, permanent footer/status console, and student-managed dock-toggle architecture are absent from v3.
- **Five-stage authority:** `Project -> Design -> Verify -> Map Pins -> Export` uses current/complete/attention/blocked state from existing workflow authority. Import is a top-bar utility with no stage number or completion state.
- **Top bar:** product identity, editable project identity, board/save state, Import, and Help. Surface execution and repair actions stay inside the owning workspace.
- **Project:** textual engineering overview, one current recommendation, and directly reachable start/change/recovery paths.
- **Design:** stable `200-220px` library, flexible dominant canvas, and `240-280px` inspector at desktop widths; selected details move below the canvas automatically at constrained widths. Students do not manage the basic layout. Fresh frozen unified-gate metrics generated at `2026-07-15T16:47:52.947Z` report available three-region Design workbench canvas share (`canvas / (canvas + library + inspector)`) of `64.81203%` at 1366 (`862 / 212 / 256` px), `66.66667%` at 1440 (`936 / 212 / 256` px), and `75.15924%` at 1920 (`1416 / 212 / 256` px). The enforced `62%` laptop floor conforms; the strategic `70%` laptop target remains unmet.
- **Verify:** Simulation Studio keeps named testbench documents, combinational/sequential authoring, one run command, Observe/Compare intent, waveform/results, and distinct `Edit expected`, `Inspect Design`, and structural `Open Design` repair paths in one stable workspace.
- **Map Pins:** progress, mapping table, row `Assign` / `Edit` / `Resolve` actions, resource selector, `Save assignment`, package-pin/XDC consequence, conflict repair, and secondary reference-only board remain visible without auxiliary after-mapping panels becoming page authorities.
- **Export:** one blocked/draft/ready handoff decision, stable file browser/preview, state-owned `Open Export` repair routing, separate trusted `Download Package` and `Download draft` actions, and secondary `Open technical evidence` dialog.
- **Import:** horizontal Upload -> Review -> Apply; ZIP / Paste HDL / conditional Paste XDC are Upload-source choices, review precedes explicit replacement confirmation, and cancel preserves current work.
- **Evidence and boundary:** fresh rebuilt v3 proof covers the five stages plus Import utility across four viewport conditions with empty failure/browser-problem arrays. The latest source-blind professor rerun on the frozen current build is **HOLD**, not GO: the workflow rail/stage state contradicts Design and Export blocker state, Verify defaults to Observe-only with blank expected-value dashes and no clear Compare-unlock path, and the Design recovery route can lose the specific `LD2` no-driver cause discovered from Export/Map Pins. Blank Student/timestamp fields and dash semantics remain visible debt. Student A and Student B each reached a UI-reported nine-file download; neither downloaded archive was independently inspected. Student C completed the final blind Import Task 4 in 2m35 with about 10 clicks, one intentional Design -> Import loop, no misclick or irreversible action, and proof that cancel preserved the original project before confirmation applied the candidate; candidate persistence and pin-alias explanation remain debt. The final blind Broken XOR task reached Compare PASS in 16.4 minutes with 51 clicks, 4 key presses, 2 lab-selection mistakes, about 5 wire misses, about 4 backtracks, and no irreversible action; diagnosis, Undo, and Update Compare worked, while affordance and wording remain debt. Generated bytes, mapping authority, Compare semantics, and E0/E1/E2/E3 boundaries are unchanged; nothing was pushed or deployed. **Verdict: broad local implementation evidence exists, but professor approval remains on HOLD pending repair and rerun.**

### Unified Workbench v3 RC authority layer (2026-07-22)

- **Current source:** local `product/redbyte-unified-workbench-v3-rc-integrated` at pre-doc checkpoint `0788044cbdf2699520d90a3428f2e5034dc73cab`. This is the manual/docs input, not the final reconstructed release SHA. No push, PR, merge, deployment, production replay, or remote-green claim applies.
- **Verify state owner:** `verifyScenario.ts` stores per-document `sequentialPolicy` beside named browser-local scenarios; `projectRuntime.ts` persists, duplicates, renames, repairs, and reconciles it with live I/O. `verifyScenarioSteps.ts` preserves rising/falling/high/low pulse behavior. `verifyClockPolicy.ts::materializeVectorsForClockPolicy()` produces the shared execution vectors consumed by runtime Verify, bring-up expectations, and testbench generation. `simEngineCore.ts` executes those vectors: manual/custom rows drive authored clock values and only low-to-high advances rising-edge state; Auto rows are sampled post-rising-edge. The policy remains outside portable `RBProject`, but Auto `runCycles`, automatic reset materialization, resolved clock/schedule data, starting level, and authored stimulus may change generated bytes and freshness.
- **Mapping state owner:** `basys3ExportContract.ts::buildSemanticMappingProjection()` is the semantic-to-artifact authority. Each row owns logical signal ID/label, direction, exact artifact port, board resource, package pin, I/O standard, exact XDC line, requirement, and conflict classification. `HardwareSurface`, `buildExportViewModel`, generators, and Import review consume that projection.
- **Export trust owner:** `exportTrustState.ts` holds structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded`. Verify evidence currentness (`current`, `missing`, `stale`, or `failed`) stays upstream. `buildProjectExportPackageSourceHash()` fingerprints every byte-bearing artifact plus wrapper inputs. `isExportDownloadReceiptCurrent()` requires the exact current package/project/Verify hashes, mapping currentness, download kind, trust, and SHA-256 receipt.
- **Manifest authority:** `buildCanonicalBasys3ProjectProjection()` refreshes the embedded manifest's generated HDL and constraints to the exact package projection. Import is manifest-first; `importPortIdentity.ts` permits strict scalar or parser-owned vector-bit identities and grants embedded-XDC projection only to manifest imports.
- **Interaction contracts:** `ide:gate:design-port-target-authority` guards `24x24` sparse targets, `32x24` dense clusters, keyboard operation, and compact picker behavior. The strengthened `ide:gate:verify-postrun-workbench-usability` guards `36x36` waveform controls and `13px` labels. `ide:gate:hardware-phase5-contract` guards grouped mapping and conflict repair. `ide:gate:export-submission-answer-contract` guards the first-viewport submission answer.
- **Source-checkpoint proof:** Node `20.19.0` / pnpm `10.24.0` passes the touched authority matrix (`20/20` files, `258/258` tests), typecheck, unified build, and the current sequential, mapping/package, custom-clock ZIP, preservation, Verify-repair, Export-trust, Import, ZIP-recovery, and wire-interaction gates on `0788044cb`. Historical pre-sequential checkpoint `f4f7ca8f3` had passed the earlier `36/36`, `477/477` matrix. Final exact-SHA aggregate/browser/human/manual/remote certification remains pending after docs and curated reconstruction.
- **Geometry/boundary:** The accepted Design laptop floor remains `62%`, with recorded full-viewport share `63.1%` at 1366 and `65.0%` at 1440. The strategic `70%` target is not met. All RC proof is Browser E0; Guided 4-Bit, Mapping Assistant v2, Vivado, bitstream, programming, board observation, and E1/E2/E3 remain outside the program.

### Historical predecessor shell model — superseded by Unified Workbench v3

The bullets in this and the following predecessor sections are retained for source/proof history only. Their rails, dock toggles, disclosures, `Flow` affordances, and multi-band command geometry are not current runtime composition.

- **Historical user chrome toggles** (`IdeWorkbenchShell.tsx`, `chromeToggles.ts`): the predecessor stored visibility controls under `rb.ide.chrome.toggles.v1` for side rails, console, the Design toolbar, and Verify command-bar inner rows. `chromeToggles.ts` now survives only as compatibility/test history and is not imported by the v3 runtime; Unified Workbench v3 exposes no student-managed shell rail/toggle authority.
- **Historical workflow/status authority** (`IdeApp.tsx`, `IdeLeftRail.tsx`, `IdeStatusBar.tsx`, `ide-polish-pass.css`): the predecessor used a compact proof ribbon, route-only left rail, and support/check footer. Unified Workbench v3 supersedes all three with `IdeStageNav` plus surface-owned status/action authority; the migrated `ide:gate:shell-workbench-hierarchy` guards the surviving hierarchy obligations.

### Historical predecessor Design model — superseded by Unified Workbench v3

- **Workbench header**: `ide-design-workspace-header` is the top owner. It carries the `Design` label, mode headline (Canvas / Code / Split / replay-linked variants), and the existing primary / secondary CTAs. The old standalone Design command strip does not exist anymore.
- **Control bar**: one tools row plus compact status ownership. The expanded tool cluster (`ide-design-toolbar-expanded`) is an anchored popup, not a stacked band. Verify-linked sessions still surface `Verify focus …` via `data-testid="ide-design-verify-focus"` in the simulation strip when that story is active.
- **Verify mismatch brief and repair context**: when Verify opens Design on a failed comparison, `VerifyDebugContext` carries the signal key, student label, expected/observed bits, tick/case context, input snapshot, and next-inspection hint. Design renders that as a student-facing brief and, when graph tracing is available, a direct failed-output driver context with driver type, wire counts, and a Focus driver action. Design also renders a bounded upstream signal-trace panel for multi-stage failures, with per-node Focus actions and open-input clues when available. It must not claim formal root cause when the graph cannot trace a direct driver or when a trace only proves connectivity.
- **Workbench**: support rails are narrower, and code / split default both rails to collapsed overlay handles so the workspace keeps its full width. The left palette order is `Board -> IO -> Logic -> Sequential -> Reusable`; `Board` starts expanded so Basys3 resources and `CLK100MHZ` are immediately available. The idle inspector stays secondary, but its default state is now a compact **Design overview** card inside `ide-design-inspector-canvas-default` with live Inputs / Outputs / Nodes / Wires counts plus an empty-canvas branch.

### Historical predecessor Hardware model — superseded by Unified Workbench v3

- **Retired predecessor interaction:** the old Hardware layout centered a signal list plus a clickable Basys3 visual. Unified Workbench v3 supersedes that interaction: the mapping table and its resource selector are authoritative, while the board is reference-only.
- **Calm default inspector**: in map mode with no active selection, the right inspector shows concise mapping guidance only. Dense details (XDC preview, diagnostics/preflight internals) are available but collapsed by default so row selection and board assignment stay primary.
- **Current replacement boundary:** rows show friendly signal labels, board control aliases before physical package pins, and `Mapped` / `Missing` / `Conflict` state. In v3, `Assign` / `Edit` / `Resolve` opens the resource selector and `Save assignment` writes the mapping authority that Export reads; the board never writes assignments.
- **Board framing copy**: the map workspace now states the current assignment task explicitly (`Select a signal row…`, `Choose a Basys3 control for …`, or `This signal is mapped to …`) so students can tell what to do next without reading diagnostics.
- **Authoritative board planner model**: `basys3Pins.ts` owns the shared Basys3 resource catalog for planner-visible resources (clock, switches, buttons, LEDs, seven-segment controls) plus extended official XDC references (Pmods, XADC, VGA, USB-UART, PS/2, QSPI). Hardware summary cards, the board visual, the inspector, and Export/XDC binding truth all consume that same source.
- **Clock truth is explicit**: the 100 MHz oscillator is surfaced as `CLK100MHZ` on package pin `W5`, and Hardware exposes the 10 ns `create_clock` relationship that Export emits for the mapped top-level clock port.
- **Catalog + XDC traceability**: Hardware now makes the chain explicit: project signal -> board resource -> package pin -> XDC binding preview. The preview stays secondary detail inside Hardware, but students can inspect it without dropping into a schema editor or leaving the planner.
- **After-mapping tools**: Board Check, Pre-flight, Simulation, and the Verify -> Export -> Program dependency ribbon are demoted below the Map Pins board workspace. They remain available without visually competing with pin binding.
- **Advanced editor containment**: Structured `hardwareMappingV2` entry editing remains available behind an explicit `Advanced mapping editor` disclosure and is not part of the default student path.
- **Dock / inspector**: Left dock panels use **stage-colored left borders**; hardware inspector tables are **not** opacity-dimmed so live state and assertions stay legible.

### Historical predecessor Export model — superseded by Unified Workbench v3

- **Trust-first hero**: Export now opens with one dominant readiness hero and explicit trust language (`READY`, `NEEDS REVIEW`, `BLOCKED`, plus `DRAFT AVAILABLE` when a buildable but untrusted package exists).
- **Single handoff summary rail**: The hero surfaces a compact row model for Design, Board, Pin mapping, Verification, Artifacts, and Export state so students can answer handoff trust questions before opening diagnostics.
- **Draft/trusted separation**: Download copy and warning tone now make draft packages visibly distinct from trusted handoff packages; draft guidance stays near both trust and Vivado instruction regions.
- **Vivado path clarity**: `Open in Vivado` now presents an 8-step numbered handoff flow (download, unzip, open project/import TCL, synth, impl, bitstream, program board) instead of a compressed 3-step sentence.
- **Secondary detail containment**: detailed diagnostics/fix paths and generated file previews are still available but moved behind collapsed disclosures (`Detailed diagnostics and fix paths`, `Generated file previews`, `Advanced proof metadata`) so default view emphasizes trust/action over internals.

### Historical predecessor Verify model — superseded by Unified Workbench v3

- **Command deck** (`VerifyCommandBar.tsx`, `ide-polish-pass.css`): a primary band contains **Run** / **Generate**, explicit **Next run** mode selector (`ide-vcb-run-mode`: **Observe only** / **Compare checks**) with inline explainer (`ide-vcb-mode-explainer`) that states the Observe-vs-Compare contract in plain language, **Experiment** block (`data-testid="ide-vcb-experiment-context"`: scenario headline, **Case tN** vs **No case selected**, timing / lab mode line from `sequencerModeLabel`), then **Tools** / **Details** / **Open in Design**. A second **session** strip carries status, deduped session meta, evidence, and coverage. At `<=1200px`, the primary band reflows into a two-column / two-row grid so the full Observe/Compare labels and status/truth regions do not overlap. Scenario headline is **`activeScenario.name` -> `lastRun.scenarioName` -> vector-bucket label** (no Verify-only invented names). **Run** text is mode-specific (observe vs compare) via `buildVerifySessionViewModel.runLabel`.
- **Compare path visibility**: saved checks no longer disappear behind **Tools** when other utilities are present. **Observe only** and **Compare checks** stay visible as the next-run choice, while **Tools** is reserved for secondary actions like **Open checks** / **Save observed outputs**.
- **Run proof / pass hero** (`VerifySurface.tsx`): on **checks pass**, the hero uses student-facing **What this means** copy (pass/fail reflects the Verify run, not Design edits you have not re-run). When **`incomplete-mapping`**, the primary CTA is **Open Project — Map Pins**; when mapping is complete, **Continue to Hardware** and **Open Export** are first-class. Failure drawer diagnosis is titled **What to fix first** (not “Issues found”).
- **Mapping preflight (no run yet)**: if pin mapping is incomplete, **`ide-verify-primary-status`** in the command bar offers **Open Project — Map Pins** and optional **View on Hardware (same mapping)**; the old thin pre-run strip banner was removed in favor of this callout.
- **Lab grid**: Wider **column gap**; **waveform** region gets a stronger **instrument frame** (border, depth shadow); **scenario library** header uses **taller** switcher + **CRUD** buttons; **stimulus tick** **is-selected** state is higher-contrast on Verify; **lab sequencer** meta chips are larger and bordered.
- **Build testbench ownership**: `ScenarioBuilderPanel` now frames the left authoring zone as **Build testbench** and carries a compact summary of driven inputs, checked outputs, case/tick count, clock activity, and whether Compare checks are armed. The primary editor is one unified grid: input stimulus above, expected outputs below, with advanced generators behind one disclosure instead of nested student-facing drawers.
- **Evidence workbench integrity**: starter vectors no longer collapse the first-run editor. After a run, the setup column drops first-run teaching chrome and keeps case/check editing beside waveform proof. `ide:gate:verify-evidence-workbench` proves first-run expected-output editing, Observe-only waveform evidence that is not trusted proof, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, repair PASS, and no meaningful overlap among the stimulus and waveform evidence regions.
- **Clock / timing testbench panel**: Sequential Verify keeps a visible clock/timing banner inside the stimulus workbench, but board-backed clocks such as `CLK100MHZ` / `W5` are now **auto-run by default**. The panel shows detected clock identity, mode, run length, edge, and reset behavior. Manual pulses and custom patterns remain available as explicit overrides for switch/button-clocked designs, and only those manual/custom modes keep the clock lane primary in the grid.
- **Auto-clock runtime policy**: `projectRuntime.ts` materializes board-clock cycles before deterministic verify executes, so sequential runs keep one authority chain: authored data inputs, explicit clock policy, deterministic runtime vectors, report, then waveform. Auto board clock runs do not require authored `CLK100MHZ` pulse rows.
- **Verify evidence freshness**: `projectRuntime.ts::runVerification()` records the same normalized current-project hash that `buildCurrentVerifyProjectHash()` derives for workflow authority. The signature covers circuit, project vectors, custom vectors, and project I/O mapping while ignoring vector UI IDs, so helper-generated clock rows settle to current evidence after the run instead of immediately going stale.
- **Specific stale reasons**: Verify no longer falls back to a generic rerun prompt when the authority already knows the drift source. The student-facing stale states distinguish **Design changed - rerun Compare**, **Testbench changed - rerun Compare**, and mapping-driven downstream review.
- **Wrong-build repair lane**: a failed Compare must separate expected/testbench repair from design repair. The design lane opens Design with mismatch context, lets the student focus the directly traced driver when available, shows a bounded upstream trace for multi-stage paths, and returns to Verify where current evidence is stale until Compare passes again.

---

## 2. Runtime Authorities

| Authority | File | Responsibility |
|-----------|------|----------------|
| `projectRuntime.ts` | `packages/rb-apps/src/apps/ide/projectRuntime.ts` | Runtime-authoritative design state, deterministic verification, and IO-backed project authority |
| `verifyScenario.ts` / `verifyScenarioSteps.ts` | `packages/rb-apps/src/apps/ide/verifyScenario.ts`, `packages/rb-apps/src/apps/ide/verifyScenarioSteps.ts` | Named testbench-document identity, browser-local sequential policy, explicit step/pulse semantics, and deterministic scenario hashes |
| `simEngineCore.ts` | `packages/rb-apps/src/apps/ide/sim/simEngineCore.ts` | Manual/custom sequential execution: authored clock values, rising-edge-only capture, settled row sampling, no hidden manual reset, and one runtime sequence for report/waveform/check verdicts |
| `circuitStore.ts` | `packages/rb-apps/src/stores/circuitStore.ts` | Circuit graph mutations |
| `unifiedProjectStore.ts` | `packages/rb-lab-engine/src/stores/unifiedProjectStore.ts` | Single source of truth for RBProject |
| `projectHealth.ts` | `packages/rb-apps/src/apps/ide/projectHealth.ts` | Derives structural blocking issues from core state; stale export state is advisory, not a blocking issue |
| `projectWorkflowAuthority.ts` | `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts` | Canonical product-truth snapshot for verify state, draft-vs-trusted export state, strict stage completion, primary CTA, and Hardware/Export handoff labels |
| `simEngine.ts` | `packages/rb-apps/src/apps/ide/sim/simEngine.ts` | Simulation advancement, trace accumulation |
| `componentSupportRegistry.ts` | `packages/rb-logic-core/src/analysis/componentSupportRegistry.ts` | Canonical component support matrix for Design authoring, Verify mode support, VHDL export support, Import HDL aliases, classroom availability, and sequential metadata |
| `basys3ExportContract.ts` | `packages/rb-apps/src/fpga/boards/basys3/basys3ExportContract.ts` | Canonical semantic mapping projection and Basys3 port/timing/conflict contract consumed by Map Pins and all package projections |
| `exportTrustState.ts` | `packages/rb-apps/src/apps/ide/exportTrustState.ts` | Exact structural, `verificationTrust`, and action enums; byte-bearing package-source fingerprint; current download-receipt validation |
| `verifyClockPolicy.ts` / `buildExportViewModel.ts` / `testbenchGenerator.ts` | `packages/rb-apps/src/apps/ide/verifyClockPolicy.ts`, `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`, `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts` | Shared materialized execution vectors plus resolved clock/schedule projection; deterministic Auto-versus-manual/custom `testbench.vhd`; package fingerprinting |
| `importPortIdentity.ts` | `packages/rb-apps/src/apps/ide/importPortIdentity.ts` | Strict scalar/vector-bit Import identity grammar and manifest-only embedded-XDC projection |

### Product state truth audit

`projectWorkflowAuthority.ts` and `projectTruth.ts` already provide the shared truth language consumed by Project, Verify, Hardware, and Export for draft-vs-trusted handoff decisions.

| Question | Current owner / status |
|----------|------------------------|
| Is there a design? | Covered by `ProjectReadinessState.hasCircuit` and `ProjectTruthState.needs-design`. |
| Is the design structurally valid? | Partially covered by `projectHealth.blockingIssues`; detailed Design diagnostics remain separate and should be folded into future acceptance tests. |
| Is simulation possible? | Partially covered by Verify readiness and support diagnostics; no single product-state boolean yet. |
| Is the testbench configured? | Partially covered by `readiness.hasVectors` and Verify vector/check state; needs clearer product-state naming. |
| Is Compare current? | Covered by `verifyCurrent`, `compareCurrent`, and the normalized verify project hash. |
| Did Compare pass? | Covered by `trustedVerifyCurrent`, `comparePassCurrent`, `compareMatches`, and `comparePassIncomplete`. |
| Are pins mapped? | Covered by `readiness.hasIoMapping` and Map Pins mapping rows. |
| Is draft export possible? | Covered by `exportAvailable` and `draftExportAvailable`. |
| Is trusted export possible/current? | Covered by `exportPackageCurrent`, `exportTrusted`, `trustedVerifyCurrent`, and `ProjectTruthState.hardware-proof-required`. |
| Has Vivado build proof been recorded? | Not represented in runtime state; tracked in release/certification docs and `out/vivado-cert/`. |
| Has board programming proof been recorded? | Not represented in runtime state; tracked as E2 proof docs/logs. |
| Has board observation proof been recorded? | Not represented in runtime state; tracked as E3 proof notes. |

Batch 1 decision: do not add a broad new state model yet. The next coding batch should add focused acceptance tests and, only where needed, small state fields for Vivado/E2/E3 proof recording without weakening the existing draft-vs-trusted export distinction.

### Component support authority

- **Single matrix:** `componentSupportRegistry.ts` is the support authority. Design palette filtering, Verify sequential/blocked detection, Import HDL component alias resolution, VHDL supported-node sets, and Basys3 stateful export classification read this matrix instead of maintaining private allowlists.
- **Student-safe subset:** Counter4Bit and Delay remain recognized as structural/sequential concepts but are not student-authorable, verify-supported, classroom-safe, or VHDL-exportable until their implementations are proven.
- **Runtime alignment:** NOR and XNOR are registered runtime behaviors so the palette, simulation, IR, and VHDL export all agree for the two-input gate set.

---

## 3. Lab-Critical Paths

### Path 1: Professor ZIP Import → Design Shows Circuit

1. ImportSurface exposes ZIP, Paste HDL, and (after parsed HDL) Paste XDC inside Upload; for this ZIP path, the user chooses ZIP
2. `zipImport.ts::importVivadoZipFile()` → extracts HDL + XDC → `ZipImportInspection` (companion RTL → `project.hdl.sources`; `tb_*` listed only)
3. `zipImport.ts::buildImportedProject()` → calls `parsedHdlToCircuit()` → `RBProject`
4. Review shows the candidate and replacement consequences before any active-project mutation
5. User chooses Review replacement, then explicitly confirms replacement -> `onImportProject?.(project)` -> IDE loads project
6. Cancel at any point leaves the active project unchanged; Design renders nodes + connections only after confirmed Apply

Gate: `scripts/gates/ide-zip-import-contract.mjs`

---

### Path 2: Verify Run Produces Deterministic Evidence

1. Design surface runs simulation (30+ ticks)
2. VerifySurface -> user authors or selects a named testbench, generates/edits cases as needed, then clicks Run
3. `projectRuntime.ts::runVerification()` resolves that document's policy and builds IO mapping from runtime `projectIoRows`.
4. `materializeVectorsForClockPolicy()` creates the shared execution vectors. Manual/custom retains one settled sample per authored row. Auto starts at cycle 0 and materializes `max(runCycles, authored-row count, 1)` rows; it places any automatic reset assertion in cycle 0 with later deassertion when applicable, with no separate hidden runtime reset prelude.
5. `projectRuntime.ts::runVerification()` → calls `buildDeterministicVerifyContext(circuit, ioMapping)`.
6. `projectRuntime.ts::runVerification()` → calls `runDeterministicVerifyFromModel(circuit, simModel, ioRows, materializedVectors, scheduleContract)`. Manual/custom advances state only on authored low-to-high transitions; repeated high, high-to-low, repeated low, and flat-low hold. Every Auto result row is sampled post-rising-edge.
7. Bring-up expectations and generated `testbench.vhd` consume the same materialized vector sequence rather than independently reinterpreting the raw policy.
8. One execution sequence produces `RuntimeVerifyRun.report`, waveform, expected-check sampling, PASS/FAIL classification, and the deterministic evidence capsule.
9. VerifySurface renders `current`, `missing`, `stale`, or `failed` evidence currentness without treating Observe-only traces as Compare proof.
10. On a mismatch, `Edit expected` repairs the testbench while `Inspect Design` and structural `Open Design` preserve circuit-repair context, including the failed signal label, expected/observed bits, tick, input snapshot, and next-inspection hint when available.

Freshness authority: the verify ledger `projectHash` is produced by `buildCurrentVerifyProjectHash()` so workflow status, Hardware, and Export compare against the same normalized state. A stimulus change after a pass stales Verify as testbench/state drift; a circuit or mapping change stales it as project drift.

Gate: `scripts/gates/ide-verify-reality-contract.mjs`

---

### Path 3: Export -> Vivado Package

1. Project must have: IO mapping complete + current Compare PASS with saved checks for a trusted export. Structurally buildable but unverified packages are labeled draft/debug, not trusted handoff.
2. `Open Export` enters the stable handoff workspace; ExportSurface computes its blocked/draft/ready decision from shared workflow authority and diagnostics.
3. Trusted readiness exposes `Download Package`; a structurally buildable but untrusted state exposes the separate `Download draft` action and warning language. These actions are not interchangeable.
4. The file browser/preview exposes package contents in the primary workspace, while `Open technical evidence` opens the secondary evidence dialog.
5. `buildExportViewModel.ts` accepts the shared materialized execution vectors plus the resolved clock/schedule projection. It does not consume waveform, UI status, or Compare-result objects as testbench-generation inputs.
6. `testbenchGenerator.ts` keeps Auto output on the free-running generator / half-period path and waits for a rising edge before every materialized row's assertion, including cycle 0. Manual/custom output omits that scaffold, assigns the clock from each materialized authored vector, and uses the deterministic settle interval.
7. Auto `runCycles` and automatic reset behavior can change the materialized vectors, `testbench.vhd`, package fingerprint, Export freshness, and receipt currentness without adding a portable `RBProject` field. Automatic reset is visible in the materialized cycle sequence, not a hidden runtime-only prelude.
8. Handoff copy distinguishes no bundle, stale bundle, draft, and trusted package states; stale Verify wording routes back to Verify, and synthesis/bitstream generation remain Vivado work.
9. Export mapping rows and technical evidence render Basys3 board labels before package pins (for example `SW0 (pin V17)`) while XDC generation still consumes the resolved package pin.

Gate: `scripts/gates/ide-export-generates-hdl.mjs`
Gate: `scripts/gates/ide-export-ready-contract.mjs` (guards current Export readiness, repair, download, and artifact-preview behavior)

**Blocker truth:** Project / Hardware / Export consume `ProjectWorkflowAuthority`. Verify must be current and passing before Hardware/Export present a trusted build/program handoff. **No bundle yet** is **READY TO BUILD** only after design, mapping, and Verify proof are satisfied; unverified buildable packages remain draft. **Blocked** is reserved for real prerequisite failures (mapping gap, design/export diagnostics, blocked export attempt).

---

### Path 4: Hardware Checklist

1. Map Pins receives `health` + `mappingRows` + `vectorsCount` through internal hardware mode.
2. It derives assignment progress and missing/conflicting resources from the same mapping authority Export consumes.
3. A row's `Assign`, `Edit`, or `Resolve` action opens the resource selector for that signal.
4. The student chooses a valid Basys3 resource and uses `Save assignment`; `Clear` affects only the selected row.
5. **Board reference truth:** the Basys3 board visual is reference-only and never writes assignments. Catalog details and XDC preview derive from the shared `basys3Pins.ts` catalog and saved mapping authority.
6. **Clock truth:** no generic Clock part is offered in the Design palette. FPGA clocked designs map the top-level clock to board resource `CLK100MHZ` (`W5`); internal deterministic simulation supplies automatic clock behavior according to Verify clock policy.
7. **Student truth (Vivado / board):** RedByte's export is a Vivado project ZIP; the `.bit` is produced in Vivado through synthesis, implementation, and Generate Bitstream, then Hardware Manager -> Program Device.

Gate: `scripts/gates/ide-bringup-contract.mjs`

**Ownership truth:** Map Pins ends when required assignments are coherent and routes the student to Export. Export owns downstream package readiness and routes stale, missing, trace-only, or differing Verify evidence back to Verify; Map Pins does not repair or reclassify Verify evidence. A structurally buildable but untrusted package remains an explicitly labeled draft unless a real Design or mapping prerequisite blocks artifact generation.

---

## 4. Import Pipeline Details

### Call Tree

```
User picks file
  └─ zipImport.ts::importVivadoZipFile(file)
       └─ importVivadoZipBytes(bytes)
            ├─ collectTextEntries(zip)        — flattens all files to { path, text }[]
            ├─ chooseTopHdlEntry(files)       — picks by topHdlScore (prefers top.vhd)
            ├─ chooseXdcEntry(files)          — picks by name (prefers top.xdc)
            ├─ parseVhdl(text) OR parseVerilog(text)
            ├─ parseXdcPins(xdcText)          — returns { pinMap, warnings }
            └─ buildImportedProject(...)      — returns RBProject
```

### Pin Resolution

- `packages/rb-apps/src/import/xdcImport.ts::parseXdcPins()` → `{ portName → PACKAGE_PIN }`
- `packages/rb-apps/src/fpga/boards/basys3/basys3Pins.ts::normalizeBasys3PinAlias()` → resolve alias (e.g. "SW0" → "V17")
- `packages/rb-apps/src/fpga/boards/basys3/basys3Pins.ts::BASYS3_ALLOWED_PACKAGE_PINS` → Set of valid Basys3 package pins

---

## 5. Gate Inventory

> This table lists key gate references. The full gate suite is in `scripts/gates/`. Update this table when adding gates that cover new lab-critical paths.

| Gate | What it protects |
|------|-----------------|
| `ide-bringup-contract.mjs` | Hardware surface loads + bring-up checklist renders |
| `ide-canvas-legibility-contract.mjs` | Canvas text is legible at default zoom |
| `ide-console-autocollapse-contract.mjs` | Console collapses when no blocking entries |
| `ide-design-build-contract.mjs` | Design mode builds without compile errors |
| `ide-design-io-panel-contract.mjs` | Live inputs panel renders and toggles |
| `ide-design-live-sim-contract.mjs` | Simulation ticks advance and pause |
| `ide-design-no-bridge-required.mjs` | Design loads the Logic Gates starter without bridge fatal copy or any local bridge request before Hardware mode |
| `ide-complex-build-signal-trace-debugging.mjs` | Multi-stage scratch wrong-build Compare failure opens Design with bounded upstream signal trace and focus actions |
| `ide-export-generates-hdl.mjs` | Export produces VHDL with entity/architecture |
| `ide-export-ready-contract.mjs` | Export shows correct blocked/ready state |
| `ide-export-trust-integrity.mjs` | Export trust gate proves visible previews, ZIP entries, README/provenance, and E0/E1/E2/E3 wording agree |
| `ide-verify-evidence-workbench-integrity.mjs` | Implements `ide:gate:verify-evidence-workbench`; proves visible first-run expected-output editing, Observe-only non-proof waveform evidence, Compare PASS, intentional FAIL, first mismatch expected/observed values, waveform evidence, repair PASS, and no evidence-region overlap |
| `ide-layout-contract.mjs` | Shell layout elements and resize handles present |
| `ide-persistence-contract.mjs` | Project state survives page reload |
| `ide-project-readiness-contract.mjs` | Project surface readiness checklist renders |
| `ide-shell-chrome-contract.mjs` | Historical shell gate whose surviving obligation is bounded persistent chrome; rail/status-bar wording is predecessor-only |
| `ide-shell-density-contract.mjs` | Shell passes density assertions at 1280px |
| `ide-unified-workbench-v3-flow.mjs` | Product bar + horizontal five-stage navigation, Import utility boundary, no permanent workflow rail/core disclosures/dock toggles, stable five-stage plus Import work objects, text/target floors, root and internal clipping checks, nominal-center hitability, one `main`, named/focusable canvas, four viewport conditions, and no browser errors. Focused tests and independent reachability artifacts separately cover keyboard activation and Verify result announcement/focus. |
| `ide-sequential-testbench-authority.mjs` | Implements the required standalone `ide:gate:sequential-testbench-authority` RC gate: named sequential document policy through edit, pulse/runtime semantics, generated-testbench authority, Export staleness, save/reload, duplicate/rename, compatible Design repair, and Import recovery without portable `RBProject` policy drift. Run it separately from the 72-step aggregate. |
| `ide-mapping-preview-package-agreement.mjs` | Implements the required standalone `ide:gate:mapping-preview-package-agreement` RC gate: logical Map Pins row, exact XDC preview, generated package files, embedded manifest projection, and manifest-first re-import agreement. Run it separately from the 72-step aggregate. |
| `ide-design-port-target-authority.mjs` | Sparse/dense Design port target geometry, keyboard operation, compact picker, and normal wiring at the constrained laptop viewport. |
| `ide-hardware-phase5-contract.mjs` | Inputs/Outputs/Clock-Reset grouping, current readiness, and named inline conflict repair across laptop/desktop/wide viewports. |
| `ide-export-submission-answer-contract.mjs` | First-viewport answer to What should I submit, role guidance, readability, and E0-only boundary across three viewports. |
| `ide-verify-contract.mjs` | Verify flow works end-to-end |
| `ide-verify-reality-contract.mjs` | Trace produces ≥8 ticks with correct signals |
| `ide-verify-no-trace-guard-contract.mjs` | hasNoTrace guard works correctly |
| `ide-zip-import-contract.mjs` | ZIP import produces project with ioRows |
| `ide-professor-import-reality-contract.mjs` | Realistic nested Vivado ZIP imports correctly (planned) |
| `ide-zoom-presets-contract.mjs` | Zoom preset buttons change canvas zoom |
