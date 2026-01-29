export type SignalKind = 'net' | 'pin' | 'node' | 'serial';

export interface SignalRef {
  id: string;
  kind: SignalKind;
  label: string;
}

export interface SignalSample {
  tick: number;
  value: number;
}

export interface SignalSource {
  listSignals: () => SignalRef[];
  resolveSignal: (signalId: string) => SignalRef | null;
  sample: (signal: SignalRef, tick: number) => number;
  getHistory: (signal: SignalRef, tickFrom: number, tickTo: number, stride: number) => SignalSample[];
  getMetadata?: (signal: SignalRef) => Record<string, unknown> | undefined;
  locate?: (signal: SignalRef) => void;
  getSerialLog?: () => string[];
  clearSerialLog?: () => void;
}

export type InstrumentId = 'net-inspector' | 'scope' | 'probe' | 'serial' | 'hardware';
