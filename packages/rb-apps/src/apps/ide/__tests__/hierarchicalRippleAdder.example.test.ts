import { describe, expect, it } from 'vitest';
import { buildHierarchicalRippleAdder } from '../examples/hierarchicalRippleAdder';
import { elaborateProjectHierarchy } from '../projectHierarchy';
import { getIdeExampleById } from '../examplesCatalog';
import { recomputeSimulationState, resetSimulationState } from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';

const ref = (value: string | { nodeId: string; portName: string }) =>
  typeof value === 'string' ? { nodeId: value, portName: '' } : value;

describe('hierarchical 4-bit ripple adder starter', () => {
  it('is one FullAdder definition instantiated four times, chained through the carry', () => {
    const fixture = buildHierarchicalRippleAdder();
    expect(fixture.hierarchy.modules.map((m) => m.name)).toEqual(['FullAdderCell']);
    const instances = fixture.circuit.nodes.filter((n) => n.config?.moduleDefinitionId);
    expect(instances.map((n) => n.config?.instanceName)).toEqual(['u_fa0', 'u_fa1', 'u_fa2', 'u_fa3']);
    const carryChain = fixture.circuit.connections.filter((c) => ref(c.from).portName === 'COUT');
    expect(carryChain).toHaveLength(4);
    expect(carryChain.slice(0, 3).every((c) => ref(c.to).portName === 'CIN')).toBe(true);
    expect(ref(carryChain[3].to).nodeId).toBe('carry-out');
  });

  it('is deterministic across builds', () => {
    const a = buildHierarchicalRippleAdder();
    const b = buildHierarchicalRippleAdder();
    expect(JSON.stringify(a.circuit)).toBe(JSON.stringify(b.circuit));
    expect(JSON.stringify(a.hierarchy.modules)).toBe(JSON.stringify(b.hierarchy.modules));
  });

  it('adds A[3:0] + B[3:0] through the elaborated hierarchy for every starter vector', () => {
    const fixture = buildHierarchicalRippleAdder();
    const flat = elaborateProjectHierarchy(fixture.circuit, fixture.hierarchy);
    expect(flat.nodes.every((n) => !n.config?.moduleDefinitionId)).toBe(true);
    const ioRows: SimulationIoRow[] = fixture.ioRows.map((row) => ({
      id: row.id,
      nodeId: row.nodeId,
      label: row.label,
      direction: row.direction,
    }));
    const reset = resetSimulationState(flat, ioRows);
    expect(reset.status).toBe('ok');
    if (reset.status !== 'ok') return;
    const readOut = (sim: typeof reset.value, nodeId: string): 0 | 1 => {
      const v = sim.signals[nodeId] ?? sim.signals[`${nodeId}.in`] ?? sim.signals[`${nodeId}.out`] ?? 0;
      return v === 1 ? 1 : 0;
    };
    for (const vector of fixture.vectors) {
      const inputs: Record<string, 0 | 1> = { ...reset.value.inputs };
      for (const [key, value] of Object.entries(vector.inputs)) inputs[key] = value === 1 || value === true ? 1 : 0;
      const sim = { ...reset.value, inputs };
      const settled = recomputeSimulationState(flat, ioRows, sim);
      expect(settled.status).toBe('ok');
      if (settled.status !== 'ok') return;
      for (const [nodeId, expected] of Object.entries(vector.expected)) {
        expect(readOut(settled.value, nodeId), `${nodeId} @ tick ${vector.tick}`).toBe(expected);
      }
    }
  });

  it('is registered as a starter that carries its hierarchy', () => {
    const example = getIdeExampleById('four-bit-adder-hierarchical');
    expect(example?.hierarchy?.modules.map((m) => m.name)).toEqual(['FullAdderCell']);
    expect(example?.ioRows.find((row) => row.id === 'sum2')?.pin).toBe('U19');
  });
});
