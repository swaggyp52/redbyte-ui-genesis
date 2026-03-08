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
        { id: 'g1', type: 'AND', x: 300, y: 195, label: 'and0', config: {}, state: {} },
      ],
      connections: [],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'g1', port: 'in1', label: 'sw0', pin: 'V17' },
        { id: 'sw1', nodeId: 'g1', port: 'in2', label: 'sw1', pin: 'V16' },
      ],
      outputs: [
        { id: 'ld0', nodeId: 'g1', port: 'out', label: 'ld0', pin: 'U16' },
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

describe('ExportSurface mapping trust', () => {
  it('rebuilds the previewed constraints and export hash from the edited pin map', () => {
    const { getByDisplayValue, getByTestId } = render(
      <ExportSurface
        project={buildProject()}
        determinismHash="ide-hash"
      />
    );

    fireEvent.click(getByTestId('ide-export-artifact-tab-top-xdc'));

    const initialHash = getByTestId('ide-export-context-export-hash').textContent;
    expect(getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN V17');

    fireEvent.change(getByDisplayValue('V17'), { target: { value: 'W16' } });

    expect(getByTestId('ide-export-preview-code').textContent).toContain('PACKAGE_PIN W16');
    expect(getByTestId('ide-export-context-export-hash').textContent).not.toBe(initialHash);

    const sw0Row = getByTestId('ide-export-map-row-sw0');
    expect(within(sw0Row).getByDisplayValue('W16')).toBeTruthy();
  });
});
