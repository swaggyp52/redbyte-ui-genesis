// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { useCircuitStore } from '../../../stores/circuitStore';
import { buildIdeExportProject } from '../ideExportProject';
import { deriveIdeBlockingDesignIssue } from '../ideDesignBlocking';
import { blocksCheckedRuns, isDesignOwnedExportDiagnostic } from '../projectWorkflowAuthority';
import { useProjectRuntime } from '../projectRuntime';
import { planStudioRun } from '../studioRunInput';
import { getActiveScenario } from '../verifyScenario';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

/**
 * An output nothing drives blocks the package (RBEX4103), but a student checking the outputs
 * already wired keeps a checked Run: Verify shows the open output as X and fails its checks.
 */

const at = (x: number, y = 0) => ({ position: { x, y }, x, y, rotation: 0, config: {}, state: {} });

function halfWired(): RBProject {
  return {
    kind: 'rb-project', version: 1, createdAt: '2026-10-27T00:00:00.000Z', updatedAt: '2026-10-27T00:00:00.000Z',
    name: 'Half wired', description: 'LD0 follows SW0; LD1 is not wired yet.',
    circuit: {
      nodes: [
        { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0) },
        { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(200) },
        { id: 'ld1', type: 'OUTPUT', label: 'LD1', ...at(200, 80) },
      ],
      connections: [{ id: 'w', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } }],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'V17' }],
      outputs: [
        { id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'U16' },
        { id: 'ld1', nodeId: 'ld1', port: 'in', label: 'LD1', pin: 'E19' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, ld1: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1, ld1: 0 } },
    ],
    meta: { projectId: 'rb-undriven-run-policy' },
  } as RBProject;
}

describe('an undriven output blocks the package, not the checked Run', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
    useProjectRuntime.getState().loadFromProject(halfWired());
  });

  it('RBEX4103 is design-owned but does not turn checks off', () => {
    expect(isDesignOwnedExportDiagnostic('RBEX4103')).toBe(true);
    expect(blocksCheckedRuns('RBEX4103')).toBe(false);
    expect(blocksCheckedRuns('RBEX4100')).toBe(true);
  });

  it('the export is blocked by name, and the Run keeps its checks and fails only through the open output', () => {
    const state = useProjectRuntime.getState();
    const project = buildIdeExportProject(state);
    const vm = buildExportViewModel(project, undefined, getActiveScenario(state.scenarios, state.activeScenarioId) ?? undefined);
    expect(vm.status).toBe('blocked');
    expect(vm.errors.map((e) => e.code)).toEqual(['RBEX4103']);
    expect(vm.errors[0].message).toMatch(/^Output port "LD1" on node "ld1" has no driver/);

    expect(deriveIdeBlockingDesignIssue(state)).toBeNull();
    const plan = planStudioRun(state, { captureEvaluations: false, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
    expect(plan.blockingIssue).toBeNull();
    expect(plan.checkCount).toBe(4);

    const run = useProjectRuntime.getState().runVerification(plan.input);
    const checked = run.report.rows.filter((row) => row.expected === '0' || row.expected === '1');
    const failing = checked.filter((row) => row.actual !== row.expected);
    expect(checked).toHaveLength(4);
    expect(failing.every((row) => /ld1/i.test(row.signal) && row.actual === 'X')).toBe(true);
    expect(failing).toHaveLength(2);
  });
});
