// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
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

describe('DesignSurface Unified Workbench v3 chrome', () => {
  it('keeps the first look to one toolbar row, semantic status, and stable inspector facts', () => {
    const view = renderSurface();

    expect(view.queryByText('Circuit Designer')).toBeNull();
    expect(view.getByTestId('ide-design-authoring-issues').textContent).toContain('Circuit');
    expect(view.getByTestId('ide-design-authoring-issues').textContent).toContain('Ready for Verify');
    expect(view.getByTestId('ide-design-authoring-summary-status').textContent).toContain('Ready for Verify');
    expect(view.getByTestId('ide-design-inspector-idle-nodes').textContent).toBe('2');
    expect(view.getByTestId('ide-design-inspector-idle-inputs').textContent).toBe('1');
    expect(view.getByTestId('ide-design-canvas-wrap').getAttribute('data-work-object')).toBe('circuit');
    expect(view.queryByTestId('ide-design-canvas-stat-nodes')).toBeNull();
    expect(view.queryByTestId('ide-design-canvas-stat-wires')).toBeNull();
    const zoomStat = view.getByTestId('ide-design-canvas-stat-zoom');
    expect(zoomStat.closest('[data-testid="ide-design-authoring-issues"]')).toBeNull();
    expect(zoomStat.textContent).toContain('%');
  });

  it('keeps direct view controls stable without a reveal toggle or disclosure', () => {
    const view = renderSurface();

    const tray = view.getByTestId('ide-design-canvas-view-tools');
    const toolbar = view.getByTestId('ide-design-toolbar');
    const liveCanvas = view.getByTestId('ide-design-live-canvas');
    expect(tray.getAttribute('data-open')).toBe('true');
    expect(toolbar.contains(tray)).toBe(true);
    expect(liveCanvas.contains(tray)).toBe(false);
    expect(tray.contains(view.getByTestId('ide-design-canvas-controls'))).toBe(true);
    expect(tray.contains(view.getByTestId('ide-design-zoom-out'))).toBe(true);
    expect(tray.contains(view.getByTestId('ide-design-zoom-in'))).toBe(true);
    expect(tray.contains(view.getByTestId('ide-design-zoom-reset'))).toBe(true);
    expect(tray.textContent).toContain('zoom');
    expect(view.queryByTestId('ide-design-shortcut-strip')).toBeNull();
    expect(view.queryByTestId('ide-design-view-tools-toggle')).toBeNull();
    expect(view.queryByTestId('ide-design-fit-circuit-primary')).toBeNull();
    expect(view.container.querySelector('details')).toBeNull();
  });

  it('surfaces verify focus inside the simulation strip instead of the toolbar band', () => {
    const view = renderSurface({
      activeVerifySignal: 'LD0',
      onRuntimeSimSetSelectedSignal: vi.fn(),
    });

    const verifyBadge = view.getByTestId('ide-design-verify-link-badge');
    expect(verifyBadge.closest('[data-testid="ide-design-sim-story-strip"]')).toBeTruthy();
    expect(verifyBadge.closest('[data-testid="ide-design-toolbar"]')).toBeNull();
    expect(view.getByTestId('ide-design-verify-focus').textContent).toContain('Inspect LD0 first');
  });
});
