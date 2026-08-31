// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Source diagnostics with 1-based line/column ranges.
 *
 * A neutral, parser-agnostic model that any RedByte source parser (VHDL,
 * Verilog, SystemVerilog, XDC, VCD) can emit into, so the workbench can render
 * problems uniformly and cross-probe from a diagnostic back to a source range.
 * Positions are 1-based (line 1, column 1 = first character), matching how
 * editors present locations to a human.
 *
 * Deterministic: no wall-clock or random values; sorting is stable and total.
 */

export interface SourcePosition {
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface SourceDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  /** Optional stable machine code, e.g. `vhdl.behavioral-unsupported`. */
  code?: string;
  /** Optional producer label, e.g. `vhdl-parser`. */
  source?: string;
  /** Optional location; file-level diagnostics may omit it. */
  range?: SourceRange;
}

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };

export function position(line: number, column: number): SourcePosition {
  return { line, column };
}

export function range(startLine: number, startColumn: number, endLine: number, endColumn: number): SourceRange {
  return { start: { line: startLine, column: startColumn }, end: { line: endLine, column: endColumn } };
}

/** A zero-width range anchored at a single position (a caret). */
export function pointRange(line: number, column: number): SourceRange {
  return { start: { line, column }, end: { line, column } };
}

/**
 * Convert a 0-based character offset into a 1-based line/column position.
 * Newlines are counted by `\n`; a preceding `\r` is treated as part of the line.
 */
export function positionAt(text: string, offset: number): SourcePosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

/** Convert a 1-based line/column position into a 0-based character offset. */
export function offsetAt(text: string, pos: SourcePosition): number {
  const targetLine = Math.max(1, pos.line);
  const targetColumn = Math.max(1, pos.column);
  let line = 1;
  let i = 0;
  while (line < targetLine && i < text.length) {
    if (text.charCodeAt(i) === 10) line += 1;
    i += 1;
  }
  const offset = i + (targetColumn - 1);
  return Math.max(0, Math.min(offset, text.length));
}

/** Build a range spanning a substring given by 0-based [startOffset, endOffset). */
export function rangeFromOffsets(text: string, startOffset: number, endOffset: number): SourceRange {
  return { start: positionAt(text, startOffset), end: positionAt(text, endOffset) };
}

export function comparePositions(a: SourcePosition, b: SourcePosition): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.column - b.column;
}

export function compareRanges(a: SourceRange, b: SourceRange): number {
  const startDelta = comparePositions(a.start, b.start);
  if (startDelta !== 0) return startDelta;
  return comparePositions(a.end, b.end);
}

/** True when `position` lies within `range` (inclusive of both endpoints). */
export function rangeContainsPosition(r: SourceRange, pos: SourcePosition): boolean {
  return comparePositions(r.start, pos) <= 0 && comparePositions(pos, r.end) <= 0;
}

/**
 * Stable, total ordering: located diagnostics first (by range), then unlocated;
 * within the same range, by severity (error, warning, info), then message.
 */
export function sortDiagnostics(diagnostics: readonly SourceDiagnostic[]): SourceDiagnostic[] {
  return diagnostics.slice().sort((a, b) => {
    if (a.range && b.range) {
      const rangeDelta = compareRanges(a.range, b.range);
      if (rangeDelta !== 0) return rangeDelta;
    } else if (a.range && !b.range) {
      return -1;
    } else if (!a.range && b.range) {
      return 1;
    }
    const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDelta !== 0) return severityDelta;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });
}

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
  infos: number;
  /** True when there are no error-severity diagnostics. */
  ok: boolean;
}

export function summarizeDiagnostics(diagnostics: readonly SourceDiagnostic[]): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') errors += 1;
    else if (diagnostic.severity === 'warning') warnings += 1;
    else infos += 1;
  }
  return { errors, warnings, infos, ok: errors === 0 };
}

/** Human-readable one-line form: `line:col: [severity] message (code)`. */
export function formatDiagnostic(diagnostic: SourceDiagnostic): string {
  const where = diagnostic.range ? `${diagnostic.range.start.line}:${diagnostic.range.start.column}: ` : '';
  const code = diagnostic.code ? ` (${diagnostic.code})` : '';
  return `${where}[${diagnostic.severity}] ${diagnostic.message}${code}`;
}
