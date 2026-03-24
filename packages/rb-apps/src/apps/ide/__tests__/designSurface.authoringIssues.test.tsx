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

const ISSUE_CIRCUIT: Circuit = {
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
      label: 'LED0',
      position: { x: 210, y: 0 },
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
  ],
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
        [{
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
        } as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
}

function renderSurface(overrides: Partial<React.ComponentProps<typeof DesignSurface>> = {}) {
  const onRuntimeSimSetSelectedSignal = vi.fn();

  const view = render(
    <DesignSurface
      runtimeSim={makeRuntimeSim()}
      ioRows={[]}
      onRuntimeSimRun={vi.fn()}
      onRuntimeSimPause={vi.fn()}
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
      onRuntimeSimSetSpeed={vi.fn()}
      onRuntimeSimToggleProbe={vi.fn()}
      onRuntimeSimSetSelectedSignal={onRuntimeSimSetSelectedSignal}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
      {...overrides}
    />
  );

  return { ...view, onRuntimeSimSetSelectedSignal };
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(ISSUE_CIRCUIT), isDirty: false, past: [], future: [] });
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

describe('DesignSurface authoring issues', () => {
  it('renders a compact authoring status row and keeps draft wiring issues non-blocking', async () => {
    const view = renderSurface();

    await waitFor(() => {
      expect(view.getByTestId('ide-design-authoring-issues')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-authoring-issues-errors').textContent).toContain('0 errors');
    expect(view.getByTestId('ide-design-authoring-issues-warnings').textContent).toContain('0 warnings');
    expect(view.getByTestId('ide-design-authoring-issues-drafts').textContent).toContain('2 drafts');
    expect(view.getByTestId('ide-design-authoring-issue-0').textContent).toContain('Output not wired yet');
  });

  it('focus action selects the affected node and routes inspector focus to the issue port', async () => {
    const view = renderSurface();

    fireEvent.click(await view.findByTestId('ide-design-authoring-issue-focus-0'));

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-selection-type').textContent).toBe('Output');
    expect(view.onRuntimeSimSetSelectedSignal).toHaveBeenCalledWith('ld0_node.in');
    expect(useLogicViewStore.getState().selection.nodes.has('ld0_node')).toBe(true);
  });

  it('shows the selection-local issue explanation before raw metrics', async () => {
    const view = renderSurface();

    act(() => {
      useLogicViewStore.getState().selectNode('ld0_node');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-design-selection-issues')).toBeTruthy();
    });

    const issueBlock = view.getByTestId('ide-design-selection-issues');
    const currentValue = view.getByTestId('ide-design-context-current');
    const position = issueBlock.compareDocumentPosition(currentValue);

    expect(issueBlock.textContent).toContain('Output not wired yet');
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps invalid wire feedback sticky until escape clears it', async () => {
    const view = renderSurface();

    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="node-INPUT-sw0_node"]')).not.toBeNull();
      expect(view.container.querySelector('[data-testid="node-OUTPUT-ld0_node"]')).not.toBeNull();
    });

    const sourcePort = view.container.querySelector(
      '[data-testid="node-INPUT-sw0_node"] [data-port-id="out"]'
    ) as Element | null;
    const invalidTargetPort = view.container.querySelector(
      '[data-testid="node-OUTPUT-ld0_node"] [data-port-id="out"]'
    ) as Element | null;

    expect(sourcePort).toBeTruthy();
    expect(invalidTargetPort).toBeTruthy();

    fireEvent.click(sourcePort!);
    fireEvent.click(invalidTargetPort!);

    await waitFor(() => {
      expect(view.getByTestId('ide-design-wire-feedback').textContent).toContain(
        'Outputs cannot be wired directly to each other.'
      );
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(view.queryByTestId('ide-design-wire-feedback')).toBeNull();
    });
  });
});
