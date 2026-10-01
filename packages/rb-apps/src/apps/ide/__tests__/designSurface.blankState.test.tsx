// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { workspacePreferencesStore } from '../workspacePreferences';
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
    stepMode: false,
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
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
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
  workspacePreferencesStore.reset();
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
  it('keeps repeated canvas input exploration in runtime state and reset restores the authored default', () => {
    const authored = structuredClone(FOCUS_CIRCUIT);
    authored.nodes[0].state = {};
    useCircuitStore.setState({ circuit: authored });
    const mutations = vi.fn();
    function LiveHarness() {
      const [sim, setSim] = React.useState({ ...makeRuntimeSim(), inputs: { sw0_node: 0 as 0 | 1 } });
      return <DesignSurface runtimeSim={sim} ioRows={[]}
        onRuntimeSimSetInput={(id, value) => setSim(current => ({ ...current,
          inputs: { ...current.inputs, [id]: value }, signals: { ...current.signals, [`${id}.out`]: value } }))}
        onRuntimeSimReset={vi.fn()} onCircuitMutated={mutations}
        onGoToProject={vi.fn()} onGoToVerify={vi.fn()} />;
    }
    const view = render(<LiveHarness />);
    fireEvent.click(view.getByTestId('ide-design-explore'));
    for (const expected of [1, 0, 1]) {
      fireEvent.click(view.getByTestId('switch-toggle-sw0_node'));
      expect(view.getByTestId('node-INPUT-sw0_node').getAttribute('data-sim-value')).toBe(String(expected));
      expect(useCircuitStore.getState().circuit.nodes[0].state).toEqual({});
    }
    fireEvent.click(view.getByTestId('ide-design-live-reset'));
    expect(view.getByTestId('node-INPUT-sw0_node').getAttribute('data-sim-value')).toBe('0');
    expect(mutations).not.toHaveBeenCalled();
  });
  it('restores authored input defaults before resetting exploratory register state', () => {
    useCircuitStore.setState({ circuit: {
      ...structuredClone(FOCUS_CIRCUIT),
      nodes: [...structuredClone(FOCUS_CIRCUIT.nodes),
        { ...structuredClone(FOCUS_CIRCUIT.nodes[0]), id: 'low_input', state: {} }],
    } });
    const actions: Array<string> = [];
    const view = render(<DesignSurface
      runtimeSim={{ ...makeRuntimeSim(), inputs: { sw0_node: 0, low_input: 1 } }}
      ioRows={[]}
      onRuntimeSimSetInput={(id, value) => actions.push(`${id}=${value}`)}
      onRuntimeSimReset={() => actions.push('reset')}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
    />);
    fireEvent.click(view.getByTestId('ide-design-explore'));
    fireEvent.click(view.getByTestId('ide-design-live-reset'));
    expect(actions).toEqual(['sw0_node=1', 'low_input=0', 'reset']);
    expect(useCircuitStore.getState().circuit.nodes[0].state).toEqual({ isOn: 1 });
  });
  it('offers Clock edge during exploration of the supported scalar register', () => {
    const input = structuredClone(FOCUS_CIRCUIT.nodes[0]);
    const output = structuredClone(FOCUS_CIRCUIT.nodes[1]);
    useCircuitStore.setState({ circuit: {
      nodes: [input, { ...input, id: 'clock', label: 'CLK' }, output,
        { id: 'register', type: 'Register1', position: { x: 90, y: 0 }, rotation: 0, config: {}, state: {} }],
      connections: [
        { id: 'd', from: { nodeId: input.id, portName: 'out' }, to: { nodeId: 'register', portName: 'D' } },
        { id: 'clk', from: { nodeId: 'clock', portName: 'out' }, to: { nodeId: 'register', portName: 'CLK' } },
        { id: 'q', from: { nodeId: 'register', portName: 'Q' }, to: { nodeId: output.id, portName: 'in' } },
      ],
    } });
    const actions: Array<string> = [];
    const view = render(<DesignSurface
      runtimeSim={{ ...makeRuntimeSim(), inputs: { [input.id]: 1, clock: 0 } }}
      ioRows={[]}
      onRuntimeSimSetInput={(id, value) => actions.push(`${id}=${value}`)}
      onRuntimeSimStep={() => actions.push('step')}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
    />);
    fireEvent.click(view.getByTestId('ide-design-explore'));
    expect(view.getByTestId('ide-design-live-step').textContent).toContain('Clock edge');
    expect(view.getByTestId('ide-design-live-note').textContent).toContain('not recorded');
    fireEvent.click(view.getByTestId('ide-design-live-step'));
    expect(actions).toEqual(['clock=0', 'clock=1', 'step', 'clock=0']);
  });
  it('clears partial-circuit guidance while Wire is active so first connections stay reachable', () => {
    useCircuitStore.setState({ circuit: { ...structuredClone(FOCUS_CIRCUIT), connections: [] } });
    const view = renderSurface();
    expect(view.getByTestId('ide-design-authoring-quickstrip')).toBeTruthy();
    fireEvent.click(view.getByTestId('ide-design-tool-wire'));
    expect(view.queryByTestId('ide-design-authoring-quickstrip')).toBeNull();
    fireEvent.click(view.getByTestId('ide-design-tool-select'));
    expect(view.getByTestId('ide-design-authoring-quickstrip')).toBeTruthy();
  });
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
    expect(view.getByTestId('ide-workbench-console').getAttribute('data-console-state')).toBe('collapsed');
    expect(view.getByTestId('ide-design-zoom-reset')).toBeTruthy();
    expect((view.getByTestId('ide-design-center-selection-canvas') as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts direct input placement from the blank-state task actions', async () => {
    const view = render(
      <DesignSurface
        runtimeSim={makeRuntimeSim()}
        ioRows={[]}
        onRuntimeSimStep={vi.fn()}
        onRuntimeSimReset={vi.fn()}
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
            onRuntimeSimStep={vi.fn()}
            onRuntimeSimReset={vi.fn()}
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
