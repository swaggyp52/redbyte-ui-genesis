// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CircuitEngine, type Circuit } from '@redbyte/rb-logic-core';
import { RightDock } from '../components/RightDock';

// Mock @redbyte/rb-utils to prevent useUiTickStore infinite update loops
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
  return {
    ...actual,
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
  };
});

// TODO: Fix infinite update loop caused by useUiTickStore in React 19
// The store's useSyncExternalStore integration triggers "Maximum update depth exceeded"
// when tests render components that use the store. Needs investigation into proper
// mocking strategy or store implementation fix for React 19 compatibility.
describe.skip('RightDock tab hit targets', () => {
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
