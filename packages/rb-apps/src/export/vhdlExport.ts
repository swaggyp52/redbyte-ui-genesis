// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Netlist, NetlistNode, NetlistNet } from './netlistExport';
import {
  describeInputPin,
  getBoundaryInputNodeTypes,
  getBoundaryOutputNodeTypes,
  getVhdlLogicNodeTypes,
  inputPinsOf,
  outputPortsOf,
  type InputPinReading,
  type OutputPortRole,
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
 * For a given logic node port (e.g. AND.in1), find what signal drives it.
 * Searches the net list for a net whose "to" is exactly that node and port: the
 * simulator keys a node's inputs by the connection's port name as written, so
 * 'A' and 'a' are different inputs here too.
 * Returns the VHDL signal expression (port index or internal signal name).
 */
function resolveInputSignal(
  nodeId: string,
  portName: string,
  nets: NetlistNet[],
  topInputBindingByTarget: Map<string, string>,
  resolveDriver: (from: { nodeId: string; port: string }) => string,
): string | null {
  const net = nets.find((n) => n.to.nodeId === nodeId && n.to.port === portName);
  if (!net) return topInputBindingByTarget.get(`${nodeId}:${portName}`) ?? null;
  return resolveDriver(net.from);
}

/** The input port names connections into a node carry, exactly as written. */
function connectedInputPorts(
  nodeId: string,
  nets: NetlistNet[],
  topInputBindingByTarget: Map<string, string>,
): string[] {
  const ports = new Set(nets.filter((net) => net.to.nodeId === nodeId).map((net) => net.to.port));
  const prefix = `${nodeId}:`;
  for (const target of topInputBindingByTarget.keys()) {
    if (target.startsWith(prefix)) ports.add(target.slice(prefix.length));
  }
  return [...ports];
}

/**
 * The signal a net's driver port carries. Every output name a supported primitive
 * publishes (outputPortsOf) is registered before emission, so a lookup never
 * depends on node order, and it is exact, as the simulator's is: a FullAdder read
 * as "sum" or a gate read as "q" carries nothing in the simulator, so it resolves
 * to nothing here. Only a boundary node's "out" falls back to its port signal. A
 * port that matches nothing is reported, and the text references an undeclared
 * name so it cannot compile into a guessed connection.
 */
function createDriverResolver(
  nodeIdToSignal: Map<string, string>,
  logicNodeIds: Set<string>,
  errors: string[],
): (from: { nodeId: string; port: string }) => string {
  return (from) => {
    const exact = nodeIdToSignal.get(`${from.nodeId}:${from.port}`);
    if (exact) return exact;
    if (!logicNodeIds.has(from.nodeId) && from.port === 'out') {
      const boundary = nodeIdToSignal.get(from.nodeId);
      if (boundary) return boundary;
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

/** An undeclared identifier for a top-level output nothing drives: it cannot compile into a guessed level. */
export function undrivenOutputMarker(portName: string): string {
  return `RBEX_UNDRIVEN_${portName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'}`;
}

/**
 * The RBEX4103 message for a top-level output nothing drives. Verify shows such an
 * output as X; a deliberate constant is a Ground (or PowerSource) part wired to it.
 */
export function undrivenOutputMessage(portName: string, nodeId: string): string {
  return (
    `Output port "${portName}" on node "${nodeId}" has no driver: Verify shows it as unknown (X), and RedByte will not invent a level for the board. ` +
    'Fix: drive it from your logic, or wire a Ground part to it if it should stay at 0; the design and its simulation are unchanged.'
  );
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
  supportedLogicNodes.forEach((node) => {
    const count = typeCounters.get(node.type) ?? 0;
    typeCounters.set(node.type, count + 1);
    const sigName = deriveSignalName(node, count);
    nodeIdToSignal.set(node.id, sigName);
    // Register every published output name before any consumer is emitted, so a
    // reader of Q_inv or Cout resolves the same way whatever the node order is.
    for (const [alias, port] of primitiveOutputAliases(node.type, (node as ConfigBackedNetlistNode).config)) {
      nodeIdToSignal.set(`${node.id}:${alias}`, flatPrimitiveSignal(sigName, port));
    }
  });
  const resolveDriver = createDriverResolver(nodeIdToSignal, new Set(logicNodes.map((node) => node.id)), errors);

  // ---- Check for unconnected outputs ----------------------------------------
  // Verify shows an output nothing drives as X (unknown). A board pin needs a
  // level, and inventing one would ship hardware nobody designed, so it blocks.
  outputNodes.forEach((outNode) => {
    const hasDriver = netlist.nets.some((net) => net.to.nodeId === outNode.id);
    if (!hasDriver) {
      const binding = topOutputBindings?.find((entry) => entry.fromNodeId === outNode.id);
      const message = undrivenOutputMessage(binding?.portName ?? nodeIdToSignal.get(outNode.id) ?? outNode.id, outNode.id);
      if (!errors.includes(message)) errors.push(message);
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
    // A FullAdder has two outputs; declare sum/carry separately
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
      input: (port) => resolveInputSignal(node.id, port, netlist.nets, topInputBindingByTarget, resolveDriver),
      connectedPorts: connectedInputPorts(node.id, netlist.nets, topInputBindingByTarget),
    });
    lines.push(...emitted.lines);
    warnings.push(...emitted.warnings);
    for (const error of emitted.errors) if (!errors.includes(error)) errors.push(error);
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
          const message = undrivenOutputMessage(binding.portName, binding.fromNodeId);
          if (!errors.includes(message)) errors.push(message);
          lines.push(`  ${topOutputSignalRef} <= ${undrivenOutputMarker(binding.portName)}; -- undriven output: blocked`);
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
        lines.push(`  ${portExpr} <= ${undrivenOutputMarker(portExpr)}; -- undriven output: blocked`);
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

/** Primitive types whose Q / Q_inv start at 0 / 1, like the simulator's power-on state. */
export function isInitializedSequentialType(type: string): boolean {
  return INITIALIZED_SEQUENTIAL_TYPES.has(type);
}

/** Whether emitPrimitiveVhdl can express this type. */
export function isEmittablePrimitiveType(type: string): boolean {
  return SUPPORTED_LOGIC_TYPES.has(type);
}

const OUTPUT_ROLE_PORT: Readonly<Record<OutputPortRole, PrimitiveOutputPort>> = {
  out: 'out', q: 'Q', q_inv: 'Q_inv', sum: 'sum', carry: 'carry',
};

/**
 * Every port name a connection may read each output of a primitive under: exactly
 * the names the simulator publishes (outputPortsOf). The Design canvas writes a
 * FullAdder's Sum/Cout and a flip-flop's Q (also published as q and out) and Q_inv
 * (also qn). Empty for a part the simulator publishes no bit outputs for.
 */
export function primitiveOutputAliases(type: string, config?: Record<string, unknown>): Array<[string, PrimitiveOutputPort]> {
  return (outputPortsOf(type, config) ?? []).flatMap((port) =>
    port.names.map((name): [string, PrimitiveOutputPort] => [name, OUTPUT_ROLE_PORT[port.role]]));
}

/** Canonical output a connection's port names exactly, or null when the primitive publishes no such output. */
export function canonicalPrimitiveOutputPort(type: string, port: string, config?: Record<string, unknown>): PrimitiveOutputPort | null {
  return primitiveOutputAliases(type, config).find(([alias]) => alias === port)?.[1] ?? null;
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
  /** Expression driving the input port with exactly this name, or null/undefined when nothing drives it. */
  input: (port: string) => string | null | undefined;
  /** Every input port name a connection into this node carries, exactly as written. */
  connectedPorts: readonly string[];
}

export interface PrimitiveVhdlResult {
  lines: string[];
  warnings: string[];
  /** Blocking: the text would not compute what the simulator computes for this node. */
  errors: string[];
}

const bitLiteral = (level: 0 | 1): string => `'${level}'`;

const quoteList = (names: readonly string[]): string => names.map((name) => `"${name}"`).join(', ');

/**
 * Wires the exported text could only copy silently. The simulator reads each input of a
 * primitive from the first of its names a connection drives (inputPinsOf, compared exactly):
 * a wire into any other name is ignored, and an input wired under two of its names reads only
 * the first. Both block the export, by name. A pin the configuration disables is ignored by
 * the simulator and by the text alike, wired or not, so it only warns.
 */
export function primitiveInputConnectionIssues(
  id: string,
  type: string,
  config: Record<string, unknown> | undefined,
  connectedPorts: readonly string[],
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pins = inputPinsOf(type, config);
  if (!pins) return { errors, warnings };
  const connected = new Set(connectedPorts);
  const readable = pins.flatMap((pin) => pin.names);
  for (const port of [...connected].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
    if (describeInputPin(type, port, config) !== null) continue;
    errors.push(
      `Wire into port "${port}" on node "${id}" (${type}) is ignored: a ${type} reads no input of that name ` +
        `(${readable.length > 0 ? `it reads ${quoteList(readable)}` : 'it reads no input'}), so the simulator ignores this wire ` +
        'and exported hardware could only copy that. Fix: move the wire to one of those inputs or remove it; the design and its simulation are unchanged.',
    );
  }
  for (const pin of pins) {
    const wired = [...pin.names.filter((name) => connected.has(name)), ...(pin.bitNames ?? []).filter((name) => connected.has(name))];
    const wholeWired = pin.names.filter((name) => connected.has(name));
    if (wholeWired.length > 1 || (wholeWired.length === 1 && wired.length > 1)) {
      errors.push(
        `Input "${wholeWired[0]}" on node "${id}" (${type}) is wired ${wired.length} times, as ${quoteList(wired)}: ` +
          `the simulator reads only "${wholeWired[0]}". Fix: remove the extra wire; the design and its simulation are unchanged.`,
      );
    }
    if (!pin.used && wired.length > 0) {
      warnings.push(
        `${type} "${id}" ignores its wired "${wired[0]}" input: its configuration ` +
          `${pin.role === 'enable' ? 'has Clock enable off' : 'has Reset mode none'}, so the simulator and the exported hardware both ignore it.`,
      );
    }
  }
  return { errors, warnings };
}

/**
 * VHDL for one supported primitive: the single statement authority shared by the
 * flat top, leaf modules and structural architectures. Every input is read the way
 * the simulator reads it (inputPinsOf): from the first of its names a connection
 * drives, compared exactly, and an unconnected input reads the level the simulator
 * reads. A part the simulator does not define, or one this function has no
 * statement for, blocks by name instead of inventing a value.
 */
export function emitPrimitiveVhdl(ctx: PrimitiveVhdlContext): PrimitiveVhdlResult {
  const { id, type, output } = ctx;
  const lines: string[] = [];
  const pins = inputPinsOf(type, ctx.config);
  if (!pins) return { lines, warnings: [], errors: [unsupportedPrimitiveMessage(type, id)] };
  const { errors, warnings } = primitiveInputConnectionIssues(id, type, ctx.config, ctx.connectedPorts);
  const driven = pins.map((pin) => {
    for (const name of pin.names) {
      const signal = ctx.input(name);
      if (signal) return signal;
    }
    return undefined;
  });
  const level = (index: number): string => driven[index] ?? bitLiteral(pins[index].unconnectedLevel);
  const named = (name: string): number => pins.findIndex((pin) => pin.names.includes(name));
  const withRole = (role: InputPinReading['role']): number => pins.findIndex((pin) => pin.role === role);

  if (type === 'PowerSource') {
    lines.push(`  ${output('out')} <= '1';`);
    return { lines, warnings, errors };
  }
  if (type === 'Ground') {
    lines.push(`  ${output('out')} <= '0';`);
    return { lines, warnings, errors };
  }
  if (type === 'NOT') {
    if (!driven[0]) warnings.push(`NOT gate "${id}" has no input — it reads ${bitLiteral(pins[0].unconnectedLevel)} and drives its inverse, as in the simulator`);
    lines.push(`  ${output('out')} <= not ${level(0)};`);
    return { lines, warnings, errors };
  }
  if (type === 'DFlipFlop' || type === 'Register1' || type === 'RegisterBus' || type === 'StateBank') {
    const emitted = emitRegisterVhdl({
      id, type, config: ctx.config, signal: output('Q'), invSignal: output('Q_inv'), pins, driven,
    });
    return { lines: emitted.lines, warnings: [...warnings, ...emitted.warnings], errors: [...errors, ...emitted.errors] };
  }
  const q = () => output('Q');
  const qInv = () => output('Q_inv');
  if (type === 'DLatch') {
    const d = named('D');
    const en = named('EN');
    if (!driven[en]) {
      warnings.push(`DLatch "${id}" has no EN input — Q will be tied low`);
      lines.push(`  ${q()} <= '0'; -- missing DLatch EN`);
      lines.push(`  ${qInv()} <= '1';`);
      return { lines, warnings, errors };
    }
    lines.push(`  process (${driven[en]}, ${level(d)})`);
    lines.push('  begin');
    lines.push(`    if ${driven[en]} = ${bitLiteral(pins[en].activeLevel ?? 1)} then`);
    lines.push(`      ${q()} <= ${level(d)};`);
    lines.push('    end if;');
    lines.push('  end process;');
    lines.push(`  ${qInv()} <= not ${q()};`);
    return { lines, warnings, errors };
  }
  if (type === 'TFlipFlop' || type === 'JKFlipFlop') {
    const clk = driven[withRole('clock')];
    const clearIndex = withRole('reset');
    const clr = driven[clearIndex];
    if (!clk) {
      warnings.push(`${type} "${id}" has no CLK input — Q will be tied low`);
      lines.push(`  ${q()} <= '0'; -- missing ${type} clock`);
      lines.push(`  ${qInv()} <= '1';`);
      return { lines, warnings, errors };
    }
    if (clr) {
      lines.push(`  process (${clk}, ${clr})`);
      lines.push('  begin');
      lines.push(`    if ${clr} = ${bitLiteral(pins[clearIndex].activeLevel ?? 1)} then`);
      lines.push(`      ${q()} <= '0';`);
      lines.push(`    elsif rising_edge(${clk}) then`);
    } else {
      lines.push(`  process (${clk})`);
      lines.push('  begin');
      lines.push(`    if rising_edge(${clk}) then`);
    }
    if (type === 'TFlipFlop') {
      lines.push(`      if ${level(named('T'))} = '1' then`);
      lines.push(`        ${q()} <= not ${q()};`);
      lines.push('      end if;');
    } else {
      const j = level(named('J'));
      const k = level(named('K'));
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
    return { lines, warnings, errors };
  }
  if (type === 'FullAdder') {
    const a = level(named('A'));
    const b = level(named('B'));
    const cin = level(named('Cin'));
    lines.push(`  ${output('sum')} <= ${a} xor ${b} xor ${cin};`);
    lines.push(`  ${output('carry')} <= (${a} and ${b}) or (${cin} and (${a} xor ${b}));`);
    return { lines, warnings, errors };
  }
  const g3 = gate3Operator(type);
  if (g3 && pins.length === 3) {
    const [a, b, c] = [level(0), level(1), level(2)];
    const out = output('out');
    if (type === 'XOR3') lines.push(`  ${out} <= ${a} xor ${b} xor ${c};`);
    else if (g3.invert) lines.push(`  ${out} <= not (${a} ${g3.op} ${b} ${g3.op} ${c});`);
    else lines.push(`  ${out} <= ${a} ${g3.op} ${b} ${g3.op} ${c};`);
    return { lines, warnings, errors };
  }
  const op = gateOperator(type);
  if (op && pins.length === 2) {
    lines.push(`  ${output('out')} <= ${level(0)} ${op} ${level(1)};`);
    return { lines, warnings, errors };
  }
  return { lines, warnings, errors: [...errors, unsupportedPrimitiveMessage(type, id)] };
}

/**
 * Register configurations this scalar emission can express. The simulator also runs async
 * preset, synchronous reset/set, active-low reset or enable, falling-edge capture and words;
 * those block by name here (as in verifySchedule) instead of shipping different hardware.
 */
function unsupportedRegisterConfiguration(type: string, config: Record<string, unknown>): string | null {
  if (type === 'DFlipFlop') return null;
  const resetKind = String(config.resetKind ?? 'none').toLowerCase();
  if (resetKind !== 'none' && resetKind !== 'async_clear') return `reset mode ${resetKind}`;
  if (resetKind !== 'none' && String(config.resetPolarity ?? 'active_high').toLowerCase() === 'active_low') return 'an active-low reset';
  if (config.hasEnable === true && String(config.enablePolarity ?? 'active_high').toLowerCase() === 'active_low') return 'an active-low enable';
  if (String(config.clockPolarity ?? 'rising_edge').toLowerCase() === 'falling_edge') return 'falling-edge capture';
  const width = Number(config.width ?? (type === 'Register1' ? 1 : 8));
  if (width !== 1) return `a ${width}-bit word`;
  return null;
}

/** Shared scalar register emission for flat and native structural handoffs. */
export function emitRegisterVhdl({ id, type, config, signal, invSignal, pins, driven }: {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  signal: string;
  /** Inverted output; defaults to `<signal>_inv`. */
  invSignal?: string;
  /** The part's inputs as the simulator reads them (inputPinsOf). */
  pins: readonly InputPinReading[];
  /** The signal driving each of `pins`, or undefined when nothing drives it. */
  driven: ReadonlyArray<string | undefined>;
}): PrimitiveVhdlResult {
  const lines: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const inv = invSignal ?? `${signal}_inv`;
  const unsupported = unsupportedRegisterConfiguration(type, config ?? {});
  if (unsupported) {
    errors.push(
      `Unsupported register configuration on node "${id}" (${type}): the scalar VHDL export cannot express ${unsupported}, ` +
        'which the simulator runs. Fix: select rising-edge capture, active-high asynchronous clear or no reset, an active-high enable and width 1; the design and its simulation are unchanged.',
    );
    return { lines, warnings, errors };
  }
  // The configuration is the authority for a register-family part's EN and RST, as in the
  // simulator: a pin it disables (used === false) is not read, wired or not. A DFlipFlop has no
  // configuration and always uses a wired EN and RST.
  const at = (role: InputPinReading['role']) => pins.findIndex((pin) => pin.role === role);
  const dIndex = at('data');
  const resetIndex = at('reset');
  const enableIndex = at('enable');
  const d = driven[dIndex] ?? bitLiteral(pins[dIndex].unconnectedLevel);
  const clk = driven[at('clock')];
  const rst = pins[resetIndex].used ? driven[resetIndex] : undefined;
  const en = pins[enableIndex].used ? driven[enableIndex] : undefined;

  if (!clk) {
    warnings.push(`${type} "${id}" has no clock input - signal ${signal} will be tied low`);
    lines.push(`  ${signal} <= '0'; -- missing ${type} clock`);
    lines.push(`  ${inv} <= '1';`);
    return { lines, warnings, errors };
  }

  if (pins[resetIndex].used && !rst && type !== 'DFlipFlop') {
    warnings.push(`${type} "${id}" enables async clear but has no reset input; reset will remain inactive`);
  }
  if (pins[enableIndex].used && !en && pins[enableIndex].unconnectedLevel !== pins[enableIndex].activeLevel) {
    warnings.push(`${type} "${id}" enables clock enable but has no EN/CE input; the register will hold its initial value`);
  }

  if (rst) {
    lines.push(`  process (${clk}, ${rst})`);
    lines.push('  begin');
    lines.push(`    if ${rst} = ${bitLiteral(pins[resetIndex].activeLevel ?? 1)} then`);
    lines.push(`      ${signal} <= '0';`);
    lines.push(`    elsif rising_edge(${clk}) then`);
  } else {
    lines.push(`  process (${clk})`);
    lines.push('  begin');
    lines.push(`    if rising_edge(${clk}) then`);
  }

  if (en) {
    lines.push(`      if ${en} = ${bitLiteral(pins[enableIndex].activeLevel ?? 1)} then`);
    lines.push(`        ${signal} <= ${d};`);
    lines.push('      end if;');
  } else if (pins[enableIndex].used && pins[enableIndex].unconnectedLevel !== pins[enableIndex].activeLevel) {
    // An enable the configuration turns on reads its unconnected level, which never asserts it.
    lines.push('      null; -- enabled register with no EN/CE input holds state');
  } else {
    lines.push(`      ${signal} <= ${d};`);
  }

  lines.push('    end if;');
  lines.push('  end process;');
  lines.push(`  ${inv} <= not ${signal};`);
  return { lines, warnings, errors };
}
