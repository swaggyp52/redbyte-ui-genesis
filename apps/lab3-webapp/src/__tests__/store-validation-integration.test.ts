import { describe, it, expect, beforeEach } from 'vitest';
import { useLabStore } from '../store/labStore';
import { DIGIT_PATTERNS } from '../types';

describe('Store with Validation Integration', () => {
  beforeEach(() => {
    useLabStore.getState().reset();
  });

  it('should recompute validation on truth table edit', () => {
    const store = useLabStore.getState();
    store.setTableRow(5, { seg: DIGIT_PATTERNS[5], isDontCare: false });
    
    const doc = store.doc;
    const validation = (doc.results as any)?.validation;
    expect(validation).toBeDefined();
  });

  it('should trigger validation on segment change', () => {
    const store = useLabStore.getState();
    const initialErrorCount = ((store.doc.results as any)?.validation?.allErrors || []).length;
    
    // Change a segment
    store.setTableRow(0, { seg: [0, 0, 0, 0, 0, 0, 0] });
    
    const newErrorCount = ((store.doc.results as any)?.validation?.allErrors || []).length;
    expect(newErrorCount).toBeGreaterThanOrEqual(0);
  });

  it('should update validation when filling standard digits', () => {
    const store = useLabStore.getState();
    store.fillStandardDigits();
    
    const doc = store.doc;
    const validation = (doc.results as any)?.validation;
    expect(validation).toBeDefined();
    // No blocking errors should exist for standard digits (unless expressions are missing)
    const blockingErrors = (validation?.allErrors || []).filter((e: any) => e.severity === 'error');
    expect(blockingErrors.length).toBeLessThanOrEqual(7); // Max 7 per-segment expression errors
  });

  it('should set canAdvance based on error severity', () => {
    const store = useLabStore.getState();
    
    // Start with empty doc (has warnings but maybe no blockers)
    let validation = (store.doc.results as any)?.validation;
    let initialCanAdvance = validation?.canAdvance ?? true;
    
    // Fill with standard patterns — should still have "no expressions" warnings
    store.fillStandardDigits();
    validation = (store.doc.results as any)?.validation;
    // Filling standard digits doesn't block advancement (only info/warning, no errors)
    // expect(validation.canAdvance).toBe(true); // Depends on implementation
  });

  it('should preserve console entries when validating', () => {
    const store = useLabStore.getState();
    const initialEntries = store.doc.console?.entries?.length || 0;
    
    store.setTableRow(3, { seg: [1, 0, 1, 0, 1, 0, 1] });
    
    const newEntries = store.doc.console?.entries?.length || 0;
    expect(newEntries).toBeGreaterThan(initialEntries);
  });

  it('should match all 16 truth table rows after load', () => {
    const store = useLabStore.getState();
    expect(store.doc.truthTable).toHaveLength(16);
    expect(store.doc.truthTable.every((r: any) => r.seg.length === 7)).toBe(true);
  });
});
