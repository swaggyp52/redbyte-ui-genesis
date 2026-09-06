# RedByte Workbench Reconstruction — Architecture Map (recon 2026-09-01)

> Result of a 10-agent parallel recon (~1.5M tokens) before the workbench-core
> reconstruction. Purpose: stop every future session re-discovering that the
> shell, stores, and most surface parts ALREADY EXIST. Canonical repo docs and
> live code still win. Verify a named symbol still exists before relying on it.

## Decisive finding: build LESS than the directive assumes

The persistent desktop workbench shell, the single store, and most surface
building blocks already exist. The reconstruction is **re-composition + a few
new instruments**, NOT building a shell/stores from scratch. Live-verified:
`.ide-root` fills 100dvh, body/html do not scroll, scrolling is pane-scoped.
The "crammed / nothing fits" complaint is **surface density** (pill-soup,
dark-hex slabs, card walls), not the frame.

## Canonical authorities — DO NOT duplicate

| Concern | Authority | File |
|---|---|---|
| ALL project data | `useProjectRuntime` (zustand, persist `rb.ide.project-runtime.v1`, ~5433 lines) exposed as `window.__RB_PROJECT_RUNTIME__` | `apps/ide/projectRuntime.ts` |
| Connection-endpoint identity | `PortRef {nodeId, portName}`; `normalizePortRef` funnels legacy shapes | `rb-logic-core/src/types.ts`; `export/projectFormat.ts:605` |
| Runtime signals | string key `${nodeId}.${portName}` (dot) | `rb-logic-core/src/CircuitEngine.ts` |
| Vector nets | `BusDeclaration`/`BusBitRef`, label `Base[N]` | `rb-logic-core/src/bus.ts` |
| Source/filesets | `ProjectSourceModel` (the one writable source authority) | `apps/ide/projectSourceModel.ts` |
| Board mapping | `hardwareMappingV2` (+ derived `projectIoRows`) | `export/projectFormat.ts` |
| HDL/XDC names | `toSignalName`/`xdcRef`/`signalRef` = `sanitizeIdentifier(label)` | `fpga/boards/basys3/basys3ExportModel.ts` |
| Run report + evidence | `VerifyReport`, `VerifyEvidenceCapsule` (`normalizationMap`, `ioRows`) | `apps/ide/verifyReport.ts` |
| **field↔run-signal identity** | **`buildFieldSignalResolver` (NEW, this program) — consumes evidence, rejects ambiguity** | `apps/ide/signalIdentity.ts` |
| Pane/dock geometry (UI-only) | `workspacePreferences` (persist `rb.ide.workspace.preferences.v1`) | `apps/ide/workspacePreferences.ts` |
| Which surface is mounted | `IdeApp.currentMode` (+ `hierarchy.activeModuleId`) | `apps/IdeApp.tsx` |
| Back/Forward/Up history | `engineeringLocation` (projection over `{mode,moduleId}`) | `apps/ide/engineeringLocation.ts` |
| Workspace stages | `STUDENT_WORKFLOW_STAGES` | `apps/ide/workflowStages.ts` |

`useCircuitStore` is a **downstream Design-canvas editor cache**, fed one-way from
`projectRuntime.circuit` and written back via `applyCircuitMutation` — NOT a rival
circuit authority. Everything under `stores/*` except the circuit engine is OS-era
legacy (hardwareStore, runRecorderStore, layoutStore[except splitRatio], etc.) —
do not revive as authorities.

## The shell EXISTS — reuse `IdeWorkbenchShell`

`IdeWorkbenchShell.tsx` already owns the pane grid (left dock / workspace / right
dock / bottom console) with pointer + keyboard splitters, collapse/hide/show,
responsive wide/standard/compact modes, and the `data-*-dock-state` attributes.
Surfaces are `React.lazy`, mounted one at a time; `useProjectRuntime` keeps state
across unmount. `rb-windowing` is a DEAD stub; `rb-viewport` is an in-canvas
camera primitive (reuse `transforms.ts` for the schematic viewport only).

**Genuine shell gaps to build:** (1) a general multi-document tab/editor-group
model (only Simulate-scoped `TestbenchDocumentTabs` exists — generalize its
role=tablist pattern); (2) global engineering-object **selection** authority for
cross-probe (not yet a first-class owner); (3) nested splitters / stacked panels
in one dock edge; (4) floating/rearrangeable tool windows (optional).

## Surface-by-surface reality

- **Project** (`ProjectSurface.tsx`, 1820 lines; `LoadedProjectOverview` = 60-prop
  component): explorer rail ALREADY exists (Design Sources / Reusable Components /
  Simulation Sources / Constraints / Recovery). `ProjectSourceFiles`,
  `CrossProbePanel`, `ProjectCircuitPreview`, Technical-details `<dl>` are ready
  center-document candidates. Work = convert explorer entries from "navigate to
  surface" to "open document in center"; drop the permanent cross-probe pill
  legend (Exact/Partial/Ambiguous/Stale/Unavailable) onto the row; drop the
  "Next: Simulate" narration card. All data is derived read-models over the one
  store — no new authority.
- **Design schematic** (`rb-logic-view/LogicCanvas.tsx` + `WireView.tsx`): has
  known baseline tsc errors. Needs real logic symbols, orthogonal routing,
  junctions, hierarchy/bus visibility, property-grid inspector, semantic zoom.
  `rb-viewport/transforms.ts` reusable for the camera.
- **Case Lab** (`surfaces/verify/CaseLab.tsx`, NEW): truth-table instrument, now
  resolves observed/verdict via `signalIdentity.ts`. Still depends on the
  collapsed `ScenarioBuilderPanel` disclosure for add/duplicate/delete/sweep
  authoring parity (~23 verifySurface tests bound to it). Complete parity, then
  retire `ScenarioComposerWorkbench` (combinational) + the disclosure.
- **Timing Lab**: does not exist. Build for Register1 / 2-bit Counter. Sequential
  currently uses `ScenarioComposerWorkbench`.
- **Waveform**: rendered inline in `VerifySurface.tsx` inside the fragile verify
  grid. The dark-slab/black-void is hardcoded hex (`#080e16 #0a0f18 #0d151f
  #070d15`) instead of the sanctioned tokens `--rb-canvas-dark` /
  `--rb-canvas-dark-panel` / `--rb-canvas-grid` (`product-system-v3.css`). Build
  an ISOLATED frame with a stable root class OUTSIDE the `.ide-verify-region--
  waveform` / `.ide-verify-lab-grid` namespace so none of the 229 lab-grid rules,
  ~150 workflow-phase conditionals, or import-order ties can reach it. Reuse only
  the `SignalSource` TYPE from `rb-instruments` (its `InstrumentDock` React UI is
  DEAD — mounted only in one test).

## The verify CSS maze (do not keep patching it)

Three layers fight over `.ide-verify-lab-grid` / `.ide-verify-region--*`:
`ide-root.css` (OS-era 36k-line monolith, 3751 `!important`, flex-vs-grid dual
paradigm), `ide-polish-pass.css` (85 grid rules, 47 post-run+split compounds),
`simulation-studio-v3.css` (current authority, wins by import order). Conditioned
on `data-verify-workflow-phase × data-workspace-mode × data-studio-mode ×
data-stimulus-layout`. New instrument frames must live OUTSIDE this namespace and
draw from `product-system-v3.css` tokens. `unified-workbench-v3.css` (tokenized,
no `!important`) is the model to emulate.

## Program status at this map's writing

Committed on `claude/redbyte-operational-workbench-convergence-w9k2r4` (local,
unpushed): Case Lab instrument; `signalIdentity.ts` field↔signal resolver +
Case Lab wired to it. Safety tag
`safety/redbyte-before-workbench-core-reconstruction-e5388fd05`. verifySurface
holds its 24-failure inherited baseline; zero net product tsc errors.
