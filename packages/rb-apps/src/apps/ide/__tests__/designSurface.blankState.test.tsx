// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

const EMPTY_CIRCUIT: Circuit = {
  nodes: [],
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
  useCircuitStore.setState({
    circuit: structuredClone(EMPTY_CIRCUIT),
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

describe('DesignSurface blank-state guidance', () => {
  it('keeps a lighter blank-state onboarding card while hiding duplicate shortcut and inspector teaching', async () => {
    const view = renderSurface();

    await waitFor(() => {
      expect(view.getByTestId('ide-design-empty-state')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-empty-state').textContent).toContain('Start on canvas');
    expect(view.getByTestId('ide-design-empty-state').textContent).toContain('Add inputs and outputs, place a part, then wire ports.');
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.queryByTestId('ide-inspector')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(view.getByTestId('ide-workbench-dock-toggle-right')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-design-library-collapse'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-left-dock')).toBeNull();
      expect(view.getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-workbench-dock-toggle-right'));

    await waitFor(() => {
      expect(view.getByTestId('ide-inspector')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-inspector-canvas-default')).toBeTruthy();
    expect(view.queryByTestId('ide-design-shortcut-strip')).toBeNull();
    expect(view.getByTestId('ide-design-inspector-empty')).toBeTruthy();
    expect(view.queryByTestId('ide-design-inspector-next-step')).toBeNull();
    expect(view.queryByTestId('ide-workbench-console')).toBeNull();
  });

  it('renders an "Examples" CTA in the blank state that calls onGoToProject', async () => {
    const onGoToProject = vi.fn();
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
        onGoToProject={onGoToProject}
        onGoToVerify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-design-empty-state')).toBeTruthy();
    });

    const browseBtn = view.getByTestId('ide-design-empty-go-to-project');
    expect(browseBtn).toBeTruthy();
    fireEvent.click(browseBtn);
    expect(onGoToProject).toHaveBeenCalledOnce();
  });
});
