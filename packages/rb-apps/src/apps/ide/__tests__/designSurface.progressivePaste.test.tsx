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

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// sw0_node at (100, 200) so we can assert exact paste positions.

const KNOWN_X = 100;
const KNOWN_Y = 200;
const STEP = 40;

const BASE_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'sw0_node',
      type: 'INPUT',
      position: { x: KNOWN_X, y: KNOWN_Y },
      rotation: 0,
      config: {},
      state: { isOn: 1 },
    },
    {
      id: 'ld0_node',
      type: 'OUTPUT',
      position: { x: 300, y: KNOWN_Y },
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
    tick: 2,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: { sw0_node: 1 },
    signals: { 'sw0_node.out': 1, 'ld0_node.in': 1 },
    trace: [{ tick: 2, signals: { 'sw0_node.out': 1, 'ld0_node.in': 1 } }],
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
              width, height,
              x: 0, y: 0, top: 0, left: 0, bottom: height, right: width,
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

function getNodePosition(nodeId: string): { x: number; y: number } | undefined {
  const node = useCircuitStore.getState().circuit.nodes.find((n) => n.id === nodeId);
  return node?.position;
}

function getNodesSortedByX(): Array<{ id: string; x: number; y: number }> {
  return useCircuitStore
    .getState()
    .circuit.nodes.map((n) => ({ id: n.id, x: n.position?.x ?? 0, y: n.position?.y ?? 0 }))
    .sort((a, b) => a.x - b.x);
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

afterEach(() => {
  cleanup();
});

// ─── Progressive paste offset ─────────────────────────────────────────────────

describe('DesignSurface progressive paste — repeated Ctrl+V increments offset', () => {
  it('first paste places copy at origin + 1*STEP from original', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    // Copy
    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' });
    });

    // Paste once
    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(3);
    });

    // The new node should be at (KNOWN_X + STEP*1, KNOWN_Y + STEP*1) = (140, 240)
    const newNodes = useCircuitStore.getState().circuit.nodes
      .filter((n) => n.id !== 'sw0_node' && n.id !== 'ld0_node');
    expect(newNodes).toHaveLength(1);
    expect(newNodes[0]?.position?.x).toBe(KNOWN_X + STEP);
    expect(newNodes[0]?.position?.y).toBe(KNOWN_Y + STEP);
  });

  it('second paste places copy at origin + 2*STEP (does not stack with first)', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' });
    });

    // Paste twice
    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(3);
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(4);
    });

    const extraNodes = useCircuitStore.getState().circuit.nodes
      .filter((n) => n.id !== 'sw0_node' && n.id !== 'ld0_node')
      .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));

    // First copy: (140, 240), second copy: (180, 280)
    expect(extraNodes[0]?.position?.x).toBe(KNOWN_X + STEP);
    expect(extraNodes[0]?.position?.y).toBe(KNOWN_Y + STEP);
    expect(extraNodes[1]?.position?.x).toBe(KNOWN_X + STEP * 2);
    expect(extraNodes[1]?.position?.y).toBe(KNOWN_Y + STEP * 2);
  });

  it('third paste continues the staircase', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' });
    });

    for (let i = 0; i < 3; i++) {
      act(() => {
        fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
      });
    }

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(5);
    });

    const extraNodes = useCircuitStore.getState().circuit.nodes
      .filter((n) => n.id !== 'sw0_node' && n.id !== 'ld0_node')
      .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));

    expect(extraNodes[0]?.position?.x).toBe(KNOWN_X + STEP);
    expect(extraNodes[1]?.position?.x).toBe(KNOWN_X + STEP * 2);
    expect(extraNodes[2]?.position?.x).toBe(KNOWN_X + STEP * 3);
  });
});

// ─── Step reset on new copy ────────────────────────────────────────────────────

describe('DesignSurface progressive paste — clipboard change resets step', () => {
  it('step resets when clipboard content changes (new copy)', async () => {
    renderSurface();

    // Copy sw0_node
    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' });
    });

    // Paste twice to advance step to 2
    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(3);
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(4);
    });

    // Copy ld0_node — this should reset the step
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    // Get ld0_node position for origin tracking
    const ld0Position = getNodePosition('ld0_node')!;

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' });
    });

    // Paste once — should place at ld0_position + 1*STEP (not 3*STEP)
    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(5);
    });

    const afterReset = useCircuitStore.getState().circuit.nodes
      .filter((n) => n.id !== 'sw0_node' && n.id !== 'ld0_node')
      .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));

    // The latest copy of ld0_node should be at ld0.x + STEP (step reset to 1)
    const latestCopy = afterReset.at(-1);
    expect(latestCopy?.position?.x).toBe(ld0Position.x + STEP);
    expect(latestCopy?.position?.y).toBe(ld0Position.y + STEP);
  });
});

// ─── Progressive duplicate ────────────────────────────────────────────────────

describe('DesignSurface progressive paste — repeated Ctrl+D chains offset', () => {
  it('first Ctrl+D places copy at selection origin + STEP', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(3);
    });

    const extraNodes = useCircuitStore.getState().circuit.nodes
      .filter((n) => n.id !== 'sw0_node' && n.id !== 'ld0_node');

    expect(extraNodes).toHaveLength(1);
    expect(extraNodes[0]?.position?.x).toBe(KNOWN_X + STEP);
    expect(extraNodes[0]?.position?.y).toBe(KNOWN_Y + STEP);
  });

  it('second Ctrl+D (new selection at step1 pos) advances another STEP', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    // First duplicate
    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(3);
    });

    // Second duplicate — selection is now the first copy at (KNOWN_X+STEP, KNOWN_Y+STEP)
    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'd' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(4);
    });

    const extraNodes = useCircuitStore.getState().circuit.nodes
      .filter((n) => n.id !== 'sw0_node' && n.id !== 'ld0_node')
      .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));

    // Chain: (100,200) → first copy (140,240) → second copy (180,280)
    expect(extraNodes[0]?.position?.x).toBe(KNOWN_X + STEP);      // 140
    expect(extraNodes[0]?.position?.y).toBe(KNOWN_Y + STEP);      // 240
    expect(extraNodes[1]?.position?.x).toBe(KNOWN_X + STEP * 2);  // 180
    expect(extraNodes[1]?.position?.y).toBe(KNOWN_Y + STEP * 2);  // 280
  });
});

// ─── Selection preservation regression ────────────────────────────────────────

describe('DesignSurface progressive paste — pasted/duplicated nodes stay selected', () => {
  it('pasted nodes are selected after Ctrl+V', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'c' });
    });

    act(() => {
      fireEvent.keyDown(window, { ctrlKey: true, key: 'v' });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(3);
    });

    const newNodeId = useCircuitStore.getState().circuit.nodes
      .find((n) => n.id !== 'sw0_node' && n.id !== 'ld0_node')?.id;

    expect(newNodeId).toBeDefined();
    expect(useLogicViewStore.getState().selection.nodes.has(newNodeId!)).toBe(true);
    // Original sw0_node should no longer be selected
    expect(useLogicViewStore.getState().selection.nodes.has('sw0_node')).toBe(false);
  });
});

// ─── serializeCluster origin fields ──────────────────────────────────────────

import { serializeCluster } from '../designClipboard';

describe('serializeCluster — origin fields', () => {
  it('stores exact bounding-box origin as originX/originY', () => {
    const circuit = useCircuitStore.getState().circuit;
    const cluster = serializeCluster(circuit, new Set(['sw0_node']));
    expect(cluster.originX).toBe(KNOWN_X);
    expect(cluster.originY).toBe(KNOWN_Y);
  });

  it('origin reflects bounding-box min when multiple nodes selected', () => {
    // ld0_node is at (300, 200), sw0_node at (100, 200) — bounding box min = (100, 200)
    const circuit = useCircuitStore.getState().circuit;
    const cluster = serializeCluster(circuit, new Set(['sw0_node', 'ld0_node']));
    expect(cluster.originX).toBe(KNOWN_X); // min of 100 and 300
    expect(cluster.originY).toBe(KNOWN_Y);
  });
});
