import type { EngineEvaluationObservation } from '@redbyte/rb-logic-core';
import type { RecordingMoment } from './moment';
import type { LogicValue, RecordingIndex } from './recordingView';
import {
  captureFacts,
  coverageLimit,
  eventPinValue,
  findCause,
  isCapture,
  laneTicks,
  levelBeforePhase,
  logicValue,
  placeMoment,
  type Cause,
  type EventPlace,
  type Timeline,
} from './timeline';

/**
 * The inspector's explanation of the selected part at the Moment, in a student's words, built
 * only from the recording: published samples and the retained evaluation that produced them.
 * Each sentence is a recorded fact; when the evidence is missing the explanation says exactly
 * what is missing instead of supplying a cause.
 */
export type SymbolRole = 'register' | 'io-in' | 'io-out' | 'clock' | 'logic';

export interface ExplainInput {
  readonly timeline: Timeline;
  readonly index: RecordingIndex;
  readonly moment: RecordingMoment;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly role: SymbolRole;
  /** The pin that names the part's value (Q, out, or an output's input). */
  readonly pin: string | null;
  /** Input pins that are clock inputs (never data). */
  readonly clockPins: readonly string[];
  /** The part's display name, and a namer for other parts. */
  readonly title: string;
  readonly label: (nodeId: string) => string;
  /** Values the sheet shows at this Moment (`${nodeId}.${pin}`). */
  readonly values: ReadonlyMap<string, LogicValue>;
  /** This part's input pins that nothing drives (topology). */
  readonly unconnectedPins?: readonly string[];
}

export interface ExplanationLine {
  readonly kind: 'fact' | 'cause' | 'effect' | 'rule' | 'pending' | 'limitation';
  readonly text: string;
}

export interface Explanation {
  readonly heading: string;
  readonly lines: readonly ExplanationLine[];
  /** Per pin, a note for the pin table (e.g. Q "becomes 1" while a capture is pending). */
  readonly pinNotes: ReadonlyMap<string, string>;
  /** Where the value shown at this tick was set, for causal navigation. */
  readonly cause: Cause | null;
  readonly causeLabel: string | null;
}

const RULES: Readonly<Record<string, string>> = {
  DFlipFlop: 'A D flip-flop copies D to Q at each rising clock edge and holds it until the next one.',
  TFlipFlop: 'A T flip-flop flips Q at a rising clock edge when T is 1, and holds it when T is 0.',
  JKFlipFlop: 'A JK flip-flop at a rising clock edge: J sets Q, K clears it, both together flip it.',
  Register1: 'A register stores its data input at each rising clock edge and holds it until the next one.',
  RegisterBus: 'A register stores its data word at each rising clock edge and holds it until the next one.',
  AND: 'AND gives 1 only when every input is 1.',
  AND3: 'AND gives 1 only when every input is 1.',
  OR: 'OR gives 1 when any input is 1.',
  OR3: 'OR gives 1 when any input is 1.',
  XOR: 'XOR gives 1 when an odd number of its inputs are 1.',
  XOR3: 'XOR gives 1 when an odd number of its inputs are 1.',
  NOT: 'NOT gives the opposite of its input.',
  NAND: 'NAND gives 0 only when every input is 1.',
  NAND3: 'NAND gives 0 only when every input is 1.',
  NOR: 'NOR gives 1 only when every input is 0.',
  NOR3: 'NOR gives 1 only when every input is 0.',
  XNOR: 'XNOR gives 1 when an even number of its inputs are 1.',
  BUFFER: 'A buffer passes its input through unchanged.',
  BUF: 'A buffer passes its input through unchanged.',
};

/** Student names for part types (the type ids stay in the data). */
const KINDS: Readonly<Record<string, string>> = {
  AND: 'AND gate', AND3: 'AND gate', OR: 'OR gate', OR3: 'OR gate', XOR: 'XOR gate', XOR3: 'XOR gate',
  NOT: 'NOT gate', NAND: 'NAND gate', NAND3: 'NAND gate', NOR: 'NOR gate', NOR3: 'NOR gate', XNOR: 'XNOR gate',
  BUFFER: 'Buffer', BUF: 'Buffer', INPUT: 'Input', Switch: 'Input switch', OUTPUT: 'Output', Lamp: 'Output indicator',
  PowerSource: 'Constant 1', Ground: 'Constant 0', DFlipFlop: 'D flip-flop', TFlipFlop: 'T flip-flop', JKFlipFlop: 'JK flip-flop',
  Register1: 'Register', RegisterBus: 'Register word', StateBank: 'State bank', DLatch: 'D latch', RSLatch: 'RS latch',
  Clock: 'Clock source', MUX4: 'Four-input multiplexer', FullAdder: 'Full adder',
};

export function partKind(type: string): string | null {
  return KINDS[type] ?? null;
}

function previousTick(index: RecordingIndex, tick: number): number | null {
  const position = index.ticks.indexOf(tick);
  return position > 0 ? index.ticks[position - 1] : null;
}

function readsText(event: EngineEvaluationObservation, clockPins: readonly string[], label: (nodeId: string) => string, withDriver: boolean): string {
  const reads = event.inputReads.filter((read) => !clockPins.includes(read.portName))
    .sort((a, b) => (a.portName < b.portName ? -1 : a.portName > b.portName ? 1 : 0));
  if (reads.length === 0) return 'no data input';
  return reads.map((read) => {
    const value = read.value === 0 || read.value === 1 ? read.value : String(read.value);
    const from = withDriver && reads.length === 1 && read.driver && read.origin !== 'default-zero' ? ` (from ${label(read.driver.nodeId)})` : '';
    const zero = read.origin === 'default-zero' ? ' (nothing drives it, read as 0)' : '';
    return `${read.portName} = ${value}${from}${zero}`;
  }).join(', ');
}

/** The first stored-state evaluation in this phase that changed its value (a commit followed), if any. */
function changedCapture(place: EventPlace): EngineEvaluationObservation | null {
  return place.phase.events.find((event) => isCapture(event)
    && Object.keys(event.outputs).some((port) => logicValue(event.outputs[port]) !== logicValue(event.previousOutputs[port]))) ?? null;
}

/** When, in student words, an evaluation happened: from what it recorded, then from its phase. */
function whenText(place: EventPlace, clockPins: readonly string[]): string {
  const event = place.event;
  if (isCapture(event)) {
    const facts = captureFacts(event, '', clockPins);
    if (facts.clocked) return `at the ${facts.activeEdge === 'fall' ? 'falling' : 'rising'} clock edge in t${place.tick}`;
  }
  if (event.evaluationPhase === 'after-capture') {
    const capture = changedCapture(place);
    if (capture) {
      const facts = captureFacts(capture, '');
      return facts.clocked ? `just after the ${facts.activeEdge === 'fall' ? 'falling' : 'rising'} clock edge in t${place.tick}` : `just after a stored value changed in t${place.tick}`;
    }
  }
  if (place.phase.kind === 'rise') {
    return event.evaluationPhase === 'after-capture' ? `just after the rising edge in t${place.tick}` : `as the clock rose in t${place.tick}`;
  }
  if (place.phase.kind === 'fall') return `when the clock fell in t${place.tick}`;
  if (place.phase.kind === 'inputs') return `when t${place.tick}'s inputs were applied`;
  return `inside t${place.tick}`;
}

const levelWord = (value: LogicValue | undefined) => (value === 1 ? 'high' : value === 0 ? 'low' : 'not recorded');

/** One stored-state evaluation in words: edge or not, changed or kept, read from the record. */
function registerLines(
  event: EngineEvaluationObservation,
  pin: string,
  title: string,
  clockPins: readonly string[],
  label: (nodeId: string) => string,
  tick: number | null,
  unconnectedPins: readonly string[] = [],
): { lines: ExplanationLine[]; changed: boolean; prior: LogicValue | undefined; next: LogicValue | undefined; clocked: boolean } {
  const facts = captureFacts(event, pin, clockPins);
  const reads = readsText(event, clockPins, label, true);
  const lines: ExplanationLine[] = [];
  const resetWords = facts.resetActive ? ` while ${facts.resetActive} = 1` : '';
  const edgeWords = facts.activeEdge === 'fall' ? 'falling' : 'rising';
  const clockUnconnected = unconnectedPins.some((id) => clockPins.includes(id) || /^(clk|clock|c)$/i.test(id));
  const clockWords = (tense: 'is' | 'was') => (clockUnconnected && facts.clock === undefined ? `the clock input is unconnected` : `the clock ${tense} ${levelWord(facts.clock)}`);
  // At an edge that did not store the data it read, say what the record shows held it.
  const data = event.inputReads.find((read) => !clockPins.includes(read.portName) && /^(d|in|t|j)$/i.test(read.portName));
  const enable = event.inputReads.find((read) => /^(en|enable|ce)$/i.test(read.portName) && logicValue(read.value) === 0);
  const enableUnconnected = unconnectedPins.find((id) => /^(en|enable|ce)$/i.test(id));
  const heldWords = !facts.clocked || facts.changed || !data || logicValue(data.value) === facts.next ? ''
    : facts.resetActive ? `, although it read ${data.portName} = ${logicValue(data.value)}, while ${facts.resetActive} = 1`
      : enable ? `, although it read ${data.portName} = ${logicValue(data.value)}, while ${enable.portName} = 0`
        : enableUnconnected ? `, although it read ${data.portName} = ${logicValue(data.value)}; its ${enableUnconnected} input is unconnected`
          : `, although it read ${data.portName} = ${logicValue(data.value)}`;
  if (tick === null) {
    // Present tense: the student is standing on this step.
    if (facts.clocked) {
      lines.push({ kind: 'cause', text: `At the ${edgeWords} clock edge ${title} reads ${reads}.` });
      lines.push({ kind: 'effect', text: !facts.changed ? `It keeps ${facts.next}${heldWords}.` : facts.resetActive ? `Its stored value changes ${facts.prior} → ${facts.next}${resetWords}.` : `It captures ${facts.next}: its stored value changes ${facts.prior} → ${facts.next}.` });
    } else if (facts.changed) {
      lines.push({ kind: 'cause', text: `With no ${edgeWords} clock edge (${clockWords('is')}), ${title} reads ${reads}.` });
      lines.push({ kind: 'effect', text: `Its stored value changes ${facts.prior} → ${facts.next}${resetWords}.` });
    } else {
      lines.push({ kind: 'cause', text: `With no ${edgeWords} clock edge (${clockWords('is')}), ${title} reads ${reads} and keeps ${facts.prior}.` });
    }
  } else if (facts.clocked) {
    lines.push({ kind: 'cause', text: `At the ${edgeWords} clock edge in t${tick}, ${title} read ${reads}.` });
    lines.push({ kind: 'effect', text: facts.changed ? `So its stored value changed ${facts.prior} → ${facts.next}${resetWords}.` : `So it kept ${facts.next}${heldWords}.` });
  } else if (facts.changed) {
    lines.push({ kind: 'cause', text: `In t${tick}, with no ${edgeWords} clock edge (${clockWords('was')}), ${title} read ${reads}.` });
    lines.push({ kind: 'effect', text: `Its stored value changed ${facts.prior} → ${facts.next}${resetWords}.` });
  } else {
    lines.push({ kind: 'cause', text: `In t${tick} ${title} saw no ${edgeWords} clock edge (${clockWords('was')}), so it kept ${facts.next}.` });
  }
  return { lines, changed: facts.changed, prior: facts.prior, next: facts.next, clocked: facts.clocked };
}

function causeLabelFor(cause: Cause, role: SymbolRole, title: string, tick: number, pin: string, clockPins: readonly string[]): string | null {
  if (cause.kind === 'unavailable') return null;
  const where = cause.place.tick === tick ? '' : ` (t${cause.place.tick})`;
  const clocked = isCapture(cause.place.event) && captureFacts(cause.place.event, pin, clockPins).clocked;
  if (cause.kind === 'held') {
    return clocked ? `Show this tick's clock edge (${title} kept ${cause.value})` : `Show ${title}'s evaluation in t${cause.place.tick}`;
  }
  if (clocked) return `Show the clock edge that set ${title}${where}`;
  if (role === 'io-in') return `Show when ${title} changed${where}`;
  return `Show the step that set ${title}${where}`;
}

/** The clock's own recorded story at a tick: its levels inside the tick, never an assumed pulse. */
function clockLines(timeline: Timeline, key: string, tick: number, title: string): ExplanationLine[] {
  const lane = laneTicks(timeline, key);
  const position = lane.findIndex((entry) => entry.tick === tick);
  const here = lane[position];
  if (!here || here.sample === undefined) return [{ kind: 'limitation', text: coverageLimit(timeline, tick) ?? `This recording has no sample of ${title} at t${tick}.` }];
  if (!here.evaluated) {
    return [
      { kind: 'fact', text: `${title} was ${here.sample} at t${tick}'s sample.` },
      { kind: 'limitation', text: coverageLimit(timeline, tick) ?? 'This recording kept no evaluations for this tick.' },
    ];
  }
  const start = levelBeforePhase(timeline, key, tick, 0);
  const levels = here.segments.map((segment) => segment.value);
  const path = [start, ...levels].filter((value, index, all) => value !== undefined && (index === 0 || value !== all[index - 1]));
  const rose = [start, ...levels].some((value, index, all) => index > 0 && all[index - 1] === 0 && value === 1);
  return [
    { kind: 'fact', text: path.length > 1 ? `In t${tick} ${title} went ${path.join(' → ')}.` : `In t${tick} ${title} stayed ${path[0] ?? here.sample}.` },
    { kind: 'fact', text: rose ? 'It rose once in this tick: registers clocked by it capture on that edge.' : 'It did not rise in this tick, so no register clocked by it captured on an edge.' },
  ];
}

export function explainSelection(input: ExplainInput): Explanation {
  const { timeline, index, moment, nodeId, role, pin, title, label, clockPins } = input;
  const lines: ExplanationLine[] = [];
  const pinNotes = new Map<string, string>();
  const rule = RULES[input.nodeType];
  const tick = moment.tick;
  const time = timeline.ticks.get(tick);

  if (!pin || !time) {
    return { heading: `At t${tick}`, lines: [{ kind: 'limitation', text: `${title} has no recorded value in this recording.` }], pinNotes, cause: null, causeLabel: null };
  }
  const key = `${nodeId}.${pin}`;
  const place = placeMoment(timeline, moment);

  // ── Inside a tick: one retained evaluation ──
  if (moment.view === 'event') {
    if (!place) {
      return { heading: `Inside t${tick}`, lines: [{ kind: 'limitation', text: coverageLimit(timeline, tick) ?? 'This step is not in the recording.' }], pinNotes, cause: null, causeLabel: null };
    }
    const heading = `t${tick} · ${place.phase.words} · step ${place.step} of ${place.of}`;
    const event = place.event;
    if (event.nodeId === nodeId && isCapture(event)) {
      const step = registerLines(event, pin, title, clockPins, label, null, input.unconnectedPins);
      lines.push(...step.lines);
      if (step.changed) {
        lines.push({ kind: 'pending', text: `${pin} still shows ${step.prior}: all stored values update together, just after this ${step.clocked ? 'edge' : 'step'}.` });
        pinNotes.set(pin, `becomes ${step.next}`);
      }
      if (rule) lines.push({ kind: 'rule', text: rule });
    } else if (event.nodeId === nodeId) {
      const value = eventPinValue(event, pin);
      const reads = readsText(event, clockPins, label, false);
      lines.push({ kind: 'cause', text: role === 'io-out' ? `${title} reads ${reads}.` : role === 'io-in' || role === 'clock' ? `${title} is ${value} at this step.` : `${title} reads ${reads} and gives ${pin} = ${value}.` });
      if (rule) lines.push({ kind: 'rule', text: rule });
    } else {
      lines.push({ kind: 'fact', text: `This step evaluates ${label(event.nodeId)}.` });
      const shown = input.values.get(key);
      lines.push({ kind: 'fact', text: shown === undefined ? `${title} has not been evaluated yet in this phase.` : `${title} shows ${pin} = ${shown} here.` });
    }
    return { heading, lines, pinNotes, cause: null, causeLabel: null };
  }

  // ── A published tick ──
  const shown = time.sample.get(key);
  const prior = previousTick(index, tick);
  const priorValue = prior === null ? undefined : timeline.ticks.get(prior)?.sample.get(key);
  const rises = time.phases.some((phase) => phase.kind === 'rise');
  const heading = rises ? `At t${tick} · after the clock edge` : `At t${tick}`;
  if (role === 'clock') return { heading: `At t${tick}`, lines: clockLines(timeline, key, tick, title), pinNotes, cause: null, causeLabel: null };
  if (shown === undefined) {
    // Say why when the recording knows: e.g. the simulator could not run the design at all.
    const why = timeline.coverage.kind === 'none' && timeline.coverage.reason === 'unavailable' && timeline.coverage.detail === 'invalid-ir' ? coverageLimit(timeline, tick) : null;
    return { heading, lines: [{ kind: 'limitation', text: why ?? `This recording has no sample of ${title} at t${tick}.` }], pinNotes, cause: null, causeLabel: null };
  }
  if (prior !== null && priorValue !== undefined) {
    lines.push({ kind: 'fact', text: priorValue === shown ? `${title} was ${priorValue} at t${prior} and is still ${shown} at t${tick}.` : `${title} was ${priorValue} at t${prior} and is ${shown} at t${tick}.` });
  } else {
    lines.push({ kind: 'fact', text: `${title} is ${shown} at t${tick}, the first recorded tick.` });
  }

  const limit = coverageLimit(timeline, tick);
  if (limit) {
    lines.push({ kind: 'limitation', text: limit });
    if (rule) lines.push({ kind: 'rule', text: rule });
    return { heading, lines, pinNotes, cause: { kind: 'unavailable', reason: limit }, causeLabel: null };
  }

  const cause = findCause(timeline, nodeId, pin, tick);
  const sample = time.phases[time.samplePhase];
  const own = sample?.events.filter((event) => event.nodeId === nodeId) ?? [];
  if (role === 'register') {
    // Explain the evaluation that changed the value in this tick (an edge, or a clear without
    // one); with no change in this tick, the evaluation behind the sample.
    const changedHere = cause.kind === 'changed' && cause.place.tick === tick && isCapture(cause.place.event) ? cause.place.event : null;
    const subject = changedHere ?? own.find(isCapture);
    if (subject) {
      lines.push(...registerLines(subject, pin, title, clockPins, label, tick, input.unconnectedPins).lines);
      // The pins show values after the edge; a data input may have settled to a new value since
      // the capture read it (the registers' own change fed back through the logic).
      for (const read of subject.inputReads) {
        if (clockPins.includes(read.portName)) continue;
        const read0 = logicValue(read.value);
        const settled = time.sample.get(`${nodeId}.${read.portName}`);
        if (read0 !== undefined && settled !== undefined && settled !== read0) {
          lines.push({ kind: 'fact', text: `After that, ${read.portName} settled to ${settled}; the pins show the values at the sample.` });
        }
      }
    }
    if (cause.kind === 'changed' && cause.place.tick !== tick) {
      lines.push({ kind: 'fact', text: `It last changed ${whenText(cause.place, clockPins)} (${cause.from} → ${cause.to}).` });
    }
  } else if (role === 'io-in') {
    if (cause.kind === 'changed' && cause.place.tick === tick) lines.push({ kind: 'cause', text: `The test's inputs for t${tick} set it to ${shown}.` });
    else lines.push({ kind: 'cause', text: `The test's inputs hold it at ${shown}.` });
  } else {
    const last = own[own.length - 1];
    if (last) {
      const reads = readsText(last, clockPins, label, role === 'io-out');
      lines.push({ kind: 'cause', text: role === 'io-out' ? `It shows the value it reads: ${reads}.` : `${title} reads ${reads} and gives ${pin} = ${shown}.` });
    }
    if (cause.kind === 'changed') {
      const after = cause.place.event.evaluationPhase === 'after-capture' && changedCapture(cause.place) !== null;
      lines.push({ kind: 'fact', text: `It became ${cause.to} ${whenText(cause.place, clockPins)}${after ? ', once the stored values had updated' : ''}.` });
    }
  }
  if (rule) lines.push({ kind: 'rule', text: rule });
  if (cause.kind === 'held') lines.push({ kind: 'fact', text: `No recorded step changed it: it has been ${cause.value} since the recording began.` });
  if (cause.kind === 'unavailable') lines.push({ kind: 'limitation', text: cause.reason });
  return { heading, lines, pinNotes, cause, causeLabel: causeLabelFor(cause, role, title, tick, pin, clockPins) };
}
