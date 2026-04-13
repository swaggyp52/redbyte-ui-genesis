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

// ─── Fixtures (matches workstation test exactly) ───────────────────────────────

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
    tick: 6,
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
      { tick: 5, signals: { 'sw0_node.out': 0, 'ld0_node.in': 0 } },
      { tick: 6, signals: { 'sw0_node.out': 1, 'ld0_node.in': 1 } },
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

function makeReplaySession() {
  return {
    waveform: [
      { tick: 1, signals: { 'sw0_node.out': '0', 'ld0_node.in': '0', phase_driver: '0' }, mismatches: [] },
      { tick: 3, signals: { 'sw0_node.out': '1', 'ld0_node.in': '1', phase_driver: '1' }, mismatches: [] },
      { tick: 5, signals: { 'sw0_node.out': '0', 'ld0_node.in': '1', phase_driver: '0' }, mismatches: [] },
      { tick: 7, signals: { 'sw0_node.out': '1', 'ld0_node.in': '0', phase_driver: '1' }, mismatches: [] },
    ],
    meta: {
      circuitKind: 'sequential' as const,
      clockingProtocol: 'clocked_macro' as const,
      samplePoint: 'post-rising-edge' as const,
      tick0Meaning: 'initial-state' as const,
      clockSignalName: 'phase_driver',
    },
  };
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

// ─── Duplicate — Ctrl+D keyboard shortcut ─────────────────────────────────────

describe('DesignSurface duplicate — Ctrl+D shortcut', () => {
  it('duplicates the selected node when Ctrl+D is pressed', async () => {
    const onCircuitMutated = vi.fn();
    renderSurface({ onCircuitMutated });

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    const before = useCircuitStore.getState().circuit.nodes.length;

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBeGreaterThan(before);
    });
    expect(onCircuitMutated).toHaveBeenCalled();
    expect(onCircuitMutated.mock.lastCall?.[0]).toEqual(useCircuitStore.getState().circuit);
  });

  it('Ctrl+D with no selection is a no-op', async () => {
    const onCircuitMutated = vi.fn();
    renderSurface({ onCircuitMutated });

    // No selection — store has empty set from beforeEach
    const before = useCircuitStore.getState().circuit.nodes.length;

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(useCircuitStore.getState().circuit.nodes.length).toBe(before);
    expect(onCircuitMutated).not.toHaveBeenCalled();
  });

  it('Cmd+D (metaKey) also duplicates on Mac', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    const before = useCircuitStore.getState().circuit.nodes.length;

    act(() => {
      fireEvent.keyDown(window, { metaKey: true, key: 'd' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBeGreaterThan(before);
    });
  });

  it('duplicated nodes become the active selection', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBeGreaterThan(2);
    });

    // The new node should now be selected; sw0_node itself should be deselected
    const selectedNodes = useLogicViewStore.getState().selection.nodes;
    expect(selectedNodes.has('sw0_node')).toBe(false);
    expect(selectedNodes.size).toBeGreaterThan(0);
  });

  it('shows a Duplicated toast after Ctrl+D', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await waitFor(() => {
      const toast = view.queryByTestId('ide-design-action-toast');
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toMatch(/Duplicated \d+ node/i);
    });
  });
});

// ─── Duplicate — inspector button ─────────────────────────────────────────────

describe('DesignSurface duplicate — inspector button', () => {
  it('shows Duplicate button next to Copy when a node is selected', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    // First confirm the selection inspector itself is rendering (same pattern as workstation test)
    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    // Both Copy and Duplicate should be visible in the inspector
    expect(view.getByTestId('ide-design-copy-btn')).toBeTruthy();
    expect(view.getByTestId('ide-design-duplicate-btn')).toBeTruthy();
  });

  it('duplicates the selected node via the inspector Duplicate button', async () => {
    const onCircuitMutated = vi.fn();
    const view = renderSurface({ onCircuitMutated });

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    const before = useCircuitStore.getState().circuit.nodes.length;

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-duplicate-btn'));
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBeGreaterThan(before);
    });
    expect(onCircuitMutated).toHaveBeenCalled();
    expect(onCircuitMutated.mock.lastCall?.[0]).toEqual(useCircuitStore.getState().circuit);
  });

  it('shows Duplicate (N) in multi-select panel', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-summary')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-duplicate-btn')).toBeTruthy();
    expect(view.getByTestId('ide-design-duplicate-btn').textContent).toContain('2');
  });

  it('duplicating multiple nodes via button adds all of them to circuit', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-summary')).toBeTruthy();
    });

    const before = useCircuitStore.getState().circuit.nodes.length;

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-duplicate-btn'));
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(before + 2);
    });
  });
});

describe('DesignSurface replay invalidation', () => {
  it('marks replay stale and clears frozen replay authority after a circuit mutation', async () => {
    const onCircuitMutated = vi.fn();
    const onClearExternalDebug = vi.fn();
    const view = renderSurface({
      onCircuitMutated,
      onClearExternalDebug,
      externalDebugTick: 3,
      externalDebugSignals: new Map<string, 0 | 1>([
        ['sw0_node.out', 1],
        ['ld0_node.in', 1],
      ]),
      externalDebugContext: {
        signal: 'LD0',
        tick: 3,
        expected: '1',
        actual: '0',
        inputSnapshot: [{ label: 'SW0', value: '1' }],
      },
      replaySession: makeReplaySession(),
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-banner')).toBeTruthy();
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await waitFor(() => {
      expect(onCircuitMutated).toHaveBeenCalled();
      expect(onClearExternalDebug).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('ide-design-replay-stale-banner')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-debug-banner')).toBeNull();
    expect(view.getByTestId('ide-design-replay-stale-banner').textContent).toContain('Replay stale');
    expect(view.getByTestId('ide-design-replay-stale-banner').textContent).toContain('2 / 4');
    expect(view.getByTestId('ide-design-replay-stale-banner').textContent).toContain('t3');
    expect(view.getByTestId('ide-design-replay-stale-banner').textContent).toContain('phase_driver');
    expect(view.queryByTestId('ide-design-sim-run')).toBeNull();
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('Paused');
  });
});

describe('DesignSurface history routing', () => {
  it('routes undo and redo requests through runtime callbacks', () => {
    const onRuntimeUndo = vi.fn();
    const onRuntimeRedo = vi.fn();
    const view = renderSurface({
      onRuntimeUndo,
      onRuntimeRedo,
      runtimeUndoDepth: 2,
      runtimeRedoDepth: 1,
    });

    fireEvent.click(view.getByTestId('ide-design-tool-undo'));
    fireEvent.click(view.getByTestId('ide-design-tool-redo'));

    expect(onRuntimeUndo).toHaveBeenCalledTimes(1);
    expect(onRuntimeRedo).toHaveBeenCalledTimes(1);
  });

  it('marks replay stale when undo mutates the design during replay', async () => {
    const onRuntimeUndo = vi.fn();
    const onCircuitMutated = vi.fn();
    const onClearExternalDebug = vi.fn();
    const view = renderSurface({
      onRuntimeUndo,
      onCircuitMutated,
      onClearExternalDebug,
      runtimeUndoDepth: 1,
      externalDebugTick: 3,
      externalDebugSignals: new Map<string, 0 | 1>([
        ['sw0_node.out', 1],
        ['ld0_node.in', 1],
      ]),
      replaySession: makeReplaySession(),
      debugTickIndex: 1,
      debugTickCount: 4,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-debug-banner')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-tool-undo'));

    await waitFor(() => {
      expect(onRuntimeUndo).toHaveBeenCalledTimes(1);
      expect(onCircuitMutated).toHaveBeenCalledTimes(1);
      expect(onClearExternalDebug).toHaveBeenCalledTimes(1);
      expect(view.getByTestId('ide-design-replay-stale-banner')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-debug-banner')).toBeNull();
  });
});
