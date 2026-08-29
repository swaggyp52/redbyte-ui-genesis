// Copyright © 2026 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * First-class bus authority.
 *
 * A bus is a declared vector signal over scalar boundary nodes. The scalar
 * nodes remain the propagation substrate (the engine stays bit-level, exactly
 * as the elaborate/export pipeline already bit-blasts), while the declaration
 * owns the vector identity: name, width, range, ordering, membership, and
 * validation. Every bus operation goes through this module so Design, Verify,
 * Board, and Export agree on one identity — the same `Base[N]` convention the
 * export vectorizer and board grouping already share, promoted from a display
 * heuristic to canonical model.
 *
 * All operations are pure: Circuit in, Circuit out.
 */

import type {
  BusBitRef,
  BusDeclaration,
  BusDirection,
  Circuit,
  Connection,
  LogicValue,
  Node,
  PortRef,
} from './types';

// ---------------------------------------------------------------------------
// Membership rules
// ---------------------------------------------------------------------------

/** Boundary node types allowed to carry a bit of an input bus. */
export const BUS_INPUT_MEMBER_TYPES = ['INPUT', 'Switch'] as const;
/** Boundary node types allowed to carry a bit of an output bus. */
export const BUS_OUTPUT_MEMBER_TYPES = ['OUTPUT', 'Lamp'] as const;

/** Port carrying the value on a bus member, by bus direction. */
export const BUS_MEMBER_PORT: Record<BusDirection, string> = {
  input: 'out',
  output: 'in',
};

/**
 * Matches the canonical explicit vector label, e.g. "A[3]" (optionally with a
 * trailing suffix such as "A[3] (SW3)"). This is byte-identical to the pattern
 * used by the export vectorizer (basys3ExportModel.parseExplicitVectorLabel)
 * and the board grouping (ioBusGrouping.EXPLICIT_VECTOR_LABEL).
 */
export const EXPLICIT_VECTOR_LABEL = /^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]/;

const HDL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseVectorLabel(
  label: string | undefined
): { baseName: string; bitIndex: number } | null {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return null;
  const match = trimmed.match(EXPLICIT_VECTOR_LABEL);
  if (!match) return null;
  return { baseName: match[1], bitIndex: Number.parseInt(match[2], 10) };
}

// ---------------------------------------------------------------------------
// Range helpers
// ---------------------------------------------------------------------------

export function busWidth(bus: Pick<BusDeclaration, 'left' | 'right'>): number {
  return Math.abs(bus.left - bus.right) + 1;
}

export function busIsDescending(bus: Pick<BusDeclaration, 'left' | 'right'>): boolean {
  return bus.left >= bus.right;
}

/** Bit indices in declared order, left to right (MSB-first for descending). */
export function busIndices(bus: Pick<BusDeclaration, 'left' | 'right'>): number[] {
  const step = busIsDescending(bus) ? -1 : 1;
  const out: number[] = [];
  for (let i = bus.left; ; i += step) {
    out.push(i);
    if (i === bus.right) break;
  }
  return out;
}

/** Canonical display label, e.g. "A[3:0]". */
export function busRangeLabel(bus: Pick<BusDeclaration, 'name' | 'left' | 'right'>): string {
  return `${bus.name}[${bus.left}:${bus.right}]`;
}

/** Bit lookup: the member carrying a specific declared index, or null. */
export function busBitRef(bus: BusDeclaration, index: number): BusBitRef | null {
  return bus.bits.find((bit) => bit.index === index) ?? null;
}

/** The PortRef that carries a given bit on the wire graph, or null. */
export function busBitPortRef(bus: BusDeclaration, index: number): PortRef | null {
  const bit = busBitRef(bus, index);
  if (!bit) return null;
  return { nodeId: bit.nodeId, portName: BUS_MEMBER_PORT[bus.direction] };
}

export class BusRangeError extends Error {}

/**
 * A contiguous slice of a bus, in declared order. Throws BusRangeError when
 * the requested range leaves the declared range or reverses its ordering.
 */
export function busSlice(bus: BusDeclaration, left: number, right: number): BusBitRef[] {
  const lo = Math.min(bus.left, bus.right);
  const hi = Math.max(bus.left, bus.right);
  for (const bound of [left, right]) {
    if (bound < lo || bound > hi) {
      throw new BusRangeError(
        `Slice [${left}:${right}] leaves the declared range of ${busRangeLabel(bus)}`
      );
    }
  }
  const descending = busIsDescending(bus);
  if (descending && left < right) {
    throw new BusRangeError(
      `Slice [${left}:${right}] reverses the descending order of ${busRangeLabel(bus)}`
    );
  }
  if (!descending && left > right) {
    throw new BusRangeError(
      `Slice [${left}:${right}] reverses the ascending order of ${busRangeLabel(bus)}`
    );
  }
  const step = descending ? -1 : 1;
  const refs: BusBitRef[] = [];
  for (let i = left; ; i += step) {
    const bit = busBitRef(bus, i);
    if (bit) refs.push(bit);
    if (i === right) break;
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Word/value helpers
// ---------------------------------------------------------------------------

export interface BusWord {
  /** Unsigned integer value, or null when any bit is X/Z/missing. */
  value: number | null;
  /** MSB-first binary string using X/Z for non-binary bits. */
  binary: string;
  hasUnknown: boolean;
  width: number;
}

/**
 * Collapse per-bit logic values into a word. `bitsByIndex` maps declared bit
 * index -> value; missing entries count as unknown.
 */
export function readBusWord(
  bus: Pick<BusDeclaration, 'left' | 'right'>,
  bitsByIndex: ReadonlyMap<number, LogicValue | undefined>
): BusWord {
  const indices = busIndices(bus);
  const msbFirst = busIsDescending(bus) ? indices : [...indices].reverse();
  let value = 0;
  let hasUnknown = false;
  let binary = '';
  for (const index of msbFirst) {
    const bit = bitsByIndex.get(index);
    if (bit === 0 || bit === 1) {
      value = value * 2 + bit;
      binary += String(bit);
    } else {
      hasUnknown = true;
      binary += bit === 'Z' ? 'Z' : 'X';
    }
  }
  return {
    value: hasUnknown ? null : value,
    binary,
    hasUnknown,
    width: indices.length,
  };
}

/**
 * Expand an unsigned word into per-bit values keyed by declared bit index.
 * Bit index N carries 2^(position from LSB end of the declared range).
 * Values outside the representable range throw BusRangeError.
 */
export function busWordToBits(
  bus: Pick<BusDeclaration, 'left' | 'right'>,
  value: number
): Map<number, 0 | 1> {
  const width = busWidth(bus);
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) {
    throw new BusRangeError(
      `Value ${value} does not fit in ${width} bit${width === 1 ? '' : 's'}`
    );
  }
  const indices = busIndices(bus);
  const lsbFirst = busIsDescending(bus) ? [...indices].reverse() : indices;
  const out = new Map<number, 0 | 1>();
  lsbFirst.forEach((index, position) => {
    out.set(index, ((value >> position) & 1) as 0 | 1);
  });
  return out;
}

export function formatBusWordHex(word: BusWord): string {
  if (word.value === null) return word.binary.includes('Z') ? "z'?" : "x'?";
  const digits = Math.max(1, Math.ceil(word.width / 4));
  return `0x${word.value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type BusDiagnosticCode =
  | 'BUS001' // duplicate bus name+direction
  | 'BUS002' // missing member node
  | 'BUS003' // member node type incompatible with bus direction
  | 'BUS004' // member label drifted from name[index]
  | 'BUS005' // node claimed by more than one bus
  | 'BUS006' // invalid range or membership shape
  | 'BUS007'; // invalid bus name

export interface BusDiagnostic {
  code: BusDiagnosticCode;
  severity: 'error' | 'warning';
  message: string;
  busId: string;
  nodeId?: string;
  bitIndex?: number;
}

function memberTypesFor(direction: BusDirection): readonly string[] {
  return direction === 'input' ? BUS_INPUT_MEMBER_TYPES : BUS_OUTPUT_MEMBER_TYPES;
}

export function validateBusDeclarations(circuit: Circuit): BusDiagnostic[] {
  const buses = circuit.buses ?? [];
  const diagnostics: BusDiagnostic[] = [];
  const nodesById = new Map(circuit.nodes.map((node) => [node.id, node]));
  const claimedBy = new Map<string, string>();
  const seenNames = new Map<string, string>();

  for (const bus of buses) {
    if (!HDL_IDENTIFIER.test(bus.name)) {
      diagnostics.push({
        code: 'BUS007',
        severity: 'error',
        busId: bus.id,
        message: `Bus name "${bus.name}" is not a valid HDL identifier`,
      });
    }

    const nameKey = `${bus.name}:${bus.direction}`;
    const existing = seenNames.get(nameKey);
    if (existing) {
      diagnostics.push({
        code: 'BUS001',
        severity: 'error',
        busId: bus.id,
        message: `Bus ${busRangeLabel(bus)} duplicates the name of bus "${existing}"`,
      });
    } else {
      seenNames.set(nameKey, bus.id);
    }

    const declared = new Set(busIndices(bus));
    const seenIndices = new Set<number>();
    for (const bit of bus.bits) {
      if (!declared.has(bit.index) || seenIndices.has(bit.index)) {
        diagnostics.push({
          code: 'BUS006',
          severity: 'error',
          busId: bus.id,
          bitIndex: bit.index,
          message: `Bit index ${bit.index} is ${seenIndices.has(bit.index) ? 'duplicated' : 'outside the declared range'} on ${busRangeLabel(bus)}`,
        });
        continue;
      }
      seenIndices.add(bit.index);

      const node = nodesById.get(bit.nodeId);
      if (!node) {
        diagnostics.push({
          code: 'BUS002',
          severity: 'error',
          busId: bus.id,
          nodeId: bit.nodeId,
          bitIndex: bit.index,
          message: `${bus.name}[${bit.index}] references missing node "${bit.nodeId}"`,
        });
        continue;
      }

      const claimant = claimedBy.get(bit.nodeId);
      if (claimant && claimant !== bus.id) {
        diagnostics.push({
          code: 'BUS005',
          severity: 'error',
          busId: bus.id,
          nodeId: bit.nodeId,
          bitIndex: bit.index,
          message: `Node "${bit.nodeId}" is claimed by two buses`,
        });
      } else {
        claimedBy.set(bit.nodeId, bus.id);
      }

      if (!memberTypesFor(bus.direction).includes(node.type)) {
        diagnostics.push({
          code: 'BUS003',
          severity: 'error',
          busId: bus.id,
          nodeId: bit.nodeId,
          bitIndex: bit.index,
          message: `${bus.name}[${bit.index}] is a ${node.type} node, which cannot carry an ${bus.direction} bus bit`,
        });
      }

      const parsed = parseVectorLabel(node.label);
      if (!parsed || parsed.baseName !== bus.name || parsed.bitIndex !== bit.index) {
        diagnostics.push({
          code: 'BUS004',
          severity: 'warning',
          busId: bus.id,
          nodeId: bit.nodeId,
          bitIndex: bit.index,
          message: `Node "${bit.nodeId}" label "${node.label ?? ''}" drifted from ${bus.name}[${bit.index}]`,
        });
      }
    }

    for (const index of declared) {
      if (!seenIndices.has(index)) {
        diagnostics.push({
          code: 'BUS002',
          severity: 'error',
          busId: bus.id,
          bitIndex: index,
          message: `${bus.name}[${index}] has no member node`,
        });
      }
    }
  }

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Persistence normalization (single authority for load paths)
// ---------------------------------------------------------------------------

/**
 * Parse untrusted serialized bus declarations. Entries that are structurally
 * unusable are dropped; semantic problems (missing nodes, label drift) are
 * left to validateBusDeclarations so load never destroys a project.
 */
export function normalizeBusDeclarations(raw: unknown): BusDeclaration[] {
  if (!Array.isArray(raw)) return [];
  const out: BusDeclaration[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const direction = candidate.direction;
    const left = candidate.left;
    const right = candidate.right;
    if (!id || seenIds.has(id) || !HDL_IDENTIFIER.test(name)) continue;
    if (direction !== 'input' && direction !== 'output') continue;
    if (!Number.isInteger(left) || !Number.isInteger(right)) continue;
    if ((left as number) < 0 || (right as number) < 0) continue;
    const bits: BusBitRef[] = [];
    if (Array.isArray(candidate.bits)) {
      for (const bit of candidate.bits) {
        if (!bit || typeof bit !== 'object') continue;
        const bitRecord = bit as Record<string, unknown>;
        if (!Number.isInteger(bitRecord.index)) continue;
        if (typeof bitRecord.nodeId !== 'string' || !bitRecord.nodeId.trim()) continue;
        bits.push({ index: bitRecord.index as number, nodeId: bitRecord.nodeId.trim() });
      }
    }
    seenIds.add(id);
    out.push({
      id,
      name,
      direction,
      left: left as number,
      right: right as number,
      bits: bits.sort((a, b) => a.index - b.index),
    });
  }
  return out.sort(
    (a, b) => a.name.localeCompare(b.name) || a.direction.localeCompare(b.direction)
  );
}

// ---------------------------------------------------------------------------
// Migration: promote the legacy label convention to declarations
// ---------------------------------------------------------------------------

function stableBusId(name: string, direction: BusDirection): string {
  return `bus-${direction === 'input' ? 'in' : 'out'}-${name}`;
}

/**
 * Synthesize bus declarations from `Base[N]`-labeled boundary nodes — the
 * migration path for legacy scalar projects. Deterministic and idempotent:
 * nodes already claimed by a declared bus are skipped, only contiguous groups
 * of two or more bits are promoted (matching the export vectorizer), and ids
 * derive from name+direction with no randomness.
 */
export function synthesizeBusDeclarations(circuit: Circuit): Circuit {
  const existing = circuit.buses ?? [];
  const claimed = new Set(existing.flatMap((bus) => bus.bits.map((bit) => bit.nodeId)));
  const existingIds = new Set(existing.map((bus) => bus.id));
  const existingNames = new Set(existing.map((bus) => `${bus.name}:${bus.direction}`));

  const groups = new Map<string, { name: string; direction: BusDirection; bits: BusBitRef[] }>();
  for (const node of circuit.nodes) {
    if (claimed.has(node.id)) continue;
    let direction: BusDirection;
    if ((BUS_INPUT_MEMBER_TYPES as readonly string[]).includes(node.type)) {
      direction = 'input';
    } else if ((BUS_OUTPUT_MEMBER_TYPES as readonly string[]).includes(node.type)) {
      direction = 'output';
    } else {
      continue;
    }
    const parsed = parseVectorLabel(node.label);
    if (!parsed) continue;
    const key = `${parsed.baseName}:${direction}`;
    if (existingNames.has(key)) continue;
    if (!groups.has(key)) {
      groups.set(key, { name: parsed.baseName, direction, bits: [] });
    }
    groups.get(key)!.bits.push({ index: parsed.bitIndex, nodeId: node.id });
  }

  const added: BusDeclaration[] = [];
  for (const group of groups.values()) {
    if (group.bits.length < 2) continue;
    const bits = [...group.bits].sort(
      (a, b) => a.index - b.index || a.nodeId.localeCompare(b.nodeId)
    );
    const indices = bits.map((bit) => bit.index);
    const uniqueIndices = new Set(indices);
    const lsb = indices[0];
    const msb = indices[indices.length - 1];
    const contiguous =
      uniqueIndices.size === bits.length && msb - lsb + 1 === bits.length;
    if (!contiguous) continue;
    const id = stableBusId(group.name, group.direction);
    if (existingIds.has(id)) continue;
    added.push({
      id,
      name: group.name,
      direction: group.direction,
      left: msb,
      right: lsb,
      bits,
    });
  }

  if (added.length === 0) return circuit;
  const buses = [...existing, ...added].sort(
    (a, b) => a.name.localeCompare(b.name) || a.direction.localeCompare(b.direction)
  );
  return { ...circuit, buses };
}

// ---------------------------------------------------------------------------
// Authoring operations
// ---------------------------------------------------------------------------

const NODE_ID_PREFIX = 'node-v2-';
const NODE_ID_RE = /^node-v2-(\d+)$/;

function nextNodeIdNumber(circuit: Circuit): number {
  let max = 0;
  for (const node of circuit.nodes) {
    const match = NODE_ID_RE.exec(node.id);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value)) max = Math.max(max, value);
  }
  return max + 1;
}

export class BusValidationError extends Error {}

export interface CreateBusSpec {
  name: string;
  direction: BusDirection;
  left: number;
  right: number;
  /** Position of the first (leftmost-declared) member node. */
  position?: { x: number; y: number };
  /** Vertical spacing between member nodes. Default 72. */
  spacing?: number;
  /** Member node type override. Defaults: INPUT for input, OUTPUT for output. */
  nodeType?: string;
}

export interface CreateBusResult {
  circuit: Circuit;
  bus: BusDeclaration;
  memberNodes: Node[];
}

/**
 * Create a bus boundary: one scalar boundary node per declared bit, labeled
 * `name[i]`, plus the declaration that owns them.
 */
export function createBusBoundary(circuit: Circuit, spec: CreateBusSpec): CreateBusResult {
  const name = spec.name.trim();
  if (!HDL_IDENTIFIER.test(name)) {
    throw new BusValidationError(`Bus name "${spec.name}" is not a valid HDL identifier`);
  }
  if (!Number.isInteger(spec.left) || !Number.isInteger(spec.right) || spec.left < 0 || spec.right < 0) {
    throw new BusValidationError('Bus range bounds must be non-negative integers');
  }
  const width = Math.abs(spec.left - spec.right) + 1;
  if (width < 2) {
    throw new BusValidationError('A bus needs at least 2 bits; use a scalar signal for width 1');
  }
  const existing = circuit.buses ?? [];
  if (existing.some((bus) => bus.name === name && bus.direction === spec.direction)) {
    throw new BusValidationError(`A ${spec.direction} bus named "${name}" already exists`);
  }
  const conflictingScalar = circuit.nodes.some((node) => {
    const parsed = parseVectorLabel(node.label);
    return parsed?.baseName === name;
  });
  if (conflictingScalar) {
    throw new BusValidationError(
      `Signals labeled "${name}[…]" already exist; rename them or pick another bus name`
    );
  }

  const nodeType = spec.nodeType ?? (spec.direction === 'input' ? 'INPUT' : 'OUTPUT');
  if (!memberTypesFor(spec.direction).includes(nodeType)) {
    throw new BusValidationError(
      `Node type ${nodeType} cannot carry an ${spec.direction} bus bit`
    );
  }

  const basePosition = spec.position ?? { x: 120, y: 120 };
  const spacing = spec.spacing ?? 72;
  const indices = busIndices({ left: spec.left, right: spec.right });
  let nextId = nextNodeIdNumber(circuit);
  const memberNodes: Node[] = [];
  const bits: BusBitRef[] = [];
  indices.forEach((index, position) => {
    const id = `${NODE_ID_PREFIX}${nextId}`;
    nextId += 1;
    memberNodes.push({
      id,
      type: nodeType,
      label: `${name}[${index}]`,
      position: { x: basePosition.x, y: basePosition.y + position * spacing },
      rotation: 0,
      state: {},
      config: {},
    });
    bits.push({ index, nodeId: id });
  });

  const bus: BusDeclaration = {
    id: stableBusId(name, spec.direction),
    name,
    direction: spec.direction,
    left: spec.left,
    right: spec.right,
    bits: bits.sort((a, b) => a.index - b.index),
  };

  return {
    circuit: {
      ...circuit,
      nodes: [...circuit.nodes, ...memberNodes],
      buses: [...existing, bus].sort(
        (a, b) => a.name.localeCompare(b.name) || a.direction.localeCompare(b.direction)
      ),
    },
    bus,
    memberNodes,
  };
}

/**
 * Rename a bus and rewrite every member label atomically, preserving any
 * suffix after the canonical `name[i]` prefix (e.g. "A[0] (SW0)").
 */
export function renameBus(circuit: Circuit, busId: string, nextName: string): Circuit {
  const name = nextName.trim();
  if (!HDL_IDENTIFIER.test(name)) {
    throw new BusValidationError(`Bus name "${nextName}" is not a valid HDL identifier`);
  }
  const buses = circuit.buses ?? [];
  const bus = buses.find((entry) => entry.id === busId);
  if (!bus) {
    throw new BusValidationError(`Unknown bus "${busId}"`);
  }
  if (bus.name === name) return circuit;
  if (buses.some((entry) => entry.id !== busId && entry.name === name && entry.direction === bus.direction)) {
    throw new BusValidationError(`A ${bus.direction} bus named "${name}" already exists`);
  }

  const bitIndexByNodeId = new Map(bus.bits.map((bit) => [bit.nodeId, bit.index]));
  const nodes = circuit.nodes.map((node) => {
    const index = bitIndexByNodeId.get(node.id);
    if (index === undefined) return node;
    const current = node.label ?? '';
    const match = current.match(EXPLICIT_VECTOR_LABEL);
    const suffix = match ? current.slice(match[0].length) : '';
    return { ...node, label: `${name}[${index}]${suffix}` };
  });

  const renamed = buses
    .map((entry) => (entry.id === busId ? { ...entry, name } : entry))
    .sort((a, b) => a.name.localeCompare(b.name) || a.direction.localeCompare(b.direction));

  return { ...circuit, nodes, buses: renamed };
}

/**
 * Remove a bus declaration. With `deleteMembers`, also removes the member
 * nodes and their connections; otherwise the members demote to scalars and
 * their labels rewrite from `A[i]` to `A_i` — the vector convention is how
 * every fallback heuristic (export, board grouping, load migration) detects
 * buses, so demotion must leave the label space too or the bus resurrects
 * on the next load.
 */
export function deleteBus(
  circuit: Circuit,
  busId: string,
  opts: { deleteMembers?: boolean } = {}
): Circuit {
  const buses = circuit.buses ?? [];
  const bus = buses.find((entry) => entry.id === busId);
  if (!bus) return circuit;
  const remaining = buses.filter((entry) => entry.id !== busId);
  const bitIndexByNodeId = new Map(bus.bits.map((bit) => [bit.nodeId, bit.index]));
  const next: Circuit = {
    ...circuit,
    nodes: circuit.nodes.map((node) => {
      const index = bitIndexByNodeId.get(node.id);
      if (index === undefined) return node;
      const current = node.label ?? '';
      const match = current.match(EXPLICIT_VECTOR_LABEL);
      if (!match) return node;
      const suffix = current.slice(match[0].length);
      return { ...node, label: `${bus.name}_${index}${suffix}` };
    }),
    buses: remaining.length > 0 ? remaining : undefined,
  };
  if (!opts.deleteMembers) return next;

  const memberIds = new Set(bus.bits.map((bit) => bit.nodeId));
  const refNodeId = (ref: PortRef | string): string =>
    typeof ref === 'string' ? ref : ref.nodeId;
  return {
    ...next,
    nodes: circuit.nodes.filter((node) => !memberIds.has(node.id)),
    connections: circuit.connections.filter(
      (connection) =>
        !memberIds.has(refNodeId(connection.from)) && !memberIds.has(refNodeId(connection.to))
    ),
  };
}

export class BusWidthMismatchError extends Error {
  readonly fromWidth: number;
  readonly toWidth: number;
  constructor(from: BusDeclaration, to: BusDeclaration) {
    super(
      `Cannot connect ${busRangeLabel(from)} (${busWidth(from)} bits) to ${busRangeLabel(to)} (${busWidth(to)} bits): widths differ`
    );
    this.fromWidth = busWidth(from);
    this.toWidth = busWidth(to);
  }
}

/**
 * Connect two equal-width buses position-wise in declared order (left bit to
 * left bit). The source must be an input-side bus (members drive from 'out'),
 * the target an output-side bus (members receive on 'in'). Produces one scalar
 * connection per bit; existing identical connections are not duplicated.
 */
export function connectBuses(circuit: Circuit, fromBusId: string, toBusId: string): Circuit {
  const buses = circuit.buses ?? [];
  const from = buses.find((entry) => entry.id === fromBusId);
  const to = buses.find((entry) => entry.id === toBusId);
  if (!from || !to) {
    throw new BusValidationError('Both buses must exist to connect them');
  }
  if (from.direction !== 'input' || to.direction !== 'output') {
    throw new BusValidationError(
      `Bus connection drives an input bus into an output bus; got ${from.direction} → ${to.direction}`
    );
  }
  if (busWidth(from) !== busWidth(to)) {
    throw new BusWidthMismatchError(from, to);
  }

  const fromIndices = busIndices(from);
  const toIndices = busIndices(to);
  const key = (connection: Connection): string => {
    const fromRef = connection.from;
    const toRef = connection.to;
    const f = typeof fromRef === 'string' ? { nodeId: fromRef, portName: '' } : fromRef;
    const t = typeof toRef === 'string' ? { nodeId: toRef, portName: '' } : toRef;
    return `${f.nodeId}.${f.portName}->${t.nodeId}.${t.portName}`;
  };
  const existingKeys = new Set(circuit.connections.map(key));

  const additions: Connection[] = [];
  for (let position = 0; position < fromIndices.length; position += 1) {
    const source = busBitPortRef(from, fromIndices[position]);
    const target = busBitPortRef(to, toIndices[position]);
    if (!source || !target) {
      throw new BusValidationError(
        `Bit ${position} is missing a member node on one side of the connection`
      );
    }
    const candidate: Connection = { from: source, to: target };
    if (existingKeys.has(key(candidate))) continue;
    additions.push(candidate);
  }

  if (additions.length === 0) return circuit;
  return { ...circuit, connections: [...circuit.connections, ...additions] };
}

/**
 * Drop bus bits whose member node no longer exists (e.g. after a node
 * deletion) and remove declarations left with no members. Declared ranges are
 * kept, so a pruned bus honestly reports its missing indices via BUS002.
 */
export function pruneBusBits(circuit: Circuit): Circuit {
  const buses = circuit.buses;
  if (!buses || buses.length === 0) return circuit;
  const nodeIds = new Set(circuit.nodes.map((node) => node.id));
  let changed = false;
  const next: BusDeclaration[] = [];
  for (const bus of buses) {
    const bits = bus.bits.filter((bit) => nodeIds.has(bit.nodeId));
    if (bits.length === 0) {
      changed = true;
      continue;
    }
    if (bits.length !== bus.bits.length) {
      changed = true;
      next.push({ ...bus, bits });
    } else {
      next.push(bus);
    }
  }
  if (!changed) return circuit;
  return { ...circuit, buses: next.length > 0 ? next : undefined };
}

/**
 * The set of node ids claimed by any declared bus, for projection layers that
 * need to know which scalars are bus members.
 */
export function busMemberNodeIds(circuit: Circuit): Set<string> {
  return new Set((circuit.buses ?? []).flatMap((bus) => bus.bits.map((bit) => bit.nodeId)));
}

/** Find the declared bus (and bit index) owning a node, if any. */
export function busForNode(
  circuit: Circuit,
  nodeId: string
): { bus: BusDeclaration; index: number } | null {
  for (const bus of circuit.buses ?? []) {
    const bit = bus.bits.find((entry) => entry.nodeId === nodeId);
    if (bit) return { bus, index: bit.index };
  }
  return null;
}
