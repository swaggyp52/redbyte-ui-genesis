// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '../LogicCanvas';

describe('circuit HUD', () => {
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

    expect(screen.getByTestId('circuit-hud')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByTestId('circuit-hud')).toBeNull();
  });
});
