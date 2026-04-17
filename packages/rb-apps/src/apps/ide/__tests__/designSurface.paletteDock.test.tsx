// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import type { MacroDefinition } from '../macros/MacroLibrary';
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

const FIXTURE_MACRO: MacroDefinition = {
  id: 'macro-and-gate',
  name: 'AND Gate',
  createdAt: 1710000000000,
  description: 'Reusable two-input gate cluster.',
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

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 3,
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
  installResizeObserver();
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

describe('DesignSurface palette dock redesign', () => {
  it('renders builder-first sections and keeps reusable blocks inside the main palette', () => {
    const view = renderSurface({
      macros: [FIXTURE_MACRO],
      customComponentTypes: [
        {
          type: 'MyMux',
          title: 'My Mux',
          description: 'Student-built custom multiplexer block.',
        },
      ],
    });

    const palette = view.getByTestId('ide-design-dock-palette');
    const sectionOrder = Array.from(
      palette.querySelectorAll<HTMLElement>('[data-testid^="ide-design-palette-section-"]')
    ).map((element) => element.dataset.testid ?? element.getAttribute('data-testid'));

    expect(sectionOrder).toEqual([
      'ide-design-palette-section-logic',
      'ide-design-palette-section-sequential',
      'ide-design-palette-section-io',
      'ide-design-palette-section-reusable',
      'ide-design-palette-section-board',
    ]);

    expect(within(palette).getByTestId('ide-macro-library-panel')).toBeTruthy();
    expect(within(palette).getByTestId('ide-palette-group-custom')).toBeTruthy();
  });

  it('keeps search and core parts visible while secondary board inventory and quick inputs stay collapsed by default', () => {
    const view = renderSurface();

    expect(view.getByTestId('ide-design-search')).toBeTruthy();
    expect(view.getByTestId('ide-design-palette-and')).toBeTruthy();
    expect(view.getByTestId('ide-design-palette-dflipflop')).toBeTruthy();
    expect(view.getByTestId('ide-design-palette-input')).toBeTruthy();

    expect(view.getByTestId('ide-design-palette-toggle-board')).toHaveAttribute('aria-expanded', 'false');
    expect(view.queryByTestId('ide-design-board-io-palette')).toBeNull();

    expect(view.getByTestId('ide-design-live-inputs-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(view.queryByTestId('ide-design-input-toggle-sw0_node')).toBeNull();
  });

  it('groups sequential palette into registers, timing, and legacy subsections', () => {
    const view = renderSurface();
    const palette = view.getByTestId('ide-design-dock-palette');
    expect(within(palette).getByTestId('ide-design-palette-sequential-registers')).toBeTruthy();
    expect(within(palette).getByTestId('ide-design-palette-sequential-timing')).toBeTruthy();
    expect(within(palette).getByTestId('ide-design-palette-sequential-legacy')).toBeTruthy();
    expect(within(palette).getByTestId('ide-design-palette-sequential-workflow-hint')).toBeTruthy();
  });

  it('places T flip-flop under reusable built-in blocks, not top-level sequential', () => {
    const view = renderSurface();
    const sequential = view.getByTestId('ide-design-palette-section-sequential');
    expect(within(sequential).queryByTestId('ide-design-palette-tflipflop')).toBeNull();
    const reusable = view.getByTestId('ide-design-palette-section-reusable');
    expect(within(reusable).getByTestId('ide-design-palette-tflipflop')).toBeTruthy();
  });

  it('matches search terms across primitives, macros, and board resources', () => {
    const view = renderSurface({
      macros: [FIXTURE_MACRO],
    });

    const search = view.getByTestId('ide-design-search');

    fireEvent.change(search, { target: { value: 'flipflop' } });
    expect(view.getByTestId('ide-design-palette-dflipflop')).toBeTruthy();
    expect(view.queryByTestId('ide-design-palette-and')).toBeNull();

    fireEvent.change(search, { target: { value: 'macro' } });
    expect(view.getByTestId('ide-macro-library-card-macro-and-gate')).toBeTruthy();
    expect(view.queryByTestId('ide-design-palette-dflipflop')).toBeNull();

    fireEvent.change(search, { target: { value: 'led' } });
    expect(view.getByTestId('ide-design-board-output-ld0')).toBeTruthy();
    expect(view.queryByTestId('ide-macro-library-card-macro-and-gate')).toBeNull();
  });

  it('auto-expands Board Resources when searching board inventory terms', () => {
    const view = renderSurface();

    const search = view.getByTestId('ide-design-search');
    const boardToggle = view.getByTestId('ide-design-palette-toggle-board');

    expect(boardToggle).toHaveAttribute('aria-expanded', 'false');
    expect(view.queryByTestId('ide-design-board-io-palette')).toBeNull();

    fireEvent.change(search, { target: { value: 'led' } });

    expect(boardToggle).toHaveAttribute('aria-expanded', 'true');
    expect(view.getByTestId('ide-design-board-io-palette')).toBeTruthy();
    expect(view.getByTestId('ide-design-board-output-ld0')).toBeTruthy();
  });
});
