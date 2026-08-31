/**
 * Bus value projection over the runtime simulation state.
 *
 * The engine stays bit-level; this module collapses a declared bus's member
 * bits into one observed word (and expands a driven word back into member
 * bits) so Bench, Analyzer, and the virtual board all read the same vector
 * value the scalar substrate actually carries. X/Z is preserved, never
 * squashed to 0 — an unknown bit makes the word unknown.
 */

import type { BusDeclaration, Circuit, LogicValue } from '@redbyte/rb-logic-core';
import {
  busIndices,
  busWordToBits,
  formatBusWordHex,
  readBusWord,
  type BusWord,
} from '@redbyte/rb-logic-core';
import type { RuntimeLogicValue, RuntimeSimState } from './simTypes';

/** Read one member bit, preserving X/Z. Mirrors the ioBus read order. */
export function readBusMemberBit(
  sim: Pick<RuntimeSimState, 'inputs' | 'signals'>,
  nodeId: string
): RuntimeLogicValue | undefined {
  const input = sim.inputs[nodeId];
  if (input === 0 || input === 1) return input;
  return sim.signals[nodeId] ?? sim.signals[`${nodeId}.out`] ?? sim.signals[`${nodeId}.in`];
}

export interface BusBitValue {
  index: number;
  nodeId: string;
  value: RuntimeLogicValue | undefined;
}

export interface BusValueRow {
  bus: BusDeclaration;
  word: BusWord;
  hex: string;
  /** Declared order (left to right). */
  bits: BusBitValue[];
}

/** Collapse one declared bus into its observed word. */
export function readBusValue(
  bus: BusDeclaration,
  sim: Pick<RuntimeSimState, 'inputs' | 'signals'>
): BusValueRow {
  const bitsByIndex = new Map<number, LogicValue | undefined>();
  const memberByIndex = new Map(bus.bits.map((bit) => [bit.index, bit.nodeId]));
  const bits: BusBitValue[] = [];
  for (const index of busIndices(bus)) {
    const nodeId = memberByIndex.get(index);
    const value = nodeId ? readBusMemberBit(sim, nodeId) : undefined;
    bitsByIndex.set(index, value);
    bits.push({ index, nodeId: nodeId ?? '', value });
  }
  const word = readBusWord(bus, bitsByIndex);
  return { bus, word, hex: formatBusWordHex(word), bits };
}

/** Collapse every declared bus in the circuit, in declaration order. */
export function readAllBusValues(
  circuit: Circuit,
  sim: Pick<RuntimeSimState, 'inputs' | 'signals'>
): BusValueRow[] {
  return (circuit.buses ?? []).map((bus) => readBusValue(bus, sim));
}

/**
 * Expand a word into per-member input writes for an input bus. Returns the
 * (nodeId, bit) pairs to drive; the caller owns applying them through its
 * input-setting authority so history/trace semantics stay in one place.
 */
export function planBusWordDrive(
  bus: BusDeclaration,
  value: number
): Array<{ nodeId: string; bit: 0 | 1; index: number }> {
  if (bus.direction !== 'input') {
    throw new Error(`Bus ${bus.name} is not an input bus; only input buses can be driven`);
  }
  const bits = busWordToBits(bus, value);
  const memberByIndex = new Map(bus.bits.map((bit) => [bit.index, bit.nodeId]));
  const writes: Array<{ nodeId: string; bit: 0 | 1; index: number }> = [];
  for (const [index, bit] of bits) {
    const nodeId = memberByIndex.get(index);
    if (!nodeId) continue;
    writes.push({ nodeId, bit, index });
  }
  return writes;
}
