// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
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

function renderSurface() {
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
    expect(view.getByTestId('ide-design-context-inspector').textContent).toContain('LD0 -> U16');
    expect(view.getByTestId('ide-design-shortcut-strip').textContent).toContain('Ctrl + wheel');

    fireEvent.click(view.getByTestId('ide-design-context-trace'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('Fanin to ld0_node.in');
    });

    fireEvent.click(view.getByTestId('ide-design-live-sim-section-toggle'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-live-sim-section').textContent).toContain('Tick');
    });

    expect(view.getByTestId('ide-design-live-state-table').textContent).toContain('Inputs');
    expect(view.getByTestId('ide-design-live-state-table').textContent).toContain('Outputs');
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
});
