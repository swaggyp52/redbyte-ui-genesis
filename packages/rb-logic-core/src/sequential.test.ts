// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import './index';
import { CircuitEngine } from './CircuitEngine';
import type { Circuit } from './types';

// ---------------------------------------------------------------------------
// TFlipFlop — behavioral edge-triggered toggle flip-flop
// ---------------------------------------------------------------------------

describe('TFlipFlop', () => {
  it('should initialize Q=0', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'tff', type: 'TFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
      ],
      connections: [],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0);
  });

  it('should NOT toggle when T=0 on rising CLK edge', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'tff',     type: 'TFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 'clk_sw',  type: 'Switch',    position: { x: -2, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
        // T is left unconnected → T=0
      ],
      connections: [
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'tff', portName: 'CLK' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0);

    // Rising CLK edge with T=0: Q should hold
    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0);
  });

  it('should toggle Q on rising CLK edge when T=1', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'tff',    type: 'TFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 't_src',  type: 'PowerSource', position: { x: -2, y: 0 }, rotation: 0, config: {} },
        { id: 'clk_sw', type: 'Switch',    position: { x: -2, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 't_src',  portName: 'out' }, to: { nodeId: 'tff', portName: 'T'   } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'tff', portName: 'CLK' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0); // initial

    // First rising edge: 0→1 toggle
    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);

    // CLK stays high — no second edge — Q holds
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);

    // Falling edge: Q holds
    engine.setNodeState('clk_sw', { isOn: 0 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);

    // Second rising edge: 1→0 toggle
    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0);
  });

  it('should not toggle on falling CLK edge', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'tff',    type: 'TFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 't_src',  type: 'PowerSource', position: { x: -2, y: 0 }, rotation: 0, config: {} },
        // CLK starts high
        { id: 'clk_sw', type: 'Switch', position: { x: -2, y: 1 }, rotation: 0, config: {}, state: { isOn: 1 } },
      ],
      connections: [
        { from: { nodeId: 't_src',  portName: 'out' }, to: { nodeId: 'tff', portName: 'T'   } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'tff', portName: 'CLK' } },
      ],
    };

    // Engine starts with CLK=1; TFlipFlop initial state is lastClk=0
    // So first stabilize will see 0→1 rising edge and toggle Q
    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1); // toggled on initialization rising edge

    // Falling edge: Q should hold
    engine.setNodeState('clk_sw', { isOn: 0 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// JKFlipFlop — hold, set, reset cases (toggle case excluded, see scoping doc)
// ---------------------------------------------------------------------------

describe('JKFlipFlop', () => {
  function makeJKCircuit(j: number, k: number, clk: number) {
    const circuit: Circuit = {
      nodes: [
        { id: 'jkff',   type: 'JKFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 'j_sw',   type: 'Switch', position: { x: -3, y: 0 }, rotation: 0, config: {}, state: { isOn: j } },
        { id: 'k_sw',   type: 'Switch', position: { x: -3, y: 1 }, rotation: 0, config: {}, state: { isOn: k } },
        { id: 'clk_sw', type: 'Switch', position: { x: -3, y: 2 }, rotation: 0, config: {}, state: { isOn: clk } },
      ],
      connections: [
        { from: { nodeId: 'j_sw',   portName: 'out' }, to: { nodeId: 'jkff', portName: 'J'   } },
        { from: { nodeId: 'k_sw',   portName: 'out' }, to: { nodeId: 'jkff', portName: 'K'   } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'CLK' } },
      ],
    };
    return circuit;
  }

  it('J=0 K=0 CLK=1: holds Q=0 (initial state)', () => {
    const engine = new CircuitEngine(makeJKCircuit(0, 0, 1));
    engine.stabilize();
    // J=0, K=0, CLK=1 → no change, Q stays 0
    expect(engine.getNodeValue('jkff', 'Q')).toBe(0);
  });

  it('J=1 K=0 CLK=1: sets Q=1', () => {
    const engine = new CircuitEngine(makeJKCircuit(1, 0, 1));
    engine.stabilize();
    // J=1, K=0, CLK=1 → SET → Q=1
    expect(engine.getNodeValue('jkff', 'Q')).toBe(1);
  });

  it('J=0 K=1 CLK=1: resets Q=0 after set', () => {
    // First SET to Q=1
    const setCircuit = makeJKCircuit(1, 0, 1);
    const engine = new CircuitEngine(setCircuit);
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(1);

    // Now RESET
    engine.setNodeState('j_sw', { isOn: 0 });
    engine.setNodeState('k_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(0);
  });
});
