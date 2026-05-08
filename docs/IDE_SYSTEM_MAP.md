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
| Product promise, product boundaries, non-goals, target readiness vocabulary | `docs/contracts/RedByte_Product_Contract.md` | RedByte's promise, workflow spine, supported/caveated scope, or proof obligation changes |
| Surface responsibilities, runtime authorities, state-flow ownership, gate inventory | This file plus `docs/ide/SURFACE_CONFORMANCE.md` | Surface ownership, runtime authority, workflow-state language, or required gates change |
| User-facing instructions and current product behavior | `docs/manuals/RedByte_Product_Manual.md` | Student-visible workflow, terms, export/hardware instructions, or supported behavior changes |
| Manual claim governance | `docs/manuals/MANUAL_TRACEABILITY_MATRIX.md`, `docs/manuals/MANUAL_CLAIM_AUDIT.md`, `docs/manuals/MANUAL_CONFORMANCE.md` | Manual claims are added, removed, softened, or newly proven |
| Release readiness | `docs/STUDENT_RELEASE_READINESS.md`, `docs/RC1_STUDENT_RELEASE_FREEZE.md`, `docs/lab-day-vivado-basys3-readiness.md` | Student-safe posture, class assignment advice, or RC/lab-day limits change |
| Certification/support matrix | `docs/release/vivado-basys3-certification-matrix.md` | L0/E0/E1/E2/E3 status, support posture, or log paths change |
| Actual proof logs and board observations | `docs/release/proof/*.md` plus `out/vivado-cert/` logs | Vivado build, programming, or board observation evidence is produced |
| Hardening tickets | `docs/release/product-hardening-ticket-*.md` or GitHub product-hardening issues | A concrete product bug/blocker has repro, violated truth source, and acceptance proof |
| Historical/reference docs | `docs/DOC_INDEX.md` decides which stale or OS-era docs are excluded from default context | Only historical cleanup or legacy-shell work should edit or rely on them |

Do not create a new product-definition, whole-app-audit, or proof-matrix doc when one of the owners above can hold the truth cleanly. New dated docs are appropriate only for a concrete proof record, hardening ticket, or topic with no canonical home. Use `docs/IDE_PRODUCT_DEBT_REGISTER.md` for persistent UI/CSS/testing debt instead of scattering that truth across session summaries.

---

## 1. Surfaces and Responsibilities

| Surface | File | Responsibility |
|---------|------|----------------|
| Project | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | **Dashboard / home surface** for the product spine **Project -> Design -> Verify -> Map Pins / Hardware -> Export**. Project owns identity, next-action truth, readiness, and read-only mapping/export summaries; the low-level bridge now lives behind collapsed **Project bridge & determinism** disclosure (`ide-project-bridge-disclosure`) so the home surface does not lead with internals. Multi-file finals start in **Import**. |
| Design | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` | Circuit canvas editing + live simulation |
| Verify | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | Deterministic verification, testbench authoring, waveform viewer; header keeps **observe vs compare** as an explicit **Next run** selector (`ide-vcb-run-mode`), the stimulus workbench now owns first-class **Clock / timing** guidance with an explicit clock policy (auto board clock vs manual pulses vs custom pattern) for sequential tests, and the left setup column carries the compact run-summary truth students use before Compare |
| Export | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | Vivado bundle generation, evidence capsule |
| Hardware | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | Student-facing Basys3 binding surface. **Map Pins is the primary default**: students select a project signal, inspect an authoritative board resource, click a board control, and see the saved board control plus physical package pin. Hardware now behaves like a simplified Basys3 board planner with clock truth, grouped resource catalog, and an XDC binding preview tied to the same saved mapping Export reads. |
| Import | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | Vivado ZIP / HDL+XDC import pipeline |
Marcus HQ is not an IDE surface. It is a separate local companion served by `scripts/rb-hq-server.mjs` and launched with `pnpm rb:marcus:start`.

### Shell chrome controls

- **User chrome toggles** (`IdeWorkbenchShell.tsx`, `chromeToggles.ts`): the shell owns persistent visibility controls under `rb.ide.chrome.toggles.v1` for side rails, console, the Design toolbar, and Verify command-bar inner rows. The controls live outside surface `CHROME_CONTRACT.topStripSlots`, so they do not add a new top-strip slot or hide Hardware sub-mode exit banners.

### Design chrome (layout system)

- **Workbench header**: `ide-design-workspace-header` is the top owner. It carries the `Design` label, mode headline (Canvas / Code / Split / replay-linked variants), and the existing primary / secondary CTAs. The old standalone Design command strip does not exist anymore.
- **Control bar**: one tools row plus compact status ownership. The expanded tool cluster (`ide-design-toolbar-expanded`) is an anchored popup, not a stacked band. Verify-linked sessions still surface `Verify focus …` via `data-testid="ide-design-verify-focus"` in the simulation strip when that story is active.
- **Verify mismatch brief**: when Verify opens Design on a failed comparison, `VerifyDebugContext` carries the signal key, student label, expected/observed bits, tick/case context, input snapshot, and next-inspection hint. Design renders that as a student-facing brief instead of a generic replay note.
- **Workbench**: support rails are narrower, and code / split default both rails to collapsed overlay handles so the workspace keeps its full width. The left palette order is `Board -> IO -> Logic -> Sequential -> Reusable`; `Board` starts expanded so Basys3 resources and `CLK100MHZ` are immediately available. The idle inspector stays secondary, but its default state is now a compact **Design overview** card inside `ide-design-inspector-canvas-default` with live Inputs / Outputs / Nodes / Wires counts plus an empty-canvas branch.

### Hardware chrome (layout system)

- **Map Pins-first workspace**: Hardware opens on a plain signal-to-board binding job. The command strip is mapping-only in map mode; export/program state moves below the board so the first-view center of gravity is the signal list plus clickable Basys3 visual.
- **Calm default inspector**: in map mode with no active selection, the right inspector shows concise mapping guidance only. Dense details (XDC preview, diagnostics/preflight internals) are available but collapsed by default so row selection and board assignment stay primary.
- **Board assignment loop**: Rows show friendly signal labels, board control aliases before physical package pins, and simple `Mapped` / `Missing` / `Conflict` state. Selecting a row now drives a visible signal -> board control -> physical pin confirmation strip and highlights valid board targets. Board clicks write through the same saved mapping authority that Export reads.
- **Board framing copy**: the map workspace now states the current assignment task explicitly (`Select a signal row…`, `Choose a Basys3 control for …`, or `This signal is mapped to …`) so students can tell what to do next without reading diagnostics.
- **Authoritative board planner model**: `basys3Pins.ts` owns the shared Basys3 resource catalog for planner-visible resources (clock, switches, buttons, LEDs, seven-segment controls) plus extended official XDC references (Pmods, XADC, VGA, USB-UART, PS/2, QSPI). Hardware summary cards, the board visual, the inspector, and Export/XDC binding truth all consume that same source.
- **Clock truth is explicit**: the 100 MHz oscillator is surfaced as `CLK100MHZ` on package pin `W5`, and Hardware exposes the 10 ns `create_clock` relationship that Export emits for the mapped top-level clock port.
- **Catalog + XDC traceability**: Hardware now makes the chain explicit: project signal -> board resource -> package pin -> XDC binding preview. The preview stays secondary detail inside Hardware, but students can inspect it without dropping into a schema editor or leaving the planner.
- **After-mapping tools**: Board Check, Pre-flight, Simulation, and the Verify -> Export -> Program dependency ribbon are demoted below the Map Pins board workspace. They remain available without visually competing with pin binding.
- **Advanced editor containment**: Structured `hardwareMappingV2` entry editing remains available behind an explicit `Advanced mapping editor` disclosure and is not part of the default student path.
- **Dock / inspector**: Left dock panels use **stage-colored left borders**; hardware inspector tables are **not** opacity-dimmed so live state and assertions stay legible.

### Export chrome (layout system)

- **Trust-first hero**: Export now opens with one dominant readiness hero and explicit trust language (`READY`, `NEEDS REVIEW`, `BLOCKED`, plus `DRAFT AVAILABLE` when a buildable but untrusted package exists).
- **Single handoff summary rail**: The hero surfaces a compact row model for Design, Board, Pin mapping, Verification, Artifacts, and Export state so students can answer handoff trust questions before opening diagnostics.
- **Draft/trusted separation**: Download copy and warning tone now make draft packages visibly distinct from trusted handoff packages; draft guidance stays near both trust and Vivado instruction regions.
- **Vivado path clarity**: `Open in Vivado` now presents an 8-step numbered handoff flow (download, unzip, open project/import TCL, synth, impl, bitstream, program board) instead of a compressed 3-step sentence.
- **Secondary detail containment**: detailed diagnostics/fix paths and generated file previews are still available but moved behind collapsed disclosures (`Detailed diagnostics and fix paths`, `Generated file previews`, `Advanced proof metadata`) so default view emphasizes trust/action over internals.

### Verify chrome (layout system)

- **Command deck** (`VerifyCommandBar.tsx`, `ide-root.css`): **Two rows** — primary: **Run** / **Generate**, explicit **Next run** mode selector (`ide-vcb-run-mode`: **Observe only** / **Compare checks**) with inline explainer (`ide-vcb-mode-explainer`) that states the Observe-vs-Compare contract in plain language, **Experiment** block (`data-testid="ide-vcb-experiment-context"`: scenario headline, **Case tN** vs **No case selected**, timing / lab mode line from `sequencerModeLabel`), then **Tools** / **Details** / **Open in Design**. Second row: **session** strip (status pill + deduped session meta + evidence / coverage). Scenario headline is **`activeScenario.name` -> `lastRun.scenarioName` -> vector-bucket label** (no Verify-only invented names). **Run** text is mode-specific (observe vs compare) via `buildVerifySessionViewModel.runLabel`.
- **Compare path visibility**: saved checks no longer disappear behind **Tools** when other utilities are present. **Observe only** and **Compare checks** stay visible as the next-run choice, while **Tools** is reserved for secondary actions like **Open checks** / **Save observed outputs**.
- **Run proof / pass hero** (`VerifySurface.tsx`): on **checks pass**, the hero uses student-facing **What this means** copy (pass/fail reflects the Verify run, not Design edits you have not re-run). When **`incomplete-mapping`**, the primary CTA is **Open Project — Map Pins**; when mapping is complete, **Continue to Hardware** and **Open Export** are first-class. Failure drawer diagnosis is titled **What to fix first** (not “Issues found”).
- **Mapping preflight (no run yet)**: if pin mapping is incomplete, **`ide-verify-primary-status`** in the command bar offers **Open Project — Map Pins** and optional **View on Hardware (same mapping)**; the old thin pre-run strip banner was removed in favor of this callout.
- **Lab grid**: Wider **column gap**; **waveform** region gets a stronger **instrument frame** (border, depth shadow); **scenario library** header uses **taller** switcher + **CRUD** buttons; **stimulus tick** **is-selected** state is higher-contrast on Verify; **lab sequencer** meta chips are larger and bordered.
- **Build testbench ownership**: `ScenarioBuilderPanel` now frames the left authoring zone as **Build testbench** and carries a compact summary of driven inputs, checked outputs, case/tick count, clock activity, and whether Compare checks are armed. The primary editor is one unified grid: input stimulus above, expected outputs below, with advanced generators behind one disclosure instead of nested student-facing drawers.
- **Clock / timing testbench panel**: Sequential Verify keeps a visible clock/timing banner inside the stimulus workbench, but board-backed clocks such as `CLK100MHZ` / `W5` are now **auto-run by default**. The panel shows detected clock identity, mode, run length, edge, and reset behavior. Manual pulses and custom patterns remain available as explicit overrides for switch/button-clocked designs, and only those manual/custom modes keep the clock lane primary in the grid.
- **Auto-clock runtime policy**: `projectRuntime.ts` materializes board-clock cycles before deterministic verify executes, so sequential runs keep one authority chain: authored data inputs, explicit clock policy, deterministic runtime vectors, report, then waveform. Auto board clock runs do not require authored `CLK100MHZ` pulse rows.
- **Verify evidence freshness**: `projectRuntime.ts::runVerification()` records the same normalized current-project hash that `buildCurrentVerifyProjectHash()` derives for workflow authority. The signature covers circuit, project vectors, custom vectors, and project I/O mapping while ignoring vector UI IDs, so helper-generated clock rows settle to current evidence after the run instead of immediately going stale.
- **Specific stale reasons**: Verify no longer falls back to a generic rerun prompt when the authority already knows the drift source. The student-facing stale states distinguish **Design changed - rerun Compare**, **Testbench changed - rerun Compare**, and mapping-driven downstream review.

---

## 2. Runtime Authorities

| Authority | File | Responsibility |
|-----------|------|----------------|
| `projectRuntime.ts` | `packages/rb-apps/src/apps/ide/projectRuntime.ts` | Runtime-authoritative design state, deterministic verification, and IO-backed project authority |
| `circuitStore.ts` | `packages/rb-apps/src/stores/circuitStore.ts` | Circuit graph mutations |
| `unifiedProjectStore.ts` | `packages/rb-lab-engine/src/stores/unifiedProjectStore.ts` | Single source of truth for RBProject |
| `projectHealth.ts` | `packages/rb-apps/src/apps/ide/projectHealth.ts` | Derives structural blocking issues from core state; stale export state is advisory, not a blocking issue |
| `projectWorkflowAuthority.ts` | `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts` | Canonical product-truth snapshot for verify state, draft-vs-trusted export state, strict stage completion, primary CTA, and Hardware/Export handoff labels |
| `simEngine.ts` | `packages/rb-apps/src/apps/ide/sim/simEngine.ts` | Simulation advancement, trace accumulation |
| `componentSupportRegistry.ts` | `packages/rb-logic-core/src/analysis/componentSupportRegistry.ts` | Canonical component support matrix for Design authoring, Verify mode support, VHDL export support, Import HDL aliases, classroom availability, and sequential metadata |

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
| Are pins mapped? | Covered by `readiness.hasIoMapping` and Map Pins / Hardware mapping rows. |
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

1. ImportSurface → user uploads ZIP
2. `zipImport.ts::importVivadoZipFile()` → extracts HDL + XDC → `ZipImportInspection` (companion RTL → `project.hdl.sources`; `tb_*` listed only)
3. `zipImport.ts::buildImportedProject()` → calls `parsedHdlToCircuit()` → `RBProject`
4. User clicks Apply → `onImportProject?.(project)` → IDE loads project
5. Design surface renders nodes + connections

Gate: `scripts/gates/ide-zip-import-contract.mjs`

---

### Path 2: Verify Run Produces Deterministic Evidence

1. Design surface runs simulation (30+ ticks)
2. VerifySurface → user generates vectors → clicks Run
3. `projectRuntime.ts::runVerification()` builds IO mapping from runtime `projectIoRows`
4. `projectRuntime.ts::runVerification()` → calls `buildDeterministicVerifyContext(circuit, ioMapping)`
5. `projectRuntime.ts::runVerification()` → calls `runDeterministicVerifyFromModel(circuit, simModel, ioRows, vectors, scheduleContract)`
6. Returns `RuntimeVerifyRun` with `report`, `waveform`, and deterministic evidence capsule
5. VerifySurface renders waveform + PASS/FAIL status
6. On a failed selected case, Verify builds a compact `VerifyDebugContext`; opening Design preserves the failed signal label, expected/observed bits, tick, input snapshot, and next-inspection hint.

Freshness authority: the verify ledger `projectHash` is produced by `buildCurrentVerifyProjectHash()` so workflow status, Hardware, and Export compare against the same normalized state. A stimulus change after a pass stales Verify as testbench/state drift; a circuit or mapping change stales it as project drift.

Gate: `scripts/gates/ide-verify-reality-contract.mjs`

---

### Path 3: Export → Vivado Pack

1. Project must have: IO mapping complete + current Compare PASS with saved checks for a trusted export. Structurally buildable but unverified packages are labeled draft/debug, not trusted handoff.
2. ExportSurface → `buildEvidenceDiagnostics()` → no errors
3. User clicks "Download Vivado Pack" → `onExportBundle()` → ZIP with top.vhd + top.xdc + BRINGUP.md
4. **Handoff copy:** Project “Export readiness” and the command strip distinguish **no bundle yet** vs **stale bundle** (via `hasSuccessfulExportBundle` / `exportPackageCurrent`); stale Verify wording is explicit about **design, testbench, or mapping** drift and routes back to **Open Verify**; the Export “Open in Vivado” block (`ide-export-vivado-zip-contents`) names **top.vhd / top.xdc / .xpr / tcl + README** and that synthesis or bitstream still run in Vivado locally.
5. Export mapping rows and debug reports render Basys3 board labels before package pins (for example `SW0 (pin V17)`) while XDC generation still consumes the resolved package pin.

Gate: `scripts/gates/ide-export-generates-hdl.mjs`
Gate: `scripts/gates/ide-export-ready-contract.mjs` (opens **Readiness gates** `<details>`; artifact list uses `ide-export-artifact-preview`)

**Blocker truth:** Project / Hardware / Export consume `ProjectWorkflowAuthority`. Verify must be current and passing before Hardware/Export present a trusted build/program handoff. **No bundle yet** is **READY TO BUILD** only after design, mapping, and Verify proof are satisfied; unverified buildable packages remain draft. **Blocked** is reserved for real prerequisite failures (mapping gap, design/export diagnostics, blocked export attempt).

---

### Path 4: Hardware Checklist

1. Hardware surface receives `health` + `mappingRows` + `vectorsCount`
2. Derives: `hasClockMapping`, `hasResetMapping`, `hasOutputMapping`
3. Checklist rows show Ready/Missing per check
4. **Board planner truth:** planner-visible Basys3 resources come from the shared board catalog in `basys3Pins.ts`; selected-resource details show alias, package pin, category, mapped signal, availability/conflict state, and an XDC binding preview derived from the same mapping authority Export uses.
5. **Student truth (Vivado / board):** RedByte’s **export** is a **Vivado project ZIP** (HDL, constraints, `xpr`, etc.); the **.bit** is produced in **Vivado** (synth/impl, **Generate Bitstream**), then **Hardware Manager → Program Device**. Hardware copy (`HardwareSurface` map/proof stages, program handoff, `ide-hardware-submission-hint`) is explicit about that boundary — **not** a bitstream in the ZIP from RedByte.

Gate: `scripts/gates/ide-bringup-contract.mjs`

**Blocker truth:** Hardware routes missing/stale bundles to Build/Rebuild in Export only after current Verify proof exists. Otherwise Hardware routes to Verify without calling the structurally buildable export state `BLOCKED`.

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
| `ide-export-generates-hdl.mjs` | Export produces VHDL with entity/architecture |
| `ide-export-ready-contract.mjs` | Export shows correct blocked/ready state |
| `ide-layout-contract.mjs` | Shell layout elements and resize handles present |
| `ide-persistence-contract.mjs` | Project state survives page reload |
| `ide-project-readiness-contract.mjs` | Project surface readiness checklist renders |
| `ide-shell-chrome-contract.mjs` | Top bar, rail, status bar within height limits |
| `ide-shell-density-contract.mjs` | Shell passes density assertions at 1280px |
| `ide-verify-contract.mjs` | Verify flow works end-to-end |
| `ide-verify-reality-contract.mjs` | Trace produces ≥8 ticks with correct signals |
| `ide-verify-no-trace-guard-contract.mjs` | hasNoTrace guard works correctly |
| `ide-zip-import-contract.mjs` | ZIP import produces project with ioRows |
| `ide-professor-import-reality-contract.mjs` | Realistic nested Vivado ZIP imports correctly (planned) |
| `ide-zoom-presets-contract.mjs` | Zoom preset buttons change canvas zoom |
