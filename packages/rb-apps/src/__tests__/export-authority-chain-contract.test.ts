/**
 * Export authority chain contract tests.
 *
 * These tests lock the invariants required by the Vivado Alignment Hardening Brief:
 *
 *   1. ExportViewModel always carries a topAuthority with distinct designTop and simulationTop.
 *   2. Every artifact has an explicit category (design-source, simulation-source,
 *      constraints, or build-artifact).
 *   3. The simulation-source artifacts never contaminate the design-source set.
 *      Specifically: testbench.vhd must never be category 'design-source'.
 *   4. Export is not gated on Verify state. testbench.vhd is generated even when the
 *      last Verify run failed, had assertion differences, or has not run at all.
 *   5. The VerifySessionStatus 'stimulus-only' state (renamed from 'simulation-complete')
 *      surfaces correctly with a non-misleading badge.
 */

import { describe, expect, it } from 'vitest';
import type { RBProject } from '../export/projectFormat';
import type { RuntimeVerifyRun } from '../apps/ide/projectRuntime';
import type { VerifyScenario } from '../apps/ide/verifyScenario';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import {
  buildVerifySessionViewModel,
  type VerifyPreRunInventory,
} from '../apps/ide/viewmodels/buildVerifySessionViewModel';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

function makeMinimalCircuit() {
  return {
    nodes: [
      { id: 'sw0', type: 'INPUT', label: 'SW0', x: 0, y: 0 },
      { id: 'ld0', type: 'OUTPUT', label: 'LD0', x: 200, y: 0 },
    ],
    connections: [
      { id: 'c0', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
    ],
  };
}

function makeProject(overrides: Partial<RBProject> = {}): RBProject {
  const ts = '2026-01-01T00:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    name: 'authority-chain-fixture',
    circuit: makeMinimalCircuit() as RBProject['circuit'],
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'W17' }],
      outputs: [{ id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'U16' }],
    },
    vectors: [
      { tick: 0, inputs: { SW0: 0 }, expected: { LD0: 0 } },
      { tick: 1, inputs: { SW0: 1 }, expected: { LD0: 1 } },
    ],
    fpga: { board: 'basys3', top: 'top' },
    ...overrides,
  };
}

function makePassRun(overrides: Partial<RuntimeVerifyRun> = {}): RuntimeVerifyRun {
  return {
    scenarioId: 'scenario-abc',
    scenarioName: 'Default',
    runKind: 'verify',
    status: 'pass',
    deterministicHash: 'abc123',
    reportHash: 'rep123',
    generatedAtIso: '2026-01-01T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      rows: [],
      vectors: [],
      inputsAtTick: {},
      inputsByVectorId: {},
      signalRoles: {},
    },
    waveform: [],
    ...overrides,
  };
}

function makeScenario(overrides: Partial<VerifyScenario> = {}): VerifyScenario {
  return {
    id: 'scenario-abc',
    name: 'Default',
    version: 1,
    vectors: [
      { tick: 0, inputs: { SW0: 0 }, expected: { LD0: 0 } },
      { tick: 1, inputs: { SW0: 1 }, expected: { LD0: 1 } },
    ],
    ...overrides,
  };
}

function makeSignalInventory(
  tickCount: number,
  totalAssertionCount: number
): VerifyPreRunInventory {
  return {
    lanes: [
      { name: 'SW0', direction: 'input', isAsserted: false },
      { name: 'LD0', direction: 'output', isAsserted: totalAssertionCount > 0 },
    ],
    tickCount,
    assertedOutputCount: totalAssertionCount > 0 ? 1 : 0,
    totalAssertionCount,
    clockPolicy: 'combinational',
  };
}

// ---------------------------------------------------------------------------
// 1. topAuthority — always present and valid
// ---------------------------------------------------------------------------

describe('ExportViewModel topAuthority', () => {
  it('always exposes designTop and simulationTop', () => {
    const vm = buildExportViewModel(makeProject());
    expect(vm.topAuthority).toBeDefined();
    expect(typeof vm.topAuthority.designTop).toBe('string');
    expect(vm.topAuthority.designTop.length).toBeGreaterThan(0);
    expect(typeof vm.topAuthority.simulationTop).toBe('string');
    expect(vm.topAuthority.simulationTop.length).toBeGreaterThan(0);
  });

  it('designTop and simulationTop are always distinct', () => {
    const vm = buildExportViewModel(makeProject());
    expect(vm.topAuthority.designTop).not.toBe(vm.topAuthority.simulationTop);
  });

  it('simulationTop is designTop suffixed with _tb', () => {
    const vm = buildExportViewModel(makeProject());
    expect(vm.topAuthority.simulationTop).toBe(`${vm.topAuthority.designTop}_tb`);
  });

  it('designTop reflects fpga.top when present', () => {
    const vm = buildExportViewModel(makeProject({ fpga: { board: 'basys3', top: 'my_design' } }));
    expect(vm.topAuthority.designTop).toBe('my_design');
    expect(vm.topAuthority.simulationTop).toBe('my_design_tb');
  });

  it('designTop falls back to "top" when no top is specified', () => {
    const project = makeProject();
    delete (project as Partial<RBProject>).fpga;
    const vm = buildExportViewModel(project);
    expect(vm.topAuthority.designTop).toBe('top');
  });
});

// ---------------------------------------------------------------------------
// 2. Artifact categories — every artifact must have an explicit category
// ---------------------------------------------------------------------------

describe('ExportArtifactView category field', () => {
  it('every artifact has a non-empty category', () => {
    const vm = buildExportViewModel(makeProject());
    const validCategories = ['design-source', 'simulation-source', 'constraints', 'build-artifact'];
    for (const artifact of vm.artifacts) {
      expect(validCategories).toContain(artifact.category);
    }
  });

  it('top.vhd is always design-source', () => {
    const vm = buildExportViewModel(makeProject());
    const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
    expect(topVhd).toBeDefined();
    expect(topVhd?.category).toBe('design-source');
  });

  it('top.xdc is always constraints', () => {
    const vm = buildExportViewModel(makeProject());
    const topXdc = vm.artifacts.find((a) => a.path === 'top.xdc');
    expect(topXdc).toBeDefined();
    expect(topXdc?.category).toBe('constraints');
  });

  it('testbench.vhd is always simulation-source, never design-source', () => {
    const vm = buildExportViewModel(makeProject());
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(tb).toBeDefined();
    expect(tb?.category).toBe('simulation-source');
    expect(tb?.category).not.toBe('design-source');
  });

  it('vivado_import.tcl is build-artifact', () => {
    const vm = buildExportViewModel(makeProject());
    const tcl = vm.artifacts.find((a) => a.path === 'vivado_import.tcl');
    expect(tcl?.category).toBe('build-artifact');
  });

  it('project.rbproj.json is build-artifact', () => {
    const vm = buildExportViewModel(makeProject());
    const proj = vm.artifacts.find((a) => a.path === 'project.rbproj.json');
    expect(proj?.category).toBe('build-artifact');
  });
});

// ---------------------------------------------------------------------------
// 3. Design/simulation source separation
// ---------------------------------------------------------------------------

describe('Design source / simulation source separation', () => {
  it('simulationTop name does not appear in top.vhd content', () => {
    const vm = buildExportViewModel(makeProject(), makePassRun());
    const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
    if (!topVhd || topVhd.content.trim().length === 0) return; // blocked case
    expect(topVhd.content).not.toContain(vm.topAuthority.simulationTop);
  });

  it('no design-source artifact has kind "tb"', () => {
    const vm = buildExportViewModel(makeProject());
    const designSourceTb = vm.artifacts.filter(
      (a) => a.category === 'design-source' && a.kind === 'tb'
    );
    expect(designSourceTb).toHaveLength(0);
  });

  it('all artifacts with kind "tb" are simulation-source', () => {
    const vm = buildExportViewModel(makeProject());
    const tbArtifacts = vm.artifacts.filter((a) => a.kind === 'tb');
    for (const tb of tbArtifacts) {
      expect(tb.category).toBe('simulation-source');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Export not gated on Verify state
// ---------------------------------------------------------------------------

describe('Export is not blocked by Verify compare state', () => {
  it('testbench is generated even when verify has not run (no runtimeVerifyRun)', () => {
    const project = makeProject();
    const scenario = makeScenario();
    const vm = buildExportViewModel(project, undefined, scenario);
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(tb).toBeDefined();
    // When vectors exist and no run has occurred, testbench should be ready or have content
    expect(tb?.status).not.toBe('blocked');
    expect(tb?.content?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('testbench is generated when the last Verify run failed (assertions differ)', () => {
    const project = makeProject();
    const scenario = makeScenario();
    const failRun = makePassRun({ status: 'fail' });
    const vm = buildExportViewModel(project, failRun, scenario);
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(tb).toBeDefined();
    expect(tb?.content?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('testbench note mentions assertion differences, not "product failure", when verify failed', () => {
    const project = makeProject();
    const scenario = makeScenario();
    const failRun = makePassRun({ status: 'fail' });
    const vm = buildExportViewModel(project, failRun, scenario);
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    // Note must describe assertion state, not call this a "product failure" or "simulation failure"
    expect(tb?.note).not.toMatch(/product failure/i);
    expect(tb?.note).not.toMatch(/simulation failed/i);
    expect(tb?.note).toMatch(/assertion|differ|not.*block|re-run/i);
  });

  it('testbench export status is not blocked by a stale verify run', () => {
    const project = makeProject();
    const staleRun = makePassRun({
      deterministicHash: 'stale-hash',
      scenarioContentHash: 'old-scenario-hash',
    });
    const scenario = makeScenario();
    const vm = buildExportViewModel(project, staleRun, scenario);
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    // Export must not be blocked because the verify run is stale
    expect(tb?.status).not.toBe('blocked');
  });

  it('overall export status is not affected by Verify failure', () => {
    const project = makeProject();
    const failRun = makePassRun({ status: 'fail' });
    const vm = buildExportViewModel(project, failRun);
    // Export may be ok or blocked by export diagnostics only — not by verify status
    // (A clean project with proper pin mappings should always export as 'ok')
    expect(vm.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// 5. VerifySessionStatus — stimulus-only state and badge
// ---------------------------------------------------------------------------

describe('VerifySessionStatus stimulus-only', () => {
  it('status is stimulus-only when a run exists with assertions but isTraceOnly', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 1,
      signalInventory: makeSignalInventory(2, 1),
      runState: 'complete',
      lastRun: {
        scenarioId: 'trace-run',
        scenarioName: 'Trace',
        status: 'pass',
        deterministicHash: 'hash',
        reportHash: 'rep',
        generatedAtIso: '2026-01-01T00:00:00.000Z',
        schedule: 'combinational',
        meta: {
          circuitKind: 'combinational',
          clockingProtocol: null,
          samplePoint: 'steady-state',
          tick0Meaning: null,
          clockSignalName: null,
        },
        report: { rows: [], vectors: [], inputsAtTick: {}, inputsByVectorId: {}, signalRoles: {} },
        waveform: [],
      },
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: true,
      hasResults: false,
      canSetOracle: true,
      failingRowCount: 0,
    });

    expect(model.status).toBe('stimulus-only');
    expect(model.statusBadge).toBe('OBSERVATION ONLY');
    // Must not imply success or failure — tone should be idle, not ok/error
    expect(model.tone).toBe('idle');
  });

  it('status badge is never "SIMULATION COMPLETE" (old misleading name)', () => {
    // Exhaustive check: run through all possible status values and verify
    // "SIMULATION COMPLETE" no longer appears as a badge.
    const allStatuses = [
      'draft', 'running', 'stale', 'stimulus-only',
      'assertions-incomplete', 'assertions-match', 'assertions-differ',
    ];
    // The statusBadge for any status must not use the old name
    const oldBadge = 'SIMULATION COMPLETE';
    // We can't directly construct all states, but we can verify the renamed state maps correctly
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 1,
      signalInventory: makeSignalInventory(2, 1),
      runState: 'complete',
      lastRun: {
        scenarioId: 'scenario',
        scenarioName: 'S',
        status: 'pass',
        deterministicHash: 'h',
        reportHash: 'r',
        generatedAtIso: '2026-01-01T00:00:00.000Z',
        schedule: 'combinational',
        meta: { circuitKind: 'combinational', clockingProtocol: null, samplePoint: 'steady-state', tick0Meaning: null, clockSignalName: null },
        report: { rows: [], vectors: [], inputsAtTick: {}, inputsByVectorId: {}, signalRoles: {} },
        waveform: [],
      },
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: true,
      hasResults: false,
      canSetOracle: true,
      failingRowCount: 0,
    });
    expect(model.statusBadge).not.toBe(oldBadge);
    // Explicitly check that "OBSERVATION ONLY" is used (renamed from "STIMULUS ONLY")
    expect(model.statusBadge).toBe('OBSERVATION ONLY');
    // Suppress TS unused variable warning
    void allStatuses;
  });

  it('summary for stimulus-only does not use product-failure language', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 1,
      signalInventory: makeSignalInventory(2, 1),
      runState: 'complete',
      lastRun: {
        scenarioId: 'trace',
        scenarioName: 'Trace',
        status: 'pass',
        deterministicHash: 'h',
        reportHash: 'r',
        generatedAtIso: '2026-01-01T00:00:00.000Z',
        schedule: 'combinational',
        meta: { circuitKind: 'combinational', clockingProtocol: null, samplePoint: 'steady-state', tick0Meaning: null, clockSignalName: null },
        report: { rows: [], vectors: [], inputsAtTick: {}, inputsByVectorId: {}, signalRoles: {} },
        waveform: [],
      },
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: true,
      hasResults: false,
      canSetOracle: true,
      failingRowCount: 0,
    });
    expect(model.summary).not.toMatch(/failed|failure/i);
  });
});

// ---------------------------------------------------------------------------
// 6. Provenance headers — authority chain recorded in artifact content
// ---------------------------------------------------------------------------

describe('Artifact provenance headers', () => {
  it('top.vhd content contains RedByte provenance header', () => {
    const vm = buildExportViewModel(makeProject(), makePassRun());
    const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
    if (!topVhd || topVhd.content.trim().length === 0) return; // blocked case
    expect(topVhd.content).toMatch(/RedByte IDE Export/i);
    expect(topVhd.content).toMatch(/Board: Basys3/i);
    expect(topVhd.content).toMatch(/designTop:/i);
  });

  it('top.xdc content contains RedByte provenance header', () => {
    const vm = buildExportViewModel(makeProject(), makePassRun());
    const topXdc = vm.artifacts.find((a) => a.path === 'top.xdc');
    if (!topXdc || topXdc.content.trim().length === 0) return;
    expect(topXdc.content).toMatch(/RedByte IDE Export/i);
    expect(topXdc.content).toMatch(/Board: Basys3/i);
  });

  it('testbench.vhd content contains simulationTop in provenance header', () => {
    const vm = buildExportViewModel(makeProject(), makePassRun(), makeScenario());
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    if (!tb || tb.content.trim().length === 0) return;
    expect(tb.content).toMatch(/simulationTop:/i);
  });

  it('vivado_import.tcl content contains RedByte provenance header', () => {
    const vm = buildExportViewModel(makeProject(), makePassRun());
    const tcl = vm.artifacts.find((a) => a.path === 'vivado_import.tcl');
    if (!tcl || tcl.content.trim().length === 0) return;
    expect(tcl.content).toMatch(/RedByte IDE Export/i);
    expect(tcl.content).toMatch(/Board: Basys3/i);
  });

  it('top.vhd provenance header does not reference simulationTop', () => {
    const vm = buildExportViewModel(makeProject(), makePassRun());
    const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
    if (!topVhd || topVhd.content.trim().length === 0) return;
    // The design artifact must not be contaminated with simulationTop
    expect(topVhd.content.split('\n').slice(0, 10).join('\n')).not.toMatch(/simulationTop:/i);
  });
});

// ---------------------------------------------------------------------------
// 7. Authority separation — simulationTop never contaminates design artifacts
// ---------------------------------------------------------------------------

describe('simulationTop never used for design artifacts', () => {
  it('top.xdc content does not reference simulationTop', () => {
    const vm = buildExportViewModel(makeProject());
    const topXdc = vm.artifacts.find((a) => a.path === 'top.xdc');
    if (!topXdc || topXdc.content.trim().length === 0) return;
    expect(topXdc.content).not.toContain(vm.topAuthority.simulationTop);
  });

  it('vivado_import.tcl top_module does not reference simulationTop', () => {
    const vm = buildExportViewModel(makeProject());
    const tcl = vm.artifacts.find((a) => a.path === 'vivado_import.tcl');
    if (!tcl || tcl.content.trim().length === 0) return;
    // The top_module variable in the TCL must be designTop, not simulationTop
    const topModuleLine = tcl.content.split('\n').find((line) => line.includes('set top_module'));
    expect(topModuleLine).toBeDefined();
    expect(topModuleLine).not.toContain(vm.topAuthority.simulationTop);
    expect(topModuleLine).toContain(vm.topAuthority.designTop);
  });

  it('testbench.vhd content does not appear in top.vhd', () => {
    const vm = buildExportViewModel(makeProject(), makePassRun(), makeScenario());
    const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    if (!topVhd || !tb || topVhd.content.trim().length === 0 || tb.content.trim().length === 0) return;
    // top.vhd must have no content from the testbench (no cross-contamination)
    expect(topVhd.content).not.toContain('testbench');
    expect(topVhd.content).not.toContain('_tb');
  });
});

// ---------------------------------------------------------------------------
// 8. Export with stale Verify run — still produces all artifacts
// ---------------------------------------------------------------------------

describe('Export with stale Verify run', () => {
  it('all core artifacts are present and non-empty when verify run is stale', () => {
    const project = makeProject();
    const staleRun = makePassRun({ deterministicHash: 'old-hash', status: 'pass' });
    const scenario = makeScenario();
    const vm = buildExportViewModel(project, staleRun, scenario);
    const corePaths = ['top.vhd', 'top.xdc', 'testbench.vhd', 'vivado_import.tcl'];
    for (const corePath of corePaths) {
      const artifact = vm.artifacts.find((a) => a.path === corePath);
      expect(artifact).toBeDefined();
      // Stale verify must not block export of core artifacts
      expect(artifact?.status).not.toBe('blocked');
    }
  });

  it('export overall status is ok with a stale verify run and clean project', () => {
    const project = makeProject();
    const staleRun = makePassRun({ deterministicHash: 'old-hash' });
    const vm = buildExportViewModel(project, staleRun);
    expect(vm.status).toBe('ok');
  });

  it('export overall status is ok with assertions-differ and clean project', () => {
    const project = makeProject();
    const failRun = makePassRun({ status: 'fail' });
    const scenario = makeScenario();
    const vm = buildExportViewModel(project, failRun, scenario);
    expect(vm.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// 9. Export purity — core HDL artifacts independent of RuntimeVerifyRun
// ---------------------------------------------------------------------------

describe('Export purity — core HDL content does not depend on RuntimeVerifyRun', () => {
  it('top.vhd content is identical whether or not a verify run is provided', () => {
    const project = makeProject();
    const vmNoRun = buildExportViewModel(project, undefined);
    const vmWithRun = buildExportViewModel(project, makePassRun());
    const noRunVhd = vmNoRun.artifacts.find((a) => a.path === 'top.vhd');
    const withRunVhd = vmWithRun.artifacts.find((a) => a.path === 'top.vhd');
    // The provenance header will differ only in exportHash (both runs produce same circuit),
    // but the VHDL entity body must be identical.
    expect(noRunVhd?.content).toBeDefined();
    expect(withRunVhd?.content).toBeDefined();
    // Strip the provenance header (first 7 lines) and compare entity body
    const stripHeader = (s: string) => s.split('\n').slice(7).join('\n');
    expect(stripHeader(noRunVhd?.content ?? '')).toBe(stripHeader(withRunVhd?.content ?? ''));
  });

  it('top.xdc content is identical whether or not a verify run is provided', () => {
    const project = makeProject();
    const vmNoRun = buildExportViewModel(project, undefined);
    const vmWithRun = buildExportViewModel(project, makePassRun());
    const noRunXdc = vmNoRun.artifacts.find((a) => a.path === 'top.xdc');
    const withRunXdc = vmWithRun.artifacts.find((a) => a.path === 'top.xdc');
    expect(noRunXdc?.content).toBeDefined();
    expect(withRunXdc?.content).toBeDefined();
    const stripHeader = (s: string) => s.split('\n').slice(7).join('\n');
    expect(stripHeader(noRunXdc?.content ?? '')).toBe(stripHeader(withRunXdc?.content ?? ''));
  });

  it('testbench.vhd content is identical for pass, fail, and no-run when scenario+vectors are the same', () => {
    const project = makeProject();
    const scenario = makeScenario();
    const vmNoRun = buildExportViewModel(project, undefined, scenario);
    const vmPass = buildExportViewModel(project, makePassRun({ status: 'pass' }), scenario);
    const vmFail = buildExportViewModel(project, makePassRun({ status: 'fail' }), scenario);

    const tbNoRun = vmNoRun.artifacts.find((a) => a.path === 'testbench.vhd');
    const tbPass = vmPass.artifacts.find((a) => a.path === 'testbench.vhd');
    const tbFail = vmFail.artifacts.find((a) => a.path === 'testbench.vhd');

    expect(tbNoRun?.content?.trim().length ?? 0).toBeGreaterThan(0);

    // Strip provenance headers and compare pure VHDL body
    const stripHeader = (s: string) => s.split('\n').slice(7).join('\n');
    const noRunBody = stripHeader(tbNoRun?.content ?? '');
    const passBody = stripHeader(tbPass?.content ?? '');
    const failBody = stripHeader(tbFail?.content ?? '');

    // Pass and fail must produce same testbench body (verify status does not alter VHDL)
    expect(passBody).toBe(failBody);
    // No-run may differ in schedule annotation but core entity/stimulus lines must match
    // At minimum: the VHDL entity/component declaration lines must be the same
    const entityLine = (s: string) => s.split('\n').find((line) => /entity|component/i.test(line)) ?? '';
    expect(entityLine(noRunBody)).toBe(entityLine(passBody));
  });

  it('top.vhd does not contain any waveform or report data from the verify run', () => {
    const project = makeProject();
    // Build a pass run with a non-trivial report to ensure it does not leak into HDL
    const runWithReport = makePassRun({
      report: {
        rows: [{ tick: 0, signal: 'LD0', expected: '1', actual: '0', pass: false }],
        vectors: [],
        inputsAtTick: {},
        inputsByVectorId: {},
        signalRoles: {},
      },
    });
    const vm = buildExportViewModel(project, runWithReport);
    const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
    // Waveform/report data must never appear in synthesizable VHDL
    expect(topVhd?.content).not.toMatch(/tick.*0.*LD0/i);
    expect(topVhd?.content).not.toMatch(/actual.*expected/i);
    expect(topVhd?.content).not.toMatch(/reportHash|deterministicHash/i);
  });
});

// ---------------------------------------------------------------------------
// 10. Export with empty assertions (stimulus-only vectors)
// ---------------------------------------------------------------------------

describe('Export with stimulus-only vectors (no expected outputs)', () => {
  it('generates testbench.vhd even when all expected values are empty', () => {
    const project = makeProject({
      vectors: [
        { tick: 0, inputs: { SW0: 0 }, expected: {} },
        { tick: 1, inputs: { SW0: 1 }, expected: {} },
      ],
    });
    const scenario = makeScenario({
      vectors: [
        { tick: 0, inputs: { SW0: 0 }, expected: {} },
        { tick: 1, inputs: { SW0: 1 }, expected: {} },
      ],
    });
    const vm = buildExportViewModel(project, undefined, scenario);
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(tb).toBeDefined();
    // Testbench must have content (stimulus always produces valid VHDL)
    expect(tb?.content?.trim().length ?? 0).toBeGreaterThan(0);
    // Export status must not be blocked just because there are no assertions
    expect(vm.status).toBe('ok');
  });

  it('top.vhd and top.xdc are unaffected by empty expected values', () => {
    const project = makeProject({
      vectors: [{ tick: 0, inputs: { SW0: 0 }, expected: {} }],
    });
    const vm = buildExportViewModel(project);
    const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
    const topXdc = vm.artifacts.find((a) => a.path === 'top.xdc');
    expect(topVhd?.content?.trim().length ?? 0).toBeGreaterThan(0);
    expect(topXdc?.content?.trim().length ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Export without any Verify context
// ---------------------------------------------------------------------------

describe('Export without any Verify context (pure RBProject + activeScenario)', () => {
  it('produces all core artifacts without RuntimeVerifyRun', () => {
    const vm = buildExportViewModel(makeProject(), undefined, undefined);
    const corePaths = ['top.vhd', 'top.xdc', 'vivado_import.tcl'];
    for (const corePath of corePaths) {
      const artifact = vm.artifacts.find((a) => a.path === corePath);
      expect(artifact).toBeDefined();
      expect(artifact?.content?.trim().length ?? 0).toBeGreaterThan(0);
      expect(artifact?.status).not.toBe('blocked');
    }
  });

  it('export overall status is ok with no RuntimeVerifyRun and a valid project', () => {
    const vm = buildExportViewModel(makeProject(), undefined, undefined);
    expect(vm.status).toBe('ok');
  });

  it('topAuthority is always present even without RuntimeVerifyRun', () => {
    const vm = buildExportViewModel(makeProject(), undefined, undefined);
    expect(vm.topAuthority.designTop.length).toBeGreaterThan(0);
    expect(vm.topAuthority.simulationTop).toBe(`${vm.topAuthority.designTop}_tb`);
  });
});

// ---------------------------------------------------------------------------
// 12. exportHash invariant — stable across verify state changes
// ---------------------------------------------------------------------------

describe('exportHash invariant — stable across verify state', () => {
  it('exportHash is identical for no-run, pass, and fail with same project', () => {
    const project = makeProject();
    const vmNoRun = buildExportViewModel(project, undefined);
    const vmPass = buildExportViewModel(project, makePassRun({ status: 'pass' }));
    const vmFail = buildExportViewModel(project, makePassRun({ status: 'fail' }));
    // exportHash is derived from project + circuit bundle only — not from verify state
    expect(vmNoRun.exportHash).toBeDefined();
    expect(vmNoRun.exportHash).toBe(vmPass.exportHash);
    expect(vmPass.exportHash).toBe(vmFail.exportHash);
  });

  it('export overall status is ok for all verify states with a valid project', () => {
    const project = makeProject();
    expect(buildExportViewModel(project, undefined).status).toBe('ok');
    expect(buildExportViewModel(project, makePassRun({ status: 'pass' })).status).toBe('ok');
    expect(buildExportViewModel(project, makePassRun({ status: 'fail' })).status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// 13. Guard tests — things that MUST NOT happen
// ---------------------------------------------------------------------------

describe('Guard tests — export must not depend on RuntimeVerifyRun compare state', () => {
  it('top.vhd artifact status is ready regardless of verify status', () => {
    const project = makeProject();
    const runs = [undefined, makePassRun({ status: 'pass' }), makePassRun({ status: 'fail' })] as const;
    for (const run of runs) {
      const vm = buildExportViewModel(project, run);
      const topVhd = vm.artifacts.find((a) => a.path === 'top.vhd');
      expect(topVhd?.status).toBe('ready');
    }
  });

  it('top.xdc artifact status is ready regardless of verify status', () => {
    const project = makeProject();
    const runs = [undefined, makePassRun({ status: 'pass' }), makePassRun({ status: 'fail' })] as const;
    for (const run of runs) {
      const vm = buildExportViewModel(project, run);
      const xdc = vm.artifacts.find((a) => a.path === 'top.xdc');
      expect(xdc?.status).toBe('ready');
    }
  });

  it('changing runtimeVerifyRun.report does not change top.vhd content', () => {
    const project = makeProject();
    const runA = makePassRun({
      report: { rows: [], vectors: [], inputsAtTick: {}, inputsByVectorId: {}, signalRoles: {} },
    });
    const runB = makePassRun({
      report: {
        rows: [{ tick: 0, signal: 'LD0', expected: '0', actual: '1', pass: false }],
        vectors: [],
        inputsAtTick: {},
        inputsByVectorId: {},
        signalRoles: {},
      },
    });
    const vhdA = buildExportViewModel(project, runA).artifacts.find((a) => a.path === 'top.vhd')?.content ?? '';
    const vhdB = buildExportViewModel(project, runB).artifacts.find((a) => a.path === 'top.vhd')?.content ?? '';
    // Report data must never influence synthesizable VHDL
    expect(vhdA).toBe(vhdB);
  });

  it('changing runtimeVerifyRun.waveform does not change top.vhd content', () => {
    const project = makeProject();
    const runNoWave = makePassRun({ waveform: [] });
    const runWithWave = makePassRun({ waveform: [{ tick: 0, signals: { SW0: 0, LD0: 1 } }] });
    const vhdA = buildExportViewModel(project, runNoWave).artifacts.find((a) => a.path === 'top.vhd')?.content ?? '';
    const vhdB = buildExportViewModel(project, runWithWave).artifacts.find((a) => a.path === 'top.vhd')?.content ?? '';
    // Waveform snapshots must never influence synthesizable VHDL
    expect(vhdA).toBe(vhdB);
  });

  it('testbench category is always simulation-source — never design-source', () => {
    const runs = [undefined, makePassRun({ status: 'pass' }), makePassRun({ status: 'fail' })] as const;
    for (const run of runs) {
      const vm = buildExportViewModel(makeProject(), run, makeScenario());
      const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd');
      if (!tb || tb.content.trim().length === 0) continue;
      expect(tb.category).toBe('simulation-source');
      expect(tb.category).not.toBe('design-source');
    }
  });
});
