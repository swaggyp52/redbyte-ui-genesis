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
import { COMPONENT_DEFINITION_REGISTRY } from '../componentDefinitions';
import { describeComponentPortSignature } from '../surfaces/DesignComponentLibrary';
import { createClockTimingGuidance } from '../timingGuidance';

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
    originX: 0,
    originY: 0,
  },
};

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 3,
    running: false,
    stepMode: false,
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
  it('renders authoring-first common parts before board resources', () => {
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
      'ide-design-palette-section-common',
      'ide-design-palette-section-board',
      'ide-design-palette-section-io',
      'ide-design-palette-section-logic',
      'ide-design-palette-section-sequential',
      'ide-design-palette-section-reusable',
    ]);
    expect(
      Array.from(
        view
          .getByTestId('ide-design-palette-section-common')
          .querySelectorAll<HTMLElement>('[data-testid^="ide-design-common-"]')
      ).map((element) => element.dataset.testid)
    ).toEqual([
      'ide-design-common-input',
      'ide-design-common-output',
      'ide-design-common-xor',
      'ide-design-common-and',
      'ide-design-common-or',
      'ide-design-common-not',
      'ide-design-common-register1',
    ]);

    expect(within(palette).getByTestId('ide-macro-library-panel')).toBeTruthy();
    expect(within(palette).getByTestId('ide-palette-group-custom')).toBeTruthy();
  });

  it('keeps board resources and quick inputs directly available', () => {
    const view = renderSurface();

    // Core palette parts always visible
    expect(view.getByTestId('ide-design-search')).toBeTruthy();
    expect(view.getByTestId('ide-design-palette-and')).toBeTruthy();
    expect(view.getByTestId('ide-design-palette-dflipflop')).toBeTruthy();
    expect(view.getByTestId('ide-design-palette-input')).toBeTruthy();

    // Board Resources section is open on first load — board parts are the primary destination for FPGA work
    expect(view.getByTestId('ide-design-palette-section-board')).toHaveAttribute('data-collapsed', 'false');
    expect(view.getByTestId('ide-design-board-io-palette')).toBeTruthy();

    // Live Inputs is a runtime debug tool, not a primary authoring surface — stays collapsed
    expect(view.queryByTestId('ide-design-live-inputs-toggle')).toBeNull();
  });

  it('projects built-in card copy and semantic search from ComponentDefinition', () => {
    const view = renderSurface();
    const xnorDefinition = COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('XNOR');
    expect(xnorDefinition).toBeDefined();

    const xnorCard = view.getByTestId('ide-design-palette-xnor');
    // Tooltip projects the canonical port signature alongside name + copy.
    const xnorSignature = describeComponentPortSignature('XNOR');
    expect(xnorSignature).toBeTruthy();
    expect(xnorCard).toHaveAttribute(
      'title',
      `${xnorDefinition?.displayName} (${xnorSignature}) - ${xnorDefinition?.description}`
    );
    expect(xnorCard.textContent).toContain(xnorDefinition?.displayName);
    expect(xnorCard.textContent).toContain(xnorDefinition?.description);

    fireEvent.change(view.getByTestId('ide-design-search'), {
      target: { value: xnorDefinition?.category },
    });
    expect(view.getByTestId('ide-design-palette-xnor')).toBeTruthy();
    expect(view.queryByTestId('ide-design-palette-and')).toBeNull();
  });

  it('groups sequential palette into registers and legacy subsections', () => {
    const view = renderSurface();
    const palette = view.getByTestId('ide-design-dock-palette');
    expect(within(palette).getByTestId('ide-design-palette-sequential-registers')).toBeTruthy();
    // Slice N7: 'timing' subsection no longer renders — Sim Clock was its only
    // entry and was removed. CLK100MHZ Board Resource is the canonical clock.
    expect(within(palette).queryByTestId('ide-design-palette-sequential-timing')).toBeNull();
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

  it('board resources remain visible when searching board inventory terms and surfaces the matched item', () => {
    const view = renderSurface();

    // Board inventory is a direct library section on load.
    expect(view.getByTestId('ide-design-palette-section-board')).toHaveAttribute('data-collapsed', 'false');
    expect(view.getByTestId('ide-design-board-io-palette')).toBeTruthy();

    // Searching for board terms keeps the direct section visible and shows the matching item.
    fireEvent.change(view.getByTestId('ide-design-search'), { target: { value: 'led' } });

    expect(view.getByTestId('ide-design-palette-section-board')).toHaveAttribute('data-collapsed', 'false');
    expect(view.getByTestId('ide-design-board-io-palette')).toBeTruthy();
    expect(view.getByTestId('ide-design-board-output-ld0')).toBeTruthy();
  });

  it('finds the Basys3 board clock by package pin and surfaces the CLK100MHZ board resource', () => {
    const view = renderSurface();

    // CLK100MHZ is visible even before searching (board section is open by default)
    expect(view.getByTestId('ide-design-board-input-clk100mhz')).toBeTruthy();

    // Searching by package pin W5 also surfaces CLK100MHZ via search
    fireEvent.change(view.getByTestId('ide-design-search'), { target: { value: 'w5' } });

    expect(view.getByTestId('ide-design-palette-section-board')).toHaveAttribute('data-collapsed', 'false');
    expect(view.getByTestId('ide-design-board-input-clk100mhz')).toBeTruthy();
  });

  /* Slice N7 — Sim Clock palette removal.
     Canonical clock model: CLK100MHZ Board Resource is the only clock the user
     places. Pure-sim sequential designs auto-inject __sim_clk__. The Sim Clock
     palette entry is REMOVED so users can never accidentally place a duplicate
     clock that masquerades as a board clock. */
  it('removes the Sim Clock palette entry — CLK100MHZ Board Resource is the only clock surface', () => {
    const view = renderSurface();

    // No Sim Clock palette card under any tier
    expect(view.queryByTestId('ide-design-palette-clock')).toBeNull();

    // Search by every term that previously found Sim Clock — none should match
    const searchInput = view.getByTestId('ide-design-search');
    for (const term of ['sim clock', 'oscillator', 'sim']) {
      fireEvent.change(searchInput, { target: { value: term } });
      expect(view.queryByTestId('ide-design-palette-clock')).toBeNull();
    }

    // CLK100MHZ Board Resource is still surfaceable — that's the canonical clock
    fireEvent.change(searchInput, { target: { value: 'clock' } });
    expect(view.getByTestId('ide-design-board-input-clk100mhz')).toBeTruthy();
  });

  it('describes an explicitly typed switch clock as a manual clock assignment', () => {
    useLogicViewStore.setState({
      selection: { nodes: new Set(['sw0_node']), wires: new Set() },
    });
    const view = renderSurface({
      ioRows: [
        {
          id: 'enter',
          nodeId: 'sw0_node',
          label: 'ENTER (SW5)',
          pin: 'V15',
          port: 'out',
          direction: 'in',
          timingRole: 'clock',
          boardResourceType: 'switch',
        },
      ],
    });

    fireEvent.click(view.getByTestId('ide-design-right-tab-constraints'));
    const facts = view.getByTestId('ide-design-inline-board-assignment').textContent ?? '';
    expect(facts).toContain('Manual clock switch');
    expect(facts).toContain('Manual clock switch SW5 assigned');
    expect(facts).not.toContain('Clock resource required');
  });

  it('uses structural timing guidance for the metadata-absent Lab 8 ENTER row', () => {
    useLogicViewStore.setState({
      selection: { nodes: new Set(['sw0_node']), wires: new Set() },
    });
    const view = renderSurface({
      ioRows: [
        {
          id: 'iom-enter',
          nodeId: 'sw0_node',
          label: 'ENTER (SW5)',
          pin: 'V15',
          port: 'out',
          direction: 'in',
        },
      ],
      timingGuidance: createClockTimingGuidance('ENTER (SW5)'),
    });

    fireEvent.click(view.getByTestId('ide-design-right-tab-constraints'));
    const facts = view.getByTestId('ide-design-inline-board-assignment').textContent ?? '';
    expect(facts).toContain('Manual clock switch');
    expect(facts).toContain('Manual clock switch SW5 assigned');
    expect(facts).not.toContain('Not a timing-control signal');
  });

  it('describes a switch-backed reset as a reset switch rather than a button', () => {
    useLogicViewStore.setState({
      selection: { nodes: new Set(['sw0_node']), wires: new Set() },
    });
    const view = renderSurface({
      ioRows: [
        {
          id: 'reset',
          nodeId: 'sw0_node',
          label: 'RESET (SW4)',
          pin: 'W15',
          port: 'out',
          direction: 'in',
          timingRole: 'reset',
          boardResourceType: 'switch',
        },
      ],
    });

    fireEvent.click(view.getByTestId('ide-design-right-tab-constraints'));
    const facts = view.getByTestId('ide-design-inline-board-assignment').textContent ?? '';
    expect(facts).toContain('Reset-capable switch');
    expect(facts).toContain('Reset switch SW4 assigned');
    expect(facts).not.toContain('Reset-capable button');
  });
});
