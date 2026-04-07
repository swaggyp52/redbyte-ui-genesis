// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import type { VerifyDebugContext } from '../verifyDebug';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

/** A completely passive session: no ticks, not running, no debug context. */
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

function makeDebugContext(tick: number): VerifyDebugContext {
  return {
    signal: 'ld0_node.in',
    tick,
    expected: '1',
    actual: '0',
    inputSnapshot: [{ label: 'SW0', value: '1' }],
  };
}

// ── Test harness ──────────────────────────────────────────────────────────────

const nativeRaf = window.requestAnimationFrame;
const nativeCancelRaf = window.cancelAnimationFrame;

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
      {...overrides}
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
  window.requestAnimationFrame = nativeRaf;
  window.cancelAnimationFrame = nativeCancelRaf;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fireWindowKeyDown(key: string, mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
}

// ── Slice 1: Chrome focus ─────────────────────────────────────────────────────

describe('DesignSurface continued-editing focus (Slice 1)', () => {
  it('does not show a floating canvas inspector when a node is selected', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      // Right inspector identity section must be present (the single authority)
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    // Floating canvas overlay must NOT exist
    expect(view.queryByTestId('ide-node-inspector')).toBeNull();
  });

  it('hides the simulation strip in a passive session with a loaded circuit', () => {
    // Passive sim: tick=0, not running. Circuit has 2 nodes but that alone
    // must not be enough to show the strip.
    const view = renderSurface();

    expect(view.queryByTestId('ide-design-sim-story-strip')).toBeNull();
  });

  it('shows the simulation strip when the simulation is running', () => {
    const view = renderSurface({
      runtimeSim: { ...makePassiveSim(), running: true },
    });

    expect(view.getByTestId('ide-design-sim-story-strip')).toBeTruthy();
  });

  it('shows the simulation strip when a verify signal is linked', () => {
    const view = renderSurface({
      activeVerifySignal: 'ld0_node.in',
    });

    expect(view.getByTestId('ide-design-sim-story-strip')).toBeTruthy();
  });

  it('shows the simulation strip when an external debug context is active', () => {
    const debugContext = makeDebugContext(3);
    const view = renderSurface({
      externalDebugTick: 3,
      externalDebugContext: debugContext,
    });

    expect(view.getByTestId('ide-design-sim-story-strip')).toBeTruthy();
  });
});

// ── Slice 3: Inspector continuity ────────────────────────────────────────────

describe('DesignSurface inspector continuity (Slice 3)', () => {
  it('shows circuit health summary in the inspector when no node is selected', () => {
    const view = renderSurface({
      compilerStatus: {
        dirtySinceVerify: false,
        dirtySinceExport: false,
        errorCount: 2,
        warningCount: 1,
        diagnostics: [],
      },
    });

    // No node selected — idle inspector must show health summary
    expect(view.getByTestId('ide-design-inspector-canvas-default')).toBeTruthy();
  });

  it('health summary reflects the compiler error count from compilerStatus', () => {
    const view = renderSurface({
      compilerStatus: {
        dirtySinceVerify: false,
        dirtySinceExport: false,
        errorCount: 3,
        warningCount: 0,
        diagnostics: [],
      },
    });

    const summary = view.getByTestId('ide-design-inspector-canvas-default');
    expect(summary.textContent).toContain('3');
  });

  it('health summary is hidden when a node is selected', async () => {
    const view = renderSurface();

    // Initially visible
    expect(view.getByTestId('ide-design-inspector-canvas-default')).toBeTruthy();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.queryByTestId('ide-design-inspector-canvas-default')).toBeNull();
    });
  });

  it('health summary reappears after deselecting a node', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.queryByTestId('ide-design-inspector-canvas-default')).toBeNull();
    });

    act(() => {
      useLogicViewStore.getState().clearSelection();
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-canvas-default')).toBeTruthy();
    });
  });
});

// ── Slice 2: Editing power ────────────────────────────────────────────────────

describe('DesignSurface editing power (Slice 2)', () => {
  it('Ctrl+A selects all nodes in the circuit', async () => {
    renderSurface();

    act(() => {
      fireWindowKeyDown('a', { ctrlKey: true });
    });

    await waitFor(() => {
      expect(useLogicViewStore.getState().selection.nodes.size).toBe(2);
    });
  });

  it('Ctrl+X deletes the selected nodes from the circuit', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      fireWindowKeyDown('x', { ctrlKey: true });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(1);
    });

    expect(useCircuitStore.getState().circuit.nodes[0].id).toBe('ld0_node');
  });

  it('double-clicking a non-switch node opens the inline rename input', async () => {
    const view = renderSurface();

    // Select ld0_node (OUTPUT) — INPUT is treated as a switch and skips double-click
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    fireEvent.dblClick(view.getByTestId('node-OUTPUT-ld0_node'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-input')).toBeTruthy();
    });
  });

  it('Arrow keys nudge a multi-node selection by one grid step', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    act(() => {
      fireWindowKeyDown('ArrowRight');
    });

    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      const sw0Node = circuit.nodes.find((node) => node.id === 'sw0_node');
      const ld0Node = circuit.nodes.find((node) => node.id === 'ld0_node');
      expect(sw0Node?.position.x).toBe(16);
      expect(ld0Node?.position.x).toBe(196);
    });
  });

  it('Shift plus Arrow keys nudges a multi-node selection by a coarse step', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    act(() => {
      fireWindowKeyDown('ArrowDown', { shiftKey: true });
    });

    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      const sw0Node = circuit.nodes.find((node) => node.id === 'sw0_node');
      const ld0Node = circuit.nodes.find((node) => node.id === 'ld0_node');
      expect(sw0Node?.position.y).toBe(64);
      expect(ld0Node?.position.y).toBe(64);
    });
  });

  it('advertises the grouped editing loop after multiple nodes are selected', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-summary')).toBeTruthy();
    });

    const summary = view.getByTestId('ide-design-multiselect-summary');
    expect(summary.textContent).toContain('Arrow keys');
    expect(summary.textContent).toContain('Ctrl+D');
  });
});

// ── Slice 4: Canvas navigation & placement hotkeys ────────────────────────────

describe('DesignSurface canvas navigation & placement hotkeys (Slice 4)', () => {
  it('Shift+F with a node selected fits the camera to that node only', async () => {
    renderSurface();

    // Select only sw0_node (position x:0, y:0); ld0_node is at x:180
    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    // Capture camera before fit
    const cameraBefore = useLogicViewStore.getState().camera;

    act(() => {
      fireWindowKeyDown('F', { shiftKey: true });
    });

    await waitFor(() => {
      const cam = useLogicViewStore.getState().camera;
      // Camera must have moved from whatever it was before
      expect(cam).not.toEqual(cameraBefore);
    });

    // Camera center should reflect sw0_node position (0,0), not the midpoint of
    // the full circuit (90,0). The x offset for a single node at x=0 should
    // place world-x=0 at canvas center: camera.x === canvasSize.width/2 * zoom
    // (approximately). At minimum, x must differ from the all-nodes fit.
    const camSingle = useLogicViewStore.getState().camera;

    // Now deselect and re-fit — result must differ from the single-node fit
    act(() => {
      useLogicViewStore.getState().clearSelection();
    });
    act(() => {
      fireWindowKeyDown('F', { shiftKey: true });
    });

    await waitFor(() => {
      const camAll = useLogicViewStore.getState().camera;
      // Single-node fit centers on x=0; all-nodes fit centers on x=90 — x offsets differ
      expect(camAll.x).not.toBeCloseTo(camSingle.x, 1);
    });
  });

  it('Shift+F with no selection fits all nodes without error', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().clearSelection();
      // Reset camera to origin so we can observe a change
      useLogicViewStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    });

    act(() => {
      fireWindowKeyDown('F', { shiftKey: true });
    });

    await waitFor(() => {
      const cam = useLogicViewStore.getState().camera;
      // With 2 nodes in the circuit the fit should move the camera
      expect(cam).not.toEqual({ x: 0, y: 0, zoom: 1 });
    });
  });

  it('pressing "a" enters AND placement mode', async () => {
    const view = renderSurface();

    act(() => {
      fireWindowKeyDown('a');
    });

    await waitFor(() => {
      const label = view.getByTestId('ide-design-placement-label');
      expect(label.textContent).toContain('AND');
    });
  });

  it('pressing "o" enters OR placement mode', async () => {
    const view = renderSurface();

    act(() => {
      fireWindowKeyDown('o');
    });

    await waitFor(() => {
      const label = view.getByTestId('ide-design-placement-label');
      expect(label.textContent).toContain('OR');
    });
  });
});

// ── Slice 5: Canvas-activation-independent keyboard commands ──────────────────

describe('DesignSurface global keyboard commands (Slice 5)', () => {
  it('Ctrl+Z calls onRuntimeUndo regardless of canvas activation state', async () => {
    const onRuntimeUndo = vi.fn();
    renderSurface({ onRuntimeUndo });

    act(() => {
      fireWindowKeyDown('z', { ctrlKey: true });
    });

    await waitFor(() => {
      expect(onRuntimeUndo).toHaveBeenCalledTimes(1);
    });
  });

  it('Ctrl+Y calls onRuntimeRedo regardless of canvas activation state', async () => {
    const onRuntimeRedo = vi.fn();
    renderSurface({ onRuntimeRedo });

    act(() => {
      fireWindowKeyDown('y', { ctrlKey: true });
    });

    await waitFor(() => {
      expect(onRuntimeRedo).toHaveBeenCalledTimes(1);
    });
  });

  it('Delete removes the selected node even when canvas is not active', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes.length).toBe(1);
    });

    expect(useCircuitStore.getState().circuit.nodes[0].id).toBe('ld0_node');
  });

  it('Escape clears selection regardless of canvas activation state', async () => {
    renderSurface();

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    await waitFor(() => {
      expect(useLogicViewStore.getState().selection.nodes.size).toBe(2);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    await waitFor(() => {
      expect(useLogicViewStore.getState().selection.nodes.size).toBe(0);
    });
  });
});
