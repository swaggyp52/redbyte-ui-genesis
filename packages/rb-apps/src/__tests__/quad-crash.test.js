import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { describe, it, expect, vi } from 'vitest';
// Mock dependencies
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
    OscilloscopeView: (props) => (_jsxs("div", { "data-testid": "oscilloscope-view", children: ["OscilloscopeView (v", props.signalsVersion ?? 'undefined', ")"] })),
}));
// Mock other views to avoid rendering complexity
vi.mock('../components/SchematicView', () => ({ SchematicView: () => _jsx("div", { children: "SchematicView" }) }));
vi.mock('../components/CircuitToolStrip', () => ({ CircuitToolStrip: () => _jsx("div", { children: "Toolbar" }) }));
// Mock Logic3D lazy load
vi.mock('@redbyte/rb-logic-3d', () => ({ Logic3DScene: () => _jsx("div", { children: "3DScene" }) }));
describe('SplitViewLayout Crash Guard', () => {
    it('renders Quad mode without crashing due to missing signalsVersion', () => {
        // Setup minimal props
        const engine = {};
        const tickEngine = { getTickRate: () => 10 }; // Partial mock
        const circuit = { nodes: [], connections: [] };
        const { container } = render(_jsx(SplitViewLayout, { mode: "quad", views: ['circuit', 'schematic', '3d', 'oscilloscope'], engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: false, onCircuitChange: vi.fn() }));
        // Check if Oscilloscope rendered (which means ViewRenderer didn't crash)
        expect(screen.getByTestId('oscilloscope-view')).toBeInTheDocument();
        // Check if signalsVersion was passed (from our mock log)
        expect(screen.getByTestId('oscilloscope-view')).toHaveTextContent('v0');
    });
});
