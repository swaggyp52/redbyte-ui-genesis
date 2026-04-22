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

// sw0_node → ld0_node (direct connection)
// For fan-out: tracing sw0_node downstream hits ld0_node
// For fan-in: tracing ld0_node upstream hits sw0_node
// ld0_node has NO downstream (no fan-out)
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

// ─── Fan-out trace button rendering ───────────────────────────────────────────

describe('DesignSurface fan-out — button rendering', () => {
  it('renders "Trace →" button when a node is selected', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-context-trace-fanout')).toBeTruthy();
  });

  it('"Trace →" is enabled for a node that has downstream connections (sw0_node → ld0_node)', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-trace-fanout')).toBeTruthy();
    });

    expect(
      (view.getByTestId('ide-design-context-trace-fanout') as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('"Trace →" is disabled for a node with no downstream (ld0_node)', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-trace-fanout')).toBeTruthy();
    });

    expect(
      (view.getByTestId('ide-design-context-trace-fanout') as HTMLButtonElement).disabled
    ).toBe(true);
  });
});

// ─── Fan-out trace activation ─────────────────────────────────────────────────

describe('DesignSurface fan-out — trace activation', () => {
  it('activates fan-out trace when "Trace →" is clicked on a source node', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-trace-fanout')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-trace-fanout'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('What SW0 drives');
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('Active');
      expect(traceLabel.getAttribute('title')).toContain('What SW0 drives');
    });
  });

  it('trace label indicates fanout mode, distinguishing it from fan-in', async () => {
    const view = renderSurface();

    // First activate fan-in trace on ld0_node
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-trace')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-trace'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('What feeds LD0');
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('Active');
      expect(traceLabel.getAttribute('title')).toContain('What feeds LD0');
    });

    // Now clear and activate fan-out trace on sw0_node
    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-clear-trace'));
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('No trace locked');
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-trace-fanout'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('What SW0 drives');
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('Active');
      expect(traceLabel.getAttribute('title')).toContain('What SW0 drives');
      expect(traceLabel.getAttribute('title')).not.toContain('What feeds');
    });
  });

  it('"Clear trace" disables fan-out trace', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-trace-fanout')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-trace-fanout'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('What SW0 drives');
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('Active');
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-clear-trace'));
    });

    await waitFor(() => {
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('No trace locked');
    });
  });

  it('does not show a redundant action toast when Trace net is clicked (label + highlight are enough)', async () => {
    const view = renderSurface();
    const wireId = 'sw0_node.out-ld0_node.in';

    act(() => {
      useLogicViewStore.getState().selectWire(wireId);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-trace')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-trace'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toMatch(/One net/);
    });

    expect(view.queryByTestId('ide-design-action-toast')).toBeNull();
  });

  it('auto-applies driver net trace when a single wire is selected (no Trace net click)', async () => {
    const view = renderSurface();
    const wireId = 'sw0_node.out-ld0_node.in';

    act(() => {
      useLogicViewStore.getState().selectWire(wireId);
    });

    await waitFor(() => {
      const full = view.getByTestId('ide-design-active-trace').textContent ?? '';
      expect(full).toContain('One net:');
      expect(full).toContain('SW0');
      expect(full).toContain('out');
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('Active');
      expect(traceLabel.getAttribute('title') ?? full).toContain('One net:');
    });
  });
});

// ─── Upstream trace regression ────────────────────────────────────────────────

describe('DesignSurface fan-out — upstream trace regression', () => {
  it('"Trace net" (fan-in) still works for an output node', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-trace')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-context-trace'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('What feeds LD0');
      const traceLabel = view.getByTestId('ide-design-context-trace-state');
      expect(traceLabel.textContent).toBe('Active');
      expect(traceLabel.getAttribute('title')).toContain('What feeds LD0');
    });
  });

  it('"Trace net" button is still present alongside "Trace →"', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-context-trace')).toBeTruthy();
    expect(view.getByTestId('ide-design-context-trace-fanout')).toBeTruthy();
  });
});
