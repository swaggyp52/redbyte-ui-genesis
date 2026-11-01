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
  // A combinational import the importer reconstructs, so the package carries real logic. (The
  // process-based counter fixture is a port scaffold whose generated top drives no output: it is
  // refused now, and used to ship with every LED tied to '0'.)
  'packages/rb-apps/src/fixtures/import/02-full-adder'
);
const ZIP_DATE = new Date('2026-01-01T00:00:00.000Z');

function loadFixtureVhdl(): string {
  return readFileSync(join(FIXTURE_DIR, 'top.vhd'), 'utf8');
}

function buildFixtureIoMapping(): IoMapping {
  return {
    inputs: [
      { id: 'a', nodeId: 'port_SW0', port: 'out', label: 'a', pin: 'SW0' },
      { id: 'b', nodeId: 'port_SW1', port: 'out', label: 'b', pin: 'SW1' },
      { id: 'cin', nodeId: 'port_SW2', port: 'out', label: 'cin', pin: 'SW2' },
    ],
    outputs: [
      { id: 'sum', nodeId: 'port_out_LD0', port: 'in', label: 'sum', pin: 'LD0' },
      { id: 'cout', nodeId: 'port_out_LD1', port: 'in', label: 'cout', pin: 'LD1' },
    ],
  };
}

function buildFixtureVectors(): TestVector[] {
  return [
    // Full-adder truth table rows: 1+0+0 = 01, 1+1+1 = 11.
    {
      tick: 0,
      inputs: { a: 1, b: 0, cin: 0 },
      expected: { sum: 1, cout: 0 },
    },
    {
      tick: 1,
      inputs: { a: 1, b: 1, cin: 1 },
      expected: { sum: 1, cout: 1 },
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
    expect(parsedProject.ioMapping?.outputs).toHaveLength(2);
    expect(parsedProject.vectors).toHaveLength(2);
  });
});
