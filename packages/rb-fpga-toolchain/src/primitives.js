// Copyright 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Verilog primitive definitions for RedByte node types
 * These map rb-logic-core node types to synthesizable Verilog modules
 */
export const VERILOG_PRIMITIVES = [
    // Basic gates
    {
        nodeType: 'AND',
        moduleName: 'RB_AND',
        ports: { inputs: ['in1', 'in2'], outputs: ['out'] },
        verilog: `module RB_AND(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 & in2;
endmodule`,
    },
    {
        nodeType: 'OR',
        moduleName: 'RB_OR',
        ports: { inputs: ['in1', 'in2'], outputs: ['out'] },
        verilog: `module RB_OR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 | in2;
endmodule`,
    },
    {
        nodeType: 'NOT',
        moduleName: 'RB_NOT',
        ports: { inputs: ['in'], outputs: ['out'] },
        verilog: `module RB_NOT(
  input wire in,
  output wire out
);
  assign out = ~in;
endmodule`,
    },
    {
        nodeType: 'NAND',
        moduleName: 'RB_NAND',
        ports: { inputs: ['in1', 'in2'], outputs: ['out'] },
        verilog: `module RB_NAND(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 & in2);
endmodule`,
    },
    {
        nodeType: 'NOR',
        moduleName: 'RB_NOR',
        ports: { inputs: ['in1', 'in2'], outputs: ['out'] },
        verilog: `module RB_NOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 | in2);
endmodule`,
    },
    {
        nodeType: 'XOR',
        moduleName: 'RB_XOR',
        ports: { inputs: ['in1', 'in2'], outputs: ['out'] },
        verilog: `module RB_XOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 ^ in2;
endmodule`,
    },
    {
        nodeType: 'XNOR',
        moduleName: 'RB_XNOR',
        ports: { inputs: ['in1', 'in2'], outputs: ['out'] },
        verilog: `module RB_XNOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 ^ in2);
endmodule`,
    },
    // Buffer/Wire
    {
        nodeType: 'Wire',
        moduleName: 'RB_WIRE',
        ports: { inputs: ['in'], outputs: ['out'] },
        verilog: `module RB_WIRE(
  input wire in,
  output wire out
);
  assign out = in;
endmodule`,
    },
    // Constant sources
    {
        nodeType: 'PowerSource',
        moduleName: 'RB_VCC',
        ports: { inputs: [], outputs: ['out'] },
        verilog: `module RB_VCC(
  output wire out
);
  assign out = 1'b1;
endmodule`,
    },
    {
        nodeType: 'Ground',
        moduleName: 'RB_GND',
        ports: { inputs: [], outputs: ['out'] },
        verilog: `module RB_GND(
  output wire out
);
  assign out = 1'b0;
endmodule`,
    },
    // D Flip-Flop (for sequential circuits)
    {
        nodeType: 'DFlipFlop',
        moduleName: 'RB_DFF',
        ports: { inputs: ['d', 'clk'], outputs: ['q'] },
        verilog: `module RB_DFF(
  input wire d,
  input wire clk,
  output reg q
);
  always @(posedge clk) begin
    q <= d;
  end
endmodule`,
    },
    // D Flip-Flop with Reset
    {
        nodeType: 'DFlipFlopReset',
        moduleName: 'RB_DFF_RST',
        ports: { inputs: ['d', 'clk', 'rst'], outputs: ['q'] },
        verilog: `module RB_DFF_RST(
  input wire d,
  input wire clk,
  input wire rst,
  output reg q
);
  always @(posedge clk or posedge rst) begin
    if (rst)
      q <= 1'b0;
    else
      q <= d;
  end
endmodule`,
    },
    // RS Latch
    {
        nodeType: 'RSLatch',
        moduleName: 'RB_RSLATCH',
        ports: { inputs: ['s', 'r'], outputs: ['q', 'qn'] },
        verilog: `module RB_RSLATCH(
  input wire s,
  input wire r,
  output reg q,
  output wire qn
);
  assign qn = ~q;
  always @(*) begin
    if (s && !r)
      q = 1'b1;
    else if (r && !s)
      q = 1'b0;
    // If both high or both low, maintain state
  end
endmodule`,
    },
    // JK Flip-Flop
    {
        nodeType: 'JKFlipFlop',
        moduleName: 'RB_JKFF',
        ports: { inputs: ['j', 'k', 'clk'], outputs: ['q', 'qn'] },
        verilog: `module RB_JKFF(
  input wire j,
  input wire k,
  input wire clk,
  output reg q,
  output wire qn
);
  assign qn = ~q;
  always @(posedge clk) begin
    case ({j, k})
      2'b00: q <= q;     // Hold
      2'b01: q <= 1'b0;  // Reset
      2'b10: q <= 1'b1;  // Set
      2'b11: q <= ~q;    // Toggle
    endcase
  end
endmodule`,
    },
    // T Flip-Flop
    {
        nodeType: 'TFlipFlop',
        moduleName: 'RB_TFF',
        ports: { inputs: ['t', 'clk'], outputs: ['q'] },
        verilog: `module RB_TFF(
  input wire t,
  input wire clk,
  output reg q
);
  always @(posedge clk) begin
    if (t)
      q <= ~q;
  end
endmodule`,
    },
    // 2-to-1 Multiplexer
    {
        nodeType: 'MUX2',
        moduleName: 'RB_MUX2',
        ports: { inputs: ['a', 'b', 'sel'], outputs: ['out'] },
        verilog: `module RB_MUX2(
  input wire a,
  input wire b,
  input wire sel,
  output wire out
);
  assign out = sel ? b : a;
endmodule`,
    },
    // 4-to-1 Multiplexer
    {
        nodeType: 'MUX4',
        moduleName: 'RB_MUX4',
        ports: { inputs: ['a', 'b', 'c', 'd', 'sel0', 'sel1'], outputs: ['out'] },
        verilog: `module RB_MUX4(
  input wire a,
  input wire b,
  input wire c,
  input wire d,
  input wire sel0,
  input wire sel1,
  output wire out
);
  wire [1:0] sel = {sel1, sel0};
  assign out = (sel == 2'b00) ? a :
               (sel == 2'b01) ? b :
               (sel == 2'b10) ? c : d;
endmodule`,
    },
    // Full Adder
    {
        nodeType: 'FullAdder',
        moduleName: 'RB_FULLADDER',
        ports: { inputs: ['a', 'b', 'cin'], outputs: ['sum', 'cout'] },
        verilog: `module RB_FULLADDER(
  input wire a,
  input wire b,
  input wire cin,
  output wire sum,
  output wire cout
);
  assign sum = a ^ b ^ cin;
  assign cout = (a & b) | (cin & (a ^ b));
endmodule`,
    },
    // Half Adder
    {
        nodeType: 'HalfAdder',
        moduleName: 'RB_HALFADDER',
        ports: { inputs: ['a', 'b'], outputs: ['sum', 'cout'] },
        verilog: `module RB_HALFADDER(
  input wire a,
  input wire b,
  output wire sum,
  output wire cout
);
  assign sum = a ^ b;
  assign cout = a & b;
endmodule`,
    },
    // Tri-State Buffer
    {
        nodeType: 'TriState',
        moduleName: 'RB_TRISTATE',
        ports: { inputs: ['in', 'en'], outputs: ['out'] },
        verilog: `module RB_TRISTATE(
  input wire in,
  input wire en,
  output wire out
);
  assign out = en ? in : 1'bz;
endmodule`,
    },
    // Delay element (1-tick delay using flip-flop)
    {
        nodeType: 'Delay',
        moduleName: 'RB_DELAY',
        ports: { inputs: ['in', 'clk'], outputs: ['out'] },
        verilog: `module RB_DELAY(
  input wire in,
  input wire clk,
  output reg out
);
  always @(posedge clk) begin
    out <= in;
  end
endmodule`,
    },
    // Clock divider (for generating slower clocks)
    {
        nodeType: 'ClockDivider',
        moduleName: 'RB_CLKDIV',
        ports: { inputs: ['clk_in'], outputs: ['clk_out'] },
        verilog: `module RB_CLKDIV #(
  parameter DIVISOR = 2
)(
  input wire clk_in,
  output reg clk_out
);
  reg [$clog2(DIVISOR)-1:0] counter = 0;
  always @(posedge clk_in) begin
    if (counter >= DIVISOR - 1) begin
      counter <= 0;
      clk_out <= ~clk_out;
    end else begin
      counter <= counter + 1;
    end
  end
endmodule`,
    },
    // 7-Segment Decoder (for Basys 3 display)
    {
        nodeType: 'SevenSegDecoder',
        moduleName: 'RB_7SEG',
        ports: { inputs: ['d0', 'd1', 'd2', 'd3'], outputs: ['seg_a', 'seg_b', 'seg_c', 'seg_d', 'seg_e', 'seg_f', 'seg_g'] },
        verilog: `module RB_7SEG(
  input wire d0, d1, d2, d3,
  output reg seg_a, seg_b, seg_c, seg_d, seg_e, seg_f, seg_g
);
  wire [3:0] digit = {d3, d2, d1, d0};
  always @(*) begin
    case (digit)
      4'h0: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000001;
      4'h1: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1001111;
      4'h2: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0010010;
      4'h3: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000110;
      4'h4: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1001100;
      4'h5: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0100100;
      4'h6: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0100000;
      4'h7: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0001111;
      4'h8: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000000;
      4'h9: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000100;
      4'hA: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0001000;
      4'hB: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1100000;
      4'hC: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0110001;
      4'hD: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1000010;
      4'hE: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0110000;
      4'hF: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0111000;
      default: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1111111;
    endcase
  end
endmodule`,
    },
];
/**
 * Get primitive definition by node type
 */
export function getPrimitive(nodeType) {
    return VERILOG_PRIMITIVES.find((p) => p.nodeType === nodeType);
}
/**
 * Get all primitive Verilog as a single library string
 */
export function getPrimitivesLibrary() {
    const header = `// RedByte Verilog Primitives Library
// Auto-generated - do not edit manually
// Copyright 2025 Connor Angiel

\`timescale 1ns / 1ps
`;
    return header + VERILOG_PRIMITIVES.map((p) => p.verilog).join('\n\n');
}
/**
 * Get map of node types to module names
 */
export function getNodeTypeToModuleMap() {
    const map = new Map();
    for (const p of VERILOG_PRIMITIVES) {
        map.set(p.nodeType, p.moduleName);
    }
    return map;
}
/**
 * Check if a node type has a synthesizable primitive
 */
export function hasPrimitive(nodeType) {
    return VERILOG_PRIMITIVES.some((p) => p.nodeType === nodeType);
}
/**
 * Get all supported node types
 */
export function getSupportedNodeTypes() {
    return VERILOG_PRIMITIVES.map((p) => p.nodeType);
}
