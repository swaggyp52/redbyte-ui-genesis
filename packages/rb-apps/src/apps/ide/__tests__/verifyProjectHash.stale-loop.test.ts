// @vitest-environment jsdom
/**
 * Stale-loop regression tests.
 *
 * Root cause (fixed 2026-04-29): runVerification was computing the ledger
 * projectHash by serializing runtimeVectors directly (which preserved `id`
 * fields from cloneVectors spread), while buildCurrentVerifyProjectHash in
 * IdeApp stripped `id` fields.  The mismatch caused deriveVerifyCurrent to
 * always return false, so export stayed "NEEDS REVIEW" permanently after any
 * run that involved id-bearing vectors (clock pattern insertion, generate
 * basic vectors, etc.).
 *
 * The fix: runVerification now calls buildCurrentVerifyProjectHash using the
 * runtime store's own state (projectVectors + customVectors + circuit +
 * projectIoRows), which is exactly what IdeApp will compare against.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { useCircuitStore } from '../../../stores/circuitStore';
import { buildClockHelperVectors } from '../clockAuthority';
import { deriveVerifyCurrent, deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';
import { useProjectRuntime } from '../projectRuntime';
import { buildCurrentVerifyProjectHash } from '../verifyProjectHash';

// Fixtures

function buildCombinationalFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    name: 'Stale Loop Regression',
    description: 'Combinational pass-through for hash alignment tests.',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', label: 'sw0', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', label: 'ld0', position: { x: 160, y: 0 }, x: 160, y: 0, rotation: 0, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'SW0' }],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ],
    meta: { projectId: 'stale-loop-regression' },
  };
}

function buildSequentialFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    name: 'Sequential Stale Loop Regression',
    description: 'D flip-flop for clock pattern stale-loop tests.',
    circuit: {
      nodes: [
        { id: 'd_node', type: 'INPUT', label: 'd', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} },
        { id: 'clk_node', type: 'INPUT', label: 'clk', position: { x: 0, y: 100 }, x: 0, y: 100, rotation: 0, config: {}, state: {} },
        { id: 'ff_node', type: 'DFlipFlop', label: 'ff0', position: { x: 220, y: 40 }, x: 220, y: 40, rotation: 0, config: {}, state: {} },
        { id: 'q_node', type: 'OUTPUT', label: 'q', position: { x: 420, y: 40 }, x: 420, y: 40, rotation: 0, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'd_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'D' } },
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'CLK' } },
        { from: { nodeId: 'ff_node', portName: 'Q' }, to: { nodeId: 'q_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'd', nodeId: 'd_node', port: 'out', label: 'd', pin: 'SW0' },
        { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
      ],
      outputs: [{ id: 'q', nodeId: 'q_node', port: 'in', label: 'q', pin: 'LD0' }],
    },
    vectors: [],
    meta: { projectId: 'sequential-stale-loop-regression' },
  };
}

function currentVerifyProjectHash(): string {
  const state = useProjectRuntime.getState();
  return buildCurrentVerifyProjectHash({
    circuit: state.circuit,
    projectVectors: state.projectVectors,
    customVectors: state.customVectors,
    projectIoRows: state.projectIoRows,
  });
}

// Tests

describe('verify stale-loop regression — id-bearing vectors', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
    useProjectRuntime.getState().loadFromProject(buildCombinationalFixture());
  });

  it('ledger projectHash matches currentVerifyProjectHash immediately after a run with plain vectors', () => {
    const hashBefore = currentVerifyProjectHash();
    useProjectRuntime.getState().runVerification({
      scenarioId: 'plain-vector-run',
      scenarioName: 'Plain Vector Run',
      deterministicHash: 'plain-vector-run-hash',
      rows: [],
      ranAtIso: '2026-04-29T00:01:00.000Z',
    });

    const state = useProjectRuntime.getState();
    const ledger = state.verifyRunHistory[state.verifyRunHistory.length - 1];
    const hashAfter = currentVerifyProjectHash();

    expect(hashBefore).toBe(hashAfter);
    expect(ledger?.projectHash).toBe(hashAfter);
    expect(state.projectHealthCore.dirtySinceVerify).toBe(false);
  });

  it('ledger projectHash matches currentVerifyProjectHash after setVectors introduces id-bearing vectors', () => {
    // Simulate what "Insert clock pattern" does: creates vectors with `id` fields.
    const idBearingVectors = [
      { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ];
    useProjectRuntime.getState().setVectors(idBearingVectors);

    useProjectRuntime.getState().runVerification({
      scenarioId: 'id-bearing-vectors-run',
      scenarioName: 'ID Bearing Vectors Run',
      deterministicHash: 'id-bearing-run-hash',
      rows: [],
      ranAtIso: '2026-04-29T00:02:00.000Z',
    });

    const state = useProjectRuntime.getState();
    const ledger = state.verifyRunHistory[state.verifyRunHistory.length - 1];
    const hashAfter = currentVerifyProjectHash();

    // Core invariant: the ledger hash MUST match what IdeApp will compute.
    expect(ledger?.projectHash).toBe(hashAfter);
    expect(state.projectHealthCore.dirtySinceVerify).toBe(false);

    // verifyCurrent must be true: no phantom stale loop.
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: ledger,
      currentVerifyProjectHash: hashAfter,
      dirtySinceVerify: state.projectHealthCore.dirtySinceVerify,
    });
    expect(verifyCurrent).toBe(true);
  });

  it('does not enter a phantom stale loop after compare-pass run with id-bearing vectors', () => {
    const idBearingVectors = [
      { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ];
    useProjectRuntime.getState().setVectors(idBearingVectors);

    useProjectRuntime.getState().runVerification({
      scenarioId: 'no-phantom-stale',
      scenarioName: 'No Phantom Stale',
      deterministicHash: 'no-phantom-stale-hash',
      assertionMode: true,
      rows: [],
      ranAtIso: '2026-04-29T00:03:00.000Z',
    });

    const state = useProjectRuntime.getState();
    const ledger = state.verifyRunHistory[state.verifyRunHistory.length - 1];
    const hashAfter = currentVerifyProjectHash();

    expect(ledger?.projectHash).toBe(hashAfter);
    expect(state.verifyLastRun?.status).toBe('pass');
    expect(state.projectHealthCore.dirtySinceVerify).toBe(false);

    const authority = deriveProjectWorkflowAuthority({
      projectHealthCore: state.projectHealthCore,
      readiness: {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: state.verifyLastRun?.qualification,
      },
      verifyLastRun: state.verifyLastRun,
      verifyRunHistory: state.verifyRunHistory,
      currentVerifyProjectHash: hashAfter,
    });

    // After a compare-pass run, verify must be current and trusted.
    expect(authority.verifyCurrent).toBe(true);
    expect(authority.compareMatches).toBe(true);
    expect(authority.verifyState).not.toBe('stale');
  });

  it('correctly marks verify stale when vectors change after a run', () => {
    useProjectRuntime.getState().runVerification({
      scenarioId: 'pre-change-run',
      scenarioName: 'Pre Change Run',
      deterministicHash: 'pre-change-hash',
      rows: [],
      ranAtIso: '2026-04-29T00:04:00.000Z',
    });

    // Change vectors after the run.
    useProjectRuntime.getState().setVectors([
      { id: 'vec-new-01', tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);

    const state = useProjectRuntime.getState();
    const ledger = state.verifyRunHistory[state.verifyRunHistory.length - 1];
    const hashAfter = currentVerifyProjectHash();

    // Hash changed, so the ledger entry is now outdated and verify is stale.
    expect(ledger?.projectHash).not.toBe(hashAfter);
    expect(state.projectHealthCore.dirtySinceVerify).toBe(true);

    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: ledger,
      currentVerifyProjectHash: hashAfter,
      dirtySinceVerify: state.projectHealthCore.dirtySinceVerify,
    });
    expect(verifyCurrent).toBe(false);
  });
});

describe('verify stale-loop regression — clock pattern insertion', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
    useProjectRuntime.getState().loadFromProject(buildSequentialFixture());
  });

  it('is current (not stale) after inserting a clock pattern and running', () => {
    // Simulate "Insert board clock pattern": buildClockHelperVectors returns id-bearing vectors.
    const clockVectors = buildClockHelperVectors({
      clockSignalName: 'clk',
      startTick: 0,
      count: 4,
      pattern: 'alternating',
    });

    // Clock pattern vectors carry `id` fields — this is the id-bearing path that triggered the bug.
    expect(clockVectors[0]).toHaveProperty('id');

    // Merge with data input vectors (d=1 throughout).
    const allVectors = clockVectors.map((v) => ({
      ...v,
      inputs: { d: 1, ...v.inputs },
    }));
    useProjectRuntime.getState().setVectors(allVectors);

    useProjectRuntime.getState().runVerification({
      scenarioId: 'clock-pattern-run',
      scenarioName: 'Clock Pattern Run',
      deterministicHash: 'clock-pattern-run-hash',
      rows: [],
      ranAtIso: '2026-04-29T00:05:00.000Z',
    });

    const state = useProjectRuntime.getState();
    const ledger = state.verifyRunHistory[state.verifyRunHistory.length - 1];
    const hashAfter = currentVerifyProjectHash();

    expect(ledger?.projectHash).toBe(hashAfter);
    expect(state.projectHealthCore.dirtySinceVerify).toBe(false);

    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: ledger,
      currentVerifyProjectHash: hashAfter,
      dirtySinceVerify: false,
    });
    expect(verifyCurrent).toBe(true);
  });
});
