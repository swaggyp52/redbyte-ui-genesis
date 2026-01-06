// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Circuit } from '@redbyte/rb-logic-core';
import { CircuitHealthPanel } from '../components/CircuitHealthPanel';
import { useViewStateStore } from '../stores/viewStateStore';

const TEST_CIRCUIT: Circuit = {
  nodes: [{ id: 'and1', type: 'AND', position: { x: 0, y: 0 }, rotation: 0, config: {} }],
  connections: [],
};

describe('CircuitHealthPanel', () => {
  beforeEach(() => {
    useViewStateStore.getState().clearSelection();
    useViewStateStore.getState().setHighlightedNode(null, 0);
  });

  it('supports ignoring issues for the session', async () => {
    const user = userEvent.setup();
    render(<CircuitHealthPanel circuit={TEST_CIRCUIT} />);

    expect(screen.getAllByText(/unconnected input/i)).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: /ignore/i })[0]);
    expect(screen.queryAllByText(/unconnected input/i)).toHaveLength(1);
  });

  it('focuses issues via the provided callback', async () => {
    const user = userEvent.setup();
    render(
      <CircuitHealthPanel
        circuit={TEST_CIRCUIT}
        onFocusNode={(nodeId) => useViewStateStore.getState().setHighlightedNode(nodeId, 0)}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /focus/i })[0]);
    expect(useViewStateStore.getState().highlightedNodeId).toBe('and1');
  });
});
