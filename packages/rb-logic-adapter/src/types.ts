export type ViewMode = 'circuit' | 'schematic' | 'isometric' | '3d';

export interface ViewNode {
  id: string;
  type: string;
  view: {
    x: number;
    y: number;
    z?: number;
    w: number;
    h: number;
  };
  ports: { [portName: string]: { x: number; y: number } };
}

export interface ViewWire {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  points?: Array<{ x: number; y: number }>;
}

export interface ViewState {
  nodes: ViewNode[];
  wires: ViewWire[];
}
