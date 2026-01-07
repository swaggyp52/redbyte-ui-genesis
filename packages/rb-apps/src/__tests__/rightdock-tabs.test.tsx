// Copyright Ac 2025 Connor Angiel – RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { CircuitEngine, type Circuit } from '@redbyte/rb-logic-core';
import { RightDock } from '../components/RightDock';

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
