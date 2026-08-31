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
 *
 * Additional regression (fixed 2026-07-22): wire-only Design Undo could
 * restore pre-testbench compatibility vectors while preserving the current
 * named scenario. Verify ran the scenario but ledger hashing read the stale
 * mirror, leaving Export stale after a valid post-mapping Compare.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  materializeIoMappingFromHardwareMappingV2,
  migrateIoMappingToHardwareMappingV2,
  type IoMapping,
} from '@redbyte/rb-utils';
import type { RBProject } from '../../../export/projectFormat';
import { useCircuitStore } from '../../../stores/circuitStore';
import { buildClockHelperVectors } from '../clockAuthority';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
} from '../projectHierarchy';
import { deriveVerifyCurrent, deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';
import { useProjectRuntime } from '../projectRuntime';
import {
  buildCurrentVerifyProjectHash,
  buildVerifyCircuitEvidenceHash,
  buildVerifyMappingEvidenceHash,
} from '../verifyProjectHash';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';
import {
  computeExecutionStimulusHash,
  computeScenarioContentHash,
  materializeScenarioVectors,
} from '../verifyScenario';

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

function buildHalfAdderHistoryFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    name: 'Half Adder History Freshness',
    description: 'A from-scratch Half Adder before its Carry output is wired.',
    circuit: {
      nodes: [
        { id: 'a_node', type: 'INPUT', label: 'A', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} },
        { id: 'b_node', type: 'INPUT', label: 'B', position: { x: 0, y: 100 }, x: 0, y: 100, rotation: 0, config: {}, state: {} },
        { id: 'xor_node', type: 'XOR', label: 'XOR', position: { x: 200, y: 0 }, x: 200, y: 0, rotation: 0, config: {}, state: {} },
        { id: 'and_node', type: 'AND', label: 'AND', position: { x: 200, y: 100 }, x: 200, y: 100, rotation: 0, config: {}, state: {} },
        { id: 'sum_node', type: 'OUTPUT', label: 'Sum', position: { x: 400, y: 0 }, x: 400, y: 0, rotation: 0, config: {}, state: {} },
        { id: 'carry_node', type: 'OUTPUT', label: 'Carry', position: { x: 400, y: 100 }, x: 400, y: 100, rotation: 0, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'a_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'a' } },
        { from: { nodeId: 'b_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'b' } },
        { from: { nodeId: 'a_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'a' } },
        { from: { nodeId: 'b_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'b' } },
        { from: { nodeId: 'xor_node', portName: 'out' }, to: { nodeId: 'sum_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'a', nodeId: 'a_node', port: 'out', label: 'A', pin: '' },
        { id: 'b', nodeId: 'b_node', port: 'out', label: 'B', pin: '' },
      ],
      outputs: [
        { id: 'sum', nodeId: 'sum_node', port: 'in', label: 'Sum', pin: '' },
        { id: 'carry', nodeId: 'carry_node', port: 'in', label: 'Carry', pin: '' },
      ],
    },
    vectors: [],
    meta: { projectId: 'half-adder-history-freshness' },
  };
}

const HALF_ADDER_VECTORS = [
  { id: 'vec-00', tick: 0, inputs: { a: 0, b: 0 }, expected: { sum: 0, carry: 0 } },
  { id: 'vec-01', tick: 1, inputs: { a: 0, b: 1 }, expected: { sum: 1, carry: 0 } },
  { id: 'vec-10', tick: 2, inputs: { a: 1, b: 0 }, expected: { sum: 1, carry: 0 } },
  { id: 'vec-11', tick: 3, inputs: { a: 1, b: 1 }, expected: { sum: 0, carry: 1 } },
];

function currentVerifyProjectHash(): string {
  const state = useProjectRuntime.getState();
  return buildCurrentVerifyProjectHash({
    circuit: state.circuit,
    projectVectors: state.projectVectors,
    customVectors: state.customVectors,
    projectIoRows: state.projectIoRows,
  });
}

function currentSurfaceVerifyProjectHash(): string {
  const state = useProjectRuntime.getState();
  const activeScenario = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
  return buildCurrentVerifyProjectHash({
    circuit: state.circuit,
    projectVectors: activeScenario ? materializeScenarioVectors(activeScenario) : state.projectVectors,
    customVectors: state.customVectors,
    projectIoRows: state.projectIoRows,
  });
}

function buildIdeAppProjectedExportProject(): RBProject {
  const state = useProjectRuntime.getState();
  const fixture = buildCombinationalFixture();
  return {
    ...fixture,
    name: state.projectName,
    description: state.projectDescription,
    circuit: {
      nodes: state.circuit.nodes.map((node) => {
        const x = node.position?.x ?? node.x ?? 0;
        const y = node.position?.y ?? node.y ?? 0;
        return {
          ...node,
          position: node.position ?? { x, y },
          x,
          y,
          config: node.config ?? {},
          state: node.state ?? {},
        };
      }),
      connections: state.circuit.connections.map((connection) => ({ ...connection })),
    },
    ioMapping: {
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
    },
    vectors: state.projectVectors,
  };
}

// Tests

describe('verify stale-loop regression — id-bearing vectors', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
    useProjectRuntime.getState().loadFromProject(buildCombinationalFixture());
  });

  it('keeps mapping evidence stable across row order and V2 materialization order', () => {
    const mapping = buildCombinationalFixture().ioMapping!;
    const reordered: IoMapping = {
      inputs: [...mapping.inputs].reverse(),
      outputs: [...mapping.outputs].reverse(),
    };
    const materializedV2 = materializeIoMappingFromHardwareMappingV2(
      migrateIoMappingToHardwareMappingV2(reordered)
    );

    expect(buildVerifyMappingEvidenceHash(reordered)).toBe(
      buildVerifyMappingEvidenceHash(mapping)
    );
    expect(buildVerifyMappingEvidenceHash(materializedV2)).toBe(
      buildVerifyMappingEvidenceHash(mapping)
    );
  });

  it('treats layout, array order, and transient state as non-semantic circuit changes', () => {
    const circuit = buildCombinationalFixture().circuit;
    const rearranged = {
      nodes: [...circuit.nodes].reverse().map((node, index) => ({
        ...node,
        x: 900 + index,
        y: 700 + index,
        position: { x: 900 + index, y: 700 + index },
        state: { isOn: index % 2 },
      })),
      connections: [...circuit.connections].reverse(),
    };

    expect(buildVerifyCircuitEvidenceHash(rearranged)).toBe(
      buildVerifyCircuitEvidenceHash(circuit)
    );
    expect(
      buildVerifyCircuitEvidenceHash({
        ...circuit,
        nodes: circuit.nodes.map((node) =>
          node.id === 'sw0_node'
            ? { ...node, config: { ...(node.config ?? {}), semanticOption: true } }
            : node
        ),
      })
    ).not.toBe(buildVerifyCircuitEvidenceHash(circuit));
  });

  it('keeps a just-completed run current through the real IdeApp circuit projection', () => {
    const beforeRun = useProjectRuntime.getState();
    const scenario = beforeRun.scenarios.find((entry) => entry.id === beforeRun.activeScenarioId)!;
    const vectors = materializeScenarioVectors(scenario);
    const run = beforeRun.runVerification({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioVersion: scenario.version,
      scenarioContentHash: computeScenarioContentHash(scenario),
      scenarioStimulusHash: computeExecutionStimulusHash(vectors),
      deterministicHash: 'ide-app-projection-currentness',
      assertionMode: true,
      vectors,
      rows: [],
      ranAtIso: '2026-07-22T12:00:00.000Z',
    });

    const viewModel = buildExportViewModel(
      buildIdeAppProjectedExportProject(),
      run,
      scenario,
    );
    const expectedIo = JSON.parse(
      viewModel.artifacts.find((artifact) => artifact.path === 'EXPECTED_IO.json')?.content ?? '{}'
    ) as { source?: string; verifyHash?: string };

    expect(run.evidence?.circuitHash).toBeTruthy();
    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.verifyHash).toBe(run.deterministicHash);
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note)
      .toContain('verified PASS');
  });

  it('keeps a just-completed hierarchical run current in generated testbench provenance', () => {
    const hierarchyFixture = createModuleFromSelection(
      {
        nodes: [
          { id: 'a_node', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
          { id: 'b_node', type: 'INPUT', label: 'B', position: { x: 0, y: 120 } },
          { id: 'xor_node', type: 'XOR', label: 'XOR', position: { x: 200, y: 40 } },
          { id: 'and_node', type: 'AND', label: 'AND', position: { x: 380, y: 40 } },
          { id: 'out_node', type: 'OUTPUT', label: 'Y', position: { x: 580, y: 40 } },
        ],
        connections: [
          { from: { nodeId: 'a_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'a' } },
          { from: { nodeId: 'b_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'b' } },
          { from: { nodeId: 'xor_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'a' } },
          { from: { nodeId: 'b_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'b' } },
          { from: { nodeId: 'and_node', portName: 'out' }, to: { nodeId: 'out_node', portName: 'in' } },
        ],
      },
      createEmptyProjectHierarchy(),
      {
        moduleName: 'LogicStage',
        instanceName: 'logic0',
        selectedNodeIds: ['xor_node', 'and_node'],
        nowIso: '2026-08-08T17:00:00.000Z',
      }
    );
    const project: RBProject = {
      ...buildCombinationalFixture(),
      name: 'Hierarchy Verify Freshness',
      circuit: hierarchyFixture.circuit,
      hierarchy: hierarchyFixture.hierarchy,
      ioMapping: {
        inputs: [
          { id: 'a', nodeId: 'a_node', port: 'out', label: 'A', pin: 'SW0' },
          { id: 'b', nodeId: 'b_node', port: 'out', label: 'B', pin: 'SW1' },
        ],
        outputs: [{ id: 'y', nodeId: 'out_node', port: 'in', label: 'Y', pin: 'LD0' }],
      },
      vectors: [
        { id: 'case-0', tick: 0, inputs: { a: 0, b: 0 }, expected: { y: 0 } },
        { id: 'case-1', tick: 1, inputs: { a: 0, b: 1 }, expected: { y: 1 } },
      ],
    };
    useProjectRuntime.getState().loadFromProject(project);

    const state = useProjectRuntime.getState();
    const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId)!;
    const vectors = materializeScenarioVectors(scenario);
    const run = state.runVerification({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioVersion: scenario.version,
      scenarioContentHash: computeScenarioContentHash(scenario),
      scenarioStimulusHash: computeExecutionStimulusHash(vectors),
      deterministicHash: 'hierarchy-export-currentness',
      assertionMode: true,
      vectors,
      rows: [],
      ranAtIso: '2026-08-08T17:05:00.000Z',
    });
    const projectedProject: RBProject = {
      ...project,
      circuit: state.circuit,
      hierarchy: state.hierarchy,
      vectors,
    };
    const viewModel = buildExportViewModel(projectedProject, run, scenario);

    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note)
      .toContain('verified PASS');
  });

  it('never promotes a trace-only run into exported Verify evidence', () => {
    const beforeRun = useProjectRuntime.getState();
    const scenario = beforeRun.scenarios.find((entry) => entry.id === beforeRun.activeScenarioId)!;
    const vectors = materializeScenarioVectors(scenario);
    const run = beforeRun.runVerification({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioVersion: scenario.version,
      scenarioContentHash: computeScenarioContentHash(scenario),
      scenarioStimulusHash: computeExecutionStimulusHash(vectors),
      deterministicHash: 'trace-only-export-provenance',
      assertionMode: false,
      runKind: 'trace',
      vectors,
      rows: [],
      ranAtIso: '2026-07-22T12:01:00.000Z',
    });

    const viewModel = buildExportViewModel(buildIdeAppProjectedExportProject(), run, scenario);
    const expectedIo = JSON.parse(
      viewModel.artifacts.find((artifact) => artifact.path === 'EXPECTED_IO.json')?.content ?? '{}'
    ) as { source?: string; verifyHash?: string };

    expect(expectedIo.source).toBe('project-vectors');
    expect(expectedIo.verifyHash).toBeUndefined();
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note)
      .toContain('STALE');
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

  it('keeps an authored Half Adder scenario authoritative through wire undo, manual repair, mapping, and rerun', () => {
    useProjectRuntime.getState().loadFromProject(buildHalfAdderHistoryFixture());

    // Complete the from-scratch circuit before authoring checks. Its undo
    // snapshot therefore correctly contains no vectors.
    useProjectRuntime.getState().connectDesignNodes({
      fromNodeId: 'and_node',
      fromPort: 'out',
      toNodeId: 'carry_node',
      toPort: 'in',
    });
    useProjectRuntime.getState().setVectors(HALF_ADDER_VECTORS);
    useProjectRuntime.getState().renameScenario('Half Adder Truth Table');
    useProjectRuntime.getState().runVerification({
      scenarioId: useProjectRuntime.getState().activeScenarioId,
      scenarioName: 'Half Adder Truth Table',
      deterministicHash: 'before-wire-break-hash',
      assertionMode: true,
      rows: [],
      ranAtIso: '2026-04-29T00:04:30.000Z',
    });

    expect(useProjectRuntime.getState().verifyLastRun?.qualification).toBe('incomplete-mapping');
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(false);

    // Reproduce the student repair path: Undo reaches the pre-testbench Design
    // snapshot, then a normal new connection repairs Carry (not Redo).
    useProjectRuntime.getState().undoProjectEdit();
    let state = useProjectRuntime.getState();
    let activeScenario = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
    expect(activeScenario?.name).toBe('Half Adder Truth Table');
    expect(materializeScenarioVectors(activeScenario!)).toHaveLength(4);
    expect(state.projectVectors).toEqual(materializeScenarioVectors(activeScenario!));

    useProjectRuntime.getState().connectDesignNodes({
      fromNodeId: 'and_node',
      fromPort: 'out',
      toNodeId: 'carry_node',
      toPort: 'in',
    });
    state = useProjectRuntime.getState();
    activeScenario = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
    expect(state.projectVectors).toEqual(materializeScenarioVectors(activeScenario!));

    useProjectRuntime.getState().runVerification({
      scenarioId: state.activeScenarioId,
      scenarioName: 'Half Adder Truth Table',
      deterministicHash: 'after-wire-repair-hash',
      assertionMode: true,
      rows: [],
      ranAtIso: '2026-04-29T00:04:31.000Z',
    });
    expect(useProjectRuntime.getState().verifyLastRun?.status).toBe('pass');

    useProjectRuntime.getState().setMappingPins({
      a: 'SW0',
      b: 'SW1',
      sum: 'LD0',
      carry: 'LD1',
    });

    const staleState = useProjectRuntime.getState();
    expect(staleState.projectHealthCore.dirtySinceVerify).toBe(true);

    useProjectRuntime.getState().runVerification({
      scenarioId: staleState.activeScenarioId,
      scenarioName: 'Half Adder Truth Table',
      deterministicHash: 'after-mapping-hash',
      assertionMode: true,
      rows: [],
      ranAtIso: '2026-04-29T00:04:32.000Z',
    });

    state = useProjectRuntime.getState();
    const ledger = state.verifyRunHistory[state.verifyRunHistory.length - 1];
    const hashAfter = currentSurfaceVerifyProjectHash();
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

    expect(state.verifyLastRun?.status).toBe('pass');
    expect(state.verifyLastRun?.qualification).toBeUndefined();
    expect(state.projectHealthCore.dirtySinceVerify).toBe(false);
    expect(ledger?.projectHash).toBe(hashAfter);
    expect(authority.verifyCurrent).toBe(true);
    expect(authority.trustedVerifyCurrent).toBe(true);
    expect(authority.verifyState).toBe('assertions-match');
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
