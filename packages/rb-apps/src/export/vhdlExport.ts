// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Netlist, NetlistNode, NetlistNet } from './netlistExport';
import {
  getBoundaryInputNodeTypes,
  getBoundaryOutputNodeTypes,
  getVhdlLogicNodeTypes,
} from '@redbyte/rb-logic-core';

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
  sourceMap: VhdlNodeSourceSpan[];
  vhd: string;
  entityName: string;
  inputPorts: string[];
  outputPorts: string[];
  warnings: string[];
  /**
   * Constructs this emitter could not express. Each one leaves a marker in the
   * text (never a fabricated constant), and any one of them means the HDL must
   * not be packaged as trustworthy.
   */
  errors: string[];
}

export interface VhdlNodeSourceSpan {
  nodeId: string;
  startLine: number;
  endLine: number;
  kind: 'evaluation' | 'boundary' | 'instance';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Node types that are top-level inputs (physical switches/buttons on Basys3)
 */
const INPUT_NODE_TYPES = new Set<string>(getBoundaryInputNodeTypes());

/**
 * Node types that are top-level outputs (physical LEDs on Basys3)
 */
const OUTPUT_NODE_TYPES = new Set<string>(getBoundaryOutputNodeTypes());

/**
 * Node types handled natively by this generator.
 * All others produce a warning and are skipped.
 */
const SUPPORTED_LOGIC_TYPES = new Set<string>(getVhdlLogicNodeTypes());

const INITIALIZED_SEQUENTIAL_TYPES = new Set([
  'DFlipFlop',
  'Register1',
  'RegisterBus',
  'StateBank',
  'DLatch',
  'TFlipFlop',
  'JKFlipFlop',
]);

type ConfigBackedNetlistNode = NetlistNode & {
  config?: Record<string, unknown>;
};

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
  resolveDriver: (from: { nodeId: string; port: string }) => string,
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
  return resolveDriver(net.from);
}

/**
 * The signal a net's driver port carries. Every output alias of a supported
 * primitive is registered before emission, so a lookup never depends on node
 * order. Only single-output nodes may fall back to their node signal; a
 * multi-output port that matches nothing is reported, and the text references
 * an undeclared name so it cannot compile into a guessed connection.
 */
function createDriverResolver(
  nodeIdToSignal: Map<string, string>,
  multiOutputNodeIds: Set<string>,
  errors: string[],
): (from: { nodeId: string; port: string }) => string {
  return (from) => {
    const exact =
      nodeIdToSignal.get(`${from.nodeId}:${from.port}`) ??
      nodeIdToSignal.get(`${from.nodeId}:${from.port.toLowerCase()}`);
    if (exact) return exact;
    if (!multiOutputNodeIds.has(from.nodeId)) {
      const single = nodeIdToSignal.get(from.nodeId);
      if (single) return single;
    }
    const marker = unresolvedDriverMarker(from.nodeId, from.port);
    const message =
      `Unresolved driver "${from.nodeId}.${from.port}" on node "${from.nodeId}": no exported signal carries this output. ` +
      'Fix: connect from a supported output port or replace the part; the design and its simulation are unchanged.';
    if (!errors.includes(message)) errors.push(message);
    return marker;
  };
}

/** An undeclared identifier: analysis fails instead of silently wiring a constant. */
export function unresolvedDriverMarker(nodeId: string, port: string): string {
  const clean = (value: string) => value.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
  return `RBEX_UNRESOLVED_${clean(nodeId)}_${clean(port)}`;
}

/** The RBEX4100 message the export view model maps to a design-owned blocking diagnostic. */
export function unsupportedPrimitiveMessage(type: string, nodeId: string, where?: string): string {
  return (
    `Unsupported synth subset node type "${type}" on node "${nodeId}"${where ? ` (${where})` : ''}. ` +
    `Fix: replace it with a supported part (${getVhdlLogicNodeTypes().join(', ')}) or remove it; the design and its simulation are unchanged.`
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
  const errors: string[] = [];
  const lines: string[] = [];
  const sourceMap: VhdlNodeSourceSpan[] = [];
  const mapped = (nodeId: string, kind: VhdlNodeSourceSpan['kind'], emit: () => void) => {
    const startLine = lines.join('\n').split('\n').length + (lines.length ? 1 : 0);
    emit();
    const endLine = lines.join('\n').split('\n').length;
    if (endLine >= startLine) sourceMap.push({ nodeId, kind, startLine, endLine });
  };

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

  // A part this emitter cannot express is an error, never a skipped node whose
  // consumers quietly read a constant.
  const unsupportedLogicNodes = logicNodes.filter((n) => !SUPPORTED_LOGIC_TYPES.has(n.type));
  unsupportedLogicNodes.forEach((n) => errors.push(unsupportedPrimitiveMessage(n.type, n.id)));

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
  const multiOutputNodeIds = new Set<string>();
  supportedLogicNodes.forEach((node) => {
    const count = typeCounters.get(node.type) ?? 0;
    typeCounters.set(node.type, count + 1);
    const sigName = deriveSignalName(node, count);
    nodeIdToSignal.set(node.id, sigName);
    // Register every output alias before any consumer is emitted, so a reader
    // of Q_inv or Cout resolves the same way whatever the node order is.
    const aliases = primitiveOutputAliases(node.type);
    if (new Set(aliases.map(([, port]) => port)).size > 1) multiOutputNodeIds.add(node.id);
    for (const [alias, port] of aliases) {
      nodeIdToSignal.set(`${node.id}:${alias}`, flatPrimitiveSignal(sigName, port));
    }
  });
  const resolveDriver = createDriverResolver(nodeIdToSignal, multiOutputNodeIds, errors);

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
  const inputDeclarations: Array<{nodeId:string;index:number}> = [];

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
        for (const binding of topInputBindings ?? []) if(binding.portName === port.name)
          inputDeclarations.push({nodeId:binding.toNodeId,index:portDecls.length});
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
      for(const member of group.nodes) inputDeclarations.push({nodeId:member.nodeId,index:portDecls.length});
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

  const declarationsStart=lines.join('\n').split('\n').length+1;
  for(const declaration of inputDeclarations)sourceMap.push({nodeId:declaration.nodeId,kind:'boundary',
    startLine:declarationsStart+declaration.index,endLine:declarationsStart+declaration.index});
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
      const isInitializedSequential = INITIALIZED_SEQUENTIAL_TYPES.has(node.type);
      lines.push(
        isInitializedSequential
          ? `  signal ${sigName} : STD_LOGIC := '0';`
          : `  signal ${sigName} : STD_LOGIC;`,
      );
      if (isInitializedSequential) {
        lines.push(`  signal ${sigName}_inv : STD_LOGIC := '1';`);
      }
    }
  });

  lines.push('begin');

  // ---- Concurrent signal assignments ----------------------------------------
  for (const node of unsupportedLogicNodes) {
    lines.push(`  -- RBEX4100 unsupported primitive ${node.type} (${node.id}): not exported`);
  }
  supportedLogicNodes.forEach((node) => mapped(node.id, 'evaluation', () => {
    const sigName = nodeIdToSignal.get(node.id)!;
    const emitted = emitPrimitiveVhdl({
      id: node.id,
      type: node.type,
      config: (node as ConfigBackedNetlistNode).config,
      output: (port) => flatPrimitiveSignal(sigName, port),
      input: (port) => resolveInputSignal(node.id, port, netlist.nets, nodeIdToSignal, topInputBindingByTarget, resolveDriver),
    });
    lines.push(...emitted.lines);
    warnings.push(...emitted.warnings);
  }));

  // ---- Drive output ports from internal signals or direct input connections --
  if ((topOutputBindings?.length ?? 0) > 0) {
    topOutputBindings?.forEach((binding) => mapped(binding.fromNodeId, 'boundary', () => {
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

        lines.push(`  ${topOutputSignalRef} <= ${resolveDriver(driverNet.from)};`);
    }));
  } else {
    outputNodes.forEach((outNode) => mapped(outNode.id, 'boundary', () => {
      const portExpr = nodeIdToSignal.get(outNode.id)!;
      // Find the net driving this output node's 'in' port
      const driverNet = netlist.nets.find(
        (n) => n.to.nodeId === outNode.id && n.to.port === 'in',
      );
      if (!driverNet) {
        lines.push(`  ${portExpr} <= '0'; -- undriven output`);
        return;
      }
      lines.push(`  ${portExpr} <= ${resolveDriver(driverNet.from)};`);
    }));
  }

  lines.push(`end architecture Behavioral;`);

  const vhd = lines.join('\n');

  return {
    vhd,
    sourceMap,
    entityName,
    inputPorts: inputPortNames,
    outputPorts: outputPortNames,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Shared primitive emission (flat, leaf-module and structural paths)
// ---------------------------------------------------------------------------

/** The outputs a supported primitive can drive. */
export type PrimitiveOutputPort = 'out' | 'Q' | 'Q_inv' | 'sum' | 'carry';

const STATEFUL_OUTPUT_TYPES = new Set([
  'DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'DLatch', 'TFlipFlop', 'JKFlipFlop',
]);

/** Primitive types whose Q / Q_inv start at 0 / 1, like the simulator's power-on state. */
export function isInitializedSequentialType(type: string): boolean {
  return INITIALIZED_SEQUENTIAL_TYPES.has(type);
}

/** Whether emitPrimitiveVhdl can express this type. */
export function isEmittablePrimitiveType(type: string): boolean {
  return SUPPORTED_LOGIC_TYPES.has(type);
}

/**
 * Every port name a connection may use for each output, lower-cased plus the
 * canonical spelling. The Design canvas writes FullAdder Sum/Cout; netlists use
 * sum/carry; registers are read as Q/q/out and Q_inv/qn.
 */
export function primitiveOutputAliases(type: string): Array<[string, PrimitiveOutputPort]> {
  if (STATEFUL_OUTPUT_TYPES.has(type)) {
    return [['Q', 'Q'], ['q', 'Q'], ['out', 'Q'], ['Q_inv', 'Q_inv'], ['q_inv', 'Q_inv'], ['qn', 'Q_inv'], ['nq', 'Q_inv']];
  }
  if (type === 'FullAdder') {
    return [['sum', 'sum'], ['Sum', 'sum'], ['s', 'sum'], ['carry', 'carry'], ['Cout', 'carry'], ['cout', 'carry'], ['co', 'carry']];
  }
  return [['out', 'out']];
}

/** Canonical output a connection's port names, or null when the primitive has no such output. */
export function canonicalPrimitiveOutputPort(type: string, port: string): PrimitiveOutputPort | null {
  const aliases = primitiveOutputAliases(type);
  if (aliases.length === 1) return 'out';
  const lowered = port.trim().toLowerCase();
  return aliases.find(([alias]) => alias.toLowerCase() === lowered)?.[1] ?? null;
}

function flatPrimitiveSignal(signal: string, port: PrimitiveOutputPort): string {
  if (port === 'Q_inv') return `${signal}_inv`;
  if (port === 'sum') return `${signal}_sum`;
  if (port === 'carry') return `${signal}_carry`;
  return signal;
}

export interface PrimitiveVhdlContext {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  /** Signal that carries one output of this primitive. */
  output: (port: PrimitiveOutputPort) => string;
  /** Expression driving an input port (case-insensitive), or null/undefined when unconnected. */
  input: (port: string) => string | null | undefined;
}

/**
 * VHDL for one supported primitive: the single statement authority shared by the
 * flat top, leaf modules and structural architectures. Unconnected inputs read
 * '0', as in the simulator. Unsupported types return no lines; callers report
 * them (isEmittablePrimitiveType) instead of inventing a value.
 */
export function emitPrimitiveVhdl(ctx: PrimitiveVhdlContext): { lines: string[]; warnings: string[] } {
  const { id, type, output } = ctx;
  const lines: string[] = [];
  const warnings: string[] = [];
  const first = (...ports: string[]): string | undefined => {
    for (const port of ports) {
      const value = ctx.input(port);
      if (value) return value;
    }
    return undefined;
  };
  const zero = "'0'";

  if (type === 'PowerSource') {
    lines.push(`  ${output('out')} <= '1';`);
    return { lines, warnings };
  }
  if (type === 'Ground') {
    lines.push(`  ${output('out')} <= '0';`);
    return { lines, warnings };
  }
  if (type === 'NOT') {
    const inSig = first('in', 'a');
    if (!inSig) warnings.push(`NOT gate "${id}" has no input — it reads '0' and drives '1', as in the simulator`);
    lines.push(`  ${output('out')} <= not ${inSig ?? zero};`);
    return { lines, warnings };
  }
  if (type === 'DFlipFlop' || type === 'Register1' || type === 'RegisterBus' || type === 'StateBank') {
    const emitted = emitRegisterVhdl({
      id, type, config: ctx.config, signal: output('Q'), invSignal: output('Q_inv'), input: ctx.input,
    });
    return { lines: emitted.lines, warnings: emitted.warnings };
  }
  const q = () => output('Q');
  const qInv = () => output('Q_inv');
  if (type === 'DLatch') {
    const d = first('d', 'in') ?? zero;
    const en = first('en', 'enable');
    if (!en) {
      warnings.push(`DLatch "${id}" has no EN input — Q will be tied low`);
      lines.push(`  ${q()} <= '0'; -- missing DLatch EN`);
      lines.push(`  ${qInv()} <= '1';`);
      return { lines, warnings };
    }
    lines.push(`  process (${en}, ${d})`);
    lines.push('  begin');
    lines.push(`    if ${en} = '1' then`);
    lines.push(`      ${q()} <= ${d};`);
    lines.push('    end if;');
    lines.push('  end process;');
    lines.push(`  ${qInv()} <= not ${q()};`);
    return { lines, warnings };
  }
  if (type === 'TFlipFlop' || type === 'JKFlipFlop') {
    const clk = first('clk', 'clock', 'c');
    const clr = first('clr', 'rst', 'reset');
    if (!clk) {
      warnings.push(`${type} "${id}" has no CLK input — Q will be tied low`);
      lines.push(`  ${q()} <= '0'; -- missing ${type} clock`);
      lines.push(`  ${qInv()} <= '1';`);
      return { lines, warnings };
    }
    if (clr) {
      lines.push(`  process (${clk}, ${clr})`);
      lines.push('  begin');
      lines.push(`    if ${clr} = '1' then`);
      lines.push(`      ${q()} <= '0';`);
      lines.push(`    elsif rising_edge(${clk}) then`);
    } else {
      lines.push(`  process (${clk})`);
      lines.push('  begin');
      lines.push(`    if rising_edge(${clk}) then`);
    }
    if (type === 'TFlipFlop') {
      const t = first('t', 'in') ?? zero;
      lines.push(`      if ${t} = '1' then`);
      lines.push(`        ${q()} <= not ${q()};`);
      lines.push('      end if;');
    } else {
      const j = first('j') ?? zero;
      const k = first('k') ?? zero;
      lines.push(`      if ${j} = '1' and ${k} = '0' then`);
      lines.push(`        ${q()} <= '1';`);
      lines.push(`      elsif ${j} = '0' and ${k} = '1' then`);
      lines.push(`        ${q()} <= '0';`);
      lines.push(`      elsif ${j} = '1' and ${k} = '1' then`);
      lines.push(`        ${q()} <= not ${q()};`);
      lines.push('      end if;');
    }
    lines.push('    end if;');
    lines.push('  end process;');
    lines.push(`  ${qInv()} <= not ${q()};`);
    return { lines, warnings };
  }
  if (type === 'FullAdder') {
    const a = first('a') ?? zero;
    const b = first('b') ?? zero;
    const cin = first('cin') ?? zero;
    lines.push(`  ${output('sum')} <= ${a} xor ${b} xor ${cin};`);
    lines.push(`  ${output('carry')} <= (${a} and ${b}) or (${cin} and (${a} xor ${b}));`);
    return { lines, warnings };
  }
  if (type === 'MUX4') {
    const i0 = first('i0') ?? zero;
    const i1 = first('i1') ?? zero;
    const i2 = first('i2') ?? zero;
    const i3 = first('i3') ?? zero;
    const s0 = first('s0', 'sel') ?? zero;
    const s1 = first('s1') ?? zero;
    const out = output('out');
    lines.push(`  with ${s1} & ${s0} select`);
    lines.push(`    ${out} <= ${i0} when "00",`);
    lines.push(`              ${i1} when "01",`);
    lines.push(`              ${i2} when "10",`);
    lines.push(`              ${i3} when others;`);
    return { lines, warnings };
  }
  const g3 = gate3Operator(type);
  if (g3) {
    const a = first('a') ?? zero;
    const b = first('b') ?? zero;
    const c = first('c') ?? zero;
    const out = output('out');
    if (type === 'XOR3') lines.push(`  ${out} <= ${a} xor ${b} xor ${c};`);
    else if (g3.invert) lines.push(`  ${out} <= not (${a} ${g3.op} ${b} ${g3.op} ${c});`);
    else lines.push(`  ${out} <= ${a} ${g3.op} ${b} ${g3.op} ${c};`);
    return { lines, warnings };
  }
  const op = gateOperator(type);
  if (op) {
    lines.push(`  ${output('out')} <= ${first('a') ?? zero} ${op} ${first('b') ?? zero};`);
  }
  return { lines, warnings };
}

/** Shared scalar register emission for flat and native structural handoffs. */
export function emitRegisterVhdl({ id, type, config, signal, invSignal, input }: {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  signal: string;
  /** Inverted output; defaults to `<signal>_inv`. */
  invSignal?: string;
  input: (port: string) => string | null | undefined;
}): { lines: string[]; warnings: string[] } {
  const lines: string[] = [];
  const warnings: string[] = [];
  const inv = invSignal ?? `${signal}_inv`;
  const registerConfig = config ?? {};
  // The configuration is the authority for a register-family part's EN and RST, as in the
  // simulator (evaluateRegisterFamily): a pin the configuration disables is ignored even when
  // wired. A DFlipFlop has no configuration and always uses a wired EN and RST.
  const isConfiguredRegister = type === 'Register1' || type === 'RegisterBus' || type === 'StateBank';
  const registerResetKind = String(registerConfig.resetKind ?? 'none').toLowerCase();
  const registerHasEnable = registerConfig.hasEnable === true;
  const d =
    input('d') ??
    input('in') ??
    "'0'";
  const clk =
    input('clk') ??
    input('clock') ??
    input('c');
  const connectedRst =
    input('rst') ??
    input('reset') ??
    input('clr');
  const connectedEn =
    input('en') ??
    input('enable') ??
    input('ce');
  const rst = isConfiguredRegister
    ? registerResetKind === 'async_clear'
      ? connectedRst
      : null
    : connectedRst;
  const en = isConfiguredRegister
    ? registerHasEnable
      ? connectedEn
      : null
    : connectedEn;

  if (!clk) {
    warnings.push(`${type} "${id}" has no clock input - signal ${signal} will be tied low`);
    lines.push(`  ${signal} <= '0'; -- missing ${type} clock`);
    lines.push(`  ${inv} <= '1';`);
    return { lines, warnings };
  }

  if (isConfiguredRegister && registerResetKind === 'async_clear' && !rst) {
    warnings.push(`${type} "${id}" enables async clear but has no reset input; reset will remain inactive`);
  }
  if (isConfiguredRegister && registerHasEnable && !en) {
    warnings.push(`${type} "${id}" enables clock enable but has no EN/CE input; the register will hold its initial value`);
  }

  if (rst) {
    lines.push(`  process (${clk}, ${rst})`);
    lines.push('  begin');
    lines.push(`    if ${rst} = '1' then`);
    lines.push(`      ${signal} <= '0';`);
    lines.push(`    elsif rising_edge(${clk}) then`);
  } else {
    lines.push(`  process (${clk})`);
    lines.push('  begin');
    lines.push(`    if rising_edge(${clk}) then`);
  }

  if (en) {
    lines.push(`      if ${en} = '1' then`);
    lines.push(`        ${signal} <= ${d};`);
    lines.push('      end if;');
  } else if (isConfiguredRegister && registerHasEnable) {
    lines.push('      null; -- enabled register with no EN/CE input holds state');
  } else {
    lines.push(`      ${signal} <= ${d};`);
  }

  lines.push('    end if;');
  lines.push('  end process;');
  lines.push(`  ${inv} <= not ${signal};`);
  return { lines, warnings };
}
