// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { createV2Bundle } from '../hardware/v2Export';
import { createTrace } from '../hardware/traceFormat';
import JSZip from 'jszip';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

// Polyfill Web Crypto for Node.js environment (Vitest)
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto for Node.js environment (Vitest)
if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        writable: true
    });
} else if (!globalThis.crypto.subtle) {
    Object.defineProperty(globalThis.crypto, 'subtle', {
        value: webcrypto.subtle,
        writable: true
    });
}

// Polyfill TextEncoder
import { TextEncoder } from 'util';
if (!globalThis.TextEncoder) {
    globalThis.TextEncoder = TextEncoder as any;
}

describe('v2Export', () => {
    it('generates a valid zip bundle with manifest and trace', async () => {
        const trace = createTrace('mock-board', 100, [
            { tick: 100, timestamp: 1000, inputs: {}, outputs: {} } as any,
            { tick: 101, timestamp: 1020, inputs: {}, outputs: {} } as any
        ]);

        const blob = await createV2Bundle(trace, { studentName: 'Test Student' });
        expect(blob).toBeDefined();

        // Verify zip content
        const zip = await JSZip.loadAsync(blob);

        // 1. Check Manifest
        const manifestFile = zip.file('manifest.json');
        expect(manifestFile).not.toBeNull();
        const manifest = JSON.parse(await manifestFile!.async('string'));
        expect(manifest.version).toBe('2.0');
        expect(manifest.student.name).toBe('Test Student');
        expect(manifest.files.trace).toBe('trace/hw_trace.ndjson');

        // 2. Check Trace NDJSON
        const traceFile = zip.file('trace/hw_trace.ndjson');
        expect(traceFile).not.toBeNull();
        const traceContent = await traceFile!.async('string');
        const lines = traceContent.split('\n');
        expect(lines.length).toBe(3); // Header + 2 samples
        const header = JSON.parse(lines[0]);
        expect(header.type).toBe('header');
        expect(header.board_id).toBe('mock-board');

        // 3. Check Capsule (Integrity)
        const capsuleFile = zip.file('integrity/capsule.json');
        expect(capsuleFile).not.toBeNull();
        const capsule = JSON.parse(await capsuleFile!.async('string'));
        expect(capsule.version).toBe('1.0');
        expect(capsule.hashes['manifest.json']).toBeDefined();
        expect(capsule.hashes['trace/hw_trace.ndjson']).toBeDefined();
    });
});
