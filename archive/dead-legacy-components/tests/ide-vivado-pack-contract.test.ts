import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { buildEvidenceCapsule } from '../apps/ide/evidenceCapsule';
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

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

describe('IDE Vivado pack contract', () => {
  it('builds deterministic vivado-ready capsule with valid manifest hashes', async () => {
    const project = buildFixtureProject(loadFixtureVhdl());
    const exportViewModel = buildExportViewModel(project);
    expect(exportViewModel.status).toBe('ok');

    const capsule = await buildEvidenceCapsule({
      project,
      exportViewModel,
      verifyResult: {
        status: 'pass',
        hash: 'vrf_fixture_hash',
        reportHash: 'vrf_report_fixture_hash',
        ranAtIso: '2026-02-19T00:00:00.000Z',
      },
      deterministicHash: 'det_fixture_hash',
      toolVersion: '1.0.0-test',
      toolCommit: 'abc123def',
      createdAtIso: '2026-02-19T00:00:00.000Z',
    });

    const zip = await JSZip.loadAsync(capsule.zipBytes);
    const fileNames = Object.keys(zip.files)
      .filter((name) => !zip.files[name]?.dir)
      .sort();

    const requiredPaths = [
      'BRINGUP.md',
      'EXPECTED_IO.json',
      'MANIFEST.json',
      'README.txt',
      'project.rbproj.json',
      'program_and_test.tcl',
      'rb-project.json',
      'testbench.vhd',
      'top.vhd',
      'top.xdc',
      'vectors.json',
      'verify-report.json',
      'vivado_import.tcl',
    ];
    for (const path of requiredPaths) {
      expect(fileNames).toContain(path);
    }

    const tclText = await zip.file('vivado_import.tcl')!.async('string');
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

    const expectedIoText = await zip.file('EXPECTED_IO.json')!.async('string');
    const expectedIo = JSON.parse(expectedIoText) as {
      schemaVersion: string;
      board: string;
      source: string;
      signals: Array<{ signal: string; values: Array<{ tick: number; expected: string }> }>;
    };
    expect(expectedIo.schemaVersion).toBe('rb.expected-io.v1');
    expect(expectedIo.board).toBe('basys3');
    expect(expectedIo.signals.length).toBeGreaterThan(0);

    const manifestRaw = await zip.file('MANIFEST.json')!.async('string');
    const manifest = JSON.parse(manifestRaw) as {
      schemaVersion: string;
      project: { name: string; id: string };
      board: string;
      toolchain: { redbyteVersion: string; redbyteCommit: string };
      hashes: { exportHash: string; verifyHash: string };
      mappingSummary: Array<{ signal: string; pin: string }>;
      files: Array<{ path: string; sha256: string; sizeBytes: number }>;
    };

    expect(manifest.schemaVersion).toBe('rb.evidence-capsule.v2');
    expect(manifest.project).toEqual({
      name: 'vivado-pack-counter',
      id: 'vivado-pack-counter-fixture',
    });
    expect(manifest.board).toBe('basys3');
    expect(manifest.toolchain.redbyteVersion).toBe('1.0.0-test');
    expect(manifest.toolchain.redbyteCommit).toBe('abc123def');
    expect(manifest.hashes.verifyHash).toBe('vrf_fixture_hash');
    expect(manifest.hashes.exportHash.length).toBeGreaterThan(0);
    expect(manifest.mappingSummary.length).toBeGreaterThanOrEqual(7);
    expect(
      manifest.mappingSummary.some((entry) => entry.signal === 'clk' && entry.pin === 'CLK100MHZ')
    ).toBe(true);

    for (const file of manifest.files) {
      const zipEntry = zip.file(file.path);
      expect(zipEntry, `missing entry listed in manifest: ${file.path}`).toBeTruthy();
      const bytes = await zipEntry!.async('uint8array');
      const digest = await sha256Hex(bytes);
      expect(digest).toBe(file.sha256);
      expect(bytes.byteLength).toBe(file.sizeBytes);
    }
  });
});
