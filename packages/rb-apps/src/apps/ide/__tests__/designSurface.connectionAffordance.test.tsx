// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface, connectionRejectedMessage } from '../surfaces/DesignSurface';
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
      position: { x: 200, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [],
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
    hoveredWireId: null,
    rewiredWireId: null,
  });
});

afterEach(() => { cleanup(); });

// ─── connectionRejectedMessage unit tests ────────────────────────────────────

describe('connectionRejectedMessage — student-friendly rejection copy', () => {
  it('self-loop: maps "Cannot connect node to itself"', () => {
    expect(connectionRejectedMessage('Cannot connect node to itself'))
      .toBe('A gate cannot connect to itself.');
  });

  it('duplicate wire: maps "Connection already exists"', () => {
    expect(connectionRejectedMessage('Connection already exists'))
      .toBe('That wire already exists.');
  });

  it('input to input: maps "Cannot connect input to input"', () => {
    expect(connectionRejectedMessage('Cannot connect input to input'))
      .toBe('Inputs cannot be wired directly to each other.');
  });

  it('output to output: maps "Cannot connect output to output"', () => {
    expect(connectionRejectedMessage('Cannot connect output to output'))
      .toBe('Outputs cannot be wired directly to each other.');
  });

  it('unknown reason: returns generic fallback', () => {
    expect(connectionRejectedMessage('some unknown reason'))
      .toBe('That connection is not allowed here.');
  });
});

// ─── Wire preview visibility ─────────────────────────────────────────────────

describe('DesignSurface — wire preview affordance', () => {
  it('shows logic-wire-preview in canvas while a wire is being drawn', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.setState({
        editingState: {
          isDragging: false,
          wireStartPort: { nodeId: 'sw0_node', portName: 'out' },
        },
        interactionMode: 'wiring',
      });
    });

    await waitFor(() => {
      expect(view.getByTestId('logic-wire-preview')).toBeTruthy();
    });
  });

  it('wire preview is absent before any wire starts', async () => {
    const view = renderSurface();

    // Default state: no wireStartPort set
    await waitFor(() => {
      expect(view.queryByTestId('logic-wire-preview')).toBeNull();
    });
  });
});

// ─── Wire endpoint hover affordance ─────────────────────────────────────────

const CONNECTED_CIRCUIT: Circuit = {
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
      id: 'ld0_node',
      type: 'OUTPUT',
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

describe('DesignSurface — wire endpoint hover affordance', () => {
  // Each test in this block needs a connected circuit
  beforeEach(() => {
    useCircuitStore.setState({
      circuit: structuredClone(CONNECTED_CIRCUIT),
      isDirty: false,
      past: [],
      future: [],
    });
  });

  it('shows endpoint hint handles on wire hover without requiring prior wire selection', async () => {
    const view = renderSurface();

    // No hover — hints must NOT yet exist
    expect(view.queryByTestId('logic-wire-endpoint-hint-from')).toBeNull();
    expect(view.queryByTestId('logic-wire-endpoint-hint-to')).toBeNull();

    act(() => {
      useLogicViewStore.setState({ hoveredWireId: 'sw0_node.out-ld0_node.in' });
    });

    await waitFor(() => {
      expect(view.getByTestId('logic-wire-endpoint-hint-from')).toBeTruthy();
    });
    expect(view.getByTestId('logic-wire-endpoint-hint-to')).toBeTruthy();
  });

  it('hides endpoint hint handles when the cursor leaves the wire', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.setState({ hoveredWireId: 'sw0_node.out-ld0_node.in' });
    });
    await waitFor(() => {
      expect(view.getByTestId('logic-wire-endpoint-hint-from')).toBeTruthy();
    });

    act(() => {
      useLogicViewStore.setState({ hoveredWireId: null });
    });
    await waitFor(() => {
      expect(view.queryByTestId('logic-wire-endpoint-hint-from')).toBeNull();
    });
    expect(view.queryByTestId('logic-wire-endpoint-hint-to')).toBeNull();
  });

  it('does not show hover hint handles when the wire is already selected', async () => {
    const view = renderSurface();

    // Select the wire and hover it simultaneously — selected state suppresses hover handles
    act(() => {
      useLogicViewStore.getState().selectWire('sw0_node.out-ld0_node.in');
      useLogicViewStore.setState({ hoveredWireId: 'sw0_node.out-ld0_node.in' });
    });

    // Selected handles should be present
    await waitFor(() => {
      expect(view.getByTestId('logic-wire-reconnect-from')).toBeTruthy();
    });

    // Hover hint handles must NOT render (selected state takes over)
    expect(view.queryByTestId('logic-wire-endpoint-hint-from')).toBeNull();
    expect(view.queryByTestId('logic-wire-endpoint-hint-to')).toBeNull();
  });
});

// ─── Wire reconnect visual feedback (Slice 7) ────────────────────────────────

describe('DesignSurface — wire reconnect visual feedback', () => {
  // Each test in this block needs a connected circuit
  beforeEach(() => {
    useCircuitStore.setState({
      circuit: structuredClone(CONNECTED_CIRCUIT),
      isDirty: false,
      past: [],
      future: [],
    });
  });

  it('wire being replaced is visually ghosted while reconnect is in progress', async () => {
    const view = renderSurface();

    // Confirm the wire is present and NOT ghosted initially
    const wireEl = view.container.querySelector('[data-wire-id="sw0_node.out-ld0_node.in"]');
    expect(wireEl).not.toBeNull();
    expect(wireEl!.getAttribute('data-wire-being-rewired')).not.toBe('1');

    // Simulate reconnect-in-progress by setting rewiredWireId in the store
    act(() => {
      useLogicViewStore.setState({
        rewiredWireId: 'sw0_node.out-ld0_node.in',
        interactionMode: 'wiring',
        editingState: {
          isDragging: false,
          wireStartPort: { nodeId: 'ld0_node', portName: 'in' },
        },
      });
    });

    await waitFor(() => {
      const el = view.container.querySelector('[data-wire-id="sw0_node.out-ld0_node.in"]');
      expect(el!.getAttribute('data-wire-being-rewired')).toBe('1');
    });
  });

  it('wire returns to normal appearance when reconnect ends', async () => {
    const view = renderSurface();

    // Start reconnect
    act(() => {
      useLogicViewStore.setState({
        rewiredWireId: 'sw0_node.out-ld0_node.in',
        interactionMode: 'wiring',
        editingState: {
          isDragging: false,
          wireStartPort: { nodeId: 'ld0_node', portName: 'in' },
        },
      });
    });

    await waitFor(() => {
      const el = view.container.querySelector('[data-wire-id="sw0_node.out-ld0_node.in"]');
      expect(el!.getAttribute('data-wire-being-rewired')).toBe('1');
    });

    // End reconnect (cancel)
    act(() => {
      useLogicViewStore.setState({
        rewiredWireId: null,
        interactionMode: 'idle',
        editingState: { isDragging: false },
      });
    });

    await waitFor(() => {
      const el = view.container.querySelector('[data-wire-id="sw0_node.out-ld0_node.in"]');
      expect(el!.getAttribute('data-wire-being-rewired')).not.toBe('1');
    });
  });

  it('a second wire on a different node is NOT ghosted during reconnect', async () => {
    // Use a circuit with two wires
    const twoWireCircuit = {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', label: 'SW0', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
        { id: 'sw1_node', type: 'INPUT', label: 'SW1', position: { x: 0, y: 80 }, rotation: 0, config: {}, state: { isOn: 0 } },
        { id: 'and0_node', type: 'AND', position: { x: 200, y: 40 }, rotation: 0, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and0_node', portName: 'in1' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'and0_node', portName: 'in2' } },
      ],
    };
    useCircuitStore.setState({ circuit: twoWireCircuit, isDirty: false, past: [], future: [] });

    const view = renderSurface();

    // Reconnect only the first wire
    act(() => {
      useLogicViewStore.setState({
        rewiredWireId: 'sw0_node.out-and0_node.in1',
        interactionMode: 'wiring',
        editingState: {
          isDragging: false,
          wireStartPort: { nodeId: 'and0_node', portName: 'in1' },
        },
      });
    });

    await waitFor(() => {
      const el = view.container.querySelector('[data-wire-id="sw0_node.out-and0_node.in1"]');
      expect(el!.getAttribute('data-wire-being-rewired')).toBe('1');
    });

    // The OTHER wire must remain un-ghosted
    const otherEl = view.container.querySelector('[data-wire-id="sw1_node.out-and0_node.in2"]');
    expect(otherEl).not.toBeNull();
    expect(otherEl!.getAttribute('data-wire-being-rewired')).not.toBe('1');
  });
});
