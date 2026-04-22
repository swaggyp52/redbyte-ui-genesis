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

const AND_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'a_in',
      type: 'INPUT',
      label: 'A',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    },
    {
      id: 'b_in',
      type: 'INPUT',
      label: 'B',
      position: { x: 0, y: 80 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    },
    {
      id: 'and0',
      type: 'AND',
      label: '',
      position: { x: 120, y: 40 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    { from: { nodeId: 'a_in', portName: 'out' }, to: { nodeId: 'and0', portName: 'a' } },
    { from: { nodeId: 'b_in', portName: 'out' }, to: { nodeId: 'and0', portName: 'b' } },
  ],
};

const CUSTOM_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'mux0',
      type: 'MyMux',
      label: 'U1',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [],
};

function makeEmptyRuntime(): RuntimeSimState {
  return {
    tick: 0,
    running: false,
    lastAction: 'reset',
    speedHz: 10,
    irHash: '',
    traceHash: '',
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
  props: Partial<React.ComponentProps<typeof DesignSurface>> = {}
) {
  return render(
    <DesignSurface
      runtimeSim={makeEmptyRuntime()}
      ioRows={[]}
      onRuntimeSimRun={vi.fn()}
      onRuntimeSimPause={vi.fn()}
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
      onRuntimeSimSetSpeed={vi.fn()}
      onRuntimeSimToggleProbe={vi.fn()}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
      onGoToHardware={vi.fn()}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
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

describe('DesignSurface selection teaching profile (identity card)', () => {
  it('labels combinational gates and explains no memory', async () => {
    useCircuitStore.setState({
      circuit: structuredClone(AND_CIRCUIT),
      isDirty: false,
      past: [],
      future: [],
    });
    const view = renderSurface(AND_CIRCUIT);

    act(() => {
      useLogicViewStore.getState().selectNode('and0');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-meaning')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-inspector-part-kind').textContent).toBe('Combinational');
    expect(view.getByTestId('ide-design-inspector-what-it-is').textContent).toContain('Pure Boolean logic');
    expect(view.queryByTestId('ide-design-inspector-structure-hint')).toBeNull();
  });

  it('labels saved custom blocks and surfaces description', async () => {
    useCircuitStore.setState({
      circuit: structuredClone(CUSTOM_CIRCUIT),
      isDirty: false,
      past: [],
      future: [],
    });
    const view = renderSurface(CUSTOM_CIRCUIT, {
      customComponentTypes: [
        {
          type: 'MyMux',
          title: 'My Mux',
          description: 'Custom 2:1 mux for lab 3.',
        },
      ],
    });

    act(() => {
      useLogicViewStore.getState().selectNode('mux0');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-what-it-is').textContent).toContain('Custom 2:1 mux');
    });

    expect(view.getByTestId('ide-design-inspector-part-kind').textContent).toBe('Saved component');
    expect(view.getByTestId('ide-design-inspector-structure-hint').textContent).toContain('Internals are fixed');
  });
});
