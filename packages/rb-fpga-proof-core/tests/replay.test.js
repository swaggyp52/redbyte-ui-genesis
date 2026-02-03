import { describe, it, expect } from 'vitest';
import { replayHardwareTrace } from '../src/replay';
describe('replayHardwareTrace', () => {
    it('preserves order for already sorted input', () => {
        const events = [
            { hw_tick: 0, mono_seq: 1, digital: 0, analog: [], ts_wall: 100 },
            { hw_tick: 1, mono_seq: 2, digital: 1, analog: [1], ts_wall: 101 },
        ];
        const result = Array.from(replayHardwareTrace(events));
        expect(result).toEqual(events);
    });
    it('sorts by hw_tick then mono_seq deterministically', () => {
        const events = [
            { hw_tick: 2, mono_seq: 2, digital: 0, analog: [], ts_wall: 300 },
            { hw_tick: 1, mono_seq: 5, digital: 0, analog: [], ts_wall: 200 },
            { hw_tick: 1, mono_seq: 1, digital: 0, analog: [], ts_wall: 100 },
        ];
        const result = Array.from(replayHardwareTrace(events));
        expect(result.map((e) => [e.hw_tick, e.mono_seq])).toEqual([
            [1, 1],
            [1, 5],
            [2, 2],
        ]);
    });
    it('does not use ts_wall for ordering', () => {
        const events = [
            { hw_tick: 1, mono_seq: 0, digital: 0, analog: [], ts_wall: 9999 },
            { hw_tick: 0, mono_seq: 1, digital: 0, analog: [], ts_wall: 0 },
        ];
        const result = Array.from(replayHardwareTrace(events));
        expect(result[0].hw_tick).toBe(0);
        expect(result[1].hw_tick).toBe(1);
    });
});
