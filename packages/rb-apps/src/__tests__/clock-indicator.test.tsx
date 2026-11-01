// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '@redbyte/rb-logic-view';

describe('clock indicator in the live canvas HUD', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates tick count and running state at the configured rate', () => {
    const engine = new TickEngine({ nodes: [], connections: [] }, { tickRate: 10 });
    engine.stepOnce();
    engine.stepOnce();
    engine.stepOnce();

    // The canvas receives live host authority through these existing props.
    // Use the actual engine, rather than a mocked count or running state.
    const canvas = () => (
      <LogicCanvas
        engine={engine}
        width={400}
        height={300}
        showToolbar={false}
        showHints={false}
        showHud
        isRunning={engine.isRunning()}
        tickCount={engine.getTickCount()}
        tickRate={engine.getTickRate()}
      />
    );

    const { rerender, unmount } = render(canvas());
    try {
      expect(engine.getTickCount()).toBe(3);
      expect(engine.isRunning()).toBe(false);
      const pausedHud = within(screen.getByTestId('circuit-hud'));
      // Current presentation is a labeled Tick row, replacing historical T+3.
      expect(pausedHud.getByText('Tick').parentElement).toHaveTextContent(/^Tick3$/);
      expect(pausedHud.getByText('Paused')).toBeInTheDocument();

      act(() => {
        engine.start();
        vi.advanceTimersByTime(100);
      });
      expect(engine.getTickCount()).toBe(4);
      expect(engine.isRunning()).toBe(true);
      rerender(canvas());

      const runningHud = within(screen.getByTestId('circuit-hud'));
      expect(runningHud.getByText('Tick').parentElement).toHaveTextContent(/^Tick4$/);
      expect(runningHud.getByText('Running 10Hz')).toBeInTheDocument();
      expect(runningHud.queryByText('Paused')).not.toBeInTheDocument();
    } finally {
      unmount();
      engine.dispose();
    }
  });
});
