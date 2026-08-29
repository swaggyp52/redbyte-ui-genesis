import { describe, expect, it } from 'vitest';
import {
  detectBusNamingConvention,
  formatBusBitLogical,
  normalizeBusBaseName,
  planBusMapping,
  resolveProposalRowTargets,
  type BusSpec,
} from '../busMappingPlanner';
import { listBasys3BoardResources } from '../../../../../fpga/boards/basys3/basys3Pins';

const SWITCHES = listBasys3BoardResources({ category: 'switch' });
const LEDS = listBasys3BoardResources({ category: 'led' });

function spec(overrides: Partial<BusSpec> = {}): BusSpec {
  return { busName: 'A', width: 4, bitOrder: 'lsb-first', direction: 'in', ...overrides };
}

describe('planBusMapping', () => {
  it('plans a clean lsb-first bus onto switches in order', () => {
    const proposal = planBusMapping(spec(), SWITCHES, []);
    expect(proposal.conflicts).toEqual([]);
    expect(proposal.assignments).toEqual([
      { bit: 0, logical: 'A0', resource: 'SW0', packagePin: 'V17' },
      { bit: 1, logical: 'A1', resource: 'SW1', packagePin: 'V16' },
      { bit: 2, logical: 'A2', resource: 'SW2', packagePin: 'W16' },
      { bit: 3, logical: 'A3', resource: 'SW3', packagePin: 'W17' },
    ]);
  });

  it('gives the first resource the MSB when bitOrder is msb-first', () => {
    const proposal = planBusMapping(spec({ bitOrder: 'msb-first' }), SWITCHES, []);
    expect(proposal.assignments[0]).toEqual({
      bit: 3,
      logical: 'A3',
      resource: 'SW0',
      packagePin: 'V17',
    });
    expect(proposal.assignments.at(-1)).toEqual({
      bit: 0,
      logical: 'A0',
      resource: 'SW3',
      packagePin: 'W17',
    });
  });

  it('walks the resource pool backwards with reverse', () => {
    const proposal = planBusMapping(spec(), SWITCHES, [], { reverse: true });
    expect(proposal.assignments[0]).toEqual({
      bit: 0,
      logical: 'A0',
      resource: 'SW15',
      packagePin: 'R2',
    });
    expect(proposal.assignments[1].resource).toBe('SW14');
  });

  it('skips the first N candidates with offset', () => {
    const proposal = planBusMapping(spec(), SWITCHES, [], { offset: 2 });
    expect(proposal.assignments[0]).toEqual({
      bit: 0,
      logical: 'A0',
      resource: 'SW2',
      packagePin: 'W16',
    });
    expect(proposal.conflicts).toEqual([]);
  });

  it('skips occupied resources when skipOccupied is set', () => {
    const proposal = planBusMapping(
      spec(),
      SWITCHES,
      [{ logical: 'OTHER', packagePin: 'V16' }], // SW1 taken
      { skipOccupied: true }
    );
    expect(proposal.conflicts).toEqual([]);
    expect(proposal.assignments.map((entry) => entry.resource)).toEqual([
      'SW0',
      'SW2',
      'SW3',
      'SW4',
    ]);
  });

  it('emits an occupied conflict (and no assignment) without skipOccupied', () => {
    const proposal = planBusMapping(spec(), SWITCHES, [
      { logical: 'OTHER', packagePin: 'V16' },
    ]);
    expect(proposal.assignments.map((entry) => entry.logical)).toEqual(['A0', 'A2', 'A3']);
    expect(proposal.conflicts).toHaveLength(1);
    expect(proposal.conflicts[0]).toMatchObject({
      kind: 'occupied',
      bit: 1,
      logical: 'A1',
      resource: 'SW1',
      packagePin: 'V16',
      owner: 'OTHER',
    });
  });

  it('treats a resource already owned by the same bit signal as clean', () => {
    const proposal = planBusMapping(spec(), SWITCHES, [
      { logical: 'A0', packagePin: 'V17' },
    ]);
    expect(proposal.conflicts).toEqual([]);
    expect(proposal.assignments[0]).toMatchObject({ logical: 'A0', resource: 'SW0' });
  });

  it('reports insufficient resources per unplaced bit on width mismatch', () => {
    const proposal = planBusMapping(spec(), SWITCHES.slice(0, 2), []);
    expect(proposal.assignments).toHaveLength(2);
    expect(proposal.conflicts).toHaveLength(2);
    expect(proposal.conflicts.map((conflict) => conflict.kind)).toEqual([
      'insufficient-resources',
      'insufficient-resources',
    ]);
    expect(proposal.conflicts.map((conflict) => conflict.bit)).toEqual([2, 3]);
  });

  it('rejects a non-positive width', () => {
    const proposal = planBusMapping(spec({ width: 0 }), SWITCHES, []);
    expect(proposal.assignments).toEqual([]);
    expect(proposal.conflicts[0].kind).toBe('invalid-width');
  });

  it('rejects a negative offset', () => {
    const proposal = planBusMapping(spec(), SWITCHES, [], { offset: -1 });
    expect(proposal.assignments).toEqual([]);
    expect(proposal.conflicts[0].kind).toBe('invalid-offset');
  });

  it('filters direction-incompatible resources out of the candidate pool', () => {
    const proposal = planBusMapping(spec({ width: 2 }), [...LEDS, ...SWITCHES], []);
    expect(proposal.assignments.map((entry) => entry.resource)).toEqual(['SW0', 'SW1']);
  });

  it('emits bracket-convention names when asked', () => {
    const proposal = planBusMapping(spec({ width: 2, convention: 'bracket' }), SWITCHES, []);
    expect(proposal.assignments.map((entry) => entry.logical)).toEqual(['A[0]', 'A[1]']);
  });
});

describe('naming convention helpers', () => {
  it('defaults to the four-bit-adder suffix convention', () => {
    expect(detectBusNamingConvention([], 'A')).toBe('suffix');
    expect(detectBusNamingConvention(['a0', 'a1', 'b0'], 'A')).toBe('suffix');
  });

  it('detects bracket naming when existing signals use it exclusively', () => {
    expect(detectBusNamingConvention(['A[0]', 'A[1]'], 'A')).toBe('bracket');
    // Mixed conventions fall back to suffix.
    expect(detectBusNamingConvention(['A[0]', 'A1'], 'A')).toBe('suffix');
  });

  it('strips a trailing range from the bus name', () => {
    expect(normalizeBusBaseName('A[3:0]')).toBe('A');
    expect(formatBusBitLogical('A[3:0]', 2, 'suffix')).toBe('A2');
    expect(formatBusBitLogical('A', 2, 'bracket')).toBe('A[2]');
  });
});

describe('resolveProposalRowTargets', () => {
  const ADDER_ROWS = [
    { id: 'a0', nodeId: 'a0', label: 'A0 (SW0)' },
    { id: 'a1', nodeId: 'a1', label: 'A1 (SW2)' },
    { id: 'a2', nodeId: 'a2', label: 'A2 (SW4)' },
    { id: 'a3', nodeId: 'a3', label: 'A3 (SW6)' },
    { id: 'carry', nodeId: 'carry-out', label: 'LD4 (CARRY)' },
  ];

  it('matches suffix-convention assignments to four-bit-adder rows by id/label', () => {
    const proposal = planBusMapping(spec(), SWITCHES, []);
    const resolution = resolveProposalRowTargets(proposal, ADDER_ROWS);
    expect(resolution.unmatched).toEqual([]);
    expect(resolution.targets).toEqual([
      { rowId: 'a0', pin: 'V17', logical: 'A0' },
      { rowId: 'a1', pin: 'V16', logical: 'A1' },
      { rowId: 'a2', pin: 'W16', logical: 'A2' },
      { rowId: 'a3', pin: 'W17', logical: 'A3' },
    ]);
  });

  it('reports assignments with no matching row as unmatched', () => {
    const proposal = planBusMapping(spec({ busName: 'Q', width: 1 }), SWITCHES, []);
    const resolution = resolveProposalRowTargets(proposal, ADDER_ROWS);
    expect(resolution.targets).toEqual([]);
    expect(resolution.unmatched).toHaveLength(1);
    expect(resolution.unmatched[0].logical).toBe('Q0');
  });
});
