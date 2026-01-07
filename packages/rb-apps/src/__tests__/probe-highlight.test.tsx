// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildProbeWireHighlights } from '../utils/probeHighlight';

describe('probe wire highlights', () => {
  it('maps probed ports to connected wire IDs', () => {
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
    const probes = [
      { nodeId: 'a', portName: 'out', color: '#00ffff', enabled: true },
      { nodeId: 'b', portName: 'in', color: '#fbbf24', enabled: false },
    ];

    const highlights = buildProbeWireHighlights(circuit, probes);
    const wireId = 'a.out-b.in';

    expect(highlights.has(wireId)).toBe(true);
    expect(highlights.get(wireId)).toEqual(['#00ffff']);
  });
});
