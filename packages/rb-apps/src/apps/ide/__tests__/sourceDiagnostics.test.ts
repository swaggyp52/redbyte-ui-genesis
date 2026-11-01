import { describe, expect, it } from 'vitest';
import {
  compareRanges,
  formatDiagnostic,
  offsetAt,
  pointRange,
  position,
  positionAt,
  range,
  rangeContainsPosition,
  rangeFromOffsets,
  sortDiagnostics,
  summarizeDiagnostics,
  type SourceDiagnostic,
} from '../sourceDiagnostics';

const TEXT = 'entity top is\n  port (a : in std_logic);\nend top;\n';

describe('positions and offsets', () => {
  it('maps offset 0 to line 1 column 1', () => {
    expect(positionAt(TEXT, 0)).toEqual({ line: 1, column: 1 });
  });
  it('advances line after a newline', () => {
    // first char of line 2 is right after the first '\n' (offset 14)
    expect(positionAt(TEXT, 14)).toEqual({ line: 2, column: 1 });
  });
  it('clamps out-of-range offsets', () => {
    expect(positionAt(TEXT, -5)).toEqual({ line: 1, column: 1 });
    const end = positionAt(TEXT, 9999);
    expect(end.line).toBe(4);
  });
  it('offsetAt is the inverse of positionAt', () => {
    for (const offset of [0, 3, 13, 14, 20, 40]) {
      const pos = positionAt(TEXT, offset);
      expect(offsetAt(TEXT, pos)).toBe(Math.min(offset, TEXT.length));
    }
  });
  it('builds a range from offsets', () => {
    const r = rangeFromOffsets(TEXT, 0, 6);
    expect(r).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 7 } });
  });
});

describe('range helpers', () => {
  it('containment includes both endpoints', () => {
    const r = range(1, 1, 1, 10);
    expect(rangeContainsPosition(r, position(1, 1))).toBe(true);
    expect(rangeContainsPosition(r, position(1, 10))).toBe(true);
    expect(rangeContainsPosition(r, position(1, 5))).toBe(true);
    expect(rangeContainsPosition(r, position(1, 11))).toBe(false);
    expect(rangeContainsPosition(r, position(2, 1))).toBe(false);
  });
  it('orders ranges by start then end', () => {
    expect(compareRanges(range(1, 1, 1, 2), range(1, 1, 1, 5))).toBeLessThan(0);
    expect(compareRanges(range(2, 1, 2, 2), range(1, 5, 1, 9))).toBeGreaterThan(0);
  });
  it('pointRange is zero-width', () => {
    expect(pointRange(3, 4)).toEqual({ start: { line: 3, column: 4 }, end: { line: 3, column: 4 } });
  });
});

describe('diagnostics ordering and summary', () => {
  const diags: SourceDiagnostic[] = [
    { severity: 'info', message: 'z last', range: range(5, 1, 5, 2) },
    { severity: 'warning', message: 'no location' },
    { severity: 'error', message: 'first', range: range(1, 1, 1, 2) },
    { severity: 'warning', message: 'same range b', range: range(1, 1, 1, 2) },
  ];

  it('sorts located-first, by range, then severity', () => {
    const sorted = sortDiagnostics(diags);
    expect(sorted.map((d) => d.message)).toEqual(['first', 'same range b', 'z last', 'no location']);
  });

  it('summarizes counts and ok flag', () => {
    expect(summarizeDiagnostics(diags)).toEqual({ errors: 1, warnings: 2, infos: 1, ok: false });
    expect(summarizeDiagnostics([{ severity: 'warning', message: 'w' }])).toEqual({
      errors: 0,
      warnings: 1,
      infos: 0,
      ok: true,
    });
  });

  it('formats a located diagnostic with code', () => {
    expect(
      formatDiagnostic({ severity: 'error', message: 'behavioral not supported', code: 'vhdl.behavioral', range: range(3, 5, 3, 12) })
    ).toBe('3:5: [error] behavioral not supported (vhdl.behavioral)');
    expect(formatDiagnostic({ severity: 'info', message: 'file note' })).toBe('[info] file note');
  });
});
