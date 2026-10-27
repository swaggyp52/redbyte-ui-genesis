// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import '../index';
import { CircuitEngine } from '../CircuitEngine';
import type { Circuit } from '../types';

/**
 * RB-DEBT-028 (b): a register's configuration is the authority for its EN and RST pins, in the
 * simulator exactly as in the exported VHDL (emitRegisterVhdl). Without Clock enable the
 * register ignores EN, wired or not; with Reset mode "none" it ignores RST.
 */

type RegisterFamily = 'Register1' | 'RegisterBus' | 'StateBank';

const wire = (from: string, to: string, port: string) => ({
  id: `${from}-${to}.${port}`,
  from: { nodeId: from, portName: 'out' },
  to: { nodeId: to, portName: port },
});

/** A register whose D is 1 and whose clock is low, with the given control pins wired to switches. */
function registerEngine(type: RegisterFamily, config: Record<string, unknown>, wired: { EN?: 0 | 1; RST?: 0 | 1 }): CircuitEngine {
  const circuit: Circuit = {
    nodes: [
      { id: 'reg', type, config: { width: 1, ...config } },
      { id: 'd', type: 'Switch', state: { isOn: 1 } },
      { id: 'clk', type: 'Switch', state: { isOn: 0 } },
    ],
    connections: [wire('d', 'reg', 'D'), wire('clk', 'reg', 'CLK')],
  };
  for (const [pin, level] of Object.entries(wired)) {
    const id = `sw_${pin.toLowerCase()}`;
    circuit.nodes.push({ id, type: 'Switch', state: { isOn: level } });
    circuit.connections.push(wire(id, 'reg', pin));
  }
  const engine = new CircuitEngine(circuit);
  engine.stabilize();
  return engine;
}

function risingEdge(engine: CircuitEngine): void {
  engine.setNodeState('clk', { isOn: 1 });
  engine.stabilize();
}

const FAMILY: readonly RegisterFamily[] = ['Register1', 'RegisterBus', 'StateBank'];

describe('register configuration is the authority for EN', () => {
  it.each(FAMILY)('%s without Clock enable captures D at the edge although a wired EN is 0', (type) => {
    for (const config of [{ hasEnable: false }, {}]) {
      const engine = registerEngine(type, config, { EN: 0 });
      expect(engine.getNodeValue('reg', 'Q')).toBe(0);
      risingEdge(engine);
      expect(engine.getNodeValue('reg', 'Q'), JSON.stringify(config)).toBe(1);
    }
  });

  it.each(FAMILY)('%s without Clock enable ignores the enable polarity setting too', (type) => {
    // EN unconnected and active-low: without Clock enable neither may stop the capture.
    const engine = registerEngine(type, { hasEnable: false, enablePolarity: 'active_low' }, {});
    risingEdge(engine);
    expect(engine.getNodeValue('reg', 'Q')).toBe(1);
  });

  it.each(FAMILY)('%s with Clock enable holds while EN is 0 and captures while EN is 1', (type) => {
    const held = registerEngine(type, { hasEnable: true }, { EN: 0 });
    risingEdge(held);
    expect(held.getNodeValue('reg', 'Q')).toBe(0);
    const loaded = registerEngine(type, { hasEnable: true }, { EN: 1 });
    risingEdge(loaded);
    expect(loaded.getNodeValue('reg', 'Q')).toBe(1);
  });
});

describe('register configuration is the authority for RST', () => {
  it.each(FAMILY)('%s with Reset mode none captures D although a wired RST is 1', (type) => {
    for (const config of [{ resetKind: 'none' }, {}]) {
      const engine = registerEngine(type, config, { RST: 1 });
      risingEdge(engine);
      expect(engine.getNodeValue('reg', 'Q'), JSON.stringify(config)).toBe(1);
    }
  });

  it.each(FAMILY)('%s with an asynchronous clear holds Q at 0 while RST is 1', (type) => {
    const engine = registerEngine(type, { resetKind: 'async_clear' }, { RST: 1 });
    risingEdge(engine);
    expect(engine.getNodeValue('reg', 'Q')).toBe(0);
  });
});
