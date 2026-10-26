import type { EngineEvaluationObservation } from '@redbyte/rb-logic-core';
import type { RuntimeVerifyRun } from '@redbyte/rb-apps/domain';
import type { RecordingMoment } from './moment';
import { valuesAt, type LogicValue, type RecordingIndex } from './recordingView';

/**
 * Time inside a recorded tick, exactly as the engine ordered it.
 *
 * The board-clock schedule (simEngineCore `executeClockedMacroVectorCase`) runs each vector
 * tick as three engine ticks, and the recording keeps every evaluation of each:
 *   1. 'macro-low-before'  the tick's inputs are applied with the clock low;
 *   2. 'macro-high-sample' the clock rises: registers capture, commit together, logic settles,
 *                          and the published sample is taken;
 *   3. 'macro-low-after'   the clock falls.
 * Those three schedule boundaries (inputs, rise, fall) are the only positions drawn inside a
 * tick. Evaluations within one phase happen at that boundary in dependency order, with no
 * simulated delay: they have a step number, never a time.
 */
export type PhaseKind = 'inputs' | 'rise' | 'fall' | 'step';

interface PhaseShape {
  readonly kind: PhaseKind;
  /** Position inside the tick, as a fraction of its width (a drawing convention, not a time). */
  readonly at: number;
  readonly words: string;
}

export const RISE_AT = 0.3;
export const FALL_AT = 0.7;
/** Where the published sample is drawn: clock high, after the rising edge has settled. */
export const SAMPLE_AT = 0.5;

const PHASE_SHAPES: Readonly<Record<string, PhaseShape>> = {
  'macro-low-before': { kind: 'inputs', at: 0, words: 'inputs applied, clock low' },
  'macro-high-sample': { kind: 'rise', at: RISE_AT, words: 'rising clock edge' },
  'macro-low-after': { kind: 'fall', at: FALL_AT, words: 'clock falls' },
  combinational: { kind: 'inputs', at: 0, words: 'inputs applied' },
  'authored-clock': { kind: 'inputs', at: 0, words: 'inputs applied, authored clock' },
};
const UNKNOWN_SHAPE: PhaseShape = { kind: 'step', at: 0, words: 'inside the tick' };

export interface TickPhase {
  readonly name: string;
  readonly kind: PhaseKind;
  readonly at: number;
  readonly words: string;
  readonly events: readonly EngineEvaluationObservation[];
  /** Every value known once this phase has settled: earlier values carried forward, then this phase's evaluations. */
  readonly end: ReadonlyMap<string, LogicValue>;
}

export interface TickTime {
  readonly tick: number;
  /** The retained phases of this tick, in engine order; empty when they were not retained. */
  readonly phases: readonly TickPhase[];
  /** Index of the phase whose settled values the published sample shows (-1 without phases). */
  readonly samplePhase: number;
  /** The published sample, keyed `${nodeId}.${pin}` exactly as the sheet reads it. */
  readonly sample: ReadonlyMap<string, LogicValue>;
  readonly evaluated: boolean;
}

export type TimelineCoverage =
  | { readonly kind: 'complete' }
  | { readonly kind: 'partial'; readonly lastTick: number | null }
  | { readonly kind: 'none'; readonly reason: 'absent' | 'legacy' | 'unavailable'; readonly detail: string | null };

export interface Timeline {
  readonly runId: string;
  readonly ticks: ReadonlyMap<number, TickTime>;
  readonly coverage: TimelineCoverage;
}

/** A recorded level as a logic value; anything else is unrecorded, never 0. */
export function logicValue(value: unknown): LogicValue | undefined {
  if (value === 0 || value === '0') return 0;
  if (value === 1 || value === '1') return 1;
  if (value === 'X' || value === 'Z') return value;
  return undefined;
}

function shapeOf(name: string | undefined): PhaseShape {
  return (name && PHASE_SHAPES[name]) || UNKNOWN_SHAPE;
}

/**
 * Apply one evaluation to a value map (outputs and the pins it read), and learn which driver
 * feeds each input pin. A pin's read is what it saw when it evaluated; once the phase settles an
 * input pin shows its driver's settled value, as the published sample does (a register read
 * D = 1 at the capture, and D may settle to 0 after the shared commit).
 */
function applyEvent(values: Map<string, LogicValue>, drivers: Map<string, string>, event: EngineEvaluationObservation): void {
  for (const [port, raw] of Object.entries(event.outputs)) {
    const value = logicValue(raw);
    if (value !== undefined) values.set(`${event.nodeId}.${port}`, value);
  }
  for (const read of event.inputReads) {
    const value = logicValue(read.value);
    if (value !== undefined) values.set(`${event.nodeId}.${read.portName}`, value);
    if (read.driver && read.origin !== 'default-zero') drivers.set(`${event.nodeId}.${read.portName}`, `${read.driver.nodeId}.${read.driver.portName}`);
  }
}

function settleInputs(values: Map<string, LogicValue>, drivers: ReadonlyMap<string, string>): void {
  for (const [input, driver] of drivers) {
    const value = values.get(driver);
    if (value !== undefined) values.set(input, value);
  }
}

/**
 * One pass over the recording: the published sample of every tick, and, where the evaluations
 * were retained, each phase's settled values. A truncated trace covers only the ticks before
 * the one it was cut in; nothing past the cut is reconstructed.
 */
export function buildTimeline(run: RuntimeVerifyRun, index: RecordingIndex): Timeline {
  const trace = run.evaluationTrace;
  const coverage: TimelineCoverage = index.legacyEngine && !trace
    ? { kind: 'none', reason: 'legacy', detail: index.engine }
    : !trace
      ? { kind: 'none', reason: 'absent', detail: null }
      : trace.status === 'unavailable'
        ? { kind: 'none', reason: 'unavailable', detail: trace.unavailableReason ?? null }
        : trace.status === 'truncated'
          ? { kind: 'partial', lastTick: lastFullTick(index) }
          : { kind: 'complete' };
  const covered = (tick: number) => coverage.kind === 'complete'
    || (coverage.kind === 'partial' && coverage.lastTick !== null && tick <= coverage.lastTick);

  const ticks = new Map<number, TickTime>();
  let carry = new Map<string, LogicValue>();
  const drivers = new Map<string, string>();
  for (const tick of index.ticks) {
    const sample = valuesAt(run, index, { source: 'recording', runId: index.runId, tick, view: 'published', eventOrder: null });
    const events = index.eventsByTick.get(tick) ?? [];
    if (!covered(tick) || events.length === 0) {
      ticks.set(tick, { tick, phases: [], samplePhase: -1, sample, evaluated: false });
      carry = new Map(sample);
      continue;
    }
    const phases: TickPhase[] = [];
    let group: EngineEvaluationObservation[] = [];
    const close = () => {
      if (group.length === 0) return;
      const end = new Map(carry);
      for (const event of group) applyEvent(end, drivers, event);
      settleInputs(end, drivers);
      const shape = shapeOf(group[0].context.phase);
      phases.push({ name: group[0].context.phase ?? '', kind: shape.kind, at: shape.at, words: shape.words, events: group, end });
      carry = end;
      group = [];
    };
    for (const event of events) {
      if (group.length && (group[0].context.engineTick !== event.context.engineTick || group[0].context.phase !== event.context.phase)) close();
      group.push(event);
    }
    close();
    const rise = phases.findIndex((phase) => phase.kind === 'rise');
    ticks.set(tick, { tick, phases, samplePhase: rise >= 0 ? rise : phases.length - 1, sample, evaluated: true });
  }
  return { runId: index.runId, ticks, coverage };
}

/** In a truncated trace, the last tick before the one the cut fell in. */
function lastFullTick(index: RecordingIndex): number | null {
  const withEvents = index.ticks.filter((tick) => (index.eventsByTick.get(tick)?.length ?? 0) > 0);
  return withEvents.length >= 2 ? withEvents[withEvents.length - 2] : null;
}

/** Why the inside of a tick cannot be shown, in a student's words. Null when it can. */
export function coverageLimit(timeline: Timeline, tick: number): string | null {
  const time = timeline.ticks.get(tick);
  if (time?.evaluated) return null;
  const coverage = timeline.coverage;
  if (coverage.kind === 'none') {
    if (coverage.reason === 'legacy') return 'This recording comes from an older engine that kept only one sample per tick, so it cannot show what happened inside a tick.';
    if (coverage.reason === 'unavailable' && coverage.detail === 'invalid-ir') return 'The simulator could not run this design, so only the test inputs were recorded.';
    if (coverage.reason === 'unavailable') return `Evaluations were not captured for this run${coverage.detail ? ` (${coverage.detail})` : ''}, so it cannot show what happened inside a tick.`;
    return 'This recording kept one sample per tick but not the evaluations inside each tick, so it cannot show what happened inside a tick.';
  }
  if (coverage.kind === 'partial') {
    return coverage.lastTick === null
      ? 'This recording reached its size limit before a whole tick was kept, so it cannot show what happened inside a tick.'
      : `This recording kept the evaluations only up to t${coverage.lastTick} (size limit), so it cannot show what happened inside t${tick}.`;
  }
  return `This recording kept no evaluations for t${tick}.`;
}

// ── Lanes: what one recorded signal did across and inside the ticks ──

export interface LaneSegment {
  /** Fractions of the tick width. */
  readonly from: number;
  readonly to: number;
  readonly value: LogicValue | undefined;
}

export interface LaneTick {
  readonly tick: number;
  /** True when the segments come from retained evaluations; false: one published sample only. */
  readonly evaluated: boolean;
  readonly segments: readonly LaneSegment[];
  readonly sample: LogicValue | undefined;
}

/**
 * A lane over every tick. With retained evaluations a value changes exactly at the schedule
 * boundary of the phase that changed it (inputs at the tick start, registers and their logic
 * at the rising edge). Without them the lane has only the published sample per tick, and the
 * caller must not draw a change as if its moment were known.
 */
export function laneTicks(timeline: Timeline, key: string): LaneTick[] {
  const result: LaneTick[] = [];
  for (const time of timeline.ticks.values()) {
    const sample = time.sample.get(key);
    if (!time.evaluated) {
      result.push({ tick: time.tick, evaluated: false, segments: [{ from: 0, to: 1, value: sample }], sample });
      continue;
    }
    // Phases at the same boundary (several combinational steps) draw only the last one settled.
    const drawn = time.phases.filter((phase, position) => !time.phases.slice(position + 1).some((later) => later.at === phase.at));
    const segments = drawn.map((phase, position) => ({
      from: position === 0 ? 0 : phase.at,
      to: drawn[position + 1]?.at ?? 1,
      value: phase.end.get(key),
    }));
    result.push({ tick: time.tick, evaluated: true, segments, sample });
  }
  return result;
}

/**
 * The settled level of a signal just before a phase of a tick: the previous phase, the previous
 * tick's end, or, before the first recorded tick, the level the part's first retained evaluation
 * started from (its recorded previous output).
 */
export function levelBeforePhase(timeline: Timeline, key: string, tick: number, phaseIndex: number): LogicValue | undefined {
  const time = timeline.ticks.get(tick);
  if (time && phaseIndex > 0) return time.phases[phaseIndex - 1]?.end.get(key);
  const ticks = [...timeline.ticks.values()];
  const previous = ticks[ticks.findIndex((entry) => entry.tick === tick) - 1];
  if (previous) return previous.evaluated ? previous.phases[previous.phases.length - 1]?.end.get(key) : previous.sample.get(key);
  const dot = key.lastIndexOf('.');
  const nodeId = key.slice(0, dot);
  const port = key.slice(dot + 1);
  for (const phase of time?.phases ?? []) {
    const first = phase.events.find((event) => event.nodeId === nodeId);
    if (first) return port in first.previousOutputs ? logicValue(first.previousOutputs[port]) : undefined;
  }
  return undefined;
}

/** A recorded 0 → 1 of a signal at one phase of a tick (a clock edge, read from its own record). */
export function roseInPhase(timeline: Timeline, key: string, tick: number, phaseIndex: number): boolean {
  const time = timeline.ticks.get(tick);
  if (!time?.evaluated || phaseIndex < 0) return false;
  return levelBeforePhase(timeline, key, tick, phaseIndex) === 0 && time.phases[phaseIndex]?.end.get(key) === 1;
}

/** A recorded 0 → 1 of a signal inside a tick, up to its published sample. */
export function roseByTheSample(timeline: Timeline, key: string, tick: number): boolean {
  const time = timeline.ticks.get(tick);
  if (!time?.evaluated) return false;
  for (let phase = 0; phase <= time.samplePhase; phase += 1) if (roseInPhase(timeline, key, tick, phase)) return true;
  return false;
}

/** The lane value at a fraction of a tick (the published sample instant is SAMPLE_AT). */
export function laneValueAt(lane: LaneTick, at: number): LogicValue | undefined {
  return lane.segments.find((segment) => segment.from <= at && at < segment.to)?.value ?? lane.segments[lane.segments.length - 1]?.value;
}

// ── Events: where one retained evaluation sits inside its tick ──

export interface EventPlace {
  readonly tick: number;
  readonly event: EngineEvaluationObservation;
  readonly phase: TickPhase;
  /** 1-based step of this evaluation among all evaluations of its tick, and how many there are. */
  readonly step: number;
  readonly of: number;
  /** The phase boundary the evaluation belongs to, as a fraction of the tick. */
  readonly at: number;
}

export function placeOrder(timeline: Timeline, tick: number, order: number): EventPlace | null {
  const time = timeline.ticks.get(tick);
  if (!time?.evaluated) return null;
  let step = 0;
  const of = time.phases.reduce((sum, phase) => sum + phase.events.length, 0);
  for (const phase of time.phases) {
    for (const event of phase.events) {
      step += 1;
      if (event.order === order) return { tick, event, phase, step, of, at: phase.at };
    }
  }
  return null;
}

export function placeMoment(timeline: Timeline, moment: RecordingMoment): EventPlace | null {
  return moment.view === 'event' && moment.eventOrder != null ? placeOrder(timeline, moment.tick, moment.eventOrder) : null;
}

/**
 * True for a stored-state evaluation (its result is published at the shared commit). The engine
 * runs one in every engine tick, edge or not: whether a clock edge happened is a separate fact
 * (`captureFacts`).
 */
export function isCapture(event: EngineEvaluationObservation): boolean {
  return event.evaluationPhase === 'capture' && event.commitPhase === 'after-capture';
}

const CLOCK_PIN = /^(clk|clock|c)$/i;
const RESET_PIN = /^(rst|reset|clr|clear)$/i;

export interface CaptureFacts {
  /** The clock level this evaluation read. */
  readonly clock: LogicValue | undefined;
  /** A clock transition recorded at this evaluation: the level it held before, then the one it read. */
  readonly edge: 'rise' | 'fall' | null;
  /** The transition is the part's own active edge (rising unless its recorded state says falling). */
  readonly clocked: boolean;
  readonly activeEdge: 'rise' | 'fall';
  readonly prior: LogicValue | undefined;
  readonly next: LogicValue | undefined;
  readonly changed: boolean;
  /** A reset/clear input read as 1 at this evaluation, by pin name. */
  readonly resetActive: string | null;
}

/**
 * What one stored-state evaluation recorded: the clock it read against the clock level it held
 * before (the behaviour's own `lastClk`, 0 when absent, as the behaviours read it), the value
 * before and after, and any active reset input. Never inferred from the phase name.
 */
export function captureFacts(event: EngineEvaluationObservation, pin: string, clockPins: readonly string[] = []): CaptureFacts {
  const clockRead = event.inputReads.find((read) => clockPins.includes(read.portName) || CLOCK_PIN.test(read.portName));
  const clock = clockRead ? logicValue(clockRead.value) : undefined;
  const held = logicValue(event.stateBefore?.lastClk ?? 0);
  const edge = clock === 1 && held === 0 ? 'rise' : clock === 0 && held === 1 ? 'fall' : null;
  const activeEdge = /fall/i.test(String(event.stateBefore?.clockPolarity ?? '')) ? 'fall' : 'rise';
  const prior = logicValue(event.previousOutputs[pin]);
  const next = logicValue(event.outputs[pin]);
  const reset = event.inputReads.find((read) => RESET_PIN.test(read.portName) && logicValue(read.value) === 1);
  return {
    clock, edge, clocked: edge !== null && edge === activeEdge, activeEdge, prior, next,
    changed: prior !== undefined && next !== undefined && prior !== next, resetActive: reset?.portName ?? null,
  };
}

/** The value of one pin in one evaluation: an output it published, or an input it read. */
export function eventPinValue(event: EngineEvaluationObservation, pin: string): LogicValue | undefined {
  if (pin in event.outputs) return logicValue(event.outputs[pin]);
  const read = event.inputReads.find((entry) => entry.portName === pin);
  return read ? logicValue(read.value) : undefined;
}

/** Captures that already happened at this event but are not yet visible on Q (pending commit). */
export function pendingCaptures(
  timeline: Timeline,
  moment: RecordingMoment,
  pinOf: (nodeId: string) => string | null,
): Map<string, { readonly prior: LogicValue; readonly next: LogicValue; readonly clocked: boolean }> {
  const pending = new Map<string, { prior: LogicValue; next: LogicValue; clocked: boolean }>();
  const place = placeMoment(timeline, moment);
  if (!place || place.event.evaluationPhase === 'after-capture') return pending;
  for (const event of place.phase.events) {
    if (event.order > place.event.order) break;
    if (!isCapture(event)) continue;
    const pin = pinOf(event.nodeId);
    if (!pin) continue;
    const prior = logicValue(event.previousOutputs[pin]);
    const next = logicValue(event.outputs[pin]);
    if (prior !== undefined && next !== undefined && prior !== next) pending.set(event.nodeId, { prior, next, clocked: captureFacts(event, pin).clocked });
  }
  return pending;
}

// ── Cause: the retained evaluation that set the value shown at a tick ──

export type Cause =
  | {
      readonly kind: 'changed';
      readonly place: EventPlace;
      readonly from: LogicValue;
      readonly to: LogicValue;
    }
  | {
      /** The value never changed in the recording; place is its latest evaluation up to the sample. */
      readonly kind: 'held';
      readonly place: EventPlace;
      readonly value: LogicValue;
    }
  | { readonly kind: 'unavailable'; readonly reason: string };

/**
 * The evaluation that last changed `nodeId.pin` to the value the published sample shows at
 * `tick`, searching back through retained evaluations up to that sample. Nothing is inferred:
 * when the evaluations are not retained, the reason is returned instead.
 */
export function findCause(timeline: Timeline, nodeId: string, pin: string, tick: number): Cause {
  const target = timeline.ticks.get(tick);
  const limit = coverageLimit(timeline, tick);
  if (!target || limit) return { kind: 'unavailable', reason: limit ?? `There is no t${tick} in this recording.` };
  const shown = target.sample.get(`${nodeId}.${pin}`);
  if (shown === undefined) return { kind: 'unavailable', reason: 'This recording has no sample of this signal at this tick.' };

  let lastSeen: LogicValue | undefined;
  let change: { place: EventPlace; from: LogicValue; to: LogicValue } | null = null;
  let latest: EventPlace | null = null;
  for (const time of timeline.ticks.values()) {
    if (time.tick > tick) break;
    if (!time.evaluated) {
      // An earlier tick without evaluations: only its published sample is known.
      lastSeen = time.sample.get(`${nodeId}.${pin}`);
      change = null;
      latest = null;
      continue;
    }
    const lastPhase = time.tick === tick ? time.samplePhase : time.phases.length - 1;
    let step = 0;
    const of = time.phases.reduce((sum, phase) => sum + phase.events.length, 0);
    time.phases.forEach((phase, phaseIndex) => {
      for (const event of phase.events) {
        step += 1;
        if (phaseIndex > lastPhase || event.nodeId !== nodeId) continue;
        const value = eventPinValue(event, pin);
        if (value === undefined) continue;
        // Compare with this part's own last recorded value. previousOutputs is the engine tick's
        // starting cache, so a gate evaluated twice in one phase would report the same change twice.
        const before = lastSeen ?? (pin in event.previousOutputs ? logicValue(event.previousOutputs[pin]) : undefined);
        const place = { tick: time.tick, event, phase, step, of, at: phase.at };
        if (before !== undefined && before !== value) change = { place, from: before, to: value };
        lastSeen = value;
        latest = place;
      }
    });
  }
  const found = change as { place: EventPlace; from: LogicValue; to: LogicValue } | null;
  if (found && found.to === shown) return { kind: 'changed', place: found.place, from: found.from, to: found.to };
  const last = latest as EventPlace | null;
  if (last) return { kind: 'held', place: last, value: shown };
  return { kind: 'unavailable', reason: 'No retained evaluation of this part reached the sample.' };
}
