import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
// Mock everything to isolate ViewRenderer plumbing
vi.mock('@redbyte/rb-logic-view', () => ({
    LogicCanvas: () => _jsx("div", { "data-testid": "logic-canvas", children: "LogicCanvas" }),
    calculateFitToView: vi.fn(),
    useLogicViewStore: vi.fn(() => ({
        toolMode: 'select',
        selection: { nodes: new Set(), wires: new Set() },
        setCamera: vi.fn(),
        setToolMode: vi.fn(),
    })), // Mock selector hook
}));
vi.mock('../components/OscilloscopeView', () => ({
    OscilloscopeView: (props) => (_jsxs("div", { "data-testid": "oscilloscope-view", children: ["Scope v", props.signalsVersion !== undefined ? props.signalsVersion : 'MISSING'] })),
}));
vi.mock('../components/SchematicView', () => ({ SchematicView: () => _jsx("div", { children: "SchematicView" }) }));
vi.mock('../components/CircuitToolStrip', () => ({ CircuitToolStrip: () => _jsx("div", { children: "Toolbar" }) }));
vi.mock('@redbyte/rb-logic-3d', () => ({ Logic3DScene: () => _jsx("div", { children: "3DScene" }) }));
describe('Quad Mode SignalsVersion Guard', () => {
    it('renders ViewRenderer with valid signalsVersion prop', () => {
        // Setup minimal props
        const engine = {};
        const tickEngine = { getTickRate: () => 10 };
        const circuit = { nodes: [], connections: [] };
        render(_jsx(MemoryRouter, { children: _jsx(SplitViewLayout, { mode: "quad", views: ['circuit', 'schematic', '3d', 'oscilloscope'], engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: false, onCircuitChange: vi.fn() }) }));
        // Verify prop is passed down (should not be MISSING)
        const scope = screen.getByTestId('oscilloscope-view');
        expect(scope).toHaveTextContent('Scope v0');
    });
});
