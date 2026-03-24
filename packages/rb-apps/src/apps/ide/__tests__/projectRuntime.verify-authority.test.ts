// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { useCircuitStore } from '../../../stores/circuitStore';
import { deriveVerifySchedule } from '../../../fpga/boards/basys3/verifySchedule';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';
import { useProjectRuntime } from '../projectRuntime';

function buildAuthorityFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
    name: 'Verify Authority Fixture',
    description: 'Deterministic verify should ignore interactive sim state.',
    circuit: {
      nodes: [
        {
          id: 'sw0_node',
          type: 'INPUT',
          label: 'sw0',
          position: { x: 0, y: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ld0_node',
          type: 'OUTPUT',
          label: 'ld0',
          position: { x: 160, y: 0 },
          x: 160,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'SW0' }],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      { tick: 2, inputs: { sw0: 0 }, expected: { ld0: 0 } },
    ],
    meta: {
      projectId: 'rb-verify-authority-fixture',
    },
  };
}

function buildSequentialAuthorityFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    name: 'Sequential Verify Authority Fixture',
    description: 'Runtime verify should preserve the canonical clocked contract.',
    circuit: {
      nodes: [
        {
          id: 'd_node',
          type: 'INPUT',
          label: 'd',
          position: { x: 0, y: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'clk_node',
          type: 'INPUT',
          label: 'clk',
          position: { x: 0, y: 100 },
          x: 0,
          y: 100,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ff_node',
          type: 'DFlipFlop',
          label: 'ff0',
          position: { x: 220, y: 40 },
          x: 220,
          y: 40,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'q_node',
          type: 'OUTPUT',
          label: 'q',
          position: { x: 420, y: 40 },
          x: 420,
          y: 40,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'd_node', portName: 'out' },
          to: { nodeId: 'ff_node', portName: 'D' },
        },
        {
          from: { nodeId: 'clk_node', portName: 'out' },
          to: { nodeId: 'ff_node', portName: 'CLK' },
        },
        {
          from: { nodeId: 'ff_node', portName: 'Q' },
          to: { nodeId: 'q_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'd', nodeId: 'd_node', port: 'out', label: 'd', pin: 'SW0' },
        { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
      ],
      outputs: [{ id: 'q', nodeId: 'q_node', port: 'in', label: 'q', pin: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { d: 1 }, expected: { q: 1 } },
      { tick: 1, inputs: { d: 0 }, expected: { q: 0 } },
    ],
    meta: {
      projectId: 'rb-sequential-verify-authority-fixture',
    },
  };
}

describe('projectRuntime verify authority', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
    useProjectRuntime.getState().loadFromProject(buildAuthorityFixture());
  });

  it('keeps verify authority deterministic even after interactive sim state changes', () => {
    const runA = useProjectRuntime.getState().runVerification({
      scenarioId: 'project-verify-authority',
      scenarioName: 'Project Verification',
      deterministicHash: 'authority-hash',
      rows: [],
      ranAtIso: '2026-03-09T00:00:00.000Z',
      useRuntimeTrace: true,
    });

    const sim = useProjectRuntime.getState().actions.sim;
    sim.setInput('sw0_node', 1);
    sim.step();
    sim.setInput('sw0_node', 0);
    sim.step();
    sim.setInput('sw0_node', 1);
    sim.step();

    expect(useProjectRuntime.getState().sim.trace.length).toBeGreaterThan(0);

    const runB = useProjectRuntime.getState().runVerification({
      scenarioId: 'project-verify-authority',
      scenarioName: 'Project Verification',
      deterministicHash: 'authority-hash',
      rows: [],
      ranAtIso: '2026-03-09T00:01:00.000Z',
      useRuntimeTrace: false,
    });

    const failCountA = runA.report.rows.filter((row) => row.status === 'fail').length;
    const failCountB = runB.report.rows.filter((row) => row.status === 'fail').length;

    expect(runA.scenarioId).toBe('project-verify-authority');
    expect(runB.scenarioId).toBe('project-verify-authority');
    expect(runA.reportHash).toBe(runB.reportHash);
    expect(runA.deterministicHash).toBe(runB.deterministicHash);
    expect(failCountA).toBe(failCountB);
    expect(runA.firstFailingTick).toBe(runB.firstFailingTick);
    expect(runA.waveform.length).toBe(runB.waveform.length);
    expect(runA.traceWaveform).toBeUndefined();
    expect(runB.traceWaveform).toBeUndefined();
    expect(useProjectRuntime.getState().verifyLastRun?.traceWaveform).toBeUndefined();
  });

  it('preserves prior sim state and adds a guard when a design mutation produces invalid IR', () => {
    const sim = useProjectRuntime.getState().actions.sim;
    sim.toggleProbe({ key: 'ld0_node.in', label: 'LD0 In' });
    sim.setInput('sw0_node', 1);
    sim.step();

    const before = structuredClone(useProjectRuntime.getState().sim);
    const invalidCircuit = structuredClone(useProjectRuntime.getState().circuit);
    invalidCircuit.connections = [];

    useProjectRuntime.getState().markDesignMutated(invalidCircuit);

    const after = useProjectRuntime.getState().sim;

    expect(after.tick).toBe(before.tick);
    expect(after.trace).toEqual(before.trace);
    expect(after.inputs).toEqual(before.inputs);
    expect(after.signals).toEqual(before.signals);
    expect(after.probes).toEqual(before.probes);
    expect(after.guard?.reason).toBe('invalid-ir');
    expect(after.guard?.diagnostics.length).toBeGreaterThan(0);
  });

  it('keeps the default signal-tour showcase example passing deterministically', () => {
    localStorage.clear();
    useProjectRuntime.getState().resetToActiveExample();

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'signal-tour-smoke',
      scenarioName: 'Signal Tour Smoke',
      deterministicHash: 'signal-tour-hash',
      rows: [],
      ranAtIso: '2026-03-10T00:00:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.status).toBe('pass');
    expect(run.report.rows.every((row) => row.status === 'pass')).toBe(true);
    expect(run.firstFailingTick).toBeUndefined();
  });

  it('marks verify authority stale when a mapped pin changes after a passing verify run', () => {
    useProjectRuntime.getState().runVerification({
      scenarioId: 'mapping-mutation-stales-verify',
      scenarioName: 'Mapping Mutation Stales Verify',
      deterministicHash: 'mapping-mutation-stales-verify-hash',
      rows: [],
      ranAtIso: '2026-03-21T12:00:00.000Z',
      useRuntimeTrace: false,
    });

    const sw0RowId = useProjectRuntime
      .getState()
      .projectIoRows.find((row) => row.nodeId === 'sw0_node')?.id;

    expect(sw0RowId).toBeTruthy();
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(false);

    useProjectRuntime.getState().setMappingPin(sw0RowId!, 'SW1');

    const state = useProjectRuntime.getState();
    const readiness = {
      hasCircuit: state.circuit.nodes.length > 0,
      hasIoMapping: state.projectIoRows.filter((row) => row.required).every((row) => row.pin.trim().length > 0),
      hasVectors: state.projectVectors.length > 0,
      verifyQualification: state.verifyLastRun?.qualification,
    };
    const health = deriveProjectHealth(state.projectHealthCore, readiness);

    expect(state.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(choosePrimaryProjectCta(health, readiness)).toEqual({
      label: 'Verify',
      mode: 'verify',
      code: 'RBP1004',
    });
  });

  it('marks verify authority stale when auto-suggest changes pin assignments after a passing verify run', () => {
    const ld0RowId = useProjectRuntime
      .getState()
      .projectIoRows.find((row) => row.nodeId === 'ld0_node')?.id;

    expect(ld0RowId).toBeTruthy();

    useProjectRuntime.getState().setMappingPin(ld0RowId!, '');

    useProjectRuntime.getState().runVerification({
      scenarioId: 'auto-suggest-stales-verify',
      scenarioName: 'Auto Suggest Stales Verify',
      deterministicHash: 'auto-suggest-stales-verify-hash',
      rows: [],
      ranAtIso: '2026-03-21T12:05:00.000Z',
      useRuntimeTrace: false,
    });

    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(false);

    useProjectRuntime.getState().autoSuggestMapping();

    const state = useProjectRuntime.getState();
    const readiness = {
      hasCircuit: state.circuit.nodes.length > 0,
      hasIoMapping: state.projectIoRows.filter((row) => row.required).every((row) => row.pin.trim().length > 0),
      hasVectors: state.projectVectors.length > 0,
      verifyQualification: state.verifyLastRun?.qualification,
    };
    const health = deriveProjectHealth(state.projectHealthCore, readiness);

    expect(state.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(state.projectIoRows.find((row) => row.nodeId === 'ld0_node')?.pin.trim().length).toBeGreaterThan(0);
    expect(choosePrimaryProjectCta(health, readiness)).toEqual({
      label: 'Verify',
      mode: 'verify',
      code: 'RBP1004',
    });
  });

  it('ignores editor-store circuit drift and verifies the runtime-authoritative circuit', () => {
    useCircuitStore.getState().updateCircuit(
      {
        nodes: [
          {
            id: 'sw0_node',
            type: 'INPUT',
            label: 'sw0',
            position: { x: 0, y: 0 },
            x: 0,
            y: 0,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'ld0_node',
            type: 'OUTPUT',
            label: 'ld0',
            position: { x: 160, y: 0 },
            x: 160,
            y: 0,
            rotation: 0,
            config: {},
            state: {},
          },
        ],
        connections: [],
      },
      { skipHistory: true, enforceLimits: false }
    );

    expect(useCircuitStore.getState().circuit.connections).toHaveLength(0);
    expect(useProjectRuntime.getState().circuit.connections).toHaveLength(1);

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'runtime-circuit-authority',
      scenarioName: 'Runtime Circuit Authority',
      deterministicHash: 'runtime-circuit-authority-hash',
      rows: [],
      ranAtIso: '2026-03-18T00:00:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.status).toBe('pass');
    expect(run.report.rows.every((row) => row.status === 'pass')).toBe(true);
    expect(run.traceWaveform).toBeUndefined();
  });

  it('stores and reuses the canonical sequential schedule contract on runtime verify runs', () => {
    useProjectRuntime.getState().loadFromProject(buildSequentialAuthorityFixture());

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'runtime-sequential-authority',
      scenarioName: 'Runtime Sequential Authority',
      deterministicHash: 'runtime-sequential-authority-hash',
      rows: [],
      ranAtIso: '2026-03-18T12:00:00.000Z',
      useRuntimeTrace: false,
    });

    const state = useProjectRuntime.getState();
    const expectedContract = deriveVerifySchedule(state.circuit, {
      inputs: state.projectIoRows
        .filter((row) => row.direction === 'in')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
      outputs: state.projectIoRows
        .filter((row) => row.direction === 'out')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
    });

    expect(run.status).toBe('pass');
    expect(run.schedule).toBe('clocked_macro');
    expect(run.scheduleContract).toEqual(expectedContract);
    expect(run.meta.samplePoint).toBe(expectedContract.samplePoint);
    expect(run.meta.tick0Meaning).toBe(expectedContract.tick0Meaning);
    expect(state.verifyLastRun?.scheduleContract).toEqual(expectedContract);
  });

  it('creates a matching authoritative input row when generic design input is added', () => {
    const beforeState = useProjectRuntime.getState();
    const beforeNodeIds = new Set(beforeState.circuit.nodes.map((node) => node.id));
    const beforeRowCount = beforeState.projectIoRows.length;

    useProjectRuntime.getState().addDesignIo('input', { x: 320, y: 120 });

    const afterState = useProjectRuntime.getState();
    const addedNode = afterState.circuit.nodes.find(
      (node) => node.type === 'INPUT' && !beforeNodeIds.has(node.id)
    );

    expect(addedNode).toBeDefined();
    expect(afterState.projectIoRows).toHaveLength(beforeRowCount + 1);
    expect(
      afterState.projectIoRows.some(
        (row) =>
          row.nodeId === addedNode?.id &&
          row.direction === 'in' &&
          row.port === 'out' &&
          row.required === true
      )
    ).toBe(true);
  });

  it('creates a matching authoritative output row when generic design output is added', () => {
    const beforeState = useProjectRuntime.getState();
    const beforeNodeIds = new Set(beforeState.circuit.nodes.map((node) => node.id));
    const beforeRowCount = beforeState.projectIoRows.length;

    useProjectRuntime.getState().addDesignIo('output', { x: 420, y: 120 });

    const afterState = useProjectRuntime.getState();
    const addedNode = afterState.circuit.nodes.find(
      (node) => node.type === 'OUTPUT' && !beforeNodeIds.has(node.id)
    );

    expect(addedNode).toBeDefined();
    expect(afterState.projectIoRows).toHaveLength(beforeRowCount + 1);
    expect(
      afterState.projectIoRows.some(
        (row) =>
          row.nodeId === addedNode?.id &&
          row.direction === 'out' &&
          row.port === 'in' &&
          row.required === true
      )
    ).toBe(true);
  });

  it('uses the live verification session vectors instead of only stored project vectors', () => {
    useProjectRuntime.getState().setVectors([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } },
    ]);

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'live-session-vectors',
      scenarioName: 'Live Session Vectors',
      deterministicHash: 'live-session-vectors-hash',
      rows: [],
      vectors: [{ tick: 0, inputs: { sw0: 0 }, expected: {} }],
      ranAtIso: '2026-03-23T09:00:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.status).toBe('pass');
    expect(run.report.vectors[0]?.expected).toEqual({});
    expect(run.report.rows).toEqual([]);
  });

  it('marks verify stale when custom vectors change and preserves unset expected outputs', () => {
    useProjectRuntime.getState().runVerification({
      scenarioId: 'custom-vectors-dirty',
      scenarioName: 'Custom Vectors Dirty',
      deterministicHash: 'custom-vectors-dirty-hash',
      rows: [],
      ranAtIso: '2026-03-23T09:10:00.000Z',
      useRuntimeTrace: false,
    });

    useProjectRuntime.getState().setCustomVectors([
      { id: 'cv-01', tick: 0, inputs: { sw0: 1 }, expected: {} },
    ]);

    const state = useProjectRuntime.getState();
    expect(state.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(state.customVectors).toEqual([
      { id: 'cv-01', tick: 0, inputs: { sw0: 1 }, expected: {} },
    ]);
  });

  it('rebinds project and custom vectors to renamed live IO rows after a design mutation', () => {
    useProjectRuntime.getState().setCustomVectors([
      { id: 'cv-01', tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);

    const renamedCircuit = structuredClone(useProjectRuntime.getState().circuit);
    renamedCircuit.nodes = renamedCircuit.nodes.map((node) => {
      if (node.id === 'sw0_node') return { ...node, label: 'switch_a' };
      if (node.id === 'ld0_node') return { ...node, label: 'led_a' };
      return node;
    });

    useProjectRuntime.getState().applyCircuitMutation(renamedCircuit);

    const state = useProjectRuntime.getState();
    expect(state.projectIoRows.find((row) => row.nodeId === 'sw0_node')?.id).toBe('switch_a');
    expect(state.projectIoRows.find((row) => row.nodeId === 'ld0_node')?.id).toBe('led_a');
    expect(state.projectVectors[0]?.inputs).toEqual({ switch_a: 0 });
    expect(state.projectVectors[0]?.expected).toEqual({ led_a: 0 });
    expect(state.customVectors[0]?.inputs).toEqual({ switch_a: 1 });
    expect(state.customVectors[0]?.expected).toEqual({ led_a: 1 });

    const run = state.runVerification({
      scenarioId: 'renamed-live-io',
      scenarioName: 'Renamed Live IO',
      deterministicHash: 'renamed-live-io-hash',
      rows: [],
      ranAtIso: '2026-03-23T09:20:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.status).toBe('pass');
    expect(run.report.vectors[0]?.inputs).toEqual({ switch_a: 0 });
    expect(run.report.vectors[0]?.expected).toEqual({ led_a: 0 });
  });

  it('prunes removed outputs from project and custom vectors after a design mutation', () => {
    useProjectRuntime.getState().setCustomVectors([
      { id: 'cv-01', tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);

    const reducedCircuit = structuredClone(useProjectRuntime.getState().circuit);
    reducedCircuit.nodes = reducedCircuit.nodes.filter((node) => node.id !== 'ld0_node');
    reducedCircuit.connections = reducedCircuit.connections.filter(
      (connection) => connection.to.nodeId !== 'ld0_node' && connection.from.nodeId !== 'ld0_node'
    );

    useProjectRuntime.getState().applyCircuitMutation(reducedCircuit);

    const state = useProjectRuntime.getState();
    expect(state.projectIoRows.some((row) => row.direction === 'out')).toBe(false);
    expect(state.projectVectors.every((vector) => Object.keys(vector.expected ?? {}).length === 0)).toBe(true);
    expect(state.customVectors[0]?.expected).toEqual({});

    const run = state.runVerification({
      scenarioId: 'removed-output-live-io',
      scenarioName: 'Removed Output Live IO',
      deterministicHash: 'removed-output-live-io-hash',
      rows: [],
      ranAtIso: '2026-03-23T09:30:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.status).toBe('pass');
    expect(run.report.rows).toEqual([]);
  });

  it('stays rebound across repeated design-edit and verify cycles without zombie signal keys', () => {
    const renameSeries = [
      { input: 'switch_a', output: 'led_a' },
      { input: 'switch_b', output: 'led_b' },
      { input: 'switch_c', output: 'led_c' },
    ];

    for (const [index, rename] of renameSeries.entries()) {
      const renamedCircuit = structuredClone(useProjectRuntime.getState().circuit);
      renamedCircuit.nodes = renamedCircuit.nodes.map((node) => {
        if (node.id === 'sw0_node') return { ...node, label: rename.input };
        if (node.id === 'ld0_node') return { ...node, label: rename.output };
        return node;
      });

      useProjectRuntime.getState().applyCircuitMutation(renamedCircuit);

      const state = useProjectRuntime.getState();
      expect(Object.keys(state.projectVectors[0]?.inputs ?? {})).toEqual([rename.input]);
      expect(Object.keys(state.projectVectors[0]?.expected ?? {})).toEqual([rename.output]);

      const run = state.runVerification({
        scenarioId: `rebind-cycle-${index + 1}`,
        scenarioName: `Rebind Cycle ${index + 1}`,
        deterministicHash: `rebind-cycle-${index + 1}`,
        rows: [],
        ranAtIso: `2026-03-23T09:${40 + index}:00.000Z`,
        useRuntimeTrace: false,
      });

      expect(run.status).toBe('pass');
      expect(
        run.report.vectors.every(
          (vector) =>
            Object.keys(vector.inputs).every((key) => key === rename.input) &&
            Object.keys(vector.expected).every((key) => key === rename.output)
        )
      ).toBe(true);
    }
  });
});
