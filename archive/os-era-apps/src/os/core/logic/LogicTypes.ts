export type GateKind =
  | 'and'
  | 'or'
  | 'not'
  | 'nand'
  | 'nor'
  | 'xor'
  | 'xnor'
  | 'custom';

export interface LogicGate {
  id: string;
  kind: GateKind;
  inputs: number[];
  outputs: number[];
}

export interface LogicWire {
  fromGate: string;
  fromPin: number;
  toGate: string;
  toPin: number;
}

export interface LogicGraph {
  gates: LogicGate[];
  wires: LogicWire[];
  values: Record<string, number[]>; // gate.id -> output array
}
