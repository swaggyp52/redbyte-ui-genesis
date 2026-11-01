// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import { useProjectRuntime, type ProjectIoRow, type RuntimeSimState } from '../projectRuntime';
import { workspacePreferencesStore } from '../workspacePreferences';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

/**
 * P2.5H Wave Four — the Design inspector is organised as named sections that read the
 * authorities the workbench already has: Identity (properties), Actions, Selection details,
 * Connectivity, Evidence, Mapping, Source, Related.
 */
const CIRCUIT: Circuit = {
  nodes: [
    { id: 'sw0_node', type: 'INPUT', label: 'SW0', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 1 } },
    { id: 'and0_node', type: 'AND', position: { x: 100, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'ld0_node', type: 'OUTPUT', label: 'LD0', position: { x: 200, y: 0 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and0_node', portName: 'a' } },
    { from: { nodeId: 'and0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
  ],
};

const IO_ROWS = [
  { id: 'sw0', nodeId: 'sw0_node', label: 'SW0', pin: 'V17', port: 'out', direction: 'in' as const },
  { id: 'ld0', nodeId: 'ld0_node', label: 'LD0', pin: 'U16', port: 'in', direction: 'out' as const },
];

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 6,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: { sw0_node: 1 },
    signals: { 'sw0_node.out': 1, 'and0_node.a': 1, 'and0_node.out': 1, 'ld0_node.in': 1 },
    trace: [
      { tick: 5, signals: { 'sw0_node.out': 0, 'and0_node.out': 0, 'ld0_node.in': 0 } },
      { tick: 6, signals: { 'sw0_node.out': 1, 'and0_node.out': 1, 'ld0_node.in': 1 } },
    ],
    selectedSignalKey: null,
    probes: [],
    stepMode: false,
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
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(CIRCUIT), isDirty: false, past: [], future: [] });
  // The relationship index (Mapping's constraint lines, Related) reads the project runtime.
  useProjectRuntime.setState({ circuit: structuredClone(CIRCUIT), projectIoRows: IO_ROWS as unknown as ProjectIoRow[] });
  return render(
    <DesignSurface
      runtimeSim={makeRuntimeSim()}
      ioRows={IO_ROWS}
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
      onRuntimeSimToggleProbe={vi.fn()}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
    />
  );
}

function follows(before: Element, after: Element): boolean {
  return Boolean(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  useLayoutStore.getState().resetLayout();
  workspacePreferencesStore.setDesignView('canvas');
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

describe('DesignSurface inspector — named sections', () => {
  it('orders the sections identity → actions → details → connectivity → evidence → mapping → source → related for a board output', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-connectivity')).toBeTruthy();
    });
    const identity = view.getByTestId('ide-design-inspector-identity-card');
    const details = view.getByTestId('ide-design-inspector-selection-details');
    const connectivity = view.getByTestId('ide-design-inspector-connectivity');
    const evidence = view.getByTestId('ide-design-context-inspector');
    const mapping = view.getByTestId('ide-design-inspector-mapping');
    const source = view.getByTestId('ide-design-inspector-source');
    const related = view.getByTestId('ide-design-inspector-related');
    expect(follows(identity, details)).toBe(true);
    expect(follows(details, connectivity)).toBe(true);
    expect(follows(connectivity, evidence)).toBe(true);
    expect(follows(evidence, mapping)).toBe(true);
    expect(follows(mapping, source)).toBe(true);
    expect(follows(source, related)).toBe(true);
    expect(evidence.querySelector('.ide-inspector-title')?.textContent).toBe('Evidence');
    // No standalone Properties section: identity remains the properties surface.
    expect(view.queryByTestId('ide-design-inspector-properties')).toBeNull();
  });

  it('moves the pin values and input drivers into Connectivity and keeps the live values in Evidence', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-input-drivers')).toBeTruthy();
    });
    const connectivity = view.getByTestId('ide-design-inspector-connectivity');
    const evidence = view.getByTestId('ide-design-context-inspector');
    expect(connectivity.contains(view.getByTestId('ide-design-selection-pins'))).toBe(true);
    expect(connectivity.contains(view.getByTestId('ide-design-input-drivers'))).toBe(true);
    expect(evidence.querySelector('[data-testid="ide-design-selection-pins"]')).toBeNull();
    expect(evidence.querySelector('[data-testid="ide-design-input-drivers"]')).toBeNull();
    expect(evidence.contains(view.getByTestId('ide-design-context-current'))).toBe(true);
    expect(view.getByTestId('ide-design-inspector-loads').textContent).toContain('nothing yet');
  });

  it('lists what the selection drives for an internal gate', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-loads')).toBeTruthy();
    });
    expect(view.getByTestId('ide-design-inspector-loads').textContent).toContain('LD0');
    // An internal gate has no board mapping and no boundary relation.
    expect(view.queryByTestId('ide-design-inspector-mapping')).toBeNull();
    expect(view.queryByTestId('ide-design-inspector-related')).toBeNull();
  });

  it('shows the pin and the constraint lines in Mapping and offers the way to Board', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-mapping-pin').textContent).toBe('U16');
    });
    expect(view.getByTestId('ide-design-inspector-mapping-xdc').textContent).toContain('U16');
    expect(view.getByTestId('ide-design-inspector-mapping-open').textContent).toBe('Open in Board');
    // Selection details keeps its one-line board summary (the primary flow contract).
    expect(view.getByTestId('ide-design-inspector-selection-details').textContent).toContain('U16');
  });

  it('Source names the generated lines that mention the signal and can open the HDL beside the schematic', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-source-toggle')).toBeTruthy();
    });
    fireEvent.click(view.getByTestId('ide-design-inspector-source-toggle'));
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-source-lines')).toBeTruthy();
    });
    expect(view.getByTestId('ide-design-inspector-source-lines').textContent).toMatch(/LD0/i);
    fireEvent.click(view.getByTestId('ide-design-inspector-source-open'));
    expect(workspacePreferencesStore.getSnapshot().design.view).toBe('split');
  });

  it('Related lists the documents the signal appears in', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('sw0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-related-list')).toBeTruthy();
    });
    expect(view.getByTestId('ide-design-inspector-related-board-io')).toBeTruthy();
    expect(view.getByTestId('ide-design-inspector-related-package-artifact')).toBeTruthy();
  });

  it('opens on the actions for the selection, with reference sections closed until asked for', async () => {
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('and0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-connectivity')).toBeTruthy();
    });
    // Reference material is one named step away, not expanded beside the schematic.
    for (const id of ['ide-design-inspector-selection-details', 'ide-design-inspector-connectivity']) {
      const section = view.getByTestId(id);
      expect(section.getAttribute('data-open')).toBe('false');
      expect(section.querySelector('.ide-inspector-content')?.hasAttribute('hidden')).toBe(true);
      expect(view.getByTestId(`${id}-toggle`).getAttribute('aria-expanded')).toBe('false');
    }
    // The actions a student takes on the selection are not behind a toggle.
    expect(view.getByTestId('ide-design-inspector-actions').querySelector('.ide-inspector-toggle')).toBeNull();

    act(() => {
      view.getByTestId('ide-design-inspector-connectivity-toggle').click();
    });
    const connectivity = view.getByTestId('ide-design-inspector-connectivity');
    expect(connectivity.getAttribute('data-open')).toBe('true');
    expect(connectivity.querySelector('.ide-inspector-content')?.hasAttribute('hidden')).toBe(false);
    expect(view.getByTestId('ide-design-inspector-connectivity-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  // Keeping a closed section's content in the document is only acceptable if it is really
  // out of reach until asked for, and if asking for it needs nothing but a keyboard. This
  // walks that path: closed and unreachable, opened with Enter, the first control inside
  // reached with Tab and used, then closed again with Space.
  it('a closed section is out of reach, opens from the keyboard, and its first action then works', async () => {
    const user = userEvent.setup();
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-connectivity')).toBeTruthy();
    });

    const toggle = view.getByTestId('ide-design-inspector-connectivity-toggle');
    const content = view.getByTestId('ide-design-inspector-connectivity').querySelector('.ide-inspector-content') as HTMLElement;
    const driverRow = content.querySelector<HTMLButtonElement>('[data-testid^="ide-design-driver-row-"]');
    expect(driverRow).not.toBeNull();

    // Closed: a native button announces the state, and the content is hidden, not just clipped.
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('Connectivity');
    expect(content.hidden).toBe(true);

    // Tab from the closed toggle does not land on anything inside the closed section.
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    await user.tab();
    expect(content.contains(document.activeElement)).toBe(false);

    // Enter on the toggle opens it.
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(content.hidden).toBe(false);

    // The next Tab stop is now the first control inside, and using it follows the wire upstream.
    await user.tab();
    expect(document.activeElement).toBe(driverRow);
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(useLogicViewStore.getState().selection.nodes.has('and0_node')).toBe(true);
    });
    expect(useLogicViewStore.getState().selection.nodes.has('ld0_node')).toBe(false);
  });

  it('Space closes an opened section again and puts its content back out of reach', async () => {
    const user = userEvent.setup();
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-inspector-connectivity')).toBeTruthy();
    });
    const toggle = view.getByTestId('ide-design-inspector-connectivity-toggle');
    const content = view.getByTestId('ide-design-inspector-connectivity').querySelector('.ide-inspector-content') as HTMLElement;

    toggle.focus();
    await user.keyboard(' ');
    expect(content.hidden).toBe(false);
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(content.hidden).toBe(true);
    await user.tab();
    expect(content.contains(document.activeElement)).toBe(false);
  });

  it('Evidence starts closed and shows the live value once it is opened', async () => {
    const user = userEvent.setup();
    const view = renderSurface();
    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });
    await waitFor(() => {
      expect(view.getByTestId('ide-design-context-inspector')).toBeTruthy();
    });
    const evidence = view.getByTestId('ide-design-context-inspector');
    const toggle = view.getByTestId('ide-design-context-inspector-toggle');
    const content = evidence.querySelector('.ide-inspector-content') as HTMLElement;

    expect(evidence.getAttribute('data-open')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(content.hidden).toBe(true);
    // The value is kept, not removed: it is one named step away.
    expect(content.contains(view.getByTestId('ide-design-context-current'))).toBe(true);

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(evidence.getAttribute('data-open')).toBe('true');
    expect(content.hidden).toBe(false);
    expect(view.getByTestId('ide-design-context-current').closest('[hidden]')).toBeNull();
  });
});
