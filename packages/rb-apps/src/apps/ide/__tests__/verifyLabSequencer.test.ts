import { describe, expect, it } from 'vitest';
import type { VerifyAuthorVector } from '../surfaces/ScenarioBuilderPanel';
import {
  buildLabSequencerSteps,
  buildLabSequencerStepsFromScenarioSteps,
  summarizeStateObservation,
  type LabSequencerSignalRoles,
} from '../verifyLabSequencer';

function vec(
  tick: number,
  inputs: Record<string, 0 | 1>,
  expected: Record<string, 0 | 1> = {}
): VerifyAuthorVector {
  return {
    id: `vec-${tick}`,
    tick,
    inputs,
    expected,
  };
}

describe('buildLabSequencerSteps', () => {
  it('classifies manual lab vectors into explicit step types', () => {
    const vectors: VerifyAuthorVector[] = [
      vec(0, { rst: 1, sw0: 0, clk: 0 }, { led0: 0 }),
      vec(1, { rst: 0, sw0: 1, clk: 1 }, { led0: 1 }),
      vec(2, { rst: 0, sw0: 1, clk: 0 }, { led0: 1 }),
    ];
    const roles: LabSequencerSignalRoles = {
      rst: 'reset',
      clk: 'clock',
      sw0: 'input',
      led0: 'output',
    };

    const steps = buildLabSequencerSteps(vectors, roles);
    expect(steps.length).toBe(7);
    expect(steps.map((step) => step.kind)).toEqual([
      'apply_reset',
      'set_input',
      'observe_assert_output',
      'set_input',
      'pulse_step',
      'observe_assert_output',
      'observe_assert_output',
    ]);
    expect(steps[0].title).toMatch(/apply reset/i);
    expect(steps[4].title).toMatch(/pulse step/i);
  });
});

describe('summarizeStateObservation', () => {
  it('counts register/state bank signals from selected tick samples', () => {
    const summary = summarizeStateObservation(
      {
        reg_q0: '1',
        REG_q1: '0',
        state_bank_out0: '1',
        led0: '1',
      },
      ['reg_q0', 'reg_q1', 'state_bank_out0', 'led0']
    );

    expect(summary.registerSignalCount).toBe(2);
    expect(summary.stateBankSignalCount).toBe(1);
    expect(summary.totalObservedSignals).toBe(4);
  });
});

describe('buildLabSequencerStepsFromScenarioSteps', () => {
  it('uses explicit persisted scenario steps as sequencer authority', () => {
    const steps = buildLabSequencerStepsFromScenarioSteps([
      {
        id: 's1',
        order: 0,
        kind: 'set_bus',
        targetRef: 'sw_bus',
        value: { sw0: 1, sw1: 0 },
        origin: 'explicit',
      },
      {
        id: 's2',
        order: 1,
        kind: 'inspect_register',
        targetRef: 'reg_q0',
        origin: 'explicit',
      },
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0]?.kind).toBe('set_bus');
    expect(steps[1]?.kind).toBe('inspect_register');
  });
});
