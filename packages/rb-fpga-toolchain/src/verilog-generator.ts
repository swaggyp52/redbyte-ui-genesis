// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Circuit-to-Verilog generator
 * 
 * Converts LabProjectV1 / CircuitV1 into synthesizable Verilog HDL
 * with proper wire declarations, module instantiations, and I/O mappings.
 */

import type { CircuitV1, CircuitNode, CircuitConnection, IoMapping } from '@redbyte/rb-utils';
import { getPrimitive, getSupportedNodeTypes } from './primitives';

export interface VerilogGenerationOptions {
  moduleName?: string;
  includeTestbench?: boolean;
  targetBoard?: 'basys3' | 'arty-a7';
}

export interface VerilogOutput {
  verilog: string;
  moduleName: string;
  inputs: string[];
  outputs: string[];
  warnings: string[];
  unsupportedNodes: string[];
}

interface WireInfo {
  name: string;
  driver?: string;
  loads: string[];
}

function cmpCodepoint(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareConnections(a: CircuitConnection, b: CircuitConnection): number {
  const left = `${a.fromNodeId}.${a.fromPin}->${a.toNodeId}.${a.toPin}`;
  const right = `${b.fromNodeId}.${b.fromPin}->${b.toNodeId}.${b.toPin}`;
  return cmpCodepoint(left, right);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort(cmpCodepoint);
}

/**
 * Generate synthesizable Verilog from CircuitV1
 */
export function circuitToVerilog(
  circuit: CircuitV1,
  ioMapping?: IoMapping,
  options: VerilogGenerationOptions = {}
): VerilogOutput {
  const moduleName = options.moduleName || 'redbyte_circuit';
  const warnings: string[] = [];
  const unsupportedNodes: string[] = [];
  const sortedNodes = [...circuit.nodes].sort((a, b) => cmpCodepoint(a.id, b.id));
  const sortedConnections = [...circuit.connections].sort(compareConnections);

  // I/O node types: these are module ports, not logic primitives.
  // Their signals are declared as module inputs/outputs, so they must not be
  // flagged as unsupported synthesis nodes and must not trigger "no driver" warnings.
  const IO_NODE_TYPES = new Set(['INPUT', 'OUTPUT', 'Lamp', 'Switch', 'InputPin', 'Clock']);

  // Filter out unsupported node types (IO nodes are silently excluded — they become ports)
  const supportedTypes = new Set(getSupportedNodeTypes());
  const supportedNodes = sortedNodes.filter((node) => {
    if (IO_NODE_TYPES.has(node.type)) return false; // module port — handled separately, not a primitive
    if (!supportedTypes.has(node.type)) {
      unsupportedNodes.push(`${node.id} (${node.type})`);
      warnings.push(`Node ${node.id} type "${node.type}" not supported for synthesis`);
      return false;
    }
    return true;
  });

  // Build wire map
  const wires = new Map<string, WireInfo>();
  const nodeOutputs = new Map<string, string[]>();
  const nodeTypeById = new Map<string, string>();
  for (const node of sortedNodes) {
    nodeTypeById.set(node.id, node.type);
  }

  // Initialize node output tracking
  for (const node of supportedNodes) {
    const primitive = getPrimitive(node.type);
    if (!primitive) continue;
    
    const outputs = primitive.ports.outputs.map((portName) => `${node.id}_${portName}`);
    nodeOutputs.set(node.id, outputs);
    
    for (const wireName of outputs) {
      wires.set(wireName, { name: wireName, loads: [] });
    }
  }

  // Process connections — normalize port names to lowercase so primitive port names
  // (always lowercase, e.g. 'd', 'clk', 'q') match catalog connection names (e.g. 'D', 'CLK', 'Q').
  for (const conn of sortedConnections) {
    const fromPin = conn.fromPin.toLowerCase();
    const toPin   = conn.toPin.toLowerCase();
    const fromWire = `${conn.fromNodeId}_${fromPin}`;
    const toLoad   = `${conn.toNodeId}_${toPin}`;

    const wire = wires.get(fromWire);
    if (wire) {
      wire.loads.push(toLoad);
    } else if (!IO_NODE_TYPES.has(nodeTypeById.get(conn.fromNodeId) ?? '')) {
      // I/O nodes (INPUT, OUTPUT, Switch, etc.) are handled as module ports —
      // missing wires from them are expected and not an error.
      warnings.push(`Connection from ${conn.fromNodeId}.${conn.fromPin} has no driver`);
    }
  }

  // Determine top-level I/O
  const inputs: string[] = [];
  const outputs: string[] = [];

  if (ioMapping) {
    const sortedInputMapping = [...ioMapping.inputs].sort((a, b) => {
      const left = `${a.nodeId}.${a.port}.${a.id}`;
      const right = `${b.nodeId}.${b.port}.${b.id}`;
      return cmpCodepoint(left, right);
    });
    const sortedOutputMapping = [...ioMapping.outputs].sort((a, b) => {
      const left = `${a.nodeId}.${a.port}.${a.id}`;
      const right = `${b.nodeId}.${b.port}.${b.id}`;
      return cmpCodepoint(left, right);
    });

    for (const entry of sortedInputMapping) {
      const wireName = `${entry.nodeId}_${entry.port}`;
      inputs.push(wireName);
    }
    for (const entry of sortedOutputMapping) {
      const wireName = `${entry.nodeId}_${entry.port}`;
      outputs.push(wireName);
    }
  } else {
    // Auto-detect: inputs have no driver, outputs have no loads
    const sortedWireNames = Array.from(wires.keys()).sort((a, b) => cmpCodepoint(a, b));
    for (const wireName of sortedWireNames) {
      const wire = wires.get(wireName);
      if (!wire) continue;
      if (!wire.driver && wire.loads.length > 0) {
        inputs.push(wireName);
      }
      if (wire.driver && wire.loads.length === 0) {
        outputs.push(wireName);
      }
    }
  }

  // Generate Verilog
  let verilog = `// Generated by RedByte FPGA Toolchain\n`;
  verilog += `// Source: LabProjectV1 CircuitV1\n`;
  verilog += `// Deterministic export\n\n`;

  // Module declaration
  verilog += `module ${moduleName} (\n`;
  const ports = [
    ...uniqueSorted(inputs).map((name) => `  input wire ${sanitizeIdentifier(name)}`),
    ...uniqueSorted(outputs).map((name) => `  output wire ${sanitizeIdentifier(name)}`),
  ];
  verilog += ports.join(',\n');
  verilog += `\n);\n\n`;

  // Wire declarations (internal wires only)
  const uniqueInputs = uniqueSorted(inputs);
  const uniqueOutputs = uniqueSorted(outputs);
  const internalWires = Array.from(wires.keys())
    .filter((name) => !uniqueInputs.includes(name) && !uniqueOutputs.includes(name))
    .sort((a, b) => cmpCodepoint(a, b));
  if (internalWires.length > 0) {
    verilog += `  // Internal wires\n`;
    for (const wireName of internalWires) {
      verilog += `  wire ${sanitizeIdentifier(wireName)};\n`;
    }
    verilog += `\n`;
  }

  // Module instantiations
  verilog += `  // Component instantiations\n`;
  for (const node of supportedNodes) {
    const primitive = getPrimitive(node.type);
    if (!primitive) continue;

    const instanceName = `inst_${sanitizeIdentifier(node.id)}`;
    verilog += `  ${primitive.moduleName} ${instanceName} (\n`;

    const connections: string[] = [];
    for (const inputPort of primitive.ports.inputs) {
      const wireName = findDriverForPin(node.id, inputPort, sortedConnections, wires);
      const signalName = wireName ? sanitizeIdentifier(wireName) : '1\'b0';
      connections.push(`    .${inputPort}(${signalName})`);
    }
    for (const outputPort of primitive.ports.outputs) {
      const wireName = `${node.id}_${outputPort}`;
      connections.push(`    .${outputPort}(${sanitizeIdentifier(wireName)})`);
    }

    verilog += connections.join(',\n');
    verilog += `\n  );\n\n`;
  }

  // Output assignments: connect each module output port to its driver signal.
  //   Case A — logic wire drives output: assign q0_out_in = q0_ff_q;
  //   Case B — module input drives output directly (e.g. straight-wire pass-through):
  //             assign ld0_node_in = sw0_node_out;
  const assignStmts: string[] = [];
  for (const outPortName of uniqueOutputs) {
    const driver = findOutputDriver(
      outPortName,
      wires,
      sortedConnections,
      IO_NODE_TYPES,
      nodeTypeById,
    );
    if (driver) {
      assignStmts.push(
        `  assign ${sanitizeIdentifier(outPortName)} = ${sanitizeIdentifier(driver)};`,
      );
    }
  }
  if (assignStmts.length > 0) {
    verilog += `  // Output assignments\n`;
    verilog += assignStmts.join('\n');
    verilog += `\n\n`;
  }

  verilog += `endmodule\n`;

  return {
    verilog,
    moduleName,
    inputs: uniqueInputs.map(sanitizeIdentifier),
    outputs: uniqueOutputs.map(sanitizeIdentifier),
    warnings,
    unsupportedNodes,
  };
}

/**
 * Port name aliases: circuit catalog uses legacy single-letter names ('a', 'b') while
 * primitive definitions and Verilog instantiation use 'in1', 'in2'.
 * Each entry lists all equivalent names for a given logical port.
 */
const PORT_NAME_ALIAS_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['in1', 'a'],
  ['in2', 'b'],
  ['in3', 'c'],
];

/** Return all port name aliases for a given name, including the name itself. */
function portAliases(name: string): ReadonlyArray<string> {
  for (const group of PORT_NAME_ALIAS_GROUPS) {
    if (group.includes(name)) return group;
  }
  return [name];
}

/**
 * Find the signal name (wire or module port) that should drive a given module output port.
 *
 * Case A — internal logic wire drives output:
 *   The wire's loads list contains `outputPortName`.
 * Case B — module input port drives output directly (straight-wire pass-through, no logic):
 *   A connection exists where both fromNodeId and toNodeId are I/O nodes.
 */
function findOutputDriver(
  outputPortName: string,
  wires: Map<string, WireInfo>,
  connections: CircuitConnection[],
  ioNodeTypes: Set<string>,
  nodeTypeById: Map<string, string>,
): string | null {
  // Case A: a logic wire's loads list references this output port
  const sortedWireNames = Array.from(wires.keys()).sort((a, b) => cmpCodepoint(a, b));
  for (const wireName of sortedWireNames) {
    const wire = wires.get(wireName);
    if (!wire) continue;
    if (wire.loads.includes(outputPortName)) return wireName;
  }

  // Case B: direct INPUT → OUTPUT connection (no logic in between)
  const sortedConns = [...connections].sort(compareConnections);
  for (const conn of sortedConns) {
    const toLoad = `${conn.toNodeId}_${conn.toPin.toLowerCase()}`;
    if (
      toLoad === outputPortName &&
      ioNodeTypes.has(nodeTypeById.get(conn.fromNodeId) ?? '')
    ) {
      return `${conn.fromNodeId}_${conn.fromPin.toLowerCase()}`;
    }
  }

  return null;
}

function findDriverForPin(
  nodeId: string,
  pinName: string,
  connections: CircuitConnection[],
  wires: Map<string, WireInfo>
): string | null {
  // Normalize to lowercase: primitive ports are always lowercase (e.g. 'd', 'clk', 'q')
  // and catalog connections may use uppercase (e.g. 'D', 'CLK', 'Q', 'a', 'b').
  const normalizedPin = pinName.toLowerCase();
  const aliases = portAliases(normalizedPin);

  // Check the wires index for any alias of pinName (all entries lowercase)
  const sortedWireNames = Array.from(wires.keys()).sort((a, b) => cmpCodepoint(a, b));
  for (const wireName of sortedWireNames) {
    const wire = wires.get(wireName);
    if (!wire) continue;
    for (const alias of aliases) {
      if (wire.loads.includes(`${nodeId}_${alias}`)) {
        return wireName;
      }
    }
  }

  // Check connections directly — normalize toPin/fromPin to lowercase before comparing
  const sortedConnections = [...connections].sort(compareConnections);
  for (const conn of sortedConnections) {
    if (conn.toNodeId === nodeId && aliases.includes(conn.toPin.toLowerCase())) {
      return `${conn.fromNodeId}_${conn.fromPin.toLowerCase()}`;
    }
  }

  return null;
}

/**
 * Sanitize identifiers for Verilog (alphanumeric + underscore only)
 */
function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

/**
 * Generate XDC constraints for Basys3 board from IoMapping
 */
export function generateBasys3Constraints(ioMapping: IoMapping): string {
  let xdc = `# Basys3 Constraints\n`;
  xdc += `# Generated by RedByte FPGA Toolchain\n\n`;

  xdc += `## Clock signal (100 MHz)\n`;
  xdc += `set_property -dict { PACKAGE_PIN W5   IOSTANDARD LVCMOS33 } [get_ports clk]\n`;
  xdc += `create_clock -period 10.000 -name sys_clk_pin -waveform {0.000 5.000} -add [get_ports clk]\n\n`;

  if (ioMapping.inputs.length > 0) {
    xdc += `## Switches\n`;
    for (const entry of ioMapping.inputs) {
      if (entry.pin?.startsWith('SW')) {
        const idx = parseInt(entry.pin.slice(2), 10);
        const pins = ['V17', 'V16', 'W16', 'W17', 'W15', 'V15', 'W14', 'W13', 'V2', 'T3', 'T2', 'R3', 'W2', 'U1', 'T1', 'R2'];
        if (idx < pins.length) {
          const wireName = sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
          xdc += `set_property -dict { PACKAGE_PIN ${pins[idx]}  IOSTANDARD LVCMOS33 } [get_ports ${wireName}]\n`;
        }
      }
    }
    xdc += `\n`;
  }

  if (ioMapping.outputs.length > 0) {
    xdc += `## LEDs\n`;
    for (const entry of ioMapping.outputs) {
      if (entry.pin?.startsWith('LD')) {
        const idx = parseInt(entry.pin.slice(2), 10);
        const pins = ['U16', 'E19', 'U19', 'V19', 'W18', 'U15', 'U14', 'V14', 'V13', 'V3', 'W3', 'U3', 'P3', 'N3', 'P1', 'L1'];
        if (idx < pins.length) {
          const wireName = sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
          xdc += `set_property -dict { PACKAGE_PIN ${pins[idx]}  IOSTANDARD LVCMOS33 } [get_ports ${wireName}]\n`;
        }
      }
    }
  }

  return xdc;
}

/**
 * Generate constraints file based on board profile
 */
export function generateConstraints(
  ioMapping: IoMapping,
  board: 'basys3' | 'arty-a7' = 'basys3'
): string {
  switch (board) {
    case 'basys3':
      return generateBasys3Constraints(ioMapping);
    case 'arty-a7':
      // TODO: Implement Arty-A7 constraints
      return `# Arty-A7 constraints not yet implemented\n`;
    default:
      return `# Unknown board: ${board}\n`;
  }
}
