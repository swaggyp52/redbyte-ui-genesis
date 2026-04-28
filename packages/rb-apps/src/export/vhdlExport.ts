// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Netlist, NetlistNode, NetlistNet } from './netlistExport';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface VhdlExportOptions {
  /** VHDL entity name (default: 'top') */
  entityName?: string;
  /** Emit a comment file header */
  includeFileHeader?: boolean;
  /** Lab title string used in the file header */
  labTitle?: string;
  /** Explicit top-level ports (used by board-aware bundle exporters) */
  topPorts?: VhdlTopPort[];
  /** Explicit input bindings (top-level input port -> node input target) */
  topInputBindings?: VhdlTopInputBinding[];
  /** Explicit output bindings (top-level output port <- node output source) */
  topOutputBindings?: VhdlTopOutputBinding[];
}

export interface VhdlTopPort {
  name: string;
  dir: 'in' | 'out';
  vhdlType?: 'STD_LOGIC' | string;
}

export interface VhdlTopInputBinding {
  portName: string;
  bitIndex?: number;
  toNodeId: string;
  toPort: string;
}

export interface VhdlTopOutputBinding {
  portName: string;
  bitIndex?: number;
  fromNodeId: string;
  fromPort: string;
}

export interface VhdlExportResult {
  vhd: string;
  entityName: string;
  inputPorts: string[];
  outputPorts: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Node types that are top-level inputs (physical switches/buttons on Basys3)
 */
const INPUT_NODE_TYPES = new Set(['INPUT', 'Switch', 'Button', 'Clock', 'CLOCK']);

/**
 * Node types that are top-level outputs (physical LEDs on Basys3)
 */
const OUTPUT_NODE_TYPES = new Set(['OUTPUT', 'Lamp']);

/**
 * Node types handled natively by this generator.
 * All others produce a warning and are skipped.
 */
const SUPPORTED_LOGIC_TYPES = new Set([
  'PowerSource',
  'Ground',
  'AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR', 'XNOR',
  'AND3', 'OR3', 'NAND3', 'NOR3', 'XOR3',
  'FullAdder',
  'MUX4',
  'DFlipFlop', 'Register1', 'RegisterBus', 'StateBank',
  'DLatch', 'TFlipFlop', 'JKFlipFlop',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the port index from a label such as:
 *   "SW[3]", "SW[3] (A[3])", "LED[0]", "sw_3", etc.
 * Returns -1 if nothing found.
 */
function extractLabelIndex(label: string | undefined): number {
  if (!label) return -1;
  // Match [N] pattern first (e.g. "SW[3]" or "SW[3] (A[3])")
  const bracketMatch = label.match(/\[(\d+)\]/);
  if (bracketMatch) return parseInt(bracketMatch[1], 10);
  // Match trailing _N pattern (e.g. "sw_3")
  const underscoreMatch = label.match(/_(\d+)$/);
  if (underscoreMatch) return parseInt(underscoreMatch[1], 10);
  return -1;
}

/**
 * Derive a clean short signal name from a node.
 * Rules:
 *  - Use the node id prefix (up to first underscore or 8 chars), lower-cased
 *  - Append a disambiguating counter from the caller
 *  - Never include raw UUID hex strings (ids like "a1b2c3d4-...")
 */
function deriveSignalName(node: NetlistNode, counter: number): string {
  const typePrefix: Record<string, string> = {
    PowerSource: 'vcc',
    Ground: 'gnd',
    AND: 'and',
    OR: 'or',
    XOR: 'xor',
    NOT: 'not',
    NAND: 'nand',
    NOR: 'nor',
    XNOR: 'xnor',
    AND3: 'and3',
    OR3: 'or3',
    NAND3: 'nand3',
    NOR3: 'nor3',
    XOR3: 'xor3',
    FullAdder: 'fa',
    MUX4: 'mux',
    DFlipFlop:  'dff',
    Register1: 'reg1',
    RegisterBus: 'regb',
    StateBank: 'bank',
    DLatch:     'dlatch',
    TFlipFlop:  'tff',
    JKFlipFlop: 'jkff',
  };

  const prefix = typePrefix[node.type] ?? 'sig';
  return `${prefix}_${counter}`;
}

/**
 * Determine the VHDL operator for a binary gate type.
 */
function gateOperator(type: string): string | null {
  switch (type) {
    case 'AND':  return 'and';
    case 'OR':   return 'or';
    case 'XOR':  return 'xor';
    case 'NAND': return 'nand';
    case 'NOR':  return 'nor';
    case 'XNOR': return 'xnor';
    default:     return null;
  }
}

/**
 * Determine the VHDL base operator for a 3-input gate type.
 * Returns [baseOp, invert] — if invert=true, wrap in NOT.
 */
function gate3Operator(type: string): { op: string; invert: boolean } | null {
  switch (type) {
    case 'AND3':  return { op: 'and', invert: false };
    case 'OR3':   return { op: 'or',  invert: false };
    case 'NAND3': return { op: 'and', invert: true  };
    case 'NOR3':  return { op: 'or',  invert: true  };
    case 'XOR3':  return { op: 'xor', invert: false };
    default:      return null;
  }
}

function topBindingSignalRef(binding: { portName: string; bitIndex?: number }): string {
  return binding.bitIndex !== undefined
    ? `${binding.portName}(${binding.bitIndex})`
    : binding.portName;
}

// ---------------------------------------------------------------------------
// Port grouping
// ---------------------------------------------------------------------------

interface PortGroup {
  /** Basys3 port name (e.g. "SW", "LED") */
  baseName: string;
  /** direction in VHDL ('in' or 'out') */
  direction: 'in' | 'out';
  /** Ordered list of node IDs, index in array = bit index */
  nodes: { nodeId: string; bitIndex: number }[];
  /** Highest bit index found */
  width: number;
}

/**
 * Group Switch/Lamp nodes into vector port groups.
 *
 * Strategy:
 *  1. Try to read bit index from node.label ("SW[3]" → bit 3)
 *  2. Fall back to order in the node list (0, 1, 2, …)
 *
 * Single-bit groups use STD_LOGIC; multi-bit use STD_LOGIC_VECTOR.
 */
function buildPortGroups(
  inputNodes: NetlistNode[],
  outputNodes: NetlistNode[],
): { inputs: Map<string, PortGroup>; outputs: Map<string, PortGroup> } {
  function populate(
    nodes: NetlistNode[],
    direction: 'in' | 'out',
    defaultBaseName: string,
  ): Map<string, PortGroup> {
    const groups = new Map<string, PortGroup>();

    nodes.forEach((node, listIndex) => {
      // Determine group base name from label prefix (e.g. "SW" from "SW[3]")
      let baseName = defaultBaseName;
      if (node.label) {
        const match = node.label.match(/^([A-Za-z_]+)/);
        if (match) {
          // Normalise to uppercase Basys3 convention
          const raw = match[1].toUpperCase();
          // Map common variants
          if (raw === 'SW' || raw === 'SWITCH') baseName = 'SW';
          else if (raw === 'LED' || raw === 'LAMP') baseName = 'LED';
          else baseName = raw;
        }
      }

      const bitIndex = extractLabelIndex(node.label);
      const effectiveBit = bitIndex >= 0 ? bitIndex : listIndex;

      if (!groups.has(baseName)) {
        groups.set(baseName, { baseName, direction, nodes: [], width: 0 });
      }
      const group = groups.get(baseName)!;
      group.nodes.push({ nodeId: node.id, bitIndex: effectiveBit });
      if (effectiveBit > group.width) group.width = effectiveBit;
    });

    return groups;
  }

  return {
    inputs: populate(inputNodes, 'in', 'SW'),
    outputs: populate(outputNodes, 'out', 'LED'),
  };
}

// ---------------------------------------------------------------------------
// Signal resolution
// ---------------------------------------------------------------------------

/**
 * For a given logic node port (e.g. AND.a), find what signal drives it.
 * Searches the net list for a net whose "to" matches the node/port.
 * Returns the VHDL signal expression (port index or internal signal name).
 */
function resolveInputSignal(
  nodeId: string,
  portName: string,
  nets: NetlistNet[],
  nodeIdToSignal: Map<string, string>,
  topInputBindingByTarget: Map<string, string>,
): string | null {
  const normalizedPortName = portName.toLowerCase();
  const net = nets.find(
    (n) => n.to.nodeId === nodeId && n.to.port.toLowerCase() === normalizedPortName,
  );
  if (!net) {
    const directMatch = topInputBindingByTarget.get(`${nodeId}:${portName}`);
    if (directMatch) return directMatch;
    for (const [target, signalName] of topInputBindingByTarget.entries()) {
      const [targetNodeId, targetPort] = target.split(':');
      if (targetNodeId === nodeId && targetPort.toLowerCase() === normalizedPortName) {
        return signalName;
      }
    }
    return null;
  }
  return (
    nodeIdToSignal.get(`${net.from.nodeId}:${net.from.port}`) ??
    nodeIdToSignal.get(`${net.from.nodeId}:${net.from.port.toLowerCase()}`) ??
    nodeIdToSignal.get(net.from.nodeId) ??
    null
  );
}

/**
 * For a given logic node's "out" port, find what signal is driven by it.
 * Returns the VHDL signal name assigned to that node's output.
 */
function resolveOutputSignal(
  nodeId: string,
  portName: string,
  nets: NetlistNet[],
  nodeIdToSignal: Map<string, string>,
): string | null {
  // The signal name for a logic gate's output is the signal we allocated to
  // that gate node itself.
  return nodeIdToSignal.get(nodeId) ?? null;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function vhdlFromNetlist(
  netlist: Netlist,
  options: VhdlExportOptions = {},
): VhdlExportResult {
  const {
    entityName = 'top',
    includeFileHeader = false,
    labTitle,
    topPorts,
    topInputBindings,
    topOutputBindings,
  } = options;

  const warnings: string[] = [];
  const lines: string[] = [];

  // ---- Classify nodes -------------------------------------------------------
  // Clock nodes: only those that arrived as IRPort boundary nodes (boundaryKind === 'clock')
  // are top-level entity ports.  Sim-clock primitives (no boundaryKind) are internal
  // oscillators with no hardware equivalent — they are excluded from the entity and
  // will cause DFF clock ports to be "tied low" (with a warning) if present.
  const inputNodes  = netlist.nodes.filter((n) => {
    if (n.type === 'Clock') return n.boundaryKind === 'clock'; // board/legacy clocks only
    return INPUT_NODE_TYPES.has(n.type);
  });
  const outputNodes = netlist.nodes.filter((n) => OUTPUT_NODE_TYPES.has(n.type));
  const logicNodes  = netlist.nodes.filter(
    (n) => !INPUT_NODE_TYPES.has(n.type) && !OUTPUT_NODE_TYPES.has(n.type),
  );

  // Warn about sim-clock nodes that were excluded from entity ports.
  netlist.nodes
    .filter((n) => n.type === 'Clock' && n.boundaryKind !== 'clock')
    .forEach((n) => {
      warnings.push(
        `Sim-only clock "${n.label ?? n.id}" is excluded from the VHDL entity — ` +
        `use CLK100MHZ from Board Resources for FPGA synthesis.`,
      );
    });

  // Warn and collect unsupported types
  logicNodes.forEach((n) => {
    if (!SUPPORTED_LOGIC_TYPES.has(n.type)) {
      warnings.push(`Unsupported node type "${n.type}" (id: ${n.id}) — skipped`);
    }
  });

  const supportedLogicNodes = logicNodes.filter((n) =>
    SUPPORTED_LOGIC_TYPES.has(n.type),
  );

  // ---- Build port groups (SW vector, LED vector, etc.) ----------------------
  const { inputs: inputGroups, outputs: outputGroups } =
    buildPortGroups(inputNodes, outputNodes);

  const topInputBindingByTarget = new Map<string, string>();
  (topInputBindings ?? []).forEach((binding) => {
    const key = `${binding.toNodeId}:${binding.toPort}`;
    if (!topInputBindingByTarget.has(key)) {
      topInputBindingByTarget.set(key, topBindingSignalRef(binding));
    }
  });

  // ---- Map each input/output node ID → VHDL port expression ----------------
  // e.g. switch_0 → "SW(3)" or "SW" (single-bit)
  const nodeIdToSignal = new Map<string, string>();

  inputGroups.forEach((group) => {
    const isVector = group.width > 0 || group.nodes.length > 1;
    group.nodes.forEach(({ nodeId, bitIndex }) => {
      nodeIdToSignal.set(
        nodeId,
        isVector ? `${group.baseName}(${bitIndex})` : group.baseName,
      );
    });
  });

  outputGroups.forEach((group) => {
    const isVector = group.width > 0 || group.nodes.length > 1;
    group.nodes.forEach(({ nodeId, bitIndex }) => {
      nodeIdToSignal.set(
        nodeId,
        isVector ? `${group.baseName}(${bitIndex})` : group.baseName,
      );
    });
  });

  // Top-level input bindings can target non-INPUT helper nodes (for example Clock),
  // so map explicit binding targets directly to VHDL port expressions.
  for (const binding of topInputBindings ?? []) {
    const direct = topBindingSignalRef(binding);
      // Always override: topPort names take precedence over buildPortGroups vector names
      // (e.g. 'sw0_node_out' must override 'SW(0)' otherwise architecture body uses
      //  the undeclared portGroup expression instead of the declared entity port name).
      nodeIdToSignal.set(binding.toNodeId, direct);
    nodeIdToSignal.set(`${binding.toNodeId}:${binding.toPort}`, direct);
  }

  // ---- Assign internal signal names to logic nodes --------------------------
  // Use type-counters so we get and_0, and_1, or_0, fa_0, etc.
  const typeCounters = new Map<string, number>();
  supportedLogicNodes.forEach((node) => {
    const count = typeCounters.get(node.type) ?? 0;
    typeCounters.set(node.type, count + 1);
    const sigName = deriveSignalName(node, count);
    nodeIdToSignal.set(node.id, sigName);
    nodeIdToSignal.set(`${node.id}:out`, sigName);
    if (node.type === 'FullAdder') {
      nodeIdToSignal.set(`${node.id}:sum`, `${sigName}_sum`);
      nodeIdToSignal.set(`${node.id}:carry`, `${sigName}_carry`);
    }
  });

  // ---- Check for unconnected outputs ----------------------------------------
  outputNodes.forEach((outNode) => {
    const hasDriver = netlist.nets.some((net) => net.to.nodeId === outNode.id);
    if (!hasDriver) {
      const portExpr = nodeIdToSignal.get(outNode.id) ?? outNode.id;
      warnings.push(`Output "${portExpr}" (id: ${outNode.id}) has no driver — will default to '0'`);
    }
  });

  // ---- Emit file header (optional) ------------------------------------------
  if (includeFileHeader) {
    lines.push('-- RedByte Generated VHDL');
    lines.push(`-- Entity: ${entityName}`);
    if (labTitle) lines.push(`-- ${labTitle}`);
    lines.push('--');
    lines.push('');
  }

  // ---- Library/use clauses --------------------------------------------------
  lines.push('library IEEE;');
  lines.push('use IEEE.STD_LOGIC_1164.ALL;');
  lines.push('use IEEE.NUMERIC_STD.ALL;');
  lines.push('');

  // ---- Entity declaration ---------------------------------------------------
  lines.push(`entity ${entityName} is`);
  lines.push('  Port (');

  const portDecls: string[] = [];

  // Collect input port strings
  const inputPortNames: string[] = [];
  const outputPortNames: string[] = [];

  if ((topPorts?.length ?? 0) > 0) {
    const seenNames = new Set<string>();
    topPorts?.forEach((port) => {
      if (seenNames.has(port.name)) {
        warnings.push(`Duplicate top port name "${port.name}" ignored`);
        return;
      }
      seenNames.add(port.name);
      const typeStr = port.vhdlType ?? 'STD_LOGIC';
      if (port.dir === 'in') {
        portDecls.push(`    ${port.name} : in  ${typeStr}`);
        inputPortNames.push(port.name);
      } else {
        portDecls.push(`    ${port.name} : out ${typeStr}`);
        outputPortNames.push(port.name);
      }
    });
  } else {
    inputGroups.forEach((group) => {
      const isVector = group.width > 0 || group.nodes.length > 1;
      const typeStr = isVector
        ? `STD_LOGIC_VECTOR(${group.width} downto 0)`
        : 'STD_LOGIC';
      portDecls.push(`    ${group.baseName} : in  ${typeStr}`);
      inputPortNames.push(group.baseName);
    });

    outputGroups.forEach((group) => {
      const isVector = group.width > 0 || group.nodes.length > 1;
      const typeStr = isVector
        ? `STD_LOGIC_VECTOR(${group.width} downto 0)`
        : 'STD_LOGIC';
      portDecls.push(`    ${group.baseName} : out ${typeStr}`);
      outputPortNames.push(group.baseName);
    });
  }

  lines.push(portDecls.join(';\n'));
  lines.push('  );');
  lines.push(`end entity ${entityName};`);
  lines.push('');

  // ---- Architecture ---------------------------------------------------------
  lines.push(`architecture Behavioral of ${entityName} is`);

  // Internal signal declarations
  supportedLogicNodes.forEach((node) => {
    const sigName = nodeIdToSignal.get(node.id)!;
    // FullAdder and MUX4 have multiple outputs; declare carry/sum separately
    if (node.type === 'FullAdder') {
      lines.push(`  signal ${sigName}_sum   : STD_LOGIC;`);
      lines.push(`  signal ${sigName}_carry : STD_LOGIC;`);
    } else {
      lines.push(`  signal ${sigName} : STD_LOGIC;`);
      if (['DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'DLatch', 'TFlipFlop', 'JKFlipFlop'].includes(node.type)) {
        lines.push(`  signal ${sigName}_inv : STD_LOGIC;`);
      }
    }
  });

  lines.push('begin');

  // ---- Concurrent signal assignments ----------------------------------------
  supportedLogicNodes.forEach((node) => {
    const sigName = nodeIdToSignal.get(node.id)!;
    const nets = netlist.nets;

    if (node.type === 'PowerSource') {
      lines.push(`  ${sigName} <= '1';`);
      return;
    }

    if (node.type === 'Ground') {
      lines.push(`  ${sigName} <= '0';`);
      return;
    }

    if (node.type === 'NOT') {
      // NOT has a single input port 'in' (inferred from connections)
      const inSig =
        resolveInputSignal(node.id, 'in', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'a', nets, nodeIdToSignal, topInputBindingByTarget);
      if (!inSig) {
        warnings.push(`NOT gate "${node.id}" has no input — signal ${sigName} will be undriven`);
        lines.push(`  ${sigName} <= '0'; -- undriven NOT gate`);
      } else {
        lines.push(`  ${sigName} <= not ${inSig};`);
      }
      return;
    }

    if (node.type === 'DFlipFlop' || node.type === 'Register1' || node.type === 'RegisterBus' || node.type === 'StateBank') {
      const d =
        resolveInputSignal(node.id, 'd', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'in', nets, nodeIdToSignal, topInputBindingByTarget) ??
        "'0'";
      const clk =
        resolveInputSignal(node.id, 'clk', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'clock', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'c', nets, nodeIdToSignal, topInputBindingByTarget);
      const rst =
        resolveInputSignal(node.id, 'rst', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'reset', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'clr', nets, nodeIdToSignal, topInputBindingByTarget);
      const en =
        resolveInputSignal(node.id, 'en', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'enable', nets, nodeIdToSignal, topInputBindingByTarget);

      nodeIdToSignal.set(`${node.id}:Q`, sigName);
      nodeIdToSignal.set(`${node.id}:q`, sigName);
      nodeIdToSignal.set(`${node.id}:Q_inv`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:qn`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:out`, sigName);

      if (!clk) {
        warnings.push(`${node.type} "${node.id}" has no clock input - signal ${sigName} will be tied low`);
        lines.push(`  ${sigName} <= '0'; -- missing ${node.type} clock`);
        lines.push(`  ${sigName}_inv <= '1';`);
        return;
      }

      if (rst) {
        lines.push(`  process (${clk}, ${rst})`);
        lines.push('  begin');
        lines.push(`    if ${rst} = '1' then`);
        lines.push(`      ${sigName} <= '0';`);
        lines.push(`    elsif rising_edge(${clk}) then`);
      } else {
        lines.push(`  process (${clk})`);
        lines.push('  begin');
        lines.push(`    if rising_edge(${clk}) then`);
      }

      if (en) {
        lines.push(`      if ${en} = '1' then`);
        lines.push(`        ${sigName} <= ${d};`);
        lines.push('      end if;');
      } else {
        lines.push(`      ${sigName} <= ${d};`);
      }

      lines.push('    end if;');
      lines.push('  end process;');
      lines.push(`  ${sigName}_inv <= not ${sigName};`);
      return;
    }

    if (node.type === 'DLatch') {
      const d  =
        resolveInputSignal(node.id, 'd',  nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'in', nets, nodeIdToSignal, topInputBindingByTarget) ??
        "'0'";
      const en =
        resolveInputSignal(node.id, 'en',     nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'enable', nets, nodeIdToSignal, topInputBindingByTarget);

      nodeIdToSignal.set(`${node.id}:Q`, sigName);
      nodeIdToSignal.set(`${node.id}:q`, sigName);
      nodeIdToSignal.set(`${node.id}:Q_inv`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:qn`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:out`, sigName);

      if (!en) {
        warnings.push(`DLatch "${node.id}" has no EN input — Q will be tied low`);
        lines.push(`  ${sigName} <= '0'; -- missing DLatch EN`);
        lines.push(`  ${sigName}_inv <= '1';`);
        return;
      }

      lines.push(`  process (${en}, ${d})`);
      lines.push('  begin');
      lines.push(`    if ${en} = '1' then`);
      lines.push(`      ${sigName} <= ${d};`);
      lines.push('    end if;');
      lines.push('  end process;');
      lines.push(`  ${sigName}_inv <= not ${sigName};`);
      return;
    }

    if (node.type === 'TFlipFlop') {
      const t   =
        resolveInputSignal(node.id, 't',   nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'in',  nets, nodeIdToSignal, topInputBindingByTarget) ??
        "'0'";
      const clk =
        resolveInputSignal(node.id, 'clk',   nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'clock', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'c',     nets, nodeIdToSignal, topInputBindingByTarget);
      const clr =
        resolveInputSignal(node.id, 'clr', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'rst', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'reset', nets, nodeIdToSignal, topInputBindingByTarget);

      nodeIdToSignal.set(`${node.id}:Q`, sigName);
      nodeIdToSignal.set(`${node.id}:q`, sigName);
      nodeIdToSignal.set(`${node.id}:Q_inv`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:qn`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:out`, sigName);

      if (!clk) {
        warnings.push(`TFlipFlop "${node.id}" has no CLK input — Q will be tied low`);
        lines.push(`  ${sigName} <= '0'; -- missing TFlipFlop clock`);
        lines.push(`  ${sigName}_inv <= '1';`);
        return;
      }

      if (clr) {
        lines.push(`  process (${clk}, ${clr})`);
        lines.push('  begin');
        lines.push(`    if ${clr} = '1' then`);
        lines.push(`      ${sigName} <= '0';`);
        lines.push(`    elsif rising_edge(${clk}) then`);
      } else {
        lines.push(`  process (${clk})`);
        lines.push('  begin');
        lines.push(`    if rising_edge(${clk}) then`);
      }
      lines.push(`      if ${t} = '1' then`);
      lines.push(`        ${sigName} <= not ${sigName};`);
      lines.push('      end if;');
      lines.push('    end if;');
      lines.push('  end process;');
      lines.push(`  ${sigName}_inv <= not ${sigName};`);
      return;
    }

    if (node.type === 'JKFlipFlop') {
      const j   =
        resolveInputSignal(node.id, 'j',  nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const k   =
        resolveInputSignal(node.id, 'k',  nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const clk =
        resolveInputSignal(node.id, 'clk',   nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'clock', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'c',     nets, nodeIdToSignal, topInputBindingByTarget);
      const clr =
        resolveInputSignal(node.id, 'clr', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'rst', nets, nodeIdToSignal, topInputBindingByTarget) ??
        resolveInputSignal(node.id, 'reset', nets, nodeIdToSignal, topInputBindingByTarget);

      nodeIdToSignal.set(`${node.id}:Q`, sigName);
      nodeIdToSignal.set(`${node.id}:q`, sigName);
      nodeIdToSignal.set(`${node.id}:Q_inv`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:qn`, `${sigName}_inv`);
      nodeIdToSignal.set(`${node.id}:out`, sigName);

      if (!clk) {
        warnings.push(`JKFlipFlop "${node.id}" has no CLK input — Q will be tied low`);
        lines.push(`  ${sigName} <= '0'; -- missing JKFlipFlop clock`);
        lines.push(`  ${sigName}_inv <= '1';`);
        return;
      }

      if (clr) {
        lines.push(`  process (${clk}, ${clr})`);
        lines.push('  begin');
        lines.push(`    if ${clr} = '1' then`);
        lines.push(`      ${sigName} <= '0';`);
        lines.push(`    elsif rising_edge(${clk}) then`);
      } else {
        lines.push(`  process (${clk})`);
        lines.push('  begin');
        lines.push(`    if rising_edge(${clk}) then`);
      }
      lines.push(`      if ${j} = '1' and ${k} = '0' then`);
      lines.push(`        ${sigName} <= '1';`);
      lines.push(`      elsif ${j} = '0' and ${k} = '1' then`);
      lines.push(`        ${sigName} <= '0';`);
      lines.push(`      elsif ${j} = '1' and ${k} = '1' then`);
      lines.push(`        ${sigName} <= not ${sigName};`);
      lines.push('      end if;');
      lines.push('    end if;');
      lines.push('  end process;');
      lines.push(`  ${sigName}_inv <= not ${sigName};`);
      return;
    }

    if (node.type === 'FullAdder') {
      const a   = resolveInputSignal(node.id, 'a',  nets, nodeIdToSignal, topInputBindingByTarget);
      const b   = resolveInputSignal(node.id, 'b',  nets, nodeIdToSignal, topInputBindingByTarget);
      const cin = resolveInputSignal(node.id, 'cin', nets, nodeIdToSignal, topInputBindingByTarget);
      const aStr   = a   ?? "'0'";
      const bStr   = b   ?? "'0'";
      const cinStr = cin ?? "'0'";
      lines.push(`  ${sigName}_sum   <= ${aStr} xor ${bStr} xor ${cinStr};`);
      lines.push(`  ${sigName}_carry <= (${aStr} and ${bStr}) or (${cinStr} and (${aStr} xor ${bStr}));`);
      // Register sum/carry outputs in signal map for fanout
      // (downstream nodes that read 'sum' or 'carry' output ports)
      nodeIdToSignal.set(`${node.id}:sum`,   `${sigName}_sum`);
      nodeIdToSignal.set(`${node.id}:carry`, `${sigName}_carry`);
      return;
    }

    if (node.type === 'MUX4') {
      // MUX4: inputs i0..i3, select s0/s1 (or sel), output out
      const i0 = resolveInputSignal(node.id, 'i0', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const i1 = resolveInputSignal(node.id, 'i1', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const i2 = resolveInputSignal(node.id, 'i2', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const i3 = resolveInputSignal(node.id, 'i3', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const s0 = resolveInputSignal(node.id, 's0', nets, nodeIdToSignal, topInputBindingByTarget) ??
             resolveInputSignal(node.id, 'sel', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const s1 = resolveInputSignal(node.id, 's1', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      lines.push(`  with ${s1} & ${s0} select`);
      lines.push(`    ${sigName} <= ${i0} when "00",`);
      lines.push(`              ${i1} when "01",`);
      lines.push(`              ${i2} when "10",`);
      lines.push(`              ${i3} when others;`);
      return;
    }

    // 3-input gate (AND3, OR3, NAND3, NOR3, XOR3)
    const g3 = gate3Operator(node.type);
    if (g3) {
      const aSig = resolveInputSignal(node.id, 'a', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const bSig = resolveInputSignal(node.id, 'b', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      const cSig = resolveInputSignal(node.id, 'c', nets, nodeIdToSignal, topInputBindingByTarget) ?? "'0'";
      if (node.type === 'XOR3') {
        lines.push(`  ${sigName} <= ${aSig} xor ${bSig} xor ${cSig};`);
      } else if (g3.invert) {
        lines.push(`  ${sigName} <= not (${aSig} ${g3.op} ${bSig} ${g3.op} ${cSig});`);
      } else {
        lines.push(`  ${sigName} <= ${aSig} ${g3.op} ${bSig} ${g3.op} ${cSig};`);
      }
      return;
    }

    // Binary gate (AND, OR, XOR, NAND, NOR, XNOR)
    const op = gateOperator(node.type);
    if (!op) return; // unreachable given SUPPORTED_LOGIC_TYPES guard above

    const aSig = resolveInputSignal(node.id, 'a', nets, nodeIdToSignal, topInputBindingByTarget);
    const bSig = resolveInputSignal(node.id, 'b', nets, nodeIdToSignal, topInputBindingByTarget);
    const aStr = aSig ?? "'0'";
    const bStr = bSig ?? "'0'";
    lines.push(`  ${sigName} <= ${aStr} ${op} ${bStr};`);
  });

  // ---- Drive output ports from internal signals or direct input connections --
  if ((topOutputBindings?.length ?? 0) > 0) {
    topOutputBindings?.forEach((binding) => {
        const topOutputSignalRef = topBindingSignalRef(binding);
        // First: direct signal lookup — works for directly-pinned logic gate outputs
        // (e.g. AND gate output port 'out' → signal 'and_0').
        const directSig =
          nodeIdToSignal.get(`${binding.fromNodeId}:${binding.fromPort}`) ??
          null;
        if (directSig) {
          lines.push(`  ${topOutputSignalRef} <= ${directSig};`);
          return;
        }

        // Second: for output IO nodes (Lamp/OUTPUT), binding.fromPort is the node's
        // INPUT port ('in'). The entity output is driven by whoever drives that
        // input net — trace through the netlist to find the actual driver signal.
        // This fixes: entity declares 'ld0_node_in' but architecture body was
        // referencing undeclared 'LED(0)' from buildPortGroups.
        const driverNet =
          netlist.nets.find(
            (n) => n.to.nodeId === binding.fromNodeId && n.to.port === binding.fromPort,
          ) ?? netlist.nets.find((n) => n.to.nodeId === binding.fromNodeId);

        if (!driverNet) {
        warnings.push(
            `Top output port "${binding.portName}" has no driver — output will be tied low`,
        );
          lines.push(`  ${topOutputSignalRef} <= '0'; -- undriven output`);
        return;
      }

        const resolvedDriverSig =
          nodeIdToSignal.get(`${driverNet.from.nodeId}:${driverNet.from.port}`) ??
          nodeIdToSignal.get(driverNet.from.nodeId) ??
          null;
        if (!resolvedDriverSig) {
          warnings.push(
            `Top output port "${binding.portName}" has unresolved driver ${driverNet.from.nodeId}.${driverNet.from.port}`,
          );
          lines.push(`  ${topOutputSignalRef} <= '0'; -- unresolved driver`);
          return;
        }
        lines.push(`  ${topOutputSignalRef} <= ${resolvedDriverSig};`);
    });
  } else {
    outputNodes.forEach((outNode) => {
      const portExpr = nodeIdToSignal.get(outNode.id)!;
      // Find the net driving this output node's 'in' port
      const driverNet = netlist.nets.find(
        (n) => n.to.nodeId === outNode.id && n.to.port === 'in',
      );
      if (!driverNet) {
        lines.push(`  ${portExpr} <= '0'; -- undriven output`);
        return;
      }

      const driverSig = nodeIdToSignal.get(driverNet.from.nodeId);
      const driverFromPortSig = nodeIdToSignal.get(
        `${driverNet.from.nodeId}:${driverNet.from.port}`,
      );
      const resolvedDriverSig = driverFromPortSig ?? driverSig;
      if (!resolvedDriverSig) {
        lines.push(`  ${portExpr} <= '0'; -- unresolved driver`);
        return;
      }
      lines.push(`  ${portExpr} <= ${resolvedDriverSig};`);
    });
  }

  lines.push(`end architecture Behavioral;`);

  const vhd = lines.join('\n');

  return {
    vhd,
    entityName,
    inputPorts: inputPortNames,
    outputPorts: outputPortNames,
    warnings,
  };
}
