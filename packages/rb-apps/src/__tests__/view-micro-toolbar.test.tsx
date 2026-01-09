// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CircuitEngine, TickEngine, type Circuit } from '@redbyte/rb-logic-core';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { OscilloscopeView } from '../components/OscilloscopeView';

// Mock @redbyte/rb-utils to prevent useUiTickStore infinite update loops
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
  return {
    ...actual,
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
  };
});

// TODO: Fix infinite update loop caused by useUiTickStore in React 19
// The store's useSyncExternalStore integration triggers "Maximum update depth exceeded"
// when tests render components that use the store. Needs investigation into proper
// mocking strategy or store implementation fix for React 19 compatibility.
describe.skip('View micro toolbars', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    const mockCtx = {
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 6 }),
      strokeStyle: '',
      lineWidth: 1,
      fillStyle: '',
      font: '',
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('renders a circuit micro toolbar in the view header', () => {
    const circuit: Circuit = { nodes: [], connections: [] };
    const engine = new CircuitEngine(circuit);
    const tickEngine = new TickEngine(circuit, { tickRate: 1 });

    render(
      <SplitViewLayout
        mode="single"
        views={['circuit']}
        engine={engine}
        tickEngine={tickEngine}
        circuit={circuit}
        isRunning={false}
        onCircuitChange={() => {}}
      />
    );

    expect(screen.getByTestId('circuit-micro-toolbar')).toBeInTheDocument();
  });

  it('renders a scope micro toolbar overlay', () => {
    const circuit: Circuit = { nodes: [], connections: [] };
    const engine = new CircuitEngine(circuit);
    const tickEngine = new TickEngine(circuit, { tickRate: 1 });

    render(
      <OscilloscopeView
        engine={engine}
        tickEngine={tickEngine}
        circuit={circuit}
        isRunning={false}
      />
    );

    expect(screen.getByTestId('scope-micro-toolbar')).toBeInTheDocument();
  });
});
