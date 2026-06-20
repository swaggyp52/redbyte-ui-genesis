// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

const nativeRaf = window.requestAnimationFrame;
const nativeCancelRaf = window.cancelAnimationFrame;

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

function makePassiveSim(): RuntimeSimState {
  return {
    tick: 0,
    running: false,
    lastAction: undefined,
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
      runtimeSim={makePassiveSim()}
      ioRows={[
        {
          id: 'sw0',
          nodeId: 'sw0_node',
          label: 'SW0',
          pin: 'V17',
          port: 'out',
          direction: 'in',
        },
        {
          id: 'ld0',
          nodeId: 'ld0_node',
          label: 'LD0',
          pin: 'U16',
          port: 'in',
          direction: 'out',
        },
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
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = vi.fn() as typeof window.cancelAnimationFrame;
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
  window.requestAnimationFrame = nativeRaf;
  window.cancelAnimationFrame = nativeCancelRaf;
});

describe('DesignSurface idle inspector contract', () => {
  it('renders the default canvas inspector and useful idle overview stats when nothing is selected', () => {
    useCircuitStore.setState({
      circuit: structuredClone(BASE_CIRCUIT),
      isDirty: false,
      past: [],
      future: [],
    });

    const view = renderSurface();

    expect(view.getByTestId('ide-design-inspector-canvas-default')).toBeTruthy();
    expect(view.getByTestId('ide-design-inspector-idle-card').textContent).toContain('Design overview');
    expect(view.getByTestId('ide-design-inspector-idle-inputs').textContent).toBe('1');
    expect(view.getByTestId('ide-design-inspector-idle-outputs').textContent).toBe('1');
    expect(view.getByTestId('ide-design-inspector-idle-nodes').textContent).toBe('2');
    expect(view.getByTestId('ide-design-inspector-idle-wires').textContent).toBe('1');
    expect(view.getByTestId('ide-design-inspector-io-state').textContent).toContain('Current I/O');
    expect(view.getByTestId('ide-design-inspector-input-sw0_node').textContent).toContain('SW0');
    expect(view.getByTestId('ide-design-inspector-output-ld0_node').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-inspector-proof-boundary').textContent).toContain('Verify');
    expect(view.getByTestId('ide-design-inspector-proof-boundary').textContent).toContain('proof');
  });

  it('keeps the fixed palette open and hides the context inspector for an empty canvas', () => {
    useCircuitStore.setState({
      circuit: { nodes: [], connections: [] },
      isDirty: false,
      past: [],
      future: [],
    });

    const view = renderSurface();

    expect(view.getByTestId('ide-mode-design')).toHaveAttribute(
      'data-workspace-primitive',
      'fixed-tool-palette'
    );
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.getByTestId('ide-design-dock-palette')).toBeTruthy();
    expect(view.queryByTestId('ide-inspector')).toBeNull();
    expect(view.queryByTestId('ide-design-inspector-canvas-default')).toBeNull();
  });
});
