import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import { collectPinAssignments } from './hardwarePinPlanner';

/**
 * Deterministic XDC preview for the pin planner. Given the mapping authority's
 * current document, emit the per-assignment `set_property` lines (PACKAGE_PIN +
 * IOSTANDARD) exactly as the Basys3 constraints will carry them, so the planner
 * can show the precise before/after consequence of a pin edit without leaving
 * Board & Constraints. This is a read-model preview — Build & Export remains the
 * authority for the final packaged XDC.
 */

const DEFAULT_IO_STANDARD = 'LVCMOS33';

/** XDC-safe port token for a design signal (mirrors the export port naming). */
export function xdcPortToken(label: string): string {
  return label.trim().replace(/\s+/g, '_');
}

/** Lines for one mapped assignment, PACKAGE_PIN then IOSTANDARD. */
export function xdcLinesForAssignment(label: string, pin: string, ioStandard: string): string[] {
  const port = xdcPortToken(label);
  return [
    `set_property PACKAGE_PIN ${pin} [get_ports {${port}}]`,
    `set_property IOSTANDARD ${ioStandard} [get_ports {${port}}]`,
  ];
}

/** Deterministic (label-sorted) XDC lines for every mapped assignment in the doc. */
export function buildPlannerXdcLines(doc: HardwareMappingDocumentV2): string[] {
  const rows = collectPinAssignments(doc)
    .filter((row) => row.pin.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const lines: string[] = [];
  for (const row of rows) {
    const ioStandard = row.resource?.ioStandard ?? DEFAULT_IO_STANDARD;
    lines.push(...xdcLinesForAssignment(row.label, row.pin, ioStandard));
  }
  return lines;
}

export interface XdcLineDiff {
  status: 'added' | 'removed' | 'unchanged';
  line: string;
}

export interface XdcDiff {
  before: string[];
  after: string[];
  lines: XdcLineDiff[];
  addedCount: number;
  removedCount: number;
  changed: boolean;
}

/**
 * Diff two XDC line lists (order-independent presence diff): a line only in
 * `after` is added, only in `before` is removed, in both is unchanged. The
 * resulting `lines` are ordered added → removed → unchanged for a stable render.
 */
export function diffXdc(before: string[], after: string[]): XdcDiff {
  const beforeSet = new Map<string, number>();
  for (const line of before) beforeSet.set(line, (beforeSet.get(line) ?? 0) + 1);
  const afterSet = new Map<string, number>();
  for (const line of after) afterSet.set(line, (afterSet.get(line) ?? 0) + 1);

  const allLines = Array.from(new Set([...before, ...after]));
  const added: XdcLineDiff[] = [];
  const removed: XdcLineDiff[] = [];
  const unchanged: XdcLineDiff[] = [];
  for (const line of allLines) {
    const inBefore = (beforeSet.get(line) ?? 0) > 0;
    const inAfter = (afterSet.get(line) ?? 0) > 0;
    if (inAfter && !inBefore) added.push({ status: 'added', line });
    else if (inBefore && !inAfter) removed.push({ status: 'removed', line });
    else unchanged.push({ status: 'unchanged', line });
  }
  const sortByLine = (a: XdcLineDiff, b: XdcLineDiff) => a.line.localeCompare(b.line);
  added.sort(sortByLine);
  removed.sort(sortByLine);
  unchanged.sort(sortByLine);
  return {
    before,
    after,
    lines: [...added, ...removed, ...unchanged],
    addedCount: added.length,
    removedCount: removed.length,
    changed: added.length > 0 || removed.length > 0,
  };
}

/** Convenience: the XDC consequence of applying `after` over `before` documents. */
export function diffPlannerXdc(
  beforeDoc: HardwareMappingDocumentV2,
  afterDoc: HardwareMappingDocumentV2
): XdcDiff {
  return diffXdc(buildPlannerXdcLines(beforeDoc), buildPlannerXdcLines(afterDoc));
}
