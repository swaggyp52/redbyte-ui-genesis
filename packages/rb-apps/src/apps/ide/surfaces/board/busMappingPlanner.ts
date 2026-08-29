/**
 * Bus mapping planner — a PURE proposal engine for assigning the bits of a
 * logical bus onto scalar board resources.
 *
 * RedByte's mapping runtime is scalar-only: a bus like A[3:0] exists as a
 * family of scalar rows. The shipped four-bit-adder example uses the
 * digit-suffix convention (`a0`..`a3` row ids, `A0 (SW0)`..`A3 (SW6)` labels),
 * so `suffix` is the default naming convention; the bracket convention
 * (`A[3]`) is also supported and auto-detected from existing signal names.
 *
 * The planner EMITS a proposal — it never mutates any store. Applying a
 * proposal is the caller's job (sequential `onSetMappingPin(rowId, pin)`
 * calls, or one `setMappingPins` batch where the runtime bulk API is wired).
 */

export type BusBitOrder = 'lsb-first' | 'msb-first';
export type BusNamingConvention = 'suffix' | 'bracket';

export interface BusSpec {
  /** Base bus name, e.g. "A". A trailing "[msb:lsb]" range is stripped. */
  busName: string;
  /** Number of bits. Must be a positive integer. */
  width: number;
  /** Which bit the first assigned resource receives. */
  bitOrder: BusBitOrder;
  /** When set, only direction-compatible resources are candidates. */
  direction?: 'in' | 'out';
  /** Naming convention for emitted logical names. Default: 'suffix'. */
  convention?: BusNamingConvention;
}

/** Structural subtype of Basys3BoardResource — profile resources satisfy it. */
export interface BusPlannerResourceInput {
  readonly alias: string;
  readonly packagePin: string;
  readonly direction: 'in' | 'out' | 'inout' | 'system';
}

export interface ExistingBusAssignment {
  /** Logical signal that currently owns the resource. */
  readonly logical: string;
  readonly packagePin: string;
}

export interface BusPlannerOptions {
  /** Walk the candidate resource pool from the end backwards. */
  reverse?: boolean;
  /** Skip this many candidate resources before assigning. Default 0. */
  offset?: number;
  /** Skip resources occupied by another signal instead of conflicting. */
  skipOccupied?: boolean;
}

export interface BusBitAssignment {
  bit: number;
  logical: string;
  resource: string;
  packagePin: string;
}

export type BusPlannerConflictKind =
  | 'occupied'
  | 'insufficient-resources'
  | 'invalid-width'
  | 'invalid-offset';

export interface BusPlannerConflict {
  kind: BusPlannerConflictKind;
  bit?: number;
  logical?: string;
  resource?: string;
  packagePin?: string;
  /** Logical signal currently owning the contested resource. */
  owner?: string;
  message: string;
}

export interface BusMappingProposal {
  assignments: BusBitAssignment[];
  conflicts: BusPlannerConflict[];
}

/** Strip a trailing "[msb:lsb]" range and whitespace from a bus name. */
export function normalizeBusBaseName(busName: string): string {
  return busName.trim().replace(/\[\d+:\d+\]$/, '').trim();
}

/** Format one bus bit's logical signal name in the given convention. */
export function formatBusBitLogical(
  busName: string,
  bit: number,
  convention: BusNamingConvention
): string {
  const base = normalizeBusBaseName(busName);
  return convention === 'bracket' ? `${base}[${bit}]` : `${base}${bit}`;
}

/**
 * Detect which scalar naming convention existing signals use for a bus.
 * Falls back to 'suffix' — the convention the four-bit-adder example uses.
 */
export function detectBusNamingConvention(
  existingLogicalNames: readonly string[],
  busName: string
): BusNamingConvention {
  const base = normalizeBusBaseName(busName);
  if (!base) return 'suffix';
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bracketPattern = new RegExp(`^${escaped}\\[\\d+\\]$`, 'i');
  const suffixPattern = new RegExp(`^${escaped}\\d+$`, 'i');
  let sawBracket = false;
  let sawSuffix = false;
  for (const name of existingLogicalNames) {
    const trimmed = name.trim();
    if (bracketPattern.test(trimmed)) sawBracket = true;
    else if (suffixPattern.test(trimmed)) sawSuffix = true;
  }
  if (sawBracket && !sawSuffix) return 'bracket';
  return 'suffix';
}

function isDirectionCompatible(
  resource: BusPlannerResourceInput,
  direction: 'in' | 'out' | undefined
): boolean {
  if (!direction) return true;
  return resource.direction === 'inout' || resource.direction === direction;
}

/**
 * Plan the bus-to-resource assignment. Pure and deterministic.
 *
 * - Bits are walked `lsb-first` (0..width-1) or `msb-first` (width-1..0).
 * - Candidate resources are the direction-compatible entries of `resources`
 *   in their given order, deduplicated by package pin; `reverse` walks that
 *   pool backwards; `offset` skips the first N candidates of the walk.
 * - A resource owned by another logical signal either conflicts (default) or
 *   is skipped (`skipOccupied`). A resource already owned by the exact bit
 *   signal being emitted is a clean, idempotent assignment.
 * - Bits left without a resource produce `insufficient-resources` conflicts —
 *   this is also how a width/resource-count mismatch surfaces.
 */
export function planBusMapping(
  spec: BusSpec,
  resources: readonly BusPlannerResourceInput[],
  existingAssignments: readonly ExistingBusAssignment[],
  options: BusPlannerOptions = {}
): BusMappingProposal {
  const conflicts: BusPlannerConflict[] = [];
  const assignments: BusBitAssignment[] = [];

  if (!Number.isInteger(spec.width) || spec.width < 1) {
    return {
      assignments,
      conflicts: [
        {
          kind: 'invalid-width',
          message: `Bus width must be a positive integer; received ${spec.width}.`,
        },
      ],
    };
  }
  const offset = options.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    return {
      assignments,
      conflicts: [
        {
          kind: 'invalid-offset',
          message: `Offset must be a non-negative integer; received ${offset}.`,
        },
      ],
    };
  }

  const convention = spec.convention ?? 'suffix';

  const seenPins = new Set<string>();
  const candidates: BusPlannerResourceInput[] = [];
  for (const resource of resources) {
    if (!isDirectionCompatible(resource, spec.direction)) continue;
    const pinKey = resource.packagePin.toUpperCase();
    if (seenPins.has(pinKey)) continue;
    seenPins.add(pinKey);
    candidates.push(resource);
  }
  if (options.reverse) candidates.reverse();
  const pool = candidates.slice(offset);

  const ownerByPin = new Map<string, string>();
  for (const assignment of existingAssignments) {
    const pinKey = assignment.packagePin.trim().toUpperCase();
    if (!pinKey || ownerByPin.has(pinKey)) continue;
    ownerByPin.set(pinKey, assignment.logical);
  }

  const bits: number[] = [];
  for (let bit = 0; bit < spec.width; bit += 1) bits.push(bit);
  if (spec.bitOrder === 'msb-first') bits.reverse();

  let poolIndex = 0;
  for (const bit of bits) {
    const logical = formatBusBitLogical(spec.busName, bit, convention);

    let placed = false;
    while (poolIndex < pool.length) {
      const resource = pool[poolIndex];
      poolIndex += 1;
      const owner = ownerByPin.get(resource.packagePin.toUpperCase());
      const ownedByOther = Boolean(
        owner && owner.trim().toUpperCase() !== logical.trim().toUpperCase()
      );
      if (ownedByOther) {
        if (options.skipOccupied) continue;
        conflicts.push({
          kind: 'occupied',
          bit,
          logical,
          resource: resource.alias,
          packagePin: resource.packagePin,
          owner,
          message: `${resource.alias} (pin ${resource.packagePin}) is already assigned to ${owner}; ${logical} needs a repair decision.`,
        });
        placed = true; // the bit consumed its resource slot; unresolved via conflict
        break;
      }
      assignments.push({
        bit,
        logical,
        resource: resource.alias,
        packagePin: resource.packagePin,
      });
      placed = true;
      break;
    }

    if (!placed) {
      conflicts.push({
        kind: 'insufficient-resources',
        bit,
        logical,
        message: `No compatible board resource remains for ${logical} (bit ${bit}).`,
      });
    }
  }

  return { assignments, conflicts };
}

/**
 * Match a proposal's logical bit names to concrete mapping rows so a caller
 * can apply it through the existing mutation callbacks
 * (`onSetMappingPin(rowId, pin)` per row, in order). Pure.
 *
 * Rows match by id, nodeId, or either half of a "PREFIX (PAREN)" label,
 * case-insensitively — this covers the four-bit-adder fixture where the row
 * id is `a0` and the label is `A0 (SW0)`.
 */
export interface BusProposalRowTarget {
  rowId: string;
  pin: string;
  logical: string;
}

export interface BusProposalRowResolution {
  targets: BusProposalRowTarget[];
  /** Assignments whose logical name matched no mapping row. */
  unmatched: BusBitAssignment[];
}

export function resolveProposalRowTargets(
  proposal: BusMappingProposal,
  mappingRows: readonly { id: string; nodeId?: string; label: string }[]
): BusProposalRowResolution {
  const rowIdByKey = new Map<string, string>();
  const register = (key: string | undefined, rowId: string): void => {
    const normalized = key?.replace(/\s+/g, ' ').trim().toUpperCase();
    if (!normalized || rowIdByKey.has(normalized)) return;
    rowIdByKey.set(normalized, rowId);
  };
  for (const row of mappingRows) {
    register(row.id, row.id);
    register(row.nodeId, row.id);
    const label = row.label.replace(/\s+/g, ' ').trim();
    register(label, row.id);
    const parenthetical = label.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (parenthetical) {
      register(parenthetical[1], row.id);
      register(parenthetical[2], row.id);
    }
  }

  const targets: BusProposalRowTarget[] = [];
  const unmatched: BusBitAssignment[] = [];
  for (const assignment of proposal.assignments) {
    const rowId = rowIdByKey.get(assignment.logical.trim().toUpperCase());
    if (rowId) {
      targets.push({ rowId, pin: assignment.packagePin, logical: assignment.logical });
    } else {
      unmatched.push(assignment);
    }
  }
  return { targets, unmatched };
}
