import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { IoMapping } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';
import { buildEvidenceCapsule } from '../apps/ide/evidenceCapsule';
import {
  generateBringUpVectors,
  type BringUpIoRow,
} from '../apps/ide/bringupArtifacts';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import {
  buildVerifyReport,
  buildVerifyWaveSamples,
} from '../apps/ide/verifyReport';
import type { RuntimeVerifyRun } from '../apps/ide/projectRuntime';

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
  const timestamp = '2026-02-20T00:00:00.000Z';

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'bringup-counter',
    description: 'Bring-up contract fixture',
    circuit: converted.circuit,
    ioMapping: buildFixtureIoMapping(),
    vectors: [],
    hdl: {
      top: 'top',
      sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }],
    },
    fpga: { board: 'basys3', top: 'top' },
    meta: {
      projectId: 'bringup-counter-fixture',
    },
  };
}

function toBringUpIoRows(project: RBProject): BringUpIoRow[] {
  const rows: BringUpIoRow[] = [];
  for (const input of project.ioMapping?.inputs ?? []) {
    rows.push({
      id: input.id,
      label: input.label ?? input.id,
      direction: 'in',
      pin: input.pin ?? '',
      required: true,
    });
  }
  for (const output of project.ioMapping?.outputs ?? []) {
    rows.push({
      id: output.id,
      label: inputLabel(output),
      direction: 'out',
      pin: output.pin ?? '',
      required: true,
    });
  }
  return rows;
}

function inputLabel(entry: { id: string; label?: string }): string {
  return (entry.label ?? entry.id).trim() || entry.id;
}

function buildRuntimeRun(project: RBProject): RuntimeVerifyRun {
  const outputSignals = (project.ioMapping?.outputs ?? []).map((entry) =>
    inputLabel(entry).trim().toLowerCase()
  );
  const rows = (project.vectors ?? []).flatMap((vector) =>
    outputSignals.map((signal) => {
      const expectedValue = normalizeBitSymbol(vector.expected?.[signal]);
      return {
        tick: vector.tick,
        signal,
        expected: expectedValue,
        actual: expectedValue,
      };
    })
  );

  const report = buildVerifyReport({
    scenarioId: 'bringup',
    scenarioName: 'Bring-up deterministic run',
    status: 'pass',
    deterministicHash: 'vrf_bringup_fixture_hash',
    rows,
    vectors: (project.vectors ?? []).map((vector, index) => ({
      id: vector.id ?? `vec-${String(index + 1).padStart(2, '0')}`,
      tick: vector.tick,
      inputs: normalizeBitRecord(vector.inputs ?? {}),
      expected: normalizeBitRecord(vector.expected ?? {}),
    })),
    generatedAtIso: '2026-02-20T00:00:00.000Z',
  });

  const schedule = deriveVerifySchedule(project.circuit, project.ioMapping ?? { inputs: [], outputs: [] }).schedule;

  return {
    scenarioId: report.scenarioId,
    scenarioName: report.scenarioName,
    status: report.status,
    deterministicHash: report.deterministicHash,
    reportHash: report.reportHash,
    generatedAtIso: report.generatedAtIso,
    firstFailingTick: report.firstFailingTick,
    schedule,
    report,
    waveform: buildVerifyWaveSamples(report),
  };
}

function normalizeBitRecord(
  value: Record<string, unknown>
): Record<string, 0 | 1> {
  const next: Record<string, 0 | 1> = {};
  for (const key of Object.keys(value).sort()) {
    next[key.trim().toLowerCase()] = normalizeBit(value[key]);
  }
  return next;
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function normalizeBitSymbol(value: unknown): string {
  return normalizeBit(value) === 1 ? '1' : '0';
}

describe('IDE bring-up contract', () => {
  it('generates deterministic bring-up vectors and includes hardware proof artifacts in export capsule', async () => {
    const project = buildFixtureProject(loadFixtureVhdl());
    const vectorsA = generateBringUpVectors({
      ioRows: toBringUpIoRows(project),
      circuit: project.circuit,
      existingVectors: project.vectors,
    });
    const vectorsB = generateBringUpVectors({
      ioRows: toBringUpIoRows(project),
      circuit: project.circuit,
      existingVectors: project.vectors,
    });

    expect(vectorsA.length).toBeGreaterThan(0);
    expect(vectorsA).toEqual(vectorsB);

    const projectWithVectors: RBProject = {
      ...project,
      vectors: vectorsA,
    };
    const runtimeRun = buildRuntimeRun(projectWithVectors);
    const exportViewModel = buildExportViewModel(projectWithVectors, runtimeRun);
    expect(exportViewModel.status).toBe('ok');

    const artifactPaths = exportViewModel.artifacts.map((entry) => entry.path).sort();
    expect(artifactPaths).toContain('BRINGUP.md');
    expect(artifactPaths).toContain('EXPECTED_IO.json');
    expect(artifactPaths).toContain('program_and_test.tcl');

    const expectedIoArtifact = exportViewModel.artifacts.find(
      (entry) => entry.path === 'EXPECTED_IO.json'
    );
    expect(expectedIoArtifact?.content.length ?? 0).toBeGreaterThan(0);
    const expectedIo = JSON.parse(expectedIoArtifact?.content ?? '{}') as {
      schemaVersion: string;
      source: string;
      signals: Array<{ signal: string; values: Array<{ tick: number; expected: string }> }>;
    };
    expect(expectedIo.schemaVersion).toBe('rb.expected-io.v1');
    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.signals.length).toBeGreaterThan(0);

    const capsule = await buildEvidenceCapsule({
      project: projectWithVectors,
      exportViewModel,
      verifyResult: {
        status: 'pass',
        hash: runtimeRun.deterministicHash,
        reportHash: runtimeRun.reportHash,
        report: runtimeRun.report,
        ranAtIso: runtimeRun.generatedAtIso,
      },
      deterministicHash: 'det_bringup_fixture_hash',
      toolVersion: '1.0.0-test',
      toolCommit: 'abc123def',
      createdAtIso: '2026-02-20T00:00:00.000Z',
    });

    const zip = await JSZip.loadAsync(capsule.zipBytes);
    const paths = Object.keys(zip.files)
      .filter((path) => !zip.files[path]?.dir)
      .sort();

    expect(paths).toContain('BRINGUP.md');
    expect(paths).toContain('EXPECTED_IO.json');
    expect(paths).toContain('program_and_test.tcl');
  });
});
