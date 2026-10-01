import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { HdlSource } from '../fpga/toolchainBackend';
import { decodeRBProject, deriveSourceModel, encodeRBProject, type RBProject } from '../export/projectFormat';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { exportProjectAsBasys3 } from '../fpga/boards/basys3/basys3ExportService';

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

describe('IDE export includes rbproj contract', () => {
  it('includes canonical project.rbproj.json in the export artifact set and ZIP', async () => {
    const project = buildFixtureProject(loadFixtureVhdl());
    const staleAuthoredProjection = encodeRBProject(project).replace(/\r\n/g, '\n').trim();
    const canonicalExport = exportProjectAsBasys3(project);
    expect(canonicalExport.success).toBe(true);
    expect(canonicalExport.bundle).toBeTruthy();
    expect(canonicalExport.projectProjection).toBeTruthy();
    const exportViewModel = buildExportViewModel(project);
    const finalVhd = exportViewModel.artifacts.find(artifact => artifact.path === 'top.vhd')!.content;
    const finalXdc = exportViewModel.artifacts.find(artifact => artifact.path === 'top.xdc')!.content;
    const generatedProjection = canonicalExport.projectProjection!;
    const encodedProjection = encodeRBProject({
      ...generatedProjection,
      sourceModel: deriveSourceModel(project),
      hdl: { ...generatedProjection.hdl!, sources: generatedProjection.hdl!.sources.map((source: HdlSource) => ({
        ...source, text: exportViewModel.artifacts.find(artifact => artifact.path === source.path)?.content ?? source.text,
      })) },
      fpga: { ...generatedProjection.fpga!, constraints: { type: 'xdc', text: finalXdc } },
    }).replace(/\r\n/g, '\n').trim();

    expect(exportViewModel.status).toBe('ok');

    const rbprojArtifact = exportViewModel.artifacts.find(
      (artifact) => artifact.path === 'project.rbproj.json'
    );
    expect(rbprojArtifact).toBeTruthy();
    expect(rbprojArtifact?.status).toBe('ready');
    expect(rbprojArtifact?.content.trim()).toBe(encodedProjection);
    expect(rbprojArtifact?.content.trim()).not.toBe(staleAuthoredProjection);

    const authoredProject = decodeRBProject(staleAuthoredProjection);
    const projectedProject = decodeRBProject(rbprojArtifact!.content);
    expect(projectedProject.circuit).toEqual(authoredProject.circuit);
    expect(projectedProject.ioMapping).toEqual(authoredProject.ioMapping);
    expect(projectedProject.vectors).toEqual(authoredProject.vectors);
    expect(projectedProject.name).toBe(project.name);
    expect(projectedProject.meta).toEqual(project.meta);
    expect(projectedProject.sourceModel?.topEntity).toBe(project.hdl?.top);
    expect(projectedProject.sourceModel?.files.find(source => source.path === 'top.vhd')?.text)
      .toBe(loadFixtureVhdl());
    expect(projectedProject.hdl?.sources.find((source) => source.path === 'top.vhd')?.text)
      .toBe(finalVhd);
    expect(projectedProject.fpga?.constraints?.text).toBe(finalXdc);

    const zipA = await buildVivadoKitZip(exportViewModel.artifacts);
    const zipB = await buildVivadoKitZip(exportViewModel.artifacts);
    expect(sha256Hex(zipA)).toBe(sha256Hex(zipB));

    const zip = await JSZip.loadAsync(zipA);
    const rbprojZipEntry = zip.file('project.rbproj.json');
    expect(rbprojZipEntry, 'project.rbproj.json should be present in export ZIP').toBeTruthy();

    const rbprojText = await rbprojZipEntry!.async('string');
    expect(rbprojText.replace(/\r\n/g, '\n').trim()).toBe(encodedProjection);
    expect(await zip.file('top.vhd')!.async('string')).toBe(projectedProject.hdl!.sources.find(source => source.path === 'top.vhd')!.text);
    expect(await zip.file('top.xdc')!.async('string')).toBe(projectedProject.fpga!.constraints!.text);

    const parsedProject = JSON.parse(rbprojText) as RBProject;
    expect(parsedProject.name).toBe('rbproj-export-contract');
    expect(parsedProject.meta?.projectId).toBe('rbproj-export-contract-fixture');
    expect(parsedProject.ioMapping?.inputs).toHaveLength(3);
    expect(parsedProject.ioMapping?.outputs).toHaveLength(4);
    expect(parsedProject.vectors).toHaveLength(2);
  });
});
