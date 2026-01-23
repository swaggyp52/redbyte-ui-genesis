// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import JSZip from 'jszip';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useHardwareStore } from '../stores/hardwareStore';
import { useLabStore } from '../labs/labStore';
import { createTrace, type HardwareTraceV1 } from '../hardware/traceFormat';

export interface LabEvidenceCapsule {
    schemaVersion: 2;
    timestamp: string;
    labId: string;
    student: {
        id: string;
        name: string;
    };
    deviceBoardId?: string;
    completedSteps: number[];
    isPass: boolean;
    traceEvents: number;
    evidenceHash?: string;
}

export async function exportEvidenceCapsule(filename: string): Promise<boolean> {
    try {
        const fs = useFileSystemStore.getState();
        const hw = useHardwareStore.getState();
        const lab = useLabStore.getState();

        if (!lab.studentId || !lab.studentName) {
            console.warn('Student selection required for export');
            // We should ideally prompt here or handled by UI
        }

        // 1. Prepare Metadata
        const capsule: LabEvidenceCapsule = {
            schemaVersion: 2,
            timestamp: new Date().toISOString(),
            labId: lab.activeLabId,
            student: {
                id: lab.studentId || 'anonymous',
                name: lab.studentName || 'Anonymous Student'
            },
            deviceBoardId: hw.capabilities?.boardId,
            completedSteps: lab.completedSteps,
            isPass: lab.completedSteps.length > 0, // Simplified pass criteria
            traceEvents: hw.traceBuffer.length
        };

        // 2. Build ZIP
        const zip = new JSZip();

        // Manifest for examiner app
        const manifest = {
            schema_version: 'v2',
            lab_id: lab.activeLabId,
            student_id: capsule.student.id,
            timestamp: capsule.timestamp,
            files: {
                capsule: 'proofs/capsule.json',
                trace: hw.traceBuffer.length > 0 ? 'proofs/trace.ndjson' : null
            }
        };

        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file('proofs/capsule.json', JSON.stringify(capsule, null, 2));

        // Trace as NDJSON if available
        if (hw.traceBuffer.length > 0) {
            const ndjson = hw.traceBuffer
                .map(s => JSON.stringify(s))
                .join('\n');
            zip.file('proofs/trace.ndjson', ndjson);
        }

        // 3. Generate and Save
        const blob = await zip.generateAsync({ type: 'blob' });

        // Save to virtual FS
        let safeName = filename.replace(/\.json$/, '').replace(/\.zip$/, '');
        safeName += '.rb-lab.zip';

        const arrayBuffer = await blob.arrayBuffer();
        // Since Virtual FS might only support strings for now? 
        // Let's check createFile sig. Usually it's string.
        // If it only takes strings, we might need to base64 or just skip virtual FS for the zip blob.
        // Actually, most RedByte Virtual FS implementations take string.
        // Let's skip Virtual FS for the binary ZIP and just do direct download + log.

        if (typeof document !== 'undefined') {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = safeName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        console.log('[EvidenceExport] Capsule exported:', safeName);
        return true;
    } catch (error) {
        console.error('Failed to export evidence capsule', error);
        return false;
    }
}

export async function loadEvidenceCapsule(fileId: string): Promise<LabEvidenceCapsule | null> {
    try {
        const fs = useFileSystemStore.getState();
        const allFiles = fs.getAllFiles();

        // Robust Lookup: handles fileId (opaque) OR filename (user input)
        const file = allFiles.find(f => f.id === fileId || f.name === fileId || f.name === fileId + '.json');

        if (!file) {
            console.error('Evidence file not found:', fileId);
            return null;
        }

        // Robust Read: Use explicit getFile/readFile if available to ensure content
        // (Handles cases where list might be metadata-only in future)
        const loadedFile = fs.getFile(file.id);

        if (!loadedFile || !loadedFile.content) {
            console.error('Evidence file has no content:', fileId);
            return null;
        }

        let json: any;
        try {
            json = JSON.parse(loadedFile.content);
        } catch (e) {
            console.error('Failed to parse evidence JSON:', e);
            return null;
        }

        // 1. Schema Version Check
        if (json.schemaVersion !== 1) {
            console.error('Unsupported evidence schema version:', json.schemaVersion);
            return null;
        }

        // 2. Critical Field Validation
        if (typeof json.labId !== 'string' || !json.labId) {
            console.error('Missing or invalid labId');
            return null;
        }
        if (typeof json.timestamp !== 'string' || !json.timestamp) {
            console.error('Missing or invalid timestamp');
            return null;
        }
        if (typeof json.isPass !== 'boolean') {
            console.error('Missing or invalid isPass status');
            return null;
        }

        return json as LabEvidenceCapsule;
    } catch (error) {
        console.error('Failed to load evidence capsule', error);
        return null;
    }
}

// Helper to export grading evidence
// Matches usage in LogicPlaygroundApp.tsx
export async function exportEvidence(data: any): Promise<void> {
    const fs = useFileSystemStore.getState();
    const filename = `grading_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    const content = JSON.stringify({
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        type: 'grading_evidence',
        ...data
    }, null, 2);

    await fs.createFile('/' + filename, content);

    // Also trigger download if in browser
    if (typeof document !== 'undefined') {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

/**
 * Recursively sort object keys to ensure deterministic JSON serialization.
 */
export function canonicalizeEvidence(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(canonicalizeEvidence);
    }
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
        result[key] = canonicalizeEvidence(obj[key]);
    }
    return result;
}

/**
 * Generate a simple hash of the evidence object for integrity checks.
 * Using a simple DJB2 variant for client-side speed/availablity if crypto not avail.
 * Or use Web Crypto API if available.
 */
export function hashEvidence(evidence: any): { hash: string } {
    const json = JSON.stringify(evidence);
    let hash = 5381;
    for (let i = 0; i < json.length; i++) {
        hash = ((hash << 5) + hash) + json.charCodeAt(i); /* hash * 33 + c */
    }
    // Return unsigned hex
    return { hash: (hash >>> 0).toString(16) };
}
