import { describe, expect, it } from 'vitest';
import {
  createScenarioStep,
  deriveScenarioStepsFromVectors,
  materializeVectorsFromScenarioSteps,
} from '../verifyScenarioSteps';

describe('verifyScenarioSteps', () => {
  it('materializes vectors from explicit scenario steps', () => {
    const steps = [
      createScenarioStep({ kind: 'set_input', targetRef: 'sw0', value: 1 }, 0),
      createScenarioStep({ kind: 'assert_scalar', targetRef: 'ld0', expectedValue: 1 }, 1),
      createScenarioStep({ kind: 'observe' }, 2),
    ];

    const vectors = materializeVectorsFromScenarioSteps(steps, []);
    expect(vectors).toHaveLength(3);
    expect(vectors[0]?.inputs).toEqual({ sw0: 1 });
    expect(vectors[1]?.expected).toEqual({ ld0: 1 });
  });

  it('derives typed steps from legacy vectors for migration fallback', () => {
    const steps = deriveScenarioStepsFromVectors([
      { tick: 0, inputs: { rst: 1, sw0: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { rst: 0, sw0: 1 }, expected: { ld0: 1 } },
    ]);

    expect(steps.some((step) => step.kind === 'apply_reset')).toBe(true);
    expect(steps.some((step) => step.kind === 'assert_scalar')).toBe(true);
    expect(steps.every((step) => step.origin === 'derived')).toBe(true);
  });
});
