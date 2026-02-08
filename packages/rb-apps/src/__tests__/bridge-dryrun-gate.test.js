import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HardwareClient } from '../services/hardwareClient';
describe('Bridge dry-run gate (RB_BRIDGE_DRYRUN=1)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));
        process.env.RB_BRIDGE_DRYRUN = '1';
    });
    afterEach(() => {
        delete process.env.RB_BRIDGE_DRYRUN;
        vi.useRealTimers();
    });
    it('connects, lists devices, selects a device, and streams bounded deterministic IO samples', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        const state = client.getState();
        expect(state.status).toBe('connected');
        const deviceIds = client
            .getDevices()
            .map((d) => d.deviceId)
            .sort();
        expect(deviceIds).toEqual(['basys3', 'uno']);
        const selected = await client.selectDevice('basys3');
        expect(selected).toBe(true);
        expect(client.getActiveDevice()?.deviceId).toBe('basys3');
        expect(client.getCapabilities()?.boardId).toBe('basys3');
        const samples = [];
        const unsubscribe = client.subscribeIO((s) => samples.push(s));
        vi.advanceTimersByTime(1000);
        expect(samples.length).toBeGreaterThanOrEqual(3);
        for (let i = 0; i < samples.length; i += 1) {
            const tick = samples[i].tick;
            expect(typeof tick).toBe('number');
            if (i > 0) {
                expect(tick).toBeGreaterThan(samples[i - 1].tick ?? -1);
            }
            const sw = samples[i].inputs?.SW;
            const led = samples[i].outputs?.LED;
            expect(sw === 0 || sw === 1).toBe(true);
            expect(led).toBe(sw);
        }
        client.disconnect();
        const before = samples.length;
        vi.advanceTimersByTime(1000);
        expect(samples.length).toBe(before);
        unsubscribe();
    });
});
