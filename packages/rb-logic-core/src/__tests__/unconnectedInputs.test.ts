// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import '../index';
import { CircuitEngine } from '../CircuitEngine';
import { describeInputPin } from '../builtins';
import type { Circuit } from '../types';

/**
 * RB-DEBT-028 (a): describeInputPin is the one description of what a part reads from an input
 * pin that nothing drives. Each case runs the engine with the pin unconnected and with the same
 * pin tied to a constant, and the two runs must agree with the description: unconnected equals
 * the documented level; for a pin the behaviour uses, the opposite level changes the outputs
 * (so the documented level is the one that matters); for a pin the configuration disables,
 * neither level changes anything.
 */

type Drive = 0 | 1 | 'clock' | 'pattern';
type Mode = 'open' | 0 | 1;

const PATTERN: readonly (0 | 1)[] = [1, 0, 1, 1, 0, 0, 1, 0];
const STEPS = PATTERN.length;

interface Case {
  readonly type: string;
  readonly config?: Record<string, unknown>;
  /** The pin under test, as a connection names it. */
  readonly pin: string;
  /** How the other input pins are driven: a constant, the clock (low then high in every step) or the data pattern. */
  readonly drive: Readonly<Record<string, Drive>>;
}

/** The outputs the part publishes after every step, with `pin` unconnected or tied to a level. */
function run(testCase: Case, mode: Mode): string[] {
  const circuit: Circuit = {
    nodes: [{ id: 'dut', type: testCase.type, config: { ...(testCase.config ?? {}) } }],
    connections: [],
  };
  const wire = (from: string, port: string) => ({ id: `${from}-${port}`, from: { nodeId: from, portName: 'out' }, to: { nodeId: 'dut', portName: port } });
  const levelAt = (drive: Drive, step: number, half: number): 0 | 1 =>
    drive === 'clock' ? (half as 0 | 1) : drive === 'pattern' ? PATTERN[step] : drive;
  // Sources start at their first level: the engine evaluates once on construction, which is the
  // only rising edge a clock pin tied high ever sees.
  for (const [port, drive] of Object.entries(testCase.drive)) {
    circuit.nodes.push({ id: `src_${port}`, type: 'Switch', state: { isOn: levelAt(drive, 0, 0) } });
    circuit.connections.push(wire(`src_${port}`, port));
  }
  if (mode !== 'open') {
    circuit.nodes.push({ id: 'tie', type: mode === 1 ? 'PowerSource' : 'Ground' });
    circuit.connections.push(wire('tie', testCase.pin));
  }
  const engine = new CircuitEngine(circuit);
  const clocked = Object.values(testCase.drive).includes('clock');
  const samples: string[] = [];
  for (let step = 0; step < STEPS; step += 1) {
    for (const half of clocked ? [0, 1] : [1]) {
      for (const [port, drive] of Object.entries(testCase.drive)) {
        engine.setNodeState(`src_${port}`, { isOn: levelAt(drive, step, half) });
      }
      engine.stabilize();
    }
    const outputs = engine.getNodeOutputs('dut');
    samples.push(JSON.stringify(Object.keys(outputs).sort().map((key) => [key, outputs[key]])));
  }
  return samples;
}

function expectDescribedFallback(testCase: Case): void {
  const described = describeInputPin(testCase.type, testCase.pin, testCase.config);
  expect(described, `${testCase.type}.${testCase.pin}`).not.toBeNull();
  const open = run(testCase, 'open');
  expect(open, 'unconnected equals the documented level').toEqual(run(testCase, described!.unconnectedLevel));
  if (described!.used) {
    expect(open, 'the documented level is the one that matters').not.toEqual(run(testCase, described!.unconnectedLevel === 1 ? 0 : 1));
  } else {
    expect(run(testCase, 0), 'a disabled pin changes nothing').toEqual(open);
    expect(run(testCase, 1), 'a disabled pin changes nothing').toEqual(open);
  }
}

const name = (testCase: Case) => `${testCase.type}${testCase.config ? ` ${JSON.stringify(testCase.config)}` : ''} ${testCase.pin}`;

const REGISTER_CONTROL = { CLK: 'clock', D: 'pattern' } as const;

const SEQUENTIAL_CASES: readonly Case[] = [
  // DFlipFlop: D, CLK and RST read 0 when unconnected; EN reads 1, so it captures every edge.
  { type: 'DFlipFlop', pin: 'D', drive: { CLK: 'clock', EN: 1, RST: 0 } },
  { type: 'DFlipFlop', pin: 'CLK', drive: { D: 1, EN: 1, RST: 0 } },
  { type: 'DFlipFlop', pin: 'RST', drive: { ...REGISTER_CONTROL, EN: 1 } },
  { type: 'DFlipFlop', pin: 'EN', drive: { ...REGISTER_CONTROL, RST: 0 } },
  ...(['Register1', 'RegisterBus', 'StateBank'] as const).flatMap((type): Case[] => {
    const width = type === 'Register1' ? {} : { width: 1 };
    return [
      { type, config: { ...width, hasEnable: true, resetKind: 'async_clear' }, pin: 'D', drive: { CLK: 'clock', EN: 1, RST: 0 } },
      { type, config: { ...width, hasEnable: true, resetKind: 'async_clear' }, pin: 'CLK', drive: { D: 1, EN: 1, RST: 0 } },
      // Clock enable on: an unconnected EN reads 0 and the register holds.
      { type, config: { ...width, hasEnable: true }, pin: 'EN', drive: { ...REGISTER_CONTROL } },
      // Clock enable on with an active-low enable: the unconnected 0 enables it.
      { type, config: { ...width, hasEnable: true, enablePolarity: 'active_low' }, pin: 'EN', drive: { ...REGISTER_CONTROL } },
      // Clock enable off (or not configured): EN is not read at all.
      { type, config: { ...width, hasEnable: false }, pin: 'EN', drive: { ...REGISTER_CONTROL } },
      { type, config: { ...width }, pin: 'EN', drive: { ...REGISTER_CONTROL } },
      // A reset mode: an unconnected RST reads 0, inactive when active high...
      { type, config: { ...width, resetKind: 'async_clear' }, pin: 'RST', drive: { ...REGISTER_CONTROL } },
      { type, config: { ...width, resetKind: 'sync_reset' }, pin: 'RST', drive: { ...REGISTER_CONTROL } },
      // ...and holding the register in reset when active low.
      { type, config: { ...width, resetKind: 'async_clear', resetPolarity: 'active_low' }, pin: 'RST', drive: { ...REGISTER_CONTROL } },
      // Reset mode none: RST is not read at all.
      { type, config: { ...width, resetKind: 'none' }, pin: 'RST', drive: { ...REGISTER_CONTROL } },
    ];
  }),
  { type: 'RegisterBus', config: { width: 2 }, pin: 'D[1]', drive: { CLK: 'clock', 'D[0]': 'pattern' } },
  { type: 'TFlipFlop', pin: 'T', drive: { CLK: 'clock', CLR: 0 } },
  { type: 'TFlipFlop', pin: 'CLK', drive: { T: 1, CLR: 0 } },
  { type: 'TFlipFlop', pin: 'CLR', drive: { CLK: 'clock', T: 1 } },
  { type: 'JKFlipFlop', pin: 'J', drive: { CLK: 'clock', K: 0, CLR: 0 } },
  { type: 'JKFlipFlop', pin: 'K', drive: { CLK: 'clock', J: 1, CLR: 0 } },
  { type: 'JKFlipFlop', pin: 'CLK', drive: { J: 1, K: 0, CLR: 0 } },
  { type: 'JKFlipFlop', pin: 'CLR', drive: { CLK: 'clock', J: 1, K: 0 } },
  // Composite parts feed their subcircuit 0 for an input nothing drives.
  { type: 'DLatch', pin: 'D', drive: { EN: 1 } },
  { type: 'DLatch', pin: 'EN', drive: { D: 'pattern' } },
  { type: 'RSLatch', pin: 'R', drive: { S: 'pattern' } },
  { type: 'RSLatch', pin: 'S', drive: { R: 0 } },
];

describe('unconnected input fallbacks of every sequential part, run through the engine', () => {
  it.each(SEQUENTIAL_CASES.map((testCase) => [name(testCase), testCase] as const))('%s', (_label, testCase) => {
    expectDescribedFallback(testCase);
  });
});

const GATES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['AND', ['a', 'b']], ['OR', ['a', 'b']], ['NAND', ['a', 'b']], ['NOR', ['a', 'b']], ['XOR', ['a', 'b']], ['XNOR', ['a', 'b']],
  ['AND', ['in1', 'in2']], ['XOR', ['in1', 'in2']],
  ['AND3', ['a', 'b', 'c']], ['OR3', ['a', 'b', 'c']], ['NAND3', ['a', 'b', 'c']], ['NOR3', ['a', 'b', 'c']], ['XOR3', ['a', 'b', 'c']],
  ['NOT', ['in']], ['Lamp', ['in']], ['Wire', ['in']], ['OUTPUT', ['in']], ['Delay', ['in']],
];

describe('unconnected input fallbacks of every combinational part, for every combination of its other inputs', () => {
  it.each(GATES.flatMap(([type, pins]) => pins.map((pin) => [type, pin, pins] as const)))('%s %s', (type, pin, pins) => {
    const described = describeInputPin(type, pin);
    expect(described).toMatchObject({ role: 'data', used: true, unconnectedLevel: 0 });
    const level = described!.unconnectedLevel;
    const opposite = level === 1 ? 0 : 1;
    if (type === 'OUTPUT') {
      // OUTPUT publishes no output; it stores what it reads, so compare its state.
      const state = (mode: Mode) => {
        const circuit: Circuit = { nodes: [{ id: 'dut', type }], connections: [] };
        if (mode !== 'open') {
          circuit.nodes.push({ id: 'tie', type: mode === 1 ? 'PowerSource' : 'Ground' });
          circuit.connections.push({ id: 'w', from: { nodeId: 'tie', portName: 'out' }, to: { nodeId: 'dut', portName: pin } });
        }
        const engine = new CircuitEngine(circuit);
        engine.stabilize();
        return engine.getNodeState('dut');
      };
      expect(state('open')).toEqual(state(level));
      expect(state('open')).not.toEqual(state(opposite));
      return;
    }
    const others = pins.filter((other) => other !== pin);
    let oppositeMatters = false;
    for (let combination = 0; combination < 1 << others.length; combination += 1) {
      const drive = Object.fromEntries(others.map((other, index) => [other, ((combination >> index) & 1) as 0 | 1]));
      const testCase: Case = { type, pin, drive };
      const open = run(testCase, 'open');
      expect(open, JSON.stringify(drive)).toEqual(run(testCase, level));
      if (JSON.stringify(open) !== JSON.stringify(run(testCase, opposite))) oppositeMatters = true;
    }
    expect(oppositeMatters, 'the opposite level changes the output for some combination').toBe(true);
  });
});

describe('the documented fallbacks, in the words the studio and the classic surfaces state', () => {
  it('names the read level, the role and whether the configuration lets the pin be read', () => {
    expect(describeInputPin('DFlipFlop', 'EN')).toEqual({ role: 'enable', used: true, unconnectedLevel: 1, activeLevel: 1 });
    expect(describeInputPin('DFlipFlop', 'RST')).toEqual({ role: 'reset', used: true, unconnectedLevel: 0, activeLevel: 1 });
    expect(describeInputPin('DFlipFlop', 'D')).toEqual({ role: 'data', used: true, unconnectedLevel: 0, activeLevel: null });
    expect(describeInputPin('DFlipFlop', 'CLK')).toEqual({ role: 'clock', used: true, unconnectedLevel: 0, activeLevel: null });
    expect(describeInputPin('Register1', 'EN', { hasEnable: true })).toEqual({ role: 'enable', used: true, unconnectedLevel: 0, activeLevel: 1 });
    expect(describeInputPin('Register1', 'EN', { hasEnable: false })).toMatchObject({ role: 'enable', used: false });
    expect(describeInputPin('Register1', 'EN', {})).toMatchObject({ used: false });
    expect(describeInputPin('Register1', 'CE', { hasEnable: true, enablePolarity: 'active_low' })).toMatchObject({ used: true, activeLevel: 0 });
    expect(describeInputPin('StateBank', 'RST', { resetKind: 'none' })).toMatchObject({ role: 'reset', used: false });
    expect(describeInputPin('RegisterBus', 'RST', { resetKind: 'sync_set', resetPolarity: 'active_low' })).toEqual({ role: 'reset', used: true, unconnectedLevel: 0, activeLevel: 0 });
    expect(describeInputPin('RegisterBus', 'D[7]', {})).toMatchObject({ role: 'data', unconnectedLevel: 0 });
    expect(describeInputPin('TFlipFlop', 'CLR')).toMatchObject({ role: 'reset', unconnectedLevel: 0, activeLevel: 1 });
    expect(describeInputPin('DLatch', 'EN')).toEqual({ role: 'enable', used: true, unconnectedLevel: 0, activeLevel: 1 });
    expect(describeInputPin('FullAdder', 'Cin')).toEqual({ role: 'data', used: true, unconnectedLevel: 0, activeLevel: null });
  });

  it('claims nothing for a pin the behaviour does not read or a part it does not define', () => {
    expect(describeInputPin('DFlipFlop', 'SET')).toBeNull();
    expect(describeInputPin('RegisterBus', 'D[8]', { width: 8 })).toBeNull();
    expect(describeInputPin('FullAdder', 'cin')).toBeNull();
    expect(describeInputPin('Switch', 'in')).toBeNull();
    expect(describeInputPin('MyModule', 'A')).toBeNull();
  });

  it('claims nothing for the Counter4Bit stub, whose clock reaches no logic', () => {
    // The support registry does not simulate it; its outputs are the same with CLK open, low or high.
    expect(describeInputPin('Counter4Bit', 'CLK')).toBeNull();
    const counter: Case = { type: 'Counter4Bit', pin: 'CLK', drive: {} };
    expect(run(counter, 'open')).toEqual(run(counter, 0));
    expect(run(counter, 'open')).toEqual(run(counter, 1));
  });
});
