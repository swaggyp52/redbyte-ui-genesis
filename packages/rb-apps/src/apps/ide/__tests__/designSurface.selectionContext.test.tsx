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

// ─── Single-node selection context ────────────────────────────────────────────

describe('DesignSurface — single-node selection context', () => {
  it('shows friendly type name "Input" instead of raw "INPUT" when node is selected', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectNode('sw0_node'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    const typeEl = view.getByTestId('ide-design-selection-type');
    expect(typeEl.textContent).toBe('Input');
    expect(typeEl.textContent).not.toContain('INPUT');
  });

  it('keeps the student label primary and the friendly type in the identity subtitle', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectNode('sw0_node'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-identity')).toBeTruthy();
    });

    const identity = view.getByTestId('ide-design-selection-identity');
    expect(identity.textContent).toBe('SW0');
    expect(view.getByTestId('ide-design-selection-type').textContent).toBe('Input');
  });

  it('shows identity heading with just friendly type when node has no label', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectNode('and0_node'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-identity')).toBeTruthy();
    });

    const identity = view.getByTestId('ide-design-selection-identity');
    expect(identity.textContent).toContain('AND gate');
    expect(identity.textContent).not.toContain('AND:');
  });
});

// ─── Multi-node selection context ─────────────────────────────────────────────

describe('DesignSurface — multi-node selection context', () => {
  it('shows "N nodes selected" heading instead of "Selected: N nodes"', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-summary')).toBeTruthy();
    });

    const identity = view.getByTestId('ide-design-selection-identity');
    expect(identity.textContent).toContain('2 nodes selected');
  });

  it('shows friendly type names in multi-select type pills', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'and0_node', 'ld0_node']); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-types')).toBeTruthy();
    });

    const pills = view.getByTestId('ide-design-multiselect-types');
    // Friendly names, not raw enum strings
    expect(pills.textContent).toContain('Input: 1');
    expect(pills.textContent).toContain('AND gate: 1');
    expect(pills.textContent).toContain('Output: 1');
    expect(pills.textContent).not.toMatch(/\bINPUT\b/);
    expect(pills.textContent).not.toMatch(/\bAND\b:/);
    expect(pills.textContent).not.toContain('OUTPUT');
  });
});

// ─── Single-node inspector action hierarchy ───────────────────────────────────

describe('DesignSurface — single-node inspector action groups', () => {
  it('trace actions are grouped inside ide-design-trace-group', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectNode('sw0_node'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    // Trace group must exist
    const traceGroup = view.getByTestId('ide-design-trace-group');
    expect(traceGroup).toBeTruthy();

    // Trace actions must live inside the trace group, not at the top level
    const traceBtn = view.getByTestId('ide-design-context-trace');
    expect(traceGroup.contains(traceBtn)).toBe(true);
  });

  it('trace group label reads "Net tracing"', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectNode('sw0_node'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-trace-group')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-trace-group').textContent).toContain('Net tracing');
  });

  it('edit actions (Copy, Duplicate, Rename) appear before trace group in DOM', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectNode('sw0_node'); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    const copyBtn = view.getByTestId('ide-design-copy-btn');
    const traceGroup = view.getByTestId('ide-design-trace-group');

    // Copy button must come before trace group in document order
    const position = copyBtn.compareDocumentPosition(traceGroup);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ─── Multi-select inspector action hierarchy ──────────────────────────────────

describe('DesignSurface — multi-select inspector action groups', () => {
  it('shows an Arrange group with align-left and align-top actions before Danger', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-arrange-group')).toBeTruthy();
    });

    const arrangeGroup = view.getByTestId('ide-design-inspector-arrange-group');
    const dangerGroup = view.getByTestId('ide-design-inspector-danger-group');
    const position = arrangeGroup.compareDocumentPosition(dangerGroup);

    expect(arrangeGroup.textContent).toContain('Arrange');
    expect(view.getByTestId('ide-design-align-left-btn').textContent).toContain('Align left');
    expect(view.getByTestId('ide-design-align-top-btn').textContent).toContain('Align top');
    expect(view.getByTestId('ide-design-distribute-horizontal-btn').textContent).toContain('Distribute horizontally');
    expect((view.getByTestId('ide-design-distribute-horizontal-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('delete button shows node count, not static "selected nodes"', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-delete')).toBeTruthy();
    });

    const deleteBtn = view.getByTestId('ide-design-inspector-delete');
    expect(deleteBtn.textContent).toContain('2');
    expect(deleteBtn.textContent).not.toContain('selected nodes');
  });

  it('does not show "Bulk actions" instructional text', async () => {
    const view = renderSurface();

    act(() => { useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']); });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-summary')).toBeTruthy();
    });

    const summary = view.getByTestId('ide-design-multiselect-summary');
    expect(summary.textContent).not.toContain('Bulk actions');
    expect(summary.textContent).not.toContain('drag to move as a unit');
  });
});
