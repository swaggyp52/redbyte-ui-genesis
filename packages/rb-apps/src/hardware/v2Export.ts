// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import JSZip from 'jszip';
import type { HardwareTraceV1 } from './traceFormat';

export interface V2BundleMetadata {
    studentName?: string;
    studentId?: string;
    labId?: string;
    attemptId?: string;
    boardProfile?: any;
}

/**
 * Compute SHA-256 hash of a string content
 */
async function computeHash(content: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert In-Memory Trace V1 to NDJSON format for V2 bundle
 */
function traceToNDJSON(trace: HardwareTraceV1): string {
    // Header line
    const header = JSON.stringify({
        type: 'header',
        version: '1.0',
        board_id: trace.boardId,
        started_at: trace.startedAtIso,
        start_tick: trace.startTick
    });

    // Sample lines
    const lines = trace.samples.map(s => JSON.stringify({
        type: 'sample',
        ts: s.timestamp,
        tick: s.tick,
        inputs: s.inputs,
        outputs: s.outputs
    }));

    return [header, ...lines].join('\n');
}

/**
 * Create a RedByte Lab Submission Bundle (V2)
 */
export async function createV2Bundle(
    trace: HardwareTraceV1,
    metadata: V2BundleMetadata = {}
): Promise<Blob> {
    const zip = new JSZip();

    // 1. Prepare Content Files
    // -------------------------

    // Trace (NDJSON)
    const traceContent = traceToNDJSON(trace);
    zip.file('trace/hw_trace.ndjson', traceContent);

    // Board Profile (if available)
    let boardProfileContent: string | null = null;
    if (metadata.boardProfile) {
        boardProfileContent = JSON.stringify(metadata.boardProfile, null, 2);
        zip.file('meta/board_profile.json', boardProfileContent);
    }

    // Manifest (V2)
    const manifest = {
        version: '2.0',
        type: 'lab_submission',
        generated_at: new Date().toISOString(),
        lab_id: metadata.labId || 'unknown',
        student: {
            name: metadata.studentName,
            id: metadata.studentId
        },
        files: {
            trace: 'trace/hw_trace.ndjson',
            board_profile: boardProfileContent ? 'meta/board_profile.json' : undefined
        }
    };
    const manifestContent = JSON.stringify(manifest, null, 2);
    zip.file('manifest.json', manifestContent);

    // 2. Compute Integrity Hashes
    // ---------------------------
    const traceHash = await computeHash(traceContent);
    const manifestHash = await computeHash(manifestContent);
    const profileHash = boardProfileContent ? await computeHash(boardProfileContent) : null;

    // 3. Create Integrity Capsule
    // ---------------------------
    const capsule = {
        version: '1.0',
        algorithm: 'sha256',
        hashes: {
            'manifest.json': manifestHash,
            'trace/hw_trace.ndjson': traceHash,
            ...(profileHash ? { 'meta/board_profile.json': profileHash } : {})
        },
        signed: false // Placeholder for future signing
    };
    zip.file('integrity/capsule.json', JSON.stringify(capsule, null, 2));

    // 4. Generate Zip Blob
    // --------------------
    return await zip.generateAsync({ type: 'blob' });
}
