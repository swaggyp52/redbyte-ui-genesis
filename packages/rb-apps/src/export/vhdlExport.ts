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
const INPUT_NODE_TYPES = new Set(['INPUT', 'Switch', 'Button']);

/**
 * Node types that are top-level outputs (physical LEDs on Basys3)
 */
const OUTPUT_NODE_TYPES = new Set(['OUTPUT', 'Lamp']);

/**
 * Node types handled natively by this generator.
 * All others produce a warning and are skipped.
 */
const SUPPORTED_LOGIC_TYPES = new Set([
  'AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR', 'XNOR',
  'FullAdder',
  'MUX4',
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
    AND: 'and',
    OR: 'or',
    XOR: 'xor',
    NOT: 'not',
    NAND: 'nand',
    NOR: 'nor',
    XNOR: 'xnor',
    FullAdder: 'fa',
    MUX4: 'mux',
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
): string | null {
  const net = nets.find(
    (n) => n.to.nodeId === nodeId && n.to.port === portName,
  );
  if (!net) return null;
  return (
    nodeIdToSignal.get(`${net.from.nodeId}:${net.from.port}`) ??
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
  } = options;

  const warnings: string[] = [];
  const lines: string[] = [];

  // ---- Classify nodes -------------------------------------------------------
  const inputNodes  = netlist.nodes.filter((n) => INPUT_NODE_TYPES.has(n.type));
  const outputNodes = netlist.nodes.filter((n) => OUTPUT_NODE_TYPES.has(n.type));
  const logicNodes  = netlist.nodes.filter(
    (n) => !INPUT_NODE_TYPES.has(n.type) && !OUTPUT_NODE_TYPES.has(n.type),
  );

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
    lines.push(`-- Generated: ${new Date().toISOString()}`);
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
  inputGroups.forEach((group) => {
    const isVector = group.width > 0 || group.nodes.length > 1;
    const typeStr = isVector
      ? `STD_LOGIC_VECTOR(${group.width} downto 0)`
      : 'STD_LOGIC';
    portDecls.push(`    ${group.baseName} : in  ${typeStr}`);
    inputPortNames.push(group.baseName);
  });

  // Collect output port strings
  const outputPortNames: string[] = [];
  outputGroups.forEach((group) => {
    const isVector = group.width > 0 || group.nodes.length > 1;
    const typeStr = isVector
      ? `STD_LOGIC_VECTOR(${group.width} downto 0)`
      : 'STD_LOGIC';
    portDecls.push(`    ${group.baseName} : out ${typeStr}`);
    outputPortNames.push(group.baseName);
  });

  lines.push(portDecls.join(';\n'));
  lines.push('  );');
  lines.push(`end entity ${entityName};`);
  lines.push('');

  // ---- Architecture ---------------------------------------------------------
  lines.push(`architecture rtl of ${entityName} is`);

  // Internal signal declarations
  supportedLogicNodes.forEach((node) => {
    const sigName = nodeIdToSignal.get(node.id)!;
    // FullAdder and MUX4 have multiple outputs; declare carry/sum separately
    if (node.type === 'FullAdder') {
      lines.push(`  signal ${sigName}_sum   : STD_LOGIC;`);
      lines.push(`  signal ${sigName}_carry : STD_LOGIC;`);
    } else {
      lines.push(`  signal ${sigName} : STD_LOGIC;`);
    }
  });

  lines.push('begin');

  // ---- Concurrent signal assignments ----------------------------------------
  supportedLogicNodes.forEach((node) => {
    const sigName = nodeIdToSignal.get(node.id)!;
    const nets = netlist.nets;

    if (node.type === 'NOT') {
      // NOT has a single input port 'in' (inferred from connections)
      const inSig =
        resolveInputSignal(node.id, 'in', nets, nodeIdToSignal) ??
        resolveInputSignal(node.id, 'a', nets, nodeIdToSignal);
      if (!inSig) {
        warnings.push(`NOT gate "${node.id}" has no input — signal ${sigName} will be undriven`);
        lines.push(`  ${sigName} <= '0'; -- undriven NOT gate`);
      } else {
        lines.push(`  ${sigName} <= not ${inSig};`);
      }
      return;
    }

    if (node.type === 'FullAdder') {
      const a   = resolveInputSignal(node.id, 'a',  nets, nodeIdToSignal);
      const b   = resolveInputSignal(node.id, 'b',  nets, nodeIdToSignal);
      const cin = resolveInputSignal(node.id, 'cin', nets, nodeIdToSignal);
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
      const i0 = resolveInputSignal(node.id, 'i0', nets, nodeIdToSignal) ?? "'0'";
      const i1 = resolveInputSignal(node.id, 'i1', nets, nodeIdToSignal) ?? "'0'";
      const i2 = resolveInputSignal(node.id, 'i2', nets, nodeIdToSignal) ?? "'0'";
      const i3 = resolveInputSignal(node.id, 'i3', nets, nodeIdToSignal) ?? "'0'";
      const s0 = resolveInputSignal(node.id, 's0', nets, nodeIdToSignal) ??
                 resolveInputSignal(node.id, 'sel', nets, nodeIdToSignal) ?? "'0'";
      const s1 = resolveInputSignal(node.id, 's1', nets, nodeIdToSignal) ?? "'0'";
      lines.push(`  with ${s1} & ${s0} select`);
      lines.push(`    ${sigName} <= ${i0} when "00",`);
      lines.push(`              ${i1} when "01",`);
      lines.push(`              ${i2} when "10",`);
      lines.push(`              ${i3} when others;`);
      return;
    }

    // Binary gate (AND, OR, XOR, NAND, NOR, XNOR)
    const op = gateOperator(node.type);
    if (!op) return; // unreachable given SUPPORTED_LOGIC_TYPES guard above

    const aSig = resolveInputSignal(node.id, 'a', nets, nodeIdToSignal);
    const bSig = resolveInputSignal(node.id, 'b', nets, nodeIdToSignal);
    const aStr = aSig ?? "'0'";
    const bStr = bSig ?? "'0'";
    lines.push(`  ${sigName} <= ${aStr} ${op} ${bStr};`);
  });

  // ---- Drive output ports from internal signals or direct input connections --
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

  lines.push(`end architecture rtl;`);

  const vhd = lines.join('\n');

  return {
    vhd,
    entityName,
    inputPorts: inputPortNames,
    outputPorts: outputPortNames,
    warnings,
  };
}
