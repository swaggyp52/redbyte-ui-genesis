# Agent: ProjectSurface — Student Lab Workflow Hub

## Domain

The ProjectSurface is the orchestration hub of the RedByte IDE. It is the first and last surface a student sees during a guided lab assignment. Its job is to communicate *where* the student is in the four-stage workflow (Design → Verify → Export → Hardware), surface the single most important next action through a "Flightdeck" spotlight panel, display project-context metadata, and provide a readiness summary that gates forward progress. It also handles student identity capture (name input) and the final submission export used by instructors. The surface owns no editing capability itself — it delegates to the other four surfaces — and instead acts as a status dashboard that drives the whole lab progression.

---

## Key Files

| Role | Path |
|---|---|
| Surface component (presentational) | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` |
| Runtime store (Zustand, persisted) | `packages/rb-apps/src/apps/ide/projectRuntime.ts` |
| Lab schema types | `packages/rb-utils/src/labProjectSchema.ts` |
| Project health derivation | `packages/rb-apps/src/apps/ide/projectHealth.ts` |
| Project file format | `packages/rb-apps/src/export/projectFormat.ts` |
| IDE shell (wires everything together) | `packages/rb-apps/src/apps/IdeApp.tsx` |
| Examples catalog | `packages/rb-apps/src/apps/ide/examplesCatalog.ts` |
| Surface CSS | `packages/rb-apps/src/apps/ide/ide-root.css` |

---

## Architecture Notes

### 4-Stage Workflow: Design → Verify → Export → Hardware

The four stages are tracked as a linear progression gated by readiness flags:

1. **Design** — The student builds or imports a circuit. Readiness flag: `readiness.hasCircuit`. Navigates via `onOpenDesign()`.
2. **Verify** — The student runs test vectors. Readiness flag: `readiness.hasVectors` and `verifyPass` (derived from `health.lastVerify?.status === 'pass' && !health.dirtySinceVerify`). Navigates via `onOpenVerify()`.
3. **Export** — Generates the Vivado bundle (XDC + VHDL). Readiness flag: `exportReady` (requires circuit, mapping, vectors, and a clean verify pass). Navigates via `onOpenExport()`.
4. **Hardware** — Flashes the board. Readiness flag: `hardwareReady` (export complete and `!health.dirtySinceExport`). Navigates via `onOpenHardware()`.

The `heroStatusMessage` computed value encodes the exact step-by-step gate message rendered in the spotlight panel, derived from the same flags in order.

### How `useProjectRuntime` Provides State to ProjectSurface

`useProjectRuntime` is a Zustand store (persisted to `localStorage` under key `rb.ide.project-runtime.v1`) defined in `projectRuntime.ts`. The IDE shell (`IdeApp.tsx`) calls this hook and destructures its state, then passes it as flat props into `<ProjectSurface>`. Key state fields consumed by ProjectSurface:

```ts
const {
  projectName, projectDescription, lastSavedAt,
  activeExampleId, projectIoRows,
  verifyLastRun, projectHealthCore,
  sim,
  loadExample, setMappingPin, autoSuggestMapping,
} = useProjectRuntime();
```

`ProjectHealth` is derived in `IdeApp.tsx` via `deriveProjectHealth(projectHealthCore, readiness)` and passed to ProjectSurface as the `health` prop. The surface never calls the store directly — it is a pure presentational component driven entirely by its props.

### How Examples/Starters Load Into the Circuit

Examples are defined in `examplesCatalog.ts` as `IdeExampleDefinition[]`. They carry a complete `circuit`, `ioRows`, `vectors`, and default pin assignments. When the student selects an example on the ProjectSurface (via `onOpenExample(exampleId)`), `IdeApp.tsx` calls `useProjectRuntime().loadExample(exampleId)` which replaces the entire runtime state from the example data (circuit, IO rows, vectors, mapping). The currently active example is tracked in `activeExampleId` on the runtime store, and echoed into `ProjectSurface` as the `activeExampleId` prop so the button card renders an `.is-active` highlight.

### Submission Flow (Student Identity + Export)

The submission flow was added in PR15. It works as follows:

1. The student types their name into a text input bound to `studentName` / `onStudentNameChange`. The name is stored transiently in `IdeApp.tsx` state and written into `RBProject.meta.studentName` on export.
2. After at least one verify run (`hasVerifyRun === true`), the "Export Submission" button is shown and enabled.
3. Clicking it fires `onExportSubmission()`, which in `IdeApp.tsx` calls `generateIdeSubmissionBundle(...)` and triggers a `.zip` download. While the export is processing, `submissionExportPending` is `true` and the button shows a spinner.
4. `submissionPreview` is a derived object that summarises the most recent verify run for display in the submission panel: `{ lastStatus, passes, fails, overallGateVerdict, assignmentId, labCode }`.
5. `overallGateVerdict` comes from `validateSubmissionForLab(...)` in `packages/rb-apps/src/labs/submissionGates.ts`.

### Flightdeck: Next-Action Spotlight, Project-Context Panel, Readiness Summary

The Flightdeck is the three-panel layout at the top of ProjectSurface:

- **Next-action spotlight** — Renders `nextActionTitle` and `nextActionSummary`, both derived from `primaryCta` (a `ProjectPrimaryCta` chosen by `choosePrimaryProjectCta()` in `projectHealth.ts`). The `primaryCta.mode` field drives `handleProjectModeAction()`, which routes the user to the correct surface.
- **Project-context panel** — Shows `projectName`, `projectSummary` (either the description, the active example's summary, or a fallback), `heroStatusLabel`, and the `heroChecklistItems` list (three rows: Pins, Verify, Export, each with an `ok`/`warn` tone pill).
- **Readiness summary** — A `<IdeDataTable>` with five rows (Circuit, Mapping, Verify, Export, Hardware), each showing a `READY`/`BLOCKED` status pill and a contextual action button. Rendered from the `readinessRows` memoised array.

---

## Key Data Types

### `LabProjectV1` (canonical alias: `LabProject`)
Defined in `packages/rb-utils/src/labProjectSchema.ts`. The full serialisable project document:
```ts
interface LabProjectV1 {
  schemaVersion: '1.0';
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  circuit: CircuitV1;
  simulation: { tickRate: number; currentTick: number; probes: ProbeDefinition[]; breakpoints?: number[] };
  boardMap?: { boardProfileId: string; signalToPinMap: Record<string, string>; virtualIOState?: ... };
  ioMapping?: IoMapping;
  labSpec?: LabSpecV1;
  evidence: { actions: LabActionEnvelope[]; snapshots: EvidenceSnapshot[]; manifest?: EvidenceManifest };
  recordings?: RecordingV1[];
  fpgaArtifacts?: { verilog?: string; constraints?: string; bitstream?: ...; metadata?: ... };
}
```
Note: the runtime store uses the lighter `RBProject` format (from `projectFormat.ts`), which embeds a `labSpec?: LabSpecV1` and `meta.studentName`. `LabProjectV1` is the canonical schema for the evidence/capsule pipeline.

### `IdeExampleDefinition`
Defined in `packages/rb-apps/src/apps/ide/examplesCatalog.ts`. Represents a starter circuit:
```ts
interface IdeExampleDefinition {
  id: string;
  name: string;
  summary: string;
  course: string;
  lab: string;
  concept: string;
  tags: string[];
  expectedBehavior: string;
  ioRows: IdeExampleIoRow[];
  vectors: TestVector[];
  circuit: Circuit;
  category?: 'showcase' | 'course';
  goals?: string[];
  probes?: Array<{ nodeId: string; portName: string; label: string; color: string }>;
}
```

### `ProjectHealth` and `ProjectHealthCore`
Defined in `packages/rb-apps/src/apps/ide/projectHealth.ts`. `ProjectHealth` extends `ProjectHealthCore`:
```ts
interface ProjectHealthCore {
  lastVerify?: ProjectHealthVerifyResult;  // { status, hash, reportHash, report, failingTick, ranAtIso }
  lastExport?: ProjectHealthExportResult;  // { status, hash, manifestHash, bundleHash, artifacts, ranAtIso }
  dirtySinceVerify: boolean;
  dirtySinceExport: boolean;
}

interface ProjectHealth extends ProjectHealthCore {
  blockingIssues: ProjectHealthIssue[];   // each has { code, message, fixPath? }
}
```
Error codes: `RBP1000` = no circuit, `RBP1001` = missing IO mapping, `RBP1004` = circuit changed since verify.

### `ProjectPrimaryCta`
```ts
interface ProjectPrimaryCta {
  label: string;
  mode: ProjectHealthMode;  // 'project' | 'design' | 'verify' | 'hardware' | 'export' | 'import'
  code: string;
}
```
Chosen by `choosePrimaryProjectCta()`. Drives the next-action spotlight and the `onPrimaryCta` button.

### `ProjectRuntimeState`
The full Zustand store shape (from `projectRuntime.ts`). Key fields ProjectSurface cares about:
- `projectName`, `projectDescription`, `lastSavedAt`, `activeExampleId`
- `projectIoRows: ProjectIoRow[]` — each row has `{ id, nodeId, port, label, direction, pin, required }`
- `verifyLastRun?: RuntimeVerifyRun` — last verify run result with report and waveform
- `projectHealthCore: ProjectHealthCore`
- `sim: RuntimeSimState` — real-time simulation state (tick, signals, trace, probes)
- `actions.verify.run(input)`, `actions.sim.run()`, etc.

### `LabStageStatus` (conceptual, not a formal type)
There is no explicit `LabStageStatus` enum in the codebase. Stage readiness is represented by the combination of `ProjectReadinessState` (hasCircuit, hasIoMapping, hasVectors) plus the derived booleans `verifyPass`, `exportReady`, and `hardwareReady` in `ProjectSurface.tsx`. If you need to represent stage status, use `'ok' | 'warn' | 'idle'` tone strings as used by `IdeStatusPill`.

---

## Current State of the Surface

The surface is well-structured and stable. It was worked on collaboratively by both Codex and Claude in multiple sessions. Current known state:

- Dock stage tiles (Design / Verify / Export / Hardware progression) were added as part of pipeline work and are rendered via the `<PipelineStrip>` component in `IdeApp.tsx`, not inside `ProjectSurface.tsx` itself.
- The Flightdeck three-panel layout (spotlight, context, readiness) is in place and functional.
- Student identity and submission export (PR15) are fully wired: `studentName`, `onStudentNameChange`, `onExportSubmission`, `submissionPreview`, `submissionExportPending`, `hasVerifyRun` are all live props.
- The IO mapping table supports auto-highlight on diagnostic route requests (`diagnosticRouteRequest` prop), scrolling to and focusing the relevant pin input with a 1.2s flash animation.
- `useBoardSignal` integration is active: rows matching an active hardware board signal (SW/LD by index) receive a visual highlight and a click handler that navigates to Hardware.
- `useIoBus` is used to drive live sim signals into the mapping table display (read-only in ProjectSurface — the `setInput` callback is a no-op here).

---

## CSS Classes (`ide-project-*` prefix)

All ProjectSurface-specific CSS lives in `packages/rb-apps/src/apps/ide/ide-root.css`. Key classes:

| Class | Purpose |
|---|---|
| `.ide-project-meta` | Project identity block wrapper |
| `.ide-project-label` | Small "PROJECT" label above the name |
| `.ide-project-name` | Large project name heading |
| `.ide-project-subline` | Subtitle / description line beneath the name |
| `.ide-project-readiness` | Readiness summary table container |
| `.ide-project-actions` | Action button group in the readiness section |
| `.ide-project-map-cell.is-highlighted` | Animated yellow-flash on a mapping row (via `ide-project-map-flash` keyframe, 1.2s) |
| `.ide-project-mapping-status` | Inline status badge for the mapping section header |
| `.ide-project-mapping-status.is-complete` | Green border/bg when all required pins are mapped |
| `.ide-project-mapping-status.is-error` | Red border/bg with pulsing dot when pins are missing |
| `.ide-project-mapping-status-dot` | 6px circle indicator inside the mapping status badge |
| `.ide-project-quickstart` | Quickstart / examples panel wrapper |
| `.ide-project-quickstart-title` | "Start from an example" heading |
| `.ide-project-quickstart-sub` | Subtitle in the quickstart panel |
| `.ide-project-example-card-row` | Row of example cards |
| `.ide-project-example-btn` | Individual example card button |
| `.ide-project-example-btn.is-active` | Highlight when this example is currently loaded |
| `.ide-project-example-btn-name` | Example name text |
| `.ide-project-example-btn-concept` | Concept tag in an example card |
| `.ide-project-example-btn-summary` | Summary text in an example card |
| `.ide-project-example-flow` | Stage-flow chip strip inside an example card |
| `.ide-project-flow-chip` | Single stage chip (e.g., "Design") in the flow strip |
| `.ide-project-flow-arrow` | Arrow separator between flow chips |
| `.ide-project-quickstart-import-link` | "Import HDL" inline link in quickstart panel |
| `.ide-project-live-dot` | Small live indicator dot (sim running) |

---

## Do/Don't Rules

### Do
- Keep `ProjectSurface` purely presentational. All state reads and mutations go through `IdeApp.tsx` which calls `useProjectRuntime()` and passes derived values as props.
- Derive readiness/health values (`verifyPass`, `exportReady`, `hardwareReady`) in `IdeApp.tsx` or inside the surface's `useMemo` blocks from props — never re-derive them in child components.
- Use `IdeStatusPill` with `tone: 'ok' | 'warn' | 'idle'` for all status indicators. Never roll custom inline status indicator markup.
- Use `IdeButton` for all interactive buttons, setting `tone` and `testId` props. Test IDs follow the pattern `ide-project-<section>-<action>-<id>`.
- Keep the `heroStatusMessage` derivation as the single source of truth for what the student needs to do next. Do not duplicate this logic elsewhere.
- When adding new sections to ProjectSurface, wrap them in `<SurfacePanel>` or `<IdePanel>` from `IdePrimitives`/`SurfaceLayoutPrimitives`, not raw `<div>`.
- For new CSS, add rules to `ide-root.css` under the `ide-project-*` namespace. Keep specificity low (class-only selectors).
- When the student has no circuit, show the quickstart/examples panel prominently. Gate all other sections on `readiness.hasCircuit`.
- The `studentName` input and submission section should only appear when `onExportSubmission` prop is provided (instructor-enabled mode). Guard the block on this condition.
- Prefer `useMemo` for any value derived from two or more props. The surface has many computed values; keep them memoised to avoid re-render cascades from the Zustand store.

### Don't
- Do not import `useProjectRuntime` directly inside `ProjectSurface`. The surface must receive all data as props from `IdeApp.tsx`.
- Do not add new per-stage logic (design compiler, verify runner, export builder) to `projectRuntime.ts` without first checking if it belongs in a dedicated module (`verifyReport.ts`, `bringupArtifacts.ts`, `sim/simEngine.ts`, etc.).
- Do not mutate `health` or `readiness` objects inside the surface. They are read-only projection props.
- Do not use the `LabProjectV1` / `LabProject` schema types in the IDE runtime layer. The runtime uses the lighter `RBProject` format from `projectFormat.ts`. `LabProjectV1` is for the evidence capsule and export pipeline.
- Do not add stage navigation logic directly to `ProjectSurface`. Navigation is handled by the `onOpen*` callback props which are wired in `IdeApp.tsx` to `setCurrentMode(...)`.
- Do not hard-code Basys3 pin names inside `ProjectSurface`. Pin lists live in `packages/rb-apps/src/apps/fpga/boards/basys3/basys3Pins.ts`.
- Do not add animations to `ide-root.css` unless they are tied to a named `@keyframes` block. The existing `ide-project-map-flash` and `pipeline-pulse` keyframes should be re-used where appropriate.
- Do not introduce a `LabStageStatus` enum — use the existing `'ok' | 'warn' | 'idle'` tone vocabulary from `IdeStatusPill` for any stage status rendering.
- Do not duplicate the `submissionPreview` summary logic client-side. The `overallGateVerdict` field comes from `validateSubmissionForLab()` in `packages/rb-apps/src/labs/submissionGates.ts` — call that function, don't re-implement the gate rules in the surface.
