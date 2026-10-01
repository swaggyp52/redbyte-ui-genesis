import { describe, it, expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { analyzeCircuitHealth, getTracePath } from '../logic/circuitHealth';
import { buildProbeWireHighlights, getWireId } from '../utils/probeHighlight';
import { buildSuspectSet } from '../utils/mismatchLocalization';
import { GUIDED_EXAMPLES } from '../logic/learnMode';

describe('connection consumer compatibility', () => {
  const nodes: Circuit['nodes'] = [
    { id: 'sw', type: 'Switch' }, { id: 'not', type: 'NOT' }, { id: 'led', type: 'Lamp' },
  ];
  const canonical: Circuit = { nodes, connections: [
    { from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'not', portName: 'in' } },
    { from: { nodeId: 'not', portName: 'out' }, to: { nodeId: 'led', portName: 'in' } },
  ] };
  // The legacy wire shape remains a supported input of rb-logic-core.
  const legacy: Circuit = { nodes, connections: [
    { from: 'sw', to: 'not', fromPin: 'out', toPin: 'in' },
    { from: 'not', to: 'led', fromPort: 'out', toPort: 'in' },
  ] };
  it('reports identical health, learning steps and trace for legacy aliases', () => {
    expect(analyzeCircuitHealth(legacy)).toEqual(analyzeCircuitHealth(canonical));
    expect(getTracePath('led', legacy, 'upstream')).toEqual(new Set(['led','not','sw']));
    for (const step of GUIDED_EXAMPLES['not-gate'].steps) {
      expect(step.validate?.(legacy)).toEqual(step.validate?.(canonical));
    }
  });
  it('preserves actual wire identity, probes and mismatch traversal', () => {
    expect(legacy.connections.map(getWireId)).toEqual(['sw.out-not.in','not.out-led.in']);
    const probes = [{ nodeId:'not', portName:'out', color:'red', enabled:true }];
    expect(buildProbeWireHighlights(legacy, probes)).toEqual(buildProbeWireHighlights(canonical, probes));
    expect(buildSuspectSet(legacy, [{ nodeId:'led', portName:'in' }], 2))
      .toEqual(buildSuspectSet(canonical, [{ nodeId:'led', portName:'in' }], 2));
  });
});
