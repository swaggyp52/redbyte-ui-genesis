// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';

function buildProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    name: 'export-surface-workstation',
    description: 'Regression fixture for export workstation redesign',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 120, y: 120, label: 'sw0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', x: 120, y: 240, label: 'sw1', config: {}, state: {} },
        { id: 'g1', type: 'AND', x: 320, y: 180, label: 'and0', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 520, y: 180, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'g1', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'g1', portName: 'b' } },
        { from: { nodeId: 'g1', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'V17' },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'sw1', pin: 'V16' },
      ],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'U16' }],
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
            '    sw1 : in std_logic;',
            '    ld0 : out std_logic',
            '  );',
            'end top;',
            '',
            'architecture rtl of top is',
            'begin',
            '  ld0 <= sw0 and sw1;',
            'end rtl;',
          ].join('\n'),
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

describe('ExportSurface workstation redesign', () => {
  it('shows the summary hero, grouped artifacts, key copy actions, and compact Vivado guidance', () => {
    const { getByTestId, getByText } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    expect(getByTestId('ide-export-summary-card').textContent).toContain('Engineering handoff');
    expect(getByTestId('ide-export-design-summary').textContent).toContain('Mapped Pins');
    expect(getByTestId('ide-export-design-summary').textContent).toContain('Gates');

    expect(getByTestId('ide-export-artifact-group-hdl')).toBeTruthy();
    expect(getByTestId('ide-export-artifact-group-constraints')).toBeTruthy();
    expect(getByTestId('ide-export-artifact-group-project')).toBeTruthy();

    expect(getByTestId('ide-export-copy-top-vhd')).toBeTruthy();
    expect(getByTestId('ide-export-copy-top-xdc')).toBeTruthy();
    expect(getByTestId('ide-export-copy-vivado-import')).toBeTruthy();
    expect(getByTestId('ide-export-copy-current')).toBeTruthy();

    const checklist = within(getByTestId('ide-export-vivado-checklist')).getAllByRole('listitem');
    expect(checklist).toHaveLength(3);
    expect(checklist[0].textContent).toContain('Open Vivado');
    expect(getByText('Advanced / full checklist')).toBeTruthy();
  });

  it('keeps project export available when verify has not run yet', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <ExportSurface project={buildProject()} determinismHash="ide-hash" />
    );

    expect(getByTestId('ide-export-dock-download').hasAttribute('disabled')).toBe(false);
    expect(getByTestId('ide-export-vivado-unverified-callout').textContent).toContain(
      'Artifacts available'
    );
    expect(getByTestId('ide-export-unverified-callout').textContent).toContain(
      'generated text files are available now'
    );
    expect(getByText('Advisories')).toBeTruthy();
    expect(queryByTestId('ide-export-vivado-blocked-callout')).toBeNull();
  });
});
