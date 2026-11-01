// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, expect, it } from 'vitest';
import '../index';
import { NodeRegistry } from '../NodeRegistry';
import { describeInputPin, inputPinsOf, outputPortsOf, type InputPinReading } from '../builtins';
import { getComponentSupport } from '../analysis/componentSupportRegistry';
import type { NodeInputs } from '../types';

/**
 * inputPinsOf is how exporters read a part's connections, so for every behaviour the engine runs
 * it must list exactly the port names that behaviour reads, in the order it tries them, and the
 * first driven name must be the one the behaviour uses. A Proxy over the inputs records every name
 * a behaviour looks up; nothing here restates the names, so a drift in either the behaviour or the
 * spec fails.
 */

type Inputs = Record<string, number>;

function reads(type: string, config: Record<string, unknown>, inputs: Inputs): string[] {
  const behavior = NodeRegistry.get(type);
  if (!behavior) throw new Error(`no behaviour registered for ${type}`);
  const seen: string[] = [];
  const proxy = new Proxy(inputs, {
    get(target, key, receiver) {
      if (typeof key === 'string') seen.push(key);
      return Reflect.get(target, key, receiver);
    },
  });
  behavior.evaluate(proxy as NodeInputs, {}, config);
  return seen;
}

/**
 * Outputs and state after two evaluations, clock pins low and then high so an edge-triggered part
 * captures, from a given starting state (a JK flip-flop's K only acts on a stored 1; an OUTPUT
 * keeps its input in state).
 */
function settle(type: string, config: Record<string, unknown>, start: Record<string, unknown>, low: Inputs, high: Inputs): string {
  const behavior = NodeRegistry.get(type)!;
  const first = behavior.evaluate(low as NodeInputs, { ...start }, config);
  const second = behavior.evaluate(high as NodeInputs, first.state ?? {}, config);
  const sorted = (record: Record<string, unknown>) => Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify([sorted(second.outputs), sorted(second.state ?? {})]);
}

/** Starting states tried in turn: power-on, and a stored 1. */
const STARTS: ReadonlyArray<Record<string, unknown>> = [{}, { q: 1 }];

/** The level that leaves a pin passive: a reset not asserted, an enable asserted. */
function passiveLevel(pin: InputPinReading): number {
  if (pin.role === 'reset') return pin.activeLevel === 0 ? 1 : 0;
  if (pin.role === 'enable') return pin.activeLevel ?? 1;
  return 0;
}

/**
 * Drives every pin but `under` by its canonical name: clocks low then high, resets released,
 * enables asserted, other data pins at `dataLevel`. `under` is driven through `alias` at `level`
 * (a clock under test rises from 0 to `level`).
 */
function scene(pins: readonly InputPinReading[], under: number, alias: string, level: number, dataLevel: number): [Inputs, Inputs] {
  const low: Inputs = {};
  const high: Inputs = {};
  pins.forEach((pin, index) => {
    if (!pin.used) return;
    const name = index === under ? alias : pin.names[0];
    if (pin.role === 'clock') {
      low[name] = 0;
      high[name] = index === under ? level : 1;
      return;
    }
    const value = index === under ? level : pin.role === 'data' ? dataLevel : passiveLevel(pin);
    low[name] = value;
    high[name] = value;
  });
  return [low, high];
}

/** Registered behaviours that the support registry says the engine simulates. */
const SIMULATED = NodeRegistry.getTypes()
  .filter((type) => getComponentSupport(type)?.capabilities.simulation !== false)
  .sort();

/** Each register-family configuration that changes which pins its behaviour reads. */
const CONFIGS: Record<string, ReadonlyArray<Record<string, unknown>>> = {
  Register1: [{}, { resetKind: 'async_clear', hasEnable: true }],
  RegisterBus: [{ width: 2 }, { width: 2, resetKind: 'async_clear', hasEnable: true }],
  StateBank: [{ width: 2 }, { width: 2, resetKind: 'async_clear', hasEnable: true }],
};

const CASES = SIMULATED.flatMap((type) => (CONFIGS[type] ?? [{}]).map((config) => ({ type, config })));

describe('inputPinsOf lists exactly what every simulated behaviour reads', () => {
  it('covers every behaviour the registry says the engine simulates', () => {
    const undescribed = SIMULATED.filter((type) => inputPinsOf(type) === null);
    expect(undescribed).toEqual([]);
    expect(SIMULATED).toEqual(expect.arrayContaining(['AND', 'NOT', 'XOR3', 'FullAdder', 'DLatch', 'DFlipFlop', 'Register1', 'JKFlipFlop']));
  });

  it.each(CASES)('$type $config: with nothing wired, it tries every used name of every pin, in order, and nothing else', ({ type, config }) => {
    const pins = inputPinsOf(type, config)!;
    const seen = reads(type, config, {});
    for (const pin of pins) {
      const expected = pin.used ? [...pin.names, ...(pin.bitNames ?? [])] : [];
      const own = new Set([...pin.names, ...(pin.bitNames ?? [])]);
      expect(seen.filter((name) => own.has(name)), `${type} ${pin.names[0]}`).toEqual(expected);
    }
    const listed = new Set(pins.flatMap((pin) => [...pin.names, ...(pin.bitNames ?? [])]));
    expect(seen.filter((name) => !listed.has(name)), `${type} reads names inputPinsOf does not list`).toEqual([]);
  });

  it.each(CASES)('$type $config: the first driven name of a pin is the one it reads; later names are not looked up', ({ type, config }) => {
    const pins = inputPinsOf(type, config)!;
    pins.forEach((pin) => {
      if (!pin.used) return;
      pin.names.forEach((name, k) => {
        const seen = reads(type, config, { [name]: 1 }).filter((read) => pin.names.includes(read));
        expect(seen, `${type} driven as ${name}`).toEqual(pin.names.slice(0, k + 1));
      });
    });
  });

  it.each(CASES)('$type $config: every name of a pin drives it exactly as its first name does, and the pin matters', ({ type, config }) => {
    const pins = inputPinsOf(type, config)!;
    pins.forEach((pin, index) => {
      if (!pin.used) return;
      // Choose a starting state and a data level of the other pins at which this pin changes the result.
      const sensitive = STARTS.flatMap((start) => [0, 1].map((dataLevel) => ({ start, dataLevel }))).find(({ start, dataLevel }) =>
        settle(type, config, start, ...scene(pins, index, pin.names[0], 0, dataLevel))
          !== settle(type, config, start, ...scene(pins, index, pin.names[0], 1, dataLevel)));
      expect(sensitive, `${type} ${pin.names[0]} never changes the result`).toBeDefined();
      const { start, dataLevel } = sensitive!;
      for (const alias of pin.names.slice(1)) {
        for (const level of [0, 1]) {
          const canonical = settle(type, config, start, ...scene(pins, index, pin.names[0], level, dataLevel));
          expect(settle(type, config, start, ...scene(pins, index, alias, level, dataLevel)), `${type} ${alias}=${level}`).toBe(canonical);
        }
      }
    });
  });

  it.each(CASES)('$type $config: agrees with describeInputPin for every name', ({ type, config }) => {
    for (const pin of inputPinsOf(type, config)!) {
      for (const name of [...pin.names, ...(pin.bitNames ?? [])]) {
        const described = describeInputPin(type, name, config);
        expect(described, `${type}.${name}`).toEqual({
          role: pin.role, used: pin.used, unconnectedLevel: pin.unconnectedLevel, activeLevel: pin.activeLevel,
        });
      }
    }
  });

  it('describes nothing for a part the engine does not simulate or define', () => {
    expect(inputPinsOf('Counter4Bit')).toBeNull();
    expect(inputPinsOf('ModuleInstance')).toBeNull();
    expect(inputPinsOf('NoSuchPart')).toBeNull();
    expect(inputPinsOf('PowerSource')).toEqual([]);
  });

  it('the outputs every simulated behaviour publishes are exactly the names outputPortsOf lists, and each output carries one value', () => {
    for (const { type, config } of CASES) {
      const width = Number(config.width ?? 1);
      const ports = outputPortsOf(type, config);
      if (width !== 1) {
        expect(ports, `${type} words are not described as bits`).toBeNull();
        continue;
      }
      expect(ports, type).not.toBeNull();
      const behavior = NodeRegistry.get(type)!;
      for (const start of STARTS) {
        const { outputs } = behavior.evaluate({} as NodeInputs, { ...start }, config);
        // A register also publishes its numeric width, which is not a signal a wire carries.
        const published = Object.keys(outputs).filter((name) => name !== 'width').sort();
        expect(published, type).toEqual(ports!.flatMap((port) => port.names).sort());
        for (const port of ports!) {
          expect(new Set(port.names.map((name) => outputs[name])).size, `${type} ${port.role}`).toBe(1);
        }
      }
    }
  });

  it('a connection reads a FullAdder as Sum and Cout and a gate as out, nothing else', () => {
    expect(outputPortsOf('FullAdder')).toEqual([{ role: 'sum', names: ['Sum'] }, { role: 'carry', names: ['Cout'] }]);
    expect(outputPortsOf('AND')).toEqual([{ role: 'out', names: ['out'] }]);
    expect(outputPortsOf('DLatch')).toEqual([{ role: 'q', names: ['Q'] }, { role: 'q_inv', names: ['Q_inv'] }]);
    expect(outputPortsOf('Counter4Bit')).toBeNull();
    expect(outputPortsOf('MUX4')).toBeNull();
  });

  it('is case-sensitive, like the engine: an AND reads in1/a and in2/b, a FullAdder A, B and Cin', () => {
    expect(inputPinsOf('AND')!.map((pin) => pin.names)).toEqual([['in1', 'a'], ['in2', 'b']]);
    expect(inputPinsOf('FullAdder')!.map((pin) => pin.names)).toEqual([['A'], ['B'], ['Cin']]);
    expect(describeInputPin('FullAdder', 'a')).toBeNull();
    expect(describeInputPin('AND', 'A')).toBeNull();
    expect(describeInputPin('NOT', 'a')).toBeNull();
  });
});
