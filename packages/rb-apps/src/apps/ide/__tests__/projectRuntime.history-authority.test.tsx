// @vitest-environment jsdom

import React, { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../export/projectFormat';
import {
  buildCurrentVerifyProjectHash,
  deriveExportCurrent,
  deriveVerifyCurrent,
} from '../../IdeApp';
import { useCircuitStore } from '../../../stores/circuitStore';
import { digestValue } from '../../../utils/digest';
import { BoardSignalProvider } from '../BoardSignalContext';
import { projectRuntimeCircuitToEditorStore } from '../circuitProjection';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';
import { HardwareSurface } from '../surfaces/HardwareSurface';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';

function buildHistoryFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    name: 'Runtime History Fixture',
    description: 'Simple circuit for runtime history authority tests.',
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
          position: { x: 180, y: 0 },
          x: 180,
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
    ],
    meta: {
      projectId: 'rb-runtime-history-fixture',
    },
  };
}

function RuntimeProjectionHarness() {
  const circuit = useProjectRuntime((state) => state.circuit);

  useLayoutEffect(() => {
    projectRuntimeCircuitToEditorStore(circuit);
  }, [circuit]);

  return null;
}

function currentProjectHash(): string {
  const state = useProjectRuntime.getState();
  return buildCurrentVerifyProjectHash({
    circuit: state.circuit,
    projectVectors: state.projectVectors,
    projectIoRows: state.projectIoRows,
  });
}

function expectEditorProjectionMatchesRuntime() {
  return waitFor(() => {
    expect(digestValue(useCircuitStore.getState().circuit)).toBe(
      digestValue(useProjectRuntime.getState().circuit)
    );
  });
}

describe('projectRuntime history authority', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
    useProjectRuntime.getState().loadFromProject(buildHistoryFixture());
  });

  afterEach(() => {
    cleanup();
  });

  it('owns undo/redo state transitions and keeps the editor projection in sync', async () => {
    render(<RuntimeProjectionHarness />);

    const originalCircuit = structuredClone(useProjectRuntime.getState().circuit);
    const nextCircuit: Circuit = {
      ...originalCircuit,
      nodes: [
        ...originalCircuit.nodes,
        {
          ...originalCircuit.nodes[0],
          id: 'sw0_node_copy',
          label: 'sw0-copy',
          position: { x: 0, y: 96 },
          x: 0,
          y: 96,
        },
      ],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(nextCircuit);
    });

    expect(useProjectRuntime.getState().designPast).toHaveLength(1);
    expect(useProjectRuntime.getState().designFuture).toHaveLength(0);
    expect(useProjectRuntime.getState().designRevision).toBe(1);
    await expectEditorProjectionMatchesRuntime();

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(digestValue(useProjectRuntime.getState().circuit)).toBe(digestValue(originalCircuit));
    expect(useProjectRuntime.getState().designPast).toHaveLength(0);
    expect(useProjectRuntime.getState().designFuture).toHaveLength(1);
    expect(useProjectRuntime.getState().designRevision).toBe(2);
    await expectEditorProjectionMatchesRuntime();

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(digestValue(useProjectRuntime.getState().circuit)).toBe(digestValue(nextCircuit));
    expect(useProjectRuntime.getState().designPast).toHaveLength(1);
    expect(useProjectRuntime.getState().designFuture).toHaveLength(0);
    expect(useProjectRuntime.getState().designRevision).toBe(3);
    await expectEditorProjectionMatchesRuntime();
  });

  it('label edits survive runtime undo/redo correctly', () => {
    const originalLabel = useProjectRuntime.getState().circuit.nodes.find(
      (node) => node.id === 'sw0_node'
    )?.label;
    const originalRowLabel = useProjectRuntime.getState().projectIoRows.find(
      (row) => row.nodeId === 'sw0_node'
    )?.label;
    const editedCircuit: Circuit = {
      ...useProjectRuntime.getState().circuit,
      nodes: useProjectRuntime.getState().circuit.nodes.map((node) =>
        node.id === 'sw0_node' ? { ...node, label: 'renamed-sw0' } : node
      ),
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(editedCircuit);
    });

    expect(
      useProjectRuntime.getState().circuit.nodes.find((node) => node.id === 'sw0_node')?.label
    ).toBe('renamed-sw0');
    expect(
      useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'sw0_node')?.label
    ).toBe('renamed-sw0');

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(
      useProjectRuntime.getState().circuit.nodes.find((node) => node.id === 'sw0_node')?.label
    ).toBe(originalLabel);
    expect(
      useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'sw0_node')?.label
    ).toBe(originalRowLabel);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(
      useProjectRuntime.getState().circuit.nodes.find((node) => node.id === 'sw0_node')?.label
    ).toBe('renamed-sw0');
    expect(
      useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'sw0_node')?.label
    ).toBe('renamed-sw0');
  });

  it('prunes orphan rows and keeps the pinned survivor when duplicate rows target one live boundary node', () => {
    const malformedProject = buildHistoryFixture();
    malformedProject.ioMapping.outputs = [
      {
        id: 'ld0_shadow',
        nodeId: 'ld0_node',
        port: 'in',
        label: 'ld0-shadow',
        pin: '',
      },
      {
        id: 'ld0',
        nodeId: 'ld0_node',
        port: 'in',
        label: 'ld0',
        pin: 'LD0',
      },
      {
        id: 'ghost_output',
        nodeId: 'ghost_output_node',
        port: 'in',
        label: 'ghost-output',
        pin: 'LD9',
      },
    ];

    useProjectRuntime.getState().loadFromProject(malformedProject);

    const renamedCircuit: Circuit = {
      ...useProjectRuntime.getState().circuit,
      nodes: useProjectRuntime.getState().circuit.nodes.map((node) =>
        node.id === 'ld0_node' ? { ...node, label: 'ld0-live' } : node
      ),
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(renamedCircuit);
    });

    const rows = useProjectRuntime.getState().projectIoRows;
    const liveOutputRows = rows.filter((row) => row.nodeId === 'ld0_node');

    expect(rows.some((row) => row.nodeId === 'ghost_output_node')).toBe(false);
    expect(liveOutputRows).toHaveLength(1);
    expect(liveOutputRows[0]?.pin).toBe('LD0');
    expect(liveOutputRows[0]?.label).toBe('ld0-live');
  });

  it('reconciles orphan and duplicate boundary rows immediately when loading a malformed project', () => {
    const malformedProject = buildHistoryFixture();
    malformedProject.ioMapping.outputs = [
      {
        id: 'ld0_shadow',
        nodeId: 'ld0_node',
        port: 'in',
        label: 'ld0-shadow',
        pin: '',
      },
      {
        id: 'ld0',
        nodeId: 'ld0_node',
        port: 'in',
        label: 'ld0',
        pin: 'LD0',
      },
      {
        id: 'ghost_output',
        nodeId: 'ghost_output_node',
        port: 'in',
        label: 'ghost-output',
        pin: 'LD9',
      },
    ];

    useProjectRuntime.getState().loadFromProject(malformedProject);

    const rows = useProjectRuntime.getState().projectIoRows;
    const liveOutputRows = rows.filter((row) => row.nodeId === 'ld0_node');

    expect(rows.some((row) => row.nodeId === 'ghost_output_node')).toBe(false);
    expect(liveOutputRows).toHaveLength(1);
    expect(liveOutputRows[0]?.pin).toBe('LD0');
    expect(liveOutputRows[0]?.label).toBe('ld0');
  });

  it('duplicate-style payloads survive runtime undo/redo correctly', () => {
    const originalCount = useProjectRuntime.getState().circuit.nodes.length;
    const duplicatedCircuit: Circuit = {
      ...useProjectRuntime.getState().circuit,
      nodes: [
        ...useProjectRuntime.getState().circuit.nodes,
        {
          ...useProjectRuntime.getState().circuit.nodes[0],
          id: 'sw0_node_duplicate',
          label: 'sw0-dup',
          position: { x: 0, y: 96 },
          x: 0,
          y: 96,
        },
      ],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(duplicatedCircuit);
    });

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(originalCount + 1);

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(originalCount);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(originalCount + 1);
  });

  it('paste-style payloads survive runtime undo/redo correctly', () => {
    const original = structuredClone(useProjectRuntime.getState().circuit);
    const pastedCircuit: Circuit = {
      nodes: [
        ...original.nodes,
        {
          ...original.nodes[0],
          id: 'pasted_sw1_node',
          label: 'sw1',
          position: { x: 0, y: 120 },
          x: 0,
          y: 120,
        },
        {
          ...original.nodes[1],
          id: 'pasted_ld1_node',
          label: 'ld1',
          position: { x: 180, y: 120 },
          x: 180,
          y: 120,
        },
      ],
      connections: [
        ...original.connections,
        {
          from: { nodeId: 'pasted_sw1_node', portName: 'out' },
          to: { nodeId: 'pasted_ld1_node', portName: 'in' },
        },
      ],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(pastedCircuit);
    });

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(original.nodes.length + 2);
    expect(useProjectRuntime.getState().circuit.connections).toHaveLength(
      original.connections.length + 1
    );

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(digestValue(useProjectRuntime.getState().circuit)).toBe(digestValue(original));

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(digestValue(useProjectRuntime.getState().circuit)).toBe(digestValue(pastedCircuit));
  });

  it('clears redo history when a new mutation follows undo', () => {
    const original = structuredClone(useProjectRuntime.getState().circuit);
    const firstEdit: Circuit = {
      ...original,
      nodes: [
        ...original.nodes,
        {
          ...original.nodes[0],
          id: 'history-node-1',
          label: 'history-1',
          position: { x: 0, y: 96 },
          x: 0,
          y: 96,
        },
      ],
    };
    const secondEdit: Circuit = {
      ...original,
      nodes: [
        ...original.nodes,
        {
          ...original.nodes[0],
          id: 'history-node-2',
          label: 'history-2',
          position: { x: 32, y: 128 },
          x: 32,
          y: 128,
        },
      ],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(firstEdit);
    });
    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().designFuture).toHaveLength(1);

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(secondEdit);
    });

    expect(useProjectRuntime.getState().designFuture).toHaveLength(0);
  });

  it('runtime-native node insertion becomes undoable', async () => {
    render(<RuntimeProjectionHarness />);

    const beforeCount = useProjectRuntime.getState().circuit.nodes.length;

    act(() => {
      useProjectRuntime.getState().addDesignNode('AND', { x: 240, y: 80 });
    });

    expect(useProjectRuntime.getState().designPast).toHaveLength(1);
    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(beforeCount + 1);
    await expectEditorProjectionMatchesRuntime();

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(beforeCount);
    await expectEditorProjectionMatchesRuntime();

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(beforeCount + 1);
    await expectEditorProjectionMatchesRuntime();
  });

  it('board IO edits are recorded in runtime history with mapping rollback/restore', () => {
    const beforeRows = structuredClone(useProjectRuntime.getState().projectIoRows);

    act(() => {
      useProjectRuntime.getState().addDesignBoardIo({
        alias: 'SW2',
        direction: 'in',
        kind: 'switch',
        position: { x: 320, y: 96 },
      });
    });

    const afterAddRows = structuredClone(useProjectRuntime.getState().projectIoRows);
    expect(afterAddRows.length).toBe(beforeRows.length + 1);
    expect(useProjectRuntime.getState().designPast).toHaveLength(1);

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows).toEqual(beforeRows);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows).toEqual(afterAddRows);
  });

  it('verify and export derive from the post-undo canonical runtime state', () => {
    const originalHash = currentProjectHash();
    const disconnectedCircuit: Circuit = {
      ...useProjectRuntime.getState().circuit,
      connections: [],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(disconnectedCircuit);
    });

    expect(currentProjectHash()).not.toBe(originalHash);

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    const undoneHash = currentProjectHash();
    expect(undoneHash).toBe(originalHash);
    expect(
      deriveVerifyCurrent({
        hasVerifyRun: true,
        latestVerifyLedgerEntry: { projectHash: originalHash },
        currentVerifyProjectHash: undoneHash,
        dirtySinceVerify: true,
      })
    ).toBe(true);
    expect(
      deriveExportCurrent({
        lastExport: {
          status: 'ok',
          hash: originalHash,
          ranAtIso: '2026-03-18T00:00:00.000Z',
        },
        currentExportHash: undoneHash,
        dirtySinceExport: true,
      })
    ).toBe(true);

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'post-undo-canonical-state',
      scenarioName: 'Post Undo Canonical State',
      deterministicHash: 'post-undo-canonical-state-hash',
      rows: [],
      ranAtIso: '2026-03-18T00:05:00.000Z',
      useRuntimeTrace: false,
    });

    expect(run.status).toBe('pass');
  });

  it('deleting a boundary output prunes stale authority and undo/redo never leaves ghost readiness state', () => {
    const originalHash = currentProjectHash();
    const deletedOutputCircuit: Circuit = {
      nodes: useProjectRuntime
        .getState()
        .circuit.nodes.filter((node) => node.id !== 'ld0_node'),
      connections: useProjectRuntime.getState().circuit.connections.filter((connection) => {
        const fromNodeId =
          typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return fromNodeId !== 'ld0_node' && toNodeId !== 'ld0_node';
      }),
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(deletedOutputCircuit);
    });

    const deletedHash = currentProjectHash();
    expect(useProjectRuntime.getState().circuit.nodes.some((node) => node.id === 'ld0_node')).toBe(false);
    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld0_node')).toBe(false);
    expect(deletedHash).not.toBe(originalHash);
    expect(
      deriveVerifyCurrent({
        hasVerifyRun: true,
        latestVerifyLedgerEntry: { projectHash: originalHash },
        currentVerifyProjectHash: deletedHash,
        dirtySinceVerify: true,
      })
    ).toBe(false);
    expect(
      deriveExportCurrent({
        lastExport: {
          status: 'ok',
          hash: originalHash,
          ranAtIso: '2026-03-21T00:00:00.000Z',
        },
        currentExportHash: deletedHash,
        dirtySinceExport: true,
      })
    ).toBe(false);

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    const restoredHash = currentProjectHash();
    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld0_node')).toBe(true);
    expect(restoredHash).toBe(originalHash);
    expect(
      deriveVerifyCurrent({
        hasVerifyRun: true,
        latestVerifyLedgerEntry: { projectHash: originalHash },
        currentVerifyProjectHash: restoredHash,
        dirtySinceVerify: true,
      })
    ).toBe(true);
    expect(
      deriveExportCurrent({
        lastExport: {
          status: 'ok',
          hash: originalHash,
          ranAtIso: '2026-03-21T00:00:00.000Z',
        },
        currentExportHash: restoredHash,
        dirtySinceExport: true,
      })
    ).toBe(true);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    const redoneHash = currentProjectHash();
    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld0_node')).toBe(false);
    expect(redoneHash).toBe(deletedHash);
    expect(
      deriveVerifyCurrent({
        hasVerifyRun: true,
        latestVerifyLedgerEntry: { projectHash: originalHash },
        currentVerifyProjectHash: redoneHash,
        dirtySinceVerify: true,
      })
    ).toBe(false);
    expect(
      deriveExportCurrent({
        lastExport: {
          status: 'ok',
          hash: originalHash,
          ranAtIso: '2026-03-21T00:00:00.000Z',
        },
        currentExportHash: redoneHash,
        dirtySinceExport: true,
      })
    ).toBe(false);
  });

  it('keeps Verify/Export/Project/Hardware aligned after restore when mapping changed and legacy export hash is missing', () => {
    const current = useProjectRuntime.getState();
    const verifiedProjectHash = currentProjectHash();

    const restored = mergePersistedRuntimeState(
      {
        projectId: 'rb-cross-surface-restore-mapping',
        projectName: 'Cross Surface Restore Mapping',
        activeExampleId: null,
        projectIoRows: [
          {
            id: 'sw0',
            nodeId: 'sw0_node',
            port: 'out',
            label: 'sw0',
            direction: 'in',
            pin: 'SW1',
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
        projectVectors: current.projectVectors,
        circuit: current.circuit,
        verifyRunHistory: [
          {
            runId: 'verify-pre-mapping-mutation',
            ranAtIso: '2026-03-22T00:00:00.000Z',
            status: 'pass',
            passedRows: 2,
            failedRows: 0,
            firstFailure: null,
            circuitHash: 'cir_before_mapping_change',
            vectorsHash: 'vec_before_mapping_change',
            mappingHash: 'map_before_mapping_change',
            projectHash: verifiedProjectHash,
            didCircuitChangeSinceLast: false,
            didVectorsChangeSinceLast: false,
            didMappingChangeSinceLast: false,
          },
        ],
        projectHealthCore: {
          lastVerify: {
            status: 'pass',
            hash: 'vrf_cross_surface_hash',
            reportHash: 'vrf_cross_surface_report_hash',
            ranAtIso: '2026-03-22T00:00:00.000Z',
          },
          // Legacy persisted export trust can have status ok without a hash.
          lastExport: {
            status: 'ok',
            ranAtIso: '2026-03-22T00:05:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
      },
      current
    );

    const restoredProjectHash = buildCurrentVerifyProjectHash({
      circuit: restored.circuit,
      projectVectors: restored.projectVectors,
      projectIoRows: restored.projectIoRows,
    });
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: Boolean(restored.verifyLastRun),
      latestVerifyLedgerEntry: restored.verifyRunHistory.at(-1),
      currentVerifyProjectHash: restoredProjectHash,
      dirtySinceVerify: restored.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: restored.projectHealthCore.lastExport,
      currentExportHash: undefined,
      dirtySinceExport: restored.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(restored.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: restored.projectHealthCore.lastVerify?.qualification,
    });

    expect(restored.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(restored.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: restored.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={restored.projectName}
          expectedBehavior="LED0 follows SW0."
          mappingRows={restored.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={[]}
          vectorsCount={restored.projectVectors.length}
          health={health}
          verifyCurrent={verifyCurrent}
          exportCurrent={exportCurrent}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Verify: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Bring-up blocked');
  });

  it('keeps Project/Verify/Export/Hardware aligned when restored verify trust has no run ledger evidence', () => {
    const current = useProjectRuntime.getState();
    const verifiedProjectHash = currentProjectHash();

    const restored = mergePersistedRuntimeState(
      {
        projectId: 'rb-no-ledger-verify-trust',
        projectName: 'No Ledger Verify Trust',
        activeExampleId: null,
        projectIoRows: current.projectIoRows,
        projectVectors: current.projectVectors,
        circuit: current.circuit,
        // Legacy state: trusted lastVerify survives, but no authoritative verify run evidence is present.
        verifyRunHistory: [],
        projectHealthCore: {
          lastVerify: {
            status: 'pass',
            hash: 'vrf_no_ledger_hash',
            reportHash: 'vrf_no_ledger_report_hash',
            ranAtIso: '2026-03-22T01:00:00.000Z',
          },
          lastExport: {
            status: 'ok',
            hash: verifiedProjectHash,
            ranAtIso: '2026-03-22T01:05:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
      },
      current
    );

    const restoredProjectHash = buildCurrentVerifyProjectHash({
      circuit: restored.circuit,
      projectVectors: restored.projectVectors,
      projectIoRows: restored.projectIoRows,
    });
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: Boolean(restored.verifyLastRun),
      latestVerifyLedgerEntry: restored.verifyRunHistory.at(-1),
      currentVerifyProjectHash: restoredProjectHash,
      dirtySinceVerify: restored.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: restored.projectHealthCore.lastExport,
      currentExportHash: restoredProjectHash,
      dirtySinceExport: restored.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(restored.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: restored.projectHealthCore.lastVerify?.qualification,
    });

    expect(restored.verifyLastRun).toBeUndefined();
    expect(restored.verifyRunHistory).toEqual([]);
    expect(restored.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(restored.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: restored.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={restored.projectName}
          expectedBehavior="LED0 follows SW0."
          mappingRows={restored.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={[]}
          vectorsCount={restored.projectVectors.length}
          health={health}
          verifyCurrent={verifyCurrent}
          exportCurrent={exportCurrent}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Verify: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Bring-up blocked');
  });
});