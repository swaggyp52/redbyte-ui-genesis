import type { Node } from '@redbyte/rb-logic-core';
import type { ChipMetadata } from '../components/NodeView';

/**
 * Symbol geometry — the single source of a node's outline bounds and pin
 * positions in WORLD units on the 16px grid. Every renderer (symbols, wires,
 * routing, fit, selection bounds, hit targets) reads pin positions from here
 * so a wire can never land beside its pin.
 *
 * Pure: no React, no DOM. `node.position` is the symbol's origin (the centre
 * of the body) so stored positions stay stable across renderers.
 */

export const GRID = 16;
/** Pin pitch: two grid cells. */
export const PIN_PITCH = 32;
/** Stub length from the body edge to the pin's connection point. */
export const STUB = 16;

export type SymbolKind =
  | 'and'
  | 'or'
  | 'xor'
  | 'nand'
  | 'nor'
  | 'xnor'
  | 'not'
  | 'buf'
  | 'io-in'
  | 'io-out'
  | 'register'
  | 'clock'
  | 'const'
  | 'module'
  | 'block';

export interface SymbolPin {
  /** Canonical port id as the engine / metadata names it. */
  readonly id: string;
  /** Display name (may differ from id for vector ports). */
  readonly name: string;
  readonly direction: 'in' | 'out';
  readonly side: 'left' | 'right';
  /** Connection point (end of the stub), world units relative to the symbol origin. */
  readonly x: number;
  readonly y: number;
  /** Where the stub meets the body. */
  readonly bodyX: number;
  readonly bodyY: number;
  readonly width: number;
  readonly clock: boolean;
  readonly invert: boolean;
}

export interface SymbolGeometry {
  readonly kind: SymbolKind;
  /** Body bounds relative to the symbol origin (excludes stubs). */
  readonly body: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  /** Full bounds including stubs and any inversion bubble. */
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  readonly pins: readonly SymbolPin[];
  /** Instance / logical name to show inside or beside the symbol. */
  readonly title: string;
  /** Type label (gate type, module display name). */
  readonly typeLabel: string;
}

/**
 * Port-id aliases used by fixtures and legacy documents. Geometry is keyed by
 * the canonical id; lookups through `findPin` accept any alias so a wire whose
 * endpoint says `in1` still lands on pin `a`.
 */
const PORT_ALIASES: Record<string, readonly string[]> = {
  a: ['a', 'in1', 'in_a', 'A'],
  b: ['b', 'in2', 'in_b', 'B'],
  c: ['c', 'in3', 'in_c', 'C'],
  in: ['in', 'D', 'd', 'in1'],
  out: ['out', 'Q', 'q', 'OUT', 'y'],
  CLK: ['CLK', 'clk', 'clock', 'Clock'],
  Q: ['Q', 'q', 'out'],
  Q_inv: ['Q_inv', 'qBar', 'QN', 'Q_n', 'nq'],
};

const SEQUENTIAL_TYPES = new Set([
  'DFlipFlop',
  'D_FLIP_FLOP',
  'JKFlipFlop',
  'TFlipFlop',
  'RSLatch',
  'DLatch',
  'Register1',
  'RegisterBus',
  'StateBank',
  'Counter4Bit',
]);

export function symbolKindForNode(node: Pick<Node, 'type' | 'config'>, metadata?: ChipMetadata): SymbolKind {
  const type = node.type;
  if (typeof node.config?.moduleDefinitionId === 'string') return 'module';
  switch (type) {
    case 'AND':
    case 'AND3':
      return 'and';
    case 'OR':
    case 'OR3':
      return 'or';
    case 'XOR':
    case 'XOR3':
      return 'xor';
    case 'NAND':
    case 'NAND3':
      return 'nand';
    case 'NOR':
    case 'NOR3':
      return 'nor';
    case 'XNOR':
      return 'xnor';
    case 'NOT':
      return 'not';
    case 'Wire':
    case 'Delay':
      return 'buf';
    case 'INPUT':
    case 'Switch':
    case 'Button':
      return 'io-in';
    case 'OUTPUT':
    case 'Lamp':
      return 'io-out';
    case 'Clock':
      return 'clock';
    case 'PowerSource':
    case 'Ground':
      return 'const';
    default:
      if (SEQUENTIAL_TYPES.has(type)) return 'register';
      if (metadata && (metadata.inputs.length > 0 || metadata.outputs.length > 0)) return 'block';
      return 'block';
  }
}

function inputsOf(node: Pick<Node, 'type'>, metadata?: ChipMetadata): { id: string; name: string }[] {
  if (metadata) return metadata.inputs;
  switch (node.type) {
    case 'AND':
    case 'OR':
    case 'XOR':
    case 'NAND':
    case 'NOR':
    case 'XNOR':
      return [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }];
    case 'AND3':
    case 'OR3':
    case 'NAND3':
    case 'NOR3':
    case 'XOR3':
      return [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }, { id: 'c', name: 'c' }];
    case 'NOT':
    case 'Wire':
    case 'Delay':
    case 'OUTPUT':
    case 'Lamp':
      return [{ id: 'in', name: 'in' }];
    default:
      return [];
  }
}

function outputsOf(node: Pick<Node, 'type'>, metadata?: ChipMetadata): { id: string; name: string }[] {
  if (metadata) return metadata.outputs.filter((port) => !(node.type === 'OUTPUT' || node.type === 'Lamp') || port.id !== 'out');
  switch (node.type) {
    case 'OUTPUT':
    case 'Lamp':
      return [];
    default:
      return [{ id: 'out', name: 'out' }];
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isClockPin(id: string): boolean {
  return /^(clk|clock)$/i.test(id);
}

/** Vector port display: `D[7:0]` when the metadata carries a bracketed bit set. */
function collapseVectorPins(ports: { id: string; name: string }[]): { id: string; name: string; width: number }[] {
  const scalar: { id: string; name: string; width: number }[] = [];
  const vectors = new Map<string, { bits: number[]; first: number }>();
  ports.forEach((port, index) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]$/.exec(port.id);
    if (!match) {
      scalar.push({ ...port, width: 1 });
      return;
    }
    const entry = vectors.get(match[1]) ?? { bits: [], first: index };
    entry.bits.push(Number(match[2]));
    vectors.set(match[1], entry);
  });
  if (vectors.size === 0) return scalar;
  // Keep original order: vectors appear where their first bit appeared.
  const merged: { id: string; name: string; width: number; order: number }[] = scalar.map((port, i) => ({ ...port, order: ports.findIndex((p) => p.id === port.id) }));
  for (const [base, entry] of vectors) {
    const hi = Math.max(...entry.bits);
    const lo = Math.min(...entry.bits);
    merged.push({ id: base, name: `${base}[${hi}:${lo}]`, width: entry.bits.length, order: entry.first });
  }
  return merged.sort((a, b) => a.order - b.order).map(({ order: _order, ...rest }) => rest);
}

/**
 * Resolve the symbol geometry of a node. Deterministic for a given
 * (type, metadata, config, label).
 */
/**
 * The body size of a rectangular block symbol - a module instance, a register, a generic
 * block. One owner, because placement needs the same number the canvas draws with: a module
 * with five ports is roughly twice a gate in both axes, and assuming gate size is what let
 * placed instances land on top of one another.
 */
export function blockBodySize(input: {
  kind?: SymbolKind;
  instanceName: string;
  typeLabel: string;
  inputPortNames: readonly string[];
  outputPortNames: readonly string[];
}): { width: number; height: number; headerH: number } {
  const rows = Math.max(1, input.inputPortNames.length, input.outputPortNames.length);
  const longestPortName = Math.max(
    input.inputPortNames.reduce((a, name) => Math.max(a, name.length), 0),
    input.outputPortNames.reduce((a, name) => Math.max(a, name.length), 0)
  );
  const width =
    GRID *
    Math.max(
      input.kind === 'register' ? 5 : 6,
      Math.ceil((longestPortName * 2 * 6.5 + 40) / GRID),
      Math.ceil((Math.max(input.instanceName.length, input.typeLabel.length) * 6.5 + 16) / GRID)
    );
  const headerH = input.kind === 'module' || input.instanceName ? PIN_PITCH : GRID;
  return { width, height: headerH + rows * PIN_PITCH, headerH };
}

export function resolvePortGeometry(node: Node, metadata?: ChipMetadata): SymbolGeometry {
  const kind = symbolKindForNode(node, metadata);
  const inputs = collapseVectorPins(inputsOf(node, metadata));
  const outputs = collapseVectorPins(outputsOf(node, metadata));
  const instanceName = readString(node.config?.instanceName) || (node.label ?? '').trim();
  const typeLabel = metadata?.name ?? node.type;

  const pins: SymbolPin[] = [];
  const push = (pin: Omit<SymbolPin, 'bodyX' | 'bodyY'> & { bodyX?: number; bodyY?: number }) => {
    pins.push({
      bodyX: pin.bodyX ?? (pin.side === 'left' ? pin.x + STUB : pin.x - STUB),
      bodyY: pin.bodyY ?? pin.y,
      ...pin,
    } as SymbolPin);
  };

  switch (kind) {
    case 'and':
    case 'or':
    case 'xor':
    case 'nand':
    case 'nor':
    case 'xnor': {
      const n = Math.max(2, inputs.length);
      const bodyW = 3 * GRID;
      const bodyH = Math.max(3 * GRID, (n + 1) * GRID);
      const minX = -bodyW / 2;
      const maxX = bodyW / 2;
      const minY = -bodyH / 2;
      const maxY = bodyH / 2;
      const inverted = kind === 'nand' || kind === 'nor' || kind === 'xnor';
      const pitch = n === 2 ? PIN_PITCH : GRID * 1.5;
      inputs.forEach((port, index) => {
        const y = Math.round((index - (n - 1) / 2) * pitch);
        // OR/XOR shapes curve inward on the left; the stub meets the arc a
        // little further right so it never floats outside the outline.
        const inset = kind === 'or' || kind === 'nor' || kind === 'xor' || kind === 'xnor' ? 6 : 0;
        push({ id: port.id, name: port.name, direction: 'in', side: 'left', x: minX - STUB, y, bodyX: minX + inset, bodyY: y, width: port.width, clock: false, invert: false });
      });
      const bubble = inverted ? GRID / 2 : 0;
      outputs.forEach((port) => {
        push({ id: port.id, name: port.name, direction: 'out', side: 'right', x: maxX + bubble + STUB, y: 0, bodyX: maxX + bubble, bodyY: 0, width: port.width, clock: false, invert: inverted });
      });
      return {
        kind,
        body: { minX, minY, maxX, maxY },
        bounds: { minX: minX - STUB, minY, maxX: maxX + bubble + STUB, maxY },
        pins,
        title: instanceName,
        typeLabel,
      };
    }
    case 'not':
    case 'buf': {
      const bodyW = 2 * GRID;
      const bodyH = 2 * GRID;
      const minX = -bodyW / 2;
      const maxX = bodyW / 2;
      const bubble = kind === 'not' ? GRID / 2 : 0;
      inputs.slice(0, 1).forEach((port) => push({ id: port.id, name: port.name, direction: 'in', side: 'left', x: minX - STUB, y: 0, width: port.width, clock: false, invert: false }));
      outputs.forEach((port) => push({ id: port.id, name: port.name, direction: 'out', side: 'right', x: maxX + bubble + STUB, y: 0, bodyX: maxX + bubble, bodyY: 0, width: port.width, clock: false, invert: kind === 'not' }));
      return { kind, body: { minX, minY: -bodyH / 2, maxX, maxY: bodyH / 2 }, bounds: { minX: minX - STUB, minY: -bodyH / 2, maxX: maxX + bubble + STUB, maxY: bodyH / 2 }, pins, title: instanceName, typeLabel };
    }
    case 'io-in':
    case 'clock':
    case 'const': {
      // Port symbol: a pentagon pointing into the design; the value cell is the tip.
      const label = instanceName || node.id;
      const bodyW = Math.max(4 * GRID, GRID * Math.ceil((label.length * 7 + 28) / GRID));
      const bodyH = PIN_PITCH;
      const minX = -bodyW / 2;
      const maxX = bodyW / 2;
      outputs.slice(0, 1).forEach((port) => push({ id: port.id, name: port.name, direction: 'out', side: 'right', x: maxX + STUB, y: 0, width: port.width, clock: kind === 'clock', invert: false }));
      return { kind, body: { minX, minY: -bodyH / 2, maxX, maxY: bodyH / 2 }, bounds: { minX, minY: -bodyH / 2, maxX: maxX + STUB, maxY: bodyH / 2 }, pins, title: label, typeLabel };
    }
    case 'io-out': {
      const label = instanceName || node.id;
      const bodyW = Math.max(4 * GRID, GRID * Math.ceil((label.length * 7 + 28) / GRID));
      const bodyH = PIN_PITCH;
      const minX = -bodyW / 2;
      const maxX = bodyW / 2;
      inputs.slice(0, 1).forEach((port) => push({ id: port.id, name: port.name, direction: 'in', side: 'left', x: minX - STUB, y: 0, width: port.width, clock: false, invert: false }));
      return { kind, body: { minX, minY: -bodyH / 2, maxX, maxY: bodyH / 2 }, bounds: { minX: minX - STUB, minY: -bodyH / 2, maxX, maxY: bodyH / 2 }, pins, title: label, typeLabel };
    }
    case 'register':
    case 'module':
    case 'block':
    default: {
      // Rectangular block with named pins inside; header row for the identity.
      const { width: bodyW, height: bodyH, headerH } = blockBodySize({
        kind,
        instanceName,
        typeLabel,
        inputPortNames: inputs.map((port) => port.name),
        outputPortNames: outputs.map((port) => port.name),
      });
      const minX = -bodyW / 2;
      const maxX = bodyW / 2;
      const minY = -bodyH / 2;
      const maxY = bodyH / 2;
      const rowY = (index: number) => minY + headerH + PIN_PITCH * (index + 0.5);
      inputs.forEach((port, index) => {
        push({ id: port.id, name: port.name, direction: 'in', side: 'left', x: minX - STUB, y: rowY(index), width: port.width, clock: isClockPin(port.id), invert: false });
      });
      outputs.forEach((port, index) => {
        push({ id: port.id, name: port.name, direction: 'out', side: 'right', x: maxX + STUB, y: rowY(index), width: port.width, clock: false, invert: /_inv$|^QN$/i.test(port.id) });
      });
      return { kind, body: { minX, minY, maxX, maxY }, bounds: { minX: minX - STUB, minY, maxX: maxX + STUB, maxY }, pins, title: instanceName, typeLabel };
    }
  }
}

/** Find a pin by canonical id or any known alias. */
export function findPin(geometry: SymbolGeometry, portName: string): SymbolPin | undefined {
  const direct = geometry.pins.find((pin) => pin.id === portName);
  if (direct) return direct;
  const wanted = portName.trim();
  for (const pin of geometry.pins) {
    const aliases = PORT_ALIASES[pin.id];
    if (aliases && aliases.includes(wanted)) return pin;
    // Vector pin addressed as base(3) or base[3].
    const base = /^([A-Za-z_][A-Za-z0-9_]*)[\[(](\d+)[\])]$/.exec(wanted)?.[1];
    if (base && pin.id === base) return pin;
  }
  // Fallbacks: a single-input/single-output symbol accepts any in/out name.
  const lower = wanted.toLowerCase();
  if (geometry.pins.filter((pin) => pin.direction === 'in').length === 1 && /^(in|d|a|in1)$/.test(lower)) {
    return geometry.pins.find((pin) => pin.direction === 'in');
  }
  if (geometry.pins.filter((pin) => pin.direction === 'out').length === 1 && /^(out|q|y)$/.test(lower)) {
    return geometry.pins.find((pin) => pin.direction === 'out');
  }
  return undefined;
}

export interface GeometryIndexEntry {
  readonly node: Node;
  readonly geometry: SymbolGeometry;
  readonly x: number;
  readonly y: number;
}

/** Build the geometry index for a circuit; positions default to (0,0). */
export function buildGeometryIndex(
  nodes: readonly Node[],
  getMetadata?: (nodeType: string, node?: Node) => ChipMetadata | undefined
): Map<string, GeometryIndexEntry> {
  const index = new Map<string, GeometryIndexEntry>();
  for (const node of nodes) {
    const geometry = resolvePortGeometry(node, getMetadata?.(node.type, node));
    index.set(node.id, { node, geometry, x: node.position?.x ?? node.x ?? 0, y: node.position?.y ?? node.y ?? 0 });
  }
  return index;
}

/** World-space pin point for a node/port, or null when the pin is unknown. */
export function pinWorldPoint(entry: GeometryIndexEntry | undefined, portName: string): { x: number; y: number; pin: SymbolPin } | null {
  if (!entry) return null;
  const pin = findPin(entry.geometry, portName);
  if (!pin) return null;
  return { x: entry.x + pin.x, y: entry.y + pin.y, pin };
}

export function unionBounds(entries: Iterable<GeometryIndexEntry>): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    minX = Math.min(minX, entry.x + entry.geometry.bounds.minX);
    minY = Math.min(minY, entry.y + entry.geometry.bounds.minY);
    maxX = Math.max(maxX, entry.x + entry.geometry.bounds.maxX);
    maxY = Math.max(maxY, entry.y + entry.geometry.bounds.maxY);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}
