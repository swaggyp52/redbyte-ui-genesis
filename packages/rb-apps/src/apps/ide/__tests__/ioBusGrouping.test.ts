import { describe, expect, it } from 'vitest';
import {
  groupIoRowsIntoBuses,
  parseBusMemberLabel,
  planBusAssignment,
  type IoBusGroup,
} from '../ioBusGrouping';

const ROWS = [
  { id: 'a0', label: 'A[0]', direction: 'in' as const, pin: '' },
  { id: 'a1', label: 'A[1]', direction: 'in' as const, pin: '' },
  { id: 'a2', label: 'A[2]', direction: 'in' as const, pin: 'W16' },
  { id: 'a3', label: 'A[3]', direction: 'in' as const, pin: '' },
  { id: 'sum0', label: 'SUM[0]', direction: 'out' as const, pin: '' },
  { id: 'sum1', label: 'SUM[1]', direction: 'out' as const, pin: '' },
  { id: 'carry', label: 'CARRY', direction: 'out' as const, pin: '' },
  { id: 'lone', label: 'B[0]', direction: 'in' as const, pin: '' },
];

describe('parseBusMemberLabel', () => {
  it('accepts the same explicit form the export vectorizer accepts', () => {
    expect(parseBusMemberLabel('A[3]')).toEqual({ baseName: 'A', bitIndex: 3 });
    expect(parseBusMemberLabel('data_bus[12]')).toEqual({ baseName: 'data_bus', bitIndex: 12 });
    expect(parseBusMemberLabel('CARRY')).toBeNull();
    expect(parseBusMemberLabel('A3')).toBeNull();
    expect(parseBusMemberLabel('')).toBeNull();
  });
});

describe('groupIoRowsIntoBuses', () => {
  it('groups explicit vector labels per direction and ignores singletons', () => {
    const groups = groupIoRowsIntoBuses(ROWS);
    expect(groups.map((g) => `${g.baseName}:${g.direction}`)).toEqual(['A:in', 'SUM:out']);
    const a = groups[0];
    expect(a.width).toBe(4);
    expect(a.lsb).toBe(0);
    expect(a.msb).toBe(3);
    expect(a.contiguous).toBe(true);
    expect(a.unmappedCount).toBe(3);
    expect(a.members.map((m) => m.bitIndex)).toEqual([0, 1, 2, 3]);
  });

  it('flags non-contiguous groups', () => {
    const groups = groupIoRowsIntoBuses([
      { id: 'q0', label: 'Q[0]', direction: 'out', pin: '' },
      { id: 'q2', label: 'Q[2]', direction: 'out', pin: '' },
    ]);
    expect(groups[0].contiguous).toBe(false);
  });
});

describe('planBusAssignment', () => {
  const RESOURCES = new Map(
    Array.from({ length: 16 }, (_, index) => [`SW${index}`, { packagePin: `P-SW${index}` }])
  );
  const group = (): IoBusGroup => groupIoRowsIntoBuses(ROWS)[0];

  it('maps LSB-first from the start index and reports occupancy', () => {
    const plan = planBusAssignment({
      group: group(),
      familyPrefix: 'SW',
      startIndex: 4,
      reverse: false,
      resolveResource: (alias) => RESOURCES.get(alias) ?? null,
      ownerByPin: new Map([['P-SW5', { rowId: 'other', label: 'RESET' }]]),
    });
    expect(plan.map((p) => `${p.label}→${p.resourceAlias}`)).toEqual([
      'A[0]→SW4',
      'A[1]→SW5',
      'A[2]→SW6',
      'A[3]→SW7',
    ]);
    expect(plan[1].state).toBe('occupied');
    expect(plan[1].occupiedBy).toBe('RESET');
    expect(plan[0].state).toBe('ok');
  });

  it('reverses so the MSB takes the start index', () => {
    const plan = planBusAssignment({
      group: group(),
      familyPrefix: 'SW',
      startIndex: 0,
      reverse: true,
      resolveResource: (alias) => RESOURCES.get(alias) ?? null,
      ownerByPin: new Map(),
    });
    expect(plan.map((p) => `${p.label}→${p.resourceAlias}`)).toEqual([
      'A[3]→SW0',
      'A[2]→SW1',
      'A[1]→SW2',
      'A[0]→SW3',
    ]);
  });

  it('marks aliases beyond the family as unavailable and self-assignments as such', () => {
    const plan = planBusAssignment({
      group: group(),
      familyPrefix: 'SW',
      startIndex: 14,
      reverse: false,
      resolveResource: (alias) => RESOURCES.get(alias) ?? null,
      ownerByPin: new Map([['P-SW14', { rowId: 'a0', label: 'A[0]' }]]),
    });
    expect(plan[0].state).toBe('already-assigned-here');
    expect(plan[2].state).toBe('unavailable');
    expect(plan[3].state).toBe('unavailable');
  });
});
