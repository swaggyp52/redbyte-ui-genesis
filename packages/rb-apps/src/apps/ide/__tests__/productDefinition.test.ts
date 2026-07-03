import { describe, expect, it } from 'vitest';
import {
  PRODUCT_SPINE_DEFINITIONS,
  PRODUCT_SPINE_ORDER,
  getProductSpineDefinition,
  getProductSpineProgress,
} from '../productDefinition';

describe('productDefinition', () => {
  it('defines the six RedByte student surfaces in order', () => {
    expect(PRODUCT_SPINE_ORDER).toEqual([
      'project',
      'design',
      'verify',
      'hardware',
      'export',
      'import',
    ]);

    for (const page of PRODUCT_SPINE_ORDER) {
      const definition = getProductSpineDefinition(page);
      expect(definition.key).toBe(page);
      expect(definition.job).toMatch(/\S/);
      expect(definition.nextAction).toMatch(/What do I do next\?/);
      expect(definition.doneCondition).toMatch(/\S/);
      expect(definition.blockedState).toMatch(/\S/);
      expect(definition.recovery).toMatch(/\S/);
      expect(definition.proofBoundary).toMatch(/\S/);
    }
  });

  it('keeps recovery and proof boundaries explicit on risky pages', () => {
    expect(PRODUCT_SPINE_DEFINITIONS.import.recovery).toContain('Cancel keeps the current project');
    expect(PRODUCT_SPINE_DEFINITIONS.hardware.nextAction).toContain('Map required pins');
    expect(PRODUCT_SPINE_DEFINITIONS.export.proofBoundary).toContain('Vivado build');
    expect(PRODUCT_SPINE_DEFINITIONS.verify.proofBoundary).toContain('browser E0');
  });

  it('reports progress from the current six-page spine', () => {
    expect(getProductSpineProgress('project')).toBe('1/6');
    expect(getProductSpineProgress('export')).toBe('5/6');
    expect(getProductSpineProgress('import')).toBe('6/6');
  });
});
