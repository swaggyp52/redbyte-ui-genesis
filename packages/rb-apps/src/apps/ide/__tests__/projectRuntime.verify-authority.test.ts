// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { useCircuitStore } from '../../../stores/circuitStore';
import { deriveVerifySchedule } from '../../../fpga/boards/basys3/verifySchedule';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';
import { useProjectRuntime } from '../projectRuntime';
import { computeScenarioContentHash, materializeScenarioVectors } from '../verifyScenario';
import { createScenarioStep } from '../verifyScenarioSteps';

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
      { tick: 0, inputs: { d: 1, clk: 0 }, expected: { q: 1 } },
      { tick: 1, inputs: { d: 1, clk: 1 }, expected: { q: 1 } },
      { tick: 2, inputs: { d: 0, clk: 0 }, expected: { q: 0 } },
      { tick: 3, inputs: { d: 0, clk: 1 }, expected: { q: 0 } },
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

  it('keeps sequential execution intent isolated per scenario and stales generated Export', () => {
    const runtime = useProjectRuntime.getState();
    runtime.loadFromProject(buildSequentialAuthorityFixture());
    runtime.recordExport({ status: 'ok', hash: 'portable-export-hash' });
    runtime.updateScenarioSequentialPolicy({
      overrideMode: 'auto',
      runCycles: 6,
      activeEdge: 'rising',
      resetBehavior: 'none',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      signalId: 'clk_node_out',
      signalLabel: 'Board clock alias',
      startLevel: 0,
    });

    const authored = useProjectRuntime.getState();
    const originalId = authored.activeScenarioId;
    expect(authored.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(authored.projectHealthCore.dirtySinceExport).toBe(true);
    expect(authored.scenarios.find((scenario) => scenario.id === originalId)?.sequentialPolicy)
      .toMatchObject({ signalId: 'clk', signalLabel: 'clk', runCycles: 6 });

    runtime.duplicateScenario();
    const duplicated = useProjectRuntime.getState();
    const duplicateId = duplicated.activeScenarioId;
    expect(duplicateId).not.toBe(originalId);
    expect(duplicated.scenarios.find((scenario) => scenario.id === duplicateId)?.sequentialPolicy)
      .toEqual(duplicated.scenarios.find((scenario) => scenario.id === originalId)?.sequentialPolicy);

    runtime.renameScenario('Falling-transition debug');
    runtime.updateScenarioSequentialPolicy({
      ...useProjectRuntime.getState().scenarios.find((scenario) => scenario.id === duplicateId)!
        .sequentialPolicy!,
      overrideMode: 'manual-pulses',
      runCycles: 3,
      activeEdge: 'falling',
      executionModel: 'manual',
      sourceType: 'manual',
    });
    runtime.switchScenario(originalId);

    const finalState = useProjectRuntime.getState();
    expect(finalState.scenarios.find((scenario) => scenario.id === originalId)?.sequentialPolicy)
      .toMatchObject({ overrideMode: 'auto', runCycles: 6, activeEdge: 'rising' });
    expect(finalState.scenarios.find((scenario) => scenario.id === duplicateId)).toMatchObject({
      name: 'Falling-transition debug',
      sequentialPolicy: {
        overrideMode: 'manual-pulses',
        runCycles: 3,
        activeEdge: 'rising',
      },
    });
  });

  it('canonicalizes authored aliases before vectors and report evidence are materialized', () => {
    const runtime = useProjectRuntime.getState();
    runtime.loadFromProject(buildSequentialAuthorityFixture());
    runtime.setVectors([
      {
        tick: 0,
        inputs: { d_node_out: 0, d: 1, clk_node_out: 0 },
        expected: { q_node_in: 0, q: 1 },
      },
      {
        tick: 1,
        inputs: { d: 0, clk: 1 },
        expected: { q: '' as unknown as 0 },
      },
    ]);

    const [authoredVector, blankExpectedVector] = useProjectRuntime.getState().projectVectors;
    expect(authoredVector?.inputs).toEqual({ d: 1, clk: 0 });
    expect(authoredVector?.expected).toEqual({ q: 1 });
    expect(blankExpectedVector?.expected).toEqual({});

    const run = runtime.runVerification({
      scenarioId: useProjectRuntime.getState().activeScenarioId,
      scenarioName: 'Canonical aliases',
      deterministicHash: 'canonical-alias-report',
      rows: [],
      ranAtIso: '2026-07-22T12:00:00.000Z',
    });
    expect(run.report.vectors[0]?.inputs).toEqual({ d: 1, clk: 1 });
    expect(run.report.vectors[0]?.expected).toEqual({ q: 1 });
    expect(run.report.vectors[1]?.expected).toEqual({});
    expect(run.report.rows.every((row) => row.signal === 'q')).toBe(true);
  });

  it('preserves high authored start state until an explicit rising transition', () => {
    const runtime = useProjectRuntime.getState();
    runtime.loadFromProject(buildSequentialAuthorityFixture());
    const vectors = [
      { tick: 0, inputs: { d: 1, clk: 1 }, expected: { q: 0 } },
      { tick: 1, inputs: { d: 1 }, expected: { q: 0 } },
      { tick: 2, inputs: { d: 1, clk: 0 }, expected: { q: 0 } },
      { tick: 3, inputs: { d: 1 }, expected: { q: 0 } },
      { tick: 4, inputs: { d: 1, clk: 1 }, expected: { q: 1 } },
    ];

    const run = runtime.runVerification({
      scenarioId: useProjectRuntime.getState().activeScenarioId,
      scenarioName: 'High start authority',
      deterministicHash: 'high-start-authority',
      rows: [],
      vectors,
      clockPolicy: {
        signalId: 'clk',
        signalLabel: 'clk',
        sourceType: 'manual',
        executionModel: 'manual',
        overrideMode: 'manual-pulses',
        autoRunEnabled: false,
        activeEdge: 'rising',
        startLevel: 1,
        dutyCycle: 0.5,
        runCycles: 5,
        resetBehavior: 'none',
      },
      ranAtIso: '2026-07-22T12:05:00.000Z',
    });

    expect(run.status).toBe('pass');
    expect(run.report.vectors.map((vector) => vector.inputs.clk)).toEqual([1, 1, 0, 0, 1]);
    expect(run.report.rows.map((row) => row.actual)).toEqual(['0', '0', '0', '0', '1']);
  });

  it('sorts authored rows before carrying omitted manual clock values', () => {
    const runtime = useProjectRuntime.getState();
    runtime.loadFromProject(buildSequentialAuthorityFixture());

    const run = runtime.runVerification({
      scenarioId: useProjectRuntime.getState().activeScenarioId,
      scenarioName: 'Ordered manual clock carry',
      deterministicHash: 'ordered-manual-clock-carry',
      rows: [],
      vectors: [
        { tick: 2, inputs: { d: 1, clk: 1 }, expected: { q: 1 } },
        { tick: 0, inputs: { d: 1, clk: 0 }, expected: { q: 0 } },
        { tick: 1, inputs: { d: 1 }, expected: { q: 0 } },
      ],
      clockPolicy: {
        signalId: 'clk',
        signalLabel: 'clk',
        sourceType: 'manual',
        executionModel: 'manual',
        overrideMode: 'manual-pulses',
        autoRunEnabled: false,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 3,
        resetBehavior: 'none',
      },
      ranAtIso: '2026-07-22T12:05:30.000Z',
    });

    expect(run.status).toBe('pass');
    expect(run.report.vectors.map((vector) => vector.tick)).toEqual([0, 1, 2]);
    expect(run.report.vectors.map((vector) => vector.inputs.clk)).toEqual([0, 0, 1]);
    expect(run.report.rows.map((row) => row.actual)).toEqual(['0', '0', '1']);
  });

  it('resolves label-only authored clock policy before carrying omitted clock rows', () => {
    const runtime = useProjectRuntime.getState();
    const project = buildSequentialAuthorityFixture();
    project.ioMapping = {
      ...project.ioMapping!,
      inputs: project.ioMapping!.inputs.map((row) =>
        row.id === 'clk' ? { ...row, label: 'Clock' } : row
      ),
    };
    runtime.loadFromProject(project);

    const run = runtime.runVerification({
      scenarioId: useProjectRuntime.getState().activeScenarioId,
      scenarioName: 'Label-only clock carry',
      deterministicHash: 'label-only-clock-carry',
      rows: [],
      vectors: [
        { tick: 0, inputs: { d: 1, clk: 0 }, expected: { q: 0 } },
        { tick: 1, inputs: { d: 1 }, expected: { q: 0 } },
        { tick: 2, inputs: { d: 1, clk: 1 }, expected: { q: 1 } },
      ],
      clockPolicy: {
        signalLabel: 'Clock',
        sourceType: 'manual',
        executionModel: 'manual',
        overrideMode: 'manual-pulses',
        autoRunEnabled: false,
        activeEdge: 'rising',
        startLevel: 1,
        dutyCycle: 0.5,
        runCycles: 3,
        resetBehavior: 'none',
      },
      ranAtIso: '2026-07-22T12:06:00.000Z',
    });

    expect(run.status).toBe('pass');
    expect(run.report.vectors.map((vector) => vector.inputs.clk)).toEqual([0, 0, 1]);
    expect(run.report.rows.map((row) => row.actual)).toEqual(['0', '0', '1']);
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

  it('persists trace-only run provenance when compare is explicitly disabled', () => {
    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'trace-only-authority',
      scenarioName: 'Trace Only Authority',
      deterministicHash: 'trace-authority-hash',
      scenarioVersion: 3,
      scenarioContentHash: 'scenario-hash-trace',
      assertionMode: false,
      rows: [],
      ranAtIso: '2026-03-25T00:00:00.000Z',
    });

    const state = useProjectRuntime.getState();
    const health = deriveProjectHealth(state.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: state.verifyLastRun?.qualification,
    });

    expect(run.runKind).toBe('trace');
    expect(run.scenarioVersion).toBe(3);
    expect(run.scenarioContentHash).toBeUndefined();
    expect(state.verifyLastRun?.runKind).toBe('trace');
    expect(state.projectHealthCore.lastVerify?.runKind).toBe('trace');
    expect(
      choosePrimaryProjectCta(health, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: state.verifyLastRun?.qualification,
      })
    ).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });
  });

  it('trace-only run produces no comparison failures even when expected values are wrong', () => {
    // Override vectors with intentionally wrong expected values.
    // Circuit is sw0→ld0 (pass-through): sw0=0 → ld0=0, sw0=1 → ld0=1.
    // We set the inverse expectations so a verify run would produce 2 fail rows.
    useProjectRuntime.getState().setVectors([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } }, // wrong: circuit produces ld0=0
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 0 } }, // wrong: circuit produces ld0=1
    ]);

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'trace-only-wrong-expected',
      scenarioName: 'Trace Only Wrong Expected',
      deterministicHash: 'trace-wrong-expected-hash',
      assertionMode: false,
      rows: [],
      ranAtIso: '2026-03-26T00:00:00.000Z',
    });

    expect(run.runKind).toBe('trace');
    expect(run.status).toBe('pass');
    expect(run.report.rows.filter((row) => row.status === 'fail').length).toBe(0);
  });

  it('stamps the active scenario when project vectors change in the normal shell path', () => {
    const before = useProjectRuntime.getState();
    const activeScenarioId = before.activeScenarioId;
    const scenarioBefore = before.scenarios.find((scenario) => scenario.id === activeScenarioId);

    expect(scenarioBefore).toBeTruthy();

    useProjectRuntime.getState().setVectors([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      { tick: 2, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);

    const after = useProjectRuntime.getState();
    const scenarioAfter = after.scenarios.find((scenario) => scenario.id === activeScenarioId);

    expect(scenarioAfter).toBeTruthy();
    expect(after.projectVectors).toEqual(scenarioAfter?.vectors);
    expect(scenarioAfter?.version).toBeGreaterThan(scenarioBefore!.version);
    expect(computeScenarioContentHash(scenarioAfter!)).not.toBe(computeScenarioContentHash(scenarioBefore!));
  });

  it('supports first-class scenario actions and mirrors compatibility vectors from the active scenario', () => {
    const initial = useProjectRuntime.getState();
    const defaultScenario = initial.scenarios.find((scenario) => scenario.id === initial.activeScenarioId);

    expect(defaultScenario).toBeTruthy();

    useProjectRuntime.getState().createScenario();

    let state = useProjectRuntime.getState();
    const createdScenarioId = state.activeScenarioId;
    const createdScenario = state.scenarios.find((scenario) => scenario.id === createdScenarioId);

    expect(state.scenarios).toHaveLength(2);
    expect(createdScenario).toBeTruthy();
    expect(createdScenario?.vectors).toEqual(
      defaultScenario?.vectors.map((vector) => ({
        ...vector,
        expected: {},
      }))
    );
    expect(state.projectVectors).toEqual(createdScenario?.vectors);

    useProjectRuntime.getState().setVectors([
      { tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      { tick: 1, inputs: { sw0: 0 }, expected: { ld0: 0 } },
    ]);

    state = useProjectRuntime.getState();
    expect(state.scenarios.find((scenario) => scenario.id === createdScenarioId)?.vectors).toEqual(
      state.projectVectors
    );

    useProjectRuntime.getState().switchScenario(defaultScenario!.id);

    state = useProjectRuntime.getState();
    expect(state.activeScenarioId).toBe(defaultScenario!.id);
    expect(state.projectVectors).toEqual(defaultScenario!.vectors);

    useProjectRuntime.getState().duplicateScenario();

    state = useProjectRuntime.getState();
    const duplicatedScenarioId = state.activeScenarioId;
    const duplicatedScenario = state.scenarios.find((scenario) => scenario.id === duplicatedScenarioId);

    expect(state.scenarios).toHaveLength(3);
    expect(duplicatedScenario?.name).toContain(defaultScenario!.name);
    expect(state.projectVectors).toEqual(defaultScenario!.vectors);

    const previousVersion = duplicatedScenario?.version ?? 0;
    useProjectRuntime.getState().renameScenario('Bench Sweep');

    state = useProjectRuntime.getState();
    const renamedScenario = state.scenarios.find((scenario) => scenario.id === duplicatedScenarioId);

    expect(renamedScenario?.name).toBe('Bench Sweep');
    expect(renamedScenario?.version).toBeGreaterThan(previousVersion);

    useProjectRuntime.getState().deleteScenario(duplicatedScenarioId);

    state = useProjectRuntime.getState();
    const activeScenario = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);

    expect(state.scenarios).toHaveLength(2);
    expect(state.scenarios.some((scenario) => scenario.id === duplicatedScenarioId)).toBe(false);
    expect(activeScenario).toBeTruthy();
    expect(state.projectVectors).toEqual(activeScenario?.vectors);
  });

  it('clears stale live signals and adds a guard when a design mutation produces invalid IR', () => {
    const sim = useProjectRuntime.getState().actions.sim;
    sim.toggleProbe({ key: 'ld0_node.in', label: 'LD0 In' });
    sim.setInput('sw0_node', 1);
    sim.step();

    const before = structuredClone(useProjectRuntime.getState().sim);
    const invalidCircuit = structuredClone(useProjectRuntime.getState().circuit);
    invalidCircuit.connections = [];

    useProjectRuntime.getState().markDesignMutated(invalidCircuit);

    const after = useProjectRuntime.getState().sim;

    expect(after.tick).toBe(0);
    expect(after.trace).toEqual([]);
    expect(after.inputs).toEqual(before.inputs);
    expect(after.signals).toEqual({ 'sw0_node.out': 1 });
    expect(after.probes).toEqual(before.probes);
    expect(after.guard?.reason).toBe('invalid-ir');
    expect(after.guard?.diagnostics.length).toBeGreaterThan(0);
  });

  it('keeps the current input intent while invalid so rewiring uses the live switch state', () => {
    const sim = useProjectRuntime.getState().actions.sim;
    sim.setInput('sw0_node', 1);

    const invalidCircuit = structuredClone(useProjectRuntime.getState().circuit);
    invalidCircuit.connections = [];
    useProjectRuntime.getState().markDesignMutated(invalidCircuit);

    sim.setInput('sw0_node', 0);
    const invalidAfterInput = useProjectRuntime.getState().sim;

    expect(invalidAfterInput.guard?.reason).toBe('invalid-ir');
    expect(invalidAfterInput.inputs).toEqual({ sw0_node: 0 });
    expect(invalidAfterInput.signals).toEqual({ 'sw0_node.out': 0 });

    const rewiredCircuit = structuredClone(useProjectRuntime.getState().circuit);
    rewiredCircuit.connections = [
      {
        from: { nodeId: 'sw0_node', portName: 'out' },
        to: { nodeId: 'ld0_node', portName: 'in' },
      },
    ];
    useProjectRuntime.getState().markDesignMutated(rewiredCircuit);

    const rewired = useProjectRuntime.getState().sim;
    expect(rewired.guard).toBeUndefined();
    expect(rewired.inputs).toEqual({ sw0_node: 0 });
    expect(rewired.signals).toMatchObject({
      'sw0_node.out': 0,
      'ld0_node.in': 0,
      'ld0_node.out': 0,
    });
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
    expect(expectedContract.tick0Meaning).toBe('initial-state');
    expect(run.meta.tick0Meaning).toBeNull();
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

  it('names blank-project generic IO rows with stable numbered labels and ids', () => {
    const blankProject: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z',
      name: 'Blank IO Naming Fixture',
      description: 'Blank project IO labels should be stable export aliases.',
      circuit: { nodes: [], connections: [] },
      ioMapping: { inputs: [], outputs: [] },
      vectors: [],
      meta: {
        projectId: 'rb-blank-io-naming-fixture',
      },
    };

    useProjectRuntime.getState().loadFromProject(blankProject);
    useProjectRuntime.getState().startBlankProject();
    useProjectRuntime.getState().addDesignIo('input', { x: 120, y: 120 });
    useProjectRuntime.getState().addDesignIo('input', { x: 120, y: 220 });
    useProjectRuntime.getState().addDesignIo('output', { x: 420, y: 170 });

    const state = useProjectRuntime.getState();

    expect(
      state.projectIoRows.map((row) => ({
        id: row.id,
        label: row.label,
        direction: row.direction,
      }))
    ).toEqual([
      { id: 'input_1', label: 'Input 1', direction: 'in' },
      { id: 'input_2', label: 'Input 2', direction: 'in' },
      { id: 'output_1', label: 'Output 1', direction: 'out' },
    ]);
    expect(state.circuit.nodes.map((node) => node.label)).toEqual(['Input 1', 'Input 2', 'Output 1']);
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

  it('keeps verify current when only project identity changes', () => {
    useProjectRuntime.getState().runVerification({
      scenarioId: 'identity-edit',
      scenarioName: 'Identity Edit',
      deterministicHash: 'identity-edit-hash',
      rows: [],
      ranAtIso: '2026-03-25T16:00:00.000Z',
      useRuntimeTrace: false,
    });

    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(false);

    useProjectRuntime.getState().setProjectIdentity({
      projectName: 'Verify Authority Fixture Renamed',
      projectDescription: 'Updated metadata only.',
    });

    const state = useProjectRuntime.getState();
    const readiness = {
      hasCircuit: state.circuit.nodes.length > 0,
      hasIoMapping: state.projectIoRows.filter((row) => row.required).every((row) => row.pin.trim().length > 0),
      hasVectors: state.projectVectors.length > 0,
      verifyQualification: state.verifyLastRun?.qualification,
    };
    const health = deriveProjectHealth(state.projectHealthCore, readiness);

    expect(state.projectName).toBe('Verify Authority Fixture Renamed');
    expect(state.projectDescription).toBe('Updated metadata only.');
    expect(state.projectHealthCore.dirtySinceVerify).toBe(false);
    expect(state.projectHealthCore.dirtySinceExport).toBe(true);
    expect(choosePrimaryProjectCta(health, readiness)).toEqual({
      label: 'Export',
      mode: 'export',
      code: 'RBP2002',
    });
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

  it('uses active-scenario vectors when verify input omits vectors and compatibility state drifts', () => {
    const stateBefore = useProjectRuntime.getState();
    const activeScenario = stateBefore.scenarios.find(
      (scenario) => scenario.id === stateBefore.activeScenarioId
    );

    expect(activeScenario).toBeTruthy();

    const activeScenarioVectors = [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }];
    const compatibilityVectors = [{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }];

    useProjectRuntime.setState((state) => ({
      ...state,
      projectVectors: compatibilityVectors,
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === state.activeScenarioId
          ? {
              ...scenario,
              vectors: activeScenarioVectors,
            }
          : scenario
      ),
    }));

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'scenario-first-fallback',
      scenarioName: 'Scenario First Fallback',
      deterministicHash: 'scenario-first-fallback-hash',
      rows: [],
      ranAtIso: '2026-03-25T15:00:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.runKind).toBe('verify');
    expect(run.report.vectors[0]?.inputs).toEqual({ sw0: 1 });
    expect(run.report.vectors[0]?.expected).toEqual({ ld0: 1 });
  });

  it('uses explicit scenario steps over stale compatibility vectors during rerun', () => {
    useProjectRuntime.setState((state) => ({
      ...state,
      projectVectors: [{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === state.activeScenarioId
          ? {
              ...scenario,
              vectors: [{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
              steps: [
                createScenarioStep({ kind: 'set_input', targetRef: 'sw0', value: 1 }, 0),
                createScenarioStep({ kind: 'assert_scalar', targetRef: 'ld0', expectedValue: 1 }, 1),
              ],
            }
          : scenario
      ),
    }));

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'scenario-steps-authority',
      scenarioName: 'Scenario Steps Authority',
      deterministicHash: 'scenario-steps-authority-hash',
      rows: [],
      ranAtIso: '2026-04-15T19:00:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.status).toBe('pass');
    expect(run.report.vectors[0]?.inputs).toEqual({ sw0: 1 });
    expect(run.report.vectors[1]?.expected).toEqual({ ld0: 1 });
  });

  it('supports inline step update, reorder, and delete operations', () => {
    useProjectRuntime.getState().appendScenarioStep({
      kind: 'set_input',
      targetRef: 'sw0',
      value: 1,
      label: 'seed-step',
    });
    useProjectRuntime.getState().appendScenarioStep({
      kind: 'assert_scalar',
      targetRef: 'ld0',
      expectedValue: 1,
      label: 'assert-step',
    });

    let state = useProjectRuntime.getState();
    const baselineSteps = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId)?.steps ?? [];
    const firstStep = baselineSteps[0];
    const secondStep = baselineSteps[1];

    expect(firstStep).toBeTruthy();
    expect(secondStep).toBeTruthy();

    useProjectRuntime.getState().updateScenarioStep(firstStep!.id, {
      targetRef: 'sw0',
      value: 0,
      label: 'edited-step',
    });
    useProjectRuntime.getState().moveScenarioStep(secondStep!.id, 'up');
    useProjectRuntime.getState().deleteScenarioStep(firstStep!.id);

    state = useProjectRuntime.getState();
    const activeSteps = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId)?.steps ?? [];
    expect(activeSteps).toHaveLength(baselineSteps.length - 1);
    expect(activeSteps.find((step) => step.id === firstStep!.id)).toBeUndefined();
    expect(activeSteps.every((step, index) => step.order === index)).toBe(true);
  });

  it('keeps authored documents and current evidence intact for a layout-only node move', () => {
    const runtime = useProjectRuntime.getState();
    runtime.setVectors(structuredClone(useProjectRuntime.getState().projectVectors));
    runtime.runVerification({
      scenarioId: useProjectRuntime.getState().activeScenarioId,
      scenarioName: 'Layout-only baseline',
      deterministicHash: 'layout-only-baseline-hash',
      rows: [],
      ranAtIso: '2026-07-17T01:00:00.000Z',
      useRuntimeTrace: false,
    });

    const before = useProjectRuntime.getState();
    const scenarioBefore = structuredClone(
      before.scenarios.find((scenario) => scenario.id === before.activeScenarioId)
    );
    const runBefore = structuredClone(before.verifyLastRun);
    const healthBefore = structuredClone(before.projectHealthCore);
    const movedCircuit = structuredClone(before.circuit);
    const movedNode = movedCircuit.nodes.find((node) => node.id === 'ld0_node');
    expect(movedNode).toBeDefined();
    movedNode!.x = 310;
    movedNode!.y = 145;
    movedNode!.position = { x: 310, y: 145 };

    runtime.applyCircuitMutation(movedCircuit);

    const moved = useProjectRuntime.getState();
    expect(moved.scenarios.find((scenario) => scenario.id === moved.activeScenarioId)).toEqual(
      scenarioBefore
    );
    expect(moved.verifyLastRun).toEqual(runBefore);
    expect(moved.projectHealthCore).toEqual(healthBefore);
  });

  it('keeps authored expectations and exposes produced evidence as stale when a gate is swapped', () => {
    const runtime = useProjectRuntime.getState();
    runtime.loadExample('logic-gates');
    runtime.setVectors(structuredClone(useProjectRuntime.getState().projectVectors));
    runtime.runVerification({
      scenarioId: useProjectRuntime.getState().activeScenarioId,
      scenarioName: 'Gate-swap baseline',
      deterministicHash: 'gate-swap-baseline-hash',
      rows: [],
      ranAtIso: '2026-07-17T01:05:00.000Z',
      useRuntimeTrace: false,
    });

    const before = useProjectRuntime.getState();
    const authoredVectors = structuredClone(before.projectVectors);
    const authoredScenario = structuredClone(
      before.scenarios.find((scenario) => scenario.id === before.activeScenarioId)
    );
    const runBefore = structuredClone(before.verifyLastRun);
    const healthBefore = structuredClone(before.projectHealthCore);
    const swappedCircuit = structuredClone(before.circuit);
    const xor = swappedCircuit.nodes.find((node) => node.id === 'xor_node');
    expect(xor?.type).toBe('XOR');
    xor!.type = 'OR';

    runtime.applyCircuitMutation(swappedCircuit);

    const swapped = useProjectRuntime.getState();
    const swappedScenario = swapped.scenarios.find(
      (scenario) => scenario.id === swapped.activeScenarioId
    );
    expect(swapped.projectVectors.map((vector) => vector.tick)).toEqual(
      authoredVectors.map((vector) => vector.tick)
    );
    expect(swapped.projectVectors.map((vector) => Object.values(vector.inputs))).toEqual(
      authoredVectors.map((vector) => Object.values(vector.inputs))
    );
    expect(swapped.projectVectors.map((vector) => Object.values(vector.expected ?? {}))).toEqual(
      authoredVectors.map((vector) => Object.values(vector.expected ?? {}))
    );
    expect(swappedScenario?.id).toBe(authoredScenario?.id);
    expect(swappedScenario?.name).toBe(authoredScenario?.name);
    expect(swappedScenario?.version).toBe(authoredScenario?.version);
    expect(swapped.verifyLastRun).toEqual(runBefore);
    expect(swapped.projectHealthCore.lastVerify).toEqual(healthBefore.lastVerify);
    expect(swapped.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(swapped.projectHealthCore.dirtySinceExport).toBe(true);
    expect(swapped.verifyRunHistory.length).toBeGreaterThan(0);
  });

  it('preserves explicit sequential clock, reset, assertion, and note steps through a wire repair', () => {
    const runtime = useProjectRuntime.getState();
    runtime.loadFromProject(buildSequentialAuthorityFixture());
    runtime.appendScenarioStep({
      kind: 'apply_reset',
      targetRef: 'reset_n',
      value: 0,
      durationTicks: 2,
      label: 'Hold reset',
      notes: 'Student-authored reset contract',
    });
    runtime.appendScenarioStep({
      kind: 'pulse_step',
      targetRef: 'clk',
      value: 1,
      durationTicks: 3,
      pulseBehavior: 'rising',
      label: 'Clock edge',
      notes: 'Capture D on the rising edge',
    });
    runtime.appendScenarioStep({
      kind: 'assert_scalar',
      targetRef: 'q',
      expectedValue: 1,
      durationTicks: 1,
      label: 'Expected Q',
      notes: 'Keep this expected result after repair',
    });

    const before = useProjectRuntime.getState();
    const stepsBefore = structuredClone(
      before.scenarios.find((scenario) => scenario.id === before.activeScenarioId)?.steps
    );
    const disconnectedCircuit = structuredClone(before.circuit);
    disconnectedCircuit.connections = disconnectedCircuit.connections.filter(
      (connection) =>
        !(
          connection.from.nodeId === 'ff_node' &&
          connection.to.nodeId === 'q_node'
        )
    );

    runtime.applyCircuitMutation(disconnectedCircuit);

    const after = useProjectRuntime.getState();
    expect(after.scenarios.find((scenario) => scenario.id === after.activeScenarioId)?.steps).toEqual(
      stepsBefore
    );
  });

  it('adds one optional check without expanding an explicit sequential timeline', () => {
    const runtime = useProjectRuntime.getState();
    runtime.loadFromProject(buildSequentialAuthorityFixture());
    runtime.appendScenarioStep({
      kind: 'observe',
      durationTicks: 1,
      label: 'Keep explicit timing authority',
    });

    const before = useProjectRuntime.getState();
    const scenarioBefore = before.scenarios.find(
      (scenario) => scenario.id === before.activeScenarioId
    );
    expect(scenarioBefore?.steps?.length).toBeGreaterThan(0);
    const stepsBefore = structuredClone(scenarioBefore!.steps);
    const vectorsBefore = materializeScenarioVectors(scenarioBefore!);
    const targetTick = vectorsBefore[1]!.tick;
    const withOneCheck = vectorsBefore.map((vector) =>
      vector.tick === targetTick
        ? { ...vector, expected: { ...(vector.expected ?? {}), q: 1 as const } }
        : vector
    );

    runtime.setVectors(withOneCheck);

    const after = useProjectRuntime.getState();
    const scenarioAfter = after.scenarios.find(
      (scenario) => scenario.id === after.activeScenarioId
    );
    expect(scenarioAfter?.steps).toEqual(stepsBefore);
    const vectorsAfter = materializeScenarioVectors(scenarioAfter!);
    expect(vectorsAfter).toHaveLength(vectorsBefore.length);
    expect(vectorsAfter.find((vector) => vector.tick === targetTick)?.expected.q).toBe(1);
  });

  it('preserves removed output references for authored testbench review after a design mutation', () => {
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
    expect(state.projectVectors.every((vector) => 'ld0' in (vector.expected ?? {}))).toBe(true);
    expect(state.customVectors[0]?.expected).toEqual({ ld0: 1 });

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
