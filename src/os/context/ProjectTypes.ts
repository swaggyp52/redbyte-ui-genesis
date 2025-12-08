import { LogicNet, LogicTemplate } from "../../logic/LogicTypes";

export type CpuModuleKind =
  | "alu"
  | "register-file"
  | "control-unit"
  | "clock"
  | "memory"
  | "io";

export interface CpuModule {
  id: string;
  label: string;
  kind: CpuModuleKind;
  clockHz: number;
  description?: string;
  attachedNets?: string[];
}

export interface CpuBus {
  id: string;
  label: string;
  width: number;
  endpoints: string[];
  description?: string;
}

export type ProjectIODirection = "input" | "output" | "bidirectional";

export interface ProjectIOPin {
  id: string;
  label: string;
  direction: ProjectIODirection;
  width: number;
  netId?: string;
  attachedNodeId?: string;
  description?: string;
}

export interface ProjectClock {
  id: string;
  label: string;
  hz: number;
  dutyCycle?: number;
  phaseDeg?: number;
  netId?: string;
}

export interface LogicTimingProfile {
  baseClockHz: number;
  tickIntervalMs: number;
  propagationDelayNs: number;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  version: number;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSnapshot {
  ts: number;
  logicNodes: number;
  logicWires: number;
  logicNets: number;
  cpuUnits: number;
  buses: number;
  ioPins: number;
  clocks: number;
}

export interface ProjectSignalWatch {
  id: string;
  label: string;
  nodeId?: string;
  netId?: string;
  layer: number;
  pinnedPosition?: { x: number; y: number; z: number };
  visible: boolean;
}

export interface ProjectSignalModel {
  watches: ProjectSignalWatch[];
}

export interface ProjectLogicModel {
  template: LogicTemplate;
  nets: LogicNet[];
  ioPins: ProjectIOPin[];
  clocks: ProjectClock[];
  timing: LogicTimingProfile;
}

export interface ProjectCpuModel {
  units: CpuModule[];
  buses: CpuBus[];
}

export interface ProjectState {
  meta: ProjectMetadata;
  logic: ProjectLogicModel;
  cpu: ProjectCpuModel;
  signal: ProjectSignalModel;
  notes: string;
  history: ProjectSnapshot[];
}
