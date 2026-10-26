// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { deriveIdeBlockingDesignIssue, useProjectRuntime } from '@redbyte/rb-apps/runtime';
import {
  BASYS3_BOARD_RESOURCES,
  getDesignChipMetadata,
  getDesignChipMetadataForNode,
  journeyValues,
  planStudioRun,
  type RuntimeVerifyRun,
} from '@redbyte/rb-apps/domain';
import { buildCircuitScene, type SceneMetadataResolver } from '@redbyte/rb-logic-view/scene';
import { defaultZeroReads, indexRecording, paintVerdict, stepEvent, valuesAt } from '../recordingView';
import { createResolver, unconnectedInputPins } from '../resolver';
import type { RecordingMoment } from '../moment';
import { buildTimeline, coverageLimit, laneTicks } from '../timeline';

const metadata: SceneMetadataResolver = (type, node) =>
  node ? getDesignChipMetadataForNode(node) ?? getDesignChipMetadata(type) : getDesignChipMetadata(type);

function loadCounter() {
  useProjectRuntime.getState().loadExample('two-bit-counter');
  return useProjectRuntime.getState();
}

function runActiveScenario(): RuntimeVerifyRun {
  const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
  return useProjectRuntime.getState().runVerification(plan.input);
}

function verdictNow(run: RuntimeVerifyRun) {
  const state = useProjectRuntime.getState();
  return paintVerdict({
    projectId: state.projectId,
    run,
    circuit: state.circuit,
    hierarchy: state.hierarchy,
    projectIoRows: state.projectIoRows,
    hardwareMappingV2: state.hardwareMappingV2,
    scenarios: state.scenarios,
    dirtySinceVerify: state.projectHealthCore.dirtySinceVerify,
  });
}

function mutate(change: (circuit: Circuit) => Circuit) {
  const state = useProjectRuntime.getState();
  state.applyCircuitMutation(change(structuredClone(state.circuit)));
}

const published = (run: RuntimeVerifyRun, tick: number): RecordingMoment => ({
  source: 'recording', runId: run.runId!, tick, view: 'published', eventOrder: null,
});

describe('studio run plan and recording views on the shipped 2-Bit Up Counter', () => {
  it('plans the active scenario the way Simulate does and records 14 passing checks with evaluations', () => {
    loadCounter();
    const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
    expect(plan.vectorCount).toBe(7);
    expect(plan.checkCount).toBe(14);
    expect(plan.clockPolicy?.overrideMode).toBe('auto');
    expect(plan.input.runKind).toBe('verify');
    const run = useProjectRuntime.getState().runVerification(plan.input);
    expect(run.status).toBe('pass');
    expect(run.schedule).toBe('clocked_macro');
    expect(run.report.rows).toHaveLength(14);
    expect(run.report.rows.every((row) => row.expected === row.actual)).toBe(true);
    expect(run.evaluationTrace?.status).toBe('complete');
    const index = indexRecording(run);
    expect(index.legacyEngine).toBe(false);
    expect(index.hasGeneratedSource).toBe(true);
    expect(index.ticks.slice(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('never paints a recording that has no design identity (an older engine)', () => {
    loadCounter();
    const run = runActiveScenario();
    expect(verdictNow(run).paintEligible).toBe(true);
    const legacy = { ...run, identity: undefined, scheduleContract: undefined } as RuntimeVerifyRun;
    const verdict = verdictNow(legacy);
    expect(verdict.legacy).toBe(true);
    expect(verdict.paintEligible).toBe(false);
    expect(verdict.withdraw.sheet).toBe(true);
  });

  it('carries the workbench schedule contract and turns checks off while a Design issue blocks them', () => {
    loadCounter();
    const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
    expect(plan.blockingIssue).toBeNull();
    expect(plan.input.scheduleContract?.schedule).toBe('clocked_macro');
    expect(plan.input.scheduleContract?.timingMode).toBe('synchronous_board_clock');

    // The student owns the checks (the first behaviour-changing edit of an example otherwise
    // discards its inherited starter expectations, by design).
    const authored = useProjectRuntime.getState();
    authored.setVectors(authored.scenarios.find((scenario) => scenario.id === authored.activeScenarioId)!.vectors);
    // XOR0.b driven from RST0 instead of EN: a combinational loop (XOR0 -> RST0 -> XOR0), which
    // the workbench refuses to grade (RBEX4102, compiler IR006). A floating output is only a
    // warning there, so it would not block.
    const state = useProjectRuntime.getState();
    state.applyCircuitMutation({
      ...state.circuit,
      connections: [
        ...state.circuit.connections.filter((wire) => !(typeof wire.to === 'object' && wire.to.nodeId === 'xor0' && wire.to.portName === 'b')),
        { id: 'loop', from: { nodeId: 'd0_rst', portName: 'out' }, to: { nodeId: 'xor0', portName: 'b' } },
      ],
    });
    const blocked = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
    expect(blocked.blockingIssue).not.toBeNull();
    expect(blocked.authoredCheckCount).toBe(14);
    expect(blocked.checkCount).toBe(0);
    expect(blocked.input.assertionMode).toBe(false);
    expect(blocked.input.runKind).toBe('trace');
    expect(blocked.input.rows).toEqual([]);
    const run = useProjectRuntime.getState().runVerification(blocked.input);
    expect(run.report.rows).toHaveLength(0);

    // The loop makes the model unrunnable: the engine records the test inputs only. Those inputs
    // are still recorded values (never drawn as unrecorded); nothing else is, and nothing is invented.
    expect(run.evaluationTrace).toMatchObject({ status: 'unavailable', unavailableReason: 'invalid-ir' });
    const index = indexRecording(run);
    const t2 = valuesAt(run, index, published(run, 2));
    expect([t2.get('en_node.out'), t2.get('rst_node.out')]).toEqual([1, 0]);
    expect(t2.has('q1_ff.Q')).toBe(false);
    expect(t2.has('q1_out.in')).toBe(false);
    const timeline = buildTimeline(run, index);
    expect(timeline.coverage).toEqual({ kind: 'none', reason: 'unavailable', detail: 'invalid-ir' });
    expect(coverageLimit(timeline, 2)).toBe('The simulator could not run this design, so only the test inputs were recorded.');
    expect(laneTicks(timeline, 'en_node.out').map((tick) => tick.sample).slice(0, 4)).toEqual([0, 0, 1, 1]);
  });

  it('reads t3 exactly as the recording published it, and keeps a capture pending in the event view', () => {
    loadCounter();
    const run = runActiveScenario();
    const index = indexRecording(run);
    const t3 = valuesAt(run, index, published(run, 3));
    expect(t3.get('q1_ff.Q')).toBe(1);
    expect(t3.get('q0_ff.Q')).toBe(0);
    expect(t3.get('q1_out.in')).toBe(1);
    expect(t3.get('q0_out.in')).toBe(0);
    // Identical to the existing Signal Journey reader, key for key.
    const reference = journeyValues(run, { projectId: '', revision: '', runId: run.runId!, tick: 3, nodeId: '', port: '', instancePath: [], bit: null, eventOrder: null }, undefined);
    expect([...t3.entries()].sort()).toEqual([...reference.entries()].sort());

    // The rising edge of tick 3 is its macro-high-sample phase; other phases capture without an edge.
    const capture = index.eventsByTick.get(3)!.find((event) =>
      event.nodeId === 'q1_ff' && event.evaluationPhase === 'capture' && event.context.phase === 'macro-high-sample')!;
    expect(capture.previousOutputs.Q).toBe(0);
    expect(capture.outputs.Q).toBe(1);
    const atCapture = valuesAt(run, index, { ...published(run, 3), view: 'event', eventOrder: capture.order });
    expect(atCapture.get('q1_ff.Q')).toBe(0); // captured, not yet published
    const entered = stepEvent(index, published(run, 3), 1)!;
    expect(entered).toMatchObject({ tick: 3, view: 'event', eventOrder: index.eventsByTick.get(3)![0].order });
    const next = stepEvent(index, entered, 1)!;
    expect(next.eventOrder).toBe(index.eventsByTick.get(3)![1].order);
  });

  it('identifies an unconnected input from topology, records no value for it, and keeps it apart from a logic 0', () => {
    loadCounter();
    mutate((circuit) => ({
      ...circuit,
      connections: circuit.connections.filter((wire) => !(typeof wire.to === 'object' && wire.to.nodeId === 'xor0' && wire.to.portName === 'b')),
    }));
    const run = runActiveScenario();
    const index = indexRecording(run);
    const scene = buildCircuitScene(run.circuitSnapshot!, metadata);
    expect(unconnectedInputPins(scene).has('xor0.b')).toBe(true);
    // The engine never recorded a read for it: absent, not 0.
    expect(valuesAt(run, index, published(run, 3)).has('xor0.b')).toBe(false);
    const xorEvents = (index.eventsByTick.get(3) ?? []).filter((event) => event.nodeId === 'xor0');
    expect(xorEvents.length).toBeGreaterThan(0);
    expect(xorEvents.every((event) => event.inputReads.every((read) => read.portName !== 'b'))).toBe(true);
    // Connected inputs read before their driver published are a different, recorded origin.
    expect([...defaultZeroReads(index, 3)].every((key) => key !== 'xor0.b')).toBe(true);

    loadCounter();
    const intact = runActiveScenario();
    expect(unconnectedInputPins(buildCircuitScene(intact.circuitSnapshot!, metadata)).has('xor0.b')).toBe(false);
  });

  it('keeps painting through a move and a label rename, withdraws on a rewire, and repaints after undo without claiming currency', () => {
    loadCounter();
    const run = runActiveScenario();
    expect(verdictNow(run)).toMatchObject({ paintEligible: true, evidenceCurrent: true, withdraw: { sheet: false } });

    mutate((circuit) => ({ ...circuit, nodes: circuit.nodes.map((node) => (node.id === 'xor1' ? { ...node, position: { x: 300, y: 330 } } : node)) }));
    expect(verdictNow(run).paintEligible).toBe(true);
    mutate((circuit) => ({ ...circuit, nodes: circuit.nodes.map((node) => (node.id === 'xor1' ? { ...node, label: 'NEXT1' } : node)) }));
    expect(verdictNow(run).paintEligible).toBe(true);

    mutate((circuit) => ({
      ...circuit,
      connections: circuit.connections.map((wire) =>
        typeof wire.to === 'object' && wire.to.nodeId === 'xor1' && wire.to.portName === 'b'
          ? { ...wire, from: { nodeId: 'en_node', portName: 'out' } }
          : wire,
      ),
    }));
    const rewired = verdictNow(run);
    expect(rewired.paintEligible).toBe(false);
    expect(rewired.withdraw.sheet).toBe(true);
    expect(rewired.reasons).toContain('design');

    useProjectRuntime.getState().undoProjectEdit();
    const undone = verdictNow(run);
    expect(undone.paintEligible).toBe(true);
    expect(undone.withdraw.sheet).toBe(false);
    expect(undone.evidenceCurrent).toBe(false);
  });

  it('binds IO rows that name a package pin (the shipped Half Adder) to the catalog resource', () => {
    useProjectRuntime.getState().loadExample('half-adder');
    const state = useProjectRuntime.getState();
    const resolver = createResolver({ scene: buildCircuitScene(state.circuit, metadata), ioRows: state.projectIoRows, boardResources: BASYS3_BOARD_RESOURCES });
    expect(state.projectIoRows.some((row) => /^[A-Z]\d+$/.test(row.pin ?? ''))).toBe(true);
    expect(resolver.boardBindings().map((binding) => `${binding.name}:${binding.packagePin}`).sort()).toEqual(['LD0:U16', 'LD1:E19', 'SW0:V17', 'SW1:V16']);
    expect(resolver.nodeForBoardName('SW0')).toBe('sw0_node');
    expect(resolver.nodeForBoardName('LD0')).toBe('ld0_node');
  });

  it('resolves one register to its net, recorded lane, driving statement and board binding, and back', () => {
    loadCounter();
    const run = runActiveScenario();
    const scene = buildCircuitScene(run.circuitSnapshot!, metadata);
    const resolver = createResolver({ scene, run, ioRows: run.executionInput!.ioRows, boardResources: BASYS3_BOARD_RESOURCES });

    const register = resolver.resolve({ kind: 'node', scope: [], nodeId: 'q1_ff' });
    expect(register).toMatchObject({ nodeId: 'q1_ff', port: 'Q', netId: 'q1_ff.Q' });
    expect(register.lane).not.toBeNull();
    expect(register.spans.length).toBeGreaterThan(0);
    expect(register.spans[0].path).toBe('top.vhd');
    expect(resolver.nodeForSourceLine('top.vhd', register.spans[0].startLine)).toBe('q1_ff');

    const led = resolver.resolve({ kind: 'node', scope: [], nodeId: 'q1_out' });
    expect(led.board).toMatchObject({ name: 'LD1', packagePin: 'E19', direction: 'out' });
    expect(led.lane).toBe('q1_out.in');
    expect(resolver.resolve({ kind: 'boardPort', name: 'LD1' }).nodeId).toBe('q1_out');
    expect(resolver.nodeForBoardName('SW0')).toBe('en_node');
    expect(resolver.nodeForBoardName('BTNC')).toBe('rst_node');
    expect(resolver.resolve({ kind: 'net', scope: [], netId: 'q1_ff.Q' }).nodeId).toBe('q1_ff');
    expect(resolver.resolve({ kind: 'field', fieldId: 'q1', runSignal: null }).nodeId).toBe('q1_out');
    expect(resolver.resolve({ kind: 'boardPort', name: 'SW9' }).nodeId).toBeNull();
  });
});
