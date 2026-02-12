
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitEngine, Circuit, TickEngine } from '@redbyte/rb-logic-core';

// Mock everything to isolate ViewRenderer plumbing
vi.mock('@redbyte/rb-logic-view', () => ({
    LogicCanvas: () => <div data-testid="logic-canvas">LogicCanvas</div>,
    calculateFitToView: vi.fn(),
    useLogicViewStore: vi.fn((selector?: (state: any) => unknown) => {
        const mockState = {
            toolMode: 'select',
            selection: { nodes: new Set(), wires: new Set() },
            setCamera: vi.fn(),
            setToolMode: vi.fn(),
            snapToGrid: true,
            toggleSnapToGrid: vi.fn(),
        };
        return selector ? selector(mockState) : mockState;
    }), // Mock selector hook
}));

vi.mock('../components/OscilloscopeView', () => ({
    OscilloscopeView: (props: any) => (
        <div data-testid="oscilloscope-view">
            Scope v{props.signalsVersion !== undefined ? props.signalsVersion : 'MISSING'}
        </div>
    ),
}));

vi.mock('../components/SchematicView', () => ({ SchematicView: () => <div>SchematicView</div> }));
vi.mock('../components/CircuitToolStrip', () => ({ CircuitToolStrip: () => <div>Toolbar</div> }));
vi.mock('@redbyte/rb-logic-3d', () => ({ Logic3DScene: () => <div>3DScene</div> }));

describe('Quad Mode SignalsVersion Guard', () => {
    const originalUrl = window.location.href;

    beforeEach(() => {
        window.history.replaceState({}, '', `${window.location.pathname}?disable3d=1`);
    });

    afterEach(() => {
        window.history.replaceState({}, '', originalUrl);
    });

    it('renders ViewRenderer with valid signalsVersion prop', () => {
        // Setup minimal props
        const engine = {} as CircuitEngine;
        const tickEngine = { getTickRate: () => 10 } as unknown as TickEngine;
        const circuit = { nodes: [], connections: [] } as unknown as Circuit;

        render(
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

        // Verify prop is passed down (should not be MISSING)
        const scope = screen.getByTestId('oscilloscope-view');
        expect(scope).toHaveTextContent('Scope v0');
    });
});
