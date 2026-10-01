import { describe, expect, it } from 'vitest';
import { migrateIoMappingToHardwareMappingV2 } from '@redbyte/rb-utils';
import {
  activeConstraintSet,
  addConstraintSet,
  createEmptyConstraintSets,
  normalizeConstraintSets,
  parseActiveConstraintSet,
  removeConstraintSet,
  renameConstraintSet,
  setActiveConstraintSet,
} from '../constraintSets';

const XDC_A = 'set_property PACKAGE_PIN V17 [get_ports {sw0}]\n';
const XDC_B = 'set_property PACKAGE_PIN U16 [get_ports {ld0}]\n';
const MAPPING_A = migrateIoMappingToHardwareMappingV2({ inputs: [{ id: 'sw0', nodeId: 'sw', port: 'out', label: 'sw0', pin: 'V17' }], outputs: [] });
const MAPPING_B = migrateIoMappingToHardwareMappingV2({ inputs: [], outputs: [{ id: 'ld0', nodeId: 'ld', port: 'in', label: 'ld0', pin: 'U16' }] });

describe('constraint sets', () => {
  it('first added set becomes active', () => {
    const doc = addConstraintSet(createEmptyConstraintSets(), 'Basys3', XDC_A, MAPPING_A);
    expect(doc.sets).toHaveLength(1);
    expect(doc.activeId).toBe(doc.sets[0].id);
    expect(activeConstraintSet(doc)?.name).toBe('Basys3');
  });

  it('rejects duplicate names and keeps ids stable across rename', () => {
    let doc = addConstraintSet(createEmptyConstraintSets(), 'Basys3', XDC_A);
    expect(() => addConstraintSet(doc, 'Basys3', XDC_B)).toThrow(/Duplicate/);
    const id = doc.sets[0].id;
    doc = renameConstraintSet(doc, id, 'Basys3 Rev B');
    expect(doc.sets[0].id).toBe(id);
    expect(doc.sets[0].name).toBe('Basys3 Rev B');
  });

  it('switches the active set and reparses the active XDC', () => {
    let doc = addConstraintSet(createEmptyConstraintSets(), 'A', XDC_A, MAPPING_A);
    doc = addConstraintSet(doc, 'B', XDC_B, MAPPING_B);
    expect(activeConstraintSet(doc)?.name).toBe('A');
    const idB = doc.sets.find((s) => s.name === 'B')!.id;
    doc = setActiveConstraintSet(doc, idB);
    expect(activeConstraintSet(doc)?.name).toBe('B');
    const parsed = parseActiveConstraintSet(doc);
    expect(parsed?.pinMap).toMatchObject({ ld0: 'U16' });
  });

  it('removing the active set returns to live mapping without applying another capture', () => {
    let doc = addConstraintSet(createEmptyConstraintSets(), 'A', XDC_A, MAPPING_A);
    doc = addConstraintSet(doc, 'B', XDC_B, MAPPING_B);
    const idA = doc.sets.find((s) => s.name === 'A')!.id;
    doc = removeConstraintSet(doc, idA);
    expect(doc.sets.map((s) => s.name)).toEqual(['B']);
    expect(activeConstraintSet(doc)).toBeUndefined();
    expect(doc.activeId).toBeNull();
  });

  it('removing the last set leaves no active set', () => {
    let doc = addConstraintSet(createEmptyConstraintSets(), 'A', XDC_A);
    doc = removeConstraintSet(doc, doc.sets[0].id);
    expect(doc.sets).toEqual([]);
    expect(doc.activeId).toBeNull();
    expect(parseActiveConstraintSet(doc)).toBeUndefined();
  });

  it('normalizes malformed input and retains reference sets without assigning authority', () => {
    const doc = normalizeConstraintSets({
      sets: [
        { name: 'A', xdcText: XDC_A },
        { name: '', xdcText: 'dropped' },
        { id: 'dup', name: 'B', xdcText: XDC_B },
        { id: 'dup', name: 'C', xdcText: '' },
      ],
      activeId: 'nonexistent',
    });
    expect(doc.sets.map((s) => s.name)).toEqual(['A', 'B', 'C']);
    // ids deduped
    expect(new Set(doc.sets.map((s) => s.id)).size).toBe(3);
    expect(doc.activeId).toBeNull();
  });
});
