// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '../LogicCanvas';

vi.mock('@redbyte/rb-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
  return {
    ...actual,
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
    trackRender: vi.fn(),
  };
});

const { mockSelection } = vi.hoisted(() => ({
  mockSelection: { nodes: new Set<string>(), wires: new Set<string>() },
}));

vi.mock('../useLogicViewStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useLogicViewStore')>();
  const mockCamera = { x: 0, y: 0, zoom: 1 };
  const mockEditingState = { isDragging: false };
  const mockState = {
    camera: mockCamera,
    setCamera: vi.fn(),
    pan: vi.fn(),
    zoom: vi.fn(),
    selection: mockSelection,
    selectNode: vi.fn(),
    selectWire: vi.fn(),
    clearSelection: vi.fn(),
    selectMultipleNodes: vi.fn(),
    toolMode: 'select' as const,
    setToolMode: vi.fn(),
    editingState: mockEditingState,
    setEditingState: vi.fn(),
    startWire: vi.fn(),
    endWire: vi.fn(),
    snapToGrid: true,
    toggleSnapToGrid: vi.fn(),
    gridSize: 16,
  };
  return {
    ...actual,
    useLogicViewStore: (selector?: (state: typeof mockState) => unknown) =>
      selector ? selector(mockState) : mockState,
    getGlobalViewStateStore: () => null,
  };
});

const FANOUT_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'src',
      type: 'INPUT',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    },
    {
      id: 'ld0',
      type: 'OUTPUT',
      position: { x: 200, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'ld1',
      type: 'OUTPUT',
      position: { x: 200, y: 100 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    { from: { nodeId: 'src', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
    { from: { nodeId: 'src', portName: 'out' }, to: { nodeId: 'ld1', portName: 'in' } },
  ],
};

describe('LogicCanvas trace focus de-emphasis', () => {
  beforeEach(() => {
    mockSelection.nodes.clear();
    mockSelection.wires.clear();
  });

  it('dims wires not in probeWireHighlights when a trace path is active', () => {
    const engine = new TickEngine(FANOUT_CIRCUIT, { tickRate: 1 });
    const wTraced = 'src.out-ld0.in';
    const highlights = new Map<string, string[]>([[wTraced, ['#fbbf24']]]);

    const { container } = render(
      <LogicCanvas
        engine={engine}
        circuit={FANOUT_CIRCUIT}
        width={400}
        height={300}
        showToolbar={false}
        showHints={false}
        probeWireHighlights={highlights}
        onCircuitChange={vi.fn()}
      />
    );

    const onPath = container.querySelector(`[data-wire-id="${wTraced}"]`);
    const offPath = container.querySelector(`[data-wire-id="src.out-ld1.in"]`);

    expect(onPath).toBeTruthy();
    expect(offPath).toBeTruthy();
    expect(onPath).toHaveAttribute('data-wire-trace-dim', '0');
    expect(offPath).toHaveAttribute('data-wire-trace-dim', '1');
  });

  it('does not dim when no probe highlights are present', () => {
    const engine = new TickEngine(FANOUT_CIRCUIT, { tickRate: 1 });
    const { container } = render(
      <LogicCanvas
        engine={engine}
        circuit={FANOUT_CIRCUIT}
        width={400}
        height={300}
        showToolbar={false}
        showHints={false}
        onCircuitChange={vi.fn()}
      />
    );

    const w0 = container.querySelector('[data-wire-id="src.out-ld0.in"]');
    expect(w0).toHaveAttribute('data-wire-trace-dim', '0');
  });
});
