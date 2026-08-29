// @vitest-environment jsdom
/**
 * Canvas context-menu + inline rename contract: right-click on a node opens
 * the node menu (rename/duplicate/copy/delete), right-click on empty canvas
 * opens the canvas menu (paste/select-all/fit/arrange), Escape dismisses,
 * and Rename edits the label in a floating input at the node.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

const ONE_NODE_CIRCUIT: Circuit = {
  nodes: [{ id: 'ctx_and', type: 'AND', label: 'U1', x: 120, y: 96 } as Circuit['nodes'][number]],
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

function renderSurface(overrides: Partial<React.ComponentProps<typeof DesignSurface>> = {}) {
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
      {...overrides}
    />
  );
}

async function nodeElement(view: ReturnType<typeof renderSurface>): Promise<Element> {
  await waitFor(() => {
    expect(view.container.querySelector('[data-node-id="ctx_and"]')).toBeTruthy();
  });
  return view.container.querySelector('[data-node-id="ctx_and"]')!;
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  localStorage.clear();
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(ONE_NODE_CIRCUIT), isDirty: false });
  useLogicViewStore.setState({
    ...useLogicViewStore.getState(),
    toolMode: 'select',
    interactionMode: 'idle',
    selection: { nodes: new Set<string>(), wires: new Set<string>() },
  });
});

afterEach(cleanup);

describe('DesignSurface canvas context menus', () => {
  it('opens the node menu on right-click, selects the node, and deletes through it', async () => {
    const view = renderSurface();
    const node = await nodeElement(view);

    fireEvent.contextMenu(node, { clientX: 300, clientY: 200 });
    const menu = await view.findByTestId('ide-design-node-context-menu');
    expect(menu).toBeTruthy();
    expect(useLogicViewStore.getState().selection.nodes.has('ctx_and')).toBe(true);

    fireEvent.click(view.getByTestId('ide-design-node-menu-delete'));
    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes).toHaveLength(0);
    });
    expect(view.queryByTestId('ide-design-node-context-menu')).toBeNull();
  });

  it('renames a node inline on the canvas through the node menu', async () => {
    const view = renderSurface();
    const node = await nodeElement(view);

    fireEvent.contextMenu(node, { clientX: 300, clientY: 200 });
    fireEvent.click(await view.findByTestId('ide-design-node-menu-rename'));

    const input = await view.findByTestId('ide-design-canvas-rename-input');
    expect((input as HTMLInputElement).value).toBe('U1');
    fireEvent.change(input, { target: { value: 'SUM_STAGE' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useCircuitStore.getState().circuit.nodes[0]?.label).toBe('SUM_STAGE');
    });
    expect(view.queryByTestId('ide-design-canvas-rename-input')).toBeNull();
  });

  it('opens the canvas menu on empty right-click with paste disabled and select-all live', async () => {
    const view = renderSurface();
    await nodeElement(view);
    const svg = view.container.querySelector('[data-testid="ide-design-live-canvas"] svg')
      ?? view.container.querySelector('svg');
    expect(svg).toBeTruthy();

    fireEvent.contextMenu(svg!, { clientX: 500, clientY: 320 });
    const menu = await view.findByTestId('ide-design-canvas-context-menu');
    expect(menu).toBeTruthy();
    expect((view.getByTestId('ide-design-canvas-menu-paste') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(view.getByTestId('ide-design-canvas-menu-select-all'));
    await waitFor(() => {
      expect(useLogicViewStore.getState().selection.nodes.has('ctx_and')).toBe(true);
    });
  });

  it('dismisses any open context menu with Escape', async () => {
    const view = renderSurface();
    const node = await nodeElement(view);

    fireEvent.contextMenu(node, { clientX: 300, clientY: 200 });
    await view.findByTestId('ide-design-node-context-menu');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(view.queryByTestId('ide-design-node-context-menu')).toBeNull();
    });
  });
});
