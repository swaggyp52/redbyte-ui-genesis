
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { describe, it, expect, vi } from 'vitest';
import { CircuitEngine, Circuit, TickEngine } from '@redbyte/rb-logic-core';

// Mock dependencies
vi.mock('@redbyte/rb-logic-view', () => ({
    LogicCanvas: () => <div data-testid="logic-canvas">LogicCanvas</div>,
    calculateFitToView: vi.fn(),
    useLogicViewStore: vi.fn(() => ({
        toolMode: 'select',
        selection: { nodes: new Set(), wires: new Set() },
        setCamera: vi.fn(),
        setToolMode: vi.fn(),
    })), // Mock selector hook
}));

vi.mock('../components/OscilloscopeView', () => ({
    OscilloscopeView: (props: any) => (
        <div data-testid="oscilloscope-view">
            OscilloscopeView (v{props.signalsVersion ?? 'undefined'})
        </div>
    ),
}));

// Mock other views to avoid rendering complexity
vi.mock('../components/SchematicView', () => ({ SchematicView: () => <div>SchematicView</div> }));
vi.mock('../components/CircuitToolStrip', () => ({ CircuitToolStrip: () => <div>Toolbar</div> }));

// Mock Logic3D lazy load
vi.mock('@redbyte/rb-logic-3d', () => ({ Logic3DScene: () => <div>3DScene</div> }));

describe('SplitViewLayout Crash Guard', () => {
    it('renders Quad mode without crashing due to missing signalsVersion', () => {
        // Setup minimal props
        const engine = {} as CircuitEngine;
        const tickEngine = { getTickRate: () => 10 } as unknown as TickEngine; // Partial mock
        const circuit = { nodes: [], connections: [] } as unknown as Circuit;

        const { container } = render(
            <SplitViewLayout
                mode="quad"
                views={['circuit', 'schematic', '3d', 'oscilloscope']}
                engine={engine}
                tickEngine={tickEngine}
                circuit={circuit}
                isRunning={false}
                onCircuitChange={vi.fn()}
            />
        );

        // Check if Oscilloscope rendered (which means ViewRenderer didn't crash)
        expect(screen.getByTestId('oscilloscope-view')).toBeInTheDocument();

        // Check if signalsVersion was passed (from our mock log)
        expect(screen.getByTestId('oscilloscope-view')).toHaveTextContent('v0');
    });
});
