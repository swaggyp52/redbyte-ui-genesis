/**
 * Shared types for FPGA proof artifacts
 * Browser + Node.js compatible
 */

export type HardwareTraceEvent = {
  hw_tick: number;
  mono_seq: number;
  digital: number;
  analog: number[];
  ts_wall: number;
};

export type BoardProfile = {
  board: string;
  uart_baud: number;
  digital_signals: Record<string, string>;
  analog_signals: Record<string, string>;
};

export type BundleManifestV2 = {
  schema_version: 'v2';
  redbyte_version: string;
  lab_id: string;
  lab_version: string;
  scaffold_hash: string;
  board: string;
  bin_size_ms: number;
  trace_summary: {
    events: number;
    crc_failures: number;
  };
  bitstream_present?: boolean;
};

export interface Capsule {
  session_id: string;
  lab_id?: string;
  timestamp?: string;
  vectors: VectorResult[];
  // Dual schema support: either summary or test_summary
  summary?: SummaryCardModel;
  test_summary?: SummaryCardModel;
  events_ref?: string; // External NDJSON reference
  events?: ProofEvent[]; // Inline events array
  metadata?: Record<string, unknown>;
  hash?: {
    algorithm: 'sha256';
    value: string;
  };
}

export interface VectorResult {
  id: string;
  name?: string;
  pass: boolean;
  duration_ticks?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ProofEvent {
  tick: number;
  seq?: number;
  signal: string;
  old: string | number | boolean;
  new: string | number | boolean;
  timestamp?: string;
}

export interface NormalizedEvent extends ProofEvent {
  seq: number; // Normalized: 0-indexed sequence
}

export interface SummaryCardModel {
  total: number;
  pass: number;
  fail: number;
  duration_ticks?: number;
}

export interface VectorRow {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  duration?: string;
  error?: string;
}

export interface TimelineRow {
  tick: number;
  changes: {
    signal: string;
    from: string;
    to: string;
  }[];
}

export interface DiffResult {
  verdict: 'MATCH' | 'DIVERGED' | 'INVALID';
  exitCode: 0 | 1 | 2;
  summary: string;
  firstMismatch?: {
    vectorId?: string;
    tick?: number;
    detail: string;
  };
  hashMismatch?: boolean;
  schemaMismatch?: boolean;
}

export interface VerifyResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
  exitCode: 0 | 2; // 0=ok, 2=INVALID
}

export interface GradeReport {
  verdict: 'PASS' | 'FAIL' | 'INVALID';
  exitCode: 0 | 1 | 2;
  capsuleSummary: SummaryCardModel;
  vectorDetails: VectorRow[];
  hashVerified: boolean;
  goldenDiff?: DiffResult;
  generatedAt: string;
}
