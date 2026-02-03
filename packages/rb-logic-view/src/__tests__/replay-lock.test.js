import { jsx as _jsx } from "react/jsx-runtime";
// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '../LogicCanvas';
// Mock @redbyte/rb-utils to prevent useUiTickStore infinite update loops
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
    const actual = await importOriginal();
    const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
    return {
        ...actual,
        useUiTickStore: (selector) => selector ? selector(mockUiTickState) : mockUiTickState,
        trackRender: vi.fn(),
    };
});
// Mock useLogicViewStore to prevent infinite loops from selection state changes
vi.mock('../useLogicViewStore', async (importOriginal) => {
    const actual = await importOriginal();
    // All mock state must be inside factory due to vi.mock hoisting
    const mockSelection = { nodes: new Set(), wires: new Set() };
    const mockCamera = { x: 0, y: 0, zoom: 1 };
    const mockEditingState = { isDragging: false };
    const mockState = {
        camera: mockCamera,
        setCamera: vi.fn(),
        pan: vi.fn(),
        zoom: vi.fn(),
        selection: mockSelection,
        selectNode: vi.fn(),
        selectWire: vi.fn(),
        clearSelection: vi.fn(),
        selectMultipleNodes: vi.fn(),
        toolMode: 'select',
        setToolMode: vi.fn(),
        editingState: mockEditingState,
        setEditingState: vi.fn(),
        startWire: vi.fn(),
        endWire: vi.fn(),
        snapToGrid: true,
        toggleSnapToGrid: vi.fn(),
        gridSize: 16,
    };
    return {
        ...actual,
        useLogicViewStore: (selector) => selector ? selector(mockState) : mockState,
        getGlobalViewStateStore: () => null,
    };
});
describe('replay lock', () => {
    it('blocks switch toggle events during replay', () => {
        const engine = new TickEngine({
            nodes: [
                { id: 'sw1', type: 'Switch', position: { x: 0, y: 0 }, state: { isOn: 0 } },
            ],
            connections: [],
        }, { tickRate: 1 });
        const onInputToggled = vi.fn();
        const { getByTestId } = render(_jsx(LogicCanvas, { engine: engine, width: 400, height: 300, showToolbar: false, showHints: false, onInputToggled: onInputToggled, isReplayMode: true }));
        fireEvent.click(getByTestId('switch-toggle-sw1'));
        expect(onInputToggled).not.toHaveBeenCalled();
    });
});
