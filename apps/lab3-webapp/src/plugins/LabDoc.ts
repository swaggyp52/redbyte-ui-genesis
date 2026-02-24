/**
 * LabDoc: The complete document schema for a lab session
 * Used for persistence, snapshots, and undo/redo
 */

export interface LabDocMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  studentName?: string;
}

export interface LabDocMetaV2 extends LabDocMeta {
  useProByDefault?: boolean; // Whether to open Circuit Designer (Pro) by default
}

export interface TruthTableRow {
  b3: number;
  b2: number;
  b1: number;
  b0: number;
  seg: [number, number, number, number, number, number, number]; // seg[0-6] for 7-segment display
  isDontCare: boolean;
}

/**
 * Circuit Designer node (world coordinates, stable)
 */
export interface CircuitNode {
  id: string;
  type: 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | 'BUF' | 'INPUT' | 'OUTPUT' | 'CONST_0' | 'CONST_1';
  x: number;
  y: number;
  rotation?: number; // 0, 90, 180, 270
  config?: {
    label?: string;
    value?: boolean; // For INPUT nodes
    inputCount?: number; // For AND/OR/XOR gates with variable inputs
    [key: string]: unknown;
  };
}

/**
 * Circuit Designer wire (optional routing points for custom paths)
 */
export interface CircuitWire {
  id: string;
  from: { nodeId: string; port: number }; // port 0 = output, 1+ = inputs
  to: { nodeId: string; port: number };
  points?: Array<{ x: number; y: number }>; // Optional custom routing points
}

/**
 * Circuit Designer viewport state (UI-only, optional)
 */
export interface CircuitViewport {
  panX: number;
  panY: number;
  zoom: number;
}

/**
 * Circuit Designer metadata
 */
export interface CircuitMetadata {
  createdAt: string;
  updatedAt: string;
  toolVersion: string;
}

/**
 * Full Circuit Designer state (persisted in LabDoc v2)
 */
export interface CircuitDesignerDoc {
  nodes: CircuitNode[];
  wires: CircuitWire[];
  view?: CircuitViewport;
  selection?: {
    selectedNodeIds?: string[];
    selectedWireIds?: string[];
  } | null;
  metadata?: CircuitMetadata;
}

/**
 * LabDoc v1 (original schema)
 */
export interface LabDocV1 {
  schemaVersion: 1;
  meta: LabDocMeta;
  truthTable: TruthTableRow[];
  kMaps: Record<string, unknown>; // KMap data indexed by segment name
  expressions: Record<string, string>; // Boolean expressions indexed by segment name
  results: Record<string, unknown>; // Simulation/validation results
}

/**
 * LabDoc v2 (schema bump with circuitDesigner)
 */
export interface LabDocV2 {
  schemaVersion: 2;
  meta: LabDocMetaV2;
  truthTable: TruthTableRow[];
  kMaps: Record<string, unknown>;
  expressions: Record<string, string>;
  results: Record<string, unknown>;
  circuitDesigner: CircuitDesignerDoc; // NEW in v2
}

/**
 * Union type for LabDoc (v1 or v2)
 */
export type LabDoc = LabDocV1 | LabDocV2;
