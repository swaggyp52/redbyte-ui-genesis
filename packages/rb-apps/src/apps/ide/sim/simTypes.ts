import type { IRDiagnostic } from '@redbyte/rb-logic-core';

export interface RuntimeSimTraceSample {
  tick: number;
  signals: Record<string, 0 | 1>;
}

export interface RuntimeSignalProbe {
  key: string;
  label: string;
}

export interface RuntimeSimGuard {
  status: 'blocked';
  reason: 'invalid-ir';
  diagnostics: IRDiagnostic[];
  irHash: string;
}

export interface RuntimeSimState {
  tick: number;
  running: boolean;
  stepMode: boolean;
  lastAction?: 'run' | 'pause' | 'step' | 'input' | 'reset';
  speedHz: number;
  irHash: string;
  traceHash: string;
  inputs: Record<string, 0 | 1>;
  signals: Record<string, 0 | 1>;
  trace: RuntimeSimTraceSample[];
  selectedSignalKey: string | null;
  probes: RuntimeSignalProbe[];
  guard?: RuntimeSimGuard;
}

export interface SimulationIoRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  nodeId?: string;
}

export interface RuntimeVerifyTraceRow {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  vectorId?: string;
  caseIndex?: number;
}

export interface SimulatedExpectedIoRow {
  tick: number;
  signal: string;
  expected: '0' | '1';
}
