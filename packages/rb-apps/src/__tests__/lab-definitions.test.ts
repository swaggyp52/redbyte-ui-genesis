import { describe, expect, it } from 'vitest';
import { getBlockedVerificationNodeTypes, getComponentSupport, isNodeTypeSupportedFor } from '@redbyte/rb-logic-core';
import { listExamples, loadExample } from '../examples';
import { LAB_DEFINITIONS, getLabDefinitionById } from '../labs/labDefinitions';
import { getLabStarterKitById } from '../starterKits/labStarterKits';

/** Parts a student cannot carry through Simulate or Package: blocked in Verify, or logic the exporter refuses. */
function refusedPartTypes(types: readonly string[]): string[] {
  const blocked = new Set<string>(getBlockedVerificationNodeTypes());
  return [...new Set(types)].filter((type) => {
    const support = getComponentSupport(type);
    if (!support) return false;
    const boundary = support.category === 'io' || support.category === 'utility';
    return blocked.has(type) || (!boundary && !isNodeTypeSupportedFor(type, 'vhdlExport'));
  });
}

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

  it('explains every part of a starter that RedByte does not support, wherever the lab is presented', async () => {
    const explained: Record<string, string[]> = {};
    for (const definition of LAB_DEFINITIONS) {
      if (!definition.starterExampleId) continue;
      const starter = await loadExample(definition.starterExampleId);
      const refused = refusedPartTypes(starter.nodes.map((node) => node.type));
      if (refused.length === 0) continue;
      explained[definition.id] = refused;
      const kit = getLabStarterKitById(definition.starterId);
      const example = listExamples().find((entry) => entry.id === definition.starterExampleId);
      for (const type of refused) {
        const notice = new RegExp(`${type}[^.]*not supported|not supported[^.]*${type}`, 'i');
        expect(definition.whatToDo, `${definition.id} whatToDo`).toMatch(notice);
        expect(kit?.whatToDo, `${definition.id} starter kit`).toMatch(notice);
        expect(example?.description, `${definition.starterExampleId} description`).toMatch(notice);
        // No step may send students to wire the part as if it worked.
        for (const step of definition.buildSteps.filter((entry) => entry.includes(type))) {
          expect(step, `${definition.id} build step`).toMatch(/not supported/i);
        }
      }
    }
    // The legacy Lab 4 ALU scaffold is the shipped starter that carries one (four MUX4 blocks).
    expect(explained).toEqual({ 'lab-4': ['MUX4'] });
  });
});
