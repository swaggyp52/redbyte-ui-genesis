import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import JSZip from 'jszip';
import type { CapsuleObject } from '@redbyte/rb-fpga-signing';
import { useLabWorkflowStore, type LabHardwareSnapshot } from '../useLabWorkflowStore';
import { exportV2Bundle, type ExportV2Options } from '../../utils/bundleExport';

// This is software preservation proof for synthetic I/O. No bridge connection,
// physical switch interaction, board programming or hardware acceptance is exercised.
const readBlob = (blob: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        if (reader.result !== null && typeof reader.result !== 'string') resolve(reader.result);
        else reject(new Error('Expected bundle bytes from FileReader'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read bundle bytes'));
    reader.readAsArrayBuffer(blob);
});

describe('Lab snapshot and bundle preservation (synthetic COM7 metadata)', () => {
    beforeAll(() => vi.stubGlobal('crypto', webcrypto));
    afterAll(() => vi.unstubAllGlobals());
    beforeEach(() => useLabWorkflowStore.getState().reset());
    afterEach(() => useLabWorkflowStore.getState().reset());

    it('preserves supplied switch bits in the store and actual ZIP contents', async () => {
        useLabWorkflowStore.setState({
            selectedLabId: 'lab0',
            studentIdentity: { name: 'Test Student', id: '12345' },
            currentStep: 'hardware',
        });

        // Synthetic bridge-shaped payloads retain the original bit groups and metadata.
        const snapshot1: LabHardwareSnapshot = {
            timestamp: '2026-10-01T00:00:00.000Z',
            inputs: { SW: 1 },
            outputs: {},
            source: 'bridge',
            port: 'COM7',
        };
        const snapshot2: LabHardwareSnapshot = {
            timestamp: '2026-10-01T00:00:01.000Z',
            inputs: { SW: 3 },
            outputs: {},
            source: 'bridge',
            port: 'COM7',
        };
        useLabWorkflowStore.getState().addHardwareSnapshot(snapshot1);
        useLabWorkflowStore.getState().addHardwareSnapshot(snapshot2);

        const finalSnapshots = useLabWorkflowStore.getState().hardwareSnapshots;
        expect(finalSnapshots).toHaveLength(2);
        expect(finalSnapshots[0].inputs.SW).toBe(1);
        expect(finalSnapshots[1].inputs.SW).toBe(3);
        expect(finalSnapshots).toEqual([snapshot1, snapshot2]);

        const eventLog = [
            { type: 'hw_connect', port: 'COM7', status: 'online' },
            { type: 'snapshot_captured', data: snapshot1 },
            { type: 'snapshot_captured', data: snapshot2 },
        ];
        const options: ExportV2Options = {
            labId: 'lab0',
            studentId: '12345',
            studentName: 'Test Student',
            hardwareSnapshots: finalSnapshots,
            eventLog,
        };
        const result = await exportV2Bundle(options);
        expect(result.blob).toBeDefined();
        expect(result.blob.size).toBeGreaterThan(0);
        expect(result.filename).toBe(`RB-lab0-Test_Student-${result.timestamp.split('T')[0]}.rb-lab.zip`);

        const zip = await JSZip.loadAsync(await readBlob(result.blob));
        const requiredFile = (name: string) => {
            const file = zip.file(name);
            expect(file, name).not.toBeNull();
            if (!file) throw new Error(`Missing actual bundle entry: ${name}`);
            return file;
        };
        expect(JSON.parse(await requiredFile('manifest.json').async('string'))).toMatchObject({
            schema_version: 'v2',
            lab_id: 'lab0',
            student: { id: '12345', name: 'Test Student' },
            board: 'basys3',
            bitstream_present: false,
            trace_summary: { events: 0, crc_failures: 0 },
        });
        expect(JSON.parse(await requiredFile('proofs/snapshots.json').async('string'))).toEqual(finalSnapshots);
        expect((await requiredFile('proofs/events.ndjson').async('string')).split('\n')
            .map(line => JSON.parse(line))).toEqual(eventLog);
        expect(await requiredFile('trace/hw_trace.ndjson').async('string')).toBe('');
        expect(zip.file('bitstream/design.bit')).toBeNull();

        const capsule: CapsuleObject = JSON.parse(await requiredFile('integrity/capsule.json').async('string'));
        expect(capsule.algo).toBe('sha256');
        for (const name of ['manifest.json', 'proofs/snapshots.json', 'proofs/events.ndjson']) {
            const bytes = await requiredFile(name).async('uint8array');
            expect(capsule.files).toContainEqual({
                path: name,
                hash: createHash('sha256').update(bytes).digest('hex'),
            });
        }
    });
});
