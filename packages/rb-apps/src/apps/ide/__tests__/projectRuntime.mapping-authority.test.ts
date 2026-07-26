// @vitest-environment jsdom

import { act } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  materializeIoMappingFromHardwareMappingV2,
  migrateIoMappingToHardwareMappingV2,
  type HardwareMappingDocumentV2,
} from '@redbyte/rb-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { getIdeExampleById } from '../examplesCatalog';
import { useProjectRuntime } from '../projectRuntime';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';
import {
  computeExecutionStimulusHash,
  computeScenarioContentHash,
  materializeScenarioVectors,
} from '../verifyScenario';

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

function withStructuredOutputBus(project: RBProject): RBProject {
  const ioMapping = project.ioMapping!;
  const migrated = migrateIoMappingToHardwareMappingV2({
    inputs: ioMapping.inputs,
    outputs: [],
  });
  const outputBus: HardwareMappingDocumentV2['entries'][number] = {
    kind: 'bus',
    id: 'result_bus',
    direction: 'out',
    portName: 'result',
    width: ioMapping.outputs.length,
    label: 'Results',
    bits: ioMapping.outputs.map((row, bitIndex) => ({
      id: row.id,
      bitIndex,
      nodeId: row.nodeId,
      port: row.port,
      pin: row.pin,
      label: row.label,
    })),
  };
  const hardwareMappingV2: HardwareMappingDocumentV2 = {
    ...migrated,
    entries: [...migrated.entries, outputBus],
  };
  return {
    ...project,
    ioMapping: materializeIoMappingFromHardwareMappingV2(hardwareMappingV2),
    hardwareMappingV2,
  };
}

describe('projectRuntime mapping authority', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.getState().resetToActiveExample();
  });

  it('maps boundary rows authored after starting from a blank project', () => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
      useProjectRuntime.getState().applyCircuitMutation({
        nodes: [
          { id: 'input-a', type: 'INPUT', x: 0, y: 0, label: 'A' },
          { id: 'output-sum', type: 'OUTPUT', x: 200, y: 0, label: 'SUM' },
        ],
        connections: [
          {
            from: { nodeId: 'input-a', portName: 'out' },
            to: { nodeId: 'output-sum', portName: 'in' },
          },
        ],
      });
    });

    const inputRow = useProjectRuntime
      .getState()
      .projectIoRows.find((row) => row.nodeId === 'input-a');
    expect(inputRow?.pin).toBe('');

    act(() => {
      useProjectRuntime.getState().setMappingPin(inputRow?.id ?? 'a', 'V17');
    });

    const mappedState = useProjectRuntime.getState();
    expect(
      mappedState.projectIoRows.find((row) => row.nodeId === 'input-a')?.pin
    ).toBe('V17');
    expect(
      materializeIoMappingFromHardwareMappingV2(mappedState.hardwareMappingV2).inputs.find(
        (row) => row.nodeId === 'input-a'
      )?.pin
    ).toBe('V17');
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
    expect(renamedClockRow).toBeDefined();
    expect(renamedClockRow?.id).toBe('clk');
    expect(renamedClockRow?.label).toBe('ENTER CLK');
    expect(renamedClockRow?.pin).toBe('CLK100MHZ');

    act(() => {
      useProjectRuntime.getState().setMappingPin(renamedClockRow?.id ?? 'clk', 'U18');
    });

    state = useProjectRuntime.getState();
    expect(state.projectIoRows.find((row) => row.nodeId === 'clk_node')?.pin).toBe('U18');

    const materialized = materializeIoMappingFromHardwareMappingV2(state.hardwareMappingV2);
    expect(materialized.inputs.some((entry) => entry.id === 'clk' && entry.pin === 'U18')).toBe(true);
    expect(materialized.inputs.some((entry) => entry.id === 'enter_clk')).toBe(false);

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
      const renamedClockRow = useProjectRuntime.getState().projectIoRows.find((row) => row.nodeId === 'clk_node');
      expect(renamedClockRow).toBeDefined();
      useProjectRuntime.getState().setMappingPin(renamedClockRow?.id ?? 'clk', '');
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

  it('keeps a fresh rerun Export-current after a structured V2 bit boundary rename', () => {
    act(() => {
      useProjectRuntime.getState().loadFromProject(
        withStructuredOutputBus(buildExampleProject('logic-gates'))
      );
    });
    const beforeRename = useProjectRuntime.getState();
    const outputRow = beforeRename.projectIoRows.find((row) => row.direction === 'out')!;
    const originalV2Label = materializeIoMappingFromHardwareMappingV2(
      beforeRename.hardwareMappingV2
    ).outputs.find((row) => row.id === outputRow.id)?.label;

    act(() => {
      const current = useProjectRuntime.getState();
      useProjectRuntime.getState().applyCircuitMutation({
        nodes: current.circuit.nodes.map((node) =>
          node.id === outputRow.nodeId ? { ...node, label: 'RENAMED RESULT' } : node
        ),
        connections: structuredClone(current.circuit.connections),
      });
    });
    const renamed = useProjectRuntime.getState();
    expect(renamed.projectIoRows.find((row) => row.id === outputRow.id)?.label)
      .toBe('RENAMED RESULT');
    expect(
      materializeIoMappingFromHardwareMappingV2(renamed.hardwareMappingV2).outputs.find(
        (row) => row.id === outputRow.id
      )?.label
    ).toBe(originalV2Label);

    const scenario = renamed.scenarios.find((entry) => entry.id === renamed.activeScenarioId)!;
    const vectors = materializeScenarioVectors(scenario);
    let run = renamed.runVerification({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioVersion: scenario.version,
      scenarioContentHash: computeScenarioContentHash(scenario),
      scenarioStimulusHash: computeExecutionStimulusHash(vectors),
      deterministicHash: 'structured-v2-rename-rerun',
      assertionMode: true,
      vectors,
      rows: [],
      ranAtIso: '2026-07-22T12:08:00.000Z',
    });
    const afterRun = useProjectRuntime.getState();
    run = afterRun.verifyLastRun ?? run;
    const exportViewModel = buildExportViewModel(
      buildProjectFromRuntimeState(),
      run,
      afterRun.scenarios.find((entry) => entry.id === afterRun.activeScenarioId)
    );
    const expectedIo = JSON.parse(
      exportViewModel.artifacts.find((artifact) => artifact.path === 'EXPECTED_IO.json')?.content ?? '{}'
    ) as { source?: string; verifyHash?: string };

    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.verifyHash).toBe(run.deterministicHash);
    expect(exportViewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
  });
});
