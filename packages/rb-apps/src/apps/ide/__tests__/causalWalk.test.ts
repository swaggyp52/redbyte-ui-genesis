import { describe, expect, it } from 'vitest';
import { explainSignal, type ExplainerInput } from '../surfaces/verify/signalExplainer';

const fixture: ExplainerInput = {
  selectedSignal: 'OUT', tick: 2,
  waveform: [
    { tick: 0, signals: { CLK: '0', D: '0', Q: '0', OUT: '0' }, mismatches: [] },
    { tick: 1, signals: { CLK: '1', D: '1', Q: '1', OUT: '1' }, mismatches: [] },
    { tick: 2, signals: { CLK: '0', D: '1', Q: '1', OUT: '1' }, mismatches: [] },
  ],
  recordedStimulus: [{ tick: 0, inputs: { CLK: 0, D: 0 } }, { tick: 1, inputs: { CLK: 1, D: 1 } }],
  signalRoles: { CLK: 'clock', D: 'input', Q: 'output', OUT: 'output' },
  signalMappings: [
    { signalName: 'CLK', nodeId: 'clock', direction: 'in' },
    { signalName: 'D', nodeId: 'data', direction: 'in' },
    { signalName: 'Q', nodeId: 'ff', port: 'Q', direction: 'out' },
    { signalName: 'OUT', nodeId: 'out', direction: 'out' },
  ],
  circuitGraph: {
    nodes: [{ id: 'clock', type: 'INPUT', label: 'CLK' }, { id: 'data', type: 'INPUT', label: 'D' },
      { id: 'ff', type: 'DFlipFlop', label: 'register' }, { id: 'out', type: 'OUTPUT', label: 'OUT' }],
    connections: [
      { from: { nodeId: 'clock', portName: 'out' }, to: { nodeId: 'ff', portName: 'CLK' } },
      { from: { nodeId: 'data', portName: 'out' }, to: { nodeId: 'ff', portName: 'D' } },
      { from: { nodeId: 'ff', portName: 'Q' }, to: { nodeId: 'out', portName: 'in' } },
    ],
  },
};

describe('walkable recorded cause', () => {
  it('walks output to the actual driver, capturing edge, then retained stimulus', () => {
    const output = explainSignal(fixture);
    const driver = output.causalLinks!.find(link => link.kind === 'driver')!;
    expect(driver).toMatchObject({ signal: 'Q', tick: 2, value: '1' });
    const register = explainSignal({ ...fixture, selectedSignal: driver.signal, tick: driver.tick });
    const capture = register.causalLinks!.find(link => link.kind === 'capture')!;
    expect(capture).toMatchObject({ signal: 'CLK', tick: 1, value: '1' });
    const clock = explainSignal({ ...fixture, selectedSignal: capture.signal, tick: capture.tick });
    expect(clock.causalLinks).toContainEqual(expect.objectContaining({ kind: 'stimulus', signal: 'CLK', tick: 1, value: '1' }));
    expect(clock.causalStop).toMatch(/boundary.*No earlier cause/);
  });
  it('stops for an unrecorded sample, ambiguous driver, or absent clock transition', () => {
    expect(explainSignal({ ...fixture, tick: 9 }).causalLinks).toEqual([]);
    const ambiguous = { ...fixture, circuitGraph: { ...fixture.circuitGraph!, connections: [...fixture.circuitGraph!.connections,
      { from: { nodeId: 'data', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } }] } };
    expect(explainSignal(ambiguous).causalStop).toMatch(/no unique driver/i);
    expect(explainSignal(ambiguous).causalLinks).toEqual([]);
    const constantClock = fixture.waveform.map(sample => ({ ...sample, signals: { ...sample.signals, CLK: '1' } }));
    const result = explainSignal({ ...fixture, selectedSignal: 'Q', waveform: constantClock });
    expect(result.causalLinks?.some(link => link.kind === 'capture')).toBe(false);
    expect(result.causalStop).toMatch(/No supported capturing edge/);
  });
  it('does not substitute a same-named signal from another instance', () => {
    const missing = { ...fixture, signalMappings: fixture.signalMappings.map(mapping => mapping.signalName === 'Q'
      ? { ...mapping, signalName: 'other.Q', nodeId: 'another-register' } : mapping) };
    expect(explainSignal(missing).causalLinks).toEqual([]);
  });
});
