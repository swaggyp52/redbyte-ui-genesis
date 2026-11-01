import { describe, expect, it } from 'vitest';
import { materializeIoMappingFromHardwareMappingV2, migrateIoMappingToHardwareMappingV2 } from '@redbyte/rb-utils';
import { addConstraintSet, createEmptyConstraintSets, getConstraintSetMapping, normalizeConstraintSets, removeConstraintSet, setActiveConstraintSet } from '../constraintSets';

const mapping = (pin: string) => migrateIoMappingToHardwareMappingV2({
  inputs: [{ id: 'a', nodeId: 'input-a', port: 'out', label: 'A', pin }], outputs: [],
});

describe('captured constraint authority', () => {
  it('restores captured A after live edits and capture B without interpreting XDC', () => {
    const a = mapping('V17');
    let doc = addConstraintSet(createEmptyConstraintSets(), 'A', 'set_property PACKAGE_PIN V17 [get_ports {A}]', a);
    if (a.entries[0].kind === 'scalar') a.entries[0].pin = 'V16';
    doc = setActiveConstraintSet(doc, null);
    doc = addConstraintSet(doc, 'B', 'set_property PACKAGE_PIN V16 [get_ports {A}]', a);
    doc = setActiveConstraintSet(doc, 'xdc-a');
    expect(materializeIoMappingFromHardwareMappingV2(getConstraintSetMapping(doc, doc.activeId!)).inputs[0].pin).toBe('V17');
    const restored = normalizeConstraintSets(JSON.parse(JSON.stringify(doc)));
    expect(restored.activeId).toBe('xdc-a');
    expect(getConstraintSetMapping(restored, restored.activeId!)).toEqual(mapping('V17'));
  });

  it('preserves reference Tcl without silently promoting parsed pins to mapping authority', () => {
    const raw = 'if {$enabled} { set_property PACKAGE_PIN V17 [get_ports {A}] }';
    const doc = addConstraintSet(createEmptyConstraintSets(), 'Imported constraints', raw);
    expect(doc.sets[0].xdcText).toBe(raw);
    expect(doc.activeId).toBeNull();
    expect(() => setActiveConstraintSet(doc, doc.sets[0].id)).toThrow(/captured mapping/i);
  });

  it('retains explicit live selection through reload and active-set removal', () => {
    let doc = addConstraintSet(createEmptyConstraintSets(), 'A', 'A', mapping('V17'));
    doc = addConstraintSet(doc, 'B', 'B', mapping('V16'));
    expect(normalizeConstraintSets(setActiveConstraintSet(doc, null)).activeId).toBeNull();
    expect(removeConstraintSet(doc, doc.activeId!).activeId).toBeNull();
  });

  it('demotes malformed snapshots to retained references rather than accepting partial mappings', () => {
    const doc = normalizeConstraintSets({
      sets: [{ id: 'bad', name: 'Bad', xdcText: 'reference', mappingSnapshot: { schemaVersion: '2.0', boardId: 'basys3', entries: [{ kind: 'scalar', id: 'a' }] } }],
      activeId: 'bad',
    });
    expect(doc.sets[0].xdcText).toBe('reference');
    expect(doc.sets[0].mappingSnapshot).toBeUndefined();
    expect(doc.activeId).toBeNull();
  });
  it('retains duplicate references but refuses ambiguous persisted activation', () => {
    const doc = normalizeConstraintSets({
      activeId: 'same',
      sets: [
        { id: 'same', name: 'A', xdcText: 'A', mappingSnapshot: mapping('V17') },
        { id: 'same', name: 'B', xdcText: 'B', mappingSnapshot: mapping('V16') },
        { id: 'same-1', name: 'C', xdcText: 'C', mappingSnapshot: mapping('V15') },
      ],
    });
    expect(doc.sets.map(set => set.xdcText)).toEqual(['A', 'B', 'C']);
    expect(new Set(doc.sets.map(set => set.id)).size).toBe(3);
    expect(doc.activeId).toBeNull();
  });

  it('never lets a generated duplicate suffix steal another original selected identity', () => {
    const doc = normalizeConstraintSets({ activeId: 'same-1', sets: [
      { id: 'same', name: 'A', mappingSnapshot: mapping('V17') },
      { id: 'same', name: 'B', mappingSnapshot: mapping('V16') },
      { id: 'same-1', name: 'C', mappingSnapshot: mapping('V15') },
    ] });
    expect(doc.sets.find(set => set.id === doc.activeId)?.name).toBe('C');
    expect(getConstraintSetMapping(doc, doc.activeId!)).toEqual(mapping('V15'));
  });

  it('retains a dangling group as reference text without activating an incomplete map', () => {
    const doc = normalizeConstraintSets({ activeId: 'group', sets: [{ id: 'group', name: 'Incomplete group', xdcText: 'owner reference', mappingSnapshot: {
      schemaVersion: '2.0', boardId: 'basys3', entries: [{ kind: 'group', id: 'g', direction: 'in', portName: 'G', memberIds: ['missing'] }],
    } }] });
    expect(doc.sets[0].xdcText).toBe('owner reference');
    expect(doc.sets[0].mappingSnapshot).toBeUndefined();
    expect(doc.activeId).toBeNull();
  });

});
