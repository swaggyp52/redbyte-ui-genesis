import type { HardwareMappingDocumentV2, HardwareMappingEntryV2 } from '@redbyte/rb-utils';
import {
  getBasys3BoardResource,
  type Basys3BoardResource,
} from '../../fpga/boards/basys3/basys3Pins';

/**
 * Pin-planner projections over the mapping authority (`hardwareMappingV2`).
 *
 * These are pure read-models: they flatten the document's per-entry pin
 * assignments into a flat, electrically-annotated table, detect pin conflicts
 * (one physical pin driven by two signals), and validate each assignment
 * against the Basys3 board profile. They never mutate the document — edits go
 * through the editor-model ops (set_bit_pin / swap_pins / resolve_conflict).
 */

export interface PinAssignmentRow {
  entryId: string;
  portName: string;
  direction: 'in' | 'out';
  kind: HardwareMappingEntryV2['kind'];
  /** undefined for scalar/bit; the bit index for a bus/slice member. */
  bitIndex?: number;
  /** Display label: `A[2]` for a bus bit, else the port/alias. */
  label: string;
  alias?: string;
  pin: string;
  /** Electrical facts for `pin`, or null if the pin is unmapped/unknown. */
  resource: Basys3BoardResource | null;
}

export interface PinConflict {
  pin: string;
  rows: PinAssignmentRow[];
}

export type PinIssueSeverity = 'error' | 'warning';

export interface PinElectricalIssue {
  entryId: string;
  bitIndex?: number;
  pin: string;
  severity: PinIssueSeverity;
  code: 'unknown-pin' | 'direction-mismatch' | 'unsupported-in-planner';
  message: string;
}

function bitLabel(portName: string, bitIndex: number | undefined): string {
  return bitIndex === undefined ? portName : `${portName}[${bitIndex}]`;
}

/** Flatten every assignment (mapped or not) into a row, newest board order preserved. */
export function collectPinAssignments(doc: HardwareMappingDocumentV2): PinAssignmentRow[] {
  const rows: PinAssignmentRow[] = [];
  const push = (
    entry: Exclude<HardwareMappingEntryV2, { kind: 'group' }>,
    bitIndex: number | undefined,
    pin: string
  ) => {
    const trimmed = (pin ?? '').trim();
    rows.push({
      entryId: entry.id,
      portName: entry.portName,
      direction: entry.direction,
      kind: entry.kind,
      bitIndex,
      label: bitLabel(entry.portName, bitIndex),
      alias: entry.alias,
      pin: trimmed,
      resource: trimmed ? getBasys3BoardResource(trimmed) : null,
    });
  };
  for (const entry of doc.entries) {
    if (entry.kind === 'scalar' || entry.kind === 'bit') {
      push(entry, undefined, entry.pin ?? '');
    } else if (entry.kind === 'slice') {
      entry.pins.forEach((pin, index) => push(entry, index, pin ?? ''));
    } else if (entry.kind === 'bus') {
      entry.bits.forEach((bit) => push(entry, bit.bitIndex, bit.pin ?? ''));
    }
  }
  return rows;
}

/** Group mapped rows by pin; a pin held by ≥2 assignments is a conflict. */
export function detectPinConflicts(doc: HardwareMappingDocumentV2): PinConflict[] {
  const byPin = new Map<string, PinAssignmentRow[]>();
  for (const row of collectPinAssignments(doc)) {
    if (!row.pin) continue;
    const key = row.pin.toUpperCase();
    const bucket = byPin.get(key);
    if (bucket) bucket.push(row);
    else byPin.set(key, [row]);
  }
  const conflicts: PinConflict[] = [];
  for (const [pin, rows] of byPin) {
    if (rows.length > 1) conflicts.push({ pin, rows });
  }
  return conflicts.sort((a, b) => a.pin.localeCompare(b.pin));
}

/** Electrical validation of each mapped assignment against the board profile. */
export function validatePinAssignments(doc: HardwareMappingDocumentV2): PinElectricalIssue[] {
  const issues: PinElectricalIssue[] = [];
  for (const row of collectPinAssignments(doc)) {
    if (!row.pin) continue;
    const resource = row.resource;
    if (!resource) {
      issues.push({
        entryId: row.entryId,
        bitIndex: row.bitIndex,
        pin: row.pin,
        severity: 'error',
        code: 'unknown-pin',
        message: `${row.pin} is not a Basys3 package pin or resource alias.`,
      });
      continue;
    }
    if (!resource.supportedInPlanner) {
      issues.push({
        entryId: row.entryId,
        bitIndex: row.bitIndex,
        pin: row.pin,
        severity: 'warning',
        code: 'unsupported-in-planner',
        message: `${resource.label} (${resource.packagePin}) is not a planner-assignable resource.`,
      });
    }
    // A design input must land on a board input resource, an output on an output
    // (in/out from the board's perspective). `inout`/`system` resources are not
    // flagged — they are handled by dedicated flows (e.g. the clock pin).
    if (
      (resource.direction === 'in' || resource.direction === 'out') &&
      resource.direction !== row.direction
    ) {
      issues.push({
        entryId: row.entryId,
        bitIndex: row.bitIndex,
        pin: row.pin,
        severity: 'warning',
        code: 'direction-mismatch',
        message: `${row.label} is a design ${row.direction === 'in' ? 'input' : 'output'} but ${
          resource.label
        } is a board ${resource.direction === 'in' ? 'input' : 'output'}.`,
      });
    }
  }
  return issues;
}

export interface PinPlannerSummary {
  rows: PinAssignmentRow[];
  conflicts: PinConflict[];
  issues: PinElectricalIssue[];
  mappedCount: number;
  totalCount: number;
}

export function buildPinPlannerSummary(doc: HardwareMappingDocumentV2): PinPlannerSummary {
  const rows = collectPinAssignments(doc);
  return {
    rows,
    conflicts: detectPinConflicts(doc),
    issues: validatePinAssignments(doc),
    mappedCount: rows.filter((row) => row.pin.length > 0).length,
    totalCount: rows.length,
  };
}
