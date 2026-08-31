import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { connectBuses, createBusBoundary } from '@redbyte/rb-logic-core';
import { planBusWordDrive, readAllBusValues, readBusValue } from '../busValues';
import { recomputeSimulationState, resetSimulationState } from '../simEngine';
import type { SimulationIoRow } from '../simTypes';

function passthrough() {
  let circuit: Circuit = { nodes: [], connections: [] };
  const a = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 3, right: 0 });
  circuit = a.circuit;
  const y = createBusBoundary(circuit, { name: 'Y', direction: 'output', left: 3, right: 0 });
  circuit = y.circuit;
  circuit = connectBuses(circuit, a.bus.id, y.bus.id);
  const ioRows: SimulationIoRow[] = circuit.nodes.map((node) => ({
    id: `row-${node.id}`,
    label: node.label ?? node.id,
    direction: node.type === 'INPUT' ? 'in' : 'out',
    nodeId: node.id,
  }));
  return { circuit, a: a.bus, y: y.bus, ioRows };
}

describe('bus value projection over the runtime engine', () => {
  it('the observed vector value equals its scalar bits, end to end', () => {
    const { circuit, a, y, ioRows } = passthrough();
    const reset = resetSimulationState(circuit, ioRows);
    expect(reset.status).toBe('ok');
    if (reset.status !== 'ok') return;

    // Drive A = 0xA through the word planner, bit by bit.
    let sim = reset.value;
    const writes = planBusWordDrive(a, 0xa);
    expect(writes).toHaveLength(4);
    sim = { ...sim, inputs: { ...sim.inputs } };
    for (const write of writes) {
      sim.inputs[write.nodeId] = write.bit;
    }
    const settled = recomputeSimulationState(circuit, ioRows, sim);
    expect(settled.status).toBe('ok');
    if (settled.status !== 'ok') return;

    const aValue = readBusValue(a, settled.value);
    const yValue = readBusValue(y, settled.value);
    expect(aValue.word.value).toBe(0xa);
    expect(aValue.hex).toBe('0xA');
    // The passthrough output word equals the input word — the vector value
    // IS its scalar bits, no separate vector state exists to disagree.
    expect(yValue.word.value).toBe(0xa);
    expect(yValue.word.binary).toBe('1010');
    expect(yValue.bits.map((bit) => bit.value)).toEqual([1, 0, 1, 0]);

    const all = readAllBusValues(circuit, settled.value);
    expect(all.map((row) => `${row.bus.name}=${row.hex}`)).toEqual(['A=0xA', 'Y=0xA']);
  });

  it('an unknown bit makes the word unknown instead of inventing a value', () => {
    const { a } = passthrough();
    const row = readBusValue(a, { inputs: {}, signals: {} });
    expect(row.word.value).toBeNull();
    expect(row.word.hasUnknown).toBe(true);
  });

  it('refuses to drive an output bus', () => {
    const { y } = passthrough();
    expect(() => planBusWordDrive(y, 1)).toThrow(/input bus/);
  });
});
