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

const EMPTY_CIRCUIT: Circuit = {
  nodes: [],
  connections: [],
};

const FOCUS_CIRCUIT: Circuit = {
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
  it('keeps a lighter blank-state onboarding card while giving the canvas the unused inspector space', async () => {
    const view = renderSurface();

    await waitFor(() => {
      expect(view.getByTestId('ide-design-empty-state')).toBeTruthy();
    });

    expect(view.getByTestId('ide-design-empty-state').textContent).toContain('Start a circuit');
    expect(view.getByTestId('ide-design-empty-state').textContent).toContain('Add input');
    expect(view.getByTestId('ide-design-empty-state').textContent).toContain('Add output');
    expect(view.getByTestId('ide-design-empty-state').textContent).toContain('Place gate');
    expect(view.getByTestId('ide-design-empty-state').textContent).toContain('Component Library');
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.queryByTestId('ide-right-dock')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(view.queryByTestId('ide-design-library-collapse')).toBeNull();

    expect(view.queryByTestId('ide-design-inspector-canvas-default')).toBeNull();
    expect(view.queryByTestId('ide-design-shortcut-strip')).toBeNull();
    expect(view.queryByTestId('ide-design-inspector-empty')).toBeNull();
    expect(view.queryByTestId('ide-design-inspector-next-step')).toBeNull();
    expect(view.queryByTestId('ide-workbench-console')).toBeNull();
    expect(view.getByTestId('ide-design-overflow-reset')).toBeTruthy();
    expect((view.getByTestId('ide-design-overflow-center-selection') as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts direct input placement from the blank-state task actions', async () => {
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
        onGoToProject={vi.fn()}
        onGoToVerify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-design-empty-state')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-design-empty-add-input'));
    await waitFor(() => {
      expect(useLogicViewStore.getState().interactionMode).toBe('placing');
    });
    expect(view.queryByTestId('ide-design-empty-state')).toBeNull();
  });
});

describe('DesignSurface signal focus ownership', () => {
  it.each([
    {
      focus: 'Verify',
      props: {
        activeVerifySignal: 'LD0',
      } satisfies Partial<React.ComponentProps<typeof DesignSurface>>,
    },
    {
      focus: 'debug',
      props: {
        externalDebugTick: 6,
        externalDebugSignals: new Map<string, 0 | 1>([
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
      } satisfies Partial<React.ComponentProps<typeof DesignSurface>>,
    },
  ])('keeps incoming $focus focus authoritative while a wire remains selected', async ({ props }) => {
    useCircuitStore.setState({
      circuit: structuredClone(FOCUS_CIRCUIT),
      isDirty: false,
      past: [],
      future: [],
    });
    const setSelectedSignal = vi.fn();

    function ExternalFocusHarness() {
      const [focusActive, setFocusActive] = React.useState(false);
      const [runtimeSim, setRuntimeSim] = React.useState<RuntimeSimState>(() => ({
        ...makeRuntimeSim(),
        signals: {
          'sw0_node.out': 1,
          'ld0_node.in': 1,
        },
      }));
      const handleSelectedSignal = React.useCallback((signalKey: string | null) => {
        setSelectedSignal(signalKey);
        setRuntimeSim((current) =>
          current.selectedSignalKey === signalKey
            ? current
            : { ...current, selectedSignalKey: signalKey }
        );
      }, [setSelectedSignal]);

      return (
        <>
          <button data-testid="activate-external-design-focus" onClick={() => setFocusActive(true)}>
            Activate focus
          </button>
          <DesignSurface
            runtimeSim={runtimeSim}
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
            onRuntimeSimSetSelectedSignal={handleSelectedSignal}
            onGoToProject={vi.fn()}
            onGoToVerify={vi.fn()}
            {...(focusActive ? props : {})}
          />
        </>
      );
    }

    const view = render(<ExternalFocusHarness />);
    act(() => {
      useLogicViewStore.getState().selectWire('sw0_node.out-ld0_node.in');
    });

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('sw0_node.out');
    });
    setSelectedSignal.mockClear();

    fireEvent.click(view.getByTestId('activate-external-design-focus'));

    await waitFor(() => {
      expect(setSelectedSignal).toHaveBeenCalledWith('ld0_node.in');
      expect(setSelectedSignal.mock.calls.at(-1)?.[0]).toBe('ld0_node.in');
    });
    expect(setSelectedSignal).not.toHaveBeenCalledWith('sw0_node.out');
  });
});
