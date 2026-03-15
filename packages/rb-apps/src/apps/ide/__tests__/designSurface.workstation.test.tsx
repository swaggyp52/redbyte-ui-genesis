// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import type { MacroDefinition } from '../macros/MacroLibrary';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

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
      {
        tick: 5,
        signals: {
          'sw0_node.out': 0,
          'ld0_node.in': 0,
        },
      },
      {
        tick: 6,
        signals: {
          'sw0_node.out': 1,
          'ld0_node.in': 1,
        },
      },
    ],
    selectedSignalKey: null,
    probes: [],
  };
}

function installResizeObserver(width: number, height = 720) {
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
              width,
              height,
              x: 0,
              y: 0,
              top: 0,
              left: 0,
              bottom: height,
              right: width,
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

const FIXTURE_MACRO: MacroDefinition = {
  id: 'macro-and-gate',
  name: 'AND Gate',
  createdAt: 1710000000000,
  inputs: [
    { id: 'input:node-v2-1.a', label: 'A', nodeId: 'node-v2-1', portName: 'a' },
    { id: 'input:node-v2-1.b', label: 'B', nodeId: 'node-v2-1', portName: 'b' },
  ],
  outputs: [{ id: 'output:node-v2-1.out', label: 'Q', nodeId: 'node-v2-1', portName: 'out' }],
  cluster: {
    nodes: [
      {
        originalId: 'node-v2-1',
        type: 'AND',
        x: 0,
        y: 0,
        config: {},
        state: {},
      },
    ],
    connections: [],
  },
};

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

describe('DesignSurface workstation redesign', () => {
  it('shows contextual inspector data, trace actions, and a compact live state table', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-context-current').textContent).toBe('1');
    expect(view.getByTestId('ide-design-context-previous').textContent).toBe('0');
    expect(view.getByTestId('ide-design-context-transition').textContent).toContain('rising');
    expect(view.getByTestId('ide-design-context-last-transition').textContent).toBe('6');
    expect(view.getByTestId('ide-design-context-inspector').textContent).toContain('LD0 -> U16');
    expect(view.getByTestId('ide-design-shortcut-strip').textContent).toContain('Ctrl + wheel');
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('Tick 6');
    expect(view.getByTestId('ide-design-sim-story-summary').textContent).toContain('SW0');
    expect(view.getByTestId('ide-design-sim-story-summary').textContent).toContain('LD0');

    fireEvent.click(view.getByTestId('ide-design-context-trace'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('Fanin to ld0_node.in');
    });

    const liveSimSection = view.getByTestId('ide-design-live-sim-section');
    if (liveSimSection.getAttribute('data-open') === 'false') {
      fireEvent.click(view.getByTestId('ide-design-live-sim-section-toggle'));
    }

    await waitFor(() => {
      expect(view.getByTestId('ide-design-live-sim-section').textContent).toContain('Tick');
    });

    expect(view.getByTestId('ide-design-live-state-table').textContent).toContain('Inputs');
    expect(view.getByTestId('ide-design-live-state-table').textContent).toContain('Outputs');
  });

  it('bridges verify-selected signals back into Design focus and trace state', async () => {
    const setSelectedSignal = vi.fn();
    const view = renderSurface({
      activeVerifySignal: 'LD0',
      onRuntimeSimSetSelectedSignal: setSelectedSignal,
    });

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('ld0_node.in');
    });

    expect(view.getByTestId('ide-design-verify-link-badge').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-verify-focus').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-active-trace').textContent).toContain('Verify focus ld0_node.in');
  });

  it('restates verify mismatch context when opening frozen debug mode', () => {
    const view = renderSurface({
      externalDebugTick: 6,
      externalDebugSignals: new Map([
        ['sw0_node.out', 1],
        ['ld0_node.in', 0],
      ]),
      externalDebugContext: {
        signal: 'LD0',
        tick: 6,
        expected: '1',
        actual: '0',
        inputSnapshot: [{ label: 'SW0', value: '1' }],
        patternSummary: 'Output stayed low while the selected input was high.',
        nextInspect: 'Inspect the wire between SW0 and LD0.',
      },
    });

    expect(view.getByTestId('ide-design-debug-banner').textContent).toContain('tick 6');
    expect(view.getByTestId('ide-design-failure-brief').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-failure-brief').textContent).toContain('1');
    expect(view.getByTestId('ide-design-failure-brief').textContent).toContain('0');
    expect(view.getByTestId('ide-design-failure-brief-inputs').textContent).toContain('SW0=1');
    expect(view.getByTestId('ide-design-failure-brief-next').textContent).toContain('Inspect the wire between SW0 and LD0.');
    expect(view.getByTestId('ide-design-sim-story-summary').textContent).toContain('Verify expected LD0=1 but sampled 0 at tick 6.');
  });

  it('auto-demotes cramped split view into stacked mode', async () => {
    installResizeObserver(900);
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-view-split'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-workspace').getAttribute('data-design-view')).toBe('stacked');
    });

    expect(view.getByTestId('ide-design-shortcut-strip').textContent).toContain('Split stacked');
  });

  it('shows the save-as-macro action and dialog when multiple nodes are selected', async () => {
    const onSaveMacro = vi.fn();
    const view = renderSurface({
      macros: [],
      onSaveMacro,
    });

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-save-macro-open')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-save-macro-open'));

    expect(view.getByTestId('ide-macro-save-dialog')).toBeTruthy();
    expect(view.getByTestId('ide-macro-save-name')).toBeTruthy();
  });

  it('enters macro insertion mode from the library and instantiates on canvas click target', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));

    const overlay = view.getByTestId('ide-macro-insertion-overlay');
    expect(overlay.textContent).toContain('AND Gate');

    fireEvent.click(view.getByTestId('ide-design-live-canvas'), { clientX: 600, clientY: 320 });

    await waitFor(() => {
      expect(onInstantiateMacro).toHaveBeenCalledWith('macro-and-gate', expect.any(Object));
    });
  });

  it('keeps overlay click path working for macro placement', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    fireEvent.click(view.getByTestId('ide-macro-insertion-overlay'), { clientX: 640, clientY: 360 });

    await waitFor(() => {
      expect(onInstantiateMacro).toHaveBeenCalledWith('macro-and-gate', expect.any(Object));
    });
  });

  it('supports keyboard placement from the insertion overlay', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    const overlay = view.getByTestId('ide-macro-insertion-overlay');
    expect(overlay.getAttribute('role')).toBe('button');
    expect(overlay.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(overlay, { key: 'Enter' });

    await waitFor(() => {
      expect(onInstantiateMacro).toHaveBeenCalledWith('macro-and-gate', expect.any(Object));
    });
  });

  it('does not place when clicking placement overlay card UI', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    fireEvent.click(view.getByTestId('ide-macro-insertion-message'));

    expect(onInstantiateMacro).not.toHaveBeenCalled();
    expect(view.getByTestId('ide-macro-insertion-overlay')).toBeTruthy();
  });

  it('exits placement mode via cancel button without mutating the graph', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    expect(view.getByTestId('ide-macro-insertion-overlay')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-macro-insertion-cancel'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-macro-insertion-overlay')).toBeNull();
    });
    expect(onInstantiateMacro).not.toHaveBeenCalled();
  });

  it('exits placement mode via Escape without mutating the graph', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    expect(view.getByTestId('ide-macro-insertion-overlay')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(view.queryByTestId('ide-macro-insertion-overlay')).toBeNull();
    });
    expect(onInstantiateMacro).not.toHaveBeenCalled();
  });
});
