/**
 * Bus word lanes over the Simulate waveform timeline.
 *
 * The waveform carries one scalar lane per signal, keyed by the member label
 * `NAME[index]`. This module collapses a declared bus's member lanes into a
 * single WORD lane: for every tick it assembles the member bits (MSB-first,
 * in declared order) into one observed word — binary, hex, and unsigned
 * decimal — so Bench and Analyzer read the same vector value the bit-level
 * substrate actually carries. X/Z is preserved, never squashed to 0: any
 * unknown or unobserved bit makes the whole word unknown.
 *
 * This is a pure projection: it never mutates the timeline and never invents
 * a value. A bus whose members are absent from this run is simply skipped.
 */

import type { BusDeclaration, LogicValue } from '@redbyte/rb-logic-core';
import { busIndices, busRangeLabel, formatBusWordHex, readBusWord } from '@redbyte/rb-logic-core';

/** One scalar lane as the waveform already models it. */
export interface BusWordTimelineRow {
  signal: string;
  values: ReadonlyArray<{ tick: number; value: string }>;
}

export interface BusWordCell {
  tick: number;
  /** MSB-first binary string; X/Z preserved for unknown bits. */
  binary: string;
  /** e.g. `0xA`, or `x'?` when any bit is unknown. */
  hex: string;
  /** Unsigned integer value, or null when any bit is unknown. */
  decimal: number | null;
  known: boolean;
}

export interface BusWordLane {
  name: string;
  direction: 'input' | 'output';
  /** Canonical range label, e.g. `A[3:0]`. */
  rangeLabel: string;
  width: number;
  cells: BusWordCell[];
  /** Member lane labels this word consumed, MSB-first. */
  memberSignals: string[];
}

/** Map a waveform cell string to a logic value; `-`/blank/unknown → undefined. */
function toLogicValue(raw: string): LogicValue | undefined {
  if (raw === '0') return 0;
  if (raw === '1') return 1;
  if (raw === 'X' || raw === 'x') return 'X';
  if (raw === 'Z' || raw === 'z') return 'Z';
  return undefined;
}

/**
 * Collapse every declared bus that is observable in this run into a word lane.
 * A bus is observable when at least one of its member labels appears in the
 * timeline; missing member bits read as unknown so the word honestly reports
 * partial observability rather than fabricating zeros.
 */
export function assembleBusWordLanes(
  buses: readonly BusDeclaration[],
  signals: readonly BusWordTimelineRow[],
  ticks: readonly number[],
): BusWordLane[] {
  const rowByLabel = new Map(signals.map((row) => [row.signal, row]));
  const lanes: BusWordLane[] = [];
  for (const bus of buses) {
    const indices = busIndices(bus);
    const memberRowByIndex = new Map<number, BusWordTimelineRow>();
    for (const index of indices) {
      const row = rowByLabel.get(`${bus.name}[${index}]`);
      if (row) memberRowByIndex.set(index, row);
    }
    if (memberRowByIndex.size === 0) continue;

    const pointCaches = new Map<number, Map<number, string>>();
    for (const [index, row] of memberRowByIndex) {
      const byTick = new Map<number, string>();
      for (const point of row.values) byTick.set(point.tick, point.value);
      pointCaches.set(index, byTick);
    }

    const cells: BusWordCell[] = ticks.map((tick) => {
      const bitsByIndex = new Map<number, LogicValue | undefined>();
      for (const index of indices) {
        const raw = pointCaches.get(index)?.get(tick);
        bitsByIndex.set(index, raw === undefined ? undefined : toLogicValue(raw));
      }
      const word = readBusWord(bus, bitsByIndex);
      return {
        tick,
        binary: word.binary,
        hex: formatBusWordHex(word),
        decimal: word.value,
        known: !word.hasUnknown,
      };
    });

    // MSB-first member labels, mirroring readBusWord's assembly order.
    const descending = bus.left >= bus.right;
    const msbFirst = descending ? indices : [...indices].reverse();
    const memberSignals = msbFirst
      .filter((index) => memberRowByIndex.has(index))
      .map((index) => `${bus.name}[${index}]`);

    lanes.push({
      name: bus.name,
      direction: bus.direction,
      rangeLabel: busRangeLabel(bus),
      width: indices.length,
      cells,
      memberSignals,
    });
  }
  return lanes;
}

/** The word cell at a specific tick, or the last cell, or null. */
export function busWordAtTick(lane: BusWordLane, tick: number | null): BusWordCell | null {
  if (lane.cells.length === 0) return null;
  if (tick === null) return lane.cells[lane.cells.length - 1];
  return lane.cells.find((cell) => cell.tick === tick) ?? null;
}
