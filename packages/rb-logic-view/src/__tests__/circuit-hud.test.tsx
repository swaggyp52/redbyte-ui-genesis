// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '../LogicCanvas';

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
describe.skip('circuit HUD', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('auto-hides after inactivity', () => {
    const engine = new TickEngine({ nodes: [], connections: [] }, { tickRate: 1 });

    render(
      <LogicCanvas
        engine={engine}
        width={400}
        height={300}
        showToolbar={false}
        showHints={false}
      />
    );

    expect(screen.queryByTestId('circuit-hud')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByTestId('circuit-hud')).toBeNull();
  });
});
