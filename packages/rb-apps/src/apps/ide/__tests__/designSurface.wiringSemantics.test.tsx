// @vitest-environment jsdom
/**
 * Wiring semantics: a driver feeding 2+ loads renders a fanout junction dot
 * at its output port (a plain wire crossing never gets one), and a marquee
 * box-selection adopts the wires whose both endpoints are inside the box.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

const FANOUT_CIRCUIT: Circuit = {
  nodes: [
    { id: 'fan_src', type: 'INPUT', label: 'A', x: 120, y: 96 },
    { id: 'fan_out1', type: 'OUTPUT', label: 'Y1', x: 320, y: 48 },
    { id: 'fan_out2', type: 'OUTPUT', label: 'Y2', x: 320, y: 160 },
  ] as Circuit['nodes'],
  connections: [
    { from: { nodeId: 'fan_src', portName: 'out' }, to: { nodeId: 'fan_out1', portName: 'in' } },
    { from: { nodeId: 'fan_src', portName: 'out' }, to: { nodeId: 'fan_out2', portName: 'in' } },
  ] as Circuit['connections'],
};

const CHAIN_CIRCUIT: Circuit = {
  nodes: [
    { id: 'ch_src', type: 'INPUT', label: 'A', x: 120, y: 96 },
    { id: 'ch_dst', type: 'OUTPUT', label: 'Y', x: 320, y: 96 },
  ] as Circuit['nodes'],
  connections: [
    { from: { nodeId: 'ch_src', portName: 'out' }, to: { nodeId: 'ch_dst', portName: 'in' } },
  ] as Circuit['connections'],
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

function renderSurface(overrides: Partial<React.ComponentProps<typeof DesignSurface>> = {}) {
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
      {...overrides}
    />
  );
}

function seedCircuit(circuit: Circuit) {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(circuit), isDirty: false });
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  // jsdom has no pointer-capture implementation; useCanvasInput calls these.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  localStorage.clear();
  useLogicViewStore.setState({
    ...useLogicViewStore.getState(),
    toolMode: 'select',
    interactionMode: 'idle',
    selection: { nodes: new Set<string>(), wires: new Set<string>() },
    camera: { x: 0, y: 0, zoom: 1 },
  });
});

afterEach(cleanup);

describe('fanout junction dots', () => {
  it('marks a driver with two loads with a junction dot at its output port', async () => {
    seedCircuit(FANOUT_CIRCUIT);
    const view = renderSurface();
    const junction = await view.findByTestId('logic-fanout-junction-fan_src.out');
    expect(junction.tagName.toLowerCase()).toBe('circle');
    // On the shared trunk, downstream of the driver's output pin, under the live camera transform.
    const camera = useLogicViewStore.getState().camera;
    const driverPinX = (120 + 24) * camera.zoom + camera.x;
    expect(Number(junction.getAttribute('cx'))).toBeGreaterThan(driverPinX);
    expect(Number.isFinite(Number(junction.getAttribute('cy')))).toBe(true);
  });

  it('never marks a single-load wire with a junction', async () => {
    seedCircuit(CHAIN_CIRCUIT);
    const view = renderSurface();
    await waitFor(() => {
      expect(view.container.querySelector('[data-node-id="ch_src"]')).toBeTruthy();
    });
    expect(view.container.querySelector('[data-testid^="logic-fanout-junction"]')).toBeNull();
  });
});

describe('marquee selection adopts contained wires', () => {
  it('selectMultiple replaces nodes and wires atomically', () => {
    useLogicViewStore.getState().selectMultiple(['fan_src', 'fan_out1'], ['w1', 'w2']);
    const selection = useLogicViewStore.getState().selection;
    expect(Array.from(selection.nodes).sort()).toEqual(['fan_out1', 'fan_src']);
    expect(Array.from(selection.wires).sort()).toEqual(['w1', 'w2']);

    useLogicViewStore.getState().selectMultiple(['fan_src'], []);
    expect(useLogicViewStore.getState().selection.wires.size).toBe(0);
  });

  it('box-selecting the whole circuit selects nodes and their internal wires', async () => {
    seedCircuit(FANOUT_CIRCUIT);
    const view = renderSurface();
    await waitFor(() => {
      expect(view.container.querySelector('[data-node-id="fan_src"]')).toBeTruthy();
    });
    const svg = view.container.querySelector('[data-testid="ide-design-live-canvas"] svg')
      ?? view.container.querySelector('svg');
    expect(svg).toBeTruthy();

    // Convert a generous world-space box around the whole circuit into client
    // coordinates under whatever camera the surface fitted to.
    const camera = useLogicViewStore.getState().camera;
    const toClient = (wx: number, wy: number) => ({
      clientX: wx * camera.zoom + camera.x,
      clientY: wy * camera.zoom + camera.y,
    });
    const start = toClient(20, -40);
    const mid = toClient(220, 100);
    const end = toClient(420, 260);

    fireEvent.pointerDown(svg!, { button: 0, pointerId: 7, ...start });
    fireEvent.pointerMove(svg!, { pointerId: 7, ...mid });
    fireEvent.pointerMove(svg!, { pointerId: 7, ...end });
    fireEvent.pointerUp(svg!, { pointerId: 7, ...end });

    await waitFor(() => {
      const selection = useLogicViewStore.getState().selection;
      expect(selection.nodes.size).toBe(3);
      expect(selection.wires.size).toBe(2);
    });
  });
});
