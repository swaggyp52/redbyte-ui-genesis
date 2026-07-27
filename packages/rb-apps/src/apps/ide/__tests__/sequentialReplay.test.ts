import { describe, expect, it } from 'vitest';
import {
  buildSequentialReplayModel,
  findNextReplayIndex,
  findPreviousReplayIndex,
} from '../sequentialReplay';
import type { VerifyScenarioStep } from '../verifyScenarioSteps';

const steps: VerifyScenarioStep[] = [
  { id: 'reset-on', order: 0, kind: 'apply_reset', targetRef: 'RESET', value: 1 },
  { id: 'rise-reset', order: 1, kind: 'pulse_step', targetRef: 'CLK', pulseBehavior: 'rising' },
  { id: 'reset-off', order: 2, kind: 'apply_reset', targetRef: 'RESET', value: 0 },
  { id: 'd-one', order: 3, kind: 'set_input', targetRef: 'D', value: 1 },
  { id: 'low-hold', order: 4, kind: 'pulse_step', targetRef: 'CLK', pulseBehavior: 'low' },
  { id: 'rise-one', order: 5, kind: 'pulse_step', targetRef: 'CLK', pulseBehavior: 'rising' },
];

describe('sequential replay model', () => {
  it('separates authored events from waveform transitions and reports edge state', () => {
    const waveform = [
      { tick: 0, signals: { D: '0', CLK: '0', RESET: '1', Q: '0' }, mismatches: [] },
      { tick: 1, signals: { D: '0', CLK: '0', RESET: '1', Q: '0' }, mismatches: [] },
      { tick: 2, signals: { D: '0', CLK: '1', RESET: '1', Q: '0' }, mismatches: [] },
      { tick: 3, signals: { D: '0', CLK: '1', RESET: '0', Q: '0' }, mismatches: [] },
      { tick: 4, signals: { D: '1', CLK: '1', RESET: '0', Q: '0' }, mismatches: [] },
      { tick: 5, signals: { D: '1', CLK: '0', RESET: '0', Q: '0' }, mismatches: [] },
      { tick: 6, signals: { D: '1', CLK: '0', RESET: '0', Q: '0' }, mismatches: [] },
      { tick: 7, signals: { D: '1', CLK: '1', RESET: '0', Q: '1' }, mismatches: [] },
    ];
    const model = buildSequentialReplayModel({
      waveform,
      steps,
      report: {
        signalRoles: { D: 'input', CLK: 'clock', RESET: 'reset', Q: 'output' },
      },
      clockSignalName: 'CLK',
    });

    expect(model.eventSampleIndexes).toEqual([0, 2, 3, 4, 5, 7]);
    expect(model.transitionSampleIndexes).toEqual([2, 3, 4, 5, 7]);
    expect(model.frameAt(5)).toMatchObject({
      eventNumber: 5,
      data: '1',
      clock: '0',
      reset: '0',
      output: '0',
      edge: 'falling',
      preState: '0',
      postState: '0',
      stateChanged: false,
    });
    expect(model.frameAt(7)).toMatchObject({
      eventNumber: 6,
      edge: 'rising',
      preState: '0',
      postState: '1',
      stateChanged: true,
    });
  });

  it('finds adjacent authored events and physical transitions', () => {
    const indexes = [0, 2, 5, 7];
    expect(findPreviousReplayIndex(indexes, 5)).toBe(2);
    expect(findNextReplayIndex(indexes, 2)).toBe(5);
    expect(findPreviousReplayIndex(indexes, 0)).toBeNull();
    expect(findNextReplayIndex(indexes, 7)).toBeNull();
  });

  it('resolves logical roles through generated boundary ids from run evidence', () => {
    const model = buildSequentialReplayModel({
      waveform: [
        {
          tick: 0,
          signals: {
            d: '1',
            d_2: '0',
            reset: '0',
            'node-output.in': '0',
          },
          mismatches: [],
        },
        {
          tick: 1,
          signals: {
            d: '1',
            d_2: '1',
            reset: '0',
            'node-output.in': '1',
          },
          mismatches: [],
        },
      ],
      report: {
        signalRoles: { D: 'input', CLK: 'clock', RESET: 'reset', Q: 'output' },
      },
      ioRows: [
        { id: 'd', label: 'D', nodeId: 'node-d', direction: 'in' },
        { id: 'd_2', label: 'CLK', nodeId: 'node-clk', direction: 'in' },
        { id: 'reset', label: 'RESET', nodeId: 'node-reset', direction: 'in' },
        { id: 'q', label: 'Q', nodeId: 'node-output', direction: 'out' },
      ],
      clockSignalName: 'CLK',
    });

    expect(model.frameAt(1)).toMatchObject({
      data: '1',
      clock: '1',
      reset: '0',
      output: '1',
      edge: 'rising',
      preState: '0',
      postState: '1',
      stateChanged: true,
    });
  });
});
