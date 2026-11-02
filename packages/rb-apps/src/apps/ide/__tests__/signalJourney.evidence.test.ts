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

  it('finds a boundary output\'s checks through the run evidence, as the hierarchical adder names CARRY', () => {
    const adder = {
      waveform: [],
      report: { rows: [
        { tick: 3, signal: 'carry', expected: '1', actual: '0' },
        { tick: 3, signal: 'sum_3', expected: '0', actual: '1' },
      ] },
      executionInput: { ioRows: [{ id: 'carry-out', label: 'CARRY', direction: 'out', nodeId: 'carry-out', port: 'in', pin: 'W18' }] },
      evidence: {
        ioRows: [{ id: 'carry-out', label: 'CARRY', nodeId: 'carry-out', direction: 'out' }],
        normalizationMap: [
          { role: 'expected', rawKey: 'carryout', normalizedKey: 'carryout', matchedSignal: 'carry' },
          { role: 'output', rawKey: 'carry', normalizedKey: 'carry', matchedSignal: 'carry-out.in' },
        ],
      },
    } as unknown as RuntimeVerifyRun;
    expect(journeyChecks(adder, 'carry-out', 'in', 'carry-out.in').map((row) => row.signal)).toEqual(['carry']);
    expect(journeyChecks(adder, 'u-fa3__o1', 'out', 'u-fa3__o1.out')).toEqual([]);
  });

  it('finds the checks on a signal by its lane or its boundary row, and only those', () => {
    expect(journeyChecks(run, 'carry-out', 'in', 'carry').map((row) => `${row.signal}@${row.tick}`)).toEqual(['carry@0', 'carry@2', 'carry_row@3']);
    expect(journeyChecks(run, 'elsewhere', 'out', null)).toEqual([]);
  });

  it('keeps two boundary rows on one part apart (Q and Q_inv), as the independent review found they were not', () => {
    const ff = {
      waveform: [],
      report: { rows: [
        { tick: 1, signal: 'q_led', expected: '1', actual: '1' },
        { tick: 1, signal: 'qn_led', expected: '1', actual: '0' },
      ] },
      executionInput: { ioRows: [
        { id: 'q_led', label: 'Q', direction: 'out', nodeId: 'ff', port: 'Q', pin: 'U16' },
        { id: 'qn_led', label: 'QN', direction: 'out', nodeId: 'ff', port: 'Q_inv', pin: 'E19' },
      ] },
    } as unknown as RuntimeVerifyRun;
    expect(journeyChecks(ff, 'ff', 'Q', 'ff.Q').map((row) => row.signal)).toEqual(['q_led']);
    expect(journeyChecks(ff, 'ff', 'Q_inv', 'ff.Q_inv').map((row) => row.signal)).toEqual(['qn_led']);
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
