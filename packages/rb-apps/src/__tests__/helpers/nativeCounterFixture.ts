import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';

/**
 * A native 4-bit up-counter with exactly the ports of fixtures/import/03-vivado-ish-clocked
 * (clk, rst, count_en -> q0..q3): four Register1 bits with asynchronous clear and clock enable,
 * and the increment logic in gates (D0 = not q0, Dn = qn xor (q0 and ... and qn-1)).
 *
 * The imported VHDL of that fixture is a process the importer keeps as a port scaffold with no
 * logic, so its generated top drives no LED and Export refuses it (it used to ship with every
 * LED tied to '0'). Contracts about packaging, scenarios and bring-up use this counter, which
 * ships real logic; the refusal of the scaffold is pinned on the import fixture itself.
 */
export function nativeCounterCircuit(): Circuit {
  const at = (x: number, y: number) => ({ position: { x, y }, x, y, rotation: 0, state: {} });
  const register = { width: 1, resetKind: 'async_clear', resetPolarity: 'active_high', hasEnable: true, enablePolarity: 'active_high', clockPolarity: 'rising_edge' };
  const nodes: Node[] = [
    { id: 'port_clk', type: 'INPUT', label: 'clk', config: {}, ...at(0, 0) },
    { id: 'port_rst', type: 'INPUT', label: 'rst', config: {}, ...at(0, 80) },
    { id: 'port_count_en', type: 'INPUT', label: 'count_en', config: {}, ...at(0, 160) },
    ...[0, 1, 2, 3].map((bit) => ({ id: `r${bit}`, type: 'Register1', label: `Q${bit}`, config: { ...register }, ...at(400, bit * 100) })),
    { id: 'n0', type: 'NOT', config: {}, ...at(250, 0) },
    { id: 'x1', type: 'XOR', config: {}, ...at(250, 100) },
    { id: 'a1', type: 'AND', config: {}, ...at(150, 200) },
    { id: 'x2', type: 'XOR', config: {}, ...at(250, 200) },
    { id: 'a2', type: 'AND3', config: {}, ...at(150, 300) },
    { id: 'x3', type: 'XOR', config: {}, ...at(250, 300) },
    ...[0, 1, 2, 3].map((bit) => ({ id: `port_out_q${bit}`, type: 'OUTPUT', label: `q${bit}`, config: {}, ...at(600, bit * 100) })),
  ];
  const wires: Array<[string, string, string, string]> = [
    ...[0, 1, 2, 3].flatMap((bit): Array<[string, string, string, string]> => [
      ['port_clk', 'out', `r${bit}`, 'CLK'],
      ['port_rst', 'out', `r${bit}`, 'RST'],
      ['port_count_en', 'out', `r${bit}`, 'EN'],
      [`r${bit}`, 'Q', `port_out_q${bit}`, 'in'],
    ]),
    ['r0', 'Q', 'n0', 'in'], ['n0', 'out', 'r0', 'D'],
    ['r1', 'Q', 'x1', 'a'], ['r0', 'Q', 'x1', 'b'], ['x1', 'out', 'r1', 'D'],
    ['r0', 'Q', 'a1', 'a'], ['r1', 'Q', 'a1', 'b'], ['r2', 'Q', 'x2', 'a'], ['a1', 'out', 'x2', 'b'], ['x2', 'out', 'r2', 'D'],
    ['r0', 'Q', 'a2', 'a'], ['r1', 'Q', 'a2', 'b'], ['r2', 'Q', 'a2', 'c'], ['r3', 'Q', 'x3', 'a'], ['a2', 'out', 'x3', 'b'], ['x3', 'out', 'r3', 'D'],
  ];
  return {
    nodes,
    connections: wires.map(([from, fromPort, to, toPort], index) => ({
      id: `c${index}`, from: { nodeId: from, portName: fromPort }, to: { nodeId: to, portName: toPort },
    })),
  };
}

/** The counter's Basys3 mapping, as the imported fixture's tests mapped it. */
export function nativeCounterIoMapping(): IoMapping {
  return {
    inputs: [
      { id: 'clk', nodeId: 'port_clk', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
      { id: 'rst', nodeId: 'port_rst', port: 'out', label: 'rst', pin: 'SW0' },
      { id: 'count_en', nodeId: 'port_count_en', port: 'out', label: 'count_en', pin: 'SW1' },
    ],
    outputs: [0, 1, 2, 3].map((bit) => ({ id: `q${bit}`, nodeId: `port_out_q${bit}`, port: 'in', label: `q${bit}`, pin: `LD${bit}` })),
  };
}
