// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { CircuitEngine } from '../CircuitEngine';
import type { Circuit } from '../types';

// Ensure built-ins and analog nodes are registered
import '../index';

describe('LM358 comparator behavior', () => {
  it('toggles output as V_plus crosses V_minus', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'cmp', type: 'LM358', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
      ],
      connections: [],
    };

    const engine = new CircuitEngine(circuit);
    const outputs = [
      { V_plus: 1, V_minus: 2 },
      { V_plus: 2.5, V_minus: 2 },
      { V_plus: 2, V_minus: 2 },
    ].map((values) => {
      engine.setNodeState('cmp', values);
      engine.tick();
      return engine.getAllSignals().get('cmp.out') ?? 0;
    });

    expect(outputs).toMatchInlineSnapshot(`
[
  0,
  1,
  0,
]
`);
  });
});
