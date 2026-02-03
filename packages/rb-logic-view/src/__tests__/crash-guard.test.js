import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '../LogicCanvas';
// Mock LogicViewStore with MALFORMED state (undefined selection sets)
// likely caused by bad persistence hydration or sync issues
vi.mock('../useLogicViewStore', async (importOriginal) => {
    const actual = await importOriginal();
    const mockState = {
        camera: { x: 0, y: 0, zoom: 1 },
        // Dangerous state that causes the crash: nodes is undefined instead of new Set()
        selection: { nodes: undefined, wires: undefined },
        editingState: { isDragging: false },
        snapToGrid: true,
        toolMode: 'select',
        gridSize: 16,
        setCamera: vi.fn(),
        pan: vi.fn(),
        zoom: vi.fn(),
        selectNode: vi.fn(),
        selectWire: vi.fn(),
        clearSelection: vi.fn(),
        selectMultipleNodes: vi.fn(),
        setToolMode: vi.fn(),
        setEditingState: vi.fn(),
        startWire: vi.fn(),
        endWire: vi.fn(),
        toggleSnapToGrid: vi.fn(),
    };
    return {
        ...actual,
        useLogicViewStore: (selector) => selector ? selector(mockState) : mockState,
        getGlobalViewStateStore: () => null,
    };
});
// Mock UI Tick Store
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useUiTickStore: () => ({ uiTick: 0 }),
        trackRender: vi.fn()
    };
});
describe('Circuit Canvas Resilience', () => {
    it('renders safely even when store selection is malformed (undefined Sets)', () => {
        const engine = new TickEngine({ nodes: [], connections: [] });
        // This render should NOT throw "Cannot read properties of undefined (reading 'size')"
        // because LogicCanvas should now guard selection access
        const { container } = render(_jsx(LogicCanvas, { engine: engine }));
        expect(container).toBeInTheDocument();
    });
});
