// @vitest-environment jsdom

import { act } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { materializeIoMappingFromHardwareMappingV2 } from '@redbyte/rb-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { getIdeExampleById } from '../examplesCatalog';
import { useProjectRuntime } from '../projectRuntime';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

function buildExampleProject(exampleId = 'two-bit-counter'): RBProject {
  const example = getIdeExampleById(exampleId);
  if (!example) {
    throw new Error(`Missing example fixture: ${exampleId}`);
  }

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-21T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    name: example.name,
    description: example.summary,
    circuit: structuredClone(example.circuit),
    ioMapping: {
      inputs: example.ioRows
        .filter((row) => row.direction === 'in')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
      outputs: example.ioRows
        .filter((row) => row.direction === 'out')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
    },
    vectors: structuredClone(example.vectors ?? []),
    meta: {
      projectId: `rb-${exampleId}-mapping-authority`,
      projectKind: 'custom',
      sourceExampleId: example.id,
    },
  };
}

function buildProjectFromRuntimeState(): RBProject {
  const state = useProjectRuntime.getState();
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-21T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    name: state.projectName,
    description: state.projectDescription,
    circuit: structuredClone(state.circuit),
    hdl: {
      top: 'top',
      sources: [],
    },
    fpga: {
      board: 'basys3',
      part: 'xc7a35tcpg236-1',
      top: 'top',
      constraints: {
        type: 'xdc',
        text: '',
      },
    },
    ioMapping: materializeIoMappingFromHardwareMappingV2(state.hardwareMappingV2),
    hardwareMappingV2: structuredClone(state.hardwareMappingV2),
    vectors: structuredClone(state.projectVectors),
    meta: {
      projectId: state.projectId,
      projectKind: state.projectKind,
      sourceExampleId: state.sourceExampleId,
    },
  };
}

function renameClockBoundary(nextLabel: string): void {
  const current = useProjectRuntime.getState();
  const renamedCircuit: Circuit = {
    nodes: current.circuit.nodes.map((node) =>
      node.id === 'clk_node'
        ? { ...node, label: nextLabel }
        : node
    ),
    connections: structuredClone(current.circuit.connections),
  };
  useProjectRuntime.getState().applyCircuitMutation(renamedCircuit);
}

describe('projectRuntime mapping authority', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.getState().resetToActiveExample();
  });

  it('keeps renamed boundary mapping edits aligned with export authority', () => {
    act(() => {
      useProjectRuntime.getState().loadFromProject(buildExampleProject());
    });

    act(() => {
      renameClockBoundary('ENTER CLK');
    });

    let state = useProjectRuntime.getState();
    const renamedClockRow = state.projectIoRows.find((row) => row.nodeId === 'clk_node');
    expect(renamedClockRow?.id).toBe('enter_clk');
    expect(renamedClockRow?.pin).toBe('W5');

    act(() => {
      useProjectRuntime.getState().setMappingPin('enter_clk', 'U18');
    });

    state = useProjectRuntime.getState();
    expect(state.projectIoRows.find((row) => row.nodeId === 'clk_node')?.pin).toBe('U18');

    const materialized = materializeIoMappingFromHardwareMappingV2(state.hardwareMappingV2);
    expect(materialized.inputs.some((entry) => entry.id === 'enter_clk' && entry.pin === 'U18')).toBe(true);
    expect(materialized.inputs.some((entry) => entry.id === 'clk')).toBe(false);

    const exportViewModel = buildExportViewModel(buildProjectFromRuntimeState());
    const renamedPortRows = exportViewModel.pinTable.filter((row) => row.port.toLowerCase().includes('enter'));

    expect(renamedPortRows).toHaveLength(1);
    expect(renamedPortRows[0]?.pin).toBe('U18');
    expect(renamedPortRows[0]?.status).toBe('mapped');
    expect(exportViewModel.pinTable.some((row) => row.port === 'clk')).toBe(false);
    expect(
      exportViewModel.errors.some((entry) => entry.message.includes('required input port "enter_clk"'))
    ).toBe(false);
  });

  it('auto-suggests the board clock for renamed clock boundaries', () => {
    act(() => {
      useProjectRuntime.getState().loadFromProject(buildExampleProject());
    });

    act(() => {
      renameClockBoundary('ENTER CLK');
      useProjectRuntime.getState().setMappingPin('enter_clk', '');
    });

    expect(
      useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'clk_node')?.pin
    ).toBe('');

    act(() => {
      useProjectRuntime.getState().autoSuggestMapping();
    });

    expect(
      useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'clk_node')?.pin
    ).toBe('CLK100MHZ');
  });
});
