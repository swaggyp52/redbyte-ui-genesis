import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import type { RuntimeVerifyRun } from '../apps/ide/projectRuntime';
import { generateBringUpVectors } from '../apps/ide/bringupArtifacts';
import { buildVerifyReport, buildVerifyWaveSamples } from '../apps/ide/verifyReport';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';

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

function buildFixtureProject(vhdl: string): RBProject {
  const parsed = parseVhdl(vhdl);
  const converted = parsedHdlToCircuit(parsed);
  const ioMapping = buildFixtureIoMapping();
  const ioRows = buildBringUpIoRows(ioMapping);
  const timestamp = '2026-02-21T00:00:00.000Z';
  const vectors = generateBringUpVectors({
    ioRows,
    circuit: converted.circuit,
    existingVectors: [],
  });

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'bringup-contract-counter',
    description: 'Bring-up contract fixture',
    circuit: converted.circuit,
    ioMapping,
    vectors,
    hdl: {
      top: 'top',
      sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }],
    },
    fpga: { board: 'basys3', top: 'top' },
    meta: {
      projectId: 'bringup-contract-counter-fixture',
    },
  };
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
  const scheduleContract = deriveVerifySchedule(project.circuit, project.ioMapping, project.hdl);
  const outputSignals = (project.ioMapping?.outputs ?? []).map((entry) => entry.label ?? entry.id);
  const rows = (project.vectors ?? []).flatMap((vector) =>
    outputSignals.map((signal) => {
      const expected = normalizeBitSymbol(vector.expected?.[signal]);
      return {
        tick: vector.tick,
        signal,
        expected,
        actual: expected,
      };
    })
  );
  const report = buildVerifyReport({
    scenarioId: 'bringup-contract-fixture',
    scenarioName: 'Bring-up Contract Fixture',
    status: 'pass',
    deterministicHash: 'verify_bringup_contract_fixture',
    rows,
    vectors: buildVerifyVectors(project.vectors ?? []),
    generatedAtIso: GENERATED_AT_ISO,
    signalRoles: buildSignalRoles(project.ioMapping ?? buildFixtureIoMapping()),
  });

  return {
    scenarioId: report.scenarioId,
    scenarioName: report.scenarioName,
    status: report.status,
    deterministicHash: report.deterministicHash,
    reportHash: report.reportHash,
    firstFailingTick: report.firstFailingTick,
    generatedAtIso: report.generatedAtIso,
    schedule: scheduleContract.schedule,
    scheduleContract,
    meta: {
      circuitKind: scheduleContract.schedule === 'clocked_macro' ? 'sequential' : 'combinational',
      clockingProtocol: scheduleContract.schedule === 'clocked_macro' ? 'clocked_macro' : null,
      samplePoint: scheduleContract.samplePoint,
      tick0Meaning: scheduleContract.tick0Meaning,
      clockSignalName: scheduleContract.clockSignalName ?? null,
    },
    report,
    waveform: buildVerifyWaveSamples(report),
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
  it('builds deterministic bring-up vectors and exports the canonical bring-up proof artifacts', async () => {
    const project = buildFixtureProject(loadFixtureVhdl());
    const ioRows = buildBringUpIoRows(project.ioMapping ?? buildFixtureIoMapping());
    const vectorsA = generateBringUpVectors({
      ioRows,
      circuit: project.circuit,
      existingVectors: [],
    });
    const vectorsB = generateBringUpVectors({
      ioRows,
      circuit: project.circuit,
      existingVectors: [],
    });

    expect(vectorsA).toEqual(vectorsB);
    expect(vectorsA).toHaveLength(18);
    expect(vectorsA[0]).toMatchObject({
      tick: 0,
      inputs: { clk: 0, rst: 1, count_en: 0 },
      expected: { q0: 0, q1: 0, q2: 0, q3: 0 },
    });

    const runtimeVerifyRun = buildFixtureRuntimeVerifyRun(project);
    expect(runtimeVerifyRun.status).toBe('pass');
    expect(runtimeVerifyRun.schedule).toBe('clocked_macro');

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
    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.generatedAtIso).toBe(GENERATED_AT_ISO);
    expect(expectedIo.verifyHash).toBe(runtimeVerifyRun.deterministicHash);
    expect(expectedIo.verifyReportHash).toBe(runtimeVerifyRun.reportHash);
    expect(expectedIo.signals).toHaveLength(4);
    const q0Signal = expectedIo.signals?.find((entry) => entry.signal === 'q0' && entry.pin === 'LD0');
    expect(q0Signal?.packagePin).toBe('U16');
    expect(q0Signal?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tick: 0, expected: '0' }),
        expect.objectContaining({ tick: 3, expected: '1' }),
      ])
    );

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
    expect(zippedExpectedIo.source).toBe('verify-run');
    expect(programText).toContain('open_hw_manager');
  });
});
