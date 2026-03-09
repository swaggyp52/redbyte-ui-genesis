import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
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

describe('projectRuntime verify authority', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
