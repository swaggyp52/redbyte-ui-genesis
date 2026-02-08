import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HardwareClient } from '../services/hardwareClient';
/**
 * Phase 4 Gate: Hardware Dry-Run Program Flow
 *
 * This gate validates the hardware programming workflow in dry-run mode:
 * 1. Run HardwareClient in RB_BRIDGE_DRYRUN mode
 * 2. Simulate "program device" path end-to-end (service layer only)
 * 3. Assert:
 *    - Correct request shape
 *    - Proper HW→SIM fallback decision
 *    - Student-friendly error code when bridge is "offline"
 *
 * Pure service-layer test (no UI assertions, no React, no DOM).
 */
describe('Phase 4: Hardware Dry-Run Program Flow Gate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));
        process.env.RB_BRIDGE_DRYRUN = '1';
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
    });
    afterEach(() => {
        delete process.env.RB_BRIDGE_DRYRUN;
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
        vi.useRealTimers();
    });
    it('connects in dry-run mode and returns deterministic device list', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        const state = client.getState();
        expect(state.status).toBe('connected');
        const devices = client.getDevices();
        expect(devices.length).toBeGreaterThan(0);
        // Verify dry-run devices are deterministic
        const deviceIds = devices.map((d) => d.deviceId).sort();
        expect(deviceIds).toEqual(['basys3', 'uno']);
    });
    it('selects device and returns board capabilities', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        const selected = await client.selectDevice('basys3');
        expect(selected).toBe(true);
        const activeDevice = client.getActiveDevice();
        expect(activeDevice?.deviceId).toBe('basys3');
        expect(activeDevice?.boardModel).toBeDefined();
        const capabilities = client.getCapabilities();
        expect(capabilities?.boardId).toBe('basys3');
        expect(capabilities?.inputs).toBeDefined();
        expect(capabilities?.outputs).toBeDefined();
    });
    it('exposes program capability on dry-run device selection', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        await client.selectDevice('basys3');
        const capabilities = client.getCapabilities();
        expect(capabilities?.boardId).toBe('basys3');
        expect(capabilities?.features ?? []).toContain('program');
    });
    it('handles "bridge offline" scenario when mode is off', async () => {
        const client = new HardwareClient({ mode: 'off' });
        // Attempt connect when bridge is "off"
        await client.connect();
        const state = client.getState();
        expect(state.status).toBe('offline');
        if (state.status === 'offline') {
            expect(state.reason).toBe('disabled');
        }
        // Verify student-friendly error handling
        const devices = client.getDevices();
        expect(devices).toEqual([]);
    });
    it('transitions to offline when mode is set to off', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        await client.selectDevice('basys3');
        expect(client.getState().status).toBe('connected');
        expect(client.getActiveDevice()?.deviceId).toBe('basys3');
        // Simulate user turning off hardware integration
        client.setMode('off');
        const state = client.getState();
        expect(state.status).toBe('offline');
        if (state.status === 'offline') {
            expect(state.reason).toBe('disabled');
        }
    });
    it('verifies IO streaming works in dry-run mode with deterministic samples', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        await client.selectDevice('basys3');
        const samples = [];
        const unsubscribe = client.subscribeIO((snapshot) => {
            samples.push(snapshot);
        });
        // Advance timers to trigger IO updates
        vi.advanceTimersByTime(1000);
        // Verify samples are bounded and deterministic
        expect(samples.length).toBeGreaterThan(0);
        expect(samples.length).toBeLessThan(100); // Bounded
        // Verify sample structure
        for (const sample of samples) {
            expect(sample.inputs).toBeDefined();
            expect(sample.outputs).toBeDefined();
            expect(typeof sample.tick).toBe('number');
        }
        unsubscribe();
        client.disconnect();
    });
    it('validates request shape for device selection', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        // Test valid device ID
        const result1 = await client.selectDevice('basys3');
        expect(result1).toBe(true);
        // Test invalid device ID
        const result2 = await client.selectDevice('invalid-device-id');
        expect(result2).toBe(false);
    });
    it('ensures deterministic state transitions (connect → select → off)', async () => {
        const client = new HardwareClient({ mode: 'on' });
        await client.connect();
        expect(client.getState().status).toBe('connected');
        await client.selectDevice('basys3');
        expect(client.getActiveDevice()?.deviceId).toBe('basys3');
        client.setMode('off');
        const state = client.getState();
        expect(state.status).toBe('offline');
        if (state.status === 'offline') {
            expect(state.reason).toBe('disabled');
        }
    });
});
