// @vitest-environment jsdom
//
// Design graph-depth seams: two-node Trace path action, single-node
// Connected neighborhood chips, and the semantic zoom tier stamp.

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
    { id: 'sw0_node', type: 'INPUT', label: 'SW0', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
    { id: 'and0_node', type: 'AND', position: { x: 100, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'ld0_node', type: 'OUTPUT', label: 'LD0', position: { x: 200, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'lone_node', type: 'NOT', position: { x: 300, y: 200 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and0_node', portName: 'a' } },
    { from: { nodeId: 'and0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
  ],
};

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 0,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: {},
    signals: {},
    trace: [],
    selectedSignalKey: null,
    probes: [],
  };
}

function installResizeObserver(width = 1320, height = 720) {
  class ImmediateResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; }
    observe(target: Element) {
      this.callback(
        [{ target, contentRect: { width, height, x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, toJSON: () => ({}) } } as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
}

function renderSurface() {
  return render(
    <DesignSurface
      runtimeSim={makeRuntimeSim()}
      ioRows={[]}
      onRuntimeSimRun={vi.fn()}
      onRuntimeSimPause={vi.fn()}
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
      onRuntimeSimSetSpeed={vi.fn()}
      onRuntimeSimToggleProbe={vi.fn()}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(BASE_CIRCUIT), isDirty: false, past: [], future: [] });
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

afterEach(() => { cleanup(); });

describe('DesignSurface — trace path between two selected nodes', () => {
  it('offers Trace path for a connected pair and applies a path trace', async () => {
    const view = renderSurface();
    act(() => { useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']); });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-trace-path-group')).toBeTruthy();
    });
    const button = view.getByTestId('ide-design-trace-path-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(view.queryByTestId('ide-design-trace-path-none')).toBeNull();
    fireEvent.click(button);
    await waitFor(() => {
      const banner = view.getByTestId('ide-design-active-trace');
      expect(banner.textContent).toContain('Path');
    });
  });

  it('reports honestly when the pair has no directed path', async () => {
    const view = renderSurface();
    act(() => { useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'lone_node']); });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-trace-path-group')).toBeTruthy();
    });
    expect((view.getByTestId('ide-design-trace-path-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(view.getByTestId('ide-design-trace-path-none').textContent).toContain('No directed path');
  });

  it('does not render the trace-path group for three selected nodes', async () => {
    const view = renderSurface();
    act(() => { useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'and0_node', 'ld0_node']); });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-arrange-group')).toBeTruthy();
    });
    expect(view.queryByTestId('ide-design-trace-path-group')).toBeNull();
  });
});

describe('DesignSurface — connected neighborhood chips', () => {
  it('lists 1-hop neighbors for the selected node and selects one on click', async () => {
    const view = renderSurface();
    act(() => { useLogicViewStore.getState().selectNode('and0_node'); });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-neighborhood-group')).toBeTruthy();
    });
    view.getByTestId('ide-design-neighbor-sw0_node');
    view.getByTestId('ide-design-neighbor-ld0_node');
    expect(view.queryByTestId('ide-design-neighbor-lone_node')).toBeNull();
    fireEvent.click(view.getByTestId('ide-design-neighbor-sw0_node'));
    await waitFor(() => {
      expect(useLogicViewStore.getState().selection.nodes.has('sw0_node')).toBe(true);
      expect(useLogicViewStore.getState().selection.nodes.has('and0_node')).toBe(false);
    });
  });

  it('renders no neighborhood group for an unconnected node', async () => {
    const view = renderSurface();
    act(() => { useLogicViewStore.getState().selectNode('lone_node'); });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });
    expect(view.queryByTestId('ide-design-neighborhood-group')).toBeNull();
  });
});

describe('DesignSurface — semantic zoom tier stamp', () => {
  it('stamps the live canvas with the tier for the current camera zoom', async () => {
    const view = renderSurface();
    // The mount-time auto-fit owns the initial zoom; assert only the transitions.
    expect(view.getByTestId('ide-design-live-canvas').getAttribute('data-zoom-tier')).toBeTruthy();
    act(() => {
      useLogicViewStore.setState({ camera: { x: 0, y: 0, zoom: 0.4 } });
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-live-canvas').getAttribute('data-zoom-tier')).toBe('overview');
    });
    act(() => {
      useLogicViewStore.setState({ camera: { x: 0, y: 0, zoom: 2 } });
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-live-canvas').getAttribute('data-zoom-tier')).toBe('detail');
    });
  });
});
