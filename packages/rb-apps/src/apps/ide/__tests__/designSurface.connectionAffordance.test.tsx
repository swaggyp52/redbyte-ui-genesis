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
