// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import './index';
import { CircuitEngine } from './CircuitEngine';
import type { Circuit } from './types';

describe('DFlipFlop', () => {
  it('captures D on rising CLK edge and holds between edges', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'dff', type: 'DFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 'd_sw', type: 'Switch', position: { x: -2, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'clk_sw', type: 'Switch', position: { x: -2, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 'd_sw', portName: 'out' }, to: { nodeId: 'dff', portName: 'D' } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'dff', portName: 'CLK' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('dff', 'Q')).toBe(0);

    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('dff', 'Q')).toBe(1);
    expect(engine.getNodeValue('dff', 'Q_inv')).toBe(0);

    engine.setNodeState('d_sw', { isOn: 0 });
    engine.stabilize();
    expect(engine.getNodeValue('dff', 'Q')).toBe(1);

    engine.setNodeState('clk_sw', { isOn: 0 });
    engine.stabilize();
    expect(engine.getNodeValue('dff', 'Q')).toBe(1);

    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('dff', 'Q')).toBe(0);
    expect(engine.getNodeValue('dff', 'Q_inv')).toBe(1);
  });
});

describe('TFlipFlop', () => {
  it('toggles only on rising CLK edge when T=1', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'tff', type: 'TFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 't_src', type: 'PowerSource', position: { x: -2, y: 0 }, rotation: 0, config: {} },
        { id: 'clk_sw', type: 'Switch', position: { x: -2, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 't_src', portName: 'out' }, to: { nodeId: 'tff', portName: 'T' } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'tff', portName: 'CLK' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0);

    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);

    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);

    engine.setNodeState('clk_sw', { isOn: 0 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);

    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0);
  });

  it('clears immediately when CLR is asserted', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'tff', type: 'TFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 't_src', type: 'PowerSource', position: { x: -2, y: 0 }, rotation: 0, config: {} },
        { id: 'clk_sw', type: 'Switch', position: { x: -2, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'clr_sw', type: 'Switch', position: { x: -2, y: 2 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 't_src', portName: 'out' }, to: { nodeId: 'tff', portName: 'T' } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'tff', portName: 'CLK' } },
        { from: { nodeId: 'clr_sw', portName: 'out' }, to: { nodeId: 'tff', portName: 'CLR' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(1);

    engine.setNodeState('clr_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('tff', 'Q')).toBe(0);
    expect(engine.getNodeValue('tff', 'Q_inv')).toBe(1);
  });
});

describe('JKFlipFlop', () => {
  it('updates only on the rising clock edge', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'jkff', type: 'JKFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 'j_sw', type: 'Switch', position: { x: -3, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'k_sw', type: 'Switch', position: { x: -3, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'clk_sw', type: 'Switch', position: { x: -3, y: 2 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 'j_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'J' } },
        { from: { nodeId: 'k_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'K' } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'CLK' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(0);

    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(1);

    engine.setNodeState('j_sw', { isOn: 0 });
    engine.setNodeState('k_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(1);

    engine.setNodeState('clk_sw', { isOn: 0 });
    engine.stabilize();
    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(0);
    expect(engine.getNodeValue('jkff', 'Q_inv')).toBe(1);
  });

  it('clears immediately when CLR is asserted', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'jkff', type: 'JKFlipFlop', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        { id: 'j_sw', type: 'Switch', position: { x: -3, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'k_sw', type: 'Switch', position: { x: -3, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'clk_sw', type: 'Switch', position: { x: -3, y: 2 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'clr_sw', type: 'Switch', position: { x: -3, y: 3 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 'j_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'J' } },
        { from: { nodeId: 'k_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'K' } },
        { from: { nodeId: 'clk_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'CLK' } },
        { from: { nodeId: 'clr_sw', portName: 'out' }, to: { nodeId: 'jkff', portName: 'CLR' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    engine.setNodeState('clk_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(1);

    engine.setNodeState('clr_sw', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('jkff', 'Q')).toBe(0);
    expect(engine.getNodeValue('jkff', 'Q_inv')).toBe(1);
  });
});

describe('Register family semantics', () => {
  it('Register1 supports CE hold and async clear', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'reg1',
          type: 'Register1',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: { hasEnable: true, resetKind: 'async_clear', resetPolarity: 'active_high' },
        },
        { id: 'd', type: 'Switch', position: { x: -3, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'clk', type: 'Switch', position: { x: -3, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'en', type: 'Switch', position: { x: -3, y: 2 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'rst', type: 'Switch', position: { x: -3, y: 3 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 'd', portName: 'out' }, to: { nodeId: 'reg1', portName: 'D' } },
        { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'reg1', portName: 'CLK' } },
        { from: { nodeId: 'en', portName: 'out' }, to: { nodeId: 'reg1', portName: 'EN' } },
        { from: { nodeId: 'rst', portName: 'out' }, to: { nodeId: 'reg1', portName: 'RST' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    expect(engine.getNodeValue('reg1', 'Q')).toBe(0);

    engine.setNodeState('clk', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('reg1', 'Q')).toBe(1);

    // Hold when EN is low.
    engine.setNodeState('en', { isOn: 0 });
    engine.setNodeState('d', { isOn: 0 });
    engine.setNodeState('clk', { isOn: 0 });
    engine.stabilize();
    engine.setNodeState('clk', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('reg1', 'Q')).toBe(1);

    // Async clear acts immediately.
    engine.setNodeState('rst', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('reg1', 'Q')).toBe(0);
  });

  it('RegisterBus captures packed data with sync reset behavior', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'regb',
          type: 'RegisterBus',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: { width: 4, resetKind: 'sync_set', hasEnable: true },
        },
        { id: 'd', type: 'INPUT', position: { x: -3, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'clk', type: 'Switch', position: { x: -3, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'en', type: 'Switch', position: { x: -3, y: 2 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'rst', type: 'Switch', position: { x: -3, y: 3 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 'd', portName: 'out' }, to: { nodeId: 'regb', portName: 'D' } },
        { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'regb', portName: 'CLK' } },
        { from: { nodeId: 'en', portName: 'out' }, to: { nodeId: 'regb', portName: 'EN' } },
        { from: { nodeId: 'rst', portName: 'out' }, to: { nodeId: 'regb', portName: 'RST' } },
      ],
    };

    const engine = new CircuitEngine(circuit);
    // Drive packed value directly through state to emulate vector source.
    engine.setNodeState('d', { isOn: 0, value: 0b1010 });
    engine.stabilize();
    engine.setNodeValue('d', 0b1010);
    engine.setNodeState('clk', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('regb', 'Q0')).toBe(0);
    expect(engine.getNodeValue('regb', 'Q1')).toBe(1);

    // Sync set should force all bits high on next edge when reset asserted.
    engine.setNodeState('clk', { isOn: 0 });
    engine.stabilize();
    engine.setNodeState('rst', { isOn: 1 });
    engine.setNodeState('clk', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('regb', 'Q0')).toBe(1);
    expect(engine.getNodeValue('regb', 'Q3')).toBe(1);
  });

  it('StateBank exposes grouped bit state', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'bank',
          type: 'StateBank',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: { width: 3, hasEnable: false },
        },
        { id: 'd0', type: 'Switch', position: { x: -3, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'd1', type: 'Switch', position: { x: -3, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'd2', type: 'Switch', position: { x: -3, y: 2 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'clk', type: 'Switch', position: { x: -3, y: 3 }, rotation: 0, config: {}, state: { isOn: 0 } },
      ],
      connections: [
        { from: { nodeId: 'd0', portName: 'out' }, to: { nodeId: 'bank', portName: 'D0' } },
        { from: { nodeId: 'd1', portName: 'out' }, to: { nodeId: 'bank', portName: 'D1' } },
        { from: { nodeId: 'd2', portName: 'out' }, to: { nodeId: 'bank', portName: 'D2' } },
        { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'bank', portName: 'CLK' } },
      ],
    };
    const engine = new CircuitEngine(circuit);
    engine.stabilize();
    engine.setNodeState('clk', { isOn: 1 });
    engine.stabilize();
    expect(engine.getNodeValue('bank', 'Q0')).toBe(1);
    expect(engine.getNodeValue('bank', 'Q1')).toBe(0);
    expect(engine.getNodeValue('bank', 'Q2')).toBe(1);
    expect(engine.getNodeState('bank')?.bankBits).toEqual([1, 0, 1]);
  });
});
