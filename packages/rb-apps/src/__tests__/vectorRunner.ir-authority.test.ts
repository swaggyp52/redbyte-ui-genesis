import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { runTestVectors } from '../fpga/boards/basys3/vectorRunner';

describe('vectorRunner IR/model authority', () => {
  it('uses SimulationModel/ioMapping bindings instead of raw node labels for combinational verify', async () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'input_node',
          type: 'INPUT',
          label: 'raw_source_name',
          x: 0,
          y: 0,
          config: {},
          state: {},
        },
        {
          id: 'output_node',
          type: 'OUTPUT',
          label: 'raw_sink_name',
          x: 160,
          y: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'input_node', portName: 'out' },
          to: { nodeId: 'output_node', portName: 'in' },
        },
      ],
    };

    const result = await runTestVectors(
      circuit,
      [
        { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
        { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      ],
      {
        inputs: [{ id: 'sw0', nodeId: 'input_node', port: 'out', label: 'sw0', pin: 'SW0' }],
        outputs: [{ id: 'ld0', nodeId: 'output_node', port: 'in', label: 'ld0', pin: 'LD0' }],
      }
    );

    expect(result.schedule).toBe('combinational');
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.trace).toHaveLength(2);
  });
});
