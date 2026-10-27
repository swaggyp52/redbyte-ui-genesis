// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import '../index';
import { elaborateCircuit } from '../ir/elaborator';
import type { Circuit } from '../types';

/**
 * The elaborator finds a part's clock and required inputs under the names the simulator reads
 * them by (inputPinsOf), exactly as written: a clock wired as "clk" is a clock, a gate wired as
 * in1/in2 is connected, and a FullAdder wired as lowercase "a" is not (the simulator ignores it).
 */

const wire = (id: string, from: string, fromPort: string, to: string, toPort: string) =>
  ({ id, from: { nodeId: from, portName: fromPort }, to: { nodeId: to, portName: toPort } });

function diagnostics(circuit: Circuit) {
  return elaborateCircuit(circuit).ir.diagnostics.map((d) => `${d.code} ${d.nodeId ?? ''} ${d.port ?? ''}`.trim());
}

describe('IR004 and IR005 use the simulator\'s pin names', () => {
  it('a DFlipFlop clocked through "clk" has a clock binding and no IR004', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'ck', type: 'Clock', label: 'CLK100MHZ', config: {} },
        { id: 'd', type: 'INPUT', label: 'SW0' },
        { id: 'ff', type: 'DFlipFlop' },
        { id: 'q', type: 'OUTPUT', label: 'LD0' },
      ],
      connections: [wire('c1', 'ck', 'out', 'ff', 'clk'), wire('c2', 'd', 'out', 'ff', 'D'), wire('c3', 'ff', 'Q', 'q', 'in')],
    };
    const { ir } = elaborateCircuit(circuit);
    expect(ir.diagnostics.filter((d) => d.code === 'IR004')).toEqual([]);
    expect(ir.primitives.find((p) => p.sourceNodeId === 'ff')?.clockBinding).toBeDefined();
  });

  it('a gate wired as in1/in2 has both required inputs connected', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'SW0' }, { id: 'b', type: 'INPUT', label: 'SW1' },
        { id: 'g', type: 'AND' }, { id: 'y', type: 'OUTPUT', label: 'LD0' },
      ],
      connections: [wire('c1', 'a', 'out', 'g', 'in1'), wire('c2', 'b', 'out', 'g', 'in2'), wire('c3', 'g', 'out', 'y', 'in')],
    };
    expect(diagnostics(circuit).filter((d) => d.startsWith('IR005'))).toEqual([]);
  });

  it('a FullAdder wired as lowercase a/b/cin reports its required inputs as unconnected', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'SW0' }, { id: 'b', type: 'INPUT', label: 'SW1' }, { id: 'c', type: 'INPUT', label: 'SW2' },
        { id: 'fa', type: 'FullAdder' }, { id: 's', type: 'OUTPUT', label: 'LD0' },
      ],
      connections: [wire('c1', 'a', 'out', 'fa', 'a'), wire('c2', 'b', 'out', 'fa', 'b'), wire('c3', 'c', 'out', 'fa', 'cin'), wire('c4', 'fa', 'Sum', 's', 'in')],
    };
    expect(diagnostics(circuit).filter((d) => d.startsWith('IR005'))).toEqual(['IR005 fa a', 'IR005 fa b', 'IR005 fa cin']);
    const canvas: Circuit = {
      ...circuit,
      connections: [wire('c1', 'a', 'out', 'fa', 'A'), wire('c2', 'b', 'out', 'fa', 'B'), wire('c3', 'c', 'out', 'fa', 'Cin'), wire('c4', 'fa', 'Sum', 's', 'in')],
    };
    expect(diagnostics(canvas).filter((d) => d.startsWith('IR005'))).toEqual([]);
  });
});
