import { describe, expect, it } from 'vitest';
import { normalizeVectorsForLiveIo, type ProjectIoRow } from '../projectRuntime';

const ROWS: ProjectIoRow[] = [
  { id: 'a_0', nodeId: 'a0', port: 'out', label: 'A[0] (SW0)', direction: 'in', pin: 'V17', required: true },
  { id: 'carry-out', nodeId: 'carry-out', port: 'in', label: 'CARRY (LD4)', direction: 'out', pin: 'V14', required: true },
  { id: 'sum_0', nodeId: 'sum0', port: 'in', label: 'SUM[0] (LD0)', direction: 'out', pin: 'U16', required: true },
];

describe('runtime vector canonicalization against live io rows', () => {
  it('keeps an expectation keyed by the exact row id', () => {
    const [vector] = normalizeVectorsForLiveIo(
      [{ id: 'v0', tick: 0, inputs: { a_0: 1 }, expected: { 'carry-out': 1, sum_0: 0 } }],
      ROWS
    );
    expect(vector.expected).toEqual({ 'carry-out': 1, sum_0: 0 });
  });

  it('resolves the underscore spelling of a hyphenated row id to the row instead of pruning it', () => {
    const [vector] = normalizeVectorsForLiveIo(
      [{ id: 'v0', tick: 0, inputs: { a_0: 1 }, expected: { carry_out: 1 } }],
      ROWS
    );
    expect(vector.expected).toEqual({ 'carry-out': 1 });
  });

  it('still prunes an expectation that names no row', () => {
    const [vector] = normalizeVectorsForLiveIo(
      [{ id: 'v0', tick: 0, inputs: { a_0: 1 }, expected: { nothing_here: 1, sum_0: 1 } }],
      ROWS
    );
    expect(vector.expected).toEqual({ sum_0: 1 });
  });
});
