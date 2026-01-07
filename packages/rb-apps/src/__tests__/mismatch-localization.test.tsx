// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildSuspectSet } from '../utils/mismatchLocalization';

describe('mismatch localization', () => {
  it('returns a suspect fan-in set for a simple circuit', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'sw1', type: 'Switch', position: { x: 0, y: 0 } },
        { id: 'and1', type: 'AND', position: { x: 0, y: 0 } },
        { id: 'lamp1', type: 'Lamp', position: { x: 0, y: 0 } },
      ],
      connections: [
        { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
        { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'lamp1', portName: 'in' } },
      ],
    };

    const suspect = buildSuspectSet(circuit, [{ nodeId: 'lamp1', portName: 'in' }], 4);
    expect(suspect.nodeIds.size).toBeGreaterThan(0);
    expect(suspect.wireIds.size).toBeGreaterThan(0);
    expect(suspect.nodeIds.has('sw1')).toBe(true);
  });
});
