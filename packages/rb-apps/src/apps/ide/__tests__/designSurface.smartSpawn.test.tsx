// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import {
  GRID_SIZE,
  NODE_SIZE,
} from '../../../../../rb-logic-view/src/tools/placement';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { RuntimeSimState } from '../projectRuntime';
import { DesignSurface } from '../surfaces/DesignSurface';

const CANVAS_WIDTH = 1320;
const CANVAS_HEIGHT = 720;

const CIRCUIT_WITH_CENTERED_XOR: Circuit = {
  nodes: [
    { id: 'input-a', type: 'INPUT', position: { x: -160, y: -48 } },
    { id: 'xor', type: 'XOR', position: { x: 0, y: 0 } },
    { id: 'output-sum', type: 'OUTPUT', position: { x: 160, y: -48 } },
  ],
  connections: [],
};

const passiveSimulation: RuntimeSimState = {
  tick: 0,
  running: false,
  speedHz: 10,
  irHash: 'ir-hash',
  traceHash: 'trace-hash',
  inputs: {},
  signals: {},
  trace: [],
  selectedSignalKey: null,
  probes: [],
};

const nativeRaf = window.requestAnimationFrame;
const nativeCancelRaf = window.cancelAnimationFrame;

beforeEach(() => {
  vi.restoreAllMocks();
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = vi.fn() as typeof window.cancelAnimationFrame;

  class ImmediateResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              x: 0,
              y: 0,
              top: 0,
              left: 0,
              right: CANVAS_WIDTH,
              bottom: CANVAS_HEIGHT,
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

  useCircuitStore.getState().reset();
  useCircuitStore.setState({
    circuit: structuredClone(CIRCUIT_WITH_CENTERED_XOR),
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
    gridSize: GRID_SIZE,
  });
});

afterEach(() => {
  window.requestAnimationFrame = nativeRaf;
  window.cancelAnimationFrame = nativeCancelRaf;
  vi.unstubAllGlobals();
});

describe('DesignSurface smart quick placement', () => {
  it('places quick Add AND clear of a centered XOR at 200% zoom with a panned camera', async () => {
    const onRuntimeAddNode = vi.fn();
    const view = render(
      <DesignSurface
        runtimeSim={passiveSimulation}
        onRuntimeAddNode={onRuntimeAddNode}
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

    await waitFor(() => {
      expect(view.getByTestId('logic-canvas-svg').getAttribute('width')).toBe(String(CANVAS_WIDTH));
      expect(view.getByTestId('ide-design-quick-add-and')).toBeTruthy();
    });

    act(() => {
      useLogicViewStore.getState().setCamera({
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        zoom: 2,
      });
    });

    fireEvent.click(view.getByTestId('ide-design-quick-add-and'));

    expect(onRuntimeAddNode).toHaveBeenCalledTimes(1);
    const [type, position] = onRuntimeAddNode.mock.calls[0] as [
      string,
      { x: number; y: number },
    ];
    expect(type).toBe('AND');
    expect(
      Math.abs(position.x) >= NODE_SIZE + GRID_SIZE ||
      Math.abs(position.y) >= NODE_SIZE + GRID_SIZE,
      `expected quick placement clear of XOR, received ${JSON.stringify(position)}`
    ).toBe(true);
  });
});
