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

const BASE_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'sw0_node',
      type: 'INPUT',
      label: 'SW0',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 1 },
    },
    {
      id: 'and0_node',
      type: 'AND',
      position: { x: 100, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'ld0_node',
      type: 'OUTPUT',
      label: 'LD0',
      position: { x: 200, y: 0 },
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

const ISSUE_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'sw0_node',
      type: 'INPUT',
      label: 'SW0',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 1 },
    },
    {
      id: 'and0_node',
      type: 'AND',
      position: { x: 100, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'ld0_node',
      type: 'OUTPUT',
      label: 'LED0',
      position: { x: 210, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    {
      from: { nodeId: 'sw0_node', portName: 'out' },
      to: { nodeId: 'and0_node', portName: 'a' },
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
  circuit: Circuit,
  overrides: Partial<React.ComponentProps<typeof DesignSurface>> = {}
) {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(circuit), isDirty: false, past: [], future: [] });

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
  installResizeObserver();
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

describe('DesignSurface inspector hierarchy', () => {
  it('keeps the idle inspector secondary until opened, then focuses on identity while leaving live simulation reachable', async () => {
    const view = renderSurface(BASE_CIRCUIT);

    expect(view.queryByTestId('ide-inspector')).toBeNull();
    expect(view.getByTestId('ide-workbench-dock-toggle-right')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-workbench-dock-toggle-right'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-empty')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-inspector-health')).toBeNull();
    expect(view.queryByTestId('ide-design-inspector-actions')).toBeNull();
    expect(view.queryByTestId('ide-design-inspector-properties')).toBeNull();
    expect(view.queryByTestId('ide-design-context-inspector')).toBeNull();
    expect(view.queryByTestId('ide-design-board-signal')).toBeNull();
    expect(view.queryByTestId('ide-design-signal-probe')).toBeNull();
    expect(view.getByTestId('ide-design-inspector-next-step').textContent).not.toContain('Live Simulation');
    expect(view.queryByTestId('ide-design-live-sim-section')).toBeNull();
    expect(view.queryByTestId('ide-design-inspector-advanced')).toBeNull();
  });

  it('anchors selection identity with friendly title, subtitle, and student-safe reference metadata', async () => {
    const view = renderSurface(BASE_CIRCUIT);

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-identity-title').textContent).toBe('SW0');
    });

    expect(view.getByTestId('ide-design-inspector-identity-subtitle').textContent).toContain('Input');
    expect(view.getByTestId('ide-design-selection-type').textContent).toBe('Input');
    expect(view.getByTestId('ide-design-selection-id').textContent).toBe('SW0');
  });

  it('keeps identity facts inline and folds replay context into signal/state instead of a standalone inspector section', async () => {
    const view = renderSurface(BASE_CIRCUIT, {
      activeVerifySignal: 'ld0',
    });

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-inspector')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-replay-context-section')).toBeNull();
    expect(view.queryByTestId('ide-design-replay-context-inspector')).toBeNull();
    expect(view.container.querySelector('.ide-design-inspector-meta-grid')).toBeNull();
    expect(view.container.querySelectorAll('.ide-design-inspector-meta-card')).toHaveLength(0);
    expect(view.getByTestId('ide-design-context-inspector').textContent).toContain('Verify focus');
    expect(view.getByTestId('ide-design-context-inspector').textContent).toContain('ld0');
  });

  it('merges broken-selection guidance into the primary identity panel before signal/state metrics', async () => {
    const view = renderSurface(ISSUE_CIRCUIT);

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-guidance').textContent).toContain('Output not wired yet');
    });

    expect(view.queryByTestId('ide-design-inspector-health')).toBeNull();

    const health = view.getByTestId('ide-design-inspector-guidance');
    const identity = view.getByTestId('ide-design-inspector-identity-card');
    const state = view.getByTestId('ide-design-context-inspector');
    expect(identity.contains(health)).toBe(true);
    const position = health.compareDocumentPosition(state);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('groups primary actions ahead of signal/state context', async () => {
    const view = renderSurface(BASE_CIRCUIT);

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-actions')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-inspector-actions').textContent).toContain('Rename');
    expect(view.getByTestId('ide-design-inspector-actions').textContent).toContain('Trace net');

    const actions = view.getByTestId('ide-design-inspector-actions');
    const state = view.getByTestId('ide-design-context-inspector');
    const position = actions.compareDocumentPosition(state);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps rename inside the primary inspector flow instead of a standalone properties section', async () => {
    const view = renderSurface(BASE_CIRCUIT);

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-inspector-properties')).toBeNull();

    const actions = view.getByTestId('ide-design-inspector-actions');
    const state = view.getByTestId('ide-design-context-inspector');
    expect(actions.textContent).toContain('Rename');
    const position = actions.compareDocumentPosition(state);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
