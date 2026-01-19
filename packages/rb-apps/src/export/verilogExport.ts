// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Netlist, NetlistNode } from './netlistExport';

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');

/**
 * Map RedByte node types to synthesizable Verilog module names
 */
const NODE_TYPE_TO_MODULE: Record<string, string> = {
  AND: 'RB_AND',
  OR: 'RB_OR',
  NOT: 'RB_NOT',
  NAND: 'RB_NAND',
  NOR: 'RB_NOR',
  XOR: 'RB_XOR',
  XNOR: 'RB_XNOR',
  Wire: 'RB_WIRE',
  PowerSource: 'RB_VCC',
  Ground: 'RB_GND',
  DFlipFlop: 'RB_DFF',
  DFlipFlopReset: 'RB_DFF_RST',
  RSLatch: 'RB_RSLATCH',
  JKFlipFlop: 'RB_JKFF',
  TFlipFlop: 'RB_TFF',
  MUX2: 'RB_MUX2',
  MUX4: 'RB_MUX4',
  FullAdder: 'RB_FULLADDER',
  HalfAdder: 'RB_HALFADDER',
  TriState: 'RB_TRISTATE',
  Delay: 'RB_DELAY',
  ClockDivider: 'RB_CLKDIV',
  SevenSegDecoder: 'RB_7SEG',
};

/**
 * Node types that represent top-level inputs (physical switches/buttons)
 */
const INPUT_NODE_TYPES = ['INPUT', 'Switch'];

/**
 * Node types that represent top-level outputs (physical LEDs)
 */
const OUTPUT_NODE_TYPES = ['OUTPUT', 'Lamp'];

/**
 * Node types that should be skipped (mapped to top-level ports instead)
 */
const SKIP_NODE_TYPES = [...INPUT_NODE_TYPES, ...OUTPUT_NODE_TYPES, 'Clock'];

/**
 * Port name remapping for gates (rb-logic-core uses a/b, Verilog uses in1/in2)
 */
const PORT_NAME_REMAP: Record<string, string> = {
  a: 'in1',
  b: 'in2',
};

export interface SynthesizableVerilog {
  topModule: string;
  primitivesLibrary: string;
  constraintsXdc: string;
  inputPorts: string[];
  outputPorts: string[];
}

/**
 * Legacy function for basic structural export (non-synthesizable)
 */
export const verilogFromNetlist = (netlist: Netlist) => {
  const sortedNodes = [...netlist.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedNets = [...netlist.nets].sort((a, b) => a.id.localeCompare(b.id));
  const uniqueTypes = Array.from(new Set(sortedNodes.map((node) => node.type))).sort();

  const lines: string[] = [];
  lines.push('// RedByte structural export (best-effort)');
  lines.push('module top();');
  lines.push('');

  sortedNets.forEach((net) => {
    const wireName = `w_${sanitize(net.from.nodeId)}_${sanitize(net.from.port)}__${sanitize(net.to.nodeId)}_${sanitize(net.to.port)}`;
    lines.push(`  wire ${wireName};`);
  });

  lines.push('');
  sortedNodes.forEach((node) => {
    const instanceName = `u_${sanitize(node.id)}`;
    const portList = node.ports
      .map((port) => {
        const net = sortedNets.find(
          (candidate) =>
            (candidate.from.nodeId === node.id && candidate.from.port === port.name) ||
            (candidate.to.nodeId === node.id && candidate.to.port === port.name)
        );
        if (!net) {
          return `.${sanitize(port.name)}()`;
        }
        const wireName = `w_${sanitize(net.from.nodeId)}_${sanitize(net.from.port)}__${sanitize(net.to.nodeId)}_${sanitize(net.to.port)}`;
        return `.${sanitize(port.name)}(${wireName})`;
      })
      .join(', ');
    lines.push(`  ${sanitize(node.type)} ${instanceName} (${portList});`);
  });

  lines.push('');
  uniqueTypes.forEach((type) => {
    lines.push(`// Unresolved component type: ${type}`);
    lines.push(`module ${sanitize(type)}(/* ports */);`);
    lines.push('endmodule');
    lines.push('');
  });

  lines.push('endmodule');
  return lines.join('\n');
};

/**
 * Generate synthesizable Verilog with primitives library and constraints
 */
export const synthesizableVerilogFromNetlist = (
  netlist: Netlist,
  options: {
    board?: 'basys3';
    includeClock?: boolean;
    clockFrequencyHz?: number;
  } = {}
): SynthesizableVerilog => {
  const { board = 'basys3', includeClock = false, clockFrequencyHz = 100_000_000 } = options;

  const sortedNodes = [...netlist.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedNets = [...netlist.nets].sort((a, b) => a.id.localeCompare(b.id));

  // Identify input and output nodes
  const inputNodes = sortedNodes.filter((n) => INPUT_NODE_TYPES.includes(n.type));
  const outputNodes = sortedNodes.filter((n) => OUTPUT_NODE_TYPES.includes(n.type));
  const clockNodes = sortedNodes.filter((n) => n.type === 'Clock');
  const logicNodes = sortedNodes.filter((n) => !SKIP_NODE_TYPES.includes(n.type));

  // Generate port names
  const inputPorts = inputNodes.map((n, i) => `sw_${i}`);
  const outputPorts = outputNodes.map((n, i) => `led_${i}`);

  // Map node IDs to port names
  const nodeIdToPortName = new Map<string, string>();
  inputNodes.forEach((n, i) => nodeIdToPortName.set(n.id, `sw_${i}`));
  outputNodes.forEach((n, i) => nodeIdToPortName.set(n.id, `led_${i}`));

  // Helper to get wire name for a net
  const getWireName = (net: { from: { nodeId: string; port: string }; to: { nodeId: string; port: string } }) => {
    return `w_${sanitize(net.from.nodeId)}_${sanitize(net.from.port)}__${sanitize(net.to.nodeId)}_${sanitize(net.to.port)}`;
  };

  // Generate top module
  const lines: string[] = [];
  lines.push('// RedByte Synthesizable Verilog Export');
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(`// Target Board: ${board}`);
  lines.push('// Requires: rb_primitives.v');
  lines.push('');
  lines.push('`timescale 1ns / 1ps');
  lines.push('');

  // Module declaration with ports
  const portDeclarations: string[] = [];
  if (includeClock || clockNodes.length > 0) {
    portDeclarations.push('input wire clk');
  }
  inputPorts.forEach((p) => portDeclarations.push(`input wire ${p}`));
  outputPorts.forEach((p) => portDeclarations.push(`output wire ${p}`));

  lines.push(`module top(`);
  lines.push(`  ${portDeclarations.join(',\n  ')}`);
  lines.push(');');
  lines.push('');

  // Internal wires
  const internalWires = sortedNets.filter((net) => {
    // Skip nets that connect directly to I/O ports
    const fromIsIO = INPUT_NODE_TYPES.includes(
      sortedNodes.find((n) => n.id === net.from.nodeId)?.type || ''
    );
    const toIsIO = OUTPUT_NODE_TYPES.includes(
      sortedNodes.find((n) => n.id === net.to.nodeId)?.type || ''
    );
    return !fromIsIO || !toIsIO;
  });

  if (internalWires.length > 0) {
    lines.push('  // Internal wires');
    internalWires.forEach((net) => {
      const wireName = getWireName(net);
      lines.push(`  wire ${wireName};`);
    });
    lines.push('');
  }

  // Assign input ports to wires
  lines.push('  // Input port assignments');
  inputNodes.forEach((node, i) => {
    const portName = `sw_${i}`;
    // Find nets where this node is the source
    const outNets = sortedNets.filter((net) => net.from.nodeId === node.id);
    outNets.forEach((net) => {
      const wireName = getWireName(net);
      lines.push(`  assign ${wireName} = ${portName};`);
    });
  });
  lines.push('');

  // Assign wires to output ports
  lines.push('  // Output port assignments');
  outputNodes.forEach((node, i) => {
    const portName = `led_${i}`;
    // Find nets where this node is the destination
    const inNets = sortedNets.filter((net) => net.to.nodeId === node.id);
    if (inNets.length > 0) {
      const wireName = getWireName(inNets[0]);
      lines.push(`  assign ${portName} = ${wireName};`);
    } else {
      lines.push(`  assign ${portName} = 1'b0; // Unconnected`);
    }
  });
  lines.push('');

  // Instantiate logic nodes
  if (logicNodes.length > 0) {
    lines.push('  // Logic instances');
    logicNodes.forEach((node) => {
      const moduleName = NODE_TYPE_TO_MODULE[node.type] || sanitize(node.type);
      const instanceName = `u_${sanitize(node.id)}`;

      const portConnections = node.ports.map((port) => {
        // Remap port names if needed
        const verilogPortName = PORT_NAME_REMAP[port.name] || port.name;

        // Find the net connected to this port
        const net = sortedNets.find(
          (candidate) =>
            (candidate.from.nodeId === node.id && candidate.from.port === port.name) ||
            (candidate.to.nodeId === node.id && candidate.to.port === port.name)
        );

        if (!net) {
          return `.${sanitize(verilogPortName)}()`;
        }

        const wireName = getWireName(net);
        return `.${sanitize(verilogPortName)}(${wireName})`;
      });

      lines.push(`  ${moduleName} ${instanceName} (${portConnections.join(', ')});`);
    });
    lines.push('');
  }

  // Handle clock nodes (generate clock signal if needed)
  if (clockNodes.length > 0 && includeClock) {
    lines.push('  // Clock-driven logic');
    clockNodes.forEach((node, i) => {
      const outNets = sortedNets.filter((net) => net.from.nodeId === node.id);
      outNets.forEach((net) => {
        const wireName = getWireName(net);
        // For now, just pass through the external clock
        lines.push(`  assign ${wireName} = clk;`);
      });
    });
    lines.push('');
  }

  lines.push('endmodule');

  // Generate primitives library
  const primitivesLibrary = generatePrimitivesLibrary(logicNodes);

  // Generate XDC constraints
  const constraintsXdc = generateConstraintsXdc(
    board,
    inputPorts,
    outputPorts,
    includeClock || clockNodes.length > 0
  );

  return {
    topModule: lines.join('\n'),
    primitivesLibrary,
    constraintsXdc,
    inputPorts,
    outputPorts,
  };
};

/**
 * Generate Verilog primitives library for the used node types
 */
function generatePrimitivesLibrary(nodes: NetlistNode[]): string {
  const usedTypes = new Set(nodes.map((n) => n.type));
  const lines: string[] = [];

  lines.push('// RedByte Verilog Primitives Library');
  lines.push('// Auto-generated - do not edit manually');
  lines.push('');
  lines.push('`timescale 1ns / 1ps');
  lines.push('');

  // Basic gates that are commonly used
  const PRIMITIVE_DEFINITIONS: Record<string, string> = {
    AND: `module RB_AND(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 & in2;
endmodule`,
    OR: `module RB_OR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 | in2;
endmodule`,
    NOT: `module RB_NOT(
  input wire in,
  output wire out
);
  assign out = ~in;
endmodule`,
    NAND: `module RB_NAND(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 & in2);
endmodule`,
    NOR: `module RB_NOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 | in2);
endmodule`,
    XOR: `module RB_XOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 ^ in2;
endmodule`,
    XNOR: `module RB_XNOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 ^ in2);
endmodule`,
    Wire: `module RB_WIRE(
  input wire in,
  output wire out
);
  assign out = in;
endmodule`,
    PowerSource: `module RB_VCC(
  output wire out
);
  assign out = 1'b1;
endmodule`,
    Ground: `module RB_GND(
  output wire out
);
  assign out = 1'b0;
endmodule`,
    DFlipFlop: `module RB_DFF(
  input wire d,
  input wire clk,
  output reg q
);
  always @(posedge clk) begin
    q <= d;
  end
endmodule`,
    Delay: `module RB_DELAY(
  input wire in,
  input wire clk,
  output reg out
);
  always @(posedge clk) begin
    out <= in;
  end
endmodule`,
    MUX2: `module RB_MUX2(
  input wire a,
  input wire b,
  input wire sel,
  output wire out
);
  assign out = sel ? b : a;
endmodule`,
    FullAdder: `module RB_FULLADDER(
  input wire a,
  input wire b,
  input wire cin,
  output wire sum,
  output wire cout
);
  assign sum = a ^ b ^ cin;
  assign cout = (a & b) | (cin & (a ^ b));
endmodule`,
    HalfAdder: `module RB_HALFADDER(
  input wire a,
  input wire b,
  output wire sum,
  output wire cout
);
  assign sum = a ^ b;
  assign cout = a & b;
endmodule`,
  };

  for (const type of usedTypes) {
    if (PRIMITIVE_DEFINITIONS[type]) {
      lines.push(PRIMITIVE_DEFINITIONS[type]);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate XDC constraints for Basys 3
 */
function generateConstraintsXdc(
  board: string,
  inputPorts: string[],
  outputPorts: string[],
  includeClock: boolean
): string {
  if (board !== 'basys3') {
    return `## Constraints for ${board} - not yet supported\n`;
  }

  const lines: string[] = [];
  lines.push('## RedByte Generated Constraints for Basys 3');
  lines.push('## Part: xc7a35tcpg236-1');
  lines.push('');

  // Clock
  if (includeClock) {
    lines.push('## Clock signal (100 MHz)');
    lines.push('set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]');
    lines.push('create_clock -add -name sys_clk_pin -period 10.00 -waveform {0 5} [get_ports clk]');
    lines.push('');
  }

  // Basys 3 switch pins
  const SWITCH_PINS = [
    'V17', 'V16', 'W16', 'W17', 'W15', 'V15', 'W14', 'W13',
    'V2', 'T3', 'T2', 'R3', 'W2', 'U1', 'T1', 'R2'
  ];

  // Basys 3 LED pins
  const LED_PINS = [
    'U16', 'E19', 'U19', 'V19', 'W18', 'U15', 'U14', 'V14',
    'V13', 'V3', 'W3', 'U3', 'P3', 'N3', 'P1', 'L1'
  ];

  // Map inputs to switches
  if (inputPorts.length > 0) {
    lines.push('## Switches');
    inputPorts.forEach((port, i) => {
      if (i < SWITCH_PINS.length) {
        lines.push(`set_property -dict { PACKAGE_PIN ${SWITCH_PINS[i]} IOSTANDARD LVCMOS33 } [get_ports {${port}}]`);
      }
    });
    lines.push('');
  }

  // Map outputs to LEDs
  if (outputPorts.length > 0) {
    lines.push('## LEDs');
    outputPorts.forEach((port, i) => {
      if (i < LED_PINS.length) {
        lines.push(`set_property -dict { PACKAGE_PIN ${LED_PINS[i]} IOSTANDARD LVCMOS33 } [get_ports {${port}}]`);
      }
    });
    lines.push('');
  }

  // Configuration options
  lines.push('## Configuration');
  lines.push('set_property CONFIG_VOLTAGE 3.3 [current_design]');
  lines.push('set_property CFGBVS VCCO [current_design]');
  lines.push('set_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]');

  return lines.join('\n');
}
