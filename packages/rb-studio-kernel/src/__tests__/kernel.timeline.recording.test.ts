// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { deriveIdeBlockingDesignIssue, useProjectRuntime } from '@redbyte/rb-apps/runtime';
import { planStudioRun, type RuntimeVerifyRun } from '@redbyte/rb-apps/domain';
import { indexRecording, valuesAt } from '../recordingView';
import type { RecordingMoment } from '../moment';
import {
  captureFacts,
  RISE_AT,
  SAMPLE_AT,
  buildTimeline,
  findCause,
  isCapture,
  laneTicks,
  laneValueAt,
  pendingCaptures,
  roseByTheSample,
  placeMoment,
  type Timeline,
} from '../timeline';
import { explainSelection, type ExplainInput } from '../explain';

function record(prepare?: () => void): RuntimeVerifyRun {
  useProjectRuntime.getState().loadExample('two-bit-counter');
  prepare?.();
  const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
  return useProjectRuntime.getState().runVerification(plan.input);
}

const LABELS: Record<string, string> = {
  q0_ff: 'Q0', q1_ff: 'Q1', d0_rst: 'D0_RST', d1_rst: 'D1_RST', q0_out: 'LD0', q1_out: 'LD1', en_node: 'EN', rst_node: 'RST', xor1: 'XOR1', clk_node: 'CLK',
};
const label = (nodeId: string) => LABELS[nodeId] ?? nodeId;

const published = (run: RuntimeVerifyRun, tick: number): RecordingMoment => ({ source: 'recording', runId: run.runId!, tick, view: 'published', eventOrder: null });

function explain(run: RuntimeVerifyRun, timeline: Timeline, moment: RecordingMoment, part: Partial<ExplainInput> & { nodeId: string; pin: string }) {
  const index = indexRecording(run);
  return explainSelection({
    timeline, index, moment,
    nodeType: 'DFlipFlop', role: 'register', clockPins: ['CLK'], title: label(part.nodeId), label,
    values: valuesAt(run, index, moment),
    ...part,
  });
}

/** Every register output and every output it drives on the board, plus the boundary inputs. */
const REGISTER_LANES = ['q0_ff.Q', 'q1_ff.Q', 'q0_out.in', 'q1_out.in'];
const INPUT_LANES = ['en_node.out', 'rst_node.out'];

describe('time inside a recorded tick (2-Bit Up Counter, board-clock schedule)', () => {
  it('keeps three ordered phases per tick whose rising-edge settlement is exactly the published sample', () => {
    const run = record();
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    expect(timeline.coverage.kind).toBe('complete');
    for (const tick of index.ticks) {
      const time = timeline.ticks.get(tick)!;
      expect(time.evaluated).toBe(true);
      expect(time.phases.map((phase) => phase.kind)).toEqual(['inputs', 'rise', 'fall']);
      const settled = time.phases[time.samplePhase].end;
      const sample = valuesAt(run, index, published(run, tick));
      expect(sample.size).toBeGreaterThan(10);
      // Every value the sheet paints at tN is the value the rising-edge phase settled to.
      for (const [key, value] of sample) expect([key, settled.get(key)]).toEqual([key, value]);
    }
  });

  it('draws register outputs and the LEDs they drive changing at the rising edge, and inputs at the tick start', () => {
    const run = record();
    const timeline = buildTimeline(run, indexRecording(run));
    for (const key of REGISTER_LANES) {
      const lane = laneTicks(timeline, key);
      let edges = 0;
      lane.forEach((tick, position) => {
        const [inputs, rise, fall] = tick.segments;
        expect(inputs.from).toBe(0);
        expect(rise.from).toBe(RISE_AT);
        // Before the edge a register still holds what it held after the previous tick.
        if (position > 0) expect([key, tick.tick, inputs.value]).toEqual([key, tick.tick, lane[position - 1].segments[2].value]);
        expect(rise.value).toBe(tick.sample);
        expect(fall.value).toBe(rise.value);
        if (inputs.value !== rise.value) edges += 1;
      });
      // More than one clock event changes each sequential output in this recording.
      expect([key, edges >= 2]).toEqual([key, true]);
    }
    for (const key of INPUT_LANES) {
      for (const tick of laneTicks(timeline, key)) {
        expect(new Set(tick.segments.map((segment) => segment.value)).size).toBe(1);
        expect(tick.segments[0].value).toBe(tick.sample);
      }
    }
    // The counter's own story: Q1 rises at the edge of t3, Q0 falls at the same edge.
    const q1 = laneTicks(timeline, 'q1_ff.Q')[3];
    const q0 = laneTicks(timeline, 'q0_ff.Q')[3];
    expect([laneValueAt(q1, 0.1), laneValueAt(q1, SAMPLE_AT)]).toEqual([0, 1]);
    expect([laneValueAt(q0, 0.1), laneValueAt(q0, SAMPLE_AT)]).toEqual([1, 0]);
  });

  it('agrees with the sheet at every retained step: a shown value is the lane just before or just after its boundary', () => {
    const run = record();
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    let checked = 0;
    for (const tick of index.ticks) {
      for (const event of index.eventsByTick.get(tick) ?? []) {
        const moment: RecordingMoment = { ...published(run, tick), view: 'event', eventOrder: event.order };
        const place = placeMoment(timeline, moment)!;
        const values = valuesAt(run, index, moment);
        const pending = pendingCaptures(timeline, moment, (nodeId) => (nodeId.endsWith('_ff') ? 'Q' : null));
        for (const key of [...REGISTER_LANES, ...INPUT_LANES]) {
          const shown = values.get(key);
          if (shown === undefined) continue;
          const lane = laneTicks(timeline, key).find((entry) => entry.tick === tick)!;
          const before = place.at === 0 ? (laneTicks(timeline, key).find((entry) => entry.tick === index.ticks[index.ticks.indexOf(tick) - 1])?.segments.at(-1)?.value ?? shown) : laneValueAt(lane, place.at - 0.01);
          const after = laneValueAt(lane, place.at + 0.01);
          expect([key, tick, event.order, shown === before || shown === after]).toEqual([key, tick, event.order, true]);
          // A capture not yet committed shows the value from before the edge.
          const node = key.split('.')[0];
          if (pending.has(node) && key.endsWith('.Q')) expect(shown).toBe(pending.get(node)!.prior);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe('cause and explanation built from the retained evaluations', () => {
  it('finds the clock edge that set Q1 at t3, and from t4 still points back to that edge', () => {
    const run = record();
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    const capture = index.eventsByTick.get(3)!.find((event) => event.nodeId === 'q1_ff' && isCapture(event) && event.context.phase === 'macro-high-sample')!;
    const at3 = findCause(timeline, 'q1_ff', 'Q', 3);
    expect(at3).toMatchObject({ kind: 'changed', from: 0, to: 1 });
    if (at3.kind !== 'changed') throw new Error('unreachable');
    expect(at3.place.event.order).toBe(capture.order);
    expect(at3.place.phase.kind).toBe('rise');
    expect(at3.place.step).toBe(index.eventsByTick.get(3)!.indexOf(capture) + 1);
    expect(at3.place.of).toBe(index.eventsByTick.get(3)!.length);
    const at4 = findCause(timeline, 'q1_ff', 'Q', 4);
    expect(at4).toMatchObject({ kind: 'changed', from: 0, to: 1, place: { tick: 3 } });
    // Q0 holds 0 through t1: nothing changed it, and the explanation says so.
    expect(findCause(timeline, 'q0_ff', 'Q', 1)).toMatchObject({ kind: 'held', value: 0 });
    // LD1 follows Q1 just after the same edge, in the settling after the shared commit.
    const ld1 = findCause(timeline, 'q1_out', 'in', 3);
    expect(ld1).toMatchObject({ kind: 'changed', to: 1, place: { tick: 3, event: { nodeId: 'q1_out', evaluationPhase: 'after-capture' } } });
    // EN changed when t2's inputs were applied.
    expect(findCause(timeline, 'en_node', 'out', 3)).toMatchObject({ kind: 'changed', to: 1, place: { tick: 2, phase: { kind: 'inputs' } } });
  });

  it('explains Q1 at t3 in recorded facts: the previous value, the edge, D and the stored change', () => {
    const run = record();
    const timeline = buildTimeline(run, indexRecording(run));
    const explanation = explain(run, timeline, published(run, 3), { nodeId: 'q1_ff', pin: 'Q' });
    const text = explanation.lines.map((line) => line.text).join(' ');
    expect(explanation.heading).toBe('At t3 · after the clock edge');
    expect(text).toContain('Q1 was 0 at t2 and is 1 at t3.');
    expect(text).toContain('At the rising clock edge in t3, Q1 read D = 1 (from D1_RST).');
    expect(text).toContain('So its stored value changed 0 → 1.');
    expect(text).toContain('A D flip-flop copies D to Q at each rising clock edge');
    expect(text).not.toMatch(/unavailable|published sample|publication/i);
    expect(explanation.causeLabel).toBe('Show the clock edge that set Q1');
    // t4: Q1 kept its value at that edge; the explanation says when it last changed.
    const t4 = explain(run, timeline, published(run, 4), { nodeId: 'q1_ff', pin: 'Q' }).lines.map((line) => line.text).join(' ');
    expect(t4).toContain('Q1 was 1 at t3 and is still 1 at t4.');
    expect(t4).toContain('So it kept 1.');
    expect(t4).toContain('It last changed at the rising clock edge in t3 (0 → 1).');
    // At t4's edge Q1 read D = 1; Q0's own change then fed back and D settled to 0. Both facts are recorded.
    expect(t4).toContain('At the rising clock edge in t4, Q1 read D = 1 (from D1_RST).');
    expect(t4).toContain('After that, D settled to 0; the pins show the values at the sample.');
    expect(valuesAt(run, indexRecording(run), published(run, 4)).get('q1_ff.D')).toBe(0);
  });

  it('explains the capture step itself, with Q pending until the shared commit', () => {
    const run = record();
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    const cause = findCause(timeline, 'q1_ff', 'Q', 3);
    if (cause.kind !== 'changed') throw new Error('expected a change');
    const moment: RecordingMoment = { ...published(run, 3), view: 'event', eventOrder: cause.place.event.order };
    const explanation = explain(run, timeline, moment, { nodeId: 'q1_ff', pin: 'Q' });
    expect(explanation.heading).toBe(`t3 · rising clock edge · step ${cause.place.step} of ${cause.place.of}`);
    const text = explanation.lines.map((line) => line.text).join(' ');
    expect(text).toContain('At the rising clock edge Q1 reads D = 1 (from D1_RST).');
    expect(text).toContain('It captures 1: its stored value changes 0 → 1.');
    expect(text).toContain('Q still shows 0');
    expect(explanation.pinNotes.get('Q')).toBe('becomes 1');
    expect(valuesAt(run, index, moment).get('q1_ff.Q')).toBe(0);
    expect(pendingCaptures(timeline, moment, () => 'Q')).toEqual(new Map([['q0_ff', { prior: 1, next: 0, clocked: true }], ['q1_ff', { prior: 0, next: 1, clocked: true }]]));
    // Once the first evaluation after the shared commit runs, nothing is pending.
    const committed = index.eventsByTick.get(3)!.find((event) => event.context.phase === 'macro-high-sample' && event.evaluationPhase === 'after-capture')!;
    expect(pendingCaptures(timeline, { ...moment, eventOrder: committed.order }, () => 'Q').size).toBe(0);
    // With the clock low, the same register reads D but does not capture.
    const low = index.eventsByTick.get(3)!.find((event) => event.nodeId === 'q1_ff' && event.context.phase === 'macro-low-before')!;
    const lowText = explain(run, timeline, { ...moment, eventOrder: low.order }, { nodeId: 'q1_ff', pin: 'Q' }).lines.map((line) => line.text).join(' ');
    expect(lowText).toContain('With no rising clock edge (the clock is low), Q1 reads D = 1 (from D1_RST) and keeps 0.');
  });

  it('a shift register reads the neighbour before the shared commit (a second sequential topology)', () => {
    // Q1 takes Q0 directly: at each edge it must capture the Q0 from before that edge.
    const run = record(() => {
      const state = useProjectRuntime.getState();
      state.applyCircuitMutation({
        ...state.circuit,
        connections: state.circuit.connections.map((wire) => (typeof wire.to === 'object' && wire.to.nodeId === 'q1_ff' && wire.to.portName === 'D'
          ? { ...wire, id: 'q0-to-q1', from: { nodeId: 'q0_ff', portName: 'Q' } } : wire)),
      });
    });
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    const q0 = laneTicks(timeline, 'q0_ff.Q');
    const q1 = laneTicks(timeline, 'q1_ff.Q');
    let shifts = 0;
    for (let position = 1; position < index.ticks.length; position += 1) {
      expect(q1[position].sample).toBe(q0[position - 1].sample);
      if (q1[position].sample !== q1[position - 1].sample) shifts += 1;
      // Both change only at the edge.
      expect(q1[position].segments[0].value).toBe(q1[position - 1].segments[2].value);
    }
    expect(shifts).toBeGreaterThanOrEqual(2);
    const changed = q1.findIndex((tick, position) => position > 0 && tick.sample !== q1[position - 1].sample);
    const text = explain(run, timeline, published(run, index.ticks[changed]), { nodeId: 'q1_ff', pin: 'Q' }).lines.map((line) => line.text).join(' ');
    expect(text).toContain(`read D = ${q0[changed - 1].sample} (from Q0)`);
  });

  it('says exactly what is missing when the evaluations were not retained, and never names a cause', () => {
    const run = record();
    const samplesOnly = { ...run, evaluationTrace: undefined } as RuntimeVerifyRun;
    const timeline = buildTimeline(samplesOnly, indexRecording(samplesOnly));
    expect(timeline.coverage).toMatchObject({ kind: 'none', reason: 'absent' });
    expect(laneTicks(timeline, 'q1_ff.Q')[3]).toMatchObject({ evaluated: false, sample: 1 });
    expect(findCause(timeline, 'q1_ff', 'Q', 3).kind).toBe('unavailable');
    const explanation = explain(samplesOnly, timeline, published(samplesOnly, 3), { nodeId: 'q1_ff', pin: 'Q' });
    const text = explanation.lines.map((line) => line.text).join(' ');
    expect(text).toContain('Q1 was 0 at t2 and is 1 at t3.');
    expect(text).toContain('kept one sample per tick but not the evaluations inside each tick');
    expect(text).not.toMatch(/read D|stored value/);
    expect(explanation.causeLabel).toBeNull();

    // A trace cut by its size limit covers only the ticks before the cut.
    const events = run.evaluationTrace!.events.filter((event) => (event.context.tick ?? 0) < 4 || event.order < (run.evaluationTrace!.events.find((entry) => entry.context.tick === 4)!.order + 5));
    const truncated = { ...run, evaluationTrace: { ...run.evaluationTrace!, status: 'truncated', events } } as RuntimeVerifyRun;
    const cut = buildTimeline(truncated, indexRecording(truncated));
    expect(cut.coverage).toEqual({ kind: 'partial', lastTick: 3 });
    expect(cut.ticks.get(3)!.evaluated).toBe(true);
    expect(cut.ticks.get(4)!.evaluated).toBe(false);
    expect(findCause(cut, 'q1_ff', 'Q', 4)).toEqual({ kind: 'unavailable', reason: expect.stringContaining('only up to t3') });
  });

  it('explains a register cleared with no clock edge from its recorded facts, and never calls that step an edge', () => {
    // Q1 becomes a Register1 with an active-high asynchronous clear driven by NOT(EN). (The board-clock
    // policy drives the RST row itself, so the clear comes from EN, an ordinary stimulus.) EN drops at
    // t4 while Q1 = 1, so Q1 clears when t4's inputs are applied, with the clock low.
    const run = record(() => {
      const state = useProjectRuntime.getState();
      const en = [0, 1, 1, 1, 0, 0, 0];
      const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId)!;
      state.setVectors(scenario.vectors.map((vector) => ({ ...vector, inputs: { ...vector.inputs, en: en[vector.tick] ?? 0 }, expected: {} })));
      const next = useProjectRuntime.getState();
      next.applyCircuitMutation({
        ...next.circuit,
        nodes: [
          ...next.circuit.nodes.map((node) => (node.id === 'q1_ff' ? { ...node, type: 'Register1', config: { ...(node.config ?? {}), resetKind: 'async_clear' } } : node)),
          { id: 'nen', type: 'NOT', label: 'NEN', position: { x: 40, y: 40 } },
        ],
        connections: [
          ...next.circuit.connections,
          { id: 'en-nen', from: { nodeId: 'en_node', portName: 'out' }, to: { nodeId: 'nen', portName: 'in' } },
          { id: 'nen-q1', from: { nodeId: 'nen', portName: 'out' }, to: { nodeId: 'q1_ff', portName: 'RST' } },
        ],
      });
    });
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    expect([timeline.ticks.get(3)!.sample.get('q1_ff.Q'), timeline.ticks.get(4)!.sample.get('q1_ff.Q')]).toEqual([1, 0]);
    const cause = findCause(timeline, 'q1_ff', 'Q', 4);
    if (cause.kind !== 'changed') throw new Error(`expected a change, got ${cause.kind}`);
    expect(cause.place.phase.kind).toBe('inputs');
    expect(captureFacts(cause.place.event, 'Q', ['CLK'])).toMatchObject({ edge: null, changed: true, prior: 1, next: 0, resetActive: 'RST' });
    const published4 = explain(run, timeline, published(run, 4), { nodeId: 'q1_ff', pin: 'Q', nodeType: 'Register1' });
    const text = published4.lines.map((line) => line.text).join(' ');
    expect(text).toContain('Q1 was 1 at t3 and is 0 at t4.');
    expect(text).toContain('In t4, with no rising clock edge (the clock was low), Q1 read');
    expect(text).toContain('Its stored value changed 1 → 0 while RST = 1.');
    expect(text).not.toMatch(/kept|At the rising clock edge in t4/);
    expect(published4.causeLabel).toBe('Show the step that set Q1');
    const moment: RecordingMoment = { ...published(run, 4), view: 'event', eventOrder: cause.place.event.order };
    const step = explain(run, timeline, moment, { nodeId: 'q1_ff', pin: 'Q', nodeType: 'Register1' });
    const stepText = step.lines.map((line) => line.text).join(' ');
    expect(step.heading).toContain('inputs applied, clock low');
    expect(stepText).toContain('With no rising clock edge (the clock is low), Q1 reads');
    expect(stepText).toContain('Its stored value changes 1 → 0 while RST = 1.');
    expect(stepText).toContain('Q still shows 1: all stored values update together, just after this step.');
    expect(stepText).not.toMatch(/keeps 1|clock edge Q1/);
    expect(pendingCaptures(timeline, moment, () => 'Q').get('q1_ff')).toEqual({ prior: 1, next: 0, clocked: false });
  });

  it('reads edges from an authored clock (manual pulses), not from the phase name', () => {
    const run = record(() => {
      const state = useProjectRuntime.getState();
      const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId)!;
      state.setVectors(scenario.vectors.map((vector) => ({ ...vector, inputs: { ...vector.inputs, clk: vector.tick % 2 } })));
      useProjectRuntime.getState().updateScenarioSequentialPolicy({
        overrideMode: 'manual-pulses', runCycles: 1, activeEdge: 'rising', resetBehavior: 'none', sourceType: 'manual', executionModel: 'manual', signalId: 'clk',
      });
    });
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    // One authored engine tick per vector (after the engine's own initialisation): no macro phases.
    const phases = new Set(run.evaluationTrace!.events.map((event) => event.context.phase));
    expect(phases.has('authored-clock')).toBe(true);
    expect([...phases].filter((phase) => phase !== 'authored-clock' && phase !== 'initialize')).toEqual([]);
    const q0 = laneTicks(timeline, 'q0_ff.Q');
    const clock = laneTicks(timeline, 'clk_node.out');
    const changedAt = q0.findIndex((tick, position) => position > 0 && tick.sample !== q0[position - 1].sample);
    expect(changedAt).toBeGreaterThan(0);
    // Q0 changed only where the authored clock went 0 -> 1.
    expect([clock[changedAt - 1].sample, clock[changedAt].sample]).toEqual([0, 1]);
    const tick = index.ticks[changedAt];
    const cause = findCause(timeline, 'q0_ff', 'Q', tick);
    if (cause.kind !== 'changed') throw new Error('expected a change');
    expect(captureFacts(cause.place.event, 'Q', ['CLK'])).toMatchObject({ edge: 'rise', changed: true });
    const text = explain(run, timeline, published(run, tick), { nodeId: 'q0_ff', pin: 'Q' }).lines.map((line) => line.text).join(' ');
    expect(text).toContain(`At the rising clock edge in t${tick}, Q0 read`);
    const stepText = explain(run, timeline, { ...published(run, tick), view: 'event', eventOrder: cause.place.event.order }, { nodeId: 'q0_ff', pin: 'Q' })
      .lines.map((line) => line.text).join(' ');
    expect(stepText).toContain('At the rising clock edge Q0 reads');
    expect(stepText).not.toMatch(/no rising clock edge/);
    // A tick where the authored clock is low: no edge, and the explanation says so.
    const low = clock.findIndex((entry, position) => position > 0 && entry.sample === 0);
    const lowText = explain(run, timeline, published(run, index.ticks[low]), { nodeId: 'q0_ff', pin: 'Q' }).lines.map((line) => line.text).join(' ');
    expect(lowText).toContain(`In t${index.ticks[low]} Q0 saw no rising clock edge (the clock was low), so it kept`);
    // The clock's own story comes from its recorded lane.
    const clockText = explain(run, timeline, published(run, tick), { nodeId: 'clk_node', pin: 'out', role: 'clock', title: 'CLK' }).lines.map((line) => line.text).join(' ');
    expect(clockText).toContain(`In t${tick} CLK went 0 → 1.`);
    expect(clockText).toContain('It rose once in this tick');
    // LD0 follows Q0 after the shared commit of that authored edge: named as such, as on the board clock.
    const ld0 = findCause(timeline, 'q0_out', 'in', tick);
    expect(ld0).toMatchObject({ kind: 'changed', place: { tick, event: { evaluationPhase: 'after-capture' } } });
    const ld0Text = explain(run, timeline, published(run, tick), { nodeId: 'q0_out', pin: 'in', role: 'io-out', nodeType: 'OUTPUT', title: 'LD0' }).lines.map((line) => line.text).join(' ');
    expect(ld0Text).toContain(`just after the rising clock edge in t${tick}, once the stored values had updated.`);
    expect(ld0Text).not.toMatch(/inputs were applied/);
  });

  it('reads the clock level before t0 from the recording: an authored clock that starts high rises in t0', () => {
    const run = record(() => {
      const state = useProjectRuntime.getState();
      const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId)!;
      state.setVectors(scenario.vectors.map((vector) => ({ ...vector, inputs: { ...vector.inputs, clk: (vector.tick + 1) % 2 } })));
      useProjectRuntime.getState().updateScenarioSequentialPolicy({
        overrideMode: 'manual-pulses', runCycles: 1, activeEdge: 'rising', resetBehavior: 'none', sourceType: 'manual', executionModel: 'manual', signalId: 'clk',
      });
    });
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    expect(timeline.ticks.get(0)!.sample.get('clk_node.out')).toBe(1);
    const t0 = timeline.ticks.get(0)!;
    const capture = t0.phases[t0.samplePhase].events.find((event) => event.nodeId === 'q0_ff' && event.evaluationPhase === 'capture')!;
    // The register recorded a rising edge at t0; the clock's own story must agree.
    expect(captureFacts(capture, 'Q', ['CLK']).clocked).toBe(true);
    expect(roseByTheSample(timeline, 'clk_node.out', 0)).toBe(true);
    const clockText = explain(run, timeline, published(run, 0), { nodeId: 'clk_node', pin: 'out', role: 'clock', title: 'CLK' }).lines.map((line) => line.text).join(' ');
    expect(clockText).toContain('In t0 CLK went 0 → 1.');
    expect(clockText).toContain('It rose once in this tick');
  });

  it('says what held a register that kept its value at an edge where it read different data', () => {
    // Q0 becomes a Register1 that has an enable input and nothing wired to it: the engine reads EN as 0.
    const run = record(() => {
      const state = useProjectRuntime.getState();
      state.applyCircuitMutation({
        ...state.circuit,
        nodes: state.circuit.nodes.map((node) => (node.id === 'q0_ff' ? { ...node, type: 'Register1', config: { ...(node.config ?? {}), hasEnable: true } } : node)),
      });
    });
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    const tick = index.ticks.find((entry) => {
      const time = timeline.ticks.get(entry)!;
      const capture = time.phases[time.samplePhase]?.events.find((event) => event.nodeId === 'q0_ff' && event.evaluationPhase === 'capture');
      const data = capture?.inputReads.find((read) => read.portName === 'D');
      return capture && data && Number(data.value) === 1 && captureFacts(capture, 'Q', ['CLK']).clocked && !captureFacts(capture, 'Q', ['CLK']).changed;
    });
    expect(tick).toBeDefined();
    const text = explain(run, timeline, published(run, tick!), { nodeId: 'q0_ff', pin: 'Q', nodeType: 'Register1', title: 'Q0', unconnectedPins: ['EN'] })
      .lines.map((line) => line.text).join(' ');
    expect(text).toContain(`At the rising clock edge in t${tick}, Q0 read`);
    expect(text).toContain('So it kept 0, although it read D = 1; its EN input is unconnected.');
  });

  it('blames the evaluation that set a value, for a clock-fed gate and for a glitch that reverts', () => {
    const run = record(() => {
      const state = useProjectRuntime.getState();
      state.applyCircuitMutation({
        ...state.circuit,
        nodes: [...state.circuit.nodes, { id: 'nclk', type: 'NOT', label: 'NCLK', position: { x: 40, y: 40 } }, { id: 'xq', type: 'XOR', label: 'XQ', position: { x: 40, y: 80 } }],
        connections: [
          ...state.circuit.connections,
          { id: 'clk-nclk', from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'nclk', portName: 'in' } },
          { id: 'clk-xq', from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'xq', portName: 'a' } },
          { id: 'q0-xq', from: { nodeId: 'q0_ff', portName: 'Q' }, to: { nodeId: 'xq', portName: 'b' } },
        ],
      });
    });
    const index = indexRecording(run);
    const timeline = buildTimeline(run, index);
    // NOT(CLK) falls when the clock rises, before any register captures.
    const nclk = findCause(timeline, 'nclk', 'out', 3);
    if (nclk.kind !== 'changed') throw new Error('expected a change');
    expect(nclk.place).toMatchObject({ tick: 3, phase: { kind: 'rise' }, event: { evaluationPhase: 'before-capture' } });
    const nclkText = explain(run, timeline, published(run, 3), { nodeId: 'nclk', pin: 'out', role: 'logic', nodeType: 'NOT', title: 'NCLK' }).lines.map((line) => line.text).join(' ');
    expect(nclkText).toContain('It became 0 as the clock rose in t3.');
    expect(nclkText).not.toMatch(/stored values had updated/);
    // XOR(CLK, Q0) at t2: 1 when the clock rises, back to 0 once Q0 has updated. The cause is the revert.
    expect([timeline.ticks.get(1)!.sample.get('xq.out'), timeline.ticks.get(2)!.sample.get('xq.out')]).toEqual([1, 0]);
    const xq = findCause(timeline, 'xq', 'out', 2);
    expect(xq).toMatchObject({ kind: 'changed', to: 0, place: { tick: 2, event: { evaluationPhase: 'after-capture' } } });
    const xqText = explain(run, timeline, published(run, 2), { nodeId: 'xq', pin: 'out', role: 'logic', nodeType: 'XOR', title: 'XQ' }).lines.map((line) => line.text).join(' ');
    expect(xqText).toContain('It became 0 just after the rising clock edge in t2, once the stored values had updated.');
    expect(xqText).not.toMatch(/No recorded step changed it/);
    // The board clock's own story at t3: low, then the rising edge, then the fall.
    const clockText = explain(run, timeline, published(run, 3), { nodeId: 'clk_node', pin: 'out', role: 'clock', title: 'CLK' }).lines.map((line) => line.text).join(' ');
    expect(clockText).toContain('In t3 CLK went 0 → 1 → 0.');
  });
});
