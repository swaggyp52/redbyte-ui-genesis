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
import {
  normalizeVectorsForLiveIo,
  type ProjectIoRow,
  type RuntimeVerifyRun,
} from '../apps/ide/projectRuntime';
import {
  buildExportViewModel,
  type ExportedScenarioProvenance,
} from '../apps/ide/viewmodels/buildExportViewModel';
import {
  computeExecutionStimulusHash,
  computeScenarioContentHash,
  createDefaultScenario,
  materializeScenarioVectors,
  stampScenario,
  type VerifyScenario,
} from '../apps/ide/verifyScenario';
import {
  detectVerifyClockPolicy,
  materializeVectorsForClockPolicy,
  resolveEffectiveVerifyClockPolicy,
  resolveVerifyTick0Meaning,
} from '../apps/ide/verifyClockPolicy';
import { buildVerifyReport, buildVerifyWaveSamples } from '../apps/ide/verifyReport';
import { parseVhdl } from '../import/vhdlImport';
import { parsedHdlToCircuit } from '../import/hdlToCircuit';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';
import {
  buildVerifyCircuitEvidenceHash,
  buildVerifyMappingEvidenceHash,
} from '../apps/ide/verifyProjectHash';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_DIR = join(
  process.cwd(),
  'packages/rb-apps/src/fixtures/import/03-vivado-ish-clocked'
);
const GENERATED_AT_ISO = '2026-03-19T00:00:00.000Z';
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
  options: {
    recordContentHash?: boolean;
    clockPolicy?: RuntimeVerifyRun['clockPolicy'];
  } = {}
): RuntimeVerifyRun {
  const scheduleContract = deriveVerifySchedule(project.circuit, project.ioMapping, project.hdl);
  const ioRows: ProjectIoRow[] = [
    ...(project.ioMapping?.inputs ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: 'in' as const,
      pin: row.pin,
      nodeId: row.nodeId ?? row.id,
      port: 'out',
      required: true,
    })),
    ...(project.ioMapping?.outputs ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: 'out' as const,
      pin: row.pin,
      nodeId: row.nodeId ?? row.id,
      port: 'in',
      required: true,
    })),
  ];
  const detectedClockPolicy =
    detectVerifyClockPolicy({ circuit: project.circuit, ioRows, scheduleContract }) ?? undefined;
  const clockPolicy = options.clockPolicy
    ? {
        ...options.clockPolicy,
        runCycles: Math.max(
          1,
          materializeScenarioVectors(scenario).length,
          options.clockPolicy.runCycles
        ),
      }
    : resolveEffectiveVerifyClockPolicy({
        savedPolicy: scenario.sequentialPolicy,
        detectedPolicy: detectedClockPolicy,
        overrideMode:
          scenario.sequentialPolicy?.overrideMode ??
          detectedClockPolicy?.overrideMode ??
          'manual-pulses',
        requestedRunCycles:
          scenario.sequentialPolicy?.runCycles ?? detectedClockPolicy?.runCycles ?? 1,
        totalVectorCount: materializeScenarioVectors(scenario).length,
      }) ?? undefined;
  const authoredVectors = normalizeVectorsForLiveIo(
    materializeScenarioVectors(scenario),
    ioRows,
    clockPolicy
  );
  const executionVectors = materializeVectorsForClockPolicy({
    vectors: authoredVectors,
    ioRows,
    policy: clockPolicy,
  });
  const rows = executionVectors.flatMap((vector) =>
    Object.entries(vector.expected ?? {}).map(([signal, rawExpected]) => {
      const expected = normalizeBitSymbol(rawExpected);
      return { tick: vector.tick, signal, expected, actual: expected };
    })
  );
  const verifyVectors = executionVectors.map((vector, index) => ({
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
    scenarioStimulusHash: computeExecutionStimulusHash(authoredVectors, clockPolicy),
    mappingEvidenceHash: buildVerifyMappingEvidenceHash(project.ioMapping),
    status: 'pass',
    deterministicHash: report.deterministicHash,
    reportHash: report.reportHash,
    firstFailingTick: report.firstFailingTick,
    generatedAtIso: report.generatedAtIso,
    schedule: scheduleContract.schedule,
    scheduleContract,
    clockPolicy,
    meta: {
      circuitKind: scheduleContract.schedule === 'clocked_macro' ? 'sequential' : 'combinational',
      clockingProtocol: scheduleContract.schedule === 'clocked_macro' ? 'clocked_macro' : null,
      samplePoint: scheduleContract.samplePoint,
      tick0Meaning: resolveVerifyTick0Meaning({
        structuralTick0Meaning: scheduleContract.tick0Meaning,
        vectors: authoredVectors,
        ioRows,
        policy: clockPolicy,
      }),
      clockSignalName: scheduleContract.clockSignalName ?? null,
    },
    report,
    waveform: buildVerifyWaveSamples(report),
    evidence: {
      circuitHash: buildVerifyCircuitEvidenceHash(project.circuit),
      ioRows,
      vectors: report.vectors,
      normalizationMap: [],
      preflight: [],
      failures: [],
    },
  };
}

function readExpectedIo(viewModel: ReturnType<typeof buildExportViewModel>) {
  return JSON.parse(
    viewModel.artifacts.find((artifact) => artifact.path === 'EXPECTED_IO.json')?.content ?? '{}'
  ) as {
    source?: string;
    generatedAtIso?: string;
    verifyHash?: string;
    verifyReportHash?: string;
    vectorsCount?: number;
    signals?: Array<{ logicalSignalId?: string; values?: Array<{ tick: number; expected: string }> }>;
  };
}

function expectRuntimeEvidenceExcluded(
  viewModel: ReturnType<typeof buildExportViewModel>,
  project: RBProject,
  activeScenario?: VerifyScenario,
) {
  const expectedIo = readExpectedIo(viewModel);
  expect(expectedIo.source).toBe('project-vectors');
  expect(expectedIo.verifyHash).toBeUndefined();
  expect(expectedIo.verifyReportHash).toBeUndefined();
  expect(expectedIo.generatedAtIso).toBe(project.updatedAt);
  const testbench = viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd');
  expect(testbench?.note).toMatch(/STALE/i);
  if (activeScenario) {
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(true);
  }
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

  it('exports manual/custom scenario clocks as authored testbench stimulus', () => {
    const vhdl = loadFixtureVhdl();
    const vectors = buildScenarioVectors();
    const project = buildFixtureProject(vhdl, buildStaleProjectVectors());
    const scenario: VerifyScenario = {
      ...buildFixtureScenario(vectors),
      sequentialPolicy: {
        overrideMode: 'manual-pulses',
        runCycles: 8,
        activeEdge: 'rising',
        resetBehavior: 'custom',
        sourceType: 'manual',
        executionModel: 'manual',
        signalId: 'clk',
        signalLabel: 'clk',
        resetSignalName: 'rst',
        startLevel: 0,
      },
    };
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    const content =
      viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';
    const stimulus = content.split('stim: process')[1] ?? '';

    expect(content).toContain('-- sequence=authored-vectors');
    expect(content).not.toContain('clock_gen: process');
    expect(content).not.toContain('constant CLK_HALF_PERIOD');
    expect(stimulus).toContain("clk <= '0';");
    expect(stimulus).toContain("clk <= '1';");
    expect(stimulus).not.toContain('wait until rising_edge');
  });

  it('uses a current runtime manual policy when the scenario has no explicit clock policy', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, buildStaleProjectVectors());
    project.ioMapping!.inputs[0] = {
      ...project.ioMapping!.inputs[0],
      pin: 'SW2',
    };
    const run = buildFixtureRuntimeVerifyRun(project, scenario, {
      recordContentHash: true,
      clockPolicy: {
        signalId: 'clk',
        signalLabel: 'clk',
        sourceType: 'manual',
        executionModel: 'manual',
        overrideMode: 'manual-pulses',
        autoRunEnabled: false,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 8,
        resetSignalName: 'rst',
        resetBehavior: 'custom',
      },
    });

    const viewModel = buildExportViewModel(project, run, scenario);
    const content =
      viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';

    expect(content).toContain('-- sequence=authored-vectors');
    expect(content).not.toContain('clock_gen: process');
    expect(content).not.toContain('wait until rising_edge');
    expect(content).toContain("SW(2) <= '1';");
  });

  it('recomputes EXPECTED_IO from current vectors and policy after a prior PASS becomes stale', () => {
    const vhdl = loadFixtureVhdl();
    const scenarioAtRun = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, buildStaleProjectVectors());
    const run = buildFixtureRuntimeVerifyRun(project, scenarioAtRun, {
      recordContentHash: true,
      clockPolicy: {
        signalId: 'clk',
        signalLabel: 'clk',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        overrideMode: 'auto',
        autoRunEnabled: true,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 8,
        resetSignalName: 'rst',
        resetBehavior: 'auto-sequence',
      },
    });
    const flatLowVectors: TestVector[] = [
      { tick: 0, inputs: { clk: 0, rst: 0, count_en: 1 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
      { tick: 1, inputs: { clk: 0, rst: 0, count_en: 1 }, expected: { q0: 0, q1: 0, q2: 0, q3: 0 } },
    ];
    const editedScenario = stampScenario({
      ...scenarioAtRun,
      vectors: flatLowVectors,
      sequentialPolicy: {
        overrideMode: 'manual-pulses',
        runCycles: 2,
        activeEdge: 'rising',
        resetBehavior: 'custom',
        sourceType: 'manual',
        executionModel: 'manual',
        signalId: 'clk',
        signalLabel: 'clk',
        resetSignalName: 'rst',
        startLevel: 0,
      },
    });

    const viewModel = buildExportViewModel(project, run, editedScenario);
    const testbench =
      viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';
    const expectedIo = JSON.parse(
      viewModel.artifacts.find((artifact) => artifact.path === 'EXPECTED_IO.json')?.content ?? '{}'
    ) as {
      source?: string;
      verifyHash?: string;
      verifyReportHash?: string;
      vectorsCount?: number;
      signals?: Array<{ logicalSignalId?: string; values?: Array<{ tick: number; expected: string }> }>;
    };
    const q0 = expectedIo.signals?.find((signal) => signal.logicalSignalId === 'q0');

    expect(testbench).toContain('-- sequence=authored-vectors');
    expect(testbench).not.toContain('clock_gen: process');
    expect(expectedIo.source).toBe('project-vectors');
    expect(expectedIo.verifyHash).toBeUndefined();
    expect(expectedIo.verifyReportHash).toBeUndefined();
    expect(expectedIo.vectorsCount).toBe(2);
    expect(q0?.values).toEqual([
      { tick: 0, expected: '0' },
      { tick: 1, expected: '0' },
    ]);
  });

  it('injects Verify rows and provenance only for exact current scenario, policy, vectors, and circuit', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    const expectedIo = readExpectedIo(viewModel);

    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.verifyHash).toBe(run.deterministicHash);
    expect(expectedIo.verifyReportHash).toBe(run.reportHash);
    expect(expectedIo.generatedAtIso).toBe(run.generatedAtIso);
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note)
      .toContain('verified PASS');
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
  });

  it.each([
    {
      label: 'poisoned schedule contract',
      poison: (run: RuntimeVerifyRun) => {
        run.scheduleContract = {
          ...run.scheduleContract!,
          schedule: 'combinational',
          assertionMask: { q0: true, q1: false, q2: false, q3: false },
        };
      },
    },
    {
      label: 'poisoned legacy schedule',
      poison: (run: RuntimeVerifyRun) => {
        run.scheduleContract = undefined;
        run.schedule = 'combinational';
      },
    },
  ])('derives testbench schedule from the current project despite a $label', ({ poison }) => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const exactRun = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });
    const baseline = buildExportViewModel(project, exactRun, scenario);
    const baselineTestbench =
      baseline.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';
    const poisonedRun = structuredClone(exactRun);
    poison(poisonedRun);

    const poisoned = buildExportViewModel(project, poisonedRun, scenario);
    const poisonedTestbench =
      poisoned.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';

    expectRuntimeEvidenceExcluded(poisoned, project, scenario);
    expect(poisonedTestbench).toBe(baselineTestbench);
    expect(poisonedTestbench).toContain('-- schedule=clocked_macro');
    expect(poisonedTestbench).toContain('clock_gen: process');
    expect(poisonedTestbench).toMatch(/assert\s+LED\(1\)\s*=/i);
  });

  it('keeps a saved Auto policy with nondefault runCycles exact-current', () => {
    const vhdl = loadFixtureVhdl();
    const autoVectors = buildScenarioVectors().map((vector) => ({
      ...vector,
      // Clock and reset are intentionally omitted: Auto owns the rising edge
      // and inserts reset only when the student did not author it.
      inputs: { count_en: vector.inputs.count_en },
    }));
    const scenario: VerifyScenario = {
      ...buildFixtureScenario(autoVectors),
      sequentialPolicy: {
        overrideMode: 'auto',
        runCycles: 12,
        activeEdge: 'rising',
        resetBehavior: 'auto-sequence',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        signalId: 'clk',
        signalLabel: 'clk',
        resetSignalName: 'rst',
        startLevel: 0,
      },
    };
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    const expectedIo = readExpectedIo(viewModel);
    const testbench =
      viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';
    const q0 = expectedIo.signals?.find((signal) => signal.logicalSignalId === 'q0');

    expect(run.meta.tick0Meaning).toBeNull();
    expect(run.report.vectors).toHaveLength(12);
    expect(run.report.vectors.map((vector) => vector.inputs.clk)).toEqual(Array(12).fill(1));
    expect(run.report.vectors.map((vector) => vector.inputs.rst)).toEqual([
      1,
      ...Array(11).fill(0),
    ]);
    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.vectorsCount).toBe(12);
    // Expanded cycles without an authored oracle remain stimulus-only.
    expect(q0?.values?.map((value) => value.tick)).toEqual([0, 1, 2]);
    expect(testbench.match(/wait until rising_edge\(clk\);/g)).toHaveLength(12);
    expect(Array.from(testbench.matchAll(/SW\(0\)\s*<=\s*'([01])';/g), (match) => match[1]).slice(0, 3))
      .toEqual(['1', '0', '0']);
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
  });

  it('keeps partial-input label aliases exact-current through shared live-IO normalization', () => {
    const vhdl = loadFixtureVhdl();
    const project = buildFixtureProject(vhdl, []);
    project.ioMapping = {
      ...project.ioMapping!,
      inputs: project.ioMapping!.inputs.map((entry) =>
        entry.id === 'count_en' ? { ...entry, label: 'Enable switch' } : entry
      ),
    };
    const scenario = buildFixtureScenario([
      {
        tick: 0,
        inputs: { 'Enable switch': 1 },
        expected: { q0: 0 },
      },
    ]);
    project.vectors = scenario.vectors;
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);
    const testbench =
      viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';

    expect(readExpectedIo(viewModel).source).toBe('verify-run');
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
    expect(run.report.vectors[0]?.inputs).toMatchObject({ count_en: 1, clk: 1, rst: 1 });
    expect(testbench).toMatch(/SW\(1\)\s*<=\s*'1';/i);
    expect(testbench).not.toContain('Enable switch <=');
  });

  it('rebinds saved Auto intent to live signal identities without emitting undeclared VHDL names', () => {
    const vhdl = loadFixtureVhdl();
    const scenario: VerifyScenario = {
      ...buildFixtureScenario(buildScenarioVectors()),
      sequentialPolicy: {
        overrideMode: 'auto',
        runCycles: 12,
        activeEdge: 'rising',
        resetBehavior: 'custom',
        sourceType: 'inferred',
        executionModel: 'external-input-auto-toggle',
        signalId: 'saved_clk',
        signalLabel: 'Saved clock',
        resetSignalName: 'saved_reset',
        startLevel: 1,
      },
    };
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const rerun = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    expect(rerun.clockPolicy).toMatchObject({
      overrideMode: 'auto',
      runCycles: 12,
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      signalId: 'clk',
      signalLabel: 'clk',
      resetSignalName: 'rst',
      resetBehavior: 'custom',
      startLevel: 1,
    });
    const viewModel = buildExportViewModel(project, rerun, scenario);
    const expectedIo = readExpectedIo(viewModel);
    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.verifyHash).toBe(rerun.deterministicHash);
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note)
      .toContain('verified PASS');
    const testbench =
      viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';
    expect(testbench).not.toContain('saved_clk');
    expect(testbench).not.toContain('saved_reset');
    expect(testbench).toContain('clock_gen: process');
  });

  it('uses vectors.length as the effective runCycles floor for exact-current evidence', () => {
    const vhdl = loadFixtureVhdl();
    const vectors: TestVector[] = Array.from({ length: 10 }, (_, tick) => ({
      tick,
      inputs: { clk: tick % 2, rst: 0, count_en: 0 },
      expected: { q0: 0, q1: 0, q2: 0, q3: 0 },
    }));
    const scenario: VerifyScenario = {
      ...buildFixtureScenario(vectors),
      sequentialPolicy: {
        overrideMode: 'manual-pulses',
        runCycles: 2,
        activeEdge: 'rising',
        resetBehavior: 'custom',
        sourceType: 'manual',
        executionModel: 'manual',
        signalId: 'clk',
        signalLabel: 'clk',
        resetSignalName: 'rst',
        startLevel: 0,
      },
    };
    const project = buildFixtureProject(vhdl, vectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });

    const viewModel = buildExportViewModel(project, run, scenario);

    expect(readExpectedIo(viewModel).source).toBe('verify-run');
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
  });

  it('rejects runtime artifacts after a policy-only edit even when content metadata is forged current', () => {
    const vhdl = loadFixtureVhdl();
    const scenarioAtRun: VerifyScenario = {
      ...buildFixtureScenario(buildScenarioVectors()),
      sequentialPolicy: {
        overrideMode: 'manual-pulses',
        runCycles: 8,
        activeEdge: 'rising',
        resetBehavior: 'custom',
        sourceType: 'manual',
        executionModel: 'manual',
        signalId: 'clk',
        signalLabel: 'clk',
        resetSignalName: 'rst',
        startLevel: 0,
      },
    };
    const project = buildFixtureProject(vhdl, scenarioAtRun.vectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenarioAtRun, { recordContentHash: true });
    const editedScenario: VerifyScenario = {
      ...scenarioAtRun,
      sequentialPolicy: { ...scenarioAtRun.sequentialPolicy!, startLevel: 1 },
    };
    run.scenarioContentHash = computeScenarioContentHash(editedScenario);
    run.scheduleContract = {
      ...run.scheduleContract!,
      schedule: 'combinational',
      assertionMask: { q0: true, q1: false, q2: false, q3: false },
    };

    const viewModel = buildExportViewModel(project, run, editedScenario);

    expectRuntimeEvidenceExcluded(viewModel, project, editedScenario);
    const testbench = viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';
    expect(testbench).toContain('-- sequence=authored-vectors');
    expect(testbench).toContain("signal clk : std_logic := '1'");
    expect(testbench).toMatch(/assert\s+LED\(1\)\s*=/i);
  });

  it('rejects a run owned by a different scenario even when hashes otherwise match', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });
    run.scenarioId = 'different-scenario';

    const viewModel = buildExportViewModel(project, run, scenario);

    expectRuntimeEvidenceExcluded(viewModel, project, scenario);
  });

  it('rejects a run whose stimulus includes custom vectors outside the exported scenario', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });
    const customVector: TestVector = {
      tick: 99,
      inputs: { clk: 1, rst: 0, count_en: 1 },
      expected: { q0: 1 },
    };
    run.scenarioStimulusHash = computeExecutionStimulusHash(
      [...scenario.vectors, customVector],
      run.clockPolicy,
    );

    const viewModel = buildExportViewModel(project, run, scenario);

    expectRuntimeEvidenceExcluded(viewModel, project, scenario);
  });

  it('keeps runtime evidence current after a layout-only Design move', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const run = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });
    const editedProject: RBProject = {
      ...project,
      circuit: {
        ...project.circuit,
        nodes: project.circuit.nodes.map((node, index) =>
          index === 0
            ? {
                ...node,
                position: {
                  x: (node.position?.x ?? 0) + 16,
                  y: node.position?.y ?? 0,
                },
              }
            : node
        ),
      },
    };

    const viewModel = buildExportViewModel(editedProject, run, scenario);

    const expectedIo = readExpectedIo(viewModel);
    expect(expectedIo.source).toBe('verify-run');
    expect(expectedIo.verifyHash).toBe(run.deterministicHash);
    expect(viewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
    expect(viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note)
      .toContain('verified PASS');
  });

  it.each([
    {
      label: 'non-clock input pin',
      editMapping: (mapping: IoMapping): IoMapping => ({
        ...mapping,
        inputs: mapping.inputs.map((entry) =>
          entry.id === 'rst' ? { ...entry, pin: 'SW2' } : entry
        ),
      }),
    },
    {
      label: 'output pin',
      editMapping: (mapping: IoMapping): IoMapping => ({
        ...mapping,
        outputs: mapping.outputs.map((entry) =>
          entry.id === 'q0' ? { ...entry, pin: 'LD4' } : entry
        ),
      }),
    },
  ])(
    'rejects stale run artifacts after a $label edit and restores them only after rerun',
    ({ editMapping }) => {
      const vhdl = loadFixtureVhdl();
      const scenario = buildFixtureScenario(buildScenarioVectors());
      const projectAtRun = buildFixtureProject(vhdl, scenario.vectors);
      const runBeforeMapEdit = buildFixtureRuntimeVerifyRun(projectAtRun, scenario, {
        recordContentHash: true,
      });
      const editedProject: RBProject = {
        ...projectAtRun,
        updatedAt: '2026-03-18T00:05:00.000Z',
        ioMapping: editMapping(structuredClone(projectAtRun.ioMapping!)),
      };

      // Poison presentation-only run fields so the assertions prove that a
      // mapping-stale run cannot leak schedule, mask, rows, or provenance.
      runBeforeMapEdit.scheduleContract = {
        ...runBeforeMapEdit.scheduleContract!,
        schedule: 'combinational',
        assertionMask: { q0: true, q1: false, q2: false, q3: false },
      };
      runBeforeMapEdit.report = {
        ...runBeforeMapEdit.report,
        rows: runBeforeMapEdit.report.rows.map((row, index) =>
          index === 0 ? { ...row, expected: '1', actual: '1' } : row
        ),
      };

      const staleViewModel = buildExportViewModel(editedProject, runBeforeMapEdit, scenario);
      expectRuntimeEvidenceExcluded(staleViewModel, editedProject, scenario);
      const staleExpectedIo = readExpectedIo(staleViewModel);
      expect(
        staleExpectedIo.signals?.find((signal) => signal.logicalSignalId === 'q0')?.values?.[0]
      ).toEqual({ tick: 0, expected: '0' });
      const staleTestbench =
        staleViewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? '';
      expect(staleTestbench).toContain('-- schedule=clocked_macro');
      expect(staleTestbench).toMatch(/assert\s+LED\(1\)\s*=/i);

      const rerun = buildFixtureRuntimeVerifyRun(editedProject, scenario, {
        recordContentHash: true,
      });
      const restoredViewModel = buildExportViewModel(editedProject, rerun, scenario);
      const restoredExpectedIo = readExpectedIo(restoredViewModel);
      expect(restoredExpectedIo.source).toBe('verify-run');
      expect(restoredExpectedIo.verifyHash).toBe(rerun.deterministicHash);
      expect(restoredExpectedIo.verifyReportHash).toBe(rerun.reportHash);
      expect(restoredExpectedIo.generatedAtIso).toBe(rerun.generatedAtIso);
      expect(restoredViewModel.exportedScenario?.isStaleComparedToLastPass).toBe(false);
      expect(
        restoredViewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note
      ).toContain('verified PASS');
    }
  );

  it('downgrades legacy runs that lack exact stimulus, circuit, or mapping evidence', () => {
    const vhdl = loadFixtureVhdl();
    const scenario = buildFixtureScenario(buildScenarioVectors());
    const project = buildFixtureProject(vhdl, scenario.vectors);
    const exactRun = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });
    const legacyRun: RuntimeVerifyRun = {
      ...exactRun,
      scenarioStimulusHash: undefined,
      mappingEvidenceHash: undefined,
      evidence: undefined,
    };

    const viewModel = buildExportViewModel(project, legacyRun, scenario);

    expectRuntimeEvidenceExcluded(viewModel, project, scenario);
  });

  it('never injects compatibility-path run evidence after an expected-only project-vector edit', () => {
    const vhdl = loadFixtureVhdl();
    const vectors = buildScenarioVectors();
    const projectAtRun = buildFixtureProject(vhdl, vectors);
    const scenarioAtRun = buildFixtureScenario(vectors);
    const run = buildFixtureRuntimeVerifyRun(projectAtRun, scenarioAtRun);
    const editedProject: RBProject = {
      ...projectAtRun,
      vectors: vectors.map((vector, index) =>
        index === 0
          ? { ...vector, expected: { ...(vector.expected ?? {}), q0: 1 } }
          : vector
      ),
    };

    const viewModel = buildExportViewModel(editedProject, run, undefined);

    expectRuntimeEvidenceExcluded(viewModel, editedProject);
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

  it('keeps scenario-less testbench bytes independent of stale or legacy run presence', () => {
    const vhdl = loadFixtureVhdl();
    const vectors = buildScenarioVectors();
    const project = buildFixtureProject(vhdl, vectors);
    const scenario = buildFixtureScenario(vectors);
    const exactRun = buildFixtureRuntimeVerifyRun(project, scenario, { recordContentHash: true });
    const staleRun: RuntimeVerifyRun = {
      ...structuredClone(exactRun),
      scenarioId: 'wrong-scenario',
      schedule: 'combinational',
    };
    const legacyRun: RuntimeVerifyRun = {
      ...structuredClone(exactRun),
      scenarioContentHash: undefined,
      scenarioStimulusHash: undefined,
      mappingEvidenceHash: undefined,
      scheduleContract: undefined,
      schedule: 'combinational',
      evidence: undefined,
    };
    const views = [
      buildExportViewModel(project, undefined, undefined),
      buildExportViewModel(project, staleRun, undefined),
      buildExportViewModel(project, legacyRun, undefined),
    ];
    const testbenches = views.map(
      (viewModel) =>
        viewModel.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.content ?? ''
    );

    expect(testbenches[0]).not.toBe('');
    expect(testbenches[1]).toBe(testbenches[0]);
    expect(testbenches[2]).toBe(testbenches[0]);
    for (const [index, viewModel] of views.entries()) {
      const expectedIo = readExpectedIo(viewModel);
      expect(expectedIo.source).toBe('project-vectors');
      expect(expectedIo.verifyHash).toBeUndefined();
      expect(expectedIo.verifyReportHash).toBeUndefined();
      const expectedCycleCount = Number(expectedIo.vectorsCount ?? 0);
      expect(expectedCycleCount).toBeGreaterThan(0);
      expect(testbenches[index].match(/wait until rising_edge\(clk\);/g) ?? [])
        .toHaveLength(expectedCycleCount);
    }
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
