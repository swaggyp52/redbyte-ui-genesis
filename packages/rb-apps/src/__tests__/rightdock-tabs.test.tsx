// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CircuitEngine, type Circuit } from '@redbyte/rb-logic-core';
import { RightDock } from '../components/RightDock';

// Stable mock state objects - MUST be defined outside vi.mock for referential stability
const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
const mockSelection = { nodes: new Set<string>(), wires: new Set<string>() };
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
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  return {
    ...actual,
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
    trackRender: vi.fn(),
  };
});

// Mock @redbyte/rb-logic-view to prevent selection object reference changes
vi.mock('@redbyte/rb-logic-view', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-logic-view')>();
  return {
    ...actual,
    useLogicViewStore: (selector?: (state: { selection: typeof mockSelection }) => unknown) =>
      selector ? selector({ selection: mockSelection }) : { selection: mockSelection },
  };
});

// Mock probeStore to avoid store interactions
vi.mock('../stores/probeStore', () => ({
  useProbeStore: (selector?: (state: typeof mockProbeState) => unknown) =>
    selector ? selector(mockProbeState) : mockProbeState,
}));

describe('RightDock tab hit targets', () => {
  it('allows clicking tab buttons reliably', () => {
    const circuit: Circuit = { nodes: [], connections: [] };
    const engine = new CircuitEngine(circuit);
    const onTabChange = vi.fn();

    render(
      <RightDock
        circuit={circuit}
        engine={engine}
        isRunning={false}
        initialState="expanded"
        initialTab="inspector"
        onTabChange={onTabChange}
      />
    );

    fireEvent.click(screen.getByTestId('rightdock-tab-health'));
    expect(onTabChange).toHaveBeenCalledWith('health');
  });
});
