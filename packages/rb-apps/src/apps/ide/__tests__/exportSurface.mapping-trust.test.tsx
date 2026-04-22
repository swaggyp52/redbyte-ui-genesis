// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import { getIdeExampleById } from '../examplesCatalog';

function buildProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    name: 'export-surface-mapping-trust',
    description: 'Regression fixture for export mapping trust',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 120, y: 120, label: 'sw0', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 320, y: 120, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'V17' },
      ],
      outputs: [
        { id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'U16' },
      ],
    },
    vectors: [],
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: [
            'library IEEE;',
            'use IEEE.STD_LOGIC_1164.ALL;',
            '',
            'entity top is',
            '  port (',
            '    sw0 : in std_logic;',
            '    ld0 : out std_logic',
            '  );',
            'end top;',
            '',
            'architecture rtl of top is',
            'begin',
            '  ld0 <= sw0;',
            'end rtl;',
          ].join('\n'),
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

function buildExampleProject(exampleId: string): RBProject {
  const example = getIdeExampleById(exampleId);
  if (!example) {
    throw new Error(`Missing example fixture: ${exampleId}`);
  }

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    name: example.name,
    description: example.summary,
    circuit: {
      nodes: example.circuit.nodes.map((node) => ({ ...node })),
      connections: example.circuit.connections.map((connection) => ({
        ...connection,
        from: typeof connection.from === 'string' ? connection.from : { ...connection.from },
        to: typeof connection.to === 'string' ? connection.to : { ...connection.to },
      })),
    },
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
    vectors: example.vectors.map((vector) => ({
      tick: vector.tick,
      inputs: { ...vector.inputs },
      expected: vector.expected ? { ...vector.expected } : undefined,
    })),
    fpga: { board: 'basys3', top: 'top' },
  };
}

function withUpdatedPin(project: RBProject, rowId: string, pin: string): RBProject {
  const updateEntries = <T extends { id: string; pin?: string }>(entries: T[]): T[] =>
    entries.map((entry) =>
      entry.id === rowId
        ? {
            ...entry,
            pin,
          }
        : entry
    );

  return {
    ...project,
    ioMapping: {
      inputs: updateEntries(project.ioMapping.inputs),
      outputs: updateEntries(project.ioMapping.outputs),
    },
  };
}

describe('ExportSurface mapping trust', () => {
  it('rebuilds the previewed constraints when Map Pins updates project mapping upstream', () => {
    let currentProject = buildProject();
    const view = render(
      <ExportSurface
        project={currentProject}
        determinismHash="ide-hash"
      />
    );

    fireEvent.click(view.getByTestId('ide-export-artifact-tab-top-xdc'));

    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN V17');

    currentProject = withUpdatedPin(currentProject, 'sw0', 'W16');
    view.rerender(
      <ExportSurface
        project={currentProject}
        determinismHash="ide-hash"
      />
    );

    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN W16');

    const sw0Row = view.getByTestId('ide-export-map-row-sw0');
    expect(within(sw0Row).getByText('W16')).toBeTruthy();
  });

  it('renders the pin table as read-only even when a parent updater exists', () => {
    const onUpdateMappingPin = vi.fn();
    const view = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
        onUpdateMappingPin={onUpdateMappingPin}
      />
    );

    const sw0Row = view.getByTestId('ide-export-map-row-sw0');
    expect(within(sw0Row).queryByRole('textbox')).toBeNull();
    expect(within(sw0Row).getByText('V17')).toBeTruthy();
    expect(onUpdateMappingPin).not.toHaveBeenCalled();
  });

  it('shows active project/map-pins authority and upstream pin reconciliation', () => {
    let currentProject = buildProject();
    const view = render(
      <ExportSurface
        project={currentProject}
        determinismHash="ide-hash"
        onUpdateMappingPin={() => {
          // no-op for this authority-visibility test
        }}
      />
    );

    expect(view.getByTestId('ide-export-mapping-authority-text').textContent).toContain(
      'Map Pins owns the saved pin binding.'
    );

    currentProject = withUpdatedPin(currentProject, 'sw0', 'W16');
    view.rerender(
      <ExportSurface
        project={currentProject}
        determinismHash="ide-hash"
        onUpdateMappingPin={() => {
          // no-op for this authority-visibility test
        }}
      />
    );

    expect(view.getByTestId('ide-export-mapping-authority-updates').textContent).toContain(
      '1 pin was updated from Map Pins.'
    );
    expect(view.getByTestId('ide-export-pin-updated-upstream-sw0').textContent).toContain(
      'Updated from Map Pins.'
    );
  });

  it('keeps the same Map Pins authority copy when no project updater is wired', () => {
    const view = render(<ExportSurface project={buildProject()} determinismHash="ide-hash" />);

    expect(view.getByTestId('ide-export-mapping-authority-text').textContent).toContain(
      'Map Pins owns the saved pin binding.'
    );
    expect(view.queryByTestId('ide-export-mapping-authority-updates')).toBeNull();
  });

  it('keeps live boundary rows visible when export labels sanitize differently', () => {
    const view = render(
      <ExportSurface project={buildExampleProject('two-bit-counter')} determinismHash="ide-hash" />
    );

    const enableRow = view.getByTestId('ide-export-map-row-en');
    const resetRow = view.getByTestId('ide-export-map-row-rst');

    expect(within(enableRow).getByText('V17')).toBeTruthy();
    expect(within(resetRow).getByText('U18')).toBeTruthy();
    expect(within(enableRow).queryByRole('textbox')).toBeNull();
    expect(within(resetRow).queryByRole('textbox')).toBeNull();
  });
});
