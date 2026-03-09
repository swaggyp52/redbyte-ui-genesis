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

  it('invalidates legacy runtime-backed verify trust on restore', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-legacy-verify',
        projectName: 'Legacy Verify Project',
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
            inputs: { sw0: 0 },
            expected: { ld0: 0 },
          },
        ],
        circuit: {
          nodes: [
            { id: 'sw0_node', type: 'INPUT', x: 0, y: 0 },
            { id: 'ld0_node', type: 'OUTPUT', x: 10, y: 5 },
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
        verifyLastRun: {
          scenarioId: 'runtime-trace',
          scenarioName: 'Runtime trace verification',
          status: 'pass',
          deterministicHash: 'sim_legacy_hash',
          reportHash: 'vrf_legacy',
          generatedAtIso: '2026-03-09T00:00:00.000Z',
          schedule: 'combinational',
          meta: {
            circuitKind: 'combinational',
            clockingProtocol: null,
            samplePoint: 'steady-state',
            tick0Meaning: null,
            clockSignalName: null,
          },
          report: {
            schemaVersion: 'rb.verify-report.v1',
            scenarioId: 'runtime-trace',
            scenarioName: 'Runtime trace verification',
            status: 'pass',
            deterministicHash: 'sim_legacy_hash',
            rows: [{ tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' }],
            vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
            inputsAtTick: { 0: { sw0: 0 } },
            signalRoles: { sw0: 'input', ld0: 'output' },
            generatedAtIso: '2026-03-09T00:00:00.000Z',
            reportHash: 'vrf_legacy',
          },
          waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
          traceWaveform: [{ tick: 0, signals: { sw0: '0', ld0: '0', tap: '1' }, mismatches: [] }],
        },
        verifyRunHistory: [
          {
            runId: 'legacy-run',
            ranAtIso: '2026-03-09T00:00:00.000Z',
            status: 'pass',
            passedRows: 1,
            failedRows: 0,
            firstFailure: null,
            circuitHash: 'c1',
            vectorsHash: 'v1',
            mappingHash: 'm1',
            projectHash: 'p1',
            didCircuitChangeSinceLast: false,
            didVectorsChangeSinceLast: false,
            didMappingChangeSinceLast: false,
          },
        ],
        projectHealthCore: {
          lastVerify: {
            status: 'pass',
            hash: 'sim_legacy_hash',
            reportHash: 'vrf_legacy',
            ranAtIso: '2026-03-09T00:00:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
      },
      current
    );

    expect(merged.verifyLastRun).toBeUndefined();
    expect(merged.verifyRunHistory).toEqual([]);
    expect(merged.projectHealthCore.lastVerify).toBeUndefined();
    expect(merged.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(merged.projectHealthCore.dirtySinceExport).toBe(false);
  });
});
