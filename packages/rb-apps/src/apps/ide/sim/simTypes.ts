export interface RuntimeSimTraceSample {
  tick: number;
  signals: Record<string, 0 | 1>;
}

export interface RuntimeSignalProbe {
  key: string;
  label: string;
}

export interface RuntimeSimState {
  tick: number;
  running: boolean;
  speedHz: number;
  irHash: string;
  traceHash: string;
  inputs: Record<string, 0 | 1>;
  signals: Record<string, 0 | 1>;
  trace: RuntimeSimTraceSample[];
  selectedSignalKey: string | null;
  probes: RuntimeSignalProbe[];
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
}

export interface SimulatedExpectedIoRow {
  tick: number;
  signal: string;
  expected: '0' | '1';
}
