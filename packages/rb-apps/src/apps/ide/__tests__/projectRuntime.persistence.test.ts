// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';
import { DEFAULT_SCENARIO_ID } from '../verifyScenario';

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

  it('migrates detached starter restores into custom identity and clears starter framing', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-detached-starter',
        projectName: 'Signal Tour: Switches → LEDs',
        projectDescription: 'Four-wire passthrough. Learn mapping, run Verify, and see the board light up.',
        projectKind: 'saved',
        activeExampleId: 'signal-tour',
        sourceExampleId: null,
        projectIoRows: current.projectIoRows,
        projectVectors: current.projectVectors,
        circuit: current.circuit,
        projectHealthCore: {
          dirtySinceVerify: true,
          dirtySinceExport: true,
        },
      },
      current
    );

    expect(merged.projectKind).toBe('custom');
    expect(merged.activeExampleId).toBeNull();
    expect(merged.sourceExampleId).toBe('signal-tour');
    expect(merged.projectName).toBe('Untitled Project');
    expect(merged.projectDescription).toBe('');
  });

  it('sanitizes detached starter identity when loading a saved project snapshot', () => {
    useProjectRuntime.getState().loadFromProject({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z',
      name: 'Signal Tour: Switches → LEDs',
      description: 'Four-wire passthrough. Learn mapping, run Verify, and see the board light up.',
      circuit: {
        nodes: [
          { id: 'sw0_node', type: 'INPUT', x: 0, y: 0, label: 'SW0', config: {}, state: {} },
          { id: 'sw1_node', type: 'INPUT', x: 0, y: 100, label: 'SW1', config: {}, state: {} },
          { id: 'ld0_node', type: 'OUTPUT', x: 240, y: 0, label: 'ld0', config: {}, state: {} },
          { id: 'ld1_node', type: 'OUTPUT', x: 240, y: 100, label: 'ld1', config: {}, state: {} },
          { id: 'nand0', type: 'NAND', x: 120, y: 0, config: {}, state: {} },
        ],
        connections: [
          { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'nand0', portName: 'a' } },
          { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'nand0', portName: 'b' } },
          { from: { nodeId: 'nand0', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
          { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'ld1_node', portName: 'in' } },
        ],
      },
      ioMapping: {
        inputs: [
          { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', pin: 'V17' },
          { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', pin: 'V16' },
        ],
        outputs: [
          { id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' },
          { id: 'ld1', nodeId: 'ld1_node', port: 'in', label: 'ld1', pin: 'LD1' },
        ],
      },
      vectors: [
        { tick: 0, inputs: { sw0: 1, sw1: 1 }, expected: { ld0: 0, ld1: 1 } },
      ],
      meta: {
        projectId: 'rb-detached-starter-snapshot',
        projectKind: 'saved',
        scenarioAuthority: 'authored',
      },
    });

    const loaded = useProjectRuntime.getState();

    expect(loaded.projectKind).toBe('custom');
    expect(loaded.activeExampleId).toBeNull();
    expect(loaded.sourceExampleId).toBe('signal-tour');
    expect(loaded.projectName).toBe('Untitled Project');
    expect(loaded.projectDescription).toBe('');
    expect(loaded.scenarioAuthority).toBe('draft');
    expect(loaded.projectVectors[0]?.expected).toEqual({});
    expect(loaded.scenarios[0]?.vectors[0]?.expected).toEqual({});
  });

  it('resets inherited starter compare state for detached custom restores that already carry starter provenance', () => {
    useProjectRuntime.getState().loadFromProject({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z',
      name: 'Untitled Project',
      description: '',
      circuit: {
        nodes: [
          { id: 'sw0_node', type: 'INPUT', x: 0, y: 0, label: 'SW0', config: {}, state: {} },
          { id: 'sw1_node', type: 'INPUT', x: 0, y: 100, label: 'SW1', config: {}, state: {} },
          { id: 'ld0_node', type: 'OUTPUT', x: 240, y: 0, label: 'ld0', config: {}, state: {} },
          { id: 'ld1_node', type: 'OUTPUT', x: 240, y: 100, label: 'ld1', config: {}, state: {} },
        ],
        connections: [
          { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
          { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'ld1_node', portName: 'in' } },
        ],
      },
      ioMapping: {
        inputs: [
          { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', pin: 'V17' },
          { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', pin: 'V16' },
        ],
        outputs: [
          { id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' },
          { id: 'ld1', nodeId: 'ld1_node', port: 'in', label: 'ld1', pin: 'LD1' },
        ],
      },
      vectors: [
        { tick: 0, inputs: { sw0: 1, sw1: 1 }, expected: { ld0: 1, ld1: 1 } },
      ],
      meta: {
        projectId: 'rb-detached-starter-second-boot',
        projectKind: 'custom',
        sourceExampleId: 'signal-tour',
        scenarioAuthority: 'authored',
      },
    });

    const loaded = useProjectRuntime.getState();

    expect(loaded.projectKind).toBe('custom');
    expect(loaded.sourceExampleId).toBe('signal-tour');
    expect(loaded.scenarioAuthority).toBe('draft');
    expect(loaded.verifyLastRun).toBeUndefined();
    expect(loaded.projectVectors[0]?.expected).toEqual({});
    expect(loaded.scenarios[0]?.vectors[0]?.expected).toEqual({});
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

  it('assigns numbered boundary labels to unlabeled boundary nodes on load', () => {
    useProjectRuntime.getState().loadFromProject({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
      name: 'Untitled Project',
      description: '',
      circuit: {
        nodes: [
          { id: 'node-v2-1', type: 'INPUT', x: 0, y: 0, config: {}, state: {} },
          { id: 'node-v2-2', type: 'INPUT', x: 0, y: 120, config: {}, state: {} },
          { id: 'node-v2-3', type: 'OUTPUT', x: 240, y: 0, config: {}, state: {} },
        ],
        connections: [],
      },
      ioMapping: {
        inputs: [],
        outputs: [],
      },
      vectors: [],
      meta: {
        projectId: 'rb-unlabeled-boundaries',
        projectKind: 'blank',
        scenarioAuthority: 'none',
      },
    });

    const loaded = useProjectRuntime.getState();

    expect(loaded.projectIoRows.map((row) => row.label)).toEqual(['Input 1', 'Input 2', 'Output 1']);
    expect(loaded.projectIoRows.map((row) => row.id)).toEqual(['input_1', 'input_2', 'output_1']);
  });

  it('upgrades legacy internal boundary labels to student-facing names on load', () => {
    useProjectRuntime.getState().loadFromProject({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
      name: 'Untitled Project',
      description: '',
      circuit: {
        nodes: [
          { id: 'node-v2-1', type: 'INPUT', x: 0, y: 0, config: {}, state: {} },
          { id: 'node-v2-2', type: 'INPUT', x: 0, y: 120, config: {}, state: {} },
          { id: 'node-v2-3', type: 'OUTPUT', x: 240, y: 0, config: {}, state: {} },
        ],
        connections: [],
      },
      ioMapping: {
        inputs: [
          { id: 'node-v2-1', nodeId: 'node-v2-1', port: 'out', label: 'node-v2-1', pin: '' },
          { id: 'input', nodeId: 'node-v2-2', port: 'out', label: 'input', pin: '' },
        ],
        outputs: [
          { id: 'output', nodeId: 'node-v2-3', port: 'in', label: 'output', pin: '' },
        ],
      },
      vectors: [
        {
          tick: 0,
          inputs: {
            'node-v2-1': 1,
            input: 0,
          },
          expected: {
            output: 1,
          },
        },
      ],
      meta: {
        projectId: 'rb-legacy-boundary-labels',
        projectKind: 'saved',
        scenarioAuthority: 'draft',
      },
    });

    const loaded = useProjectRuntime.getState();

    expect(loaded.projectIoRows.map((row) => row.label)).toEqual(['Input 1', 'Input 2', 'Output 1']);
    expect(loaded.projectIoRows.map((row) => row.id)).toEqual(['input_1', 'input_2', 'output_1']);
    expect(loaded.projectVectors[0]?.inputs).toEqual({ input_1: 1, input_2: 0 });
    expect(loaded.projectVectors[0]?.expected).toEqual({ output_1: 1 });
  });

  it('preserves incomplete-mapping qualification in restored project health', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-qualified-verify',
        projectName: 'Qualified Verify Project',
        projectDescription: 'Restored qualified verify trust',
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
            pin: '',
            required: false,
          },
        ],
        projectVectors: [
          {
            tick: 0,
            inputs: { sw0: 1 },
            expected: { ld0: 1 },
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
        projectHealthCore: {
          lastVerify: {
            status: 'pass',
            hash: 'vrf_trusted_hash_1234',
            qualification: 'incomplete-mapping',
            reportHash: 'vrf_trusted_hash_1234_report',
            ranAtIso: '2026-03-21T00:00:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: true,
        },
      },
      current
    );

    expect(merged.projectHealthCore.lastVerify).toEqual(
      expect.objectContaining({
        status: 'pass',
        hash: 'vrf_trusted_hash_1234',
        qualification: 'incomplete-mapping',
      })
    );
    expect(merged.projectHealthCore.dirtySinceVerify).toBe(false);
  });

  it('invalidates restored qualified verify trust when the latest verify ledger project hash no longer matches', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-stale-qualified-verify',
        projectName: 'Stale Qualified Verify Project',
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
            pin: '',
            required: false,
          },
        ],
        projectVectors: [
          {
            tick: 0,
            inputs: { sw0: 1 },
            expected: { ld0: 1 },
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
        verifyRunHistory: [
          {
            runId: 'verify-old-boundary-shape',
            ranAtIso: '2026-03-21T00:00:00.000Z',
            status: 'pass',
            passedRows: 1,
            failedRows: 0,
            firstFailure: null,
            circuitHash: 'cir_old',
            vectorsHash: 'vec_old',
            mappingHash: 'map_old',
            projectHash: 'project_hash_before_boundary_delete',
            didCircuitChangeSinceLast: false,
            didVectorsChangeSinceLast: false,
            didMappingChangeSinceLast: false,
          },
        ],
        projectHealthCore: {
          lastVerify: {
            status: 'pass',
            hash: 'vrf_authoritative_hash_1234',
            qualification: 'incomplete-mapping',
            reportHash: 'vrf_authoritative_hash_1234_report',
            ranAtIso: '2026-03-21T00:00:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: true,
        },
      },
      current
    );

    const health = deriveProjectHealth(merged.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: merged.projectHealthCore.lastVerify?.qualification,
    });

    expect(merged.verifyRunHistory).toHaveLength(1);
    expect(merged.projectHealthCore.lastVerify).toEqual(
      expect.objectContaining({
        status: 'pass',
        qualification: 'incomplete-mapping',
      })
    );
    expect(merged.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(health.blockingIssues.some((issue) => issue.code === 'RBP1005')).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: merged.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });
  });

  it('invalidates restored export trust when persisted export hash no longer matches the restored project', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-stale-export-trust',
        projectName: 'Stale Export Trust Project',
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
            inputs: { sw0: 1 },
            expected: { ld0: 1 },
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
        projectHealthCore: {
          lastVerify: {
            status: 'pass',
            hash: 'vrf_authoritative_hash_1234',
            reportHash: 'vrf_authoritative_hash_1234_report',
            ranAtIso: '2026-03-21T00:00:00.000Z',
          },
          lastExport: {
            status: 'ok',
            hash: 'exp_hash_for_old_project_shape',
            ranAtIso: '2026-03-21T00:05:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
      },
      current
    );

    const health = deriveProjectHealth(merged.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: merged.projectHealthCore.lastVerify?.qualification,
    });

    expect(merged.projectHealthCore.lastExport).toEqual(
      expect.objectContaining({
        status: 'ok',
        hash: 'exp_hash_for_old_project_shape',
      })
    );
    expect(merged.projectHealthCore.dirtySinceExport).toBe(true);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: merged.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Export', mode: 'export', code: 'RBP2002' });
  });

  it('restores persisted runtime undo and redo history snapshots', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-history-restore',
        projectName: 'History Restore Project',
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
        projectVectors: [],
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
        designPast: [
          {
            circuit: {
              nodes: [{ id: 'sw0_node', type: 'INPUT', x: 0, y: 0 }],
              connections: [],
            },
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
                id: 'ghost',
                nodeId: 'ghost_node',
                port: 'out',
                label: 'ghost',
                direction: 'in',
                pin: '',
                required: true,
              },
            ],
            macroInsertionCounts: {
              'macro-and-gate': 1,
            },
          },
          {
            not: 'a-snapshot',
          },
        ],
        designFuture: [
          {
            circuit: {
              nodes: [
                { id: 'sw0_node', type: 'INPUT', x: 0, y: 0 },
                { id: 'ld0_node', type: 'OUTPUT', x: 10, y: 5 },
                { id: 'and0', type: 'AND', x: 32, y: 12 },
              ],
              connections: [],
            },
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
            ],
            macroInsertionCounts: {
              'macro-and-gate': 2,
            },
          },
        ],
        maxDesignHistory: 42,
        designRevision: 7,
      },
      current
    );

    expect(merged.maxDesignHistory).toBe(42);
    expect(merged.designRevision).toBe(7);
    expect(merged.designPast).toHaveLength(1);
    expect(merged.designFuture).toHaveLength(1);
    expect(merged.designPast[0]?.projectIoRows.some((row) => row.nodeId === 'ghost_node')).toBe(false);
    expect(merged.designPast[0]?.macroInsertionCounts['macro-and-gate']).toBe(1);
    expect(merged.designFuture[0]?.macroInsertionCounts['macro-and-gate']).toBe(2);
  });

  it('migrates projectVectors to default scenario when scenarios is absent', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-migration',
        projectName: 'Migration Project',
        activeExampleId: null,
        projectIoRows: [],
        projectVectors: [
          { tick: 0, inputs: { a: 0 }, expected: { y: 0 } },
          { tick: 1, inputs: { a: 1 }, expected: { y: 1 } },
        ],
        circuit: {
          nodes: [{ id: 'a_node', type: 'INPUT', x: 0, y: 0 }],
          connections: [],
        },
        // No `scenarios` field — legacy state
      },
      current
    );

    expect(merged.scenarios).toHaveLength(1);
    expect(merged.scenarios[0].id).toBe(DEFAULT_SCENARIO_ID);
    expect(merged.scenarios[0].vectors).toHaveLength(2);
    expect(merged.activeScenarioId).toBe(DEFAULT_SCENARIO_ID);
  });

  it('preserves persisted scenarios and activeScenarioId when present', () => {
    const current = useProjectRuntime.getState();
    const scenario = {
      id: 'sc-custom',
      name: 'Custom Scenario',
      vectors: [{ tick: 0, inputs: { a: 0 }, expected: { y: 0 } }],
      version: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-with-scenarios',
        projectName: 'With Scenarios',
        activeExampleId: null,
        projectIoRows: [],
        projectVectors: [],
        scenarios: [scenario],
        activeScenarioId: 'sc-custom',
        circuit: {
          nodes: [{ id: 'a_node', type: 'INPUT', x: 0, y: 0 }],
          connections: [],
        },
      },
      current
    );

    expect(merged.scenarios).toHaveLength(1);
    expect(merged.scenarios[0].id).toBe('sc-custom');
    expect(merged.scenarios[0].version).toBe(3);
    expect(merged.activeScenarioId).toBe('sc-custom');
  });

  it('preserves persisted scenario steps and keeps vectors materialized from steps', () => {
    const current = useProjectRuntime.getState();
    const scenario = {
      id: 'sc-steps',
      name: 'Manual Lab Procedure',
      vectors: [{ tick: 0, inputs: { a: 0 }, expected: { y: 0 } }],
      steps: [
        { id: 's1', order: 0, kind: 'set_input', targetRef: 'a', value: 1, origin: 'explicit' },
        { id: 's2', order: 1, kind: 'assert_scalar', targetRef: 'y', expectedValue: 1, origin: 'explicit' },
      ],
      version: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    };

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-with-step-scenarios',
        projectName: 'With Step Scenarios',
        activeExampleId: null,
        projectIoRows: [
          {
            id: 'a',
            nodeId: 'a_node',
            port: 'out',
            label: 'a',
            direction: 'in',
            pin: '',
            required: true,
          },
          {
            id: 'y',
            nodeId: 'y_node',
            port: 'in',
            label: 'y',
            direction: 'out',
            pin: '',
            required: true,
          },
        ],
        projectVectors: [],
        scenarios: [scenario],
        activeScenarioId: 'sc-steps',
        circuit: {
          nodes: [
            { id: 'a_node', type: 'INPUT', x: 0, y: 0 },
            { id: 'y_node', type: 'OUTPUT', x: 40, y: 0 },
          ],
          connections: [],
        },
      },
      current
    );

    expect(merged.scenarios[0]?.steps).toHaveLength(2);
    expect(merged.activeScenarioId).toBe('sc-steps');
  });

  it('self-heals activeScenarioId when it references a deleted scenario', () => {
    const current = useProjectRuntime.getState();
    const scenario = {
      id: 'sc-existing',
      name: 'Existing',
      vectors: [],
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-orphan-active',
        projectName: 'Orphan Active',
        activeExampleId: null,
        projectIoRows: [],
        projectVectors: [],
        scenarios: [scenario],
        activeScenarioId: 'sc-deleted-ghost', // orphaned
        circuit: {
          nodes: [{ id: 'a_node', type: 'INPUT', x: 0, y: 0 }],
          connections: [],
        },
      },
      current
    );

    expect(merged.activeScenarioId).toBe('sc-existing');
  });

  it('stateFromExample initializes scenarios with a default scenario', () => {
    const state = useProjectRuntime.getState();
    state.resetToActiveExample();
    const fresh = useProjectRuntime.getState();

    expect(fresh.scenarios).toHaveLength(1);
    expect(fresh.scenarios[0].id).toBe(DEFAULT_SCENARIO_ID);
    expect(fresh.activeScenarioId).toBe(DEFAULT_SCENARIO_ID);
  });

  it('clamps persisted maxDesignHistory to the runtime hard limit', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-history-clamp',
        projectName: 'History Clamp Project',
        activeExampleId: null,
        projectIoRows: [],
        projectVectors: [],
        circuit: {
          nodes: [{ id: 'sw0_node', type: 'INPUT', x: 0, y: 0 }],
          connections: [],
        },
        maxDesignHistory: 5000,
      },
      current
    );

    expect(merged.maxDesignHistory).toBe(500);
  });

  it('normalizes persisted custom vectors against the restored live IO shape without inventing expected outputs', () => {
    const current = useProjectRuntime.getState();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-custom-vectors-restore',
        projectName: 'Custom Vector Restore',
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
        projectVectors: [],
        customVectors: [
          {
            id: 'cv-01',
            tick: 0,
            inputs: { sw0: 1, ghost_in: 1 },
            expected: { ghost_out: 1 },
          },
        ],
        circuit: {
          nodes: [
            { id: 'sw0_node', type: 'INPUT', x: 0, y: 0 },
            { id: 'ld0_node', type: 'OUTPUT', x: 10, y: 0 },
          ],
          connections: [],
        },
      },
      current
    );

    expect(merged.customVectors).toEqual([
      {
        id: 'cv-01',
        tick: 0,
        inputs: { sw0: 1 },
        expected: {},
      },
    ]);
  });
});
