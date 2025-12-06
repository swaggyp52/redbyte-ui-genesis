export type LogicSignal = 0 | 1 | "X";

export type LogicNodeType =
  | "INPUT_TOGGLE"
  | "CLOCK"
  | "GATE_AND"
  | "GATE_OR"
  | "GATE_NOT"
  | "GATE_XOR"
  | "OUTPUT_LAMP";

export interface LogicNodeMeta {
  clockPeriodTicks?: number;
}

export interface LogicNode {
  id: string;
  type: LogicNodeType;
  label: string;
  x: number;
  y: number;
  inputs: number;
  outputs: number;
  meta?: LogicNodeMeta;
}

export interface LogicWire {
  id: string;
  fromNodeId: string;
  fromIndex: number;
  toNodeId: string;
  toIndex: number;
}

export interface LogicNetConnection {
  nodeId: string;
  portIndex: number;
  direction: "in" | "out";
  wireId?: string;
}

export interface LogicNet {
  id: string;
  label: string;
  description?: string;
  connections: LogicNetConnection[];
}

export interface LogicTemplate {
  id: string;
  name: string;
  description: string;
  nodes: LogicNode[];
  wires: LogicWire[];
}

export interface NodeState {
  inputs: LogicSignal[];
  outputs: LogicSignal[];
  internal?: Record<string, unknown>;
}

export type NodeStateMap = Record<string, NodeState>;

