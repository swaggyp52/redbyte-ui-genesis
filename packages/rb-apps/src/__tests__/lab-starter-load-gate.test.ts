// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { LAB_STARTERS } from '../apps/ide/labStarters';

describe('gates:lab-starter-load', () => {
  for (const starter of LAB_STARTERS) {
    it(`Lab ${starter.labNumber} starter (${starter.id}) loads with at least one INPUT and one OUTPUT node`, () => {
      const { circuit } = starter.example;
      expect(circuit).toBeTruthy();
      const inputs = circuit.nodes.filter((n) => n.type === 'INPUT');
      const outputs = circuit.nodes.filter((n) => n.type === 'OUTPUT');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
      expect(outputs.length).toBeGreaterThanOrEqual(1);
    });
  }
});
