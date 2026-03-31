/**
 * Contract gate: Verify scenario → exported testbench alignment.
 *
 * Guarantees:
 *   1. When activeScenario is supplied, exported testbench vectors are sourced from
 *      scenario.vectors — NOT from project.vectors.
 *   2. ExportViewModel.exportedScenario carries structured provenance (id, name,
 *      version, contentHash, isStaleComparedToLastPass).
 *   3. A stale scenario (vectors changed after last PASS) downgrades the testbench
 *      note and sets isStaleComparedToLastPass=true; it does NOT block export.
 *   4. When activeScenario is absent, the fallback is project.vectors (compat path).
 *   5. At ZIP/artifact level — testbench.vhd is present in the Vivado Kit and its
 *      content reflects scenario.vectors, not a divergent project.vectors set.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import type { RuntimeVerifyRun } from '../apps/ide/projectRuntime';
import {
  buildExportViewModel,
  type ExportedScenarioProvenance,
} from '../apps/ide/viewmodels/buildExportViewModel';
import {
  computeScenarioContentHash,
  createDefaultScenario,
  stampScenario,
  type VerifyScenario,
} from '../apps/ide/verifyScenario';
import { buildVerifyReport, buildVerifyWaveSamples } from '../apps/ide/verifyReport';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_DIR = join(
  process.cwd(),
  'packages/rb-apps/src/fixtures/import/03-vivado-ish-clocked'
);
const GENERATED_AT_ISO = '2026-03-18T00:00:00.000Z';
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

/** Vectors that represent the "current scenario" — the student's authored set. */
function buildScenarioVectors(): TestVector[] {
  return [
    { tick: 0, inputs: { clk: 0, rst: 1, count_en: 0 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
    { tick: 1, inputs: { clk: 1, rst: 0, count_en: 1 }, expected: { q0: 1, q1: 0, q2: 0, q3: 0 } },
    { tick: 2, inputs: { clk: 1, rst: 0, count_en: 1 }, expected: { q0: 0, q1: 1, q2: 0, q3: 0 } },
  ];
}

/** A divergent vector set — represents stale project.vectors that differ from the scenario. */
function buildStaleProjectVectors(): TestVector[] {
  return [
    { tick: 0, inputs: { clk: 0, rst: 1, count_en: 0 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
  ];
}

function buildFixtureProject(vhdl: string, projectVectors: TestVector[]): RBProject {
  const parsed = parseVhdl(vhdl);
  const converted = parsedHdlToCircuit(parsed);
  const timestamp = '2026-03-18T00:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'scenario-alignment-fixture',
    description: 'Scenario/testbench alignment contract fixture',
    circuit: converted.circuit,
    ioMapping: buildFixtureIoMapping(),
    vectors: projectVectors, // ← deliberate compat field; may diverge from scenario
    hdl: {
      top: 'top',
      sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }],
    },
    fpga: { board: 'basys3', top: 'top' },
    meta: { projectId: 'scenario-alignment-gate-fixture' },
  };
}

function buildFixtureScenario(vectors: TestVector[], name = 'Default'): VerifyScenario {
  return createDefaultScenario(vectors);
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

function buildFixtureRuntimeVerifyRun(
  project: RBProject,
  scenario: VerifyScenario,
  options: { recordContentHash?: boolean } = {}
): RuntimeVerifyRun {
  const scheduleContract = deriveVerifySchedule(project.circuit, project.ioMapping, project.hdl);
  const outputSignals = (project.ioMapping?.outputs ?? []).map((entry) => entry.label ?? entry.id);
  const rows = scenario.vectors.flatMap((vector) =>
    outputSignals.map((signal) => {
      const expected = normalizeBitSymbol(vector.expected?.[signal]);
      return { tick: vector.tick, signal, expected, actual: expected };
    })
  );
  const verifyVectors = scenario.vectors.map((vector, index) => ({
    id: `vec-${String(index + 1).padStart(2, '0')}`,
    tick: vector.tick,
    inputs: normalizeBitRecord(vector.inputs ?? {}),
    expected: normalizeBitRecord(vector.expected ?? {}),
  }));
  const report = buildVerifyReport({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: 'pass',
    deterministicHash: `verify_scenario_alignment_${scenario.id}`,
    rows,
    vectors: verifyVectors,
    generatedAtIso: GENERATED_AT_ISO,
    signalRoles: {
      clk: 'clock',
      rst: 'reset',
      count_en: 'input',
      q0: 'output',
      q1: 'output',
      q2: 'output',
      q3: 'output',
    },
  });

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioVersion: scenario.version,
    scenarioContentHash: options.recordContentHash
      ? computeScenarioContentHash(scenario)
      : undefined,
    status: 'pass',
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('scenario → testbench alignment contract', () => {
  it('uses scenario.vectors as the authoritative testbench source — not project.vectors', () => {
    const vhdl = loadFixtureVhdl();
    const scenarioVectors = buildScenarioVectors();
    const staleProjectVectors = buildStaleProjectVectors(); // deliberately divergent
    const project = buildFixtureProject(vhdl, staleProjectVectors);
    const scenario = buildFixtureScenario(scenarioVectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);

    expect(viewModel.status).toBe('ok');

    const tb = viewModel.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(tb).toBeDefined();
    expect(tb!.status).toBe('ready');

    // Testbench content must reference all scenario ticks, not just the single project.vectors tick
    const content = tb!.content;
    expect(content.length).toBeGreaterThan(0);

    // Scenario has 3 vectors (ticks 0,1,2); stale project.vectors has only 1.
    // The testbench content should contain tick=2 — only reachable via scenario vectors.
    expect(content).toContain('tick=2');
  });

  it('populates exportedScenario structured provenance on ExportViewModel', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, buildScenarioVectors());
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    const prov: ExportedScenarioProvenance | undefined = viewModel.exportedScenario;

    expect(prov).toBeDefined();
    expect(prov!.id).toBe(scenario.id);
    expect(prov!.name).toBe(scenario.name);
    expect(prov!.version).toBe(scenario.version);
    expect(prov!.contentHash).toBe(computeScenarioContentHash(scenario));
    expect(prov!.isStaleComparedToLastPass).toBe(false);
  });

  it('marks exportedScenario as stale when scenario has changed since last PASS', () => {
    const vhdl = loadFixtureVhdl();
    // Scenario at run time
    const scenarioAtRun = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, buildScenarioVectors());
    const run = buildFixtureRuntimeVerifyRun(project, scenarioAtRun, { recordContentHash: true });

    // Student edits the scenario after the run — stamp produces a new version + content
    const editedScenario = stampScenario({
      ...scenarioAtRun,
      vectors: [...buildScenarioVectors(), { tick: 3, inputs: { clk: 1, rst: 0, count_en: 0 }, expected: { q0: 1, q1: 1, q2: 0, q3: 0 } }],
    });

    const viewModel = buildExportViewModel(project, run, editedScenario);
    const prov = viewModel.exportedScenario;

    expect(prov).toBeDefined();
    expect(prov!.isStaleComparedToLastPass).toBe(true);
    expect(prov!.version).toBe(editedScenario.version);
  });

  it('stale scenario does not block export — status remains ok', () => {
    const vhdl = loadFixtureVhdl();
    const scenarioAtRun = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, buildScenarioVectors());
    const run = buildFixtureRuntimeVerifyRun(project, scenarioAtRun, { recordContentHash: true });

    const editedScenario = stampScenario({
      ...scenarioAtRun,
      vectors: [...buildScenarioVectors(), { tick: 3, inputs: { clk: 0, rst: 0, count_en: 0 }, expected: {} }],
    });

    const viewModel = buildExportViewModel(project, run, editedScenario);

    expect(viewModel.status).toBe('ok');
    expect(viewModel.exportedScenario!.isStaleComparedToLastPass).toBe(true);

    const tb = viewModel.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(tb!.status).toBe('ready');
    expect(tb!.note).toMatch(/STALE/i);
    expect(tb!.note).not.toMatch(/matches Verify PASS/i);
  });

  it('note on a fresh (non-stale) testbench references scenario name + version', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors(), 'Lab 2 Scenario');
    const project = buildFixtureProject(vhdl, buildScenarioVectors());
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    const tb = viewModel.artifacts.find((a) => a.path === 'testbench.vhd');

    expect(tb!.note).toContain(scenario.name);
    expect(tb!.note).toContain(`v${scenario.version}`);
    expect(tb!.note).toContain('verified PASS');
  });

  it('falls back to project.vectors when activeScenario is absent (compat path)', () => {
    const vhdl = loadFixtureVhdl();
    const scenarioVectors = buildScenarioVectors();
    const project = buildFixtureProject(vhdl, scenarioVectors);
    const scenario = buildFixtureScenario(scenarioVectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario);

    // No activeScenario passed — compat fallback
    const viewModel = buildExportViewModel(project, run, undefined);

    const tb = viewModel.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(tb).toBeDefined();
    expect(tb!.content.length).toBeGreaterThan(0);

    // Provenance is absent when no scenario is supplied
    expect(viewModel.exportedScenario).toBeUndefined();
  });

  it('export-path contract: testbench.vhd in Vivado Kit ZIP reflects scenario vectors', async () => {
    const vhdl = loadFixtureVhdl();
    const scenarioVectors = buildScenarioVectors();
    const staleProjectVectors = buildStaleProjectVectors();
    const project = buildFixtureProject(vhdl, staleProjectVectors);
    const scenario = buildFixtureScenario(scenarioVectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    expect(viewModel.status).toBe('ok');

    // Build ZIP — the same path taken when a student clicks "Download Vivado Kit"
    const zip = await buildVivadoKitZip(viewModel.artifacts);
    const loaded = await JSZip.loadAsync(zip);

    // Testbench must be present and non-empty
    const tbFile = loaded.file('testbench.vhd');
    expect(tbFile).not.toBeNull();
    const tbContent = await tbFile!.async('string');
    expect(tbContent.trim().length).toBeGreaterThan(0);

    // Content must reflect the scenario's 3-vector set (tick=2 only comes from scenario vectors)
    expect(tbContent).toContain('tick=2');

    // Structured provenance is accessible directly on the view model (not just in the note)
    expect(viewModel.exportedScenario).toBeDefined();
    expect(viewModel.exportedScenario!.isStaleComparedToLastPass).toBe(false);
    expect(viewModel.exportedScenario!.id).toBe(scenario.id);
  });
});
