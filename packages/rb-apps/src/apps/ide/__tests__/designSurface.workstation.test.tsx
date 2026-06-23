// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { IdeDiagnostic } from '../diagnostics';
import type { RuntimeSimState } from '../projectRuntime';
import type { MacroDefinition } from '../macros/MacroLibrary';
import { deriveTimingGuidance } from '../timingGuidance';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

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

const nativeRaf = window.requestAnimationFrame;
const nativeCancelRaf = window.cancelAnimationFrame;

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 6,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: { sw0_node: 1 },
    signals: {
      'sw0_node.out': 1,
      'ld0_node.in': 1,
    },
    trace: [
      {
        tick: 5,
        signals: {
          'sw0_node.out': 0,
          'ld0_node.in': 0,
        },
      },
      {
        tick: 6,
        signals: {
          'sw0_node.out': 1,
          'ld0_node.in': 1,
        },
      },
    ],
    selectedSignalKey: null,
    probes: [],
  };
}

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

async function openDesignLibrary(view: ReturnType<typeof renderSurface>) {
  if (view.queryByTestId('ide-left-dock')) return;
  fireEvent.click(view.getByTestId('ide-workbench-dock-toggle-left'));
  await waitFor(() => {
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
  });
}

const FIXTURE_MACRO: MacroDefinition = {
  id: 'macro-and-gate',
  name: 'AND Gate',
  createdAt: 1710000000000,
  inputs: [
    { id: 'input:node-v2-1.a', label: 'A', nodeId: 'node-v2-1', portName: 'a' },
    { id: 'input:node-v2-1.b', label: 'B', nodeId: 'node-v2-1', portName: 'b' },
  ],
  outputs: [{ id: 'output:node-v2-1.out', label: 'Q', nodeId: 'node-v2-1', portName: 'out' }],
  cluster: {
    nodes: [
      {
        originalId: 'node-v2-1',
        type: 'AND',
        x: 0,
        y: 0,
        config: {},
        state: {},
      },
    ],
    connections: [],
  },
};

const WARNING_DIAGNOSTIC: IdeDiagnostic = {
  id: 'warn-floating-output',
  severity: 'warn',
  blocking: false,
  code: 'RBD2001',
  title: 'Floating output',
  message: 'Output pin is not driven.',
  hint: ['Connect a driver before relying on this output.'],
  owner: {
    kind: 'node',
    nodeId: 'ld0_node',
  },
  origin: 'ir',
  stage: 'design',
  actions: [],
};

const ERROR_DIAGNOSTIC: IdeDiagnostic = {
  id: 'error-floating-output',
  severity: 'error',
  blocking: true,
  code: 'RBD1001',
  title: 'Unconnected output',
  message: 'Output pin has no source driver.',
  hint: ['Wire a gate or input into this output pin.'],
  owner: {
    kind: 'node',
    nodeId: 'ld0_node',
  },
  origin: 'ir',
  stage: 'design',
  actions: [],
};

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

describe('DesignSurface workstation redesign', () => {
  it('folds workflow CTAs into the single design workspace header', () => {
    const view = renderSurface();

    expect(view.getByTestId('ide-design-workspace-header').textContent).toContain('Design');
    expect(view.getByTestId('ide-design-workspace-header').textContent).toContain('Canvas');
    expect(view.getByTestId('ide-design-command-strip-primary-cta').textContent).toContain('Open Verify');
    expect(view.getByTestId('ide-design-command-strip-secondary-cta').textContent).toContain('Project');
  });

  it('keeps starter guidance compact while preserving next action and detail access', () => {
    const view = renderSurface({
      starterContext: {
        name: '2-Bit Up Counter (Basys3)',
        lab: 'Sequential + Waveforms',
        concept: 'Board clock',
        summary: 'On-chip 2-bit counter clocked by CLK100MHZ with switch enable and LED outputs.',
        expectedBehavior: 'With SW0 high, the counter advances on each rising edge. BTNC resets the count.',
        nextAction: 'In Verify: confirm CLK100MHZ auto-runs before trusting the counter.',
      },
    });

    expect(view.getByTestId('ide-design-starter-banner-title').textContent).toContain(
      '2-Bit Up Counter'
    );
    expect(view.getByTestId('ide-design-starter-banner-next-action').textContent).toContain(
      'In Verify'
    );
    expect(view.getByTestId('ide-design-starter-go-to-verify').textContent).toContain('Open Verify');

    const details = view.getByTestId('ide-design-starter-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(view.getByTestId('ide-design-starter-details-summary').textContent).toContain(
      'Starter brief'
    );
    expect(view.getByTestId('ide-design-starter-details-body').textContent).toContain(
      'Expected behavior'
    );
  });

  it('keeps the V2 canvas library fixed while moving idle actions into the workspace context bar', async () => {
    const view = renderSurface();

    await waitFor(() => {
      expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    });
    expect(view.getByTestId('ide-design-dock-palette')).toBeTruthy();
    expect(view.queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(view.queryByTestId('ide-inspector')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(view.getByTestId('ide-design-v2-context-bar').getAttribute('data-context-state')).toBe('canvas');
    expect(view.getByTestId('ide-design-v2-context-title').textContent).toBe('Canvas ready');
    expect(view.getByTestId('ide-design-workspace-io-state').textContent).toContain('Current I/O');
    expect(view.getByTestId('ide-design-workspace-input-sw0_node').textContent).toContain('SW0');
    expect(view.getByTestId('ide-design-workspace-output-ld0_node').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-context-add-boundary-io')).toBeTruthy();
    expect(view.getByTestId('ide-design-context-add-and')).toBeTruthy();
    expect(view.getByTestId('ide-design-context-open-verify')).toBeTruthy();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-inspector')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-v2-context-bar').getAttribute('data-context-state')).toBe('node');
    expect(view.getByTestId('ide-design-v2-context-title').textContent).toContain('Output');
    expect(view.getByTestId('ide-design-context-rename')).toBeTruthy();
    expect(view.getByTestId('ide-design-context-duplicate')).toBeTruthy();
    expect(view.getByTestId('ide-design-context-delete')).toBeTruthy();
    expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    expect(view.queryByTestId('ide-design-live-sim-section')).toBeNull();
    expect(view.getByTestId('ide-design-sim-story-strip')).toBeTruthy();
    expect(view.queryByTestId('ide-design-toolbar-sim-controls')).toBeNull();
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
  });

  it('keeps the selection inspector pinned open instead of collapsing it behind a restore rail', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-inspector')).toBeTruthy();
    });

    expect(view.queryByTestId('ide-workbench-dock-collapse-right')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
  });

  it('shows contextual inspector data, trace actions, and a compact live state table', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-current').textContent).toBe('1');
    });

    expect(view.getByTestId('ide-design-context-current').textContent).toBe('1');
    expect(view.getByTestId('ide-design-context-previous').textContent).toBe('0');
    expect(view.getByTestId('ide-design-context-transition').textContent).toContain('rising');
    expect(view.getByTestId('ide-design-context-last-transition').textContent).toBe('6');
    // Board mapping is shown in the identity card (not Signal/State section) — cleaned up in B-10
    expect(view.getByTestId('ide-design-inspector-identity-card').textContent).toContain('LD0 -> U16');
    const controlBar = view.getByTestId('ide-design-control-bar');
    expect(controlBar.contains(view.getByTestId('ide-design-authoring-issues'))).toBe(true);
    expect(controlBar.contains(view.getByTestId('ide-design-sim-story-strip'))).toBe(true);
    expect(view.queryByTestId('ide-design-shortcut-strip')).toBeNull();
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('Tick 6');
    expect(view.getByTestId('ide-design-sim-story-summary').textContent).toContain('SW0');
    expect(view.getByTestId('ide-design-sim-story-summary').textContent).toContain('LD0');
    expect(view.queryByTestId('ide-design-toolbar-sim-controls')).toBeNull();

    fireEvent.click(view.getByTestId('ide-design-context-trace'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-active-trace').textContent).toContain('What feeds LD0 · in');
    });
  });

  it('uses contract timing guidance for the live clock pill instead of regex clock labels', async () => {
    const clockGuidance = deriveTimingGuidance({
      schedule: 'clocked_macro',
      reason: 'circuit-sequential',
      analysis: {
        hasClockedMacros: true,
        hasClockNet: true,
        sequentialNodes: [{ id: 'dff0', type: 'DFlipFlop', clockPort: 'CLK' }],
        clockSource: 'circuit',
        clockNetName: 'phase_driver',
      },
      needsSimClockInjection: false,
      clockSignalName: 'phase_driver',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      hasUnsupportedTemporal: false,
      temporalIssues: [],
    });

    const view = renderSurface({
      ioRows: [
        { id: 'phase_driver', nodeId: 'sw0_node', label: 'Phase Driver', pin: 'V17', port: 'out', direction: 'in' },
        { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' },
      ],
      timingGuidance: clockGuidance,
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-sim-story-clock').textContent).toContain(
        'Phase Driver rising edge'
      );
    });
  });

  it('bridges verify-selected signals back into Design focus and trace state', async () => {
    const setSelectedSignal = vi.fn();
    const view = renderSurface({
      activeVerifySignal: 'LD0',
      onRuntimeSimSetSelectedSignal: setSelectedSignal,
    });

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('ld0_node.in');
    });

    expect(view.getByTestId('ide-design-verify-link-badge').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-verify-focus').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-active-trace').textContent).toContain('Verify: what drives LD0 · in');
  });

  it('adds a replay causation cue for verify-linked signal focus', async () => {
    const setSelectedSignal = vi.fn();
    const view = renderSurface({
      activeVerifySignal: 'LD0',
      onRuntimeSimSetSelectedSignal: setSelectedSignal,
      externalDebugTick: 6,
      externalDebugSignals: new Map<string, 0 | 1>([
        ['sw0_node.out', 1],
        ['ld0_node.in', 1],
      ]),
    });

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('ld0_node.in');
      expect(view.getByTestId('ide-design-replay-causation')).toBeTruthy();
    });

    const cue = view.getByTestId('ide-design-replay-causation').textContent ?? '';
    expect(cue).toContain('Rose 0 to 1 at t6');
    expect(cue).toContain('upstream path from SW0');
    expect(cue).toContain('inspect LD0 first');
  });

  it('gives verify-linked signal focus a structural landing target inside the inspector', async () => {
    const setSelectedSignal = vi.fn();
    const view = renderSurface({
      activeVerifySignal: 'LD0',
      onRuntimeSimSetSelectedSignal: setSelectedSignal,
    });

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('ld0_node.in');
    });

    expect(view.getByTestId('ide-design-inspector-identity-subtitle').textContent).toContain('Verify focus');
    expect(view.getByTestId('ide-design-inspector-identity-title').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-inspector-identity-title').textContent).toContain('Input');
    expect(view.getByTestId('ide-design-inspector-next-step').textContent).toContain('LD0');

    fireEvent.click(view.getByTestId('ide-design-inspector-focus-node'));

    await waitFor(() => {
      expect(Array.from(useLogicViewStore.getState().selection.nodes)).toEqual(['ld0_node']);
    });

    expect(view.getByTestId('ide-design-context-trace')).toBeTruthy();
    expect(view.getByTestId('ide-design-active-trace').textContent).toContain('Verify: what drives LD0 · in');
  });

  it('resolves canonical verify aliases through io row ids for signal-first Design focus', async () => {
    useCircuitStore.setState({
      circuit: structuredClone({
        ...BASE_CIRCUIT,
        nodes: [
          ...BASE_CIRCUIT.nodes,
          {
            id: 'q1_out',
            type: 'OUTPUT',
            position: { x: 320, y: 0 },
            rotation: 0,
            config: {},
            state: {},
            label: 'LD1',
          },
        ],
        connections: [...BASE_CIRCUIT.connections],
      }),
      isDirty: false,
      past: [],
      future: [],
    });

    const setSelectedSignal = vi.fn();
    const runtimeSim = makeRuntimeSim();
    runtimeSim.signals = {
      ...runtimeSim.signals,
      'q1_out.in': 1,
    };
    runtimeSim.trace = runtimeSim.trace.map((sample) => ({
      ...sample,
      signals: {
        ...sample.signals,
        'q1_out.in': sample.tick === 6 ? 1 : 0,
      },
    }));

    const view = renderSurface({
      activeVerifySignal: 'q1',
      onRuntimeSimSetSelectedSignal: setSelectedSignal,
      runtimeSim,
      ioRows: [
        { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'V17', port: 'out', direction: 'in' },
        { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' },
        { id: 'q1', nodeId: 'q1_out', label: 'LD1', pin: 'E19', port: 'in', direction: 'out' },
      ],
    });

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('q1_out.in');
    });

    expect(view.getByTestId('ide-design-verify-link-badge').textContent).toContain('Verify focus q1');
    expect(view.getByTestId('ide-design-verify-focus').textContent).toContain('Inspect LD1 first');
    expect(view.getByTestId('ide-design-active-trace').textContent).toContain('Verify: what drives LD1 · in');
    expect(view.getByTestId('ide-design-inspector-identity-subtitle').textContent).toContain('Verify focus q1');
    expect(view.getByTestId('ide-design-inspector-identity-title').textContent).toContain('LD1');
    expect(view.getByTestId('ide-design-inspector-next-step').textContent).toContain('q1');
    expect(view.getByTestId('ide-design-inspector-next-step').textContent).toContain('LD1');

    fireEvent.click(view.getByTestId('ide-design-inspector-focus-node'));

    await waitFor(() => {
      expect(Array.from(useLogicViewStore.getState().selection.nodes)).toEqual(['q1_out']);
    });
  });

  it('prefers io row ids over conflicting io row labels when resolving verify aliases', async () => {
    useCircuitStore.setState({
      circuit: structuredClone({
        ...BASE_CIRCUIT,
        nodes: [
          ...BASE_CIRCUIT.nodes,
          {
            id: 'q1_out',
            type: 'OUTPUT',
            position: { x: 320, y: 0 },
            rotation: 0,
            config: {},
            state: {},
            label: 'LD1',
          },
        ],
        connections: [...BASE_CIRCUIT.connections],
      }),
      isDirty: false,
      past: [],
      future: [],
    });

    const setSelectedSignal = vi.fn();
    const runtimeSim = makeRuntimeSim();
    runtimeSim.signals = {
      ...runtimeSim.signals,
      'q1_out.in': 1,
      'ld0_node.in': 0,
    };
    runtimeSim.trace = runtimeSim.trace.map((sample) => ({
      ...sample,
      signals: {
        ...sample.signals,
        'q1_out.in': sample.tick === 6 ? 1 : 0,
        'ld0_node.in': 0,
      },
    }));

    renderSurface({
      activeVerifySignal: 'q1',
      onRuntimeSimSetSelectedSignal: setSelectedSignal,
      runtimeSim,
      ioRows: [
        { id: 'alias_collision', nodeId: 'ld0_node', label: 'q1', pin: 'U16', port: 'in', direction: 'out' },
        { id: 'q1', nodeId: 'q1_out', label: 'LD1', pin: 'E19', port: 'in', direction: 'out' },
      ],
    });

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('q1_out.in');
    });
    expect(setSelectedSignal).not.toHaveBeenCalledWith('ld0_node.in');
  });

  it('restates verify mismatch context when opening frozen debug mode', () => {
    const view = renderSurface({
      externalDebugTick: 6,
      externalDebugSignals: new Map([
        ['sw0_node.out', 1],
        ['ld0_node.in', 0],
      ]),
      externalDebugContext: {
        signal: 'ld0',
        signalLabel: 'LD0',
        tick: 6,
        expected: '1',
        actual: '0',
        inputSnapshot: [{ label: 'SW0', value: '1' }],
        patternSummary: 'Output stayed low while the selected input was high.',
        nextInspect: 'Inspect the wire between SW0 and LD0.',
      },
    });

    expect(view.getByTestId('ide-design-debug-banner').textContent).toContain('t6');
    expect(view.getByTestId('ide-design-failure-brief').textContent).toContain('LD0');
    expect(view.getByTestId('ide-design-failure-brief').textContent).toContain('1');
    expect(view.getByTestId('ide-design-failure-brief').textContent).toContain('0');
    expect(view.getByTestId('ide-design-failure-brief').textContent).toContain(
      'Verify failed on LD0: expected 1, observed 0 at tick 6.'
    );
    expect(view.getByTestId('ide-design-failure-brief-inputs').textContent).toContain('SW0=1');
    expect(view.getByTestId('ide-design-failure-brief-next').textContent).toContain('Inspect the wire between SW0 and LD0.');
    expect(view.getByTestId('ide-design-failure-brief-pattern').textContent).toContain('Output stayed low while the selected input was high.');
    expect(view.getByTestId('ide-design-active-trace').textContent).toContain('Debug: what drives LD0 · in');
    expect(view.getByTestId('ide-design-inspector-identity-subtitle').textContent).toContain('Debug focus');
    expect(view.getByTestId('ide-design-sim-story-summary').textContent).toContain('Verify failed on LD0: expected 1, observed 0 at tick 6.');
  });

  it('auto-demotes cramped split view into stacked mode', async () => {
    installResizeObserver(700);
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-view-split'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-workspace').getAttribute('data-design-view')).toBe('stacked');
    });

    // Stacked mode now shows a dedicated notice instead of an accent span inside the shortcut overlay
    const notice = view.getByTestId('ide-design-stacked-notice');
    expect(notice.textContent).toContain('too narrow');
    expect(view.queryByTestId('ide-design-shortcut-strip')).toBeNull();
  });

  it('renders a single primary code viewport and opens the secondary artifact drawer on demand', async () => {
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-view-hdl'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-artifact-selector')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-code-context-primary-artifact').textContent).toContain('Viewing top.vhd');

    const primaryTextarea = view.getByTestId('ide-design-hdl-textarea') as HTMLTextAreaElement;
    expect(primaryTextarea.getAttribute('data-artifact')).toBe('vhdl');
    expect(view.queryByTestId('ide-design-secondary-artifact-drawer')).toBeNull();

    const secondaryToggle = view.getByTestId('ide-design-secondary-artifact-toggle') as HTMLButtonElement;
    if (secondaryToggle.disabled) {
      expect(secondaryToggle.textContent).toContain('unavailable');
      return;
    }

    fireEvent.click(secondaryToggle);

    await waitFor(() => {
      expect(view.getByTestId('ide-design-secondary-artifact-drawer')).toBeTruthy();
    });

    const secondaryTextarea = view.getByTestId('ide-design-secondary-artifact-textarea') as HTMLTextAreaElement;
    expect(secondaryTextarea.getAttribute('data-artifact')).toBe('verilog');

    fireEvent.click(view.getByTestId('ide-design-artifact-verilog'));

    await waitFor(() => {
      expect(primaryTextarea.getAttribute('data-artifact')).toBe('verilog');
    });
    expect(primaryTextarea.readOnly).toBe(true);
  });

  it('frames HDL import as a utility action inside the code view', async () => {
    const onGoToImport = vi.fn();
    const view = renderSurface({ onGoToImport });

    fireEvent.click(view.getByTestId('ide-design-view-hdl'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-artifact-selector')).toBeTruthy();
    });

    const importButton = view.getByTestId('ide-design-hdl-go-import');
    expect(importButton.textContent).toContain('Import HDL');

    fireEvent.click(importButton);
    expect(onGoToImport).toHaveBeenCalledTimes(1);
  });

  it('keeps code and split modes in the V2 workspace without restore rails or diagnostic chrome', async () => {
    const view = renderSurface();
    const modeRoot = view.getByTestId('ide-mode-design');

    fireEvent.click(view.getByTestId('ide-design-view-hdl'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-workspace').getAttribute('data-design-view')).toBe('hdl');
    });
    expect(modeRoot.getAttribute('data-shell-density')).toBe('immersive');
    expect(modeRoot.getAttribute('data-surface-frame')).toBe('edge-to-edge');
    expect(view.queryByTestId('ide-workbench-console')).toBeNull();
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.getByTestId('ide-design-dock-palette')).toBeTruthy();
    expect(view.queryByTestId('ide-inspector')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-collapse-left')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-collapse-right')).toBeNull();

    fireEvent.click(view.getByTestId('ide-design-view-split'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-workspace').getAttribute('data-design-view')).toBe('split');
    });
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.getByTestId('ide-design-dock-palette')).toBeTruthy();
    expect(view.queryByTestId('ide-inspector')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(view.queryByTestId('ide-workbench-console')).toBeNull();
  });

  it('keeps the Design console available when compiler diagnostics exist', async () => {
    const view = renderSurface({
      compilerStatus: {
        dirtySinceVerify: true,
        dirtySinceExport: true,
        errorCount: 0,
        warningCount: 1,
        diagnostics: [WARNING_DIAGNOSTIC],
      },
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-workbench-console')).toBeTruthy();
    });

    expect(view.getByTestId('ide-workbench-console').getAttribute('data-console-state')).toBe('collapsed');
    expect(view.getByTestId('ide-design-console-list').textContent).toContain('Floating output');
  });

  it('surfaces the Design console in blocking mode when compiler errors exist', async () => {
    const view = renderSurface({
      compilerStatus: {
        dirtySinceVerify: true,
        dirtySinceExport: true,
        errorCount: 1,
        warningCount: 0,
        diagnostics: [ERROR_DIAGNOSTIC],
      },
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-workbench-console')).toBeTruthy();
    });

    expect(view.getByTestId('ide-workbench-console').getAttribute('data-console-state')).toBe('blocking');
    expect(view.getByTestId('ide-design-console-list').textContent).toContain('Unconnected output');
  });

  it('renders compact runtime chrome in split mode', async () => {
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-view-split'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-workspace').getAttribute('data-design-view')).toBe('split');
    });

    expect(view.getByTestId('ide-design-split-context-summary').textContent).toContain('Stage the circuit');
    expect(view.getByTestId('ide-design-split-compare-tools')).toBeTruthy();
    expect(view.queryByTestId('ide-design-tool-segmented')).toBeNull();
    expect(view.queryByTestId('ide-design-tools-toggle')).toBeNull();
    expect(view.queryByTestId('ide-design-shortcut-strip')).toBeNull();
    expect(view.queryByTestId('ide-design-zoom-presets')).toBeNull();
    expect(view.getByTestId('ide-design-split-canvas-indicator').textContent).toContain('Circuit pane');
    expect(view.getByTestId('ide-design-sim-story-strip').textContent).toContain('Runtime');
    expect(view.getByTestId('ide-design-split-stat-tick').textContent).toContain('Tick 6');
    expect(view.getByTestId('ide-design-split-stat-mode').textContent).toContain('Paused');
  });

  it('re-fits the canvas when returning from split back to fullscreen canvas view', async () => {
    const view = renderSurface();

    fireEvent.click(view.getByTestId('ide-design-view-split'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-workspace').getAttribute('data-design-view')).toBe('split');
    });

    act(() => {
      useLogicViewStore.setState({
        camera: { x: -999, y: -777, zoom: 0.5 },
      });
    });

    fireEvent.click(view.getByTestId('ide-design-view-canvas'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-workspace').getAttribute('data-design-view')).toBe('canvas');
    });

    await waitFor(() => {
      const camera = useLogicViewStore.getState().camera;
      expect(camera.x).not.toBe(-999);
      expect(camera.y).not.toBe(-777);
    });
  });

  it('shows the save-as-macro action and dialog when multiple nodes are selected', async () => {
    const onSaveMacro = vi.fn();
    const view = renderSurface({
      macros: [],
      onSaveMacro,
    });

    act(() => {
      useLogicViewStore.getState().selectMultipleNodes(['sw0_node', 'ld0_node']);
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-save-macro-open')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-save-macro-open'));

    expect(view.getByTestId('ide-macro-save-dialog')).toBeTruthy();
    expect(view.getByTestId('ide-macro-save-name')).toBeTruthy();
  });

  it('enters macro insertion mode from the library and instantiates on canvas click target', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    await openDesignLibrary(view);
    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));

    const overlay = view.getByTestId('ide-macro-insertion-overlay');
    expect(overlay.textContent).toContain('AND Gate');

    fireEvent.click(view.getByTestId('ide-design-live-canvas'), { clientX: 600, clientY: 320 });

    await waitFor(() => {
      expect(onInstantiateMacro).toHaveBeenCalledWith('macro-and-gate', expect.any(Object));
    });
  });

  it('keeps overlay click path working for macro placement', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    await openDesignLibrary(view);
    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    fireEvent.click(view.getByTestId('ide-macro-insertion-overlay'), { clientX: 640, clientY: 360 });

    await waitFor(() => {
      expect(onInstantiateMacro).toHaveBeenCalledWith('macro-and-gate', expect.any(Object));
    });
  });

  it('supports keyboard placement from the insertion overlay', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    await openDesignLibrary(view);
    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    const overlay = view.getByTestId('ide-macro-insertion-overlay');
    expect(overlay.getAttribute('role')).toBe('button');
    expect(overlay.getAttribute('tabindex')).toBe('0');
    overlay.focus();
    expect(document.activeElement).toBe(overlay);

    fireEvent.keyDown(overlay, { key: 'Enter' });

    await waitFor(() => {
      expect(onInstantiateMacro).toHaveBeenCalledWith('macro-and-gate', expect.any(Object));
    });
  });

  it('supports Space key placement from the insertion overlay', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    await openDesignLibrary(view);
    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    const overlay = view.getByTestId('ide-macro-insertion-overlay');
    overlay.focus();

    fireEvent.keyDown(overlay, { key: ' ' });

    await waitFor(() => {
      expect(onInstantiateMacro).toHaveBeenCalledWith('macro-and-gate', expect.any(Object));
    });
  });

  it('does not place when clicking placement overlay card UI', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    await openDesignLibrary(view);
    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    fireEvent.click(view.getByTestId('ide-macro-insertion-message'));

    expect(onInstantiateMacro).not.toHaveBeenCalled();
    expect(view.getByTestId('ide-macro-insertion-overlay')).toBeTruthy();
  });

  it('exits placement mode via cancel button without mutating the graph', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    await openDesignLibrary(view);
    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    expect(view.getByTestId('ide-macro-insertion-overlay')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-macro-insertion-cancel'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-macro-insertion-overlay')).toBeNull();
    });
    expect(onInstantiateMacro).not.toHaveBeenCalled();
  });

  it('exits placement mode via Escape without mutating the graph', async () => {
    const onInstantiateMacro = vi.fn(() => ({
      instanceLabel: 'AND_Gate_1',
      insertedNodeIds: ['node-v2-5'],
    }));

    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      onInstantiateMacro,
    });

    await openDesignLibrary(view);
    fireEvent.click(view.getByTestId('ide-macro-library-card-macro-and-gate'));
    expect(view.getByTestId('ide-macro-insertion-overlay')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(view.queryByTestId('ide-macro-insertion-overlay')).toBeNull();
    });
    expect(onInstantiateMacro).not.toHaveBeenCalled();
  });
});
