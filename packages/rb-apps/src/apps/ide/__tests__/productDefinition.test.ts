import { describe, expect, it } from 'vitest';
import {
  PRODUCT_SPINE_DEFINITIONS,
  PRODUCT_SPINE_ORDER,
  PRODUCT_SURFACE_ORDER,
  PRODUCT_UTILITY_ORDER,
  PRODUCT_WORKFLOW_ORDER,
  UNIFIED_WORKBENCH_V3_SHELL_CONTRACT,
  getProductSpineDefinition,
  getProductSpineProgress,
} from '../productDefinition';

describe('productDefinition', () => {
  it('defines five workflow stages and keeps Import as a utility', () => {
    expect(PRODUCT_WORKFLOW_ORDER).toEqual([
      'project',
      'design',
      'verify',
      'hardware',
      'export',
    ]);
    expect(PRODUCT_SPINE_ORDER).toEqual(PRODUCT_WORKFLOW_ORDER);
    expect(PRODUCT_UTILITY_ORDER).toEqual(['import']);
    expect(PRODUCT_SURFACE_ORDER).toEqual([...PRODUCT_WORKFLOW_ORDER, 'import']);

    for (const page of PRODUCT_SURFACE_ORDER) {
      const definition = getProductSpineDefinition(page);
      expect(definition.key).toBe(page);
      expect(definition.job).toMatch(/\S/);
      expect(definition.primaryObject).toMatch(/\S/);
      expect(definition.stableRegions.length).toBeGreaterThan(2);
      expect(definition.keyStates.length).toBeGreaterThan(2);
      expect(definition.primaryAction).toMatch(/\S/);
      expect(definition.secondaryActions.length).toBeGreaterThan(0);
      expect(definition.emptyState).toMatch(/\S/);
      expect(definition.nextAction).toMatch(/What do I do next\?/);
      expect(definition.doneCondition).toMatch(/\S/);
      expect(definition.blockedState).toMatch(/\S/);
      expect(definition.recovery).toMatch(/\S/);
      expect(definition.owns.length).toBeGreaterThan(0);
      expect(definition.reads.length).toBeGreaterThan(0);
      expect(definition.excludes.length).toBeGreaterThan(0);
      expect(definition.proofBoundary).toMatch(/\S/);
    }

    expect(PRODUCT_SPINE_DEFINITIONS.import.kind).toBe('utility');
    expect(PRODUCT_SPINE_DEFINITIONS.import.order).toBeNull();
  });

  it('keeps mutation ownership and proof boundaries explicit', () => {
    expect(PRODUCT_SPINE_DEFINITIONS.project.proofBoundary).toContain('does not edit mappings');
    expect(PRODUCT_SPINE_DEFINITIONS.design.doneCondition).toContain('structural diagnostic');
    expect(PRODUCT_SPINE_DEFINITIONS.verify.primaryObject).toBe('Simulation Studio');
    expect(PRODUCT_SPINE_DEFINITIONS.hardware.owns).toContain('Package pin assignment');
    expect(PRODUCT_SPINE_DEFINITIONS.export.proofBoundary).toContain('Vivado build');
    expect(PRODUCT_SPINE_DEFINITIONS.import.recovery).toContain('Cancel keeps the current project');
  });

  it('defines one stable Unified Workbench v3 shell grammar', () => {
    expect(UNIFIED_WORKBENCH_V3_SHELL_CONTRACT.stageNavigation).toEqual(PRODUCT_WORKFLOW_ORDER);
    expect(UNIFIED_WORKBENCH_V3_SHELL_CONTRACT.topProductBar).toContain('Import utility');
    expect(UNIFIED_WORKBENCH_V3_SHELL_CONTRACT.pageHeader).toContain('One primary action');
    expect(UNIFIED_WORKBENCH_V3_SHELL_CONTRACT.workspace).toContain('all remaining space');
    expect(UNIFIED_WORKBENCH_V3_SHELL_CONTRACT.forbiddenCorePatterns).toEqual(
      expect.arrayContaining([
        'Permanent workflow side rail',
        'Floating edge rail toggles',
        'Core workflow hidden in details or summary disclosures',
        'Manual hide or show controls for stable work regions',
        'Passive pill clouds',
      ])
    );
  });

  it('reports five-stage progress and utility status', () => {
    expect(getProductSpineProgress('project')).toBe('1/5');
    expect(getProductSpineProgress('export')).toBe('5/5');
    expect(getProductSpineProgress('import')).toBe('Utility');
  });
});
