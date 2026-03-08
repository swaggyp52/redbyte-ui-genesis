// Copyright © 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { CircuitEngine, type Circuit } from '@redbyte/rb-logic-core';
import { OscilloscopeView } from '../components/OscilloscopeView';

// Mock @redbyte/rb-utils
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
    const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
    return {
        ...actual,
        useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
            selector ? selector(mockUiTickState) : mockUiTickState,
        trackRender: vi.fn(),
    };
});

// Mock stores (same as oscilloscope-controls.test.tsx)
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
            (selector?: (state: typeof mockViewState) => unknown) =>
                selector ? selector(mockViewState) : mockViewState,
            {
                getState: () => mockViewState,
                setState: vi.fn(),
                subscribe: vi.fn(() => vi.fn()),
            }
        ),
    };
});

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
    let probeIdCounter = 0;

    const mockProbeState = {
        get probes() { return probes; },
        get activeProbeId() { return activeProbeId; },
        addProbe: vi.fn(({ nodeId, portName, label }) => {
            const id = `probe-${++probeIdCounter}`;
            probes = [...probes, { id, nodeId, portName, label, color: '#00ffff', enabled: true }];
            activeProbeId = id;
            return id;
        }),
        removeProbe: vi.fn((id: string) => {
            probes = probes.filter((p) => p.id !== id);
            if (activeProbeId === id) activeProbeId = null;
        }),
        renameProbe: vi.fn(),
        toggleProbe: vi.fn((id: string) => {
            probes = probes.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
        }),
        setActiveProbe: vi.fn((id: string | null) => { activeProbeId = id; }),
        clearProbes: vi.fn(() => { probes = []; activeProbeId = null; }),
        setProbes: vi.fn(),
        toggleProbeForPort: vi.fn(),
        hasProbe: vi.fn(() => false),
        reorderProbes: vi.fn(),
    };

    const resetMockState = () => {
        probes = [];
        activeProbeId = null;
        probeIdCounter = 0;
    };

    return {
        useProbeStore: Object.assign(
            (selector?: (state: typeof mockProbeState) => unknown) =>
                selector ? selector(mockProbeState) : mockProbeState,
            {
                getState: () => mockProbeState,
                setState: vi.fn(),
                subscribe: vi.fn(() => vi.fn()),
                _reset: resetMockState,
            }
        ),
    };
});

vi.mock('../stores/oscilloscopeStore', () => {
    let pauseScroll = false;
    let showTimeCursor = true;
    let timeWindowSec = 10;
    let showTickGuides = true;
    let clearRequestId = 0;

    const mockOscilloscopeState = {
        get pauseScroll() { return pauseScroll; },
        get showTimeCursor() { return showTimeCursor; },
        get timeWindowSec() { return timeWindowSec; },
        get showTickGuides() { return showTickGuides; },
        get clearRequestId() { return clearRequestId; },
        setPauseScroll: vi.fn((enabled: boolean) => { pauseScroll = enabled; }),
        togglePauseScroll: vi.fn(() => { pauseScroll = !pauseScroll; }),
        setShowTimeCursor: vi.fn((enabled: boolean) => { showTimeCursor = enabled; }),
        toggleTimeCursor: vi.fn(() => { showTimeCursor = !showTimeCursor; }),
        setTimeWindowSec: vi.fn((seconds: number) => { timeWindowSec = Math.max(1, Math.min(10, Math.round(seconds))); }),
        setShowTickGuides: vi.fn((enabled: boolean) => { showTickGuides = enabled; }),
        requestClear: vi.fn(() => { clearRequestId++; }),
    };

    const resetMockState = () => {
        pauseScroll = false;
        showTimeCursor = true;
        timeWindowSec = 10;
        showTickGuides = true;
        clearRequestId = 0;
    };

    return {
        useOscilloscopeStore: Object.assign(
            (selector?: (state: typeof mockOscilloscopeState) => unknown) =>
                selector ? selector(mockOscilloscopeState) : mockOscilloscopeState,
            {
                getState: () => mockOscilloscopeState,
                setState: vi.fn(),
                subscribe: vi.fn(() => vi.fn()),
                _reset: resetMockState,
            }
        ),
    };
});

import { useProbeStore } from '../stores/probeStore';
import { useOscilloscopeStore } from '../stores/oscilloscopeStore';

const createCircuit = (): Circuit => ({
    nodes: [
        {
            id: 'switch1',
            type: 'Switch',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
            state: { isOn: 1 },
        },
    ],
    connections: [],
});

const createMockTickEngine = () => {
    let tickCount = 0;
    const traces: Array<{
        tick: number;
        timestamp: number;
        signals: Map<string, 0 | 1>;
        nodeStates: Map<string, Record<string, any>>;
        changedNodes: string[];
    }> = [];

    const mockTraceRecorder = {
        getAllTraces: () => traces,
        isActive: () => true,
        start: vi.fn(),
        stop: vi.fn(),
        clear: vi.fn(() => { traces.length = 0; }),
        getStats: () => ({
            totalTicks: traces.length,
            totalChanges: 0,
            memoryUsage: 0,
        }),
    };

    return {
        getTraceRecorder: () => mockTraceRecorder,
        enableTracing: vi.fn(),
        getTickCount: () => tickCount,
        getTickRate: () => 20,
        _simulateTick: (value: 0 | 1 = 1) => {
            tickCount++;
            traces.push({
                tick: tickCount,
                timestamp: Date.now(),
                signals: new Map([['switch1.out', value]]),
                nodeStates: new Map(),
                changedNodes: ['switch1'],
            });
            if (traces.length > 100) traces.shift();
        },
        _getTraces: () => traces,
    } as any;
};

const getCanvas = () => screen.getByTestId('oscilloscope-canvas');
const getNumericAttr = (attr: string) => Number(getCanvas().getAttribute(attr));

describe('Oscilloscope Hardening Tests', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(0));

        const mockCtx = {
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            setLineDash: vi.fn(),
            fillText: vi.fn(),
            measureText: (text: string) => ({ width: text.length * 6 }),
            strokeStyle: '',
            lineWidth: 1,
            fillStyle: '',
            font: '',
            shadowColor: '',
            shadowBlur: 0,
        };

        HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
        (useProbeStore as any)._reset?.();
        (useOscilloscopeStore as any)._reset?.();
    });

    afterEach(() => {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        vi.useRealTimers();
        cleanup();
    });

    it('captures exact tick samples deterministically', () => {
        const circuit = createCircuit();
        const engine = new CircuitEngine(circuit);
        const tickEngine = createMockTickEngine();

        useProbeStore.getState().addProbe({
            nodeId: 'switch1',
            portName: 'out',
            label: 'Switch out',
        });

        render(
            <OscilloscopeView
                engine={engine}
                tickEngine={tickEngine}
                circuit={circuit}
                isRunning={true}
            />
        );

        // Simulate 5 ticks with alternating values
        act(() => {
            tickEngine._simulateTick(1);
            tickEngine._simulateTick(0);
            tickEngine._simulateTick(1);
            tickEngine._simulateTick(0);
            tickEngine._simulateTick(1);
            vi.advanceTimersByTime(100); // Allow polling to catch up
        });

        // Verify we have exactly 5 samples (one per tick)
        const totalSamples = getNumericAttr('data-total-samples');
        expect(totalSamples).toBe(5);

        // Verify traces match ticks
        const traces = tickEngine._getTraces();
        expect(traces.length).toBe(5);
        expect(traces[0].tick).toBe(1);
        expect(traces[4].tick).toBe(5);
    });

    it('respects buffer limits (MAX_SAMPLES = 500)', () => {
        const circuit = createCircuit();
        const engine = new CircuitEngine(circuit);
        const tickEngine = createMockTickEngine();

        useProbeStore.getState().addProbe({
            nodeId: 'switch1',
            portName: 'out',
            label: 'Switch out',
        });

        render(
            <OscilloscopeView
                engine={engine}
                tickEngine={tickEngine}
                circuit={circuit}
                isRunning={true}
            />
        );

        // Simulate 600 ticks (exceeds MAX_SAMPLES)
        act(() => {
            for (let i = 0; i < 600; i++) {
                tickEngine._simulateTick(i % 2 as 0 | 1);
            }
            vi.advanceTimersByTime(1000);
        });

        // Should be capped at 500 samples per probe
        const totalSamples = getNumericAttr('data-total-samples');
        expect(totalSamples).toBeLessThanOrEqual(500);
    });

    it('cleans up intervals on unmount', () => {
        const circuit = createCircuit();
        const engine = new CircuitEngine(circuit);
        const tickEngine = createMockTickEngine();

        useProbeStore.getState().addProbe({
            nodeId: 'switch1',
            portName: 'out',
            label: 'Switch out',
        });

        const { unmount } = render(
            <OscilloscopeView
                engine={engine}
                tickEngine={tickEngine}
                circuit={circuit}
                isRunning={true}
            />
        );

        // Spy on clearInterval
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        act(() => {
            unmount();
        });

        // Should have cleared at least one interval (the polling interval)
        expect(clearIntervalSpy).toHaveBeenCalled();
    });
});
