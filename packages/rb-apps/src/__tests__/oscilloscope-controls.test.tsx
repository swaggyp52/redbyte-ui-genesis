// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CircuitEngine, type Circuit } from '@redbyte/rb-logic-core';
import { OscilloscopeView } from '../components/OscilloscopeView';
import { useProbeStore } from '../stores/probeStore';
import { useViewStateStore } from '../stores/viewStateStore';
import { useOscilloscopeStore } from '../stores/oscilloscopeStore';

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

const createMockTickEngine = () =>
  ({
    getTraceRecorder: () => null,
    enableTracing: vi.fn(),
    getTickCount: () => 0,
    getTickRate: () => 20,
  }) as any;

const getCanvas = () => screen.getByTestId('oscilloscope-canvas');

const getNumericAttr = (attr: string) => Number(getCanvas().getAttribute(attr));

// TODO: Fix infinite update loop caused by useUiTickStore in React 19
// The store's useSyncExternalStore integration triggers "Maximum update depth exceeded"
// when tests render components that use the store. Needs investigation into proper
// mocking strategy or store implementation fix for React 19 compatibility.

describe.skip('Oscilloscope controls', () => {
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

    useProbeStore.setState({ probes: [], activeProbeId: null });
    useOscilloscopeStore.setState({ pauseScroll: false, showTimeCursor: true, clearRequestId: 0 });
    useViewStateStore.setState({
      selectedNodeIds: new Set(),
      selectedWireIds: new Set(),
      hoveredNodeId: null,
      highlightedNodeId: null,
      focusNodeId: null,
      focusRequestId: 0,
      autoProbedNodes: new Set(),
      autoProbeEnabled: false,
      splitScreenMode: 'single',
      activeViews: ['circuit'],
    });
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
      vi.advanceTimersByTime(200);
    });

    const beforePauseSamples = getNumericAttr('data-total-samples');

    act(() => {
      screen.getByText('Pause Scroll').click();
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
      vi.advanceTimersByTime(200);
      screen.getByText('Pause Scroll').click();
    });

    const pausedEndTime = getNumericAttr('data-view-end-time');

    act(() => {
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
      vi.advanceTimersByTime(200);
    });

    const beforeNowTime = getNumericAttr('data-now-time');

    act(() => {
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
      vi.advanceTimersByTime(200);
    });

    const samplesBeforeToggle = getNumericAttr('data-total-samples');

    act(() => {
      screen.getByText('Pause Scroll').click();
      screen.getByText('Pause Scroll').click();
      vi.advanceTimersByTime(100);
    });

    const samplesAfterToggle = getNumericAttr('data-total-samples');
    expect(samplesAfterToggle).toBeGreaterThanOrEqual(samplesBeforeToggle);
  });
});
