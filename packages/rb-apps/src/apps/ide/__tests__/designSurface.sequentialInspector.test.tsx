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

const SEQUENTIAL_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'clk0_node',
      type: 'Clock',
      label: 'CLK_SRC',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'data0_node',
      type: 'INPUT',
      label: 'DATA',
      position: { x: 0, y: 100 },
      rotation: 0,
      config: {},
      state: { isOn: 1 },
    },
    {
      id: 'ff0_node',
      type: 'DFlipFlop',
      label: 'FF0',
      position: { x: 160, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'latch0_node',
      type: 'DLatch',
      label: 'LATCH0',
      position: { x: 160, y: 120 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'ld0_node',
      type: 'OUTPUT',
      label: 'LD0',
      position: { x: 320, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    {
      from: { nodeId: 'clk0_node', portName: 'out' },
      to: { nodeId: 'ff0_node', portName: 'CLK' },
    },
    {
      from: { nodeId: 'data0_node', portName: 'out' },
      to: { nodeId: 'ff0_node', portName: 'D' },
    },
    {
      from: { nodeId: 'ff0_node', portName: 'Q' },
      to: { nodeId: 'ld0_node', portName: 'in' },
    },
    {
      from: { nodeId: 'clk0_node', portName: 'out' },
      to: { nodeId: 'latch0_node', portName: 'EN' },
    },
    {
      from: { nodeId: 'data0_node', portName: 'out' },
      to: { nodeId: 'latch0_node', portName: 'D' },
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
    inputs: {
      data0_node: 1,
    },
    signals: {
      'clk0_node.out': 1,
      'data0_node.out': 1,
      'ff0_node.CLK': 1,
      'ff0_node.D': 1,
      'ff0_node.Q': 1,
      'ff0_node.Q_inv': 0,
      'latch0_node.EN': 1,
      'latch0_node.D': 1,
      'latch0_node.Q': 1,
      'latch0_node.Q_inv': 0,
      'ld0_node.in': 1,
    },
    trace: [
      {
        tick: 5,
        signals: {
          'clk0_node.out': 0,
          'data0_node.out': 1,
          'ff0_node.CLK': 0,
          'ff0_node.D': 1,
          'ff0_node.Q': 0,
          'ff0_node.Q_inv': 1,
          'latch0_node.EN': 0,
          'latch0_node.D': 1,
          'latch0_node.Q': 0,
          'latch0_node.Q_inv': 1,
          'ld0_node.in': 0,
        },
      },
      {
        tick: 6,
        signals: {
          'clk0_node.out': 1,
          'data0_node.out': 1,
          'ff0_node.CLK': 1,
          'ff0_node.D': 1,
          'ff0_node.Q': 1,
          'ff0_node.Q_inv': 0,
          'latch0_node.EN': 1,
          'latch0_node.D': 1,
          'latch0_node.Q': 1,
          'latch0_node.Q_inv': 0,
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
  overrides: Partial<React.ComponentProps<typeof DesignSurface>> = {}
) {
  const onGoToHardware = vi.fn();
  const view = render(
    <DesignSurface
      runtimeSim={makeRuntimeSim()}
      ioRows={[
        { id: 'clk0', nodeId: 'clk0_node', label: 'CLK100MHZ', pin: 'W5', port: 'out', direction: 'in' },
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
      onGoToHardware={onGoToHardware}
      {...overrides}
    />
  );

  return { ...view, onGoToHardware };
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  useCircuitStore.getState().reset();
  useCircuitStore.setState({
    circuit: structuredClone(SEQUENTIAL_CIRCUIT),
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

describe('DesignSurface sequential inspector hardening', () => {
  it('shows timing-aware guidance for flip-flop selections', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ff0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sequential-guidance')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-inspector-part-kind').textContent).toBe('Sequential');
    expect(view.getByTestId('ide-design-inspector-what-it-is').textContent).toContain(
      'captures D on the active clock edge'
    );
    expect(view.getByTestId('ide-design-inspector-structure-hint').textContent).toContain('Sequential guidance');
    expect(view.getByTestId('ide-design-sequential-guidance-copy').textContent).toContain(
      'captures D on the active clock edge'
    );
    expect(view.getByTestId('ide-design-sequential-role').textContent).toBe('Edge-triggered state');
    expect(view.getByTestId('ide-design-sequential-control-source').textContent).toContain('CLK100MHZ');
    expect(view.getByTestId('ide-design-sequential-control-activity').textContent).toContain('rising');
    expect(view.getByTestId('ide-design-context-sequential-action').textContent).toContain('Trace control path');
    expect(view.getByTestId('ide-design-sequential-input-summary').textContent).toContain('Clock=1');
    expect(view.getByTestId('ide-design-sequential-output-summary').textContent).toContain('Q=1');
  });

  it('uses enable-oriented latch guidance instead of flip-flop wording', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('latch0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sequential-guidance')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-sequential-guidance-copy').textContent).toContain(
      'transparent while Enable is high'
    );
    expect(view.getByTestId('ide-design-sequential-guidance-copy').textContent).not.toContain('clock edge');
    expect(view.getByTestId('ide-design-context-inspector').textContent).toContain('Enable');
    expect(view.getByTestId('ide-design-sequential-input-summary').textContent).toContain('Enable=1');
  });

  it('shows timing-role and board-context summary for mapped clock selections', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('clk0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sequential-guidance')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-sequential-role').textContent).toBe('Timing source');
    expect(view.getByTestId('ide-design-sequential-timing-context').textContent).toContain('CLK100MHZ -> W5');
    expect(view.getByTestId('ide-design-sequential-guidance-copy').textContent).toContain('named timing source');
  });

  it('offers a direct map-pins action for unmapped clock selections', async () => {
    const view = renderSurface({ ioRows: [] });

    act(() => {
      useLogicViewStore.getState().selectNode('clk0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-sequential-action')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-context-sequential-action'));
    expect(view.onGoToHardware).toHaveBeenCalledTimes(1);
  });
});
