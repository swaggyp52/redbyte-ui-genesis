// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TickEngine } from './TickEngine';
import type { Circuit } from './types';

describe('TickEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute ticks at specified Hz', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'clk', type: 'Clock', position: { x: 0, y: 0 }, rotation: 0, config: { period: 4 } },
      ],
      connections: [],
    };

    const engine = new TickEngine(circuit, { tickRate: 20 });
    engine.start();

    expect(engine.isRunning()).toBe(true);

    // Advance time by 50ms (1 tick at 20Hz)
    vi.advanceTimersByTime(50);
    expect(engine.getTickCount()).toBe(1);

    // Advance by another 100ms (2 more ticks)
    vi.advanceTimersByTime(100);
    expect(engine.getTickCount()).toBe(3);

    engine.pause();
    expect(engine.isRunning()).toBe(false);
  });

  it('should support stepOnce for manual stepping', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'clk', type: 'Clock', position: { x: 0, y: 0 }, rotation: 0, config: { period: 2 } },
      ],
      connections: [],
    };

    const engine = new TickEngine(circuit, { tickRate: 20 });
    
    expect(engine.getTickCount()).toBe(0);
    
    engine.stepOnce();
    expect(engine.getTickCount()).toBe(1);
    
    engine.stepOnce();
    expect(engine.getTickCount()).toBe(2);
  });

  it('should adjust tick rate dynamically', () => {
    const circuit: Circuit = {
      nodes: [],
      connections: [],
    };

    const engine = new TickEngine(circuit, { tickRate: 10 });
    expect(engine.getTickRate()).toBe(10);

    engine.setTickRate(20);
    expect(engine.getTickRate()).toBe(20);
  });

  it('should reset tick count', () => {
    const circuit: Circuit = {
      nodes: [],
      connections: [],
    };

    const engine = new TickEngine(circuit);
    engine.stepOnce();
    engine.stepOnce();
    
    expect(engine.getTickCount()).toBe(2);
    
    engine.resetTickCount();
    expect(engine.getTickCount()).toBe(0);
  });
});
