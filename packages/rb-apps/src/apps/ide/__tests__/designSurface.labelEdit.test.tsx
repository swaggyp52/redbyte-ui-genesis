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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_CIRCUIT: Circuit = {
  nodes: [
    {
      id: 'sw0_node',
      type: 'INPUT',
      label: 'MySwitch',
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
    tick: 1,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: { sw0_node: 1 },
    signals: { 'sw0_node.out': 1, 'ld0_node.in': 1 },
    trace: [{ tick: 1, signals: { 'sw0_node.out': 1, 'ld0_node.in': 1 } }],
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

// ─── Rename button rendering ──────────────────────────────────────────────────

describe('DesignSurface label editing — Rename button visibility', () => {
  it('renders Rename button when a node is selected', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });
  });

  it('Rename button is not disabled when node is not in edit mode', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      const btn = view.getByTestId('ide-design-label-edit-btn');
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });
});

// ─── Rename button opens editor ───────────────────────────────────────────────

describe('DesignSurface label editing — Rename button opens editor', () => {
  it('clicking Rename shows the label input', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-input')).toBeTruthy();
    });
  });

  it('label input is pre-populated with the existing node label', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    });

    await waitFor(() => {
      const input = view.getByTestId('ide-design-label-input') as HTMLInputElement;
      expect(input.value).toBe('MySwitch');
    });
  });

  it('Save button is visible while editing', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-save')).toBeTruthy();
    });
  });
});

// ─── Save commit ──────────────────────────────────────────────────────────────

describe('DesignSurface label editing — Save commits new label', () => {
  it('clicking Save persists the new label to the circuit store', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-input')).toBeTruthy();
    });

    act(() => {
      const input = view.getByTestId('ide-design-label-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Renamed' } });
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-save'));
    });

    await waitFor(() => {
      const node = useCircuitStore.getState().circuit.nodes.find((n) => n.id === 'sw0_node');
      expect(node?.label).toBe('Renamed');
    });
  });

  it('clicking Save emits the updated circuit payload', async () => {
    const onCircuitMutated = vi.fn();
    const view = renderSurface({ onCircuitMutated });

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-input')).toBeTruthy();
    });

    act(() => {
      const input = view.getByTestId('ide-design-label-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'RenamedViaCallback' } });
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-save'));
    });

    await waitFor(() => {
      const node = useCircuitStore.getState().circuit.nodes.find((n) => n.id === 'sw0_node');
      expect(node?.label).toBe('RenamedViaCallback');
    });

    expect(onCircuitMutated).toHaveBeenCalled();
    expect(onCircuitMutated.mock.lastCall?.[0]).toEqual(useCircuitStore.getState().circuit);
  });

  it('pressing Enter in the input commits the label', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-input')).toBeTruthy();
    });

    act(() => {
      const input = view.getByTestId('ide-design-label-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'EnterCommit' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      const node = useCircuitStore.getState().circuit.nodes.find((n) => n.id === 'sw0_node');
      expect(node?.label).toBe('EnterCommit');
    });
  });
});

// ─── Cancel leaves label unchanged ────────────────────────────────────────────

describe('DesignSurface label editing — Cancel discards changes', () => {
  it('clicking Cancel leaves the circuit label unchanged', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-edit-btn')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-label-input')).toBeTruthy();
    });

    act(() => {
      const input = view.getByTestId('ide-design-label-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'WillBeDiscarded' } });
    });

    act(() => {
      fireEvent.click(view.getByTestId('ide-design-label-cancel'));
    });

    await waitFor(() => {
      const node = useCircuitStore.getState().circuit.nodes.find((n) => n.id === 'sw0_node');
      expect(node?.label).toBe('MySwitch');
    });
  });
});

// ─── Ghost button regression ──────────────────────────────────────────────────

describe('DesignSurface label editing — ghost button regression', () => {
  it('ghost edit button shows current label when not editing', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });

    await waitFor(() => {
      const btn = view.getByTestId('ide-design-label-edit-btn');
      expect(btn.textContent).toContain('MySwitch');
    });
  });

  it('ghost edit button shows "Add label…" for a node without a label', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      const btn = view.getByTestId('ide-design-label-edit-btn');
      expect(btn.textContent).toContain('Add label');
    });
  });
});

describe('DesignSurface output signal naming', () => {
  it('persists an output signal name and shows it in the stable inspector', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-name-control')).toBeTruthy();
      expect(view.getByTestId('ide-design-label-edit-btn').textContent).toContain('Add label');
    });

    fireEvent.click(view.getByTestId('ide-design-label-edit-btn'));
    const input = view.getByTestId('ide-design-label-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'result' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const output = useCircuitStore.getState().circuit.nodes.find((node) => node.id === 'ld0_node');
      expect(output?.label).toBe('result');
      expect(view.getByTestId('ide-design-inspector-identity-title').textContent).toBe('result');
      expect(view.getByTestId('ide-design-label-edit-btn').textContent).toContain('result');
    });
  });
});
