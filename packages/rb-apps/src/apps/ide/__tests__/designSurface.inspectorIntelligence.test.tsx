// @vitest-environment jsdom
/**
 * Inspector Signal Intelligence — Phase B-9
 *
 * Verifies that the Design inspector actively surfaces signal context:
 * - Driver context panel shows who drives each input port with live value
 * - Input node toggle lets students flip switch values from the inspector
 * - Auto-trace activates on node selection when sim is running
 * - Wire inspector shows a Connection summary row (sender → receiver)
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * SW0(INPUT) --a--> AND --out--> LD0(OUTPUT)
 *                   ^
 * SW1(INPUT) --b---/
 */
const TWO_INPUT_AND_CIRCUIT: Circuit = {
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
      id: 'and0_node',
      type: 'AND',
      position: { x: 150, y: 40 },
      rotation: 0,
      config: {},
      state: {},
    },
    {
      id: 'ld0_node',
      type: 'OUTPUT',
      label: 'LD0',
      position: { x: 300, y: 40 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and0_node', portName: 'a' } },
    { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'and0_node', portName: 'b' } },
    { from: { nodeId: 'and0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
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

/** SW0=HIGH, SW1=LOW, AND output=LOW */
function makeRunningSim(): RuntimeSimState {
  return {
    tick: 3,
    running: true,
    lastAction: 'run',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: { sw0_node: 1, sw1_node: 0 },
    signals: {
      'sw0_node.out': 1,
      'sw1_node.out': 0,
      'and0_node.out': 0,
      'ld0_node.in': 0,
    },
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
  options: {
    sim?: RuntimeSimState;
    onRuntimeSimSetInput?: (nodeId: string, value: 0 | 1) => void;
  } = {}
) {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(circuit), isDirty: false, past: [], future: [] });

  return render(
    <DesignSurface
      runtimeSim={options.sim ?? makePassiveSim()}
      ioRows={[]}
      onRuntimeSimRun={vi.fn()}
      onRuntimeSimPause={vi.fn()}
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
      onRuntimeSimSetSpeed={vi.fn()}
      onRuntimeSimToggleProbe={vi.fn()}
      onRuntimeSimSetInput={options.onRuntimeSimSetInput}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
    />
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Inspector Signal Intelligence — active signal context and controls', () => {
  // ── Slice 1: Driver context panel ───────────────────────────────────────────

  it('shows driver context panel for a gate when sim has values', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, { sim: makeRunningSim() });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-input-drivers')).toBeTruthy();
    });
  });

  it('shows correct HIGH/LOW for each driver port row', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, { sim: makeRunningSim() });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-input-drivers')).toBeTruthy();
    });

    // SW0 (port a) is HIGH, SW1 (port b) is LOW
    const rowA = view.getByTestId('ide-design-driver-row-a');
    const rowB = view.getByTestId('ide-design-driver-row-b');
    expect(rowA.textContent).toContain('HIGH');
    expect(rowB.textContent).toContain('LOW');
  });

  it('hides driver context panel when no sim values are present', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, { sim: makePassiveSim() });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    // Wait for the inspector to fully render with the node selected
    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-current')).toBeTruthy();
    });

    expect(view.container.querySelector('[data-testid="ide-design-input-drivers"]')).toBeNull();
  });

  // ── Slice 2: Input node toggle ───────────────────────────────────────────────

  it('shows input control group when an INPUT node is selected', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, {
      sim: makeRunningSim(),
      onRuntimeSimSetInput: vi.fn(),
    });

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-input-control')).toBeTruthy();
    });
  });

  it('does not show input control group when a non-input node is selected', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, {
      sim: makeRunningSim(),
      onRuntimeSimSetInput: vi.fn(),
    });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-current')).toBeTruthy();
    });

    expect(view.container.querySelector('[data-testid="ide-design-inspector-input-control"]')).toBeNull();
  });

  it('toggle button shows current HIGH state when input is high', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, {
      sim: makeRunningSim(), // sw0_node.out = 1
      onRuntimeSimSetInput: vi.fn(),
    });

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-input-toggle')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-inspector-input-toggle').textContent).toContain('HIGH');
  });

  it('toggle click calls onRuntimeSimSetInput with the flipped value', async () => {
    const onRuntimeSimSetInput = vi.fn();
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, {
      sim: makeRunningSim(), // sw0_node.out = 1
      onRuntimeSimSetInput,
    });

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-input-toggle')).toBeTruthy();
    });

    act(() => {
      view.getByTestId('ide-design-inspector-input-toggle').click();
    });

    expect(onRuntimeSimSetInput).toHaveBeenCalledWith('sw0_node', 0);
  });

  // ── Slice 3: Auto-trace on selection ────────────────────────────────────────

  it('auto-triggers fanout trace on node selection when sim is running', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, { sim: makeRunningSim() });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    await waitFor(() => {
      const traceSpan = view.container.querySelector('[data-testid="ide-design-context-trace-state"]');
      expect(traceSpan?.textContent).not.toBe('No trace locked');
    });
  });

  it('does not auto-trigger trace when sim is not running', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, { sim: makePassiveSim() });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    // Wait for the inspector to fully render with the node selected
    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-current')).toBeTruthy();
    });

    const traceSpan = view.container.querySelector('[data-testid="ide-design-context-trace-state"]');
    expect(traceSpan?.textContent).toBe('No trace locked');
  });

  // ── Slice 4: Wire inspector connection summary ───────────────────────────────

  it('wire inspector shows Connection row with sender and receiver labels', async () => {
    const view = renderSurface(TWO_INPUT_AND_CIRCUIT, { sim: makeRunningSim() });

    act(() => {
      useLogicViewStore.setState((s) => ({
        ...s,
        selection: {
          nodes: new Set<string>(),
          wires: new Set(['sw0_node.out-and0_node.a']),
        },
      }));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-wire-connection')).toBeTruthy();
    });

    const row = view.getByTestId('ide-design-wire-connection');
    expect(row.textContent).toContain('SW0');
    expect(row.textContent).toContain('and0');
  });
});
