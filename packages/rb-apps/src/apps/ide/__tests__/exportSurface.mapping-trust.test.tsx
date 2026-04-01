// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';

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
  it('rebuilds the previewed constraints from the edited pin map', () => {
    const { getByDisplayValue, getByTestId } = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
      />
    );

    fireEvent.click(getByTestId('ide-export-artifact-tab-top-xdc'));

    expect(getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN V17');

    fireEvent.change(getByDisplayValue('V17'), { target: { value: 'W16' } });

    expect(getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN W16');

    const sw0Row = getByTestId('ide-export-map-row-sw0');
    expect(within(sw0Row).getByDisplayValue('W16')).toBeTruthy();
  });

  it('reads edited pins from project authority when parent updates mapping state', () => {
    const initialProject = buildProject();
    let currentProject = initialProject;

    const view = render(
      <ExportSurface
        project={currentProject}
        determinismHash="ide-hash"
        onUpdateMappingPin={(rowId, pin) => {
          currentProject = withUpdatedPin(currentProject, rowId, pin);
        }}
      />
    );

    fireEvent.click(view.getByTestId('ide-export-artifact-tab-top-xdc'));
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN V17');

    fireEvent.change(view.getByDisplayValue('V17'), { target: { value: 'W16' } });

    view.rerender(
      <ExportSurface
        project={currentProject}
        determinismHash="ide-hash"
        onUpdateMappingPin={(rowId, pin) => {
          currentProject = withUpdatedPin(currentProject, rowId, pin);
        }}
      />
    );

    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN W16');
    const sw0Row = view.getByTestId('ide-export-map-row-sw0');
    expect(within(sw0Row).getByDisplayValue('W16')).toBeTruthy();
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
      'Export is using pin mapping from Project and Map Pins.'
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
      '1 pin was updated from Project or Map Pins.'
    );
    expect(view.getByTestId('ide-export-pin-updated-upstream-sw0').textContent).toContain(
      'Updated from Project / Map Pins.'
    );
  });

  it('shows standalone local-preview authority when no project updater is wired', () => {
    const view = render(<ExportSurface project={buildProject()} determinismHash="ide-hash" />);

    expect(view.getByTestId('ide-export-mapping-authority-text').textContent).toContain(
      'Export is using a local preview mapping.'
    );
    expect(view.queryByTestId('ide-export-mapping-authority-updates')).toBeNull();
  });
});
