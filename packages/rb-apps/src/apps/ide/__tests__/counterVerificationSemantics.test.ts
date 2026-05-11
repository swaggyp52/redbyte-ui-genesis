import { describe, expect, it } from 'vitest';
import { IDE_EXAMPLES } from '../examplesCatalog';
import { runDeterministicVerifyFromModel } from '../sim/simEngine';
import {
  detectVerifyClockPolicy,
  materializeVectorsForClockPolicy,
} from '../verifyClockPolicy';
import { buildDeterministicVerifyContext } from '../../../fpga/boards/basys3/verifySchedule';

function loadCounterExample() {
  const example = IDE_EXAMPLES.find((entry) => entry.id === 'two-bit-counter');
  if (!example) {
    throw new Error('2-Bit Up Counter example missing');
  }
  return example;
}

describe('2-Bit Up Counter verification semantics', () => {
  it('passes the starter Compare sequence on post-rising-edge clocked-macro samples', () => {
    const counter = loadCounterExample();
    const context = buildDeterministicVerifyContext(counter.circuit, {
      inputs: counter.ioRows
        .filter((row) => row.direction === 'in')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
      outputs: counter.ioRows
        .filter((row) => row.direction === 'out')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
    });
    const policy = detectVerifyClockPolicy({
      circuit: counter.circuit,
      ioRows: counter.ioRows,
      scheduleContract: context.schedule,
    });
    const vectors = materializeVectorsForClockPolicy({
      vectors: counter.vectors,
      ioRows: counter.ioRows,
      policy,
    });

    const result = runDeterministicVerifyFromModel(
      counter.circuit,
      context.simModel,
      counter.ioRows,
      vectors,
      context.schedule,
      policy
    );

    expect(context.schedule.schedule).toBe('clocked_macro');
    expect(context.schedule.samplePoint).toBe('post-rising-edge');
    expect(policy?.sourceType).toBe('board-clock');
    expect(policy?.resetSignalName).toBe('BTNC');
    expect(policy?.resetBehavior).toBe('auto-sequence');

    expect(result.evidence.preflight).toEqual([]);
    expect(result.rows.filter((row) => row.expected !== row.actual)).toEqual([]);
    expect(result.rows).toHaveLength(14);

    const observedSequence = counter.vectors.map((vector) => {
      const rowsAtTick = result.rows.filter((row) => row.tick === vector.tick);
      return {
        tick: vector.tick,
        ld0: rowsAtTick.find((row) => row.signal === 'ld0')?.actual,
        ld1: rowsAtTick.find((row) => row.signal === 'ld1')?.actual,
      };
    });

    expect(observedSequence).toEqual([
      { tick: 0, ld0: '0', ld1: '0' },
      { tick: 1, ld0: '0', ld1: '0' },
      { tick: 2, ld0: '1', ld1: '0' },
      { tick: 3, ld0: '0', ld1: '1' },
      { tick: 4, ld0: '1', ld1: '1' },
      { tick: 5, ld0: '0', ld1: '0' },
      { tick: 6, ld0: '0', ld1: '0' },
    ]);
  });
});
