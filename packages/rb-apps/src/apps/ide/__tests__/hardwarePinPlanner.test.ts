import { describe, expect, it } from 'vitest';
import type { HardwareMappingDocumentV2, HardwareMappingEntryV2 } from '@redbyte/rb-utils';
import {
  buildPinPlannerSummary,
  collectPinAssignments,
  detectPinConflicts,
  validatePinAssignments,
} from '../hardwarePinPlanner';
import {
  applyHardwareMappingV2Edit,
  readAssignmentPin,
} from '../hardwareMappingV2EditorModel';

function doc(entries: HardwareMappingEntryV2[]): HardwareMappingDocumentV2 {
  return { schemaVersion: '2.0', boardId: 'basys3', entries };
}
const scalar = (
  id: string,
  direction: 'in' | 'out',
  pin: string,
  portName = id
): HardwareMappingEntryV2 => ({ id, kind: 'scalar', width: 1 as const, direction, portName, nodeId: `${id}_node`, pin });
const bus2 = (id: string, direction: 'in' | 'out', pins: [string, string]): HardwareMappingEntryV2 => ({
  id,
  kind: 'bus',
  direction,
  portName: id,
  width: 2,
  bits: [
    { id: `${id}-0`, bitIndex: 0, nodeId: `${id}0`, port: `${id}[0]`, pin: pins[0] },
    { id: `${id}-1`, bitIndex: 1, nodeId: `${id}1`, port: `${id}[1]`, pin: pins[1] },
  ],
});

describe('hardwarePinPlanner — projections over the mapping authority', () => {
  it('flattens scalar and bus assignments with electrical resources', () => {
    const rows = collectPinAssignments(doc([scalar('SW0', 'in', 'V17'), bus2('A', 'in', ['W16', 'W17'])]));
    expect(rows.map((r) => r.label)).toEqual(['SW0', 'A[0]', 'A[1]']);
    expect(rows[0].resource?.packagePin).toBe('V17');
    expect(rows[1].resource?.packagePin).toBe('W16');
  });

  it('detects a pin driven by two signals', () => {
    const conflicts = detectPinConflicts(doc([scalar('SW0', 'in', 'V17'), scalar('SW1', 'in', 'V17')]));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].pin).toBe('V17');
    expect(conflicts[0].rows.map((r) => r.entryId).sort()).toEqual(['SW0', 'SW1']);
  });

  it('reports no conflict when pins are distinct', () => {
    expect(detectPinConflicts(doc([scalar('SW0', 'in', 'V17'), scalar('SW1', 'in', 'V16')]))).toHaveLength(0);
  });

  it('flags an unknown pin as an error and a direction mismatch as a warning', () => {
    // U16 is an LED (board output); driving a design INPUT there is a mismatch.
    const issues = validatePinAssignments(doc([scalar('BAD', 'in', 'ZZ99'), scalar('IN_ON_LED', 'in', 'U16')]));
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('unknown-pin');
    expect(codes).toContain('direction-mismatch');
    expect(issues.find((i) => i.code === 'unknown-pin')?.severity).toBe('error');
  });

  it('summarizes mapped vs total', () => {
    const summary = buildPinPlannerSummary(doc([scalar('SW0', 'in', 'V17'), scalar('SW1', 'in', '')]));
    expect(summary.mappedCount).toBe(1);
    expect(summary.totalCount).toBe(2);
  });
});

describe('hardwareMappingV2EditorModel — conflict repair ops', () => {
  it('set_bit_pin assigns a single bus bit', () => {
    const next = applyHardwareMappingV2Edit(doc([bus2('A', 'in', ['W16', ''])]), {
      type: 'set_bit_pin',
      entryId: 'A',
      bitIndex: 1,
      pin: 'W17',
    });
    const entry = next.entries[0];
    expect(readAssignmentPin(entry, 0)).toBe('W16');
    expect(readAssignmentPin(entry, 1)).toBe('W17');
  });

  it('swap_pins exchanges two scalar pins', () => {
    const next = applyHardwareMappingV2Edit(doc([scalar('SW0', 'in', 'V17'), scalar('SW1', 'in', 'V16')]), {
      type: 'swap_pins',
      a: { entryId: 'SW0' },
      b: { entryId: 'SW1' },
    });
    expect(readAssignmentPin(next.entries[0], undefined)).toBe('V16');
    expect(readAssignmentPin(next.entries[1], undefined)).toBe('V17');
  });

  it('resolve_conflict clears the shared pin from all but the kept assignment', () => {
    const conflicted = doc([scalar('SW0', 'in', 'V17'), scalar('SW1', 'in', 'V17')]);
    expect(detectPinConflicts(conflicted)).toHaveLength(1);
    const next = applyHardwareMappingV2Edit(conflicted, {
      type: 'resolve_conflict',
      pin: 'V17',
      keep: { entryId: 'SW0' },
    });
    expect(readAssignmentPin(next.entries[0], undefined)).toBe('V17');
    expect(readAssignmentPin(next.entries[1], undefined)).toBe('');
    expect(detectPinConflicts(next)).toHaveLength(0);
  });

  it('resolve_conflict keeps a specific bus bit', () => {
    // SW0 and A[1] both on W16.
    const conflicted = doc([scalar('SW0', 'in', 'W16'), bus2('A', 'in', ['V17', 'W16'])]);
    expect(detectPinConflicts(conflicted)).toHaveLength(1);
    const next = applyHardwareMappingV2Edit(conflicted, {
      type: 'resolve_conflict',
      pin: 'W16',
      keep: { entryId: 'A', bitIndex: 1 },
    });
    expect(readAssignmentPin(next.entries[0], undefined)).toBe('');
    expect(readAssignmentPin(next.entries[1], 1)).toBe('W16');
    expect(detectPinConflicts(next)).toHaveLength(0);
  });
});
