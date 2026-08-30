import { describe, expect, it } from 'vitest';
import type { BusDeclaration } from '@redbyte/rb-logic-core';
import { assembleBusWordLanes, busWordAtTick, type BusWordTimelineRow } from '../busWordLanes';

function bus(name: string, direction: 'input' | 'output', left: number, right: number): BusDeclaration {
  const bits = [];
  for (let i = left; i >= right; i -= 1) bits.push({ index: i, nodeId: `${name}${i}` });
  return { id: `bus-${direction}-${name}`, name, direction, left, right, bits };
}

/** A member lane with one value per tick (ticks inferred from the array index). */
function lane(signal: string, values: string[]): BusWordTimelineRow {
  return { signal, values: values.map((value, tick) => ({ tick, value })) };
}

describe('assembleBusWordLanes', () => {
  const ticks = [0, 1];

  it('collapses member bit lanes into an MSB-first word (binary, hex, decimal)', () => {
    // A[3:0] = 1010 at t0, 0011 at t1.
    const signals: BusWordTimelineRow[] = [
      lane('A[3]', ['1', '0']),
      lane('A[2]', ['0', '0']),
      lane('A[1]', ['1', '1']),
      lane('A[0]', ['0', '1']),
    ];
    const lanes = assembleBusWordLanes([bus('A', 'input', 3, 0)], signals, ticks);
    expect(lanes).toHaveLength(1);
    const a = lanes[0];
    expect(a.rangeLabel).toBe('A[3:0]');
    expect(a.width).toBe(4);
    expect(a.memberSignals).toEqual(['A[3]', 'A[2]', 'A[1]', 'A[0]']);
    expect(a.cells[0]).toMatchObject({ tick: 0, binary: '1010', hex: '0xA', decimal: 10, known: true });
    expect(a.cells[1]).toMatchObject({ tick: 1, binary: '0011', hex: '0x3', decimal: 3, known: true });
  });

  it('preserves X/Z — one unknown bit makes the whole word unknown', () => {
    const signals: BusWordTimelineRow[] = [
      lane('Y[1]', ['1', 'X']),
      lane('Y[0]', ['0', '1']),
    ];
    const lanes = assembleBusWordLanes([bus('Y', 'output', 1, 0)], signals, ticks);
    expect(lanes[0].cells[0]).toMatchObject({ binary: '10', decimal: 2, known: true });
    const unknown = lanes[0].cells[1];
    expect(unknown.known).toBe(false);
    expect(unknown.decimal).toBeNull();
    expect(unknown.binary).toBe('X1');
    expect(unknown.hex).toContain('?');
  });

  it('treats a missing member bit as unknown rather than zero', () => {
    // Only A[1] observed; A[0] never appears in the run.
    const signals: BusWordTimelineRow[] = [lane('A[1]', ['1'])];
    const lanes = assembleBusWordLanes([bus('A', 'input', 1, 0)], signals, [0]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].cells[0].known).toBe(false);
    expect(lanes[0].cells[0].decimal).toBeNull();
  });

  it('skips a bus whose members are absent from the run', () => {
    const signals: BusWordTimelineRow[] = [lane('other', ['1'])];
    expect(assembleBusWordLanes([bus('A', 'input', 3, 0)], signals, [0])).toEqual([]);
  });

  it('assembles ascending buses MSB-first from the high index', () => {
    // A[0:3] ascending: MSB is index 3.
    const signals: BusWordTimelineRow[] = [
      lane('A[0]', ['1']),
      lane('A[1]', ['0']),
      lane('A[2]', ['0']),
      lane('A[3]', ['0']),
    ];
    const lanes = assembleBusWordLanes([bus('A', 'input', 0, 3)], signals, [0]);
    expect(lanes[0].memberSignals).toEqual(['A[3]', 'A[2]', 'A[1]', 'A[0]']);
    // MSB=A[3]=0 … LSB=A[0]=1 → 0001 = 1.
    expect(lanes[0].cells[0]).toMatchObject({ binary: '0001', decimal: 1 });
  });

  it('busWordAtTick returns the selected tick, or the last cell when tick is null', () => {
    const signals: BusWordTimelineRow[] = [lane('A[1]', ['1', '0']), lane('A[0]', ['0', '1'])];
    const [a] = assembleBusWordLanes([bus('A', 'input', 1, 0)], signals, ticks);
    expect(busWordAtTick(a, 0)?.decimal).toBe(2);
    expect(busWordAtTick(a, 1)?.decimal).toBe(1);
    expect(busWordAtTick(a, null)?.decimal).toBe(1);
    expect(busWordAtTick(a, 99)).toBeNull();
  });
});
