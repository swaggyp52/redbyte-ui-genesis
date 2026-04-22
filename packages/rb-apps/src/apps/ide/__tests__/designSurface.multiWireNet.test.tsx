// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

/** sw0 fans out to two loads — two wire segments, one driver */
const FANOUT_TWO_WIRES: Circuit = {
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
      label: 'LD0',
      position: { x: 200, y: -40 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'ld1_node',
      type: 'OUTPUT',
      label: 'LD1',
      position: { x: 200, y: 40 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld1_node', portName: 'in' } },
  ],
};

/** sw0 -> ld0, sw1 -> ld1 — two different drivers */
const TWO_DRIVERS: Circuit = {
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
      id: 'sw1_node',
      type: 'INPUT',
      label: 'SW1',
      position: { x: 0, y: 80 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
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
    {
      id: 'ld1_node',
      type: 'OUTPUT',
      label: 'LD1',
      position: { x: 200, y: 80 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
    { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'ld1_node', portName: 'in' } },
  ],
};

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 1,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'x',
    traceHash: 'y',
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

function renderSurface(
  circuit: Circuit,
  ioRows: React.ComponentProps<typeof DesignSurface>['ioRows'] = [
    { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'V17', port: 'out', direction: 'in' },
    { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' },
    { id: 'ld1', nodeId: 'ld1_node', label: 'LD1', pin: 'E19', port: 'in', direction: 'out' },
  ]
) {
  return render(
    <DesignSurface
      runtimeSim={makeRuntimeSim()}
      ioRows={ioRows}
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
  installResizeObserver(1320);
  useCircuitStore.getState().reset();
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

describe('DesignSurface multi-wire net story', () => {
  it('describes a single driver when two segments are from the same net', async () => {
    useCircuitStore.setState({
      circuit: structuredClone(FANOUT_TWO_WIRES),
      isDirty: false,
      past: [],
      future: [],
    });
    const view = renderSurface(
      structuredClone(FANOUT_TWO_WIRES),
    );

    const w1 = 'sw0_node.out-ld0_node.in';
    const w2 = 'sw0_node.out-ld1_node.in';

    act(() => {
      useLogicViewStore.getState().selectWire(w1, false);
      useLogicViewStore.getState().selectWire(w2, true);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-summary')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-multiwire-count').textContent).toBe('2 wire segments selected');
    expect(view.getByTestId('ide-design-multiwire-net-detail').textContent).toMatch(/one electrical signal/i);
    expect(view.getByTestId('ide-design-multiwire-group-labels').textContent).toMatch(/SW0/);
  });

  it('describes multiple drivers when selected wires come from different sources', async () => {
    useCircuitStore.setState({
      circuit: structuredClone(TWO_DRIVERS),
      isDirty: false,
      past: [],
      future: [],
    });
    const view = renderSurface(structuredClone(TWO_DRIVERS), [
      { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'V17', port: 'out', direction: 'in' },
      { id: 'sw1', nodeId: 'sw1_node', label: 'SW1', pin: 'V18', port: 'out', direction: 'in' },
      { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' },
      { id: 'ld1', nodeId: 'ld1_node', label: 'LD1', pin: 'E19', port: 'in', direction: 'out' },
    ]);

    const w1 = 'sw0_node.out-ld0_node.in';
    const w2 = 'sw1_node.out-ld1_node.in';

    act(() => {
      useLogicViewStore.getState().selectWire(w1, false);
      useLogicViewStore.getState().selectWire(w2, true);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-identity-subtitle').textContent).toMatch(
        /Multiple signals|different drivers/i
      );
    });
    const hint = view.getByTestId('ide-design-multiwire-group-labels').textContent ?? '';
    expect(hint).toMatch(/SW0/);
    expect(hint).toMatch(/SW1/);
  });

  it('clears auto net trace when a second wire is added to the selection', async () => {
    useCircuitStore.setState({
      circuit: structuredClone(FANOUT_TWO_WIRES),
      isDirty: false,
      past: [],
      future: [],
    });
    const view = renderSurface(
      structuredClone(FANOUT_TWO_WIRES),
    );

    const w1 = 'sw0_node.out-ld0_node.in';
    const w2 = 'sw0_node.out-ld1_node.in';

    act(() => {
      useLogicViewStore.getState().selectWire(w1, false);
    });

    await waitFor(() => {
      const el = view.queryByTestId('ide-design-active-trace');
      expect(el?.textContent).toMatch(/One net/);
    });

    act(() => {
      useLogicViewStore.getState().selectWire(w2, true);
    });

    await waitFor(() => {
      expect(view.queryByTestId('ide-design-active-trace')).toBeNull();
    });
  });
});
