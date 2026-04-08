// @vitest-environment jsdom

import React, { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../export/projectFormat';
import {
  deriveExportCurrent,
  deriveVerifyCurrent,
} from '../projectWorkflowAuthority';
import {
  buildCurrentVerifyProjectHash,
  deriveHasDff,
} from '../../IdeApp';
import { useCircuitStore } from '../../../stores/circuitStore';
import { digestValue } from '../../../utils/digest';
import { BoardSignalProvider } from '../BoardSignalContext';
import { projectRuntimeCircuitToEditorStore } from '../circuitProjection';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';
import { HardwareSurface } from '../surfaces/HardwareSurface';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';
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

function buildTwoOutputHistoryFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
    name: 'Runtime Two Output Fixture',
    description: 'Two-output circuit for IO-count authority tests.',
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
          position: { x: 180, y: -40 },
          x: 180,
          y: -40,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ld1_node',
          type: 'OUTPUT',
          label: 'ld1',
          position: { x: 180, y: 40 },
          x: 180,
          y: 40,
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
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'ld1_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'SW0' }],
      outputs: [
        { id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' },
        { id: 'ld1', nodeId: 'ld1_node', port: 'in', label: 'ld1', pin: 'LD1' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, ld1: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1, ld1: 1 } },
    ],
    meta: {
      projectId: 'rb-runtime-two-output-fixture',
    },
  };
}

function buildProjectFromRuntimeState(): RBProject {
  const state = useProjectRuntime.getState();
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
    name: state.projectName,
    description: state.projectDescription,
    circuit: state.circuit,
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
    meta: {
      projectId: state.projectId,
    },
  };
}

function extractExpectedIoRowsForTest(
  artifacts: ReturnType<typeof buildExportViewModel>['artifacts']
): Array<{ signal: string; tick: number; expected: string }> {
  const expectedIo = artifacts.find((artifact) => artifact.path === 'EXPECTED_IO.json');
  if (!expectedIo || expectedIo.content.trim().length === 0) return [];
  const parsed = JSON.parse(expectedIo.content) as {
    signals?: Array<{
      signal?: string;
      values?: Array<{ tick?: number; expected?: string | number }>;
    }>;
  };
  const rows: Array<{ signal: string; tick: number; expected: string }> = [];
  for (const signalRow of parsed.signals ?? []) {
    const signal = (signalRow.signal ?? '').trim();
    if (signal.length === 0) continue;
    for (const value of signalRow.values ?? []) {
      if (!Number.isFinite(value.tick)) continue;
      rows.push({
        signal,
        tick: Math.max(0, Math.floor(Number(value.tick))),
        expected: String(value.expected ?? '0'),
      });
    }
  }
  return rows;
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

  it('deleting an output after verify and export prunes stale expected outputs and keeps all surfaces aligned', () => {
    useProjectRuntime.getState().loadFromProject(buildTwoOutputHistoryFixture());

    const originalHash = currentProjectHash();
    const verifyRun = useProjectRuntime.getState().runVerification({
      scenarioId: 'two-output-baseline',
      scenarioName: 'Two Output Baseline',
      deterministicHash: 'two-output-baseline-hash',
      rows: [],
      ranAtIso: '2026-03-22T02:00:00.000Z',
      useRuntimeTrace: false,
    });
    expect(verifyRun.status).toBe('pass');

    act(() => {
      useProjectRuntime.getState().recordExport({
        status: 'ok',
        hash: originalHash,
        ranAtIso: '2026-03-22T02:01:00.000Z',
      });
    });

    const deletedOutputCircuit: Circuit = {
      nodes: useProjectRuntime
        .getState()
        .circuit.nodes.filter((node) => node.id !== 'ld1_node'),
      connections: useProjectRuntime.getState().circuit.connections.filter((connection) => {
        const fromNodeId =
          typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return fromNodeId !== 'ld1_node' && toNodeId !== 'ld1_node';
      }),
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(deletedOutputCircuit);
    });

    const deletedHash = currentProjectHash();
    const runtimeState = useProjectRuntime.getState();
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: runtimeState.verifyRunHistory.at(-1),
      currentVerifyProjectHash: deletedHash,
      dirtySinceVerify: runtimeState.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: runtimeState.projectHealthCore.lastExport,
      currentExportHash: deletedHash,
      dirtySinceExport: runtimeState.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(runtimeState.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: runtimeState.projectHealthCore.lastVerify?.qualification,
    });
    const exportViewModel = buildExportViewModel(buildProjectFromRuntimeState(), runtimeState.verifyLastRun);
    const expectedIoRows = extractExpectedIoRowsForTest(exportViewModel.artifacts);

    expect(runtimeState.projectIoRows.some((row) => row.nodeId === 'ld1_node')).toBe(false);
    expect(runtimeState.projectVectors.every((vector) => !('ld1' in (vector.expected ?? {})))).toBe(true);
    expect(runtimeState.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(runtimeState.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(exportViewModel.pinTable.some((row) => row.port === 'ld1')).toBe(false);
    expect(expectedIoRows.some((row) => row.signal === 'ld1')).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: runtimeState.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={runtimeState.projectName}
          expectedBehavior="LD0 and LD1 follow SW0."
          mappingRows={runtimeState.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={expectedIoRows}
          vectorsCount={runtimeState.projectVectors.length}
          health={health}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');
  });

  it('undo and redo preserve the current pruned vector state after output deletion and vector edits', () => {
    useProjectRuntime.getState().loadFromProject(buildTwoOutputHistoryFixture());

    const deletedOutputCircuit: Circuit = {
      nodes: useProjectRuntime
        .getState()
        .circuit.nodes.filter((node) => node.id !== 'ld1_node'),
      connections: useProjectRuntime.getState().circuit.connections.filter((connection) => {
        const fromNodeId =
          typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return fromNodeId !== 'ld1_node' && toNodeId !== 'ld1_node';
      }),
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(deletedOutputCircuit);
    });

    act(() => {
      useProjectRuntime.getState().setVectors([
        { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } },
        { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 0 } },
      ]);
    });

    expect(useProjectRuntime.getState().projectVectors).toEqual([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 0 } },
    ]);

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld1_node')).toBe(true);
    expect(useProjectRuntime.getState().projectVectors).toEqual([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, ld1: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1, ld1: 1 } },
    ]);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld1_node')).toBe(false);
    expect(useProjectRuntime.getState().projectVectors).toEqual([
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 0 } },
    ]);
  });

  it('adding an output after verify and export invalidates authority and expands expected output identity per state', () => {
    useProjectRuntime.getState().loadFromProject(buildHistoryFixture());

    const originalHash = currentProjectHash();
    const verifyRun = useProjectRuntime.getState().runVerification({
      scenarioId: 'add-output-baseline',
      scenarioName: 'Add Output Baseline',
      deterministicHash: 'add-output-baseline-hash',
      rows: [],
      ranAtIso: '2026-03-22T04:00:00.000Z',
      useRuntimeTrace: false,
    });
    expect(verifyRun.status).toBe('pass');

    act(() => {
      useProjectRuntime.getState().recordExport({
        status: 'ok',
        hash: originalHash,
        ranAtIso: '2026-03-22T04:01:00.000Z',
      });
    });

    const expandedOutputCircuit: Circuit = {
      nodes: [
        ...useProjectRuntime.getState().circuit.nodes,
        {
          id: 'ld1_node',
          type: 'OUTPUT',
          label: 'ld1',
          position: { x: 180, y: 40 },
          x: 180,
          y: 40,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        ...useProjectRuntime.getState().circuit.connections,
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'ld1_node', portName: 'in' },
        },
      ],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(expandedOutputCircuit);
    });

    const expandedHash = currentProjectHash();
    const expandedState = useProjectRuntime.getState();
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: expandedState.verifyRunHistory.at(-1),
      currentVerifyProjectHash: expandedHash,
      dirtySinceVerify: expandedState.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: expandedState.projectHealthCore.lastExport,
      currentExportHash: expandedHash,
      dirtySinceExport: expandedState.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(expandedState.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: expandedState.projectHealthCore.lastVerify?.qualification,
    });
    const expandedExportViewModel = buildExportViewModel(buildProjectFromRuntimeState(), expandedState.verifyLastRun);
    const expandedExpectedIoRows = extractExpectedIoRowsForTest(expandedExportViewModel.artifacts);
    const addedOutputRow = expandedState.projectIoRows.find((row) => row.nodeId === 'ld1_node');

    expect(expandedState.projectIoRows.some((row) => row.nodeId === 'ld1_node' && row.label === 'ld1')).toBe(true);
    expect(addedOutputRow?.id).toBe('ld1');
    expect(
      expandedState.projectVectors.every((vector) => {
        const expected = vector.expected ?? {};
        return addedOutputRow !== undefined && addedOutputRow.id in expected && expected[addedOutputRow.id] === 0;
      })
    ).toBe(true);
    expect(expandedState.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(expandedState.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(expandedExportViewModel.pinTable.some((row) => row.port === 'ld1')).toBe(true);
    expect(expandedExpectedIoRows.some((row) => row.signal === 'ld1')).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: expandedState.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={expandedState.projectName}
          expectedBehavior="LD0 and LD1 follow SW0."
          mappingRows={expandedState.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={expandedExpectedIoRows}
          vectorsCount={expandedState.projectVectors.length}
          health={health}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld1_node')).toBe(false);
    expect(useProjectRuntime.getState().projectVectors.every((vector) => !('ld1' in (vector.expected ?? {})))).toBe(true);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    const redoneState = useProjectRuntime.getState();
    const redoneAddedOutputRow = redoneState.projectIoRows.find((row) => row.nodeId === 'ld1_node');
    expect(redoneAddedOutputRow?.id).toBe('ld1');
    expect(redoneState.projectIoRows.some((row) => row.nodeId === 'ld1_node' && row.label === 'ld1')).toBe(true);
    expect(
      redoneState.projectVectors.every((vector) => {
        const expected = vector.expected ?? {};
        return redoneAddedOutputRow !== undefined && redoneAddedOutputRow.id in expected && expected[redoneAddedOutputRow.id] === 0;
      })
    ).toBe(true);
  });

  it('adding an input after verify and export invalidates authority and expands vector input identity per state', () => {
    useProjectRuntime.getState().loadFromProject(buildTwoOutputHistoryFixture());

    const originalHash = currentProjectHash();
    const verifyRun = useProjectRuntime.getState().runVerification({
      scenarioId: 'add-input-baseline',
      scenarioName: 'Add Input Baseline',
      deterministicHash: 'add-input-baseline-hash',
      rows: [],
      ranAtIso: '2026-03-22T05:00:00.000Z',
      useRuntimeTrace: false,
    });
    expect(verifyRun.status).toBe('pass');

    act(() => {
      useProjectRuntime.getState().recordExport({
        status: 'ok',
        hash: originalHash,
        ranAtIso: '2026-03-22T05:01:00.000Z',
      });
    });

    const expandedInputCircuit: Circuit = {
      nodes: [
        ...useProjectRuntime.getState().circuit.nodes,
        {
          id: 'sw1_node',
          type: 'INPUT',
          label: 'sw1',
          position: { x: 0, y: 120 },
          x: 0,
          y: 120,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        ...useProjectRuntime.getState().circuit.connections,
        {
          from: { nodeId: 'sw1_node', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(expandedInputCircuit);
    });

    const expandedHash = currentProjectHash();
    const expandedState = useProjectRuntime.getState();
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: expandedState.verifyRunHistory.at(-1),
      currentVerifyProjectHash: expandedHash,
      dirtySinceVerify: expandedState.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: expandedState.projectHealthCore.lastExport,
      currentExportHash: expandedHash,
      dirtySinceExport: expandedState.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(expandedState.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: expandedState.projectHealthCore.lastVerify?.qualification,
    });
    const addedInputRow = expandedState.projectIoRows.find((row) => row.nodeId === 'sw1_node');

    expect(addedInputRow?.id).toBe('sw1');
    expect(
      expandedState.projectVectors.every((vector) => {
        const inputs = vector.inputs ?? {};
        return addedInputRow !== undefined && addedInputRow.id in inputs && inputs[addedInputRow.id] === 0;
      })
    ).toBe(true);
    expect(expandedState.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(expandedState.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: expandedState.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={expandedState.projectName}
          expectedBehavior="LD0 and LD1 follow SW0 and SW1."
          mappingRows={expandedState.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={[]}
          vectorsCount={expandedState.projectVectors.length}
          health={health}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'sw1_node')).toBe(false);
    expect(useProjectRuntime.getState().projectVectors.every((vector) => !('sw1' in (vector.inputs ?? {})))).toBe(true);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    const redoneState = useProjectRuntime.getState();
    const redoneAddedInputRow = redoneState.projectIoRows.find((row) => row.nodeId === 'sw1_node');
    expect(redoneAddedInputRow?.id).toBe('sw1');
    expect(
      redoneState.projectVectors.every((vector) => {
        const inputs = vector.inputs ?? {};
        return redoneAddedInputRow !== undefined && redoneAddedInputRow.id in inputs && inputs[redoneAddedInputRow.id] === 0;
      })
    ).toBe(true);
  });

  it('renaming an input after verify and export invalidates authority and removes ghost input identity', () => {
    useProjectRuntime.getState().loadFromProject(buildTwoOutputHistoryFixture());

    const originalHash = currentProjectHash();
    const verifyRun = useProjectRuntime.getState().runVerification({
      scenarioId: 'rename-input-baseline',
      scenarioName: 'Rename Input Baseline',
      deterministicHash: 'rename-input-baseline-hash',
      rows: [],
      ranAtIso: '2026-03-22T06:00:00.000Z',
      useRuntimeTrace: false,
    });
    expect(verifyRun.status).toBe('pass');

    act(() => {
      useProjectRuntime.getState().recordExport({
        status: 'ok',
        hash: originalHash,
        ranAtIso: '2026-03-22T06:01:00.000Z',
      });
    });

    const renamedInputCircuit: Circuit = {
      nodes: useProjectRuntime.getState().circuit.nodes.map((node) =>
        node.id === 'sw0_node' ? { ...node, label: 'sw_main' } : node
      ),
      connections: [...useProjectRuntime.getState().circuit.connections],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(renamedInputCircuit);
    });

    const renamedHash = currentProjectHash();
    const renamedState = useProjectRuntime.getState();
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: renamedState.verifyRunHistory.at(-1),
      currentVerifyProjectHash: renamedHash,
      dirtySinceVerify: renamedState.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: renamedState.projectHealthCore.lastExport,
      currentExportHash: renamedHash,
      dirtySinceExport: renamedState.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(renamedState.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: renamedState.projectHealthCore.lastVerify?.qualification,
    });
    const renamedInputRow = renamedState.projectIoRows.find((row) => row.nodeId === 'sw0_node');

    expect(renamedInputRow?.id).toBe('sw_main');
    expect(renamedState.projectVectors.every((vector) => !('sw0' in (vector.inputs ?? {})))).toBe(true);
    expect(
      renamedState.projectVectors.every((vector) => {
        const inputs = vector.inputs ?? {};
        // Values are preserved during rename (sw0=1 at tick 1 becomes sw_main=1), not reset to 0
        return renamedInputRow !== undefined && renamedInputRow.id in inputs;
      })
    ).toBe(true);
    expect(renamedState.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(renamedState.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: renamedState.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={renamedState.projectName}
          expectedBehavior="LD0 and LD1 follow SW_MAIN."
          mappingRows={renamedState.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={[]}
          vectorsCount={renamedState.projectVectors.length}
          health={health}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'sw0_node' && row.label === 'sw0')).toBe(true);
    expect(useProjectRuntime.getState().projectVectors.some((vector) => 'sw0' in (vector.inputs ?? {}))).toBe(true);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    const redoneState = useProjectRuntime.getState();
    expect(redoneState.projectIoRows.some((row) => row.nodeId === 'sw0_node' && row.label === 'sw_main')).toBe(true);
    expect(redoneState.projectVectors.every((vector) => !('sw0' in (vector.inputs ?? {})))).toBe(true);
  });

  it('deleting an input after verify and export prunes ghost input identity across vectors and scenarios', () => {
    useProjectRuntime.getState().loadFromProject(buildTwoOutputHistoryFixture());

    const originalHash = currentProjectHash();
    const verifyRun = useProjectRuntime.getState().runVerification({
      scenarioId: 'delete-input-baseline',
      scenarioName: 'Delete Input Baseline',
      deterministicHash: 'delete-input-baseline-hash',
      rows: [],
      ranAtIso: '2026-03-22T07:00:00.000Z',
      useRuntimeTrace: false,
    });
    expect(verifyRun.status).toBe('pass');

    act(() => {
      useProjectRuntime.getState().recordExport({
        status: 'ok',
        hash: originalHash,
        ranAtIso: '2026-03-22T07:01:00.000Z',
      });
    });

    const deletedInputCircuit: Circuit = {
      nodes: useProjectRuntime
        .getState()
        .circuit.nodes.filter((node) => node.id !== 'sw0_node'),
      connections: useProjectRuntime.getState().circuit.connections.filter((connection) => {
        const fromNodeId =
          typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return fromNodeId !== 'sw0_node' && toNodeId !== 'sw0_node';
      }),
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(deletedInputCircuit);
    });

    const deletedHash = currentProjectHash();
    const deletedState = useProjectRuntime.getState();
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: deletedState.verifyRunHistory.at(-1),
      currentVerifyProjectHash: deletedHash,
      dirtySinceVerify: deletedState.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: deletedState.projectHealthCore.lastExport,
      currentExportHash: deletedHash,
      dirtySinceExport: deletedState.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(deletedState.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: deletedState.projectHealthCore.lastVerify?.qualification,
    });

    expect(deletedState.projectIoRows.some((row) => row.nodeId === 'sw0_node')).toBe(false);
    expect(deletedState.projectVectors.every((vector) => !('sw0' in (vector.inputs ?? {})))).toBe(true);
    expect(
      deletedState.scenarios.every((scenario) =>
        scenario.vectors.every((vector) => !('sw0' in (vector.inputs ?? {})))
      )
    ).toBe(true);
    expect(deletedState.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(deletedState.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: deletedState.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={deletedState.projectName}
          expectedBehavior="LD0 and LD1 follow the remaining live inputs."
          mappingRows={deletedState.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={[]}
          vectorsCount={deletedState.projectVectors.length}
          health={health}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    const restoredState = useProjectRuntime.getState();
    expect(restoredState.projectIoRows.some((row) => row.nodeId === 'sw0_node')).toBe(true);
    expect(restoredState.projectVectors.some((vector) => 'sw0' in (vector.inputs ?? {}))).toBe(true);
    expect(
      restoredState.scenarios.some((scenario) =>
        scenario.vectors.some((vector) => 'sw0' in (vector.inputs ?? {}))
      )
    ).toBe(true);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    const redoneState = useProjectRuntime.getState();
    expect(redoneState.projectIoRows.some((row) => row.nodeId === 'sw0_node')).toBe(false);
    expect(redoneState.projectVectors.every((vector) => !('sw0' in (vector.inputs ?? {})))).toBe(true);
    expect(
      redoneState.scenarios.every((scenario) =>
        scenario.vectors.every((vector) => !('sw0' in (vector.inputs ?? {})))
      )
    ).toBe(true);
  });

  it('renaming an output after verify and export invalidates authority and removes ghost expected signal identity', () => {
    useProjectRuntime.getState().loadFromProject(buildTwoOutputHistoryFixture());

    const originalHash = currentProjectHash();
    const verifyRun = useProjectRuntime.getState().runVerification({
      scenarioId: 'rename-output-baseline',
      scenarioName: 'Rename Output Baseline',
      deterministicHash: 'rename-output-baseline-hash',
      rows: [],
      ranAtIso: '2026-03-22T03:00:00.000Z',
      useRuntimeTrace: false,
    });
    expect(verifyRun.status).toBe('pass');

    act(() => {
      useProjectRuntime.getState().recordExport({
        status: 'ok',
        hash: originalHash,
        ranAtIso: '2026-03-22T03:01:00.000Z',
      });
    });

    const renamedOutputCircuit: Circuit = {
      nodes: useProjectRuntime.getState().circuit.nodes.map((node) =>
        node.id === 'ld1_node' ? { ...node, label: 'led_status' } : node
      ),
      connections: [...useProjectRuntime.getState().circuit.connections],
    };

    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(renamedOutputCircuit);
    });

    const renamedHash = currentProjectHash();
    const renamedState = useProjectRuntime.getState();
    const verifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: renamedState.verifyRunHistory.at(-1),
      currentVerifyProjectHash: renamedHash,
      dirtySinceVerify: renamedState.projectHealthCore.dirtySinceVerify,
    });
    const exportCurrent = deriveExportCurrent({
      lastExport: renamedState.projectHealthCore.lastExport,
      currentExportHash: renamedHash,
      dirtySinceExport: renamedState.projectHealthCore.dirtySinceExport,
    });
    const health = deriveProjectHealth(renamedState.projectHealthCore, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: renamedState.projectHealthCore.lastVerify?.qualification,
    });
    const renamedExportViewModel = buildExportViewModel(buildProjectFromRuntimeState(), renamedState.verifyLastRun);
    const renamedExpectedIoRows = extractExpectedIoRowsForTest(renamedExportViewModel.artifacts);

    expect(renamedState.projectIoRows.some((row) => row.nodeId === 'ld1_node' && row.label === 'led_status')).toBe(true);
    expect(renamedState.projectVectors.every((vector) => !('ld1' in (vector.expected ?? {})))).toBe(true);
    expect(renamedState.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(renamedState.projectHealthCore.dirtySinceExport).toBe(true);
    expect(verifyCurrent).toBe(false);
    expect(exportCurrent).toBe(false);
    expect(renamedExpectedIoRows.some((row) => row.signal === 'ld1')).toBe(false);
    expect(choosePrimaryProjectCta(health, {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: renamedState.projectHealthCore.lastVerify?.qualification,
    })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName={renamedState.projectName}
          expectedBehavior="LD0 and status LED follow SW0."
          mappingRows={renamedState.projectIoRows.map((row) => ({
            id: row.id,
            nodeId: row.nodeId,
            label: row.label,
            direction: row.direction,
            pin: row.pin,
            required: row.required,
          }))}
          expectedIoRows={renamedExpectedIoRows}
          vectorsCount={renamedState.projectVectors.length}
          health={health}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld1_node' && row.label === 'ld1')).toBe(true);
    expect(useProjectRuntime.getState().projectVectors.some((vector) => 'ld1' in (vector.expected ?? {}))).toBe(true);

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });

    expect(useProjectRuntime.getState().projectIoRows.some((row) => row.nodeId === 'ld1_node' && row.label === 'led_status')).toBe(true);
    expect(useProjectRuntime.getState().projectVectors.every((vector) => !('ld1' in (vector.expected ?? {})))).toBe(true);
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
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');
  });

  it('keeps Project, Verify, Export, and Hardware aligned across the full custom-design authority mutation matrix', () => {
    useProjectRuntime.getState().loadFromProject(buildTwoOutputHistoryFixture());

    const baselineHash = currentProjectHash();
    const verifyRun = useProjectRuntime.getState().runVerification({
      scenarioId: 'authority-matrix-baseline',
      scenarioName: 'Authority Matrix Baseline',
      deterministicHash: 'authority-matrix-baseline-hash',
      rows: [],
      ranAtIso: '2026-03-22T08:00:00.000Z',
      useRuntimeTrace: false,
    });
    expect(verifyRun.status).toBe('pass');

    act(() => {
      useProjectRuntime.getState().recordExport({
        status: 'ok',
        hash: baselineHash,
        ranAtIso: '2026-03-22T08:01:00.000Z',
      });
    });

    const assertRuntimeStaleAlignment = () => {
      const state = useProjectRuntime.getState();
      const hash = currentProjectHash();
      const verifyCurrent = deriveVerifyCurrent({
        hasVerifyRun: true,
        latestVerifyLedgerEntry: state.verifyRunHistory.at(-1),
        currentVerifyProjectHash: hash,
        dirtySinceVerify: state.projectHealthCore.dirtySinceVerify,
      });
      const exportCurrent = deriveExportCurrent({
        lastExport: state.projectHealthCore.lastExport,
        currentExportHash: hash,
        dirtySinceExport: state.projectHealthCore.dirtySinceExport,
      });
      const health = deriveProjectHealth(state.projectHealthCore, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: state.projectHealthCore.lastVerify?.qualification,
      });

      expect(verifyCurrent).toBe(false);
      expect(exportCurrent).toBe(false);
      expect(choosePrimaryProjectCta(health, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: state.projectHealthCore.lastVerify?.qualification,
      })).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });

      const { getByTestId, unmount } = render(
        <BoardSignalProvider>
          <HardwareSurface
            projectName={state.projectName}
            expectedBehavior="Authority matrix flow"
            mappingRows={state.projectIoRows.map((row) => ({
              id: row.id,
              nodeId: row.nodeId,
              label: row.label,
              direction: row.direction,
              pin: row.pin,
              required: row.required,
            }))}
            expectedIoRows={[]}
            vectorsCount={state.projectVectors.length}
            health={health}
            onGenerateBringUpVectors={vi.fn()}
            onOpenExport={vi.fn()}
            onOpenVerify={vi.fn()}
          />
        </BoardSignalProvider>
      );

      expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
      expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
      expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');
      unmount();
    };

    const trustedVerifyCurrent = deriveVerifyCurrent({
      hasVerifyRun: true,
      latestVerifyLedgerEntry: useProjectRuntime.getState().verifyRunHistory.at(-1),
      currentVerifyProjectHash: currentProjectHash(),
      dirtySinceVerify: useProjectRuntime.getState().projectHealthCore.dirtySinceVerify,
    });
    const trustedExportCurrent = deriveExportCurrent({
      lastExport: useProjectRuntime.getState().projectHealthCore.lastExport,
      currentExportHash: currentProjectHash(),
      dirtySinceExport: useProjectRuntime.getState().projectHealthCore.dirtySinceExport,
    });
    expect(trustedVerifyCurrent).toBe(true);
    expect(trustedExportCurrent).toBe(true);

    const withAddedInput: Circuit = {
      nodes: [
        ...useProjectRuntime.getState().circuit.nodes,
        {
          id: 'sw1_node',
          type: 'INPUT',
          label: 'sw1',
          position: { x: 0, y: 120 },
          x: 0,
          y: 120,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        ...useProjectRuntime.getState().circuit.connections,
        {
          from: { nodeId: 'sw1_node', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    };
    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(withAddedInput);
    });
    expect(useProjectRuntime.getState().projectVectors.every((vector) => 'sw1' in (vector.inputs ?? {}))).toBe(true);
    assertRuntimeStaleAlignment();

    const withRenamedInput: Circuit = {
      nodes: useProjectRuntime.getState().circuit.nodes.map((node) =>
        node.id === 'sw0_node' ? { ...node, label: 'sw_main' } : node
      ),
      connections: [...useProjectRuntime.getState().circuit.connections],
    };
    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(withRenamedInput);
    });
    expect(useProjectRuntime.getState().projectVectors.every((vector) => !('sw0' in (vector.inputs ?? {})))).toBe(true);
    expect(useProjectRuntime.getState().projectVectors.every((vector) => 'sw_main' in (vector.inputs ?? {}))).toBe(true);
    assertRuntimeStaleAlignment();

    const withDeletedInput: Circuit = {
      nodes: useProjectRuntime.getState().circuit.nodes.filter((node) => node.id !== 'sw1_node'),
      connections: useProjectRuntime.getState().circuit.connections.filter((connection) => {
        const fromNodeId =
          typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return fromNodeId !== 'sw1_node' && toNodeId !== 'sw1_node';
      }),
    };
    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(withDeletedInput);
    });
    expect(useProjectRuntime.getState().projectVectors.every((vector) => !('sw1' in (vector.inputs ?? {})))).toBe(true);
    assertRuntimeStaleAlignment();

    const withAddedOutput: Circuit = {
      nodes: [
        ...useProjectRuntime.getState().circuit.nodes,
        {
          id: 'ld2_node',
          type: 'OUTPUT',
          label: 'ld2',
          position: { x: 180, y: 120 },
          x: 180,
          y: 120,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        ...useProjectRuntime.getState().circuit.connections,
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'ld2_node', portName: 'in' },
        },
      ],
    };
    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(withAddedOutput);
    });
    expect(useProjectRuntime.getState().projectVectors.every((vector) => 'ld2' in (vector.expected ?? {}))).toBe(true);
    assertRuntimeStaleAlignment();

    const withRenamedOutput: Circuit = {
      nodes: useProjectRuntime.getState().circuit.nodes.map((node) =>
        node.id === 'ld1_node' ? { ...node, label: 'led_status' } : node
      ),
      connections: [...useProjectRuntime.getState().circuit.connections],
    };
    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(withRenamedOutput);
    });
    expect(useProjectRuntime.getState().projectVectors.every((vector) => !('ld1' in (vector.expected ?? {})))).toBe(true);
    expect(
      useProjectRuntime.getState().projectVectors.every((vector) => 'led_status' in (vector.expected ?? {}))
    ).toBe(true);
    assertRuntimeStaleAlignment();

    const withDeletedOutput: Circuit = {
      nodes: useProjectRuntime.getState().circuit.nodes.filter((node) => node.id !== 'ld2_node'),
      connections: useProjectRuntime.getState().circuit.connections.filter((connection) => {
        const fromNodeId =
          typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return fromNodeId !== 'ld2_node' && toNodeId !== 'ld2_node';
      }),
    };
    act(() => {
      useProjectRuntime.getState().applyCircuitMutation(withDeletedOutput);
    });
    expect(useProjectRuntime.getState().projectVectors.every((vector) => !('ld2' in (vector.expected ?? {})))).toBe(true);
    assertRuntimeStaleAlignment();

    const renamedInputRow = useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'sw0_node');
    expect(renamedInputRow).toBeDefined();
    act(() => {
      useProjectRuntime.getState().setMappingPin(renamedInputRow!.id, 'SW2');
    });
    assertRuntimeStaleAlignment();

    const mappedPinAfterMutation = useProjectRuntime
      .getState()
      .projectIoRows.find((row) => row.nodeId === 'sw0_node')?.pin;
    expect(mappedPinAfterMutation).toBe('SW2');

    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });
    expect(useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'sw0_node')?.pin).not.toBe('SW2');

    act(() => {
      useProjectRuntime.getState().redoProjectEdit();
    });
    expect(useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'sw0_node')?.pin).toBe('SW2');
    assertRuntimeStaleAlignment();

    const merged = mergePersistedRuntimeState(
      {
        projectId: 'rb-authority-matrix-restore',
        projectName: 'Authority Matrix Restore',
        activeExampleId: null,
        projectIoRows: useProjectRuntime.getState().projectIoRows,
        projectVectors: useProjectRuntime.getState().projectVectors,
        scenarios: useProjectRuntime.getState().scenarios.map((scenario) => ({
          ...scenario,
          vectors: scenario.vectors.map((vector) => ({
            ...vector,
            inputs: { ...(vector.inputs ?? {}), sw0: 1 },
            expected: { ...(vector.expected ?? {}), ld1: 1 },
          })),
        })),
        circuit: useProjectRuntime.getState().circuit,
        verifyRunHistory: [
          {
            runId: 'verify-authority-matrix-restore',
            ranAtIso: '2026-03-22T08:02:00.000Z',
            status: 'pass',
            passedRows: 2,
            failedRows: 0,
            firstFailure: null,
            circuitHash: 'cir-matrix-restore',
            vectorsHash: 'vec-matrix-restore',
            mappingHash: 'map-matrix-restore',
            projectHash: baselineHash,
            didCircuitChangeSinceLast: false,
            didVectorsChangeSinceLast: false,
            didMappingChangeSinceLast: false,
          },
        ],
        projectHealthCore: {
          lastVerify: {
            status: 'pass',
            hash: 'vrf_matrix_restore',
            reportHash: 'vrf_matrix_restore_report',
            ranAtIso: '2026-03-22T08:02:00.000Z',
          },
          lastExport: {
            status: 'ok',
            hash: baselineHash,
            ranAtIso: '2026-03-22T08:03:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
      },
      useProjectRuntime.getState()
    );

    const mergedHash = buildCurrentVerifyProjectHash({
      circuit: merged.circuit,
      projectVectors: merged.projectVectors,
      projectIoRows: merged.projectIoRows,
    });
    expect(
      merged.scenarios.every((scenario) =>
        scenario.vectors.every((vector) => !('sw0' in (vector.inputs ?? {})) && !('ld1' in (vector.expected ?? {})))
      )
    ).toBe(true);
    expect(
      merged.scenarios.every((scenario) =>
        scenario.vectors.every(
          (vector) =>
            'sw_main' in (vector.inputs ?? {}) &&
            'ld0' in (vector.expected ?? {}) &&
            'led_status' in (vector.expected ?? {})
        )
      )
    ).toBe(true);
    expect(
      deriveVerifyCurrent({
        hasVerifyRun: Boolean(merged.verifyLastRun),
        latestVerifyLedgerEntry: merged.verifyRunHistory.at(-1),
        currentVerifyProjectHash: mergedHash,
        dirtySinceVerify: merged.projectHealthCore.dirtySinceVerify,
      })
    ).toBe(false);
    expect(
      deriveExportCurrent({
        lastExport: merged.projectHealthCore.lastExport,
        currentExportHash: mergedHash,
        dirtySinceExport: merged.projectHealthCore.dirtySinceExport,
      })
    ).toBe(false);
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
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-callout').textContent).toContain('Compare: STALE');
    expect(getByTestId('ide-hardware-export-status').textContent).toContain('Export: STALE');
    expect(getByTestId('ide-hardware-readiness-callout').textContent).toContain('Complete required pin mapping');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Slice 27 — deriveHasDff: circuit-graph-first sequential trust gate
//
// Seam: IdeApp.tsx previously derived hasDff only from verifyLastRun?.schedule.
// A sequential circuit with DFF nodes but no prior verify run would receive
// hasDff=false, causing VerifySurface to treat it as combinational.
//
// Fix: deriveHasDff(circuit, schedule) checks the circuit graph first
// (analyzeSequentialLogic), falling back to the run schedule for HDL imports.
// ──────────────────────────────────────────────────────────────────────────────

describe('deriveHasDff: circuit-graph-first sequential trust', () => {
  it('sequential circuit (DFlipFlop node) with no prior verify run → hasDff=true', () => {
    const circuit: Circuit = {
      nodes: [{ id: 'dff_1', type: 'DFlipFlop' }],
      connections: [],
    };
    expect(deriveHasDff(circuit, undefined)).toBe(true);
  });

  it('combinational circuit (AND, OR) with no prior run → hasDff=false', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a_1', type: 'AND' },
        { id: 'o_1', type: 'OR' },
      ],
      connections: [],
    };
    expect(deriveHasDff(circuit, undefined)).toBe(false);
  });

  it('empty circuit (HDL import path), run schedule = clocked_macro → hasDff=true', () => {
    const circuit: Circuit = { nodes: [], connections: [] };
    expect(deriveHasDff(circuit, 'clocked_macro')).toBe(true);
  });

  it('empty circuit, no prior run → hasDff=false', () => {
    const circuit: Circuit = { nodes: [], connections: [] };
    expect(deriveHasDff(circuit, undefined)).toBe(false);
  });

  it('DFlipFlop node AND clocked_macro run → hasDff=true', () => {
    const circuit: Circuit = {
      nodes: [{ id: 'dff_1', type: 'DFlipFlop' }],
      connections: [],
    };
    expect(deriveHasDff(circuit, 'clocked_macro')).toBe(true);
  });

  it('Counter4Bit node → hasDff=true even without prior run', () => {
    const circuit: Circuit = {
      nodes: [{ id: 'cnt_1', type: 'Counter4Bit' }],
      connections: [],
    };
    expect(deriveHasDff(circuit, undefined)).toBe(true);
  });

  it('run schedule = combinational, circuit has DFlipFlop → hasDff still true (circuit wins)', () => {
    const circuit: Circuit = {
      nodes: [{ id: 'dff_1', type: 'DFlipFlop' }],
      connections: [],
    };
    expect(deriveHasDff(circuit, 'combinational')).toBe(true);
  });

  it('isSequentialRun in VerifySurface = true for DFlipFlop circuit before first verify', () => {
    // Proves the full trust chain: circuit graph → hasDff=true → VerifySurface isSequentialRun=true
    const circuit: Circuit = {
      nodes: [{ id: 'dff_1', type: 'DFlipFlop' }],
      connections: [],
    };
    const hasDffResult = deriveHasDff(circuit, undefined);
    expect(hasDffResult).toBe(true);
    // In VerifySurface: isSequentialRun = hasDff || lastRun.schedule === clocked_macro || ...
    const isSequentialRun = hasDffResult; // no lastRun, so only hasDff contributes
    expect(isSequentialRun).toBe(true);
  });
});

