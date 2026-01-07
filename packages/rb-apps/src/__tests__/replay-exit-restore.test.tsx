// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { CircuitEngine, TickEngine, type Circuit } from '@redbyte/rb-logic-core';
import { restoreReplayState } from '../utils/replayRestore';

describe('replay exit restore', () => {
  it('restores prior circuit state and view state', () => {
    const circuit: Circuit = {
      nodes: [{ id: 'sw1', type: 'Switch', position: { x: 0, y: 0 } }],
      connections: [],
    };
    const engine = new CircuitEngine(circuit);
    const tickEngine = new TickEngine(circuit, { tickRate: 5 });
    const setTickRateSpy = vi.spyOn(tickEngine, 'setTickRate');
    const startSpy = vi.spyOn(tickEngine, 'start');

    const setters = {
      setEngine: vi.fn(),
      setTickEngine: vi.fn(),
      setCircuit: vi.fn(),
      setCurrentHz: vi.fn(),
      setTickCount: vi.fn(),
      setIsRunning: vi.fn(),
    };
    const viewStore = { setState: vi.fn() };

    restoreReplayState(
      {
        circuit,
        engine,
        tickEngine,
        tickRate: 5,
        isRunning: true,
        tickCount: 3,
        viewState: {
          camera: { x: 1, y: 2, zoom: 1 },
          selection: { nodes: new Set(['sw1']), wires: new Set() },
        },
      },
      setters,
      viewStore
    );

    expect(setters.setCircuit).toHaveBeenCalledWith(circuit);
    expect(setTickRateSpy).toHaveBeenCalledWith(5);
    expect(startSpy).toHaveBeenCalled();
    expect(viewStore.setState).toHaveBeenCalled();
  });
});
