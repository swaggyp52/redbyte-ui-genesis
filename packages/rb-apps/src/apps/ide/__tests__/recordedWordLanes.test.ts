import { describe, expect, it } from 'vitest';
import { deriveRecordedWordGroups, deriveRecordedWordLanes, recordedWordAt, type RecordedWordSource } from '../surfaces/verify/recordedWordLanes';

const field = (label: string) => ({ id: label.toLowerCase(), label });

describe('recorded word lanes', () => {
  it('reads LD1 and LD0 as one two-bit word, most-significant bit first', () => {
    const groups = deriveRecordedWordGroups([field('LD0'), field('LD1')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('LD[1:0]');
    expect(groups[0].members.map((member) => member.label)).toEqual(['LD1', 'LD0']);

    const samples: Record<string, string> = { ld0: '0', ld1: '1' };
    expect(recordedWordAt(groups[0], (id) => samples[id])).toEqual({ bits: '10', value: 2 });
  });

  it('has no value at a moment where any member has no recorded 0 or 1', () => {
    const [group] = deriveRecordedWordGroups([field('LD0'), field('LD1')]);
    expect(recordedWordAt(group, (id) => (id === 'ld0' ? '1' : undefined))).toBeNull();
    expect(recordedWordAt(group, (id) => (id === 'ld0' ? '1' : 'X'))).toBeNull();
    // A missing sample is never read as zero.
    expect(recordedWordAt(group, () => null)).toBeNull();
  });

  it('does not invent a word from one bit, a gap, or a missing bit 0', () => {
    expect(deriveRecordedWordGroups([field('LD0')])).toEqual([]);
    expect(deriveRecordedWordGroups([field('LD0'), field('LD2')])).toEqual([]);
    expect(deriveRecordedWordGroups([field('LD1'), field('LD2')])).toEqual([]);
    expect(deriveRecordedWordGroups([field('SUM'), field('CARRY')])).toEqual([]);
  });

  it('recognises bracket and underscore bit names and keeps separate words apart', () => {
    const groups = deriveRecordedWordGroups([
      field('Q[0]'), field('Q[1]'), field('Q[2]'),
      field('COUNT_0'), field('COUNT_1'),
      field('DONE'),
    ]);
    expect(groups.map((group) => group.label)).toEqual(['COUNT[1:0]', 'Q[2:0]']);
    const q = groups[1];
    const samples: Record<string, string> = { 'q[0]': '1', 'q[1]': '0', 'q[2]': '1' };
    expect(recordedWordAt(q, (id) => samples[id])).toEqual({ bits: '101', value: 5 });
  });

  it('refuses a base where two fields claim the same bit', () => {
    expect(deriveRecordedWordGroups([field('LD0'), field('LD_0'), field('LD1')])).toEqual([]);
  });
});

describe('recorded word lanes belong to the recording', () => {
  // The counter as it was recorded: outputs named LD0 and LD1, values 0,1,2,3.
  const recording: RecordedWordSource = {
    report: { signalRoles: { CLK100MHZ: 'clock', EN: 'input', RST: 'reset', LD0: 'output', LD1: 'output' } },
    waveform: [
      { tick: 0, signals: { LD0: '0', LD1: '0', EN: '0' } },
      { tick: 1, signals: { LD0: '1', LD1: '0', EN: '1' } },
      { tick: 2, signals: { LD0: '0', LD1: '1', EN: '1' } },
      { tick: 3, signals: { LD0: '1', LD1: '1', EN: '1' } },
    ],
  };

  it('reads the word from the recording alone, so a later rename in the design cannot remove it', () => {
    // deriveRecordedWordLanes takes no live fields at all: there is nothing a rename could change.
    const [lane] = deriveRecordedWordLanes(recording);
    expect(lane.label).toBe('LD[1:0]');
    expect(lane.members.map((member) => member.label)).toEqual(['LD1', 'LD0']);
    expect([0, 1, 2, 3].map((tick) => lane.valueByTick.get(tick)?.value)).toEqual([0, 1, 2, 3]);
  });

  it('keeps bit order by index however the recording happened to list its outputs', () => {
    const reordered = { ...recording, report: { signalRoles: { LD1: 'output', LD0: 'output' } } };
    const [lane] = deriveRecordedWordLanes(reordered);
    expect(lane.members.map((member) => member.label)).toEqual(['LD1', 'LD0']);
    expect(lane.valueByTick.get(2)).toEqual({ bits: '10', value: 2 });
  });

  it('leaves a tick without a value when a member is missing or not binary there', () => {
    const gappy: RecordedWordSource = {
      ...recording,
      waveform: [
        { tick: 0, signals: { LD0: '1', LD1: '0' } },
        { tick: 1, signals: { LD0: '1' } },
        { tick: 2, signals: { LD0: '1', LD1: 'X' } },
        { tick: 3, signals: { LD0: '0', LD1: '1' } },
      ],
    };
    const [lane] = deriveRecordedWordLanes(gappy);
    expect(lane.valueByTick.has(1)).toBe(false);
    expect(lane.valueByTick.has(2)).toBe(false);
    expect(Array.from(lane.valueByTick.keys())).toEqual([0, 3]);
  });

  it('each recording is read with its own names: an older run keeps LD, a newer one is RESULT and LD0', () => {
    const newer = {
      report: { signalRoles: { LD0: 'output', RESULT: 'output' } },
      waveform: [{ tick: 0, signals: { LD0: '1', RESULT: '1' } }],
    };
    expect(deriveRecordedWordLanes(recording).map((lane) => lane.label)).toEqual(['LD[1:0]']);
    // RESULT and LD0 are two unrelated names; nothing is grouped and no counter is implied.
    expect(deriveRecordedWordLanes(newer)).toEqual([]);
  });

  it('offers nothing for inputs, for an unrun scenario, or for a word no tick can supply', () => {
    expect(deriveRecordedWordLanes(null)).toEqual([]);
    expect(deriveRecordedWordLanes({ ...recording, waveform: [] })).toEqual([]);
    expect(deriveRecordedWordLanes({ report: { signalRoles: { SW0: 'input', SW1: 'input' } }, waveform: [{ tick: 0, signals: { SW0: '1', SW1: '0' } }] })).toEqual([]);
    expect(deriveRecordedWordLanes({ report: { signalRoles: { LD0: 'output', LD1: 'output' } }, waveform: [{ tick: 0, signals: { LD0: '1' } }] })).toEqual([]);
  });
});

describe('recorded word lanes read a real recording shape', () => {
  it('resolves role names (LD1) to the engine-spelled sample keys (ld1) and ignores node-port keys', () => {
    // The shape a browser run actually stores: roles by label, samples lower-cased, plus node ports.
    const [lane] = deriveRecordedWordLanes({
      report: { signalRoles: { CLK100MHZ: 'clock', EN: 'input', LD0: 'output', LD1: 'output', RST: 'reset' } },
      waveform: [
        { tick: 0, signals: { ld0: '0', ld1: '0', 'q1_out.in': '1', 'q0_out.in': '1' } },
        { tick: 2, signals: { ld0: '1', ld1: '0', 'q1_out.in': '0', 'q0_out.in': '0' } },
        { tick: 3, signals: { ld0: '0', ld1: '1', 'q1_out.in': '0', 'q0_out.in': '0' } },
      ],
    });
    expect(lane.label).toBe('LD[1:0]');
    expect([0, 2, 3].map((tick) => lane.valueByTick.get(tick)?.value)).toEqual([0, 1, 2]);
  });
});

describe('recorded word lanes read the output pins the recording executed with', () => {
  it('uses the recorded row\'s node port, so a tick whose named boundary sample is absent still has its value', () => {
    const [lane] = deriveRecordedWordLanes({
      report: { signalRoles: { LD0: 'output', LD1: 'output' } },
      executionInput: { ioRows: [
        { label: 'LD0', nodeId: 'q0_out', port: 'in', direction: 'out' },
        { label: 'LD1', nodeId: 'q1_out', port: 'in', direction: 'out' },
      ] },
      waveform: [
        { tick: 0, signals: { ld0: '1', ld1: '0', 'q0_out.in': '1', 'q1_out.in': '0' } },
        // The last tick stores the pins but not the named boundary signals.
        { tick: 1, signals: { 'q0_out.in': '1', 'q1_out.in': '1' } },
      ],
    });
    expect(lane.valueByTick.get(0)?.value).toBe(1);
    expect(lane.valueByTick.get(1)?.value).toBe(3);
  });
});
