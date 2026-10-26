import type { Circuit, EngineEvaluationObservation } from '@redbyte/rb-logic-core';
import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import {
  BROWSER_ENGINE_VERSION,
  buildRunIdentity,
  deriveRunScope,
  elaborateProjectHierarchy,
  journeyValues,
  type JourneySelection,
  type ProjectHierarchyDocument,
  type ProjectIoRow,
  type RunScopeReason,
  type RuntimeVerifyRun,
  type VerifyRunLedgerEntry,
  type VerifyScenario,
} from '@redbyte/rb-apps/domain';
import type { RecordingMoment } from './moment';

/**
 * Read-only views over one immutable recording. Nothing here executes a circuit: values are
 * the retained samples (published view) or the retained engine evaluations up to one actual
 * event (event view), exactly as Signal Journey reads them.
 */
export type LogicValue = 0 | 1 | 'X' | 'Z';

export interface RecordingIndex {
  readonly runId: string;
  readonly ticks: readonly number[];
  /** Retained evaluations per vector tick, in global order. */
  readonly eventsByTick: ReadonlyMap<number, readonly EngineEvaluationObservation[]>;
  readonly engine: string | null;
  /** Older engines keep their samples; their evaluations and reproduction are unavailable. */
  readonly legacyEngine: boolean;
  readonly trace: 'complete' | 'truncated' | 'unavailable' | 'absent';
  readonly hasGeneratedSource: boolean;
  readonly hasTopology: boolean;
}

export function recordingRunId(run: RuntimeVerifyRun): string {
  return run.runId ?? run.reportHash;
}

export function indexRecording(run: RuntimeVerifyRun): RecordingIndex {
  const ticks = [...new Set(run.waveform.map((sample) => sample.tick))].sort((a, b) => a - b);
  const eventsByTick = new Map<number, EngineEvaluationObservation[]>();
  for (const event of run.evaluationTrace?.events ?? []) {
    const tick = event.context.tick;
    if (typeof tick !== 'number') continue;
    const list = eventsByTick.get(tick) ?? [];
    list.push(event);
    eventsByTick.set(tick, list);
  }
  for (const list of eventsByTick.values()) list.sort((a, b) => a.order - b.order);
  const engine = run.identity?.engine ?? null;
  return {
    runId: recordingRunId(run),
    ticks,
    eventsByTick,
    engine,
    legacyEngine: engine !== BROWSER_ENGINE_VERSION,
    trace: run.evaluationTrace ? run.evaluationTrace.status : 'absent',
    hasGeneratedSource: Boolean(run.generatedSource?.files.length),
    hasTopology: Boolean(run.circuitSnapshot),
  };
}

/** The selection-free subset journeyValues reads (it uses only the tick). */
function momentSelection(run: RuntimeVerifyRun, tick: number): JourneySelection {
  return {
    projectId: run.projectId ?? '',
    revision: run.identity?.design ?? '',
    runId: recordingRunId(run),
    tick,
    nodeId: '',
    port: '',
    instancePath: [],
    bit: null,
    eventOrder: null,
  };
}

export function eventAt(index: RecordingIndex, moment: RecordingMoment): EngineEvaluationObservation | undefined {
  if (moment.view !== 'event' || moment.eventOrder == null) return undefined;
  return index.eventsByTick.get(moment.tick)?.find((event) => event.order === moment.eventOrder);
}

/**
 * Values keyed `${nodeId}.${pin}` at a recorded moment. Absent keys are unrecorded, never
 * zero. In the event view, captured register results stay pending until the shared commit.
 */
export function valuesAt(run: RuntimeVerifyRun, index: RecordingIndex, moment: RecordingMoment): Map<string, LogicValue> {
  const event = eventAt(index, moment);
  const raw = journeyValues(run, momentSelection(run, moment.tick), event);
  const values = new Map<string, LogicValue>();
  for (const [key, value] of raw) values.set(key, value);
  if (!event) {
    // The stimulus is recorded under each input's IO field id. When the simulator could not run
    // the design (an invalid model records the inputs only), that is the only record of an
    // input's value; it is the value applied to the input node's output.
    const sample = run.waveform.find((entry) => entry.tick === moment.tick);
    for (const row of run.executionInput?.ioRows ?? []) {
      if (row.direction !== 'in' || !row.nodeId || values.has(`${row.nodeId}.out`)) continue;
      // Samples store levels as text ('0' / '1'); any other value stays unrecorded.
      const value = sample?.signals[row.id];
      if (value === '0') values.set(`${row.nodeId}.out`, 0);
      else if (value === '1') values.set(`${row.nodeId}.out`, 1);
    }
  }
  return values;
}

/** Inputs the engine read as an implicit 0 because nothing drove them, at a tick. */
export function defaultZeroReads(index: RecordingIndex, tick: number): Set<string> {
  const keys = new Set<string>();
  for (const event of index.eventsByTick.get(tick) ?? []) {
    for (const read of event.inputReads) if (read.origin === 'default-zero') keys.add(`${event.nodeId}.${read.portName}`);
  }
  return keys;
}

/** Step to the previous or next retained evaluation, crossing tick boundaries. */
export function stepEvent(index: RecordingIndex, moment: RecordingMoment, delta: 1 | -1): RecordingMoment | null {
  const ordered = index.ticks.flatMap((tick) => (index.eventsByTick.get(tick) ?? []).map((event) => ({ tick, order: event.order })));
  if (ordered.length === 0) return null;
  let position: number;
  if (moment.view === 'event' && moment.eventOrder != null) {
    position = ordered.findIndex((entry) => entry.order === moment.eventOrder);
    position = position < 0 ? 0 : position + delta;
  } else {
    // From a published sample, enter the first (or last) evaluation of that tick.
    const atTick = ordered.filter((entry) => entry.tick === moment.tick);
    if (atTick.length === 0) return null;
    const target = delta > 0 ? atTick[0] : atTick[atTick.length - 1];
    position = ordered.indexOf(target);
  }
  if (position < 0 || position >= ordered.length) return null;
  const next = ordered[position];
  return { ...moment, tick: next.tick, view: 'event', eventOrder: next.order };
}

// ── Currentness: may this recording paint the live sheet, and is it current evidence? ──

export interface PaintVerdictInput {
  readonly projectId: string;
  readonly run: RuntimeVerifyRun;
  readonly circuit: Circuit;
  readonly hierarchy: ProjectHierarchyDocument;
  readonly projectIoRows: readonly ProjectIoRow[];
  readonly hardwareMappingV2?: HardwareMappingDocumentV2 | null;
  readonly scenarios: readonly VerifyScenario[];
  readonly dirtySinceVerify: boolean;
  /** The run ledger entry for this recording (runArchive.findVerifyRunLedgerEntry). */
  readonly latestVerifyLedgerEntry?: VerifyRunLedgerEntry | null;
  /** The current project hash (verifyProjectHash.buildCurrentVerifyProjectHash). */
  readonly currentVerifyProjectHash?: string | null;
  /** Supply when the caller already elaborated the current document. */
  readonly simulationCircuit?: Circuit;
}

export interface PaintVerdict {
  /** The current design digest equals the one this recording was made on. */
  readonly paintEligible: boolean;
  /** The workbench's run-scope verdict (deriveRunScope): this recording is current evidence. */
  readonly evidenceCurrent: boolean;
  /** A recording without a design identity (older engine): its values never paint the live sheet. */
  readonly legacy: boolean;
  readonly reasons: readonly RunScopeReason[];
  readonly detail: string | null;
  /** Which perspectives must withdraw recorded values. */
  readonly withdraw: { readonly sheet: boolean; readonly logic: boolean; readonly source: boolean; readonly board: boolean };
}

/**
 * Two predicates, kept apart on purpose.
 * - paintEligible compares the current design digest, computed exactly as buildRunIdentity
 *   computes it (elaborated circuit plus logical IO binding), with the recording's own. A moved
 *   gate or a renamed part label keeps it; a rewire or a renamed IO row does not. A recording
 *   with no design identity (an older engine) cannot be matched to a design and never paints.
 * - evidenceCurrent is the workbench's run-scope verdict (deriveRunScope with the run ledger and
 *   the current project hash): an edit that is undone can repaint values, but the recording
 *   still has to be rerun to count.
 */
export function paintVerdict(input: PaintVerdictInput): PaintVerdict {
  const simulationCircuit = input.simulationCircuit ?? elaborateProjectHierarchy(input.circuit, input.hierarchy);
  const run = input.run;
  const legacy = !(run.identity && run.scheduleContract);
  let paintEligible = false;
  if (run.identity && run.scheduleContract) {
    const current = buildRunIdentity({
      circuit: simulationCircuit,
      ioRows: input.projectIoRows,
      vectors: [],
      schedule: run.scheduleContract,
      runKind: 'trace',
    });
    paintEligible = current.design === run.identity.design;
  }
  const scope = deriveRunScope({
    projectId: input.projectId,
    run,
    simulationCircuit,
    projectIoRows: [...input.projectIoRows],
    hardwareMappingV2: input.hardwareMappingV2 ?? null,
    scenarios: [...input.scenarios],
    dirtySinceVerify: input.dirtySinceVerify,
    latestVerifyLedgerEntry: input.latestVerifyLedgerEntry ?? null,
    currentVerifyProjectHash: input.currentVerifyProjectHash ?? null,
  });
  const reasons = scope.reasons;
  const designChanged = !paintEligible || reasons.includes('design') || reasons.includes('project');
  return {
    paintEligible,
    evidenceCurrent: scope.kind === 'current',
    legacy,
    reasons,
    detail: scope.detail,
    withdraw: {
      sheet: designChanged,
      logic: designChanged,
      source: designChanged,
      board: designChanged || reasons.includes('mapping'),
    },
  };
}
