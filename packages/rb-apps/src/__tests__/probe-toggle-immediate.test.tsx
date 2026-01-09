// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { useProbeStore } from '../stores/probeStore';
import { buildProbeWireHighlights } from '../utils/probeHighlight';

const ProbeHighlightCounter: React.FC<{ circuit: Circuit }> = ({ circuit }) => {
  const probes = useProbeStore((state) => state.probes);
  const highlights = React.useMemo(() => buildProbeWireHighlights(circuit, probes), [circuit, probes]);
  return <div data-testid="highlight-count">{highlights.size}</div>;
};

describe('probe toggle immediate feedback', () => {
  beforeEach(() => {
    useProbeStore.getState().clearProbes();
  });

  it('updates highlight output immediately on toggle', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'Switch', position: { x: 0, y: 0 } },
        { id: 'b', type: 'Lamp', position: { x: 100, y: 0 } },
      ],
      connections: [
        {
          from: { nodeId: 'a', portName: 'out' },
          to: { nodeId: 'b', portName: 'in' },
        },
      ],
    };

    render(<ProbeHighlightCounter circuit={circuit} />);

    let probeId = '';
    act(() => {
      probeId = useProbeStore.getState().addProbe({
        nodeId: 'a',
        portName: 'out',
        label: 'Switch out',
      });
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('1');

    act(() => {
      useProbeStore.getState().toggleProbe(probeId);
    });

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
  });
});
