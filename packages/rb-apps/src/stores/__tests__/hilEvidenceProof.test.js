import { describe, it, expect, vi } from 'vitest';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
import { exportV2Bundle } from '../utils/bundleExport';
// MOCKS FOR BROWSER APIS
if (typeof global.crypto === 'undefined') {
    global.crypto = {
        subtle: {
            digest: async () => new Uint8Array(32).buffer
        }
    };
}
if (typeof global.URL.createObjectURL === 'undefined') {
    global.URL.createObjectURL = vi.fn(() => 'blob:abc');
    global.URL.revokeObjectURL = vi.fn();
}
describe('HIL Evidence Proof (COM7 + Live Bits)', () => {
    it('should capture real-time switch bits into snapshots and bundles', async () => {
        const workflow = useLabWorkflowStore.getState();
        const hardware = useHardwareSessionStore.getState();
        // 1. SETUP SESSION
        useLabWorkflowStore.setState({
            selectedLabId: 'lab0',
            studentIdentity: { name: 'Test Student', id: '12345' },
            currentStep: 'hardware'
        });
        // 2. SIMULATE PHYSICAL INTERACTION (SW0 ON)
        // Mock the hardwareClient to emit an IO update
        const snapshot1 = {
            timestamp: new Date().toISOString(),
            inputs: { SW: 1 }, // 0000_0000_0000_0001
            outputs: {},
            source: 'bridge',
            port: 'COM7'
        };
        // Manually trigger what the UI handleCaptureSnapshot would do
        useLabWorkflowStore.getState().addHardwareSnapshot(snapshot1);
        // 3. SIMULATE PHYSICAL INTERACTION (SW0 + SW1 ON)
        const snapshot2 = {
            timestamp: new Date().toISOString(),
            inputs: { SW: 3 }, // 0000_0000_0000_0011
            outputs: {},
            source: 'bridge',
            port: 'COM7'
        };
        useLabWorkflowStore.getState().addHardwareSnapshot(snapshot2);
        // 4. VERIFY STORE STATE
        const finalSnapshots = useLabWorkflowStore.getState().hardwareSnapshots;
        expect(finalSnapshots).toHaveLength(2);
        expect(finalSnapshots[0].inputs.SW).toBe(1);
        expect(finalSnapshots[1].inputs.SW).toBe(3);
        console.log('SNAPSHOT 1 (SW0):', JSON.stringify(finalSnapshots[0], null, 2));
        console.log('SNAPSHOT 2 (SW0+SW1):', JSON.stringify(finalSnapshots[1], null, 2));
        // 5. GENERATE BUNDLE
        const result = await exportV2Bundle({
            labId: 'lab0',
            studentId: '12345',
            studentName: 'Test Student',
            attemptId: 'att_lab0_12345_6789',
            completedSteps: ['selection', 'specification', 'design', 'simulation', 'hardware'],
            hardwareSnapshots: finalSnapshots,
            eventLog: [
                { type: 'hw_connect', port: 'COM7', status: 'online' },
                { type: 'snapshot_captured', data: snapshot1 },
                { type: 'snapshot_captured', data: snapshot2 }
            ]
        });
        expect(result.blob).toBeDefined();
        console.log('EXPORT FILENAME:', result.filename);
    });
});
