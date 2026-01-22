// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CircuitEngine, type Circuit } from '@redbyte/rb-logic-core';
import { OscilloscopeView } from '../components/OscilloscopeView';

// Mock @redbyte/rb-utils to prevent useUiTickStore RAF loop
// All mock state MUST be inside factory due to vi.mock hoisting
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

// Mock viewStateStore - uses Set objects which can trigger React 19 snapshot issues
vi.mock('../stores/viewStateStore', () => {
  // Stable references created once in factory
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

// Mock probeStore - depends on viewStateStore, creates arrays
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
  let probeIdCounter = 0;

  const mockProbeState = {
    get probes() {
      return probes;
    },
    get activeProbeId() {
      return activeProbeId;
    },
    addProbe: vi.fn(({ nodeId, portName, label }: { nodeId: string; portName: string; label: string }) => {
      const id = `probe-${++probeIdCounter}`;
      probes = [...probes, { id, nodeId, portName, label, color: '#00ffff', enabled: true }];
      activeProbeId = id;
      return id;
    }),
    removeProbe: vi.fn((id: string) => {
      probes = probes.filter((p) => p.id !== id);
      if (activeProbeId === id) activeProbeId = null;
    }),
    renameProbe: vi.fn(),
    toggleProbe: vi.fn((id: string) => {
      probes = probes.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    }),
    setActiveProbe: vi.fn((id: string | null) => {
      activeProbeId = id;
    }),
    clearProbes: vi.fn(() => {
      probes = [];
      activeProbeId = null;
    }),
    setProbes: vi.fn(),
    toggleProbeForPort: vi.fn(),
    hasProbe: vi.fn(() => false),
    reorderProbes: vi.fn(),
  };

  const resetMockState = () => {
    probes = [];
    activeProbeId = null;
    probeIdCounter = 0;
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
        _reset: resetMockState,
      }
    ),
  };
});

// Mock oscilloscopeStore
vi.mock('../stores/oscilloscopeStore', () => {
  let pauseScroll = false;
  let showTimeCursor = true;
  let timeWindowSec = 10;
  let showTickGuides = true;
  let clearRequestId = 0;

  const mockOscilloscopeState = {
    get pauseScroll() {
      return pauseScroll;
    },
    get showTimeCursor() {
      return showTimeCursor;
    },
    get timeWindowSec() {
      return timeWindowSec;
    },
    get showTickGuides() {
      return showTickGuides;
    },
    get clearRequestId() {
      return clearRequestId;
    },
    setPauseScroll: vi.fn((enabled: boolean) => {
      pauseScroll = enabled;
    }),
    togglePauseScroll: vi.fn(() => {
      pauseScroll = !pauseScroll;
    }),
    setShowTimeCursor: vi.fn((enabled: boolean) => {
      showTimeCursor = enabled;
    }),
    toggleTimeCursor: vi.fn(() => {
      showTimeCursor = !showTimeCursor;
    }),
    setTimeWindowSec: vi.fn((seconds: number) => {
      timeWindowSec = Math.max(1, Math.min(10, Math.round(seconds)));
    }),
    setShowTickGuides: vi.fn((enabled: boolean) => {
      showTickGuides = enabled;
    }),
    requestClear: vi.fn(() => {
      clearRequestId++;
    }),
  };

  const resetMockState = () => {
    pauseScroll = false;
    showTimeCursor = true;
    timeWindowSec = 10;
    showTickGuides = true;
    clearRequestId = 0;
  };

  return {
    useOscilloscopeStore: Object.assign(
      (selector?: (state: typeof mockOscilloscopeState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockOscilloscopeState) : mockOscilloscopeState,
      {
        getState: () => mockOscilloscopeState,
        setState: vi.fn(
          (
            partial: Partial<{
              pauseScroll: boolean;
              showTimeCursor: boolean;
              clearRequestId: number;
            }>
          ) => {
            if (partial.pauseScroll !== undefined) pauseScroll = partial.pauseScroll;
            if (partial.showTimeCursor !== undefined) showTimeCursor = partial.showTimeCursor;
            if (partial.clearRequestId !== undefined) clearRequestId = partial.clearRequestId;
          }
        ),
        subscribe: vi.fn(() => vi.fn()),
        _reset: resetMockState,
      }
    ),
  };
});

// Import mocked stores after vi.mock declarations
import { useProbeStore } from '../stores/probeStore';
import { useOscilloscopeStore } from '../stores/oscilloscopeStore';

const createCircuit = (): Circuit => ({
  nodes: [
    {
      id: 'switch1',
      type: 'Switch',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 1 },
    },
  ],
  connections: [],
});


const createMockTickEngine = () => {
  let tickCount = 0;
  const traces: Array<{
    tick: number;
    timestamp: number;
    signals: Map<string, 0 | 1>;
    nodeStates: Map<string, Record<string, any>>;
    changedNodes: string[];
  }> = [];

  const mockTraceRecorder = {
    getAllTraces: () => traces,
    isActive: () => true,
    start: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(() => {
      traces.length = 0;
    }),
    getStats: () => ({
      totalTicks: traces.length,
      totalChanges: 0,
      memoryUsage: 0,
    }),
  };

  return {
    getTraceRecorder: () => mockTraceRecorder,
    enableTracing: vi.fn(),
    getTickCount: () => tickCount,
    getTickRate: () => 20,
    // Simulate ticks happening when time advances
    _simulateTick: () => {
      tickCount++;
      traces.push({
        tick: tickCount,
        timestamp: Date.now(),
        signals: new Map([['switch1.out', 1]]),
        nodeStates: new Map(),
        changedNodes: ['switch1'],
      });
      // Keep only last 100 traces
      if (traces.length > 100) {
        traces.shift();
      }
    },
  } as any;
};

const getCanvas = () => screen.getByTestId('oscilloscope-canvas');

const getNumericAttr = (attr: string) => Number(getCanvas().getAttribute(attr));

describe('Oscilloscope controls', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

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

    // Reset mocked stores
    (useProbeStore as any)._reset?.();
    (useOscilloscopeStore as any)._reset?.();
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.useRealTimers();
  });

  it('keeps sampling when pause scroll is enabled', () => {
    const circuit = createCircuit();
    const engine = new CircuitEngine(circuit);
    const tickEngine = createMockTickEngine();

    useProbeStore.getState().addProbe({
      nodeId: 'switch1',
      portName: 'out',
      label: 'Switch out',
    });

    render(
      <OscilloscopeView
        engine={engine}
        tickEngine={tickEngine}
        circuit={circuit}
        isRunning={true}
      />
    );

    act(() => {
      // Simulate 4 ticks (200ms / 50ms per tick)
      for (let i = 0; i < 4; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(200);
    });

    const beforePauseSamples = getNumericAttr('data-total-samples');

    act(() => {
      screen.getByText('Pause Scroll').click();
      // Simulate 4 more ticks
      for (let i = 0; i < 4; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(200);
    });

    const afterPauseSamples = getNumericAttr('data-total-samples');
    expect(afterPauseSamples).toBeGreaterThan(beforePauseSamples);
  });

  it('prevents auto-follow while paused', () => {
    const circuit = createCircuit();
    const engine = new CircuitEngine(circuit);
    const tickEngine = createMockTickEngine();

    useProbeStore.getState().addProbe({
      nodeId: 'switch1',
      portName: 'out',
      label: 'Switch out',
    });

    render(
      <OscilloscopeView
        engine={engine}
        tickEngine={tickEngine}
        circuit={circuit}
        isRunning={true}
      />
    );

    act(() => {
      for (let i = 0; i < 4; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(200);
      screen.getByText('Pause Scroll').click();
    });

    const pausedEndTime = getNumericAttr('data-view-end-time');

    act(() => {
      for (let i = 0; i < 4; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(200);
    });

    const afterPauseEndTime = getNumericAttr('data-view-end-time');
    expect(afterPauseEndTime).toBe(pausedEndTime);
  });

  it('updates the time cursor in live mode', () => {
    const circuit = createCircuit();
    const engine = new CircuitEngine(circuit);
    const tickEngine = createMockTickEngine();

    useProbeStore.getState().addProbe({
      nodeId: 'switch1',
      portName: 'out',
      label: 'Switch out',
    });

    render(
      <OscilloscopeView
        engine={engine}
        tickEngine={tickEngine}
        circuit={circuit}
        isRunning={true}
      />
    );

    act(() => {
      for (let i = 0; i < 4; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(200);
    });

    const beforeNowTime = getNumericAttr('data-now-time');

    act(() => {
      for (let i = 0; i < 4; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(200);
    });

    const afterNowTime = getNumericAttr('data-now-time');
    expect(afterNowTime).toBeGreaterThan(beforeNowTime);
  });

  it('does not reset buffers when toggling pause scroll', () => {
    const circuit = createCircuit();
    const engine = new CircuitEngine(circuit);
    const tickEngine = createMockTickEngine();

    useProbeStore.getState().addProbe({
      nodeId: 'switch1',
      portName: 'out',
      label: 'Switch out',
    });

    render(
      <OscilloscopeView
        engine={engine}
        tickEngine={tickEngine}
        circuit={circuit}
        isRunning={true}
      />
    );

    act(() => {
      for (let i = 0; i < 4; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(200);
    });

    const samplesBeforeToggle = getNumericAttr('data-total-samples');

    act(() => {
      screen.getByText('Pause Scroll').click();
      screen.getByText('Pause Scroll').click();
      for (let i = 0; i < 2; i++) {
        tickEngine._simulateTick();
      }
      vi.advanceTimersByTime(100);
    });

    const samplesAfterToggle = getNumericAttr('data-total-samples');
    expect(samplesAfterToggle).toBeGreaterThanOrEqual(samplesBeforeToggle);
  });
});
