// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

const EMPTY_CIRCUIT: Circuit = {
  nodes: [],
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

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback(
        [{
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
        } as ResizeObserverEntry],
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
  useCircuitStore.setState({
    circuit: structuredClone(EMPTY_CIRCUIT),
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

describe('DesignSurface placement mode', () => {
  it('enters explicit placement mode from the palette without spawning immediately', async () => {
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-palette-and'));

    expect(useCircuitStore.getState().circuit.nodes).toHaveLength(0);
    expect(view.getByTestId('ide-design-palette-and').getAttribute('aria-pressed')).toBe('true');
    expect(view.queryByTestId('ide-design-empty-state')).toBeNull();

    await waitFor(() => {
      expect(view.getByTestId('ide-design-placement-cue').textContent).toContain('AND gate');
    });

    expect(view.getByTestId('ide-design-live-canvas').getAttribute('data-placement-active')).toBe('1');
    expect(useLogicViewStore.getState().interactionMode).toBe('placing');
  });

  it('places exactly one node on blank canvas click and returns to select mode', async () => {
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-palette-and'));
    fireEvent.click(view.getByTestId('ide-design-live-canvas'), { clientX: 480, clientY: 280 });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes).toHaveLength(1);
    });

    const circuit = useCircuitStore.getState().circuit;
    expect(circuit.nodes[0]?.type).toBe('AND');
    expect(useLogicViewStore.getState().selection.nodes.has(circuit.nodes[0]?.id ?? '')).toBe(true);
    expect(useLogicViewStore.getState().interactionMode).toBe('idle');
    expect(view.queryByTestId('ide-design-placement-cue')).toBeNull();
    expect(view.getByTestId('ide-design-live-canvas').getAttribute('data-placement-active')).toBe('0');
  });

  it('cancels placement with Escape without mutating the circuit', async () => {
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-palette-input'));
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(view.queryByTestId('ide-design-placement-cue')).toBeNull();
    });

    expect(useCircuitStore.getState().circuit.nodes).toHaveLength(0);
    expect(useLogicViewStore.getState().interactionMode).toBe('idle');
    expect(view.getByTestId('ide-design-action-toast').textContent).toContain('Cancelled placing Input');
  });

  it('cancels placement when the student switches tools', async () => {
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-palette-output'));
    fireEvent.click(view.getByTestId('ide-design-tool-wire'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-design-placement-cue')).toBeNull();
    });

    expect(useCircuitStore.getState().circuit.nodes).toHaveLength(0);
    expect(useLogicViewStore.getState().toolMode).toBe('wire');
    expect(useLogicViewStore.getState().interactionMode).toBe('idle');
  });
});
