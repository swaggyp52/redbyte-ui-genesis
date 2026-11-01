// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { decodeRBProject, encodeRBProject, normalizeRBProject, type RBProject } from '../../../export/projectFormat';
import { mergePersistedRuntimeState, useProjectRuntime, type RuntimeVerifyRun } from '../projectRuntime';
import { BROWSER_ENGINE_VERSION, describeRecordingChanges, firstRecordingDifference } from '../runDeterminism';

/**
 * RB-DEBT-014 at the recording owner: RunIdentity hashes the design in codepoint order,
 * so it is blind to node-array order. A Run must therefore produce the same samples for
 * the authored array, the codec's re-sorted array, a saved-and-reopened file and a
 * page reload; otherwise one identity names two different recordings.
 */
const TIMESTAMP = '2026-10-26T00:00:00.000Z';

function project(name: string, circuit: RBProject['circuit'], ioMapping: RBProject['ioMapping'], vectors: RBProject['vectors']): RBProject {
  return { kind: 'rb-project', version: 1, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, name, circuit, ioMapping, vectors, meta: { projectId: `rb-${name}` } };
}

/** INPUT -> OR <-> Delay, OR -> OUTPUT, authored with the OR ahead of the Delay. */
function latchOnProject(): RBProject {
  return project('latch-on', {
    nodes: [
      { id: 'set_in', type: 'INPUT', label: 'SET', x: 0, y: 0, config: {}, state: {} },
      { id: 'or_gate', type: 'OR', x: 200, y: 0, config: {}, state: {} },
      { id: 'delay', type: 'Delay', x: 200, y: 120, config: { delay: 1 }, state: {} },
      { id: 'lamp_out', type: 'OUTPUT', label: 'LAMP', x: 400, y: 0, config: {}, state: {} },
    ],
    connections: [
      { from: { nodeId: 'set_in', portName: 'out' }, to: { nodeId: 'or_gate', portName: 'a' } },
      { from: { nodeId: 'delay', portName: 'out' }, to: { nodeId: 'or_gate', portName: 'b' } },
      { from: { nodeId: 'or_gate', portName: 'out' }, to: { nodeId: 'delay', portName: 'in' } },
      { from: { nodeId: 'or_gate', portName: 'out' }, to: { nodeId: 'lamp_out', portName: 'in' } },
    ],
  }, {
    inputs: [{ id: 'set', nodeId: 'set_in', port: 'out', label: 'SET', pin: 'SW0' }],
    outputs: [{ id: 'lamp', nodeId: 'lamp_out', port: 'in', label: 'LAMP', pin: 'LD0' }],
  }, [0, 1, 0, 0, 0, 0, 0, 0].map((set, tick) => ({ tick, inputs: { set_in: set }, expected: {} })));
}

/** A DLatch whose Q_inv feeds D, authored with its OUTPUT first in the array. */
function dlatchToggleProject(): RBProject {
  return project('dlatch-toggle', {
    nodes: [
      { id: 'q_out', type: 'OUTPUT', label: 'Q', x: 400, y: 0, config: {}, state: {} },
      { id: 'en_in', type: 'INPUT', label: 'EN', x: 0, y: 0, config: {}, state: {} },
      { id: 'latch', type: 'DLatch', x: 200, y: 0, config: {}, state: {} },
    ],
    connections: [
      { from: { nodeId: 'en_in', portName: 'out' }, to: { nodeId: 'latch', portName: 'EN' } },
      { from: { nodeId: 'latch', portName: 'Q_inv' }, to: { nodeId: 'latch', portName: 'D' } },
      { from: { nodeId: 'latch', portName: 'Q' }, to: { nodeId: 'q_out', portName: 'in' } },
    ],
  }, {
    inputs: [{ id: 'en', nodeId: 'en_in', port: 'out', label: 'EN', pin: 'SW0' }],
    outputs: [{ id: 'q', nodeId: 'q_out', port: 'in', label: 'Q', pin: 'LD0' }],
  }, [1, 1, 0, 1, 0, 0, 1, 1].map((en, tick) => ({ tick, inputs: { en_in: en }, expected: {} })));
}

function execute(reproduceRunId?: string): RuntimeVerifyRun {
  const state = useProjectRuntime.getState();
  return state.runVerification({ scenarioId: state.activeScenarioId, scenarioName: 'Node order',
    deterministicHash: 'node-order', rows: [], reproduceRunId, ranAtIso: TIMESTAMP });
}

function load(source: RBProject): string[] {
  localStorage.clear();
  useProjectRuntime.getState().loadFromProject(source);
  return useProjectRuntime.getState().circuit.nodes.map(node => node.id);
}

function outputSamples(run: RuntimeVerifyRun, nodeId: string): string[] {
  return run.waveform.map(sample => String(sample.signals[`${nodeId}.in`]));
}

describe('equal RunIdentity implies equal recorded samples across node orders (RB-DEBT-014)', () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ['latch-on', latchOnProject, 'lamp_out'],
    ['DLatch toggle', dlatchToggleProject, 'q_out'],
  ] as const)('%s: authored order, codec order, saved file and page reload record one output digest', (_name, build, output) => {
    const authored = build();
    const authoredIds = authored.circuit.nodes.map(node => node.id);
    const codecIds = normalizeRBProject(build()).circuit.nodes.map(node => node.id);
    expect(codecIds, 'the codec must re-sort this fixture, or the test proves nothing').not.toEqual(authoredIds);

    expect(load(structuredClone(authored))).toEqual(authoredIds);
    const authoredRun = execute();
    expect(authoredRun.waveform).toHaveLength(8);
    expect(new Set(outputSamples(authoredRun, output)).size, 'the fixture output must change over the run').toBeGreaterThan(1);

    // A page reload re-reads the persisted session through the codec.
    const restored = mergePersistedRuntimeState(JSON.parse(JSON.stringify(useProjectRuntime.getState())), useProjectRuntime.getState());
    useProjectRuntime.setState(restored);
    expect(useProjectRuntime.getState().circuit.nodes.map(node => node.id)).toEqual(codecIds);
    const reloadedRun = execute();

    expect(load(normalizeRBProject(build()))).toEqual(codecIds);
    const codecRun = execute();

    expect(load(decodeRBProject(encodeRBProject(build())))).toEqual(codecIds);
    const fileRun = execute();

    for (const [label, other] of [['reload', reloadedRun], ['codec', codecRun], ['saved file', fileRun]] as const) {
      expect(other.identity, `${label}: RunIdentity`).toEqual(authoredRun.identity);
      expect(firstRecordingDifference(authoredRun, other), `${label}: first differing sample`).toBeNull();
      expect(other.outputDigest, `${label}: output digest`).toBe(authoredRun.outputDigest);
    }
  });

  it('samples the DLatch toggle in the tick the latch publishes, so Q toggles on every enabled tick', () => {
    load(dlatchToggleProject());
    const run = execute();
    const q = outputSamples(run, 'q_out');
    const latchQ = run.waveform.map(sample => String(sample.signals['latch.Q']));
    expect(q).toEqual(latchQ);
    const enabled = [1, 1, 0, 1, 0, 0, 1, 1];
    for (let tick = 1; tick < q.length; tick += 1) {
      expect(q[tick], `tick ${tick}`).toBe(enabled[tick] === 1 ? (q[tick - 1] === '1' ? '0' : '1') : q[tick - 1]);
    }
  });

  it('marks recordings from the previous engine as Engine changed and refuses to reproduce them', () => {
    load(latchOnProject());
    const first = execute();
    expect(first.identity?.engine).toBe(BROWSER_ENGINE_VERSION);
    expect(BROWSER_ENGINE_VERSION).not.toBe('redbyte-browser-v2');
    const previousEngine = { ...first, identity: { ...first.identity!, engine: 'redbyte-browser-v2' } };
    expect(describeRecordingChanges(previousEngine, {})).toContain('Engine changed');
    useProjectRuntime.setState({ verifyRunArchive: [previousEngine] });
    expect(() => execute(first.runId)).toThrow(/engine version/);
  });
});
