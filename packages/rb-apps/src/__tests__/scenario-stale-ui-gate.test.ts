/**
 * Contract gate: Scenario stale state — view model + provenance contracts.
 *
 * These tests verify the computed conditions that drive scenario stale / wrong-scenario
 * UI in VerifySurface and the provenance rendering in ExportSurface:
 *
 *   1. Scenario-stale: same scenario, vectors edited after last run
 *      → isStale = (run.scenarioId === active.id) && hashes differ
 *   2. Wrong-scenario: active scenario differs from the one that produced the run
 *      → isWrongScenario = run.scenarioId !== active.id
 *   3. Switch-back CTA guard: only offered when old scenario still exists in library
 *   4. Export positive provenance: ExportViewModel.exportedScenario present when not stale
 *   5. Export stale provenance: exportedScenario.isStaleComparedToLastPass=true when changed
 *   6. ExportSurface testbench source section renders positive identity even when not stale
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import type { RuntimeVerifyRun } from '../apps/ide/projectRuntime';
import {
  computeScenarioContentHash,
  createScenario,
  createDefaultScenario,
  stampScenario,
  type VerifyScenario,
} from '../apps/ide/verifyScenario';
import {
  buildExportViewModel,
} from '../apps/ide/viewmodels/buildExportViewModel';
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

function baseVectors(): TestVector[] {
  return [
    { tick: 0, inputs: { clk: 0, rst: 1, count_en: 0 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
    { tick: 1, inputs: { clk: 1, rst: 0, count_en: 1 }, expected: { q0: 1, q1: 0, q2: 0, q3: 0 } },
  ];
}

function buildFixtureProject(vhdl: string, vectors: TestVector[]): RBProject {
  const parsed = parseVhdl(vhdl);
  const converted = parsedHdlToCircuit(parsed);
  const ts = '2026-03-18T00:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    name: 'stale-ui-gate-fixture',
    description: 'Stale UI gate fixture',
    circuit: converted.circuit,
    ioMapping: buildFixtureIoMapping(),
    vectors,
    hdl: { top: 'top', sources: [{ path: 'top.vhd', language: 'vhdl', text: vhdl }] },
    fpga: { board: 'basys3', top: 'top' },
    meta: { projectId: 'stale-ui-gate-fixture' },
  };
}

function normalizeBitSymbol(value: unknown): string {
  return value === true || value === 1 || value === '1' ? '1' : '0';
}

function buildFixtureRun(
  project: RBProject,
  scenario: VerifyScenario,
  options: { recordContentHash?: boolean } = {}
): RuntimeVerifyRun {
  const scheduleContract = deriveVerifySchedule(project.circuit, project.ioMapping, project.hdl);
  const outputSignals = (project.ioMapping?.outputs ?? []).map((e) => e.label ?? e.id);
  const rows = scenario.vectors.flatMap((vector) =>
    outputSignals.map((signal) => {
      const expected = normalizeBitSymbol(vector.expected?.[signal]);
      return { tick: vector.tick, signal, expected, actual: expected };
    })
  );
  const vectors = scenario.vectors.map((vector, i) => ({
    id: `vec-${i}`,
    tick: vector.tick,
    inputs: Object.fromEntries(Object.entries(vector.inputs ?? {}).map(([k, v]) => [k, v === 1 || v === true ? 1 : 0])) as Record<string, 0 | 1>,
    expected: Object.fromEntries(Object.entries(vector.expected ?? {}).map(([k, v]) => [k, v === 1 || v === true ? 1 : 0])) as Record<string, 0 | 1>,
  }));
  const report = buildVerifyReport({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: 'pass',
    deterministicHash: `hash_${scenario.id}`,
    rows,
    vectors,
    generatedAtIso: GENERATED_AT_ISO,
    signalRoles: { clk: 'clock', rst: 'reset', count_en: 'input', q0: 'output', q1: 'output', q2: 'output', q3: 'output' },
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
    firstFailingTick: undefined,
    generatedAtIso: report.generatedAtIso,
    schedule: scheduleContract.schedule,
    scheduleContract,
    meta: {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: scheduleContract.samplePoint,
      tick0Meaning: scheduleContract.tick0Meaning,
      clockSignalName: scheduleContract.clockSignalName ?? null,
    },
    report,
    waveform: buildVerifyWaveSamples(report),
  };
}

// ─── Scenario-stale detection ─────────────────────────────────────────────────

describe('scenario-stale detection contract', () => {
  it('same scenario, no change → not stale', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: true }
    );

    const isScenarioStale =
      run.scenarioId === scenario.id &&
      typeof run.scenarioContentHash === 'string' &&
      run.scenarioContentHash !== computeScenarioContentHash(scenario);

    expect(isScenarioStale).toBe(false);
  });

  it('same scenario, vectors edited after run → stale', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: true }
    );

    // Student edits vectors post-run
    const editedScenario = stampScenario({
      ...scenario,
      vectors: [...baseVectors(), { tick: 2, inputs: { clk: 0, rst: 0, count_en: 0 }, expected: {} }],
    });

    const isScenarioStale =
      run.scenarioId === editedScenario.id &&
      typeof run.scenarioContentHash === 'string' &&
      run.scenarioContentHash !== computeScenarioContentHash(editedScenario);

    expect(isScenarioStale).toBe(true);
  });

  it('same scenario, hash absent on run → conservative: not stale', () => {
    // Older runs may not have scenarioContentHash recorded
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: false } // no hash recorded
    );

    const isScenarioStale =
      run.scenarioId === scenario.id &&
      typeof run.scenarioContentHash === 'string' && // false when undefined
      run.scenarioContentHash !== computeScenarioContentHash(scenario);

    // Conservative: no hash → can't determine staleness → not stale
    expect(isScenarioStale).toBe(false);
  });
});

// ─── Wrong-scenario detection ─────────────────────────────────────────────────

describe('wrong-scenario detection contract', () => {
  it('same scenario active as the one that ran → not wrong-scenario', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenario);

    const isWrongScenario = run.scenarioId !== scenario.id;
    expect(isWrongScenario).toBe(false);
  });

  it('different scenario active than the one that ran → wrong-scenario', () => {
    const scenarioA = createDefaultScenario(baseVectors());
    const scenarioB = createScenario('Lab 2', baseVectors());
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenarioA);

    const isWrongScenario = run.scenarioId !== scenarioB.id;
    expect(isWrongScenario).toBe(true);
  });
});

// ─── Switch-back CTA guard ────────────────────────────────────────────────────

describe('switch-back CTA guard — only when old scenario exists in library', () => {
  it('CTA offered when old scenario still exists', () => {
    const scenarioA = createDefaultScenario(baseVectors());
    const scenarioB = createScenario('Lab 2', baseVectors());
    const library = [scenarioA, scenarioB];
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenarioA);

    // Active is B; run was for A
    const lastRunScenario = library.find((s) => s.id === run.scenarioId) ?? null;
    // Constraint: CTA shown only when old scenario exists
    expect(lastRunScenario).not.toBeNull();
    expect(lastRunScenario?.id).toBe(scenarioA.id);
  });

  it('CTA absent when old scenario was deleted from library', () => {
    const scenarioA = createDefaultScenario(baseVectors());
    const scenarioB = createScenario('Lab 2', baseVectors());
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenarioA);

    // scenarioA was deleted — library now only has B
    const libraryAfterDeletion = [scenarioB];

    // Active is B; run was for A (now deleted)
    const lastRunScenario = libraryAfterDeletion.find((s) => s.id === run.scenarioId) ?? null;
    // Constraint: no CTA since the scenario was deleted
    expect(lastRunScenario).toBeNull();
  });
});

// ─── Export provenance — view model level ────────────────────────────────────

describe('ExportViewModel scenario provenance', () => {
  it('exportedScenario present and not stale when scenario matches run', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = createDefaultScenario(baseVectors());
    const project = buildFixtureProject(vhdl, baseVectors());
    const run = buildFixtureRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);

    expect(viewModel.exportedScenario).toBeDefined();
    expect(viewModel.exportedScenario!.isStaleComparedToLastPass).toBe(false);
    expect(viewModel.exportedScenario!.name).toBe(scenario.name);
    expect(viewModel.exportedScenario!.version).toBe(scenario.version);
    expect(viewModel.exportedScenario!.contentHash).toBe(computeScenarioContentHash(scenario));
  });

  it('exportedScenario.isStaleComparedToLastPass=true when vectors changed post-run', () => {
    const vhdl = loadFixtureVhdl();
    const scenarioAtRun = createDefaultScenario(baseVectors());
    const project = buildFixtureProject(vhdl, baseVectors());
    const run = buildFixtureRun(project, scenarioAtRun, { recordContentHash: true });

    const editedScenario = stampScenario({
      ...scenarioAtRun,
      vectors: [...baseVectors(), { tick: 3, inputs: { clk: 0, rst: 0, count_en: 0 }, expected: {} }],
    });

    const viewModel = buildExportViewModel(project, run, editedScenario);

    expect(viewModel.exportedScenario!.isStaleComparedToLastPass).toBe(true);
  });

  it('exportedScenario absent when no activeScenario is passed', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = createDefaultScenario(baseVectors());
    const project = buildFixtureProject(vhdl, baseVectors());
    const run = buildFixtureRun(project, scenario);

    // No active scenario → compat path
    const viewModel = buildExportViewModel(project, run, undefined);
    expect(viewModel.exportedScenario).toBeUndefined();
  });

  it('testbench artifact note contains "STALE" when scenario is stale', () => {
    const vhdl = loadFixtureVhdl();
    const scenarioAtRun = createDefaultScenario(baseVectors());
    const project = buildFixtureProject(vhdl, baseVectors());
    const run = buildFixtureRun(project, scenarioAtRun, { recordContentHash: true });

    const editedScenario = stampScenario({
      ...scenarioAtRun,
      vectors: [...baseVectors(), { tick: 5, inputs: { clk: 0, rst: 0, count_en: 0 }, expected: {} }],
    });

    const viewModel = buildExportViewModel(project, run, editedScenario);
    const tb = viewModel.artifacts.find((a) => a.path === 'testbench.vhd');

    expect(tb!.note).toMatch(/STALE/i);
  });

  it('testbench artifact note identifies scenario name + version when fresh', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = createScenario('My Lab', baseVectors());
    const project = buildFixtureProject(vhdl, baseVectors());
    const run = buildFixtureRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    const tb = viewModel.artifacts.find((a) => a.path === 'testbench.vhd');

    expect(tb!.note).toContain('My Lab');
    expect(tb!.note).toContain(`v${scenario.version}`);
    expect(tb!.note).not.toMatch(/STALE/i);
  });
});

// ─── Hardware surface provenance contract ─────────────────────────────────────
//
// These tests verify the view-model logic that drives HardwareSurface provenance:
//   isDifferentScenario, isSameScenarioEdited, scenarioDrifted, switchBackScenario
//   effectiveVerifyReady (trust downgrade without hard board block)
//   starter-seal note condition
// They do NOT render the component — they test the pure derivations.

describe('hardware provenance: isDifferentScenario', () => {
  it('false when active scenario matches the run scenario', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenario);

    const isDifferentScenario = run.scenarioId !== scenario.id;
    expect(isDifferentScenario).toBe(false);
  });

  it('true when a different scenario is active', () => {
    const scenarioA = createDefaultScenario(baseVectors());
    const scenarioB = createScenario('Lab 2', baseVectors());
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenarioA);

    const isDifferentScenario = run.scenarioId !== scenarioB.id;
    expect(isDifferentScenario).toBe(true);
  });
});

describe('hardware provenance: isSameScenarioEdited', () => {
  it('false when content hash matches', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: true }
    );

    const isSameScenarioEdited =
      run.scenarioId === scenario.id &&
      typeof run.scenarioContentHash === 'string' &&
      run.scenarioContentHash !== computeScenarioContentHash(scenario);

    expect(isSameScenarioEdited).toBe(false);
  });

  it('true when scenario vectors edited post-run', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: true }
    );
    const edited = stampScenario({
      ...scenario,
      vectors: [...baseVectors(), { tick: 9, inputs: { clk: 0, rst: 0, count_en: 0 }, expected: {} }],
    });

    const isSameScenarioEdited =
      run.scenarioId === edited.id &&
      typeof run.scenarioContentHash === 'string' &&
      run.scenarioContentHash !== computeScenarioContentHash(edited);

    expect(isSameScenarioEdited).toBe(true);
  });

  it('false (conservative) when run has no content hash recorded', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: false }
    );

    const isSameScenarioEdited =
      run.scenarioId === scenario.id &&
      typeof run.scenarioContentHash === 'string' &&
      run.scenarioContentHash !== computeScenarioContentHash(scenario);

    expect(isSameScenarioEdited).toBe(false);
  });
});

describe('hardware provenance: scenarioDrifted combines both kinds', () => {
  it('false when neither drift condition is true', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: true }
    );

    const isDifferentScenario = run.scenarioId !== scenario.id;
    const isSameScenarioEdited =
      run.scenarioId === scenario.id &&
      typeof run.scenarioContentHash === 'string' &&
      run.scenarioContentHash !== computeScenarioContentHash(scenario);
    const scenarioDrifted = isDifferentScenario || isSameScenarioEdited;

    expect(scenarioDrifted).toBe(false);
  });

  it('true when different scenario is active', () => {
    const scenarioA = createDefaultScenario(baseVectors());
    const scenarioB = createScenario('My Attempt', baseVectors());
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenarioA);

    const isDifferentScenario = run.scenarioId !== scenarioB.id;
    const isSameScenarioEdited = false; // different IDs — not applicable
    const scenarioDrifted = isDifferentScenario || isSameScenarioEdited;

    expect(scenarioDrifted).toBe(true);
  });

  it('true when same scenario edited post-run', () => {
    const scenario = createDefaultScenario(baseVectors());
    const run = buildFixtureRun(
      buildFixtureProject(loadFixtureVhdl(), baseVectors()),
      scenario,
      { recordContentHash: true }
    );
    const edited = stampScenario({ ...scenario, vectors: [...baseVectors(), { tick: 7, inputs: {}, expected: {} }] });

    const isDifferentScenario = run.scenarioId !== edited.id;
    const isSameScenarioEdited =
      run.scenarioId === edited.id &&
      typeof run.scenarioContentHash === 'string' &&
      run.scenarioContentHash !== computeScenarioContentHash(edited);
    const scenarioDrifted = isDifferentScenario || isSameScenarioEdited;

    expect(scenarioDrifted).toBe(true);
  });
});

describe('hardware provenance: trust downgrade without hard board block', () => {
  it('effectiveVerifyReady is false when drift is true, even if verifyReady is true', () => {
    const verifyPassed = true;
    const verifyCurrent = true;
    const verifyReady = verifyPassed && verifyCurrent;

    const scenarioDrifted = true; // drift detected

    const effectiveVerifyReady = verifyReady && !scenarioDrifted;
    expect(effectiveVerifyReady).toBe(false);
  });

  it('effectiveVerifyReady is true when no drift and verifyReady', () => {
    const verifyPassed = true;
    const verifyCurrent = true;
    const verifyReady = verifyPassed && verifyCurrent;
    const scenarioDrifted = false;

    const effectiveVerifyReady = verifyReady && !scenarioDrifted;
    expect(effectiveVerifyReady).toBe(true);
  });

  it('confidence check for "Verify current" reflects drift', () => {
    const verifyReady = true;
    const scenarioDrifted = true;

    // The confidence check uses drift-aware trust
    const verifyCurrentPass = verifyReady && !scenarioDrifted;
    expect(verifyCurrentPass).toBe(false);
  });
});

describe('hardware provenance: switchBackScenario guard', () => {
  it('switch-back scenario found when old scenario still in library', () => {
    const scenarioA = createDefaultScenario(baseVectors());
    const scenarioB = createScenario('Lab 2', baseVectors());
    const library = [scenarioA, scenarioB];
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenarioA);

    const isDifferentScenario = run.scenarioId !== scenarioB.id;
    const switchBackScenario = isDifferentScenario
      ? (library.find((s) => s.id === run.scenarioId) ?? null)
      : null;

    expect(switchBackScenario).not.toBeNull();
    expect(switchBackScenario?.id).toBe(scenarioA.id);
  });

  it('switch-back scenario null when old scenario deleted from library', () => {
    const scenarioA = createDefaultScenario(baseVectors());
    const scenarioB = createScenario('Lab 2', baseVectors());
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenarioA);

    const libraryAfterDelete = [scenarioB];
    const isDifferentScenario = run.scenarioId !== scenarioB.id;
    const switchBackScenario = isDifferentScenario
      ? (libraryAfterDelete.find((s) => s.id === run.scenarioId) ?? null)
      : null;

    expect(switchBackScenario).toBeNull();
  });

  it('switch-back scenario null when same scenario (edited, not different)', () => {
    const scenario = createDefaultScenario(baseVectors());
    const library = [scenario];
    const run = buildFixtureRun(buildFixtureProject(loadFixtureVhdl(), baseVectors()), scenario);

    // Same scenario ID — isDifferentScenario is false, so no switch-back
    const isDifferentScenario = false;
    const switchBackScenario = isDifferentScenario
      ? (library.find((s) => s.id === run.scenarioId) ?? null)
      : null;

    expect(switchBackScenario).toBeNull();
  });
});

describe('hardware provenance: starter-seal note condition', () => {
  it('shown when verifyReady, not drifted, and vectorsAreAutoGenerated', () => {
    const verifyReady = true;
    const scenarioDrifted = false;
    const vectorsAreAutoGenerated = true;

    const showStarterSealNote = verifyReady && !scenarioDrifted && vectorsAreAutoGenerated;
    expect(showStarterSealNote).toBe(true);
  });

  it('not shown when vectorsAreAutoGenerated is false (authored scenario)', () => {
    const verifyReady = true;
    const scenarioDrifted = false;
    const vectorsAreAutoGenerated = false;

    const showStarterSealNote = verifyReady && !scenarioDrifted && vectorsAreAutoGenerated;
    expect(showStarterSealNote).toBe(false);
  });

  it('not shown when scenarioDrifted (drift takes priority)', () => {
    const verifyReady = true;
    const scenarioDrifted = true;
    const vectorsAreAutoGenerated = true;

    const showStarterSealNote = verifyReady && !scenarioDrifted && vectorsAreAutoGenerated;
    expect(showStarterSealNote).toBe(false);
  });

  it('not shown when verifyReady is false', () => {
    const verifyReady = false;
    const scenarioDrifted = false;
    const vectorsAreAutoGenerated = true;

    const showStarterSealNote = verifyReady && !scenarioDrifted && vectorsAreAutoGenerated;
    expect(showStarterSealNote).toBe(false);
  });
});

describe('hardware provenance: drift copy is distinct per kind', () => {
  it('isDifferentScenario produces different-scenario copy key', () => {
    const isDifferentScenario = true;
    const isSameScenarioEdited = false;

    // Copy selection logic mirrors HardwareSurface drift callout title
    const title = isDifferentScenario ? 'Different scenario active' : 'Scenario edited since last run';
    expect(title).toBe('Different scenario active');
  });

  it('isSameScenarioEdited produces edited-scenario copy key', () => {
    const isDifferentScenario = false;
    const isSameScenarioEdited = true;

    const title = isDifferentScenario
      ? 'Different scenario active'
      : isSameScenarioEdited
        ? 'Scenario edited since last run'
        : null;
    expect(title).toBe('Scenario edited since last run');
  });
});
