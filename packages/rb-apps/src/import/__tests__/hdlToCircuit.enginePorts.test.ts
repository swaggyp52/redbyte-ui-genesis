import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { parseVhdl } from '../vhdlImport';
import { parsedHdlToCircuit } from '../hdlToCircuit';

/**
 * An imported part is wired under the port names the simulator reads and publishes
 * (inputPinsOf/outputPortsOf). The importer used to wire a FullAdder as a/b/cin and read
 * sum/cout, names the engine ignores, so an imported full adder simulated as all zeros.
 */

const vhdl = readFileSync(join(process.cwd(), 'packages/rb-apps/src/fixtures/import/02-full-adder/top.vhd'), 'utf8');

describe('imported parts use the simulator\'s port names', () => {
  it('wires the full adder as A, B, Cin and reads Sum, Cout', () => {
    const { circuit } = parsedHdlToCircuit(parseVhdl(vhdl));
    const wires = circuit.connections.map((c) =>
      `${(c.from as { nodeId: string; portName: string }).nodeId}.${(c.from as { portName: string }).portName}->` +
      `${(c.to as { nodeId: string; portName: string }).nodeId}.${(c.to as { portName: string }).portName}`);
    expect(wires).toEqual([
      'port_SW0.out->u0.A', 'port_SW1.out->u0.B', 'port_SW2.out->u0.Cin',
      'u0.Sum->port_out_LD0.in', 'u0.Cout->port_out_LD1.in',
    ]);
  });

  it('the imported full adder computes the full-adder truth table in the engine', () => {
    const { circuit } = parsedHdlToCircuit(parseVhdl(vhdl));
    const engine = new CircuitEngine(circuit);
    for (let n = 0; n < 8; n += 1) {
      const [a, b, cin] = [n & 1, (n >> 1) & 1, (n >> 2) & 1];
      engine.setNodeState('port_SW0', { isOn: a });
      engine.setNodeState('port_SW1', { isOn: b });
      engine.setNodeState('port_SW2', { isOn: cin });
      engine.stabilize();
      const total = a + b + cin;
      expect([engine.getNodeState('port_out_LD0')?.isOn, engine.getNodeState('port_out_LD1')?.isOn], `${a}+${b}+${cin}`)
        .toEqual([total & 1, total >> 1]);
    }
  });
});
