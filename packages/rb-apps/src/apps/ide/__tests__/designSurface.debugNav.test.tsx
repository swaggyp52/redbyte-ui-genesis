// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'sw0_node',
      type: 'INPUT',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 1 },
    },
    {
      id: 'ld0_node',
      type: 'OUTPUT',
      position: { x: 180, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    {
      from: { nodeId: 'sw0_node', portName: 'out' },
      to: { nodeId: 'ld0_node', portName: 'in' },
    },
  ],
};

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 2,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: { sw0_node: 1 },
    signals: {
      'sw0_node.out': 1,
      'ld0_node.in': 1,
    },
    trace: [
      { tick: 1, signals: { 'sw0_node.out': 0, 'ld0_node.in': 0 } },
      { tick: 2, signals: { 'sw0_node.out': 1, 'ld0_node.in': 1 } },
    ],
    selectedSignalKey: null,
    probes: [],
  };
}

function installResizeObserver(width = 1320, height = 720) {
  class ImmediateResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              width, height,
              x: 0, y: 0, top: 0, left: 0, bottom: height, right: width,
              toJSON: () => ({}),
            },
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
}

function makeDebugSignals(): Map<string, 0 | 1> {
  return new Map<string, 0 | 1>([
    ['sw0_node.out', 1],
    ['ld0_node.in', 0],
  ]);
}

function renderSurface(
  overrides: Partial<React.ComponentProps<typeof DesignSurface>> = {}
) {
  return render(
    <DesignSurface
      runtimeSim={makeRuntimeSim()}
      ioRows={[
        { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'V17', port: 'out', direction: 'in' },
        { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' },
      ]}
      onRuntimeSimRun={vi.fn()}
      onRuntimeSimPause={vi.fn()}
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
      onRuntimeSimSetSpeed={vi.fn()}
      onRuntimeSimToggleProbe={vi.fn()}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver(1320);
  useCircuitStore.getState().reset();
  useCircuitStore.setState({
    circuit: structuredClone(BASE_CIRCUIT),
    isDirty: false,
    past: [],
    future: [],
  });
  useLayoutStore.getState().resetLayout();
  useLogicViewStore.setState({
    camera: { x: 0, y: 0, zoom: 1 },
    selection: { nodes: new Set<string>(), wires: new Set<string>() },
    toolMode: 'select',
    interactionMode: 'idle',
    editingState: { isDragging: false },
    snapToGrid: true,
    gridSize: 16,
  });
});

afterEach(() => {
  cleanup();
});

// ─── Debug banner ─────────────────────────────────────────────────────────────

describe('DesignSurface debug nav — banner visibility', () => {
  it('shows debug banner when externalDebugTick is set', async () => {
    const view = renderSurface({
      externalDebugTick: 3,
      externalDebugSignals: makeDebugSignals(),
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-banner')).toBeTruthy();
    });
  });

  it('does not show debug banner when externalDebugTick is null', async () => {
    const view = renderSurface({ externalDebugTick: null });

    await waitFor(() => {
      expect(view.queryByTestId('ide-design-debug-banner')).toBeNull();
    });
  });

  it('shows tick number in the banner', async () => {
    const view = renderSurface({
      externalDebugTick: 5,
      externalDebugSignals: makeDebugSignals(),
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-banner').textContent).toContain('5');
    });
  });
});

// ─── Tick navigation controls ─────────────────────────────────────────────────

describe('DesignSurface debug nav — Prev/Next controls', () => {
  it('renders Prev and Next buttons when callbacks are provided', async () => {
    const view = renderSurface({
      externalDebugTick: 2,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-prev')).toBeTruthy();
      expect(view.getByTestId('ide-design-debug-next')).toBeTruthy();
    });
  });

  it('does not render nav controls when callbacks are absent', async () => {
    const view = renderSurface({
      externalDebugTick: 2,
      externalDebugSignals: makeDebugSignals(),
      // no onPrevDebugTick / onNextDebugTick
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-banner')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-debug-nav')).toBeNull();
  });

  it('shows tick position label', async () => {
    const view = renderSurface({
      externalDebugTick: 2,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    await waitFor(() => {
      const pos = view.getByTestId('ide-design-debug-tick-position');
      // 1-indexed: index 1 → "2 / 4"
      expect(pos.textContent).toContain('2 / 4');
    });
  });

  it('calls onPrevDebugTick when Prev is clicked', async () => {
    const onPrev = vi.fn();
    const view = renderSurface({
      externalDebugTick: 2,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: onPrev,
      onNextDebugTick: vi.fn(),
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-prev')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-debug-prev'));
    });

    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onNextDebugTick when Next is clicked', async () => {
    const onNext = vi.fn();
    const view = renderSurface({
      externalDebugTick: 2,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: onNext,
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-next')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-debug-next'));
    });

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

// ─── Disabled states at bounds ────────────────────────────────────────────────

describe('DesignSurface debug nav — disabled state at bounds', () => {
  it('Prev button is disabled at first tick (index 0)', async () => {
    const view = renderSurface({
      externalDebugTick: 0,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
      debugTickIndex: 0,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-prev')).toBeTruthy();
    });

    expect(
      (view.getByTestId('ide-design-debug-prev') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('Next button is disabled at last tick', async () => {
    const view = renderSurface({
      externalDebugTick: 3,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
      debugTickIndex: 3,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-next')).toBeTruthy();
    });

    expect(
      (view.getByTestId('ide-design-debug-next') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('Prev button is enabled when not at first tick', async () => {
    const view = renderSurface({
      externalDebugTick: 2,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
      debugTickIndex: 2,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-prev')).toBeTruthy();
    });

    expect(
      (view.getByTestId('ide-design-debug-prev') as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('Next button is enabled when not at last tick', async () => {
    const view = renderSurface({
      externalDebugTick: 1,
      externalDebugSignals: makeDebugSignals(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-next')).toBeTruthy();
    });

    expect(
      (view.getByTestId('ide-design-debug-next') as HTMLButtonElement).disabled
    ).toBe(false);
  });
});
