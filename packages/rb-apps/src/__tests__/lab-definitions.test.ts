import { describe, expect, it } from 'vitest';
import { LAB_DEFINITIONS, getLabDefinitionById } from '../labs/labDefinitions';

describe('lab definitions', () => {
  it('contains labs 1-8 and freeplay', () => {
    expect(LAB_DEFINITIONS.length).toBeGreaterThanOrEqual(9);

    for (const requiredId of ['lab-1', 'lab-2', 'lab-3', 'lab-4', 'lab-5', 'lab-6', 'lab-7', 'lab-8', 'freeplay']) {
      expect(getLabDefinitionById(requiredId)).not.toBeNull();
    }
  });

  it('defines required fields and submit gates consistently', () => {
    for (const definition of LAB_DEFINITIONS) {
      expect(definition.id.length).toBeGreaterThan(0);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.learningGoal.length).toBeGreaterThan(0);
      expect(definition.buildSteps.length).toBeGreaterThan(0);
      expect(definition.simulateChecks.length).toBeGreaterThan(0);
      expect(definition.submitEvidence.length).toBeGreaterThan(0);

      for (const gate of definition.submitGates) {
        expect(gate.id.length).toBeGreaterThan(0);
        expect(gate.message.length).toBeGreaterThan(0);
        expect(['warn', 'block']).toContain(gate.severity);
        expect(['build', 'simulate', 'hardware', 'submit']).toContain(gate.stage);
      }

      if (definition.requiredTop != null) {
        expect(definition.requiredTop.trim().length).toBeGreaterThan(0);
      }
      if (definition.requiredBoardPreset != null) {
        expect(definition.requiredBoardPreset.trim().length).toBeGreaterThan(0);
      }
      if (definition.requiredPorts != null) {
        expect(Array.isArray(definition.requiredPorts)).toBe(true);
        for (const port of definition.requiredPorts) {
          expect(port.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});
