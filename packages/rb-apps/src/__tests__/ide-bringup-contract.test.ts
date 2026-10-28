import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { useProjectRuntime, type RuntimeVerifyRun } from '../apps/ide/projectRuntime';
import { generateBringUpVectors } from '../apps/ide/bringupArtifacts';
import { buildVerifyReport, buildVerifyWaveSamples } from '../apps/ide/verifyReport';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';
import { nativeCounterCircuit } from './helpers/nativeCounterFixture';

const FIXTURE_DIR = join(
  process.cwd(),
  'packages/rb-apps/src/fixtures/import/03-vivado-ish-clocked'
);
const GENERATED_AT_ISO = '2026-03-08T00:00:00.000Z';
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

/**
 * A bring-up project around `circuit` with the counter's ports and generated bring-up vectors.
 * `importedSource` keeps the imported VHDL the port-only projection came from.
 */
function buildFixtureProject(circuit: Circuit, importedSource?: string): RBProject {
  const ioMapping = buildFixtureIoMapping();
  const ioRows = buildBringUpIoRows(ioMapping);
  const timestamp = '2026-02-21T00:00:00.000Z';
  const vectors = generateBringUpVectors({ ioRows, circuit, existingVectors: [] });
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'bringup-contract-counter',
    description: 'Bring-up contract fixture',
    circuit,
    ioMapping,
    vectors,
    hdl: { top: 'top', sources: importedSource ? [{ path: 'top.vhd', language: 'vhdl', text: importedSource }] : [] },
    fpga: { board: 'basys3', top: 'top' },
    meta: { projectId: 'bringup-contract-counter-fixture' },
  };
}

/** The imported counter: a process the importer keeps as a port scaffold (INPUT/OUTPUT, no logic). */
function importedCounterProject(): RBProject {
  const vhdl = loadFixtureVhdl();
  return buildFixtureProject(parsedHdlToCircuit(parseVhdl(vhdl)).circuit, vhdl);
}

function buildBringUpIoRows(ioMapping: IoMapping) {
  return [
    ...(ioMapping.inputs ?? []).map((entry) => ({
      id: entry.id,
      nodeId: entry.nodeId,
      label: entry.label ?? entry.id,
      direction: 'in' as const,
      pin: entry.pin ?? '',
      required: true,
    })),
    ...(ioMapping.outputs ?? []).map((entry) => ({
      id: entry.id,
      nodeId: entry.nodeId,
      label: entry.label ?? entry.id,
      direction: 'out' as const,
      pin: entry.pin ?? '',
      required: true,
    })),
  ];
}

function buildVerifyVectors(vectors: TestVector[]) {
  return vectors.map((vector, index) => ({
    id: vector.id ?? `vec-${String(index + 1).padStart(2, '0')}`,
    tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
    inputs: normalizeBitRecord(vector.inputs ?? {}),
    expected: normalizeBitRecord(vector.expected ?? {}),
  }));
}

function buildSignalRoles(ioMapping: IoMapping) {
  return {
    ...(ioMapping.inputs ?? []).reduce<Record<string, 'clock' | 'reset' | 'input'>>(
      (acc, entry) => {
        const label = entry.label ?? entry.id;
        if (label === 'clk') {
          acc[label] = 'clock';
        } else if (label === 'rst') {
          acc[label] = 'reset';
        } else {
          acc[label] = 'input';
        }
        return acc;
      },
      {}
    ),
    ...(ioMapping.outputs ?? []).reduce<Record<string, 'output'>>((acc, entry) => {
      const label = entry.label ?? entry.id;
      acc[label] = 'output';
      return acc;
    }, {}),
  };
}

function buildFixtureRuntimeVerifyRun(project: RBProject): RuntimeVerifyRun {
  useProjectRuntime.getState().loadFromProject(project);
  const state = useProjectRuntime.getState();
  return state.runVerification({ scenarioId: state.activeScenarioId, scenarioName: 'Bring-up Contract Fixture',
    deterministicHash: 'verify_bringup_contract_fixture', rows: [], assertionMode: true,
    ranAtIso: GENERATED_AT_ISO });
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

function normalizeBitRecord(record: Record<string, boolean | number | string | undefined>) {
  const normalized: Record<string, 0 | 1> = {};
  for (const key of Object.keys(record).sort()) {
    normalized[key] = record[key] === true || record[key] === 1 || record[key] === '1' ? 1 : 0;
  }
  return normalized;
}

function normalizeBitSymbol(value: unknown): string {
  return value === true || value === 1 || value === '1' ? '1' : '0';
}

describe('IDE bring-up contract', () => {
  it('never treats a port-only HDL projection as browser proof, and never packages its tied-low scaffold', async () => {
    const project = importedCounterProject();
    const ioRows = buildBringUpIoRows(project.ioMapping ?? buildFixtureIoMapping());
    const vectorsA = generateBringUpVectors({ ioRows, circuit: project.circuit, existingVectors: [] });
    const vectorsB = generateBringUpVectors({ ioRows, circuit: project.circuit, existingVectors: [] });
    expect(vectorsA).toEqual(vectorsB);
    expect(vectorsA).toHaveLength(18);
    expect(vectorsA[0]).toMatchObject({
      tick: 0,
      inputs: { clk: 0, rst: 1, count_en: 0 },
      expected: { q0: 0, q1: 0, q2: 0, q3: 0 },
    });

    const runtimeVerifyRun = buildFixtureRuntimeVerifyRun(project);
    expect(runtimeVerifyRun.status).toBe('fail');
    // This imported HDL fixture provides a port projection, not simulated counter logic.
    // Its disconnected outputs are unknown. A test must not manufacture actual=expected.
    expect(runtimeVerifyRun.evidence?.preflight.filter(issue => issue.kind === 'floating-output')).toHaveLength(4);
    expect(runtimeVerifyRun.report.rows.every(row => row.actual === 'X')).toBe(true);
    expect(runtimeVerifyRun.schedule).toBe('combinational');

    // The generated top of a port scaffold drives no LED. It used to export ok, with bring-up
    // steps and EXPECTED_IO telling a student the LEDs count while the top tied them to '0'.
    // Every output is now refused by name, and no package or bring-up reference is ready.
    const exportViewModel = buildExportViewModel(project, runtimeVerifyRun);
    expect(exportViewModel.status).toBe('blocked');
    expect(exportViewModel.errors.map((error) => error.code)).toEqual(['RBEX4103', 'RBEX4103', 'RBEX4103', 'RBEX4103']);
    const top = exportViewModel.artifacts.find((artifact) => artifact.path === 'top.vhd');
    expect(top?.status).toBe('blocked');
    expect(top?.content ?? '').not.toMatch(/<=\s*'0'/);
    for (const path of ['BRINGUP.md', 'EXPECTED_IO.json', 'program_and_test.tcl']) {
      expect(exportViewModel.artifacts.find((artifact) => artifact.path === path)?.status, path).not.toBe('ready');
    }
  });

  it('exports deterministic bring-up references for a counter that ships its logic', async () => {
    const project = buildFixtureProject(nativeCounterCircuit());
    const ioRows = buildBringUpIoRows(project.ioMapping ?? buildFixtureIoMapping());
    const vectorsA = generateBringUpVectors({ ioRows, circuit: project.circuit, existingVectors: [] });
    const vectorsB = generateBringUpVectors({ ioRows, circuit: project.circuit, existingVectors: [] });
    expect(vectorsA).toEqual(vectorsB);

    const runtimeVerifyRun = buildFixtureRuntimeVerifyRun(project);
    const exportViewModel = buildExportViewModel(project, runtimeVerifyRun);
    expect(exportViewModel.status).toBe('ok');
    expect(exportViewModel.errors).toEqual([]);

    const artifactPaths = exportViewModel.artifacts.map((artifact) => artifact.path).sort();
    expect(artifactPaths).toEqual(
      expect.arrayContaining(['BRINGUP.md', 'EXPECTED_IO.json', 'program_and_test.tcl'])
    );

    const bringupArtifact = exportViewModel.artifacts.find((artifact) => artifact.path === 'BRINGUP.md');
    const expectedIoArtifact = exportViewModel.artifacts.find(
      (artifact) => artifact.path === 'EXPECTED_IO.json'
    );
    const programArtifact = exportViewModel.artifacts.find(
      (artifact) => artifact.path === 'program_and_test.tcl'
    );

    expect(bringupArtifact?.status).toBe('ready');
    expect(expectedIoArtifact?.status).toBe('ready');
    expect(programArtifact?.status).toBe('ready');

    expect(bringupArtifact?.content).toContain('# Basys3 Bring-Up');
    expect(bringupArtifact?.content).toContain('vivado -mode batch -source vivado_import.tcl');
    expect(bringupArtifact?.content).toContain('Validate outputs against EXPECTED_IO.json.');

    const expectedIo = JSON.parse(expectedIoArtifact?.content ?? '{}') as {
      schemaVersion?: string;
      evidenceLevel?: string;
      source?: string;
      generatedAtIso?: string;
      verifyHash?: string;
      verifyReportHash?: string;
      signals?: Array<{
        signal?: string;
        pin?: string;
        packagePin?: string;
        values?: Array<{ tick?: number; expected?: string }>;
      }>;
    };
    expect(expectedIo.schemaVersion).toBe('rb.expected-io.v1');
    expect(expectedIo.evidenceLevel).toBe('E0');
    expect(expectedIo.source).toBe('project-vectors');
    expect(expectedIo.generatedAtIso).toBe(project.updatedAt);
    expect(expectedIo.verifyHash).toBeUndefined();
    expect(expectedIo.verifyReportHash).toBeUndefined();
    expect(expectedIo.signals).toHaveLength(4);
    const q0Signal = expectedIo.signals?.find((entry) => entry.signal === 'q0' && entry.pin === 'LD0');
    expect(q0Signal?.packagePin).toBe('U16');
    expect(q0Signal?.values).toEqual((project.vectors ?? []).map(vector => ({
      tick: vector.tick, expected: normalizeBitSymbol(vector.expected?.q0),
    })));

    expect(programArtifact?.content).toContain('open_hw_manager');
    expect(programArtifact?.content).toContain('connect_hw_server');
    expect(programArtifact?.content).toContain('program_hw_devices');

    const zipA = await buildVivadoKitZip(exportViewModel.artifacts);
    const zipB = await buildVivadoKitZip(exportViewModel.artifacts);
    expect(sha256Hex(zipA)).toBe(sha256Hex(zipB));

    const zip = await JSZip.loadAsync(zipA);
    const zipNames = Object.keys(zip.files)
      .filter((name) => !zip.files[name]?.dir)
      .sort();
    expect(zipNames).toEqual(
      expect.arrayContaining(['BRINGUP.md', 'EXPECTED_IO.json', 'program_and_test.tcl'])
    );

    const bringupText = await zip.file('BRINGUP.md')!.async('string');
    const expectedIoText = await zip.file('EXPECTED_IO.json')!.async('string');
    const programText = await zip.file('program_and_test.tcl')!.async('string');
    expect(bringupText).toContain('# Basys3 Bring-Up');
    const zippedExpectedIo = JSON.parse(expectedIoText) as { source?: string };
    expect(zippedExpectedIo.source).toBe('project-vectors');
    expect(programText).toContain('open_hw_manager');
  });
});
