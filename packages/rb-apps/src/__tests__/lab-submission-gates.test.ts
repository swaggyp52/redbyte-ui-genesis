import { describe, expect, it } from 'vitest';
import type { RBProject } from '../export/projectFormat';
import { validateSubmissionForLab } from '../labs/submissionGates';

function createProject(overrides?: Partial<RBProject>): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-02-12T00:00:00.000Z',
    updatedAt: '2026-02-12T00:00:00.000Z',
    name: 'Lab Project',
    circuit: { nodes: [], connections: [] },
    hdl: {
      top: 'top',
      sources: [{ path: 'top.v', language: 'verilog', text: 'module top(input wire a, output wire seg, an, dp); endmodule' }],
    },
    fpga: { board: 'basys3', top: 'top' },
    meta: { labId: 'lab-1', appSurface: 'lab-workspace' },
    ...overrides,
  };
}

describe('validateSubmissionForLab', () => {
  it('lab 1 minimal project passes with warning when preset is missing', () => {
    const result = validateSubmissionForLab('lab-1', {
      projectSnapshot: createProject({ meta: { labId: 'lab-1' } }),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true },
    });

    expect(result.verdict).toBe('warn');
    expect(result.issues.some((issue) => issue.code === 'board_preset_recommended')).toBe(true);
    expect(result.issues.some((issue) => issue.severity === 'block')).toBe(false);
  });

  it('lab 3 blocks when required preset is missing', () => {
    const result = validateSubmissionForLab('lab-3', {
      projectSnapshot: createProject({
        meta: { labId: 'lab-3' },
        fpga: { board: 'basys3', top: 'top' },
      }),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true },
    });

    expect(result.verdict).toBe('block');
    expect(result.issues.some((issue) => issue.code === 'board_preset_required')).toBe(true);
  });

  it('blocks when required top module mismatches', () => {
    const result = validateSubmissionForLab('lab-1', {
      projectSnapshot: createProject({
        meta: { labId: 'lab-1' },
        hdl: {
          top: 'wrong_top',
          sources: [{ path: 'top.v', language: 'verilog', text: 'module wrong_top; endmodule' }],
        },
        fpga: { board: 'basys3', top: 'wrong_top' },
      }),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true },
    });

    expect(result.verdict).toBe('block');
    expect(result.issues.some((issue) => issue.code === 'top_module_mismatch')).toBe(true);
  });

  it('freeplay never blocks on missing toolchain', () => {
    const result = validateSubmissionForLab('freeplay', {
      projectSnapshot: createProject({
        meta: { labId: 'freeplay' },
      }),
      doctorReport: null,
      recentRuns: {},
    });

    expect(result.verdict).not.toBe('block');
    expect(result.issues.some((issue) => issue.code === 'toolchain_required_for_hardware_evidence')).toBe(false);
  });

  it('lab 7 blocks when sequenceProofRun is missing or false', () => {
    const baseProject = createProject({
      meta: { labId: 'lab-7' },
      fpga: { board: 'basys3', top: 'top', preset: 'basys3' },
    });

    const missingResult = validateSubmissionForLab('lab-7', {
      projectSnapshot: baseProject,
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true },
    });
    expect(missingResult.verdict).toBe('block');
    expect(missingResult.issues.some((issue) => issue.code === 'sequence_proof_missing')).toBe(true);

    const falseResult = validateSubmissionForLab('lab-7', {
      projectSnapshot: baseProject,
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, sequenceProofRun: false },
    });
    expect(falseResult.verdict).toBe('block');
    expect(falseResult.issues.some((issue) => issue.code === 'sequence_proof_missing')).toBe(true);
  });

  it('lab 7 unblocks sequence-proof when sequenceProofRun is true', () => {
    const result = validateSubmissionForLab('lab-7', {
      projectSnapshot: createProject({
        meta: { labId: 'lab-7' },
        fpga: { board: 'basys3', top: 'top', preset: 'basys3' },
      }),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, sequenceProofRun: true },
    });

    expect(result.issues.some((issue) => issue.code === 'sequence_proof_missing')).toBe(false);
    expect(result.verdict).not.toBe('block');
  });

  it('lab 8 blocks when fsmPathsRun is missing or false', () => {
    const baseProject = createProject({
      meta: { labId: 'lab-8' },
      fpga: { board: 'basys3', top: 'top', preset: 'basys3' },
    });

    const missingResult = validateSubmissionForLab('lab-8', {
      projectSnapshot: baseProject,
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true },
    });
    expect(missingResult.verdict).toBe('block');
    expect(missingResult.issues.some((issue) => issue.code === 'fsm_paths_missing')).toBe(true);

    const falseResult = validateSubmissionForLab('lab-8', {
      projectSnapshot: baseProject,
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, fsmPathsRun: false },
    });
    expect(falseResult.verdict).toBe('block');
    expect(falseResult.issues.some((issue) => issue.code === 'fsm_paths_missing')).toBe(true);
  });

  it('lab 8 unblocks fsm-paths when fsmPathsRun is true', () => {
    const result = validateSubmissionForLab('lab-8', {
      projectSnapshot: createProject({
        meta: { labId: 'lab-8' },
        fpga: { board: 'basys3', top: 'top', preset: 'basys3' },
      }),
      doctorReport: null,
      recentRuns: { simulated: true, synthesized: true, fsmPathsRun: true },
    });

    expect(result.issues.some((issue) => issue.code === 'fsm_paths_missing')).toBe(false);
    expect(result.verdict).not.toBe('block');
  });
});
