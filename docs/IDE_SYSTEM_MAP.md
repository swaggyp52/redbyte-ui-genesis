# RedByte IDE System Map

> Living reference for the IDE codebase. Update when surfaces, authorities, or gates change.

---

## 1. Surfaces and Responsibilities

| Surface | File | Responsibility |
|---------|------|----------------|
| Project | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | Project identity, I/O mapping, readiness dashboard |
| Design | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` | Circuit canvas editing + live simulation |
| Verify | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | Deterministic verification, waveform viewer |
| Export | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | Vivado bundle generation, evidence capsule |
| Hardware | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | Bring-up checklist, mapping summary; **Map Pins `mappingReady`** treats **no required output rows** as outputs satisfied (N/A), so the dock matches Project/Export when the boundary is inputs-only |
| Import | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | Vivado ZIP / HDL+XDC import pipeline |

### Design chrome (layout system)

- **Workbench header**: `ide-design-workspace-header` is the top owner. It carries the `Design` label, mode headline (Canvas / Code / Split / replay-linked variants), and the existing primary / secondary CTAs. The old standalone Design command strip does not exist anymore.
- **Control bar**: one tools row plus compact status ownership. The expanded tool cluster (`ide-design-toolbar-expanded`) is an anchored popup, not a stacked band. Verify-linked sessions still surface `Verify focus …` via `data-testid="ide-design-verify-focus"` in the simulation strip when that story is active.
- **Workbench**: support rails are narrower, and code / split default both rails to collapsed overlay handles so the workspace keeps its full width. The left palette order is `Logic -> Sequential -> IO -> Reusable -> Board`; `Board` and `Quick Inputs` start collapsed. The idle inspector falls back to the small `Canvas ready` state.

### Hardware chrome (layout system)

- **Stage rail**: Caption + four-column **stage tabs** (Map Pins → Test on Board → Pre-flight → Simulation) with title + hint + status; **board workspace** frame below with chrome header (`Stage N · …`) and Basys3 / timing pills.
- **Dock / inspector**: Left dock panels use **stage-colored left borders**; hardware inspector tables are **not** opacity-dimmed so live state and assertions stay legible.

### Verify chrome (layout system)

- **Command deck** (`VerifyCommandBar.tsx`, `ide-root.css`): **Two rows** — primary: **Run** / **Generate**, **Stimulus** / **Assertions** procedure lens, **Experiment** block (`data-testid="ide-vcb-experiment-context"`: scenario headline, **Case tN** vs **No case selected**, timing / lab mode line from `sequencerModeLabel`), then **More actions** / **Analysis** / **Open in Design**. Second row: **session** strip (status pill + session meta + evidence / coverage). Scenario headline is **`activeScenario.name` → `lastRun.scenarioName` → vector-bucket label** (no Verify-only invented names).
- **Compare path visibility**: when saved checks are available but the **Tools** menu is not shown, **`Use saved checks` / `ide-vcb-use-saved-checks`** appears inline in the command row (next to **Run**) so students are not forced to discover compare behind **Tools** — see `ide-vcb-run-plan-inline`.
- **Run proof / pass hero** (`VerifySurface.tsx`): on **checks pass**, the hero uses student-facing **What this means** copy (pass/fail reflects the Verify run, not Design edits you have not re-run). When **`incomplete-mapping`**, the primary CTA is **Open Project — Map Pins**; when mapping is complete, **Continue to Hardware** and **Open Export** are first-class. Failure drawer diagnosis is titled **What to fix first** (not “Issues found”).
- **Mapping preflight (no run yet)**: if pin mapping is incomplete, **`ide-verify-primary-status`** in the command bar offers **Open Project — Map Pins** and optional **View on Hardware (same mapping)**; the old thin pre-run strip banner was removed in favor of this callout.
- **Lab grid**: Wider **column gap**; **waveform** region gets a stronger **instrument frame** (border, depth shadow); **scenario library** header uses **taller** switcher + **CRUD** buttons; **stimulus tick** **is-selected** state is higher-contrast on Verify; **lab sequencer** meta chips are larger and bordered.

---

## 2. Runtime Authorities

| Authority | File | Responsibility |
|-----------|------|----------------|
| `projectRuntime.ts` | `packages/rb-apps/src/apps/ide/projectRuntime.ts` | Runtime-authoritative design state, deterministic verification, and IO-backed project authority |
| `circuitStore.ts` | `packages/rb-apps/src/stores/circuitStore.ts` | Circuit graph mutations |
| `unifiedProjectStore.ts` | `packages/rb-lab-engine/src/stores/unifiedProjectStore.ts` | Single source of truth for RBProject |
| `projectHealth.ts` | `packages/rb-apps/src/apps/ide/projectHealth.ts` | Derives blocking issues from core state |
| `simEngine.ts` | `packages/rb-apps/src/apps/ide/sim/simEngine.ts` | Simulation advancement, trace accumulation |

---

## 3. Lab-Critical Paths

### Path 1: Professor ZIP Import → Design Shows Circuit

1. ImportSurface → user uploads ZIP
2. `zipImport.ts::importVivadoZipFile()` → extracts HDL + XDC → `ZipImportInspection`
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

Gate: `scripts/gates/ide-verify-reality-contract.mjs`

---

### Path 3: Export → Vivado Pack

1. Project must have: IO mapping complete + verify PASS
2. ExportSurface → `buildEvidenceDiagnostics()` → no errors
3. User clicks "Download Vivado Pack" → `onExportBundle()` → ZIP with top.vhd + top.xdc + BRINGUP.md

Gate: `scripts/gates/ide-export-generates-hdl.mjs`

---

### Path 4: Hardware Checklist

1. Hardware surface receives `health` + `mappingRows` + `vectorsCount`
2. Derives: `hasClockMapping`, `hasResetMapping`, `hasOutputMapping`
3. Checklist rows show Ready/Missing per check

Gate: `scripts/gates/ide-bringup-contract.mjs`

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
