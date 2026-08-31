import { describe, expect, it } from 'vitest';
import type { BusDeclaration } from '@redbyte/rb-logic-core';
import { groupIoRowsIntoBuses, type BusGroupableRow } from '../ioBusGrouping';

const declaration = (overrides: Partial<BusDeclaration> = {}): BusDeclaration => ({
  id: 'bus-in-A',
  name: 'A',
  direction: 'input',
  left: 1,
  right: 0,
  bits: [
    { index: 0, nodeId: 'n-a0' },
    { index: 1, nodeId: 'n-a1' },
  ],
  ...overrides,
});

const rows = (): BusGroupableRow[] => [
  { id: 'row-a0', label: 'A[0]', direction: 'in', pin: 'V17', nodeId: 'n-a0' },
  { id: 'row-a1', label: 'A[1]', direction: 'in', pin: '', nodeId: 'n-a1' },
  { id: 'row-en', label: 'ENABLE', direction: 'in', pin: '', nodeId: 'n-en' },
];

describe('groupIoRowsIntoBuses with declarations', () => {
  it('a declaration owns the grouping and marks the group as declared', () => {
    const groups = groupIoRowsIntoBuses(rows(), [declaration()]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      baseName: 'A',
      declaredBusId: 'bus-in-A',
      declaredDescending: true,
      width: 2,
      contiguous: true,
      unmappedCount: 1,
    });
  });

  it('declared identity survives label drift that would break the label fallback', () => {
    const drifted = rows().map((row) =>
      row.id === 'row-a1' ? { ...row, label: 'HAND_RENAMED' } : row
    );
    const withoutDeclaration = groupIoRowsIntoBuses(drifted);
    expect(withoutDeclaration).toHaveLength(0); // one A[N] row left → no group

    const withDeclaration = groupIoRowsIntoBuses(drifted, [declaration()]);
    expect(withDeclaration).toHaveLength(1);
    expect(withDeclaration[0].members.map((member) => member.rowId).sort()).toEqual([
      'row-a0',
      'row-a1',
    ]);
  });

  it('rows claimed by a declaration never re-group through the label fallback', () => {
    const groups = groupIoRowsIntoBuses(rows(), [declaration()]);
    const memberRowIds = groups.flatMap((group) => group.members.map((member) => member.rowId));
    expect(new Set(memberRowIds).size).toBe(memberRowIds.length);
  });

  it('without declarations the label fallback behaves exactly as before', () => {
    const groups = groupIoRowsIntoBuses(rows());
    expect(groups).toHaveLength(1);
    expect(groups[0].baseName).toBe('A');
    expect(groups[0].declaredBusId).toBeUndefined();
  });
});
