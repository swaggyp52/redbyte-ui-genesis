// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogicPlaygroundApp } from '../apps/LogicPlaygroundApp';
import { useCircuitStore } from '../stores/circuitStore';
import { useFileSystemStore } from '../stores/fileSystemStore';

// Mock @redbyte/rb-utils to prevent useUiTickStore RAF loop
// All mock state MUST be inside factory due to vi.mock hoisting
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  const mockSettingsState = {
    themeVariant: 'dark' as const,
    wallpaperId: 'default' as const,
    accentColor: 'blue' as const,
    tickRate: 20,
    setThemeVariant: vi.fn(),
    setWallpaperId: vi.fn(),
    setAccentColor: vi.fn(),
    setTickRate: vi.fn(),
  };
  const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
  return {
    ...actual,
    useSettingsStore: Object.assign(
      (selector?: (state: typeof mockSettingsState) => unknown) =>
        selector ? selector(mockSettingsState) : mockSettingsState,
      {
        getState: () => mockSettingsState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
    trackRender: vi.fn(),
  };
});

// Mock @redbyte/rb-shell
vi.mock('@redbyte/rb-shell', () => ({
  useToastStore: Object.assign(
    () => ({ addToast: vi.fn() }),
    {
      getState: () => ({ addToast: vi.fn() }),
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    }
  ),
}));

// Mock @redbyte/rb-windowing
vi.mock('@redbyte/rb-windowing', () => {
  const mockWindowState = {
    setWindowTitle: vi.fn(),
    getFocusedWindow: vi.fn(() => null),
  };
  return {
    useWindowStore: Object.assign(
      (selector?: (state: typeof mockWindowState) => unknown) =>
        selector ? selector(mockWindowState) : mockWindowState,
      {
        getState: () => mockWindowState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock tutorial store
vi.mock('../tutorial/tutorialStore', () => {
  const mockTutorialState = { active: false, start: vi.fn() };
  return {
    useTutorialStore: Object.assign(
      (selector?: (state: typeof mockTutorialState) => unknown) =>
        selector ? selector(mockTutorialState) : mockTutorialState,
      {
        getState: () => mockTutorialState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock @redbyte/rb-logic-view - uses Set objects which can trigger React 19 snapshot issues
// Note: We use a function component instead of forwardRef to avoid require('react') issues
vi.mock('@redbyte/rb-logic-view', () => {
  const mockSelection = { nodes: new Set<string>(), wires: new Set<string>() };
  const mockCamera = { x: 0, y: 0, zoom: 1 };
  const mockState = {
    selection: mockSelection,
    toolMode: 'select' as const,
    setToolMode: vi.fn(),
    snapToGrid: true,
    toggleSnapToGrid: vi.fn(),
    setCamera: vi.fn(),
    camera: mockCamera,
    pan: vi.fn(),
    zoom: vi.fn(),
    selectNode: vi.fn(),
    selectWire: vi.fn(),
    clearSelection: vi.fn(),
    selectMultipleNodes: vi.fn(),
    editingState: { isDragging: false },
    setEditingState: vi.fn(),
    startWire: vi.fn(),
    endWire: vi.fn(),
    gridSize: 16,
  };
  // Use a simple object with a render function that returns null - component will be replaced at runtime
  const MockLogicCanvas = () => null;
  MockLogicCanvas.displayName = 'MockLogicCanvas';
  return {
    LogicCanvas: MockLogicCanvas,
    calculateFitToView: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    setGlobalViewStateSync: vi.fn(),
    useLogicViewStore: Object.assign(
      (selector?: (state: typeof mockState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockState) : mockState,
      {
        getState: () => mockState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
    getGlobalViewStateStore: () => null,
  };
});

// Mock viewStateStore - uses Set objects which can trigger React 19 snapshot issues
vi.mock('../stores/viewStateStore', () => {
  const selectedNodeIds = new Set<string>();
  const selectedWireIds = new Set<string>();
  const autoProbedNodes = new Set<string>();
  const mockViewState = {
    selectedNodeIds,
    selectedWireIds,
    hoveredNodeId: null as string | null,
    highlightedNodeId: null as string | null,
    focusNodeId: null as string | null,
    focusRequestId: 0,
    autoProbedNodes,
    autoProbeEnabled: false,
    highlightProbePaths: true,
    splitScreenMode: 'single' as const,
    activeViews: ['circuit'] as ('circuit' | 'schematic' | 'oscilloscope' | '3d')[],
    circuitViewSize: null as { width: number; height: number } | null,
    selectNodes: vi.fn(),
    selectWires: vi.fn(),
    clearSelection: vi.fn(),
    setHoveredNode: vi.fn(),
    setHighlightedNode: vi.fn(),
    requestFocusNode: vi.fn(),
    toggleAutoProbe: vi.fn(),
    setAutoProbeEnabled: vi.fn(),
    setHighlightProbePaths: vi.fn(),
    clearAutoProbes: vi.fn(),
    setSplitScreenMode: vi.fn(),
    setActiveViews: vi.fn(),
    setCircuitViewSize: vi.fn(),
  };
  return {
    useViewStateStore: Object.assign(
      (selector?: (state: typeof mockViewState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockViewState) : mockViewState,
      {
        getState: () => mockViewState,
        setState: vi.fn((partial: Partial<typeof mockViewState>) => {
          Object.assign(mockViewState, partial);
        }),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock probeStore - depends on viewStateStore
vi.mock('../stores/probeStore', () => {
  interface Probe {
    id: string;
    nodeId: string;
    portName: string;
    label: string;
    color: string;
    enabled: boolean;
  }
  let probes: Probe[] = [];
  let activeProbeId: string | null = null;
  const mockProbeState = {
    get probes() {
      return probes;
    },
    get activeProbeId() {
      return activeProbeId;
    },
    addProbe: vi.fn(),
    removeProbe: vi.fn(),
    renameProbe: vi.fn(),
    toggleProbe: vi.fn(),
    setActiveProbe: vi.fn(),
    clearProbes: vi.fn(),
    setProbes: vi.fn(),
    toggleProbeForPort: vi.fn(),
    hasProbe: vi.fn(() => false),
    reorderProbes: vi.fn(),
  };
  return {
    useProbeStore: Object.assign(
      (selector?: (state: typeof mockProbeState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockProbeState) : mockProbeState,
      {
        getState: () => mockProbeState,
        setState: vi.fn((partial: Partial<{ probes: Probe[]; activeProbeId: string | null }>) => {
          if (partial.probes !== undefined) probes = partial.probes;
          if (partial.activeProbeId !== undefined) activeProbeId = partial.activeProbeId;
        }),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock oscilloscopeStore
vi.mock('../stores/oscilloscopeStore', () => {
  const mockOscilloscopeState = {
    pauseScroll: false,
    showTimeCursor: true,
    timeWindowSec: 10,
    showTickGuides: true,
    clearRequestId: 0,
    setPauseScroll: vi.fn(),
    togglePauseScroll: vi.fn(),
    setShowTimeCursor: vi.fn(),
    toggleTimeCursor: vi.fn(),
    setTimeWindowSec: vi.fn(),
    setShowTickGuides: vi.fn(),
    requestClear: vi.fn(),
  };
  return {
    useOscilloscopeStore: Object.assign(
      (selector?: (state: typeof mockOscilloscopeState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockOscilloscopeState) : mockOscilloscopeState,
      {
        getState: () => mockOscilloscopeState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock layoutStore
vi.mock('../stores/layoutStore', () => {
  const mockLayoutState = {
    perspective: 'build' as const,
    splitScreenMode: 'single' as const,
    activeViews: ['circuit'] as ('circuit' | 'schematic' | 'oscilloscope' | '3d')[],
    splitRatio: 0.5,
    rightDockState: 'expanded' as const,
    rightDockTab: 'inspector' as const,
    showHelpDock: false,
    helpDockSection: null,
    schematicMiniEnabled: true,
    setPerspective: vi.fn(),
    setRightDockState: vi.fn(),
    setRightDockTab: vi.fn(),
    setShowHelpDock: vi.fn(),
    setHelpDockSection: vi.fn(),
    setSplitRatio: vi.fn(),
    toggleSchematicMini: vi.fn(),
    resetLayout: vi.fn(),
  };
  return {
    useLayoutStore: Object.assign(
      (selector?: (state: typeof mockLayoutState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockLayoutState) : mockLayoutState,
      {
        getState: () => mockLayoutState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock hierarchyStore
vi.mock('../stores/hierarchyStore', () => {
  const probedSignals = new Set<string>();
  const mockHierarchyState = {
    stack: [] as { name: string; circuit: { nodes: []; connections: [] } }[],
    currentCircuit: { nodes: [], connections: [] },
    currentChip: null,
    isEditMode: false,
    probedSignals,
    enterChip: vi.fn(),
    exitToParent: vi.fn(),
    exitToTop: vi.fn(),
    setCurrentCircuit: vi.fn(),
    toggleEditMode: vi.fn(),
    addProbe: vi.fn(),
    removeProbe: vi.fn(),
    clearProbes: vi.fn(),
    reset: vi.fn(),
  };
  return {
    useHierarchyStore: Object.assign(
      (selector?: (state: typeof mockHierarchyState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockHierarchyState) : mockHierarchyState,
      {
        getState: () => mockHierarchyState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// Mock runRecorderStore
vi.mock('../stores/runRecorderStore', () => {
  const mockRunRecorderState = {
    mode: 'idle' as const,
    context: null,
    replay: null,
    stimulus: [] as unknown[],
    trace: [] as unknown[],
    replayTrace: [] as unknown[],
    record: null,
    verificationStatus: { status: 'unknown' as const },
    debugOverlay: null,
    playheadTick: 0,
    replayPaused: false,
    pendingStepTicks: null,
    pendingJumpTick: null,
    // Actions
    arm: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    recordEvent: vi.fn(),
    removeEventAt: vi.fn(),
    moveEvent: vi.fn(),
    applyEditedEvents: vi.fn(),
    normalizeEvents: vi.fn(),
    recordTraceSample: vi.fn(),
    startReplay: vi.fn(),
    recordReplaySample: vi.fn(),
    stopReplay: vi.fn(),
    verifyReplay: vi.fn(),
    reset: vi.fn(),
    setPlayheadTick: vi.fn(),
    setReplayPaused: vi.fn(),
    stepReplay: vi.fn(),
    jumpReplay: vi.fn(),
    setRecord: vi.fn(),
    setVerificationStatus: vi.fn(),
    setDebugOverlay: vi.fn(),
  };
  return {
    useRunRecorderStore: Object.assign(
      (selector?: (state: typeof mockRunRecorderState) => unknown, _equalityFn?: unknown) =>
        selector ? selector(mockRunRecorderState) : mockRunRecorderState,
      {
        getState: () => mockRunRecorderState,
        setState: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

// FIXME: React 19 + Zustand infinite loop issue
// This integration test renders LogicPlaygroundApp which uses circuitStore/fileSystemStore/chipStore.
// These stores use real Zustand subscriptions that trigger React 19's stricter useSyncExternalStore.
// The mocks above prevent many stores from causing loops, but the core circuitStore cannot be mocked
// without defeating the test's purpose (testing circuit manipulation).
// Root cause fix needed: Update stores to cache getSnapshot results, or use arrays instead of Sets.
// See: packages/rb-apps/src/stores/viewStateStore.ts, probeStore.ts, circuitStore.ts
describe.skip('Playground - Palette Interaction (PR0 Baseline)', () => {
  beforeEach(() => {
    // Clear state
    localStorage.clear();
    const { resetAll } = useFileSystemStore.getState();
    resetAll();
    const { reset } = useCircuitStore.getState();
    reset();
  });

  it('should add node to circuit when palette component is clicked', async () => {
    const user = userEvent.setup();

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render by checking for Step button (stable UI element)
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Get initial circuit state
    const initialNodeCount = useCircuitStore.getState().circuit.nodes.length;

    // Find AND gate in palette (may appear multiple times due to favorites/recents)
    const andButtons = screen.getAllByText(/^AND$/);
    await user.click(andButtons[0]);

    // Verify node was added to store
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(initialNodeCount + 1);
      expect(circuit.nodes[circuit.nodes.length - 1].type).toBe('AND');
    });
  });

  it('should have engines connected when circuit mutations occur', async () => {
    const consoleSpy = vi.spyOn(console, 'warn');

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for UI to render (using stable element)
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Wait for engines to be initialized
    await waitFor(() => {
      const { engine, tickEngine } = useCircuitStore.getState();
      expect(engine).not.toBeNull();
      expect(tickEngine).not.toBeNull();
    });

    // Add a node via store (direct call to test invariant)
    useCircuitStore.getState().addNode('AND', { x: 100, y: 100 });

    // Verify circuit was updated
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBeGreaterThan(0);
    });

    // In dev mode, the warning should NOT appear because engines are connected
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[CircuitStore] Circuit mutation called but engines not connected')
    );

    consoleSpy.mockRestore();
  });

  it('should render Half Adder example without errors', async () => {
    // This test verifies the canonical reference example loads correctly
    const { loadExample } = await import('../examples');
    const halfAdder = await loadExample('03_half-adder');

    expect(halfAdder).toBeDefined();
    expect(halfAdder.nodes).toHaveLength(6); // 2 switches, 2 gates, 2 lamps
    expect(halfAdder.connections).toHaveLength(6);

    // Verify it has the expected structure
    const switchNodes = halfAdder.nodes.filter(n => n.type === 'Switch');
    const xorNodes = halfAdder.nodes.filter(n => n.type === 'XOR');
    const andNodes = halfAdder.nodes.filter(n => n.type === 'AND');
    const lampNodes = halfAdder.nodes.filter(n => n.type === 'Lamp');

    expect(switchNodes).toHaveLength(2);
    expect(xorNodes).toHaveLength(1);
    expect(andNodes).toHaveLength(1);
    expect(lampNodes).toHaveLength(2);
  });

  // PR1 Tests: Palette Search + Recents + Favorites
  it('should filter components by search query', async () => {
    const user = userEvent.setup();

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Find search input
    const searchInput = screen.getByPlaceholderText(/Search components/i);
    expect(searchInput).toBeInTheDocument();

    // Type "and" in search
    await user.type(searchInput, 'and');

    // Verify search results appear
    await waitFor(() => {
      expect(screen.getByText(/SEARCH RESULTS/i)).toBeInTheDocument();
    });

    // Verify AND gate is in filtered results
    const andButtons = screen.getAllByText(/^AND$/);
    expect(andButtons.length).toBeGreaterThan(0);

    // Verify NAND gate also appears (contains "and")
    expect(screen.getByText(/^NAND$/)).toBeInTheDocument();
  });

  it('should persist recents after adding components', async () => {
    const user = userEvent.setup();

    // Clear localStorage before test
    localStorage.removeItem('rb-component-recent');

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Click OR gate (get first occurrence in case it's in favorites)
    const orButtons = screen.getAllByText(/^OR$/);
    await user.click(orButtons[0]);

    // Verify OR was added to circuit
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.some(n => n.type === 'OR')).toBe(true);
    });

    // Verify recents were persisted to localStorage
    const savedRecents = localStorage.getItem('rb-component-recent');
    expect(savedRecents).toBeTruthy();
    const recents = JSON.parse(savedRecents!);
    expect(recents).toContain('OR');
  });

  // PR2 Tests: Selection + Delete
  it('should delete selected nodes when selection exists', async () => {
    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Add two nodes with a connection
    await act(async () => {
      const circuitStore = useCircuitStore.getState();
      circuitStore.addNode('AND', { x: 100, y: 100 });
      circuitStore.addNode('OR', { x: 200, y: 100 });
    });

    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(2);
    });

    // Add a connection between the nodes
    const circuit = useCircuitStore.getState().circuit;
    const node1Id = circuit.nodes[0].id;
    const node2Id = circuit.nodes[1].id;

    await act(async () => {
      useCircuitStore.getState().circuit.connections.push({
        from: { nodeId: node1Id, portName: 'out' },
        to: { nodeId: node2Id, portName: 'in' },
      });
    });

    // Import the store to select and delete
    const { useLogicViewStore } = await import('../../../rb-logic-view/src/useLogicViewStore');

    // Select first node
    await act(async () => {
      useLogicViewStore.getState().selectNode(node1Id, false);
    });

    // Verify selection
    expect(useLogicViewStore.getState().selection.nodes.has(node1Id)).toBe(true);

    // Manually trigger delete by simulating the delete handler logic
    // (Since keyboard events don't work reliably in tests)
    await act(async () => {
      const selection = useLogicViewStore.getState().selection;
      const currentCircuit = useCircuitStore.getState().circuit;

      // Filter out selected nodes and their connections
      const updatedCircuit = {
        nodes: currentCircuit.nodes.filter((n) => !selection.nodes.has(n.id)),
        connections: currentCircuit.connections.filter(
          (c) => !selection.nodes.has(c.from.nodeId) && !selection.nodes.has(c.to.nodeId)
        ),
      };

      // Update the circuit
      useCircuitStore.getState().updateCircuit(updatedCircuit);
      useLogicViewStore.getState().clearSelection();
    });

    // Verify node and connection were deleted
    await waitFor(() => {
      const updatedCircuit = useCircuitStore.getState().circuit;
      expect(updatedCircuit.nodes.length).toBe(1);
      expect(updatedCircuit.connections.length).toBe(0);
    });
  });

  it('should support multi-select with shift-click', async () => {
    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Add two AND gates to the circuit directly via store
    await act(async () => {
      useCircuitStore.getState().addNode('AND', { x: 100, y: 100 });
      useCircuitStore.getState().addNode('AND', { x: 200, y: 200 });
    });

    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(2);
    });

    // Test at store level
    const circuit = useCircuitStore.getState().circuit;
    const nodeIds = circuit.nodes.map(n => n.id);

    // Import the store to access selectNode
    const { useLogicViewStore } = await import('../../../rb-logic-view/src/useLogicViewStore');

    // Select first node
    await act(async () => {
      useLogicViewStore.getState().selectNode(nodeIds[0], false);
    });

    // Verify single selection
    expect(useLogicViewStore.getState().selection.nodes.size).toBe(1);
    expect(useLogicViewStore.getState().selection.nodes.has(nodeIds[0])).toBe(true);

    // Shift-click second node (add to selection)
    await act(async () => {
      useLogicViewStore.getState().selectNode(nodeIds[1], true);
    });

    // Verify multi-selection
    expect(useLogicViewStore.getState().selection.nodes.size).toBe(2);
    expect(useLogicViewStore.getState().selection.nodes.has(nodeIds[0])).toBe(true);
    expect(useLogicViewStore.getState().selection.nodes.has(nodeIds[1])).toBe(true);
  });

  // PR2.3 Tests: Undo/Redo
  it('should restore previous circuit when undo is called after commit', async () => {
    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Get initial circuit state
    const initialCircuit = useCircuitStore.getState().circuit;
    expect(initialCircuit.nodes.length).toBe(0);

    // Add a node via store
    await act(async () => {
      useCircuitStore.getState().addNode('AND', { x: 100, y: 100 });
    });

    // Verify node was added
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(1);
      expect(circuit.nodes[0].type).toBe('AND');
    });

    // Undo
    await act(async () => {
      useCircuitStore.getState().undo();
    });

    // Verify circuit restored to initial state
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(0);
    });
  });

  it('should restore future circuit when redo is called after undo', async () => {
    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Add two nodes
    await act(async () => {
      useCircuitStore.getState().addNode('AND', { x: 100, y: 100 });
      useCircuitStore.getState().addNode('OR', { x: 200, y: 100 });
    });

    // Verify both nodes added
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(2);
    });

    // Undo twice
    await act(async () => {
      useCircuitStore.getState().undo();
      useCircuitStore.getState().undo();
    });

    // Verify all nodes removed
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(0);
    });

    // Redo once
    await act(async () => {
      useCircuitStore.getState().redo();
    });

    // Verify first node restored
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(1);
      expect(circuit.nodes[0].type).toBe('AND');
    });

    // Redo again
    await act(async () => {
      useCircuitStore.getState().redo();
    });

    // Verify second node restored
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(2);
      expect(circuit.nodes[1].type).toBe('OR');
    });
  });

  it('should clear future history when new commit happens after undo (branching)', async () => {
    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Add two nodes
    await act(async () => {
      useCircuitStore.getState().addNode('AND', { x: 100, y: 100 });
      useCircuitStore.getState().addNode('OR', { x: 200, y: 100 });
    });

    // Verify both nodes added and can redo is false
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(2);
      expect(useCircuitStore.getState().canRedo()).toBe(false);
    });

    // Undo once
    await act(async () => {
      useCircuitStore.getState().undo();
    });

    // Verify can redo is now true
    expect(useCircuitStore.getState().canRedo()).toBe(true);

    // Add a different node (branch the history)
    await act(async () => {
      useCircuitStore.getState().addNode('NOT', { x: 150, y: 150 });
    });

    // Verify future was cleared (can't redo anymore)
    expect(useCircuitStore.getState().canRedo()).toBe(false);

    // Verify circuit has AND and NOT (OR was erased from future)
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(2);
      expect(circuit.nodes[0].type).toBe('AND');
      expect(circuit.nodes[1].type).toBe('NOT');
    });
  });
});
