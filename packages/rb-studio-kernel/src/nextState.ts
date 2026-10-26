import type { Circuit } from '@redbyte/rb-logic-core';
import { connectionEndpoints, findPin, resolvePortGeometry, type SceneMetadataResolver } from '@redbyte/rb-logic-view/scene';

/**
 * A derived next-state (or output) table for one input pin: the combinational cone that
 * drives it, cut at state elements and boundary inputs, evaluated for every combination of
 * its leaves. It is derived from topology, never observed, and is labelled that way.
 */
export interface DerivedTableLeaf {
  readonly nodeId: string;
  readonly port: string;
  readonly label: string;
}

export interface DerivedTable {
  readonly target: { readonly nodeId: string; readonly port: string };
  readonly leaves: readonly DerivedTableLeaf[];
  /** Rows in binary counting order of the leaves (first leaf is the most significant bit). */
  readonly rows: readonly { readonly inputs: readonly (0 | 1)[]; readonly output: 0 | 1 }[];
  readonly expression: string;
}

export type DerivedTableResult = { readonly ok: true; readonly table: DerivedTable } | { readonly ok: false; readonly reason: string };

const STATE_TYPES = /FLIPFLOP|REGISTER|LATCH|STATEBANK|COUNTER/i;
const LEAF_TYPES = /^(INPUT|SWITCH|CLOCK|BUTTON)$/i;
/** Constant sources are fixed values, never free variables. */
const CONSTANTS: Record<string, 0 | 1> = { POWERSOURCE: 1, VCC: 1, GROUND: 0, GND: 0 };
const OPS: Record<string, { readonly symbol: string; readonly fn: (bits: readonly (0 | 1)[]) => 0 | 1 }> = {
  AND: { symbol: '·', fn: (b) => (b.every((v) => v === 1) ? 1 : 0) },
  OR: { symbol: '+', fn: (b) => (b.some((v) => v === 1) ? 1 : 0) },
  XOR: { symbol: '⊕', fn: (b) => (b.reduce<number>((acc, v) => acc ^ v, 0) as 0 | 1) },
  NAND: { symbol: '·', fn: (b) => (b.every((v) => v === 1) ? 0 : 1) },
  NOR: { symbol: '+', fn: (b) => (b.some((v) => v === 1) ? 0 : 1) },
  XNOR: { symbol: '⊕', fn: (b) => ((b.reduce<number>((acc, v) => acc ^ v, 0) ^ 1) as 0 | 1) },
  NOT: { symbol: '¬', fn: (b) => (b[0] === 1 ? 0 : 1) },
  BUFFER: { symbol: '', fn: (b) => b[0] },
};
const OP_ALIASES: Record<string, string> = { AND3: 'AND', OR3: 'OR', XOR3: 'XOR', BUF: 'BUFFER', WIRE: 'BUFFER' };

type Term =
  | { readonly kind: 'leaf'; readonly index: number }
  | { readonly kind: 'const'; readonly value: 0 | 1 }
  | { readonly kind: 'op'; readonly op: string; readonly children: readonly Term[] };

export function deriveTruthTable(
  circuit: Circuit,
  target: { nodeId: string; port: string },
  options: {
    maxLeaves?: number;
    label?: (nodeId: string, port: string) => string;
    fromDriver?: boolean;
    /** The chip metadata the sheet draws with, so pins here are the drawn pins. */
    getMetadata?: SceneMetadataResolver;
  } = {},
): DerivedTableResult {
  const maxLeaves = options.maxLeaves ?? 6;
  const label = options.label ?? ((nodeId: string, port: string) => `${nodeId}.${port}`);
  const nodes = new Map(circuit.nodes.map((node) => [node.id, node] as const));
  const wires = circuit.connections.map(connectionEndpoints);
  const leaves: DerivedTableLeaf[] = [];
  const leafIndex = new Map<string, number>();

  // Ports are compared by canonical pin id, the same contract the drawing uses (in1 -> a, ...).
  const pinsOf = (nodeId: string) => {
    const node = nodes.get(nodeId);
    return node ? resolvePortGeometry(node, options.getMetadata?.(node.type, node)) : null;
  };
  const canonical = (nodeId: string, port: string) => {
    const geometry = pinsOf(nodeId);
    return geometry ? findPin(geometry, port)?.id ?? port : port;
  };
  const driverOf = (nodeId: string, port: string) => {
    const wanted = canonical(nodeId, port);
    const incoming = wires.filter((wire) => wire.to.nodeId === nodeId && canonical(nodeId, wire.to.port) === wanted);
    return incoming.length === 1 ? incoming[0].from : incoming.length === 0 ? null : 'ambiguous';
  };

  // One state element output names one stored bit: Q, q and out are the same bit, and an
  // inverted output (Q_inv, QN) is that bit negated. Distinct bits (Q0, Q1) stay distinct.
  // Inversion is read from the wire's own port name too, because a symbol without chip
  // metadata folds every output name onto its single drawn pin.
  const INVERTED_NAME = /(_inv|_n|_?bar)$|^(qn|nq)$/i;
  const stateBit = (nodeId: string, port: string): { readonly port: string; readonly inverted: boolean } => {
    // A bit-addressed output (Q[0], Q(1)) of a register bus is its own stored bit: keep it exact,
    // because pin lookup folds every bit onto the bus pin.
    if (/[[(]\d+[\])]$/.test(port)) return { port, inverted: false };
    const geometry = pinsOf(nodeId);
    const plainOutputs = (geometry?.pins ?? []).filter((pin) => pin.direction === 'out' && !pin.invert);
    const resolve = (name: string) => (geometry ? findPin(geometry, name) : undefined);
    const named = resolve(port);
    const inverted = INVERTED_NAME.test(port) || named?.invert === true;
    const baseName = !inverted ? port : /^(qn|nq)$/i.test(port) ? 'Q' : port.replace(/(_inv|_n|_?bar)$/i, '');
    const base = inverted ? resolve(baseName) : named;
    let id = base && !base.invert ? base.id : baseName;
    if (/^(out|q)$/i.test(id) && plainOutputs.length > 0) id = plainOutputs[0].id;
    return { port: id, inverted };
  };
  const leafFor = (nodeId: string, port: string): Term | string => {
    const key = `${nodeId}.${port}`;
    let index = leafIndex.get(key);
    if (index === undefined) {
      index = leaves.length;
      if (index >= maxLeaves) return `More than ${maxLeaves} inputs`;
      leaves.push({ nodeId, port, label: label(nodeId, port) });
      leafIndex.set(key, index);
    }
    return { kind: 'leaf', index };
  };

  const visit = (nodeId: string, port: string, path: ReadonlySet<string>): Term | string => {
    const node = nodes.get(nodeId);
    if (!node) return `Unknown node ${nodeId}`;
    const type = node.type.toUpperCase();
    const constant = CONSTANTS[type];
    if (constant !== undefined) return { kind: 'const', value: constant };
    if (STATE_TYPES.test(node.type)) {
      const bit = stateBit(nodeId, port);
      const leaf = leafFor(nodeId, bit.port);
      if (typeof leaf === 'string') return leaf;
      return bit.inverted ? { kind: 'op', op: 'NOT', children: [leaf] } : leaf;
    }
    if (LEAF_TYPES.test(type)) return leafFor(nodeId, port);
    const op = OP_ALIASES[type] ?? type;
    if (!OPS[op]) return `Unsupported part ${node.type}`;
    if (path.has(nodeId)) return 'Combinational loop';
    // Every declared input pin must be driven; an unconnected pin is read as 0 by the simulator,
    // which the table will not silently assume.
    const declared = (pinsOf(nodeId)?.pins ?? []).filter((pin) => pin.direction === 'in').map((pin) => pin.id);
    const inputPorts = declared.length > 0
      ? declared
      : [...new Set(wires.filter((wire) => wire.to.nodeId === nodeId).map((wire) => canonical(nodeId, wire.to.port)))].sort();
    if (inputPorts.length === 0) return `${node.label ?? nodeId} has no driven input`;
    const next = new Set(path).add(nodeId);
    const children: Term[] = [];
    for (const inputPort of inputPorts) {
      const driver = driverOf(nodeId, inputPort);
      if (driver === null) return `${node.label ?? nodeId}.${inputPort} is undriven`;
      if (driver === 'ambiguous') return `${node.label ?? nodeId}.${inputPort} has several drivers`;
      const child = visit(driver.nodeId, driver.port, next);
      if (typeof child === 'string') return child;
      children.push(child);
    }
    return { kind: 'op', op, children };
  };

  let root: Term | string;
  if (options.fromDriver) {
    // The target is itself a driving pin (a gate's output): derive its own cone.
    root = visit(target.nodeId, target.port, new Set());
  } else {
    const driver = driverOf(target.nodeId, target.port);
    if (driver === null) return { ok: false, reason: 'The selected input is undriven' };
    if (driver === 'ambiguous') return { ok: false, reason: 'The selected input has several drivers' };
    root = visit(driver.nodeId, driver.port, new Set([target.nodeId]));
  }
  if (typeof root === 'string') return { ok: false, reason: root };
  if (root.kind !== 'op' && options.fromDriver) return { ok: false, reason: 'A boundary input, constant or stored state has no combinational cone' };

  const evaluate = (term: Term, bits: readonly (0 | 1)[]): 0 | 1 =>
    term.kind === 'leaf' ? bits[term.index]
      : term.kind === 'const' ? term.value
        : OPS[term.op].fn(term.children.map((child) => evaluate(child, bits)));
  const render = (term: Term, top = false): string => {
    if (term.kind === 'leaf') return leaves[term.index].label;
    if (term.kind === 'const') return String(term.value);
    const op = OPS[term.op];
    if (term.op === 'NOT') return `¬${render(term.children[0])}`;
    if (term.op === 'BUFFER') return render(term.children[0], top);
    const inner = term.children.map((child) => render(child)).join(` ${op.symbol} `);
    const body = top ? inner : `(${inner})`;
    return term.op === 'NAND' || term.op === 'NOR' || term.op === 'XNOR' ? `¬(${inner})` : body;
  };

  const rows: { inputs: (0 | 1)[]; output: 0 | 1 }[] = [];
  const width = leaves.length;
  for (let value = 0; value < 1 << width; value += 1) {
    const inputs = Array.from({ length: width }, (_, bit) => ((value >> (width - 1 - bit)) & 1) as 0 | 1);
    rows.push({ inputs, output: evaluate(root, inputs) });
  }
  return { ok: true, table: { target, leaves, rows, expression: render(root, true) } };
}
