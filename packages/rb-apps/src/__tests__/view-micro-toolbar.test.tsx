// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CircuitEngine, TickEngine, type Circuit } from '@redbyte/rb-logic-core';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { OscilloscopeView } from '../components/OscilloscopeView';

// Mock @redbyte/rb-utils to prevent useUiTickStore RAF loop
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

// Mock @redbyte/rb-logic-view - used by SplitViewLayout
vi.mock('@redbyte/rb-logic-view', () => {
  const React = require('react');
  const mockSelection = { nodes: new Set<string>(), wires: new Set<string>() };
  const mockCamera = { x: 0, y: 0, zoom: 1 };
  const mockState = {
    selection: mockSelection,
    toolMode: 'select' as const,
    setToolMode: vi.fn(),
    snapToGrid: true,
    toggleSnapToGrid: vi.fn(),
    setCamera: vi.fn(),
    camera: mockCamera,
    pan: vi.fn(),
    zoom: vi.fn(),
    selectNode: vi.fn(),
    selectWire: vi.fn(),
    clearSelection: vi.fn(),
    selectMultipleNodes: vi.fn(),
    editingState: { isDragging: false },
    setEditingState: vi.fn(),
    startWire: vi.fn(),
    endWire: vi.fn(),
    gridSize: 16,
  };
  return {
    // Mock LogicCanvas as a simple div to avoid internal store usage
    LogicCanvas: React.forwardRef((_: any, ref: any) =>
      React.createElement('div', { 'data-testid': 'mock-logic-canvas', ref })
    ),
    calculateFitToView: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    useLogicViewStore: Object.assign(
      (selector?: (state: typeof mockState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockState) : mockState,
      {
        getState: () => mockState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
    getGlobalViewStateStore: () => null,
  };
});

// Mock viewStateStore - uses Set objects which can trigger React 19 snapshot issues
vi.mock('../stores/viewStateStore', () => {
  const selectedNodeIds = new Set<string>();
  const selectedWireIds = new Set<string>();
  const autoProbedNodes = new Set<string>();
  const mockViewState = {
    selectedNodeIds,
    selectedWireIds,
    hoveredNodeId: null as string | null,
    highlightedNodeId: null as string | null,
    focusNodeId: null as string | null,
    focusRequestId: 0,
    autoProbedNodes,
    autoProbeEnabled: false,
    highlightProbePaths: true,
    splitScreenMode: 'single' as const,
    activeViews: ['circuit'] as ('circuit' | 'schematic' | 'oscilloscope' | '3d')[],
    circuitViewSize: null as { width: number; height: number } | null,
    selectNodes: vi.fn(),
    selectWires: vi.fn(),
    clearSelection: vi.fn(),
    setHoveredNode: vi.fn(),
    setHighlightedNode: vi.fn(),
    requestFocusNode: vi.fn(),
    toggleAutoProbe: vi.fn(),
    setAutoProbeEnabled: vi.fn(),
    setHighlightProbePaths: vi.fn(),
    clearAutoProbes: vi.fn(),
    setSplitScreenMode: vi.fn(),
    setActiveViews: vi.fn(),
    setCircuitViewSize: vi.fn(),
  };
  return {
    useViewStateStore: Object.assign(
      (selector?: (state: typeof mockViewState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockViewState) : mockViewState,
      {
        getState: () => mockViewState,
        setState: vi.fn((partial: Partial<typeof mockViewState>) => {
          Object.assign(mockViewState, partial);
        }),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock probeStore - depends on viewStateStore
vi.mock('../stores/probeStore', () => {
  interface Probe {
    id: string;
    nodeId: string;
    portName: string;
    label: string;
    color: string;
    enabled: boolean;
  }
  let probes: Probe[] = [];
  let activeProbeId: string | null = null;
  const mockProbeState = {
    get probes() {
      return probes;
    },
    get activeProbeId() {
      return activeProbeId;
    },
    addProbe: vi.fn(),
    removeProbe: vi.fn(),
    renameProbe: vi.fn(),
    toggleProbe: vi.fn(),
    setActiveProbe: vi.fn(),
    clearProbes: vi.fn(),
    setProbes: vi.fn(),
    toggleProbeForPort: vi.fn(),
    hasProbe: vi.fn(() => false),
    reorderProbes: vi.fn(),
  };
  return {
    useProbeStore: Object.assign(
      (selector?: (state: typeof mockProbeState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockProbeState) : mockProbeState,
      {
        getState: () => mockProbeState,
        setState: vi.fn((partial: Partial<{ probes: Probe[]; activeProbeId: string | null }>) => {
          if (partial.probes !== undefined) probes = partial.probes;
          if (partial.activeProbeId !== undefined) activeProbeId = partial.activeProbeId;
        }),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock oscilloscopeStore
vi.mock('../stores/oscilloscopeStore', () => {
  const mockOscilloscopeState = {
    pauseScroll: false,
    showTimeCursor: true,
    timeWindowSec: 10,
    showTickGuides: true,
    clearRequestId: 0,
    setPauseScroll: vi.fn(),
    togglePauseScroll: vi.fn(),
    setShowTimeCursor: vi.fn(),
    toggleTimeCursor: vi.fn(),
    setTimeWindowSec: vi.fn(),
    setShowTickGuides: vi.fn(),
    requestClear: vi.fn(),
  };
  return {
    useOscilloscopeStore: Object.assign(
      (selector?: (state: typeof mockOscilloscopeState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockOscilloscopeState) : mockOscilloscopeState,
      {
        getState: () => mockOscilloscopeState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

describe('View micro toolbars', () => {
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
