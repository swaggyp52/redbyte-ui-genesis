/**
 * LabDoc: The complete document schema for a lab session
 * Used for persistence, snapshots, and undo/redo
 */

export interface LabDocMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TruthTableRow {
  b3: number;
  b2: number;
  b1: number;
  b0: number;
  seg: [number, number, number, number, number, number, number]; // seg[0-6] for 7-segment display
  isDontCare: boolean;
}

export interface LabDoc {
  schemaVersion: 1;
  meta: LabDocMeta;
  truthTable: TruthTableRow[];
  kMaps: Record<string, unknown>; // KMap data indexed by segment name
  expressions: Record<string, string>; // Boolean expressions indexed by segment name
  results: Record<string, unknown>; // Simulation/validation results
}
