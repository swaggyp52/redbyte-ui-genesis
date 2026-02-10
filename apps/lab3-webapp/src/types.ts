export interface TruthTableRow {
  b3: 0 | 1;
  b2: 0 | 1;
  b1: 0 | 1;
  b0: 0 | 1;
  seg: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1]; // [a, b, c, d, e, f, g]
  isDontCare: boolean;
}

export interface ValidationResult {
  input: number;
  expected: number;
  actual: number;
  pass: boolean;
  expectedSeg?: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
  actualSeg?: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
  mismatchSegments?: string[];
}

export interface KMapGroup {
  segmentName: string;
  cellsAsBinary: string[]; // ['0000', '0001', ...] for Gray code matching
  simplifiedExpr: string; // e.g., "B3·B2 + B1'·B0"
}

export interface KMapState {
  [segmentName: string]: {
    grid: (0 | 1 | 'X')[]; // 16 cells (flattened 4x4) in Gray code order
    groups: KMapGroup[];
    simplifiedExpr: string;
    minTerms: number[]; // Indices where value=1
  };
}

export interface WaveformSample {
  time: number; // Simulation step
  inputs: [0 | 1, 0 | 1, 0 | 1, 0 | 1]; // B3, B2, B1, B0
  outputs: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1]; // seg_a..g
}

export interface Lab3State {
  truthTable: TruthTableRow[];
  implMode: 'table' | 'verilogCase' | 'boolExpr';
  verilogCode: string;
  booleanExpressions: { [segmentName: string]: string };
  kMaps: KMapState;
  simulationInput: number;
  validationResults: ValidationResult[];
  // Step-through simulation
  simulationMode: 'manual' | 'step'; // manual = instant, step = animated
  currentStep: number;
  waveformHistory: WaveformSample[];
  // Live validation
  validationErrors: { [segmentName: string]: string[] }; // Track which expressions don't match truth table
}

// Canonical digit patterns (active-low: 0 = lit, 1 = off)
export const DIGIT_PATTERNS: { [key: number]: TruthTableRow['seg'] } = {
  0: [0, 0, 0, 0, 0, 0, 1], // a,b,c,d,e,f,g
  1: [1, 0, 0, 1, 1, 1, 1],
  2: [0, 0, 1, 0, 0, 1, 0],
  3: [0, 0, 0, 0, 1, 1, 0],
  4: [1, 0, 0, 1, 1, 0, 0],
  5: [0, 1, 0, 0, 1, 0, 0],
  6: [0, 1, 0, 0, 0, 0, 0],
  7: [0, 0, 0, 1, 1, 1, 1],
  8: [0, 0, 0, 0, 0, 0, 0],
  9: [0, 0, 0, 0, 1, 0, 0],
};

export function createEmptyTruthTable(): TruthTableRow[] {
  const table: TruthTableRow[] = [];
  for (let i = 0; i < 16; i++) {
    const b3 = (i >> 3) & 1 ? 1 : 0;
    const b2 = (i >> 2) & 1 ? 1 : 0;
    const b1 = (i >> 1) & 1 ? 1 : 0;
    const b0 = i & 1 ? 1 : 0;
    table.push({
      b3: b3 as 0 | 1,
      b2: b2 as 0 | 1,
      b1: b1 as 0 | 1,
      b0: b0 as 0 | 1,
      seg: [1, 1, 1, 1, 1, 1, 1],
      isDontCare: i >= 10,
    });
  }
  return table;
}

export function inputToNumber(row: TruthTableRow): number {
  return (row.b3 << 3) | (row.b2 << 2) | (row.b1 << 1) | row.b0;
}

export function segToNumber(seg: TruthTableRow['seg']): number {
  return (seg[6] << 6) | (seg[5] << 5) | (seg[4] << 4) | (seg[3] << 3) | (seg[2] << 2) | (seg[1] << 1) | seg[0];
}
