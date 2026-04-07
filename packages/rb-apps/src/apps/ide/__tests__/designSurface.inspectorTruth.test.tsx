// @vitest-environment jsdom
/**
 * Inspector Truth Overhaul — Slice 8
 *
 * Verifies that the Design inspector presents only student-facing information:
 * - No raw IR diagnostic codes visible to students
 * - No "Compiler diagnostics" developer label
 * - No pipeline-layer staleness rows ("Dirty since verify/export") in the
 *   default inspector view
 * - Live Simulation section is collapsible (not permanently pinned open)
 * - Multi-select does not show a "Single-object state only" dead-end callout
 * - Signal Probe does not render Verify-idiom tick-history buttons
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import type { DesignCompilerStatus } from '../surfaces/DesignSurface';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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
      label: 'LD0',
      position: { x: 200, y: 0 },
      rotation: 0,
      config: {},
      state: {},
    },
  ],
  connections: [
    {
      from: { nodeId: 'sw0_node', portName: 'out' },
      to: { nodeId: 'and0_node', portName: 'a' },
    },
    {
      from: { nodeId: 'and0_node', portName: 'out' },
      to: { nodeId: 'ld0_node', portName: 'in' },
    },
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

function makeSimWithTrace(): RuntimeSimState {
  return {
    tick: 5,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: { sw0_node: 1 },
    signals: { 'sw0_node.out': 1, 'and0_node.out': 0, 'ld0_node.in': 0 },
    trace: [
      { tick: 1, signals: { 'sw0_node.out': 0, 'and0_node.out': 0, 'ld0_node.in': 0 } },
      { tick: 2, signals: { 'sw0_node.out': 1, 'and0_node.out': 0, 'ld0_node.in': 0 } },
      { tick: 3, signals: { 'sw0_node.out': 1, 'and0_node.out': 0, 'ld0_node.in': 0 } },
      { tick: 4, signals: { 'sw0_node.out': 1, 'and0_node.out': 0, 'ld0_node.in': 0 } },
      { tick: 5, signals: { 'sw0_node.out': 1, 'and0_node.out': 0, 'ld0_node.in': 0 } },
    ],
    selectedSignalKey: 'sw0_node.out',
    probes: [{ key: 'sw0_node.out', label: 'SW0' }],
  };
}

/** Compiler status with IR-coded diagnostics attached to and0_node */
function makeStatusWithIrDiagnostics(): DesignCompilerStatus {
  return {
    dirtySinceVerify: true,
    dirtySinceExport: true,
    errorCount: 1,
    warningCount: 0,
    diagnostics: [
      {
        id: 'ir006-test',
        blocking: true,
        code: 'IR006',
        title: 'Combinational loop',
        severity: 'error',
        message: 'Combinational feedback loop detected.',
        hint: ['A signal output feeds back to its own input. This will not synthesize.'],
        owner: { kind: 'node', nodeId: 'and0_node' },
        location: { nodeId: 'and0_node' },
        stage: 'design',
        origin: 'elaborator',
        actions: [],
      },
    ],
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
    compilerStatus?: DesignCompilerStatus;
  } = {}
) {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(circuit), isDirty: false, past: [], future: [] });

  return render(
    <DesignSurface
      runtimeSim={options.sim ?? makePassiveSim()}
      compilerStatus={options.compilerStatus}
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

describe('Inspector Truth — no developer internals exposed to students', () => {
  it('hides raw IR diagnostic codes from the inspector when a node with compiler errors is selected', async () => {
    const view = renderSurface(BASE_CIRCUIT, {
      compilerStatus: makeStatusWithIrDiagnostics(),
    });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-diagnostics')).toBeTruthy();
    });

    // The raw IR code string must not appear anywhere in the inspector
    const inspectorText = view.container.textContent ?? '';
    expect(inspectorText).not.toMatch(/\bIR\d{3}\b/);
  });

  it('does not render a "Compiler diagnostics" label in the inspector', async () => {
    const view = renderSurface(BASE_CIRCUIT, {
      compilerStatus: makeStatusWithIrDiagnostics(),
    });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-diagnostics')).toBeTruthy();
    });

    const diagnosticsEl = view.getByTestId('ide-design-selection-diagnostics');
    expect(diagnosticsEl.textContent).not.toContain('Compiler diagnostics');
  });

  it('does not show "Dirty since verify" or "Dirty since export" in Advanced Details when expanded', async () => {
    const view = renderSurface(BASE_CIRCUIT, {
      compilerStatus: makeStatusWithIrDiagnostics(),
    });

    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });

    // Wait for the section to appear then expand it so children render
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-advanced-toggle')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-inspector-advanced-toggle'));

    await waitFor(() => {
      const section = view.getByTestId('ide-design-inspector-advanced');
      expect(section.getAttribute('data-open')).toBe('true');
    });

    const advancedSection = view.getByTestId('ide-design-inspector-advanced');
    expect(advancedSection.textContent).not.toContain('Dirty since verify');
    expect(advancedSection.textContent).not.toContain('Dirty since export');
  });

  it('shows "Hide" on the Live Simulation toggle (not "Live") — meaning the section is collapsible', async () => {
    const view = renderSurface(BASE_CIRCUIT);

    await waitFor(() => {
      expect(view.getByTestId('ide-design-live-sim-section-toggle')).toBeTruthy();
    });

    // IdeInspectorSection renders a .ide-inspector-toggle-state span that shows
    // "Live" when disableCollapse=true, "Hide" when ordinarily collapsible.
    const toggleBtn = view.getByTestId('ide-design-live-sim-section-toggle');
    const stateSpan = toggleBtn.querySelector('.ide-inspector-toggle-state');
    expect(stateSpan?.textContent).toBe('Hide');
  });

  it('does not show a "Single-object state only" callout when multiple nodes are selected', async () => {
    const view = renderSurface(BASE_CIRCUIT);

    act(() => {
      useLogicViewStore.setState((s) => ({
        ...s,
        selection: {
          nodes: new Set(['sw0_node', 'and0_node']),
          wires: new Set<string>(),
        },
      }));
    });

    // Wait for the multi-select identity to appear
    await waitFor(() => {
      expect(view.getByTestId('ide-design-multiselect-count')).toBeTruthy();
    });

    expect(view.container.textContent).not.toContain('Single-object state only');
  });

  it('does not render tick-history buttons in the Signal Probe section when opened', async () => {
    const view = renderSurface(BASE_CIRCUIT, {
      sim: makeSimWithTrace(),
    });

    // Expand the Signal Probe section so its children render
    await waitFor(() => {
      expect(view.getByTestId('ide-design-signal-probe-toggle')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-signal-probe-toggle'));

    await waitFor(() => {
      const section = view.getByTestId('ide-design-signal-probe');
      expect(section.getAttribute('data-open')).toBe('true');
    });

    // No waveform-style per-tick history buttons — those are a Verify-surface idiom
    const historyPoints = view.container.querySelectorAll('[data-testid="ide-design-signal-history-point"]');
    expect(historyPoints).toHaveLength(0);
  });
});
