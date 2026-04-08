// @vitest-environment jsdom
/**
 * Gate Type Swap + Inspector Rationalization — Phase B-10
 *
 * Gate swap: students can change a gate's type from the inspector without
 * delete-and-replace, preserving all existing connections.
 *
 * Inspector cleanup: Signal/State section removes redundant dev-facing rows
 * (Driver/Source, Fan-in/Fan-out, Board mapping duplicate, Probe state).
 * Advanced Details stops showing raw IR diagnostic codes.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** SW0 → AND → LD0 with both input connections */
const AND_CIRCUIT: Circuit = {
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
      id: 'gate0',
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
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'gate0', portName: 'a' } },
    { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'gate0', portName: 'b' } },
    { from: { nodeId: 'gate0', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
  ],
};

/** AND3 gate for 3-input family tests */
const AND3_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'gate0',
      type: 'AND3',
      position: { x: 150, y: 40 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [],
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

function installResizeObserver(width = 1320, height = 720) {
  class ImmediateResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; }
    observe(target: Element) {
      this.callback([{ target, contentRect: { width, height, x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, toJSON: () => ({}) } } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
}

function renderSurface(circuit: Circuit) {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(circuit), isDirty: false, past: [], future: [] });
  return render(
    <DesignSurface
      runtimeSim={makePassiveSim()}
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
  useLayoutStore.getState().resetLayout();
  useLogicViewStore.setState({
    camera: { x: 0, y: 0, zoom: 1 },
    selection: { nodes: new Set<string>(), wires: new Set<string>() },
    toolMode: 'select',
    interactionMode: 'idle',
  });
});

afterEach(() => {
  cleanup();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Gate Type Swap — Phase B-10', () => {
  it('shows a Swap type group when a 2-input logic gate is selected', async () => {
    const view = renderSurface(AND_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-swap-group')).toBeTruthy();
    });
  });

  it('swap chips show the other gates in the 2-input family (not the current type)', async () => {
    const view = renderSurface(AND_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-swap-group')).toBeTruthy();
    });

    // Current type AND should NOT appear as a swap chip (already selected)
    expect(view.queryByTestId('ide-design-swap-and')).toBeNull();
    // Other family members should appear
    expect(view.getByTestId('ide-design-swap-nand')).toBeTruthy();
    expect(view.getByTestId('ide-design-swap-or')).toBeTruthy();
    expect(view.getByTestId('ide-design-swap-nor')).toBeTruthy();
    expect(view.getByTestId('ide-design-swap-xor')).toBeTruthy();
    expect(view.getByTestId('ide-design-swap-xnor')).toBeTruthy();
  });

  it('clicking a swap chip changes the node type in the circuit store', async () => {
    const view = renderSurface(AND_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-swap-nand')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-swap-nand'));

    await waitFor(() => {
      const node = useCircuitStore.getState().circuit.nodes.find((n) => n.id === 'gate0');
      expect(node?.type).toBe('NAND');
    });
  });

  it('swapping preserves all connections', async () => {
    const view = renderSurface(AND_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-swap-nor')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-swap-nor'));

    await waitFor(() => {
      const { circuit } = useCircuitStore.getState();
      // Connections should be intact: 2 inputs + 1 output = 3
      expect(circuit.connections.length).toBe(3);
      // The NOR gate node should exist
      const node = circuit.nodes.find((n) => n.id === 'gate0');
      expect(node?.type).toBe('NOR');
    });
  });

  it('shows swap chips for 3-input gates with the correct 3-input family', async () => {
    const view = renderSurface(AND3_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-swap-group')).toBeTruthy();
    });

    // AND3 itself should not appear
    expect(view.queryByTestId('ide-design-swap-and3')).toBeNull();
    // 3-input family members should appear
    expect(view.getByTestId('ide-design-swap-nand3')).toBeTruthy();
    expect(view.getByTestId('ide-design-swap-or3')).toBeTruthy();
    expect(view.getByTestId('ide-design-swap-nor3')).toBeTruthy();
    expect(view.getByTestId('ide-design-swap-xor3')).toBeTruthy();
    // 2-input gates should NOT appear in the 3-input family
    expect(view.queryByTestId('ide-design-swap-and')).toBeNull();
    expect(view.queryByTestId('ide-design-swap-nand')).toBeNull();
  });

  it('does not show a Swap type group when a non-swappable node is selected', async () => {
    const view = renderSurface(AND_CIRCUIT);

    // Select INPUT node — not in any swap family
    act(() => { useLogicViewStore.getState().selectNode('sw0_node'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-edit-group')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-design-swap-group')).toBeNull();
  });
});

describe('Inspector Signal/State rationalization — Phase B-10', () => {
  it('Signal/State section does not show a "Driver / Source" row', async () => {
    const view = renderSurface(AND_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-inspector')).toBeTruthy();
    });

    // "Driver / Source" row should be absent
    expect(view.container.querySelector('[data-testid="ide-design-context-inspector"]')?.textContent).not.toContain('Driver / Source');
  });

  it('Signal/State section does not show a "Fan-in / Fan-out" row', async () => {
    const view = renderSurface(AND_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-inspector')).toBeTruthy();
    });

    expect(view.container.querySelector('[data-testid="ide-design-context-inspector"]')?.textContent).not.toContain('Fan-in');
  });

  it('Signal/State section still shows Current, Previous, Transition rows', async () => {
    const view = renderSurface(AND_CIRCUIT);

    act(() => { useLogicViewStore.getState().selectNode('gate0'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-current')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-context-previous')).toBeTruthy();
    expect(view.getByTestId('ide-design-context-transition')).toBeTruthy();
  });
});
