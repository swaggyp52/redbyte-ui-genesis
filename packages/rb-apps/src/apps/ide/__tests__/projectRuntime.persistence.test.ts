import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';

describe('mergePersistedRuntimeState', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectRuntime.getState().resetToActiveExample();
  });

  it('falls back to the current runtime state when persisted circuit data is malformed', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-broken',
        projectName: 'Broken Project',
        circuit: null,
      },
      current
    );

    expect(merged.projectId).toBe(current.projectId);
    expect(merged.projectName).toBe(current.projectName);
    expect(merged.circuit).toEqual(current.circuit);
  });

  it('restores a valid persisted project and sanitizes runtime-only state', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-restored',
        projectName: 'Restored Project',
        projectDescription: 'Recovered from storage',
        lastSavedAt: 'Autosaved 2026-03-09T00:00:00.000Z',
        activeExampleId: null,
        projectIoRows: [
          {
            id: 'sw0',
            nodeId: 'sw0_node',
            port: 'out',
            label: 'sw0',
            direction: 'in',
            pin: 'SW0',
            required: true,
          },
          {
            id: 'ld0',
            nodeId: 'ld0_node',
            port: 'in',
            label: 'ld0',
            direction: 'out',
            pin: 'LD0',
            required: true,
          },
        ],
        projectVectors: [
          {
            tick: 0,
            inputs: { sw0: true },
            expected: { ld0: 1 },
          },
        ],
        circuit: {
          nodes: [
            { id: 'sw0_node', type: 'INPUT', x: 0, y: 0 },
            { id: 'ld0_node', type: 'OUTPUT', position: { x: 10, y: 5 } },
          ],
          connections: [
            {
              from: 'sw0_node',
              fromPort: 'out',
              to: 'ld0_node',
              toPort: 'in',
            },
          ],
        },
        sim: {
          tick: 'bad',
          running: true,
          speedHz: 9999,
          irHash: 'abc',
          traceHash: 'def',
          inputs: { sw0: '1' },
          signals: { ld0: '0' },
          trace: [{ tick: 1, signals: { ld0: 1 } }],
          selectedSignalKey: 'ld0',
          probes: [{ key: 'ld0.in', label: '' }],
        },
        projectHealthCore: {
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
      },
      current
    );

    expect(merged.projectId).toBe('rb-restored');
    expect(merged.projectName).toBe('Restored Project');
    expect(merged.circuit.connections[0]).toEqual({
      from: { nodeId: 'sw0_node', portName: 'out' },
      to: { nodeId: 'ld0_node', portName: 'in' },
    });
    expect(merged.projectVectors).toEqual([
      {
        tick: 0,
        inputs: { sw0: 1 },
        expected: { ld0: 1 },
      },
    ]);
    expect(merged.sim.inputs).toEqual({ sw0: 1 });
    expect(merged.sim.signals).toEqual({ ld0: 0 });
    expect(merged.sim.speedHz).toBe(120);
    expect(merged.sim.probes).toEqual([{ key: 'ld0.in', label: 'ld0.in' }]);
  });
});
