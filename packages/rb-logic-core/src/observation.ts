import type { NodeInputs, NodeOutputs, PortRef, Signal } from './types';
import type { SimulationIssue } from './CircuitEngine';

/** Schedule metadata supplied by the execution owner. It is logical time, not delay. */
export interface EvaluationContext {
  vectorId?: string;
  caseIndex?: number;
  tick?: number;
  engineTick?: number;
  phase?: string;
}

export interface EvaluationInputRead {
  portName: string;
  driver: PortRef;
  value: Signal;
  /** Driver's previously published cache value, not a reconstructed prior gate read. */
  previousValue?: Signal;
  /** How the engine obtained the value passed to this evaluation. */
  origin: 'current-evaluation' | 'previous-tick' | 'default-zero' | 'prior-state';
}

/** Detached observations of one actual behavior invocation, never a reevaluation. */
export interface EngineEvaluationObservation {
  /** Globally unique ordinal inside a collected trace; local for direct tick observers. */
  order: number;
  /** Actual invocation order inside this engine tick, across capture/settling phases. */
  evaluationOrder: number;
  evaluationPhase: 'evaluate' | 'before-capture' | 'capture' | 'after-capture';
  /** Capture results become visible together after the capture phase. */
  commitPhase: 'immediate' | 'after-capture';
  nodeId: string;
  nodeType: string;
  context: EvaluationContext;
  inputs: NodeInputs;
  inputReads: EvaluationInputRead[];
  previousOutputs: NodeOutputs;
  /** Outputs after the engine's existing NaN-to-zero publication rule. */
  outputs: NodeOutputs;
  rawOutputs: NodeOutputs;
  invalidOutputPorts: string[];
  stateBefore: Record<string, unknown>;
  /** State returned by the actual invocation; commitPhase states when it is published. */
  stateAfter: Record<string, unknown>;
}

export interface EngineTickObservationOptions {
  observe: (event: EngineEvaluationObservation) => void;
  context?: EvaluationContext;
  isEnabled?: () => boolean;
  onIssue?: (issue: SimulationIssue) => void;
  onError?: () => void;
}

export interface EvaluationTraceCaptureOptions {
  maxEvents?: number;
  maxBytes?: number;
}

export interface EvaluationTrace {
  schemaVersion: 'rb.evaluation-trace.v1';
  status: 'complete' | 'truncated' | 'unavailable';
  unavailableReason?: 'observer-error' | 'invalid-ir' | 'unsupported-temporal';
  maxEvents: number;
  maxBytes: number;
  bytes: number;
  events: EngineEvaluationObservation[];
  issues: SimulationIssue[];
}

export interface EvaluationTraceCollector {
  forContext: (context: EvaluationContext) => EngineTickObservationOptions;
  snapshot: () => EvaluationTrace;
}

const DEFAULT_MAX_EVENTS = 2048;
const DEFAULT_MAX_BYTES = 1024 * 1024;

function boundedLimit(value: number | undefined, fallback: number, ceiling: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(ceiling, Math.floor(value!))) : fallback;
}

/** Bounded opt-in recording. Once full, the engine stops constructing observations. */
export function createEvaluationTraceCollector(
  options: EvaluationTraceCaptureOptions = {},
): EvaluationTraceCollector {
  const trace: EvaluationTrace = {
    schemaVersion: 'rb.evaluation-trace.v1',
    status: 'complete',
    maxEvents: boundedLimit(options.maxEvents, DEFAULT_MAX_EVENTS, 10000),
    maxBytes: boundedLimit(options.maxBytes, DEFAULT_MAX_BYTES, 8 * 1024 * 1024),
    bytes: 0,
    events: [],
    issues: [],
  };
  const encoder = new TextEncoder();
  const onError = () => {
    trace.status = 'unavailable';
    trace.unavailableReason = 'observer-error';
  };
  const observe = (event: EngineEvaluationObservation) => {
    if (trace.status !== 'complete') return;
    if (trace.events.length >= trace.maxEvents) {
      trace.status = 'truncated';
      return;
    }
    const retained = { ...event, order: trace.events.length };
    const bytes = encoder.encode(JSON.stringify(retained)).byteLength;
    if (trace.bytes + bytes > trace.maxBytes) {
      trace.status = 'truncated';
      return;
    }
    trace.events.push(retained);
    trace.bytes += bytes;
  };
  const onIssue = (issue: SimulationIssue) => {
    if (trace.status !== 'complete') return;
    // One copy per issue shape is enough; invalid feedback must not fill the recorder.
    if (trace.issues.some(existing => JSON.stringify(existing) === JSON.stringify(issue))) return;
    const bytes = encoder.encode(JSON.stringify(issue)).byteLength;
    if (trace.bytes + bytes > trace.maxBytes) {
      trace.status = 'truncated';
      return;
    }
    trace.issues.push(issue);
    trace.bytes += bytes;
  };
  return {
    forContext: context => ({
      observe,
      context: { ...context },
      isEnabled: () => trace.status === 'complete',
      onIssue,
      onError,
    }),
    snapshot: () => structuredClone(trace),
  };
}

export function unavailableEvaluationTrace(
  reason: 'invalid-ir' | 'unsupported-temporal',
  options: EvaluationTraceCaptureOptions = {},
): EvaluationTrace {
  return { ...createEvaluationTraceCollector(options).snapshot(), status: 'unavailable', unavailableReason: reason };
}
