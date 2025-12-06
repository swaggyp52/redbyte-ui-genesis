# Project model

This document explains the unified project shape used across RedByte OS. The model is stored in `ProjectContext` and persisted through `ProjectSerializer`, so every app (Logic Designer, CPU Designer, 3D viewer, exporters) reads and writes the same structure.

## Top-level shape

```ts
interface ProjectState {
  meta: ProjectMetadata;
  logic: ProjectLogicModel;
  cpu: ProjectCpuModel;
  notes: string;
  history: ProjectSnapshot[];
}
```

- **meta** – identifiers and descriptive text; the `version` flag distinguishes storage formats over time.
- **logic** – gates, wires, nets, IO pins, clocks, and timing parameters that feed both the simulator and exports.
- **cpu** – composite CPU-style units and shared buses that relate back to nets and IO pins.
- **notes** – free-form user text for design context.
- **history** – lightweight snapshots used for the System Monitor charts.

## Metadata and timing

```ts
interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  version: number;
  createdAt: number;
  updatedAt: number;
}

interface LogicTimingProfile {
  baseClockHz: number;
  tickIntervalMs: number;
  propagationDelayNs: number;
}
```

## Logic model

```ts
interface ProjectLogicModel {
  template: LogicTemplate;      // nodes + wires from src/logic/LogicTypes
  nets: LogicNet[];             // named nets tying together node ports and wires
  ioPins: ProjectIOPin[];       // externalized pins mapped onto nets or nodes
  clocks: ProjectClock[];       // named clocks optionally attached to nets
  timing: LogicTimingProfile;   // default timing parameters
}
```

- **LogicTemplate** holds the graph of gates and wires.
- **LogicNet** captures connectivity across ports with optional `wireId` references for traceability.
- **ProjectIOPin** links external pins to nets or specific nodes (for UI palettes and exports).
- **ProjectClock** defines timing and, when paired with a `netId`, ties a clock source to logic.

## CPU model

```ts
type CpuModuleKind = "alu" | "register-file" | "control-unit" | "clock" | "memory" | "io";

interface CpuModule {
  id: string;
  label: string;
  kind: CpuModuleKind;
  clockHz: number;
  attachedNets?: string[];
  description?: string;
}

interface CpuBus {
  id: string;
  label: string;
  width: number;
  endpoints: string[]; // CpuModule ids
}

interface ProjectCpuModel {
  units: CpuModule[];
  buses: CpuBus[];
}
```

CPU units mirror higher-level blocks composed of the logic primitives. Units and buses reference `nets` to stay aligned with the gate-level view.

## IO pins and clocks

```ts
type ProjectIODirection = "input" | "output" | "bidirectional";

interface ProjectIOPin {
  id: string;
  label: string;
  direction: ProjectIODirection;
  width: number;
  netId?: string;
  attachedNodeId?: string;
  description?: string;
}

interface ProjectClock {
  id: string;
  label: string;
  hz: number;
  dutyCycle?: number;
  phaseDeg?: number;
  netId?: string;
}
```

## History snapshots

System Monitor consumes snapshots for simple charts. Each snapshot records counts at a point in time.

```ts
interface ProjectSnapshot {
  ts: number;
  logicNodes: number;
  logicWires: number;
  logicNets: number;
  cpuUnits: number;
  buses: number;
  ioPins: number;
  clocks: number;
}
```

## Persistence

`ProjectSerializer` handles serialization, download/upload, and localStorage persistence:

- Storage key: `redbyte-project-v2` with `meta.version` defaulting to `2`.
- `serializeProject` → pretty JSON string.
- `importProject` → parses JSON, validates metadata, and normalizes `meta.version`.
- `loadProjectFromStorage` / `saveProjectToStorage` → round-trip local storage.
- `downloadProject` → triggers a `.redproj` download for the active project.

## Where the model is used

- `src/os/context/ProjectContext.tsx` – source of truth and mutation helpers (add/remove gates, wires, nets, IO pins, clocks, CPU units, buses, timing updates).
- OS apps (LogicDesigner, CPUDesigner, World3D, LogicExports, SignalScope) read from the same `ProjectContext` and update through these helpers.
