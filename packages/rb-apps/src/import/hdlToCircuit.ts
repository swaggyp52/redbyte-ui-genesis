// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// HDL Import Pipeline — shared types, component mapping, and auto-layout engine.

import type { Circuit, Node, Connection } from '@redbyte/rb-logic-core';
import { inputPinsOf, outputPortsOf, resolveImportedComponentType } from '@redbyte/rb-logic-core';

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

export type ParsedHdlWarning = {
  message: string;
  line?: number;  // 1-based, resolved against original source
  col?: number;   // 1-based
  kind?: 'structural' | 'named';
  /**
   * The parser did not rebuild this construct (an unsupported process or expression), so a
   * circuit built from the rest would not be the design: parsedHdlToCircuit keeps only the ports.
   */
  dropsLogic?: boolean;
};

export interface ParsedHDL {
  entityName: string;
  ports: ParsedPort[];
  instances: ParsedInstance[];
  /** Signal names declared inside the entity/module */
  signals: string[];
  /** Non-fatal issues encountered during parsing */
  warnings: ParsedHdlWarning[];
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
  /**
   * Every construct of the HDL body that was not rebuilt exactly, by name. When any is listed the
   * circuit is the port scaffold (reconstructionLevel 'ports-only'): logic built around a hole
   * would simulate and export a design the source does not describe (an unconnected pin reads a
   * level the source never set), while the scaffold's undriven outputs refuse Export by name.
   */
  unreconstructed: string[];
}

// ─── Component type mapping ───────────────────────────────────────────────────

/** Resolve HDL component names through the shared component support matrix. */
function resolveComponentType(raw: string): string | null {
  return resolveImportedComponentType(raw);
}

// ─── Port name normalisation ──────────────────────────────────────────────────

/**
 * The port names the engine reads (inputPinsOf) and publishes (outputPortsOf) on one configured
 * part: the only authority for which side of a part an HDL port is on. Null for a part the
 * engine does not simulate or define, whose ports the importer must not guess.
 */
interface PortAuthority {
  readonly inputs: ReadonlySet<string>;
  readonly outputs: ReadonlySet<string>;
}

function portAuthorityOf(rbNodeType: string, config: Record<string, unknown> | undefined): PortAuthority | null {
  const inputs = inputPinsOf(rbNodeType, config);
  const outputs = outputPortsOf(rbNodeType, config);
  if (!inputs || !outputs) return null;
  return {
    inputs: new Set(inputs.flatMap((pin) => [...pin.names, ...(pin.bitNames ?? [])])),
    outputs: new Set(outputs.flatMap((port) => port.names)),
  };
}

/**
 * The connection port name the simulator reads or publishes for this part: the role name when
 * the engine uses it as written, else the engine's spelling of it (a FullAdder is A, B, Cin, Sum
 * and Cout, a register's inverted output Q_inv). A name the engine has neither way is kept, and
 * the importer names it as a port the part does not have.
 */
function enginePortName(authority: PortAuthority, name: string): string {
  const names = [...authority.inputs, ...authority.outputs];
  if (names.includes(name)) return name;
  return names.find((candidate) => candidate.toLowerCase() === name.toLowerCase()) ?? name;
}

/**
 * Map common HDL port names to the port names the simulator reads and publishes.
 * RedByte uses: a, b (inputs), out (output) for gates; in/out for IO; A, B, Cin, Sum, Cout for a
 * FullAdder.
 */
function normalisePortName(
  hdlPort: string,
  rbNodeType: string,
  portIndex: number,
  authority: PortAuthority,
): string {
  return enginePortName(authority, rolePortName(hdlPort, rbNodeType, portIndex));
}

/** The role an HDL port name plays on a RedByte part (see normalisePortName). */
function rolePortName(
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

  // DFlipFlop / Register-family
  if (rbNodeType === 'DFlipFlop' || rbNodeType === 'Register1' || rbNodeType === 'RegisterBus' || rbNodeType === 'StateBank') {
    if (['clk', 'clock', 'c', 'ck'].includes(p)) return 'CLK';
    if (['ce', 'en', 'enable'].includes(p)) return 'EN';
    if (['clr', 'rst', 'reset', 'r'].includes(p)) return 'RST';
    if (['q', 'out', 'qout'].includes(p)) return 'q';
    if (['qb', 'q_n', 'qbar', 'q_inv'].includes(p)) return 'q_inv';
    if (p === 'd' || portIndex === 0) return 'D';
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
  const depthVisiting = new Set<string>();
  function getDepth(id: string): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (depthVisiting.has(id)) {
      // Break cyclic recursion for sequential feedback imports.
      return 1;
    }
    depthVisiting.add(id);
    const node = nodes.find((n) => n.id === id);
    if (!node || node.type === 'INPUT') {
      depthVisiting.delete(id);
      return 0;
    }
    const d = deps.get(id);
    if (!d || d.size === 0) {
      depthMap.set(id, 1);
      depthVisiting.delete(id);
      return 1;
    }
    const max = Math.max(...[...d].map(getDepth));
    depthMap.set(id, max + 1);
    depthVisiting.delete(id);
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

/** A pass-through: VHDL `y <= x;` (ALIAS) or Verilog `assign y = x;` (Wire), both { in, out }. */
function isPassThrough(inst: ParsedInstance): boolean {
  return /^(alias|wire)$/i.test(inst.componentType);
}

/** A constant level: '0'/'1' in an expression, 0/1 in a port map (the parser strips the quotes). */
function constantLevel(signal: string): 0 | 1 | null {
  const token = signal.trim().replace(/^'([01])'$/, '$1');
  return token === '0' ? 0 : token === '1' ? 1 : null;
}

/**
 * Convert a ParsedHDL intermediate representation into a RedByte Circuit.
 *
 * Each port of an instance is an input or an output because the engine reads or publishes it
 * (inputPinsOf / outputPortsOf for the configured part), never because of how it is spelled. A
 * constant is a Ground or PowerSource tie. Anything not rebuilt exactly is listed in
 * `unreconstructed`, and then only the port scaffold is returned.
 */
export function parsedHdlToCircuit(parsed: ParsedHDL): ImportResult {
  const warnings: string[] = [...parsed.warnings.map((w) => w.message)];
  const unreconstructed: string[] = parsed.warnings.filter((w) => w.dropsLogic).map((w) => w.message);
  const unmappedComponents: string[] = [];
  const portNodes: Node[] = [];
  const connections: Connection[] = [];
  const notRebuilt = (message: string) => {
    warnings.push(message);
    unreconstructed.push(message);
  };

  // 1. Create INPUT nodes for each 'in' port on the entity
  const inputPorts = parsed.ports.filter((p) => p.direction === 'in');
  const outputPorts = parsed.ports.filter((p) => p.direction === 'out');

  for (const port of inputPorts) {
    portNodes.push({ id: `port_${port.name}`, type: 'INPUT', label: port.name, x: 0, y: 0 });
  }
  for (const port of outputPorts) {
    portNodes.push({ id: `port_out_${port.name}`, type: 'OUTPUT', label: port.name, x: 0, y: 0 });
  }
  const nodes: Node[] = [...portNodes];

  // Signal → producing node+port lookup (for wiring)
  const signalSource: Map<string, { nodeId: string; port: string }> = new Map();
  const aliasToSource: Map<string, string> = new Map();
  const resolveAlias = (raw: string): string => {
    const visited = new Set<string>();
    let current = raw.toLowerCase();
    while (aliasToSource.has(current) && !visited.has(current)) {
      visited.add(current);
      current = aliasToSource.get(current)!;
    }
    return current;
  };

  for (const inst of parsed.instances) {
    if (!isPassThrough(inst)) continue;
    const from = inst.portMap.in?.toLowerCase();
    const to = inst.portMap.out?.toLowerCase();
    if (!from || !to) continue;
    aliasToSource.set(to, from);
  }

  for (const port of inputPorts) {
    signalSource.set(port.name.toLowerCase(), { nodeId: `port_${port.name}`, port: 'out' });
  }

  // 2. Create a node for each component instance; its outputs become signal sources
  const reads: Array<{ instId: string; hdlPort: string; signal: string; pin: string }> = [];
  for (const inst of parsed.instances) {
    if (isPassThrough(inst)) continue;
    const rbType = resolveComponentType(inst.componentType);
    if (!rbType) {
      notRebuilt(`Unknown component '${inst.componentType}' (instance '${inst.id}') — skipped`);
      unmappedComponents.push(inst.componentType);
      continue;
    }
    const sequentialConfig =
      rbType === 'Register1' || rbType === 'RegisterBus' || rbType === 'StateBank'
        ? {
            width: rbType === 'Register1' ? 1 : undefined,
            resetKind: 'async_clear',
            resetPolarity: 'active_high',
            clockPolarity: 'rising_edge',
            hasEnable: Object.keys(inst.portMap).some((key) => ['ce', 'en', 'enable'].includes(key.toLowerCase())),
          }
        : undefined;
    const authority = portAuthorityOf(rbType, sequentialConfig);
    if (!authority) {
      notRebuilt(`Instance '${inst.id}' (${rbType}): RedByte does not simulate this part's ports — not rebuilt`);
      continue;
    }

    nodes.push({
      id: inst.id,
      type: rbType,
      label: inst.id,
      x: 0,
      y: 0,
      ...(sequentialConfig ? { config: sequentialConfig as Record<string, unknown> } : {}),
    });

    Object.entries(inst.portMap).forEach(([hdlPort, signal], idx) => {
      const pin = normalisePortName(hdlPort, rbType, idx, authority);
      if (authority.outputs.has(pin)) {
        const key = resolveAlias(signal);
        if (key === 'open' || constantLevel(key) !== null) return;
        const driver = signalSource.get(key);
        if (driver) notRebuilt(`Signal '${signal}' is driven by both '${driver.nodeId}' and '${inst.id}' — not rebuilt`);
        else signalSource.set(key, { nodeId: inst.id, port: pin });
      } else if (authority.inputs.has(pin)) {
        reads.push({ instId: inst.id, hdlPort, signal, pin });
      } else {
        notRebuilt(`Instance '${inst.id}' (${rbType}) has no port '${hdlPort}' — not rebuilt`);
      }
    });
  }

  // A constant is one shared Ground ('0') or PowerSource ('1') part.
  const ties = new Map<0 | 1, string>();
  const tieSource = (level: 0 | 1) => {
    let id = ties.get(level);
    if (!id) {
      const base = level === 1 ? 'tie_1' : 'tie_0';
      id = base;
      for (let n = 1; nodes.some((node) => node.id === id); n += 1) id = `${base}_${n}`;
      ties.set(level, id);
      nodes.push({ id, type: level === 1 ? 'PowerSource' : 'Ground', label: level === 1 ? 'VCC' : 'GND', x: 0, y: 0 });
    }
    return { nodeId: id, port: 'out' };
  };
  const sourceOf = (signal: string) => {
    const key = resolveAlias(signal);
    const level = constantLevel(key);
    if (level !== null) return tieSource(level);
    return key === 'open' ? undefined : signalSource.get(key);
  };

  // 3. Wire each input the engine reads from its signal's source
  for (const { instId, hdlPort, signal, pin } of reads) {
    const src = sourceOf(signal);
    if (!src) {
      notRebuilt(`Signal '${signal}' not driven in instance '${instId}.${hdlPort}'`);
      continue;
    }
    connections.push({
      from: { nodeId: src.nodeId, portName: src.port } as any,
      to: { nodeId: instId, portName: pin } as any,
    });
  }

  // 4. Wire each entity output from its signal's source
  for (const port of outputPorts) {
    const src = sourceOf(port.name);
    if (src) {
      connections.push({
        from: { nodeId: src.nodeId, portName: src.port } as any,
        to: { nodeId: `port_out_${port.name}`, portName: 'in' } as any,
      });
    } else {
      warnings.push(`Output port '${port.name}' has no driver`);
    }
  }

  // 5. Anything not rebuilt exactly leaves the port scaffold, which Export refuses by name.
  if (unreconstructed.length > 0) {
    return {
      circuit: { nodes: assignPositions(portNodes, []), connections: [] },
      warnings,
      unmappedComponents,
      reconstructionLevel: portNodes.length === 0 ? 'empty' : 'ports-only',
      unreconstructed,
    };
  }

  // 6. Auto-layout
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
    unreconstructed,
  };
}
