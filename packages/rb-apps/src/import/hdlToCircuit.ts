// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// HDL Import Pipeline — shared types, component mapping, and auto-layout engine.

import type { Circuit, Node, Connection } from '@redbyte/rb-logic-core';

// ─── Parsed intermediate representation ──────────────────────────────────────

export interface ParsedPort {
  name: string;
  direction: 'in' | 'out';
  /** e.g. 'STD_LOGIC' or 'std_logic' or 'logic' — not yet a bus */
  typeName: string;
}

export interface ParsedInstance {
  /** Unique label in the HDL: u0, u1, and_inst_0, … */
  id: string;
  /** Component/module name as written: AND2, and_gate, full_adder, … */
  componentType: string;
  /** Port map: HDL port name → connected signal/port name */
  portMap: Record<string, string>;
}

export interface ParsedHDL {
  entityName: string;
  ports: ParsedPort[];
  instances: ParsedInstance[];
  /** Signal names declared inside the entity/module */
  signals: string[];
  /** Non-fatal issues encountered during parsing */
  warnings: string[];
  /** Language that was parsed */
  lang: 'vhdl' | 'verilog';
}

export type ReconstructionLevel = 'full' | 'ports-only' | 'empty';

export interface ImportResult {
  circuit: Circuit;
  warnings: string[];
  /** Instances that could not be mapped to a built-in node type */
  unmappedComponents: string[];
  /** How faithfully the circuit was reconstructed from the HDL source */
  reconstructionLevel: ReconstructionLevel;
}

// ─── Component type mapping ───────────────────────────────────────────────────

/**
 * Maps HDL component names (case-insensitive) → RedByte node type strings.
 * Covers: Vivado primitives, lab-generated names, and common patterns.
 */
const COMPONENT_MAP: Record<string, string> = {
  // AND variants
  and: 'AND', and2: 'AND', and3: 'AND', and4: 'AND',
  and_gate: 'AND', and2_gate: 'AND',
  lut2_and: 'AND', lut3_and: 'AND',

  // OR variants
  or: 'OR', or2: 'OR', or3: 'OR', or4: 'OR',
  or_gate: 'OR', or2_gate: 'OR',

  // NOT / INV
  not: 'NOT', inv: 'NOT', inverter: 'NOT',
  not_gate: 'NOT', inv_gate: 'NOT', buf: 'NOT',

  // NAND
  nand: 'NAND', nand2: 'NAND', nand3: 'NAND', nand4: 'NAND',
  nand_gate: 'NAND',

  // NOR
  nor: 'NOR', nor2: 'NOR', nor3: 'NOR', nor4: 'NOR',
  nor_gate: 'NOR',

  // XOR
  xor: 'XOR', xor2: 'XOR', xor3: 'XOR',
  xor_gate: 'XOR',

  // XNOR
  xnor: 'XNOR', xnor2: 'XNOR', xnor3: 'XNOR',
  xnor_gate: 'XNOR', xnor2_gate: 'XNOR',

  // Full adder
  full_adder: 'FullAdder', fulladder: 'FullAdder',
  fa: 'FullAdder', full_add: 'FullAdder',

  // D flip-flop
  dff: 'DFlipFlop', d_ff: 'DFlipFlop', dflipflop: 'DFlipFlop',
  d_flip_flop: 'DFlipFlop', fdre: 'DFlipFlop', fdce: 'DFlipFlop',
};

function resolveComponentType(raw: string): string | null {
  return COMPONENT_MAP[raw.toLowerCase()] ?? null;
}

// ─── Port name normalisation ──────────────────────────────────────────────────

/**
 * Map common HDL port names to the RedByte internal port names.
 * RedByte uses: a, b (inputs), out (output) for gates; in/out for IO.
 */
function normalisePortName(
  hdlPort: string,
  rbNodeType: string,
  portIndex: number,
): string {
  const p = hdlPort.toLowerCase();

  // Output port names
  if (['y', 'o', 'q', 'out', 'z', 'f', 'result'].includes(p)) return 'out';

  // NOT gate has only one input
  if (rbNodeType === 'NOT') {
    if (['a', 'i', 'in', 'input', 'x'].includes(p) || portIndex === 0) return 'in';
    return 'out';
  }

  // FullAdder
  if (rbNodeType === 'FullAdder') {
    if (p === 'cin' || p === 'c_in' || p === 'carry_in') return 'cin';
    if (p === 'sum' || p === 's') return 'sum';
    if (p === 'cout' || p === 'c_out' || p === 'carry_out') return 'cout';
    if (p === 'a' || portIndex === 0) return 'a';
    if (p === 'b' || portIndex === 1) return 'b';
  }

  // DFlipFlop
  if (rbNodeType === 'DFlipFlop') {
    if (['clk', 'clock', 'c', 'ck'].includes(p)) return 'clk';
    if (['q', 'out', 'qout'].includes(p)) return 'q';
    if (['qb', 'q_n', 'qbar', 'q_inv'].includes(p)) return 'q_inv';
    if (p === 'd' || portIndex === 0) return 'd';
  }

  // Standard 2-input gates: a/b/out
  if (p === 'a' || p === 'i0' || p === 'in0' || portIndex === 0) return 'a';
  if (p === 'b' || p === 'i1' || p === 'in1' || portIndex === 1) return 'b';

  return p; // Fall through: keep as-is
}

// ─── Auto-layout engine ───────────────────────────────────────────────────────

const GRID_X = 160;
const GRID_Y = 80;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

/**
 * Assign (x, y) positions to nodes using a column-based topological layout:
 *   Col 0: INPUT nodes (entity input ports)
 *   Col 1..N: gate instances, sorted by dependency depth
 *   Col N+1: OUTPUT nodes (entity output ports)
 */
function assignPositions(nodes: Node[], connections: Connection[]): Node[] {
  const GRID_Y_SPACING = 96; // was 80 — extra breathing room for labels

  const inputNodes = nodes.filter((n) => n.type === 'INPUT');
  const outputNodes = nodes.filter((n) => n.type === 'OUTPUT');
  const gateNodes = nodes.filter((n) => n.type !== 'INPUT' && n.type !== 'OUTPUT');

  // Build dependency map: gate node id → set of ids that feed into it
  const deps: Map<string, Set<string>> = new Map();
  for (const n of gateNodes) deps.set(n.id, new Set());

  for (const conn of connections) {
    const fromId = typeof conn.from === 'string' ? conn.from : (conn.from as any).nodeId;
    const toId = typeof conn.to === 'string' ? conn.to : (conn.to as any).nodeId;
    if (
      deps.has(toId) &&
      (deps.has(fromId) || nodes.find((n) => n.id === fromId)?.type === 'INPUT')
    ) {
      deps.get(toId)?.add(fromId);
    }
  }

  // Compute topological depth per gate node
  const depthMap: Map<string, number> = new Map();
  function getDepth(id: string): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    const node = nodes.find((n) => n.id === id);
    if (!node || node.type === 'INPUT') return 0;
    const d = deps.get(id);
    if (!d || d.size === 0) {
      depthMap.set(id, 1);
      return 1;
    }
    const max = Math.max(...[...d].map(getDepth));
    depthMap.set(id, max + 1);
    return max + 1;
  }
  for (const n of gateNodes) getDepth(n.id);

  // Group gate nodes by column
  const columns: Map<number, Node[]> = new Map();
  for (const n of gateNodes) {
    const col = depthMap.get(n.id) ?? 1;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(n);
  }
  const maxGateCol = columns.size > 0 ? Math.max(...columns.keys()) : 0;
  const outputCol = maxGateCol + 1;

  // Global vertical centering: find tallest column, center everything around it
  const allColSizes = [
    inputNodes.length,
    ...[...columns.values()].map((c) => c.length),
    outputNodes.length,
  ];
  const maxColSize = Math.max(...allColSizes);
  const globalCenterY = ORIGIN_Y + ((maxColSize - 1) * GRID_Y_SPACING) / 2;

  function colStartY(colSize: number): number {
    return globalCenterY - ((colSize - 1) * GRID_Y_SPACING) / 2;
  }

  // Track positioned nodes for cross-reduction heuristic
  const positionedById = new Map<string, { x: number; y: number }>();
  const positioned: Node[] = [];

  // INPUT column (col 0) — centered
  const inputStartY = colStartY(inputNodes.length);
  inputNodes.forEach((n, i) => {
    const y = inputStartY + i * GRID_Y_SPACING;
    positioned.push({ ...n, x: ORIGIN_X, y });
    positionedById.set(n.id, { x: ORIGIN_X, y });
  });

  // Gate columns (1 … maxGateCol) — sorted by avg predecessor Y for cross-reduction
  for (const [col, colNodes] of [...columns.entries()].sort(([a], [b]) => a - b)) {
    // Sort nodes in this column by the average Y of their already-positioned predecessors
    const nodesWithAvgY = colNodes.map((n) => {
      const predecessorIds = deps.get(n.id) ?? new Set<string>();
      const ys = [...predecessorIds]
        .map((id) => positionedById.get(id)?.y)
        .filter((y): y is number => y !== undefined);
      const avgY = ys.length > 0 ? ys.reduce((a, b) => a + b, 0) / ys.length : globalCenterY;
      return { n, avgY };
    });
    nodesWithAvgY.sort((a, b) => a.avgY - b.avgY);
    const sortedNodes = nodesWithAvgY.map((w) => w.n);

    const startY = colStartY(sortedNodes.length);
    sortedNodes.forEach((n, i) => {
      const x = ORIGIN_X + col * GRID_X;
      const y = startY + i * GRID_Y_SPACING;
      positioned.push({ ...n, x, y });
      positionedById.set(n.id, { x, y });
    });
  }

  // OUTPUT column — centered
  const outputStartY = colStartY(outputNodes.length);
  outputNodes.forEach((n, i) => {
    const x = ORIGIN_X + outputCol * GRID_X;
    const y = outputStartY + i * GRID_Y_SPACING;
    positioned.push({ ...n, x, y });
    positionedById.set(n.id, { x, y });
  });

  return positioned;
}

// ─── Main conversion ──────────────────────────────────────────────────────────

/**
 * Convert a ParsedHDL intermediate representation into a RedByte Circuit.
 */
export function parsedHdlToCircuit(parsed: ParsedHDL): ImportResult {
  const warnings = [...parsed.warnings];
  const unmappedComponents: string[] = [];
  const nodes: Node[] = [];
  const connections: Connection[] = [];

  // 1. Create INPUT nodes for each 'in' port on the entity
  const inputPorts = parsed.ports.filter((p) => p.direction === 'in');
  const outputPorts = parsed.ports.filter((p) => p.direction === 'out');

  for (const port of inputPorts) {
    nodes.push({ id: `port_${port.name}`, type: 'INPUT', label: port.name, x: 0, y: 0 });
  }
  for (const port of outputPorts) {
    nodes.push({ id: `port_out_${port.name}`, type: 'OUTPUT', label: port.name, x: 0, y: 0 });
  }

  // Signal → producing node+port lookup (for wiring)
  const signalSource: Map<string, { nodeId: string; port: string }> = new Map();
  for (const port of inputPorts) {
    signalSource.set(port.name.toLowerCase(), { nodeId: `port_${port.name}`, port: 'out' });
  }

  // 2. Create gate nodes for each component instance
  for (const inst of parsed.instances) {
    const rbType = resolveComponentType(inst.componentType);
    if (!rbType) {
      warnings.push(`Unknown component '${inst.componentType}' (instance '${inst.id}') — skipped`);
      unmappedComponents.push(inst.componentType);
      continue;
    }
    nodes.push({ id: inst.id, type: rbType, label: inst.id, x: 0, y: 0 });

    // Register this instance's output signals in the source map
    const portEntries = Object.entries(inst.portMap);
    portEntries.forEach(([hdlPort, signal], idx) => {
      const rbPort = normalisePortName(hdlPort, rbType, idx);
      if (rbPort === 'out' || rbPort === 'sum' || rbPort === 'cout' || rbPort === 'q') {
        signalSource.set(signal.toLowerCase(), { nodeId: inst.id, port: rbPort });
      }
    });
  }

  // 3. Wire connections: for each instance input port, find its signal source
  for (const inst of parsed.instances) {
    const rbType = resolveComponentType(inst.componentType);
    if (!rbType) continue;

    const portEntries = Object.entries(inst.portMap);
    portEntries.forEach(([hdlPort, signal], idx) => {
      const rbPort = normalisePortName(hdlPort, rbType, idx);
      const isOutput = ['out', 'sum', 'cout', 'q', 'q_inv'].includes(rbPort);
      if (isOutput) return; // Output ports don't receive connections

      const src = signalSource.get(signal.toLowerCase());
      if (!src) {
        warnings.push(`Signal '${signal}' not driven in instance '${inst.id}.${hdlPort}'`);
        return;
      }
      connections.push({
        from: { nodeId: src.nodeId, portName: src.port } as any,
        to: { nodeId: inst.id, portName: rbPort } as any,
      });
    });
  }

  // 4. Wire entity output ports: find what drives each output signal
  for (const port of outputPorts) {
    const portMapEntry = parsed.instances
      .flatMap((inst) =>
        Object.entries(inst.portMap)
          .filter(([, sig]) => sig.toLowerCase() === port.name.toLowerCase())
          .map(([hdlPort]) => ({ inst, hdlPort })),
      )
      .at(0);

    if (portMapEntry) {
      const rbType = resolveComponentType(portMapEntry.inst.componentType);
      if (rbType) {
        const portEntries = Object.entries(portMapEntry.inst.portMap);
        const idx = portEntries.findIndex(([p]) => p === portMapEntry.hdlPort);
        const rbPort = normalisePortName(portMapEntry.hdlPort, rbType, idx);
        connections.push({
          from: { nodeId: portMapEntry.inst.id, portName: rbPort } as any,
          to: { nodeId: `port_out_${port.name}`, portName: 'in' } as any,
        });
      }
    } else {
      // Check if an input is directly connected to this output (pass-through)
      const src = signalSource.get(port.name.toLowerCase());
      if (src) {
        connections.push({
          from: { nodeId: src.nodeId, portName: src.port } as any,
          to: { nodeId: `port_out_${port.name}`, portName: 'in' } as any,
        });
      } else {
        warnings.push(`Output port '${port.name}' has no driver`);
      }
    }
  }

  // 5. Auto-layout
  const positionedNodes = assignPositions(nodes, connections);

  const hasGates = positionedNodes.some(
    (node) => node.type !== 'INPUT' && node.type !== 'OUTPUT'
  );
  const reconstructionLevel: ReconstructionLevel =
    positionedNodes.length === 0
      ? 'empty'
      : !hasGates
        ? 'ports-only'
        : 'full';

  return {
    circuit: { nodes: positionedNodes, connections },
    warnings,
    unmappedComponents,
    reconstructionLevel,
  };
}
