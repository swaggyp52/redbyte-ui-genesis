import { describe, expect, it } from 'vitest';
import {
  VERIFY_TRUTH_STATECHART,
  assertVerifyTruthInvariants,
  createVerifyTruthInitialState,
  deriveFailureRepairActions,
  verifyTruthReducer,
  type VerifyCheck,
  type VerifyFailure,
  type VerifyTruthState,
} from '../verifyTruthState';

const courseCarryCheck: VerifyCheck = {
  id: 'course-carry',
  label: 'Course: carry output',
  provenance: 'course',
  editability: 'locked',
  lockedReason: 'Course checks are locked. Duplicate into My checks before editing.',
  expectedValues: { 'case-1:t0:carry': '1' },
};

const studentSumCheck: VerifyCheck = {
  id: 'student-sum',
  label: 'My check: sum output',
  provenance: 'student',
  editability: 'editable',
  expectedValues: { 'case-1:t0:sum': '0' },
};

const carryFailure: VerifyFailure = {
  id: 'fail-carry',
  checkId: 'course-carry',
  signal: 'carry',
  caseId: 'case-1',
  tick: 0,
  expected: '1',
  observed: '0',
};

const sumFailure: VerifyFailure = {
  id: 'fail-sum',
  checkId: 'student-sum',
  signal: 'sum',
  caseId: 'case-1',
  tick: 0,
  expected: '0',
  observed: '1',
};

function expectValid(state: VerifyTruthState): VerifyTruthState {
  expect(assertVerifyTruthInvariants(state)).toEqual([]);
  return state;
}

function completedComparePass(): VerifyTruthState {
  const initial = createVerifyTruthInitialState({ checks: [courseCarryCheck] });
  const running = verifyTruthReducer(initial, {
    type: 'RUN_REQUESTED',
    runId: 'run-1',
    mode: 'compare',
  });
  return expectValid(
    verifyTruthReducer(running, {
      type: 'RUN_COMPLETED',
      runId: 'run-1',
      mode: 'compare',
      observedValuesByCheck: { 'course-carry': { 'case-1:t0:carry': '1' } },
    })
  );
}

describe('verifyTruthState', () => {
  it('names the allowed statechart transitions for every Verify truth event', () => {
    expect(Object.keys(VERIFY_TRUTH_STATECHART).sort()).toEqual([
      'CHECK_SET_CHANGED',
      'COURSE_CHECK_DUPLICATED',
      'DESIGN_CHANGED',
      'FAILURE_SELECTED',
      'RESET',
      'RUN_COMPLETED',
      'RUN_FAILED',
      'RUN_REQUESTED',
      'SCENARIO_CHANGED',
      'STUDENT_CHECK_EDITED',
    ]);
    expect(VERIFY_TRUTH_STATECHART.RUN_COMPLETED.from).toEqual(['running']);
    expect(VERIFY_TRUTH_STATECHART.RUN_COMPLETED.to).toEqual(['ready', 'passed', 'failed']);
  });

  it('separates no-design, no-testbench, and ready states', () => {
    expect(expectValid(createVerifyTruthInitialState({ hasDesign: false })).status).toBe('unavailable');
    expect(expectValid(createVerifyTruthInitialState({ checks: [] })).status).toBe('needsTestbench');
    expect(expectValid(createVerifyTruthInitialState({ checks: [courseCarryCheck] })).status).toBe('ready');
  });

  it('locks course checks and rejects direct edits to their expected values', () => {
    const initial = createVerifyTruthInitialState({ checks: [courseCarryCheck] });
    const edited = verifyTruthReducer(initial, {
      type: 'STUDENT_CHECK_EDITED',
      checkId: 'course-carry',
      expectedValues: { 'case-1:t0:carry': '0' },
    });

    expectValid(edited);
    expect(edited.checks[0].expectedValues['case-1:t0:carry']).toBe('1');
    expect(edited.lastRejectedEvent).toEqual({
      event: 'STUDENT_CHECK_EDITED',
      reason: 'Course checks are locked. Duplicate into My checks before editing.',
    });
  });

  it('duplicates a course check into an editable student check and marks prior results stale', () => {
    const passed = completedComparePass();
    const duplicated = verifyTruthReducer(passed, {
      type: 'COURSE_CHECK_DUPLICATED',
      sourceCheckId: 'course-carry',
      newCheckId: 'student-carry',
      label: 'My carry check',
    });

    expectValid(duplicated);
    expect(duplicated.status).toBe('staleTestbench');
    expect(duplicated.resultValidity).toBe('stale');
    expect(duplicated.staleReason).toBe('check-set-changed');
    expect(duplicated.checks).toHaveLength(2);
    expect(duplicated.checks[1]).toMatchObject({
      id: 'student-carry',
      label: 'My carry check',
      provenance: 'student',
      editability: 'editable',
    });
  });

  it('invalidates a trusted PASS when a student-authored check changes', () => {
    const initial = createVerifyTruthInitialState({ checks: [studentSumCheck] });
    const running = verifyTruthReducer(initial, {
      type: 'RUN_REQUESTED',
      runId: 'run-pass',
      mode: 'compare',
    });
    const passed = expectValid(
      verifyTruthReducer(running, {
        type: 'RUN_COMPLETED',
        runId: 'run-pass',
        mode: 'compare',
        observedValuesByCheck: { 'student-sum': { 'case-1:t0:sum': '0' } },
      })
    );

    const edited = verifyTruthReducer(passed, {
      type: 'STUDENT_CHECK_EDITED',
      checkId: 'student-sum',
      expectedValues: { 'case-1:t0:sum': '1' },
    });

    expectValid(edited);
    expect(edited.status).toBe('staleTestbench');
    expect(edited.resultValidity).toBe('stale');
    expect(edited.staleReason).toBe('check-set-changed');
    expect(edited.checks[0].expectedValues['case-1:t0:sum']).toBe('1');
  });

  it('invalidates a trusted PASS when the design changes', () => {
    const passed = completedComparePass();
    const stale = verifyTruthReducer(passed, { type: 'DESIGN_CHANGED' });

    expectValid(stale);
    expect(stale.status).toBe('staleDesign');
    expect(stale.resultValidity).toBe('stale');
    expect(stale.revisions.designRevision).toBe(passed.revisions.designRevision + 1);
  });

  it('only produces PASS or FAIL from completed compare runs tied to current revisions', () => {
    const initial = createVerifyTruthInitialState({ checks: [courseCarryCheck, studentSumCheck] });
    const running = verifyTruthReducer(initial, {
      type: 'RUN_REQUESTED',
      runId: 'run-fail',
      mode: 'compare',
      sequentialTimingMode: 'auto-board-clock',
    });
    const failed = expectValid(
      verifyTruthReducer(running, {
        type: 'RUN_COMPLETED',
        runId: 'run-fail',
        mode: 'compare',
        observedValuesByCheck: {
          'course-carry': { 'case-1:t0:carry': '0' },
          'student-sum': { 'case-1:t0:sum': '1' },
        },
        failures: [carryFailure, sumFailure],
      })
    );

    expect(failed.status).toBe('failed');
    expect(failed.resultValidity).toBe('current');
    expect(failed.lastRun?.mode).toBe('compare');
    expect(failed.lastRun?.sequentialTimingMode).toBe('auto-board-clock');
    expect(failed.selectedFailureId).toBe('fail-carry');
  });

  it('keeps observe runs out of trusted PASS and FAIL states', () => {
    const initial = createVerifyTruthInitialState({ checks: [courseCarryCheck] });
    const running = verifyTruthReducer(initial, {
      type: 'RUN_REQUESTED',
      runId: 'observe-1',
      mode: 'observe',
    });
    const observed = expectValid(
      verifyTruthReducer(running, {
        type: 'RUN_COMPLETED',
        runId: 'observe-1',
        mode: 'observe',
        observedValuesByCheck: { 'course-carry': { 'case-1:t0:carry': '1' } },
      })
    );

    expect(observed.status).toBe('ready');
    expect(observed.lastRun?.status).toBe('observe');
    expect(observed.resultValidity).toBe('current');
  });

  it('allows observe runs without checks but keeps the testbench incomplete', () => {
    const initial = createVerifyTruthInitialState({ checks: [] });
    const running = verifyTruthReducer(initial, {
      type: 'RUN_REQUESTED',
      runId: 'observe-empty',
      mode: 'observe',
    });
    const observed = expectValid(
      verifyTruthReducer(running, {
        type: 'RUN_COMPLETED',
        runId: 'observe-empty',
        mode: 'observe',
      })
    );

    expect(observed.status).toBe('needsTestbench');
    expect(observed.lastRun?.status).toBe('observe');
    expect(observed.resultValidity).toBe('current');
    expect(observed.lastRejectedEvent).toBeNull();
  });

  it('derives repair actions from check provenance and editability', () => {
    const initial = createVerifyTruthInitialState({ checks: [courseCarryCheck, studentSumCheck] });
    const running = verifyTruthReducer(initial, {
      type: 'RUN_REQUESTED',
      runId: 'run-fail',
      mode: 'compare',
    });
    const failed = expectValid(
      verifyTruthReducer(running, {
        type: 'RUN_COMPLETED',
        runId: 'run-fail',
        mode: 'compare',
        failures: [carryFailure, sumFailure],
      })
    );

    expect(deriveFailureRepairActions(failed, 'fail-carry')).toEqual({
      canFixCircuit: true,
      canEditExpected: false,
      checkProvenance: 'course',
      lockedReason: 'Course checks are locked. Duplicate into My checks before editing.',
    });
    expect(deriveFailureRepairActions(failed, 'fail-sum')).toEqual({
      canFixCircuit: true,
      canEditExpected: true,
      checkProvenance: 'student',
      lockedReason: null,
    });
  });

  it('rejects stale or mismatched run completions instead of creating impossible proof states', () => {
    const initial = createVerifyTruthInitialState({ checks: [courseCarryCheck] });
    const running = verifyTruthReducer(initial, {
      type: 'RUN_REQUESTED',
      runId: 'run-1',
      mode: 'compare',
    });
    const rejected = verifyTruthReducer(running, {
      type: 'RUN_COMPLETED',
      runId: 'run-2',
      mode: 'compare',
    });

    expectValid(rejected);
    expect(rejected.status).toBe('running');
    expect(rejected.lastRejectedEvent).toEqual({
      event: 'RUN_COMPLETED',
      reason: 'Run "run-2" does not match the pending run.',
    });
  });
});
