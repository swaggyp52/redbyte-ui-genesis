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

const REGISTER_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'clk0_node',
      type: 'Clock',
      label: 'CLK_SRC',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: { period: 10 },
      state: {},
    },
    {
      id: 'reg0_node',
      type: 'RegisterBus',
      label: 'RB0',
      position: { x: 160, y: 0 },
      rotation: 0,
      config: { width: 4, hasEnable: true, resetKind: 'none', clockPolarity: 'rising_edge' },
      state: {},
    },
  ],
  connections: [
    {
      from: { nodeId: 'clk0_node', portName: 'out' },
      to: { nodeId: 'reg0_node', portName: 'CLK' },
    },
  ],
};

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

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 1,
    running: false,
    stepMode: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: {},
    signals: {
      'clk0_node.out': 1,
      'reg0_node.CLK': 1,
      'reg0_node.D': 0,
      'reg0_node.Q': 0,
    },
    trace: [],
    selectedSignalKey: null,
    probes: [],
  };
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

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  useCircuitStore.getState().reset();
  useCircuitStore.setState({
    circuit: structuredClone(REGISTER_CIRCUIT),
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

describe('DesignSurface register family', () => {
  it('shows native register sequential guidance when a RegisterBus is selected', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('reg0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-sequential-guidance')).toBeTruthy();
    });
    expect(view.getByTestId('ide-design-sequential-guidance-copy').textContent).toContain('Bus width 4');
    expect(view.getByTestId('ide-design-sequential-role').textContent).toContain('Bus register');
  });

  it('exposes register semantics controls in the inspector', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('reg0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-register-config')).toBeTruthy();
    });
    const width = view.getByTestId('ide-design-register-width') as HTMLInputElement;
    fireEvent.change(width, { target: { value: '8' } });
    const stored = useCircuitStore.getState().circuit.nodes.find((n) => n.id === 'reg0_node');
    expect(stored?.config?.width).toBe(8);
  });
});
