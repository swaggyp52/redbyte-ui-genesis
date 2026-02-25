/**
 * Regression suite for three Verilog generator bug classes.
 *
 *  Bug 1 — port alias (a/b → in1/in2):
 *    Circuit catalog uses single-letter port names ('a', 'b') for gate inputs;
 *    primitives use 'in1', 'in2'. Without the fix, all aliased ports generate 1'b0.
 *
 *  Bug 2 — DFF port case normalization (D/CLK/Q → d/clk/q):
 *    Catalog connections use uppercase 'D', 'CLK', 'Q'; primitives use lowercase.
 *    Without the fix, DFF data/clock inputs are 1'b0 and Q output wire has wrong name.
 *
 *  Bug 3 — output assignment generation:
 *    Module output ports were declared but never driven. Two sub-cases:
 *      Case A: logic wire → output (e.g. AND gate output → Lamp)
 *      Case B: INPUT → OUTPUT direct passthrough (no logic)
 */

import { describe, expect, it } from 'vitest';
import type { CircuitV1, IoMapping } from '@redbyte/rb-utils';
import { circuitToVerilog } from '../verilog-generator';

// ── Bug 1 — Port alias ────────────────────────────────────────────────────────

describe('Bug 1 regression — port alias a/b resolves to in1/in2', () => {
  const circuit: CircuitV1 = {
    schemaVersion: '1.0',
    nodes: [
      { id: 'sw0',  type: 'Switch', x: 0,   y: 80,  params: {}, state: {} },
      { id: 'sw1',  type: 'Switch', x: 0,   y: 120, params: {}, state: {} },
      { id: 'and0', type: 'AND',    x: 100, y: 100, params: {}, state: {} },
      { id: 'ld0',  type: 'Lamp',   x: 200, y: 100, params: {}, state: {} },
    ],
    connections: [
      // 'a' and 'b' are the catalog alias names for 'in1' and 'in2'
      { id: 'c1', fromNodeId: 'sw0',  fromPin: 'out', toNodeId: 'and0', toPin: 'a' },
      { id: 'c2', fromNodeId: 'sw1',  fromPin: 'out', toNodeId: 'and0', toPin: 'b' },
      { id: 'c3', fromNodeId: 'and0', fromPin: 'out', toNodeId: 'ld0',  toPin: 'in' },
    ],
    customChips: [],
  };
  const mapping: IoMapping = {
    inputs: [
      { id: 'i0', nodeId: 'sw0', port: 'out', pin: 'SW0' },
      { id: 'i1', nodeId: 'sw1', port: 'out', pin: 'SW1' },
    ],
    outputs: [{ id: 'o0', nodeId: 'ld0', port: 'in', pin: 'LD0' }],
  };

  it('drives AND in1/in2 from actual signals, not 1\'b0', () => {
    const { verilog } = circuitToVerilog(circuit, mapping, { moduleName: 'top' });
    // Pre-fix behaviour: .in1(1'b0) .in2(1'b0) because 'a'/'b' didn't match 'in1'/'in2'
    expect(verilog).toContain('.in1(sw0_out)');
    expect(verilog).toContain('.in2(sw1_out)');
    expect(verilog).not.toContain(".in1(1'b0)");
    expect(verilog).not.toContain(".in2(1'b0)");
  });
});

// ── Bug 2 — DFF case normalization ───────────────────────────────────────────

describe('Bug 2 regression — DFF D/CLK/Q uppercase connections normalize to d/clk/q', () => {
  const circuit: CircuitV1 = {
    schemaVersion: '1.0',
    nodes: [
      { id: 'clk_sw', type: 'Switch',    x: 0,   y: 80,  params: {}, state: {} },
      { id: 'd_sw',   type: 'Switch',    x: 0,   y: 120, params: {}, state: {} },
      { id: 'ff0',    type: 'DFlipFlop', x: 100, y: 100, params: {}, state: {} },
      { id: 'q_out',  type: 'Lamp',      x: 200, y: 100, params: {}, state: {} },
    ],
    connections: [
      // Catalog uses uppercase port names for DFF
      { id: 'c1', fromNodeId: 'clk_sw', fromPin: 'out', toNodeId: 'ff0',   toPin: 'CLK' },
      { id: 'c2', fromNodeId: 'd_sw',   fromPin: 'out', toNodeId: 'ff0',   toPin: 'D'   },
      { id: 'c3', fromNodeId: 'ff0',    fromPin: 'Q',   toNodeId: 'q_out', toPin: 'in'  },
    ],
    customChips: [],
  };
  const mapping: IoMapping = {
    inputs: [
      { id: 'i0', nodeId: 'clk_sw', port: 'out', pin: 'SW0' },
      { id: 'i1', nodeId: 'd_sw',   port: 'out', pin: 'SW1' },
    ],
    outputs: [{ id: 'o0', nodeId: 'q_out', port: 'in', pin: 'LD0' }],
  };

  it('drives DFF .d and .clk from actual signals, not 1\'b0', () => {
    const { verilog } = circuitToVerilog(circuit, mapping, { moduleName: 'top' });
    // Pre-fix behaviour: .d(1'b0) .clk(1'b0) because uppercase 'D'/'CLK' didn't match 'd'/'clk'
    expect(verilog).toContain('.d(d_sw_out)');
    expect(verilog).toContain('.clk(clk_sw_out)');
    expect(verilog).not.toContain(".d(1'b0)");
    expect(verilog).not.toContain(".clk(1'b0)");
  });

  it('uses lowercase wire name ff0_q (not ff0_Q) and assigns it to output', () => {
    const { verilog } = circuitToVerilog(circuit, mapping, { moduleName: 'top' });
    // Pre-fix: fromPin 'Q' produced wire 'ff0_Q'; primitive declares 'ff0_q' → mismatch
    expect(verilog).toContain('.q(ff0_q)');
    expect(verilog).toContain('assign q_out_in = ff0_q;');
    expect(verilog).not.toContain('ff0_Q'); // uppercase form must not appear
  });
});

// ── Bug 3 — Output assignment generation ─────────────────────────────────────

describe('Bug 3 regression — module output ports receive assign statements', () => {
  it('Case A: logic wire → OUTPUT port emits assign statement', () => {
    const circuit: CircuitV1 = {
      schemaVersion: '1.0',
      nodes: [
        { id: 'sw0',  type: 'Switch', x: 0,   y: 80,  params: {}, state: {} },
        { id: 'sw1',  type: 'Switch', x: 0,   y: 120, params: {}, state: {} },
        { id: 'and0', type: 'AND',    x: 100, y: 100, params: {}, state: {} },
        { id: 'ld0',  type: 'Lamp',   x: 200, y: 100, params: {}, state: {} },
      ],
      connections: [
        { id: 'c1', fromNodeId: 'sw0',  fromPin: 'out', toNodeId: 'and0', toPin: 'in1' },
        { id: 'c2', fromNodeId: 'sw1',  fromPin: 'out', toNodeId: 'and0', toPin: 'in2' },
        { id: 'c3', fromNodeId: 'and0', fromPin: 'out', toNodeId: 'ld0',  toPin: 'in'  },
      ],
      customChips: [],
    };
    const mapping: IoMapping = {
      inputs: [
        { id: 'i0', nodeId: 'sw0', port: 'out', pin: 'SW0' },
        { id: 'i1', nodeId: 'sw1', port: 'out', pin: 'SW1' },
      ],
      outputs: [{ id: 'o0', nodeId: 'ld0', port: 'in', pin: 'LD0' }],
    };
    const { verilog } = circuitToVerilog(circuit, mapping, { moduleName: 'top' });
    // Pre-fix: output port ld0_in was declared but never driven
    expect(verilog).toContain('assign ld0_in = and0_out;');
  });

  it('Case B: direct INPUT → OUTPUT pass-through emits assign statement', () => {
    const circuit: CircuitV1 = {
      schemaVersion: '1.0',
      nodes: [
        { id: 'sw0', type: 'Switch', x: 0,   y: 100, params: {}, state: {} },
        { id: 'ld0', type: 'Lamp',   x: 200, y: 100, params: {}, state: {} },
      ],
      connections: [
        { id: 'c1', fromNodeId: 'sw0', fromPin: 'out', toNodeId: 'ld0', toPin: 'in' },
      ],
      customChips: [],
    };
    const mapping: IoMapping = {
      inputs:  [{ id: 'i0', nodeId: 'sw0', port: 'out', pin: 'SW0' }],
      outputs: [{ id: 'o0', nodeId: 'ld0', port: 'in',  pin: 'LD0' }],
    };
    const { verilog } = circuitToVerilog(circuit, mapping, { moduleName: 'top' });
    // No logic gate in path — direct pass-through must still drive the output port
    expect(verilog).toContain('assign ld0_in = sw0_out;');
    // No undriven ports remain
    expect(verilog).not.toContain("1'b0");
  });
});
