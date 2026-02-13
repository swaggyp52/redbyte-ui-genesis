import { describe, expect, it } from 'vitest';
import { LAB_STARTER_KITS } from '../starterKits/labStarterKits';

describe('lab starter kits content template', () => {
  it('uses a consistent student-facing instruction structure for every starter', () => {
    expect(LAB_STARTER_KITS.length).toBeGreaterThanOrEqual(9);

    const labIds = LAB_STARTER_KITS.map((starter) => starter.labId);
    for (const requiredId of ['lab-1', 'lab-2', 'lab-3', 'lab-4', 'lab-5', 'lab-6', 'lab-7', 'lab-8', 'freeplay']) {
      expect(labIds).toContain(requiredId);
    }

    for (const starter of LAB_STARTER_KITS) {
      expect(starter.labId.trim().length).toBeGreaterThan(0);
      expect(starter.title.trim().length).toBeGreaterThan(0);
      expect(starter.timeEstimate.trim().length).toBeGreaterThan(0);
      expect(starter.learningGoal.trim().length).toBeGreaterThan(0);

      expect(starter.instructions.labId).toBe(starter.labId);
      expect(starter.instructions.title).toBe(starter.title);
      expect(starter.instructions.timeEstimate).toBe(starter.timeEstimate);
      expect(starter.instructions.learningGoal).toBe(starter.learningGoal);

      expect(starter.instructions.steps.length).toBeGreaterThanOrEqual(starter.labId === 'freeplay' ? 1 : 2);
      if (starter.labId !== 'freeplay') {
        expect(starter.instructions.steps.length).toBeLessThanOrEqual(7);
      }
      expect(starter.instructions.commonMistakes.length).toBeGreaterThanOrEqual(1);
      expect(starter.instructions.commonMistakes.length).toBeLessThanOrEqual(3);
      expect(starter.instructions.submit.length).toBeGreaterThanOrEqual(1);
      expect(starter.instructions.rubric.length).toBeGreaterThanOrEqual(1);
    }
  });
});
