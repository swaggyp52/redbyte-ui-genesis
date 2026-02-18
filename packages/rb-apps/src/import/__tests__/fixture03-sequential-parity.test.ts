import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { parseVhdl } from '../vhdlImport';
import { parseXdcPins } from '../xdcImport';
import { parsedHdlToCircuit } from '../hdlToCircuit';
import { runTestVectors } from '../../fpga/boards/basys3/vectorRunner';
import { generateTestbenchVhdl } from '../../fpga/boards/basys3/testbenchGenerator';
import { exportProjectAsBasys3 } from '../../fpga/boards/basys3/basys3ExportService';

const FIXTURE_DIR = join(__dirname, '../../fixtures/import/03-vivado-ish-clocked');

function loadFixture() {
  return {
    vhdl: readFileSync(join(FIXTURE_DIR, 'top.vhd'), 'utf8'),
    xdc: readFileSync(join(FIXTURE_DIR, 'basys3.xdc'), 'utf8'),
  };
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

function buildFixtureVectors(): TestVector[] {
  return [
    { tick: 0, inputs: { rst: 1, count_en: 0 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
    { tick: 1, inputs: { rst: 0, count_en: 1 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
    { tick: 2, inputs: { rst: 0, count_en: 1 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
  ];
}

function buildFixtureProject(vhdl: string): RBProject {
  const parsed = parseVhdl(vhdl);
  const converted = parsedHdlToCircuit(parsed);

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-02-18T00:00:00.000Z',
    updatedAt: '2026-02-18T00:00:00.000Z',
    name: 'fixture03-clocked-parity',
    description: 'Fixture 03 parity test',
    circuit: converted.circuit,
    ioMapping: buildFixtureIoMapping(),
    vectors: buildFixtureVectors(),
    hdl: {
      top: 'top',
      sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

describe('fixture03 sequential verify/export parity', () => {
  it('enforces import -> verify -> export schedule parity for clocked fixture', async () => {
    const { vhdl, xdc } = loadFixture();

    const xdcResult = parseXdcPins(xdc);
    expect(Object.keys(xdcResult.pinMap)).toContain('clk');
    expect(Object.keys(xdcResult.pinMap)).toContain('q3');
    expect(xdcResult.warnings.some((warning) => warning.toLowerCase().includes('clock'))).toBe(true);

    const project = buildFixtureProject(vhdl);
    const vectors = project.vectors ?? [];

    const verifyResult = await runTestVectors(project.circuit, vectors, project.ioMapping, project.hdl);
    expect(verifyResult.schedule).toBe('clocked_macro');
    expect(verifyResult.trace.length).toBe(vectors.length);

    const generatedTestbench = generateTestbenchVhdl(project, vectors);
    expect(generatedTestbench).toContain('-- schedule=clocked_macro');
    expect(generatedTestbench).toContain('-- sequence=0->1->0');
    expect(generatedTestbench).toContain("clk <= '0';");
    expect(generatedTestbench).toContain("clk <= '1';");

    const exportResult = exportProjectAsBasys3(project);
    expect(exportResult.bundle?.testbench).toBe(generatedTestbench);
    expect(exportResult.bundle?.testbench).not.toContain('would be generated here');
  });
});
