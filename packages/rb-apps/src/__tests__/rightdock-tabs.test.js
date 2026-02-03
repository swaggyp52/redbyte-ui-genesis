import { jsx as _jsx } from "react/jsx-runtime";
// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { RightDock } from '../components/RightDock';
// Stable mock state objects - MUST be defined outside vi.mock for referential stability
const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
const mockSelection = { nodes: new Set(), wires: new Set() };
const mockProbeState = {
    probes: [],
    activeProbeId: null,
    addProbe: vi.fn(),
    removeProbe: vi.fn(),
    renameProbe: vi.fn(),
    toggleProbe: vi.fn(),
    setActiveProbe: vi.fn(),
    reorderProbes: vi.fn(),
};
// Mock @redbyte/rb-utils to prevent useUiTickStore infinite update loops
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useUiTickStore: (selector) => selector ? selector(mockUiTickState) : mockUiTickState,
        trackRender: vi.fn(),
    };
});
// Mock @redbyte/rb-logic-view to prevent selection object reference changes
vi.mock('@redbyte/rb-logic-view', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useLogicViewStore: (selector) => selector ? selector({ selection: mockSelection }) : { selection: mockSelection },
    };
});
// Mock probeStore to avoid store interactions
vi.mock('../stores/probeStore', () => ({
    useProbeStore: (selector) => selector ? selector(mockProbeState) : mockProbeState,
}));
describe('RightDock tab hit targets', () => {
    it('allows clicking tab buttons reliably', () => {
        const circuit = { nodes: [], connections: [] };
        const engine = new CircuitEngine(circuit);
        const onTabChange = vi.fn();
        render(_jsx(RightDock, { circuit: circuit, engine: engine, isRunning: false, initialState: "expanded", initialTab: "inspector", onTabChange: onTabChange }));
        fireEvent.click(screen.getByTestId('rightdock-tab-health'));
        expect(onTabChange).toHaveBeenCalledWith('health');
    });
});
