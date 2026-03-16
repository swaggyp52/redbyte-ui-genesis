import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IoMapping } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { exportProjectAsBasys3 } from '../fpga/boards/basys3/basys3ExportService';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';

const FIXTURE_DIR = join(
  process.cwd(),
  'packages/rb-apps/src/fixtures/import/03-vivado-ish-clocked'
);

function loadFixtureVhdl(): string {
  return readFileSync(join(FIXTURE_DIR, 'top.vhd'), 'utf8');
}

function buildFixtureIoMapping(): IoMapping {
  return {
    inputs: [
      { id: 'clk', nodeId: 'port_clk', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
      { id: 'rst', nodeId: 'port_rst', port: 'out', label: 'rst', pin: 'SW0' },
      { id: 'count_en', nodeId: 'port_count_en', port: 'out', label: 'count_en', pin: 'SW1' },
    ],
    outputs: [
      { id: 'q0', nodeId: 'port_out_q0', port: 'in', label: 'q0', pin: 'LD0' },
      { id: 'q1', nodeId: 'port_out_q1', port: 'in', label: 'q1', pin: 'LD1' },
      { id: 'q2', nodeId: 'port_out_q2', port: 'in', label: 'q2', pin: 'LD2' },
      { id: 'q3', nodeId: 'port_out_q3', port: 'in', label: 'q3', pin: 'LD3' },
    ],
  };
}

function buildFixtureProject(vhdl: string): RBProject {
  const parsed = parseVhdl(vhdl);
  const converted = parsedHdlToCircuit(parsed);

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-02-19T00:00:00.000Z',
    updatedAt: '2026-02-19T00:00:00.000Z',
    name: 'ide-synth-subset-counter',
    description: 'Synthesis subset contract fixture',
    circuit: converted.circuit,
    ioMapping: buildFixtureIoMapping(),
    vectors: [],
    hdl: {
      top: 'top',
      sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

describe('IDE synth subset contract', () => {
  it('exports a legal clocked counter fixture with stable artifacts and no diagnostics', () => {
    const project = buildFixtureProject(loadFixtureVhdl());

    const firstExport = exportProjectAsBasys3(project);
    const secondExport = exportProjectAsBasys3(project);

    expect(firstExport.success).toBe(true);
    expect(firstExport.errors).toEqual([]);
    expect(firstExport.bundle).toBeDefined();
    expect(secondExport.bundle).toBeDefined();

    expect(firstExport.bundle?.topVhd).toBe(secondExport.bundle?.topVhd);
    expect(firstExport.bundle?.topXdc).toBe(secondExport.bundle?.topXdc);
    expect(firstExport.determinismHash).toBe(secondExport.determinismHash);

    expect(firstExport.bundle?.topVhd).toContain('entity top is');
    expect(firstExport.bundle?.topXdc).toContain('PACKAGE_PIN W5');

    const viewModel = buildExportViewModel(project);
    expect(viewModel.status).toBe('ok');
    expect(viewModel.errors).toEqual([]);
    expect(viewModel.warnings).toEqual([]);
    expect(viewModel.diagnostics).toEqual([]);
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'top.vhd')?.status).toBe('ready');
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'top.xdc')?.status).toBe('ready');
  });

  it('accepts board-first SW/LD aliases and exports clean Basys3 constraints', () => {
    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
      name: 'board-io-alias-contract',
      description: 'Board-first IO alias contract fixture',
      circuit: {
        nodes: [
          { id: 'g1', type: 'AND', x: 300, y: 195, label: 'and0', config: {}, state: {} },
        ],
        connections: [],
      },
      ioMapping: {
        inputs: [
          { id: 'sw0', nodeId: 'g1', port: 'in1', label: 'sw0', pin: 'SW0' },
          { id: 'sw1', nodeId: 'g1', port: 'in2', label: 'sw1', pin: 'SW1' },
        ],
        outputs: [
          { id: 'ld0', nodeId: 'g1', port: 'out', label: 'ld0', pin: 'LD0' },
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

    const exportResult = exportProjectAsBasys3(project);
    expect(exportResult.success).toBe(true);
    expect(exportResult.errors).toEqual([]);
    expect(exportResult.warnings).toEqual([]);
    expect(exportResult.bundle?.topXdc).toContain('PACKAGE_PIN V17');
    expect(exportResult.bundle?.topXdc).toContain('PACKAGE_PIN U16');
    expect(exportResult.bundle?.readme).toContain('| sw0 | SW0 | V17 | input |');
    expect(exportResult.bundle?.readme).toContain('| ld0 | LD0 | U16 | output |');

    const viewModel = buildExportViewModel(project);
    expect(viewModel.status).toBe('ok');
    expect(viewModel.errors).toEqual([]);
    expect(viewModel.warnings).toEqual([]);
  });
});
