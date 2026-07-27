// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { elaborateCircuit } from '../ir/elaborator';
import type { Circuit } from '../types';

// ---------------------------------------------------------------------------
// Test circuit helpers
// ---------------------------------------------------------------------------

/** Minimal AND-gate circuit: in_a + in_b → and1 → out1 */
function makeAndCircuit(): Circuit {
  return {
    nodes: [
      { id: 'in_a', type: 'INPUT',  label: 'A', position: { x: 0,   y: 0 } },
      { id: 'in_b', type: 'INPUT',  label: 'B', position: { x: 0,   y: 50 } },
      { id: 'and1', type: 'AND',                position: { x: 100, y: 25 } },
      { id: 'out1', type: 'OUTPUT', label: 'Y', position: { x: 200, y: 25 } },
    ],
    connections: [
      { from: { nodeId: 'in_a', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { from: { nodeId: 'in_b', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'out1', portName: 'in' } },
    ],
  };
}

/** Circuit with an unknown gate type */
function makeUnknownTypeCircuit(): Circuit {
  return {
    nodes: [
      { id: 'in1',  type: 'INPUT',        label: 'A',  position: { x: 0,   y: 0 } },
      { id: 'unk1', type: 'SOME_GATE_XYZ',             position: { x: 100, y: 0 } },
      { id: 'out1', type: 'OUTPUT',       label: 'Y',  position: { x: 200, y: 0 } },
    ],
    connections: [
      { from: { nodeId: 'in1',  portName: 'out' }, to: { nodeId: 'unk1', portName: 'in' } },
      { from: { nodeId: 'unk1', portName: 'out' }, to: { nodeId: 'out1', portName: 'in' } },
    ],
  };
}

/** DFlipFlop circuit WITH a clock source */
function makeDffWithClockCircuit(): Circuit {
  return {
    nodes: [
      { id: 'clk1', type: 'Clock',      label: 'CLK', position: { x: 0,   y: 50 } },
      { id: 'in_d', type: 'INPUT',      label: 'D',   position: { x: 0,   y: 0 } },
      { id: 'dff1', type: 'DFlipFlop',               position: { x: 100, y: 25 } },
      { id: 'out_q', type: 'OUTPUT',    label: 'Q',   position: { x: 200, y: 25 } },
    ],
    connections: [
      { from: { nodeId: 'clk1', portName: 'out' }, to: { nodeId: 'dff1', portName: 'CLK' } },
      { from: { nodeId: 'in_d', portName: 'out' }, to: { nodeId: 'dff1', portName: 'D' }   },
      { from: { nodeId: 'dff1', portName: 'Q'   }, to: { nodeId: 'out_q', portName: 'in' } },
    ],
  };
}

/** DFlipFlop circuit WITHOUT a clock source */
function makeDffMissingClockCircuit(): Circuit {
  return {
    nodes: [
      { id: 'in_d',  type: 'INPUT',     label: 'D', position: { x: 0,   y: 0 } },
      { id: 'dff1',  type: 'DFlipFlop',             position: { x: 100, y: 0 } },
      { id: 'out_q', type: 'OUTPUT',    label: 'Q', position: { x: 200, y: 0 } },
    ],
    connections: [
      { from: { nodeId: 'in_d', portName: 'out' }, to: { nodeId: 'dff1',  portName: 'D' }   },
      { from: { nodeId: 'dff1', portName: 'Q'   }, to: { nodeId: 'out_q', portName: 'in' } },
    ],
  };
}

/** Circuit where two INPUT nodes both drive the same gate input port */
function makeMultiDriverCircuit(): Circuit {
  return {
    nodes: [
      { id: 'in_a', type: 'INPUT',  label: 'A', position: { x: 0,   y: 0 } },
      { id: 'in_b', type: 'INPUT',  label: 'B', position: { x: 0,   y: 50 } },
      { id: 'in_c', type: 'INPUT',  label: 'C', position: { x: 0,   y: 100 } },
      { id: 'and1', type: 'AND',                position: { x: 100, y: 25 } },
      { id: 'out1', type: 'OUTPUT', label: 'Y', position: { x: 200, y: 25 } },
    ],
    connections: [
      // Two drivers on and1.a — IR002
      { from: { nodeId: 'in_a', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { from: { nodeId: 'in_b', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      // and1.b is legitimately driven
      { from: { nodeId: 'in_c', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'out1', portName: 'in' } },
    ],
  };
}

/** OUTPUT node with no driver → IR003 */
function makeFloatingOutputCircuit(): Circuit {
  return {
    nodes: [
      { id: 'in1',  type: 'INPUT',  label: 'A', position: { x: 0,   y: 0 } },
      { id: 'out1', type: 'OUTPUT', label: 'Y', position: { x: 200, y: 0 } },
      // out1 has no incoming connection
    ],
    connections: [],
  };
}

/** Combinational loop: two NOT gates feeding each other */
function makeCombinationalLoopCircuit(): Circuit {
  return {
    nodes: [
      { id: 'not1', type: 'NOT', position: { x: 0,   y: 0 } },
      { id: 'not2', type: 'NOT', position: { x: 100, y: 0 } },
    ],
    connections: [
      { from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'not2', portName: 'in' } },
      { from: { nodeId: 'not2', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
    ],
  };
}

/** AND gate with only one of its required inputs connected → IR005 */
function makeDisconnectedInputCircuit(): Circuit {
  return {
    nodes: [
      { id: 'in_a', type: 'INPUT',  label: 'A', position: { x: 0,   y: 0 } },
      { id: 'and1', type: 'AND',                position: { x: 100, y: 0 } },
      { id: 'out1', type: 'OUTPUT', label: 'Y', position: { x: 200, y: 0 } },
    ],
    connections: [
      // Only port 'a' is connected; port 'b' is left floating
      { from: { nodeId: 'in_a', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'out1', portName: 'in' } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IR Elaborator', () => {

  // ─── Test 1: nominal elaboration ──────────────────────────────────────────
  it('AND-gate circuit elaborates to valid IR with correct shape', () => {
    const { ir } = elaborateCircuit(makeAndCircuit());

    expect(ir.schemaVersion).toBe('rb.circuit-ir.v2');
    expect(ir.isValid).toBe(true);
    expect(ir.blockingDiagnosticCount).toBe(0);

    // 2 internal primitives (and1) + 3 ports (in_a, in_b, out1)
    expect(ir.primitives).toHaveLength(1);
    expect(ir.primitives[0].type).toBe('AND');
    expect(ir.primitives[0].sourceNodeId).toBe('and1');

    expect(ir.ports).toHaveLength(3);
    expect(ir.inputs).toHaveLength(2);
    expect(ir.outputs).toHaveLength(1);

    // 3 nets: A (in_a.out), B (in_b.out), and1.out
    expect(ir.nets).toHaveLength(3);

    // Ports carry signalType.width = 1
    for (const port of ir.ports) {
      expect(port.signalType.width).toBe(1);
    }
    // Nets carry signalType.width = 1
    for (const net of ir.nets) {
      expect(net.signalType.width).toBe(1);
    }
  });

  // ─── Test 2: unknown primitive type ────────────────────────────────────────
  it('unknown node type elaborates to UNKNOWN primitive with IR001 error, IR still complete', () => {
    const { ir } = elaborateCircuit(makeUnknownTypeCircuit());

    expect(ir.isValid).toBe(false);
    expect(ir.blockingDiagnosticCount).toBeGreaterThanOrEqual(1);

    // IR still structurally complete — unk1 becomes an UNKNOWN primitive
    const unkPrim = ir.primitives.find(p => p.sourceNodeId === 'unk1');
    expect(unkPrim).toBeDefined();
    expect(unkPrim!.type).toBe('UNKNOWN');

    // IR001 diagnostic emitted
    const ir001 = ir.diagnostics.find(d => d.code === 'IR001');
    expect(ir001).toBeDefined();
    expect(ir001!.severity).toBe('error');
    expect(ir001!.nodeId).toBe('unk1');
  });

  // ─── Test 3: DFlipFlop with clock source → clockBinding resolved ──────────
  it('DFlipFlop with Clock source gets clockBinding set to the clock net name', () => {
    const { ir } = elaborateCircuit(makeDffWithClockCircuit());

    const dff = ir.primitives.find(p => p.sourceNodeId === 'dff1');
    expect(dff).toBeDefined();
    expect(dff!.clockBinding).toBeDefined();
    expect(typeof dff!.clockBinding).toBe('string');
    expect(dff!.clockBinding!.length).toBeGreaterThan(0);

    // The clock net should appear in features
    expect(ir.features.clockNetNames).toContain(dff!.clockBinding);
    expect(ir.features.hasSequentialLogic).toBe(true);
  });

  // ─── Test 4: DFlipFlop missing clock → IR004 ─────────────────────────────
  it('DFlipFlop without a clock driver emits IR004 blocking error', () => {
    const { ir } = elaborateCircuit(makeDffMissingClockCircuit());

    expect(ir.isValid).toBe(false);

    const ir004 = ir.diagnostics.find(d => d.code === 'IR004');
    expect(ir004).toBeDefined();
    expect(ir004!.severity).toBe('error');
    expect(ir004!.nodeId).toBe('dff1');
    expect(ir004!.port).toBe('CLK');
  });

  // ─── Test 5: multi-driver → IRNet.drivers.length === 2 + IR002 ───────────
  it('two drivers on same input produce a merged net with drivers.length===2 and IR002', () => {
    const { ir } = elaborateCircuit(makeMultiDriverCircuit());

    const multiNet = ir.nets.find(n => n.drivers.length >= 2);
    expect(multiNet).toBeDefined();
    expect(multiNet!.drivers.length).toBe(2);

    const ir002 = ir.diagnostics.find(d => d.code === 'IR002');
    expect(ir002).toBeDefined();
    expect(ir002!.severity).toBe('error');

    expect(ir.features.hasMultipleDrivers).toBe(true);
    expect(ir.isValid).toBe(false);
  });

  // ─── Test 6: floating output → IR003 + features flag ─────────────────────
  it('OUTPUT node with no incoming driver emits IR003 and sets hasFloatingOutputs', () => {
    const { ir } = elaborateCircuit(makeFloatingOutputCircuit());

    expect(ir.isValid).toBe(true);

    const ir003 = ir.diagnostics.find(d => d.code === 'IR003');
    expect(ir003).toBeDefined();
    expect(ir003!.severity).toBe('warning');
    expect(ir003!.nodeId).toBe('out1');

    expect(ir.features.hasFloatingOutputs).toBe(true);
  });

  // ─── Test 7: hash stability — different node array order ─────────────────
  it('same topology with nodes in different array order produces the same irHash', () => {
    const base = makeAndCircuit();

    // Reverse node array order
    const reversed: Circuit = {
      nodes: [...base.nodes].reverse(),
      connections: [...base.connections],
    };

    const { ir: ir1 } = elaborateCircuit(base);
    const { ir: ir2 } = elaborateCircuit(reversed);

    expect(ir1.irHash).toBe(ir2.irHash);
  });

  // ─── Test 8: hash stability — different connection array order ────────────
  it('same topology with connections in different array order produces the same irHash and net names', () => {
    const base = makeAndCircuit();

    // Shuffle connection array
    const shuffled: Circuit = {
      nodes: [...base.nodes],
      connections: [base.connections[2], base.connections[0], base.connections[1]],
    };

    const { ir: ir1 } = elaborateCircuit(base);
    const { ir: ir2 } = elaborateCircuit(shuffled);

    expect(ir1.irHash).toBe(ir2.irHash);

    // Net names must also be stable
    const names1 = ir1.nets.map(n => n.name).sort();
    const names2 = ir2.nets.map(n => n.name).sort();
    expect(names1).toEqual(names2);
  });

  // ─── Test 9: combinational loop ───────────────────────────────────────────
  it('combinational loop sets hasCombinationalLoop=true and emits IR006 error', () => {
    const { ir } = elaborateCircuit(makeCombinationalLoopCircuit());

    expect(ir.features.hasCombinationalLoop).toBe(true);

    // IR006: combinational loop is now a blocking error at elaboration
    const ir006 = ir.diagnostics.find(d => d.code === 'IR006');
    expect(ir006).toBeDefined();
    expect(ir006!.severity).toBe('error');
    expect(ir006!.message).toMatch(/combinational feedback loop/i);
    expect(ir006!.nodeId).toBeDefined();
  });

  // ─── Test 10: disconnected required input → IR005 warning, isValid true ──
  it('AND gate with only one of two required inputs connected emits IR005 warning', () => {
    const { ir } = elaborateCircuit(makeDisconnectedInputCircuit());

    const ir005 = ir.diagnostics.find(d => d.code === 'IR005');
    expect(ir005).toBeDefined();
    expect(ir005!.severity).toBe('warning');
    expect(ir005!.nodeId).toBe('and1');
    expect(ir005!.port).toBe('b');

    // IR005 is a warning, not a blocking error
    expect(ir.isValid).toBe(true);
    expect(ir.blockingDiagnosticCount).toBe(0);
  });

  // ─── Test 11: all ports and nets default to width 1 ───────────────────────
  it('all IRPorts and IRNets have signalType.width === 1 when no widths are specified', () => {
    const { ir } = elaborateCircuit(makeDffWithClockCircuit());

    for (const port of ir.ports) {
      expect(port.signalType.width).toBe(1);
    }
    for (const net of ir.nets) {
      expect(net.signalType.width).toBe(1);
    }
  });

});
