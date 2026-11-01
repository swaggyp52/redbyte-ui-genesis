import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeClassroomStarter,
  type ClassroomStarter,
  type ClassroomStarterSpec,
} from '../classroomStarterContract';

const spec: ClassroomStarterSpec = {
  labId: 'lab-8',
  requiredLabels: ['in2 (sw8)', 'in1 (sw7)', 'in0 (sw6)', 'enter (sw5)', 'reset (sw4)', 'lock (led1)'],
};
function starter(): ClassroomStarter {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'packages/rb-apps/src/examples/23_lab8-fsm-lock-starter-basys3.json'), 'utf8'));
}

describe('classroom disconnected scaffold integrity', () => {
  it('accepts the supplied Lab8 primitive scaffold without treating unconnected gates as a solution', () => {
    expect(analyzeClassroomStarter(starter(), spec)).toEqual({
      labId: 'lab-8', nodeCount: 18, connectionCount: 0, requiredLabelsSatisfied: true,
    });
  });
  it('rejects authored wires even between otherwise permitted scaffold nodes', () => {
    const fixture = starter();
    fixture.connections = [{ id: 'solution-wire', from: { nodeId: 'sw_in0', portName: 'out' }, to: { nodeId: 'xor_valid', portName: 'a' } }];
    expect(() => analyzeClassroomStarter(fixture, spec)).toThrow('zero connections');
  });
  it.each(['FSM', 'COUNTER', 'DECODER', 'Register1', 'DFF'])('rejects completed %s blocks replacing a scaffold primitive', (type) => {
    const fixture = starter();
    const node = fixture.nodes?.find((entry) => entry.id === 'xor_valid');
    if (!node) throw new Error('fixture missing XOR scaffold');
    node.type = type;
    expect(() => analyzeClassroomStarter(fixture, spec)).toThrow('disconnected primitive scaffold');
  });
  it('rejects additional solution logic and duplicate/missing scaffold identities', () => {
    const extra = starter();
    extra.nodes?.push({ id: 'completed-xor', type: 'XOR' });
    expect(() => analyzeClassroomStarter(extra, spec)).toThrow('disconnected primitive scaffold');
    const duplicated = starter();
    const xor = duplicated.nodes?.find((entry) => entry.id === 'xor_valid');
    if (!xor) throw new Error('fixture missing XOR scaffold');
    xor.id = 'valid_group';
    expect(() => analyzeClassroomStarter(duplicated, spec)).toThrow('disconnected primitive scaffold');
  });
  it('rejects a missing required board label', () => {
    const fixture = starter();
    const enter = fixture.nodes?.find((entry) => entry.id === 'sw_enter');
    if (!enter) throw new Error('fixture missing clock scaffold');
    enter.label = 'wrong control';
    expect(() => analyzeClassroomStarter(fixture, spec)).toThrow('required label marker');
  });
  it.each(['missing', 'wrong-clock', 'wrong-schedule'])('rejects %s checkpoint clock authority', (mutation) => {
    const fixture = starter();
    const checkpoints = fixture.labSpec?.checkpoints;
    if (!checkpoints) throw new Error('fixture missing checkpoints');
    if (mutation === 'missing') {
      fixture.labSpec = { checkpoints: checkpoints.filter((checkpoint) => checkpoint.id !== 'fsm-valid-path') };
    } else {
      const checkpoint = checkpoints.find((entry) => entry.id === 'fsm-valid-path');
      if (!checkpoint?.config) throw new Error('fixture missing clock configuration');
      if (mutation === 'wrong-clock') checkpoint.config.clockSignal = 'sw_in0';
      else checkpoint.config.schedule = 'combinational';
    }
    expect(() => analyzeClassroomStarter(fixture, spec)).toThrow('clock authority');
  });
  it.each(['lab-5', 'lab-6', 'lab-7'] as const)('continues rejecting supplied solution logic for %s', (labId) => {
    expect(() => analyzeClassroomStarter({ nodes: [{ id: 'solution', type: 'XOR' }], connections: [] }, { labId, requiredLabels: [] }))
      .toThrow('solution-like logic');
  });
});
