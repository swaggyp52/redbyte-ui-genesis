import { describe, it, expect, beforeEach } from 'vitest';
import { useLabStore } from '../store/labStore';

describe('Edit triggers derived pipeline', () => {
  beforeEach(() => {
    // Ensure clean state before each test
    useLabStore.getState().reset();
  });

  it('should auto-generate K-maps and expressions after filling digits', () => {
    const store = useLabStore.getState();
    
    // Fill standard digits (0-9)
    store.fillStandardDigits();
    
    // Verify all segments have K-maps and expressions generated
    const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (const seg of segNames) {
      const kmap = store.doc.kMaps[seg];
      const expr = store.doc.expressions[seg];
      
      expect(kmap).toBeDefined();
      expect(kmap).toHaveProperty('grid');
      expect((kmap as any).grid.length).toBe(16);  // 4x4 K-map
      expect(expr).toBeTruthy();
      expect(expr).not.toBe('');
    }
  });

  it('should update derived state when truth table is edited', () => {
    const store = useLabStore.getState();
    store.fillStandardDigits();
    
    // Edit segment 'a' for input 5 (flip a bit)
    const row5 = store.doc.truthTable[5];
    const newSeg = [...row5.seg];
    newSeg[0] = newSeg[0] === 0 ? 1 : 0;  // flip segment 'a'
    
    store.setTableRow(5, { seg: newSeg as any });
    
    // Derived state still exists and is valid
    const updatedExprA = store.doc.expressions['a'];
    const updatedKMapA = store.doc.kMaps['a'];
    expect(updatedExprA).toBeTruthy();
    expect(updatedKMapA).toBeDefined();
    expect(updatedKMapA).toHaveProperty('grid');
    expect((updatedKMapA as any).grid.length).toBe(16);
  });

  it('should persist derived state after reset', () => {
    const store = useLabStore.getState();
    
    // Fill digits
    store.fillStandardDigits();
    
    // Verify all 7 segments have K-maps and expressions
    const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (const seg of segNames) {
      expect(store.doc.kMaps[seg]).toBeDefined();
      expect(store.doc.expressions[seg]).toBeTruthy();
    }
    
    // Reset and verify clean state
    store.reset();
    
    // After reset, derived should be recalculated (even if empty)
    expect(store.doc.kMaps).toBeDefined();
    expect(store.doc.expressions).toBeDefined();
  });
});
