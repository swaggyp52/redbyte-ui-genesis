/**
 * TEMPORARY DEBUG TEST - delete after diagnosis
 */
import { describe, it } from 'vitest';
import { exportBasys3Bundle } from '../../fpga/boards/basys3/basys3Bundle';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';

describe('DEBUG bundle valid', () => {
  it('prints bundle details', () => {
    const circuit = {
      nodes: [
        { id: 'node-v2-1', type: 'INPUT',  label: 'SW[0]', position: { x: 0, y: 0 } },
        { id: 'node-v2-2', type: 'INPUT',  label: 'SW[1]', position: { x: 0, y: 80 } },
        { id: 'node-v2-3', type: 'AND',    label: 'AND',   position: { x: 160, y: 40 } },
        { id: 'node-v2-4', type: 'OUTPUT', label: 'LED[0]', position: { x: 320, y: 40 } },
      ] as any[],
      connections: [
        { id: 'c1', from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a' } },
        { id: 'c2', from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b' } },
        { id: 'c3', from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'in' } },
      ],
    } as Circuit;

    const ioMapping: IoMapping = {
      inputs: [
        { id: 'sw0', nodeId: 'node-v2-1', port: 'out', label: 'SW[0]', pin: 'V17' },
        { id: 'sw1', nodeId: 'node-v2-2', port: 'out', label: 'SW[1]', pin: 'V16' },
      ],
      outputs: [
        { id: 'led0', nodeId: 'node-v2-4', port: 'in', label: 'LED[0]', pin: 'U16' },
      ],
    };

    const bundle = exportBasys3Bundle(circuit, ioMapping, { entityName: 'my_and_gate' });
    console.log('=== DEBUG ===');
    console.log('valid:', bundle.valid);
    console.log('warnings:', JSON.stringify(bundle.warnings, null, 2));
    console.log('\n--- topV ---\n', bundle.topV.substring(0, 700));
  });
});
