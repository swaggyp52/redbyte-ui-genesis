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

function makeReplaySession(
  waveform: Array<{
    tick: number;
    signals: Record<string, string>;
  }> = [
    { tick: 0, signals: { 'sw0_node.out': '0', 'ld0_node.in': '0' } },
    { tick: 1, signals: { 'sw0_node.out': '1', 'ld0_node.in': '1' } },
  ],
  metaOverrides: Partial<{
    circuitKind: 'sequential' | 'combinational';
    clockingProtocol: 'clocked_macro' | null;
    samplePoint: 'post-rising-edge' | 'steady-state' | null;
    tick0Meaning: 'reset-phase' | 'initial-state' | null;
    clockSignalName: string | null;
  }> = {}
) {
  return {
    waveform: waveform.map((sample) => ({
      tick: sample.tick,
      signals: { ...sample.signals },
      mismatches: [],
    })),
    meta: {
      circuitKind: 'combinational' as const,
      clockingProtocol: null,
      samplePoint: 'steady-state' as const,
      tick0Meaning: null,
      clockSignalName: null,
      ...metaOverrides,
    },
  };
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

  it('folds replay context into signal/state so Design mirrors the selected Verify case', async () => {
    const view = renderSurface({
      externalDebugTick: 1,
      externalDebugSignals: makeDebugSignals(),
      replaySession: makeReplaySession(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
      debugTickIndex: 1,
      debugTickCount: 2,
    });

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-inspector')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-replay-context-inspector')).toBeNull();
    expect(view.getByTestId('ide-design-context-inspector').textContent).toContain('Selected case');
    expect(view.getByTestId('ide-design-context-inspector').textContent).toContain('t1');
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
      const pos = view.getByTestId('ide-design-replay-scrubber-readout');
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

describe('DesignSurface debug nav — replay authority', () => {
  it('lets the replay strip own case-aware copy when the scrubber is active', async () => {
    const view = renderSurface({
      externalDebugTick: 3,
      externalDebugSignals: makeDebugSignals(),
      replaySession: makeReplaySession(
        [
          { tick: 1, signals: { 'sw0_node.out': '0', 'ld0_node.in': '0' } },
          { tick: 3, signals: { 'sw0_node.out': '1', 'ld0_node.in': '1' } },
          { tick: 5, signals: { 'sw0_node.out': '0', 'ld0_node.in': '1' } },
          { tick: 7, signals: { 'sw0_node.out': '1', 'ld0_node.in': '0' } },
        ],
        {
          circuitKind: 'sequential',
          clockingProtocol: 'clocked_macro',
          samplePoint: 'post-rising-edge',
          tick0Meaning: 'initial-state',
          clockSignalName: 'phase_driver',
        }
      ),
      debugTickIndex: 1,
      debugTickCount: 4,
      onSelectDebugTickIndex: vi.fn(),
      onPrevDebugTick: vi.fn(),
      onNextDebugTick: vi.fn(),
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sim-story-strip')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-debug-banner')).toBeNull();
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('Case 2 / 4');
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('t3');
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('phase_driver');
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('post-rising-edge');
    expect(view.getByTestId('ide-design-replay-scrubber-readout').textContent).toContain('2 / 4');
  });

  it('shows replay tick and replay mode in the simulation strip', async () => {
    const view = renderSurface({
      externalDebugTick: 7,
      externalDebugSignals: makeDebugSignals(),
      runtimeSim: {
        ...makeRuntimeSim(),
        tick: 2,
        running: true,
      },
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sim-story-strip')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-sim-story-tick').textContent).toContain('7');
    expect(view.getByTestId('ide-design-sim-story-tick').textContent).not.toContain('2');
    expect(view.getByTestId('ide-design-sim-story-mode').textContent).toBe('Replay');
  });

  it('shows case-aware replay labeling and sample timing in the simulation strip', async () => {
    const view = renderSurface({
      externalDebugTick: 3,
      externalDebugSignals: makeDebugSignals(),
      replaySession: makeReplaySession(
        [
          { tick: 1, signals: { 'sw0_node.out': '0', 'ld0_node.in': '0' } },
          { tick: 3, signals: { 'sw0_node.out': '1', 'ld0_node.in': '1' } },
          { tick: 5, signals: { 'sw0_node.out': '0', 'ld0_node.in': '1' } },
          { tick: 7, signals: { 'sw0_node.out': '1', 'ld0_node.in': '0' } },
        ],
        {
          circuitKind: 'sequential',
          clockingProtocol: 'clocked_macro',
          samplePoint: 'post-rising-edge',
          tick0Meaning: 'initial-state',
          clockSignalName: 'phase_driver',
        }
      ),
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sim-story-strip')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-sim-story-tick').textContent).toContain('Case 2 / 4');
    expect(view.getByTestId('ide-design-sim-story-tick').textContent).toContain('t3');
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain(
      'Sampled post-rising-edge on phase_driver.'
    );
  });

  it('renders a dedicated replay scrubber with compact transport copy instead of repeating replay labels', async () => {
    const view = renderSurface({
      externalDebugTick: 3,
      externalDebugSignals: makeDebugSignals(),
      replaySession: makeReplaySession(
        [
          { tick: 1, signals: { 'sw0_node.out': '0', 'ld0_node.in': '0' } },
          { tick: 3, signals: { 'sw0_node.out': '1', 'ld0_node.in': '1' } },
          { tick: 5, signals: { 'sw0_node.out': '0', 'ld0_node.in': '1' } },
          { tick: 7, signals: { 'sw0_node.out': '1', 'ld0_node.in': '0' } },
        ],
        {
          circuitKind: 'sequential',
          clockingProtocol: 'clocked_macro',
          samplePoint: 'post-rising-edge',
          tick0Meaning: 'initial-state',
          clockSignalName: 'phase_driver',
        }
      ),
      debugTickIndex: 1,
      debugTickCount: 4,
      onSelectDebugTickIndex: vi.fn(),
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-replay-scrubber')).toBeTruthy();
    });

    const scrubber = view.getByTestId('ide-design-replay-scrubber') as HTMLInputElement;
    expect(scrubber.min).toBe('0');
    expect(scrubber.max).toBe('3');
    expect(scrubber.value).toBe('1');
    expect(view.getByTestId('ide-design-replay-transport')).toContainElement(scrubber);

    const stripText = view.getByTestId('ide-design-sim-story-strip').textContent ?? '';
    expect((stripText.match(/Replay/g) ?? []).length).toBe(1);
    expect((stripText.match(/Case 2 \/ 4/g) ?? []).length).toBe(1);
    expect((stripText.match(/t3/g) ?? []).length).toBe(1);
    expect(view.getByTestId('ide-design-replay-scrubber-readout').textContent).toBe('2 / 4');
  });

  it('routes replay scrubber changes through the parent-owned index callback', async () => {
    const onSelectDebugTickIndex = vi.fn();
    const view = renderSurface({
      externalDebugTick: 3,
      externalDebugSignals: makeDebugSignals(),
      replaySession: makeReplaySession(
        [
          { tick: 1, signals: { 'sw0_node.out': '0', 'ld0_node.in': '0' } },
          { tick: 3, signals: { 'sw0_node.out': '1', 'ld0_node.in': '1' } },
          { tick: 5, signals: { 'sw0_node.out': '0', 'ld0_node.in': '1' } },
          { tick: 7, signals: { 'sw0_node.out': '1', 'ld0_node.in': '0' } },
        ],
        {
          circuitKind: 'sequential',
          clockingProtocol: 'clocked_macro',
          samplePoint: 'post-rising-edge',
          tick0Meaning: 'initial-state',
          clockSignalName: 'phase_driver',
        }
      ),
      debugTickIndex: 1,
      debugTickCount: 4,
      onSelectDebugTickIndex,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-replay-scrubber')).toBeTruthy();
    });

    act(() => {
      fireEvent.change(view.getByTestId('ide-design-replay-scrubber'), { target: { value: '2' } });
    });

    expect(onSelectDebugTickIndex).toHaveBeenCalledWith(2);
  });

  it('describes the selected replay tick from Verify waveform history', async () => {
    const view = renderSurface({
      externalDebugTick: 1,
      externalDebugSignals: new Map<string, 0 | 1>([
        ['sw0_node.out', 1],
        ['ld0_node.in', 1],
      ]),
      replaySession: makeReplaySession(),
      runtimeSim: {
        ...makeRuntimeSim(),
        tick: 2,
        running: false,
      },
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sim-story-summary')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-sim-story-summary').textContent).toBe(
      'Inputs SW0→1; outputs LD0→1 at tick 1.'
    );
  });

  it('shows replay output values in the Signal / State inspector', async () => {
    const view = renderSurface({
      externalDebugTick: 5,
      externalDebugSignals: new Map<string, 0 | 1>([
        ['sw0_node.out', 1],
        ['ld0_node.in', 1],
      ]),
      runtimeSim: {
        ...makeRuntimeSim(),
        signals: {
          'sw0_node.out': 0,
          'ld0_node.in': 0,
        },
      },
    });

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-current').textContent).toBe('1');
    });

    expect(view.getByTestId('ide-design-context-current').textContent).toBe('1');
  });

  it('renders the on-canvas switch widget from the selected replay case, not persisted live node state', async () => {
    const view = renderSurface({
      externalDebugTick: 1,
      externalDebugSignals: new Map<string, 0 | 1>([
        ['sw0_node.out', 0],
        ['ld0_node.in', 0],
      ]),
      replaySession: makeReplaySession([
        { tick: 0, signals: { 'sw0_node.out': '1', 'ld0_node.in': '1' } },
        { tick: 1, signals: { 'sw0_node.out': '0', 'ld0_node.in': '0' } },
      ]),
      debugTickIndex: 1,
      debugTickCount: 2,
      onSelectDebugTickIndex: vi.fn(),
    });

    await waitFor(() => {
      expect(view.getByTestId('switch-toggle-sw0_node-container')).toBeTruthy();
    });

    expect(view.getByTestId('switch-toggle-sw0_node-container').textContent).toContain('SW0 OFF');
    expect(view.getByTestId('switch-toggle-sw0_node-container').textContent).not.toContain('SW0 ON');
  });

  it('renders the on-canvas clock widget from the selected replay case, not persisted live node state', async () => {
    useCircuitStore.setState({
      circuit: {
        nodes: [
          {
            id: 'clk_node',
            type: 'INPUT',
            label: 'CLK',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
            state: { isOn: 0 },
          },
          {
            id: 'q_out',
            type: 'OUTPUT',
            label: 'Q',
            position: { x: 180, y: 0 },
            rotation: 0,
            config: {},
            state: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'clk_node', portName: 'out' },
            to: { nodeId: 'q_out', portName: 'in' },
          },
        ],
      },
      isDirty: false,
      past: [],
      future: [],
    });

    const view = render(
      <DesignSurface
        runtimeSim={{
          ...makeRuntimeSim(),
          inputs: { clk_node: 0 },
          signals: {
            'clk_node.out': 0,
            'q_out.in': 0,
          },
          trace: [
            { tick: 0, signals: { 'clk_node.out': 0, 'q_out.in': 0 } },
            { tick: 1, signals: { 'clk_node.out': 1, 'q_out.in': 1 } },
          ],
        }}
        ioRows={[
          { id: 'clk', nodeId: 'clk_node', label: 'CLK', pin: 'W5', port: 'out', direction: 'in' },
          { id: 'q', nodeId: 'q_out', label: 'Q', pin: 'U16', port: 'in', direction: 'out' },
        ]}
        onRuntimeSimRun={vi.fn()}
        onRuntimeSimPause={vi.fn()}
        onRuntimeSimStep={vi.fn()}
        onRuntimeSimReset={vi.fn()}
        onRuntimeSimSetSpeed={vi.fn()}
        onRuntimeSimToggleProbe={vi.fn()}
        onGoToProject={vi.fn()}
        onGoToVerify={vi.fn()}
        externalDebugTick={1}
        externalDebugSignals={new Map<string, 0 | 1>([
          ['clk_node.out', 1],
          ['q_out.in', 1],
        ])}
        replaySession={makeReplaySession([
          { tick: 0, signals: { 'clk_node.out': '0', 'q_out.in': '0' } },
          { tick: 1, signals: { 'clk_node.out': '1', 'q_out.in': '1' } },
        ])}
        debugTickIndex={1}
        debugTickCount={2}
        onSelectDebugTickIndex={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('switch-toggle-clk_node-container')).toBeTruthy();
    });

    expect(view.getByTestId('switch-toggle-clk_node-container').textContent).toContain('W5 1');
    expect(view.getByTestId('switch-toggle-clk_node-container').textContent).not.toContain('W5 0');
  });

  it('removes live simulation inspector chrome while replay is active', async () => {
    const onRun = vi.fn();
    const onStep = vi.fn();
    const onReset = vi.fn();
    const view = render(
      <DesignSurface
        runtimeSim={makeRuntimeSim()}
        ioRows={[
          { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'V17', port: 'out', direction: 'in' },
          { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' },
        ]}
        onRuntimeSimRun={onRun}
        onRuntimeSimPause={vi.fn()}
        onRuntimeSimStep={onStep}
        onRuntimeSimReset={onReset}
        onRuntimeSimSetSpeed={vi.fn()}
        onRuntimeSimToggleProbe={vi.fn()}
        onGoToProject={vi.fn()}
        onGoToVerify={vi.fn()}
        externalDebugTick={4}
        externalDebugSignals={makeDebugSignals()}
      />
    );

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-identity-title')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-live-sim-section')).toBeNull();

    expect(onRun).not.toHaveBeenCalled();
    expect(onStep).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });
});
