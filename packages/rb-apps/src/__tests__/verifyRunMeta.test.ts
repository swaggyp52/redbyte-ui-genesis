import { describe, it, expect } from 'vitest';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';
import type { VerifyRunMeta } from '../apps/ide/projectRuntime';

function applyMetaRules(
  schedule: 'combinational' | 'clocked_macro',
  clockSignalName?: string
): VerifyRunMeta {
  const isClocked = schedule === 'clocked_macro';
  return {
    circuitKind: isClocked ? 'sequential' : 'combinational',
    clockingProtocol: isClocked ? 'clocked_macro' : null,
    samplePoint: isClocked ? 'post-rising-edge' : 'steady-state',
    tick0Meaning: isClocked ? 'initial-state' : null,
    clockSignalName: clockSignalName ?? null,
  };
}

describe('VerifyRunMeta - sampling semantics', () => {
  it('combinational circuit produces steady-state meta', () => {
    const contract = deriveVerifySchedule({ nodes: [], connections: [] }, undefined);
    expect(contract.schedule).toBe('combinational');

    const meta = applyMetaRules(contract.schedule, contract.clockSignalName);
    expect(meta.circuitKind).toBe('combinational');
    expect(meta.clockingProtocol).toBeNull();
    expect(meta.samplePoint).toBe('steady-state');
    expect(meta.tick0Meaning).toBeNull();
    expect(meta.clockSignalName).toBeNull();
  });

  it('clocked circuit (DFlipFlop) produces post-rising-edge meta', () => {
    const circuit = {
      nodes: [{ id: 'dff1', type: 'DFlipFlop', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} }],
      connections: [],
    };
    const contract = deriveVerifySchedule(circuit, undefined);
    expect(contract.schedule).toBe('clocked_macro');

    const meta = applyMetaRules(contract.schedule, contract.clockSignalName);
    expect(meta.circuitKind).toBe('sequential');
    expect(meta.clockingProtocol).toBe('clocked_macro');
    expect(meta.samplePoint).toBe('post-rising-edge');
    expect(meta.tick0Meaning).toBe('initial-state');
  });

  it('JKFlipFlop circuit produces sequential meta', () => {
    const circuit = {
      nodes: [{ id: 'jk1', type: 'JKFlipFlop', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} }],
      connections: [],
    };
    const contract = deriveVerifySchedule(circuit, undefined);
    expect(contract.schedule).toBe('clocked_macro');

    const meta = applyMetaRules(contract.schedule, contract.clockSignalName);
    expect(meta.circuitKind).toBe('sequential');
  });

  it('Counter4Bit circuit produces sequential meta', () => {
    const circuit = {
      nodes: [{ id: 'cnt1', type: 'Counter4Bit', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} }],
      connections: [],
    };
    const contract = deriveVerifySchedule(circuit, undefined);
    expect(contract.schedule).toBe('clocked_macro');

    const meta = applyMetaRules(contract.schedule);
    expect(meta.samplePoint).toBe('post-rising-edge');
  });
});
