import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { encodeRBProject } from '../export/projectFormat';
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
  const timestamp = '2026-02-20T00:00:00.000Z';

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'rbproj-export-contract',
    description: 'RBProject inclusion contract fixture',
    circuit: converted.circuit,
    ioMapping: buildFixtureIoMapping(),
    vectors: buildFixtureVectors(),
    hdl: {
      top: 'top',
      sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }],
    },
    fpga: { board: 'basys3', top: 'top' },
    meta: {
      projectId: 'rbproj-export-contract-fixture',
    },
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

describe('IDE export includes rbproj contract', () => {
  it('exports project.rbproj.json and includes it in MANIFEST.json hashes', async () => {
    const project = buildFixtureProject(loadFixtureVhdl());
    const encodedProject = encodeRBProject(project).replace(/\r\n/g, '\n').trim();
    const exportViewModel = buildExportViewModel(project);
    expect(exportViewModel.status).toBe('ok');

    const rbprojArtifact = exportViewModel.artifacts.find(
      (artifact) => artifact.path === 'project.rbproj.json'
    );
    expect(rbprojArtifact).toBeTruthy();
    expect(rbprojArtifact?.status).toBe('ready');
    expect(rbprojArtifact?.content.trim()).toBe(encodedProject);

    const capsule = await buildEvidenceCapsule({
      project,
      exportViewModel,
      verifyResult: {
        status: 'pass',
        hash: 'verify_hash_fixture',
        reportHash: 'verify_report_hash_fixture',
        ranAtIso: '2026-02-20T00:00:00.000Z',
      },
      deterministicHash: 'det_hash_fixture',
      toolVersion: '1.0.0-test',
      toolCommit: 'abc123def',
      createdAtIso: '2026-02-20T00:00:00.000Z',
    });

    const zip = await JSZip.loadAsync(capsule.zipBytes);
    const rbprojZipEntry = zip.file('project.rbproj.json');
    expect(rbprojZipEntry, 'project.rbproj.json should be present in export zip').toBeTruthy();
    const rbprojText = await rbprojZipEntry!.async('string');
    expect(rbprojText.replace(/\r\n/g, '\n').trim()).toBe(encodedProject);

    const manifestRaw = await zip.file('MANIFEST.json')!.async('string');
    const manifest = JSON.parse(manifestRaw) as {
      files: Array<{ path: string; sha256: string; sizeBytes: number }>;
    };
    const rbprojManifestEntry = manifest.files.find((entry) => entry.path === 'project.rbproj.json');
    expect(rbprojManifestEntry).toBeTruthy();

    const rbprojBytes = await rbprojZipEntry!.async('uint8array');
    const rbprojDigest = await sha256Hex(rbprojBytes);
    expect(rbprojManifestEntry?.sha256).toBe(rbprojDigest);
    expect(rbprojManifestEntry?.sizeBytes).toBe(rbprojBytes.byteLength);
  });
});
