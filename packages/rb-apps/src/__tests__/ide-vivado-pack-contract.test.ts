import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';

const FIXTURE_DIR = join(
  process.cwd(),
  'packages/rb-apps/src/fixtures/import/03-vivado-ish-clocked'
);
const ZIP_DATE = new Date('2026-01-01T00:00:00.000Z');

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

function buildFixtureVectors(): TestVector[] {
  return [
    {
      tick: 0,
      inputs: { clk: 0, rst: 1, count_en: 0 },
      expected: { q0: 0, q1: 0, q2: 0, q3: 0 },
    },
    {
      tick: 1,
      inputs: { clk: 1, rst: 0, count_en: 1 },
      expected: { q0: 1, q1: 0, q2: 0, q3: 0 },
    },
  ];
}

function buildFixtureProject(vhdl: string): RBProject {
  const parsed = parseVhdl(vhdl);
  const converted = parsedHdlToCircuit(parsed);
  const timestamp = '2026-02-19T00:00:00.000Z';

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'vivado-pack-counter',
    description: 'Vivado pack contract fixture',
    circuit: converted.circuit,
    ioMapping: buildFixtureIoMapping(),
    vectors: buildFixtureVectors(),
    hdl: {
      top: 'top',
      sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }],
    },
    fpga: { board: 'basys3', top: 'top' },
    meta: {
      projectId: 'vivado-pack-counter-fixture',
    },
  };
}

async function buildVivadoKitZip(artifacts: ReturnType<typeof buildExportViewModel>['artifacts']) {
  const zip = new JSZip();
  for (const artifact of artifacts) {
    if (artifact.content.trim().length === 0) continue;
    zip.file(artifact.path, artifact.content, { date: ZIP_DATE });
  }
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('IDE Vivado pack contract', () => {
  it('builds a deterministic Vivado-ready ZIP from the canonical export artifact set', async () => {
    const project = buildFixtureProject(loadFixtureVhdl());
    const exportViewModel = buildExportViewModel(project);

    expect(exportViewModel.status).toBe('ok');
    expect(exportViewModel.errors).toEqual([]);

    const zipA = await buildVivadoKitZip(exportViewModel.artifacts);
    const zipB = await buildVivadoKitZip(exportViewModel.artifacts);

    expect(sha256Hex(zipA)).toBe(sha256Hex(zipB));

    const loaded = await JSZip.loadAsync(zipA);
    const fileNames = Object.keys(loaded.files)
      .filter((name) => !loaded.files[name]?.dir)
      .sort();

    expect(fileNames).toEqual([
      'BRINGUP.md',
      'EXPECTED_IO.json',
      'README.txt',
      'program_and_test.tcl',
      'project.rbproj.json',
      'testbench.vhd',
      'top.vhd',
      'top.xdc',
      'vivado_import.tcl',
    ]);

    const tclText = await loaded.file('vivado_import.tcl')!.async('string');
    expect(tclText).toContain('create_project -force $project_name $project_dir -part $part');
    expect(tclText).toContain('xc7a35tcpg236-1');
    expect(tclText).toContain('add_files -norecurse');
    expect(tclText).toContain('add_files -fileset constrs_1 -norecurse');
    expect(tclText).toContain('set_property top $top_module [current_fileset]');

    const referencedArtifacts = Array.from(
      new Set(
        [...tclText.matchAll(/"([^"\n]+\.(?:vhd|xdc))"/gi)]
          .map((match) => (match[1] ?? '').trim())
          .filter(Boolean)
      )
    ).sort();
    for (const artifactPath of referencedArtifacts) {
      expect(fileNames).toContain(artifactPath);
    }

    const projectText = await loaded.file('project.rbproj.json')!.async('string');
    const parsedProject = JSON.parse(projectText) as RBProject;
    expect(parsedProject.name).toBe('vivado-pack-counter');
    expect(parsedProject.meta?.projectId).toBe('vivado-pack-counter-fixture');

    const expectedIoText = await loaded.file('EXPECTED_IO.json')!.async('string');
    const expectedIo = JSON.parse(expectedIoText) as {
      schemaVersion?: string;
      signals?: Array<{ signal?: string; pin?: string }>;
    };
    expect(expectedIo.schemaVersion).toBe('rb.expected-io.v1');
    expect(Array.isArray(expectedIo.signals)).toBe(true);
    expect(expectedIo.signals?.some((entry) => entry.signal === 'q0' && entry.pin === 'LD0')).toBe(true);

    const testbenchText = await loaded.file('testbench.vhd')!.async('string');
    expect(testbenchText).toContain('entity tb_top is');
    expect(testbenchText).toContain('dut: top');

    const topVhdText = await loaded.file('top.vhd')!.async('string');
    const topXdcText = await loaded.file('top.xdc')!.async('string');
    expect(topVhdText).toContain('entity top is');
    expect(topXdcText).toContain('PACKAGE_PIN W5');
    expect(topXdcText).toContain('PACKAGE_PIN U16');

    const readmeText = await loaded.file('README.txt')!.async('string');
    expect(readmeText).toContain('top.vhd');
    expect(readmeText).toContain('top.xdc');

    const bringupText = await loaded.file('BRINGUP.md')!.async('string');
    expect(bringupText).toContain('vivado -mode batch -source vivado_import.tcl');

    const programTclText = await loaded.file('program_and_test.tcl')!.async('string');
    expect(programTclText).toContain('open_hw');
    expect(programTclText).toContain('program_hw_devices');
  });
});
