import { describe, expect, it } from 'vitest';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { journeyBoardBoundary, journeyChecks, journeyTransition } from '../signalJourney';

/**
 * The journey's evidence line and board lens read only the recording and the project's live
 * mapping: a value's last change comes from retained samples, checks from the recording's own
 * report rows, and the board resource from the Basys3 catalogue, never from a label.
 */
const run = {
  waveform: [
    { tick: 0, signals: { carry: 0 }, mismatches: [] },
    { tick: 1, signals: { carry: 0 }, mismatches: [] },
    { tick: 2, signals: { carry: 1 }, mismatches: [] },
    { tick: 3, signals: { carry: 1 }, mismatches: [] },
  ],
  report: {
    rows: [
      { tick: 0, signal: 'carry', expected: '0', actual: '0' },
      { tick: 2, signal: 'carry', expected: '0', actual: '1' },
      { tick: 3, signal: 'carry_row', expected: '1', actual: '1' },
      { tick: 3, signal: 'sum0', expected: '1', actual: '1' },
    ],
  },
  executionInput: {
    ioRows: [
      { id: 'carry_row', label: 'CARRY (LD4)', direction: 'out', nodeId: 'carry-out', port: 'in', pin: 'W18' },
      { id: 'a0', label: 'A0 (SW0)', direction: 'in', nodeId: 'a0', port: 'out', pin: 'V17' },
      { id: 'spare', label: 'SPARE', direction: 'out', nodeId: 'spare', port: 'in', pin: '' },
    ],
  },
} as unknown as RuntimeVerifyRun;

describe('Signal Journey evidence', () => {
  it('reports the last recorded change that produced the value at a tick', () => {
    expect(journeyTransition(run, 'carry', 3)).toEqual({ value: '1', since: 2, previous: '0' });
    expect(journeyTransition(run, 'carry', 2)).toEqual({ value: '1', since: 2, previous: '0' });
    expect(journeyTransition(run, 'carry', 1)).toEqual({ value: '0', since: 0, previous: null });
  });

  it('claims nothing where the recording has no sample', () => {
    expect(journeyTransition(run, 'carry', 7)).toEqual({ value: null, since: null, previous: null });
    expect(journeyTransition(run, null, 2)).toEqual({ value: null, since: null, previous: null });
  });

  it('finds the checks on a signal by its lane or its boundary row, and only those', () => {
    expect(journeyChecks(run, 'carry-out', 'carry').map((row) => `${row.signal}@${row.tick}`)).toEqual(['carry@0', 'carry@2', 'carry_row@3']);
    expect(journeyChecks(run, 'elsewhere', null)).toEqual([]);
  });

  it('sets each recorded board resource against the live mapping', () => {
    const rows = journeyBoardBoundary(run, {
      inputs: [{ id: 'a0', nodeId: 'a0', port: 'out', pin: 'V16' }],
      outputs: [{ id: 'carry_row', nodeId: 'carry-out', port: 'in', pin: 'W18' }],
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get('carry_row')).toMatchObject({ recorded: { pin: 'W18', resource: 'LD4' }, current: { pin: 'W18', resource: 'LD4' }, changed: false });
    expect(byId.get('a0')).toMatchObject({ recorded: { pin: 'V17', resource: 'SW0' }, current: { pin: 'V16', resource: 'SW1' }, changed: true });
    expect(byId.get('spare')).toMatchObject({ recorded: null, current: null, removed: true, changed: true });
  });
});
