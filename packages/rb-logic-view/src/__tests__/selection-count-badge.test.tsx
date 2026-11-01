// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  const mockState = {
    camera: { x: 0, y: 0, zoom: 1 },
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
    interactionMode: 'idle' as const,
    setInteractionMode: vi.fn(),
    editingState: { isDragging: false },
    setEditingState: vi.fn(),
    startWire: vi.fn(),
    endWire: vi.fn(),
    hoveredWireId: null,
    setHoveredWireId: vi.fn(),
    rewiredWireId: null,
    setRewiredWireId: vi.fn(),
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

const CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'sw0_node',
      type: 'INPUT',
      label: 'SW0 (A)',
      position: { x: 100, y: 100 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    },
    {
      id: 'and0_node',
      type: 'AND',
      label: 'AND0',
      position: { x: 220, y: 100 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [],
};

function renderCanvas() {
  const engine = new TickEngine(CIRCUIT, { tickRate: 1 });
  return render(
    <LogicCanvas
      engine={engine}
      circuit={CIRCUIT}
      width={480}
      height={320}
      showToolbar={false}
      showHints={false}
      onCircuitChange={vi.fn()}
    />
  );
}

describe('LogicCanvas selection count badge', () => {
  beforeEach(() => {
    mockSelection.nodes.clear();
    mockSelection.wires.clear();
  });

  it('keeps single-input selection and its toggle without the overlapping count pill', () => {
    mockSelection.nodes.add('sw0_node');
    const { queryByTestId, getByTestId } = renderCanvas();

    expect(getByTestId('node-INPUT-sw0_node')).toHaveAttribute('data-node-selected', '1');
    expect(getByTestId('logic-selection-bounds')).toBeInTheDocument();
    expect(getByTestId('switch-toggle-sw0_node')).toBeInTheDocument();
    expect(queryByTestId('logic-selection-count-badge')).toBeNull();
  });

  it('retains the count pill when it communicates a multi-node selection', () => {
    mockSelection.nodes.add('sw0_node');
    mockSelection.nodes.add('and0_node');
    const { getByTestId } = renderCanvas();

    expect(getByTestId('logic-selection-count-badge')).toHaveTextContent('2 selected');
  });
});
