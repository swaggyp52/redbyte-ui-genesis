import { describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import { createRecordedPortResolver, recordedFanInRegion, recordedGateReadout, recordedInspectionGate } from '../surfaces/verify/recordedCircuitGeometry';

const node = (id: string, type: string): Node => ({ id, type, position: { x: 0, y: 0 } });
const wire = (from: string, to: string, pin = 'in') => ({ from: { nodeId: from, portName: 'out' }, to: { nodeId: to, portName: pin } });

describe('recorded circuit inspection', () => {
  it('starts at the retained output driver and finds fan-in without making a fault verdict or looping', () => {
    const circuit: Circuit = { nodes: [node('a','INPUT'), node('g','OR'), node('y','OUTPUT'), node('other','NOT')],
      connections: [wire('a','g','a'), wire('g','y'), wire('g','g','b')] };
    expect(recordedInspectionGate(circuit, new Set(['y']))?.id).toBe('g');
    expect([...recordedFanInRegion(circuit, new Set(['y']))].sort()).toEqual(['a','g','y']);
    expect(recordedInspectionGate(circuit, new Set(['missing']))).toBeUndefined();
  });

  it('keeps the observed output separate from a rule derived from complete recorded inputs', () => {
    const gate = node('g','OR');
    const samples = [{ tick: 3, signals: { 'g.a':'0', 'g.b':'1', 'g.out':'0' } }];
    const resolve = createRecordedPortResolver({ nodes: [gate], connections: [] }, samples);
    const readout = recordedGateReadout(gate, samples, 3, resolve);
    expect(readout.inputs.map(pin => pin.value)).toEqual(['0','1']);
    expect(readout.outputs[0].value).toBe('0');
    expect(readout.derived).toBe('OR(0, 1) = 1');
    expect(readout.sequential).toBe(false);
  });

  it('does not fill an absent sample, an unknown input, or a different instance with zeros', () => {
    const gate = node('fa0/g','AND');
    const samples = [{ tick: 4, signals: { 'fa0/g.a':'X', 'fa1/g.b':'1', 'fa0/g.out':'Z' } }];
    const resolve = createRecordedPortResolver({ nodes: [gate], connections: [] }, samples);
    const readout = recordedGateReadout(gate, samples, 4, resolve);
    expect(readout.inputs.map(pin => pin.value)).toEqual(['X',null]);
    expect(readout.outputs[0].value).toBe('Z');
    expect(readout.derived).toBeNull();
    const absent = recordedGateReadout(gate, samples, 5, resolve);
    expect(absent.pins.every(pin => pin.value === null)).toBe(true);
    expect(absent.derived).toBeNull();
  });

  it('shows real prior/current register samples, and an edge only with adjacent clock evidence', () => {
    const register = node('q','Register1');
    const samples = [
      { tick: 0, signals: { 'q.CLK':'0', 'q.Q':'0' } },
      { tick: 1, signals: { 'q.CLK':'1', 'q.Q':'1' } },
      { tick: 5, signals: { 'q.CLK':'0', 'q.Q':'X' } },
    ];
    const resolve = createRecordedPortResolver({ nodes: [register], connections: [] }, samples);
    const current = recordedGateReadout(register, samples, 1, resolve);
    expect(current.sequential).toBe(true);
    expect(current.previousTick).toBe(0);
    expect(current.clockEdge).toBe('rising');
    expect(current.outputs.find(pin => pin.id === 'Q')).toMatchObject({ previous: '0', value: '1' });
    const sparse = recordedGateReadout(register, samples, 5, resolve);
    expect(sparse.previousTick).toBe(1);
    expect(sparse.clockEdge).toBeNull();
    expect(sparse.outputs.find(pin => pin.id === 'Q')).toMatchObject({ previous: '1', value: 'X' });
    expect(recordedGateReadout(register, samples, 0, resolve).previousTick).toBeNull();
  });
});
