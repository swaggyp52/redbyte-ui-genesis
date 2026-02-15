// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import JSZip from 'jszip';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useHardwareStore } from '../stores/hardwareStore';
import { useLabStore as usePedagogicalLabStore } from '../labs/labStore';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { VIRTUAL_LAB_TEMPLATES } from '../apps/virtual-lab-templates';
import { createTrace, type HardwareTraceV1 } from '../hardware/traceFormat';

// IMPORTANT: keep @redbyte/rb-logic-3d out of the boot graph.
// This module is imported by 2D lab surfaces, but only needs logic-3d when
// exporting evidence (explicit user action).
let logic3dModulePromise: Promise<typeof import('@redbyte/rb-logic-3d')> | null = null;

async function loadLogic3dModule() {
    if (!logic3dModulePromise) {
        logic3dModulePromise = import('@redbyte/rb-logic-3d');
    }
    return logic3dModulePromise;
}

export interface LabEvidenceCapsule {
    schemaVersion: 1 | 2;
    timestamp: string;
    labId: string;
    student: {
        id: string;
        name: string;
    };
    deviceBoardId?: string;
    deviceKey?: string;
    completedSteps: number[];
    isPass: boolean;
    traceEvents: number;
    trace?: HardwareTraceV1;
    stimulus?: any[];
    evidenceHash?: string;
}

export async function exportEvidenceCapsule(filename: string): Promise<boolean> {
    try {
        const warnings: Array<{ step: string; message: string; error?: string }> = [];
        const pushWarning = (step: string, message: string, error?: unknown) => {
            warnings.push({
                step,
                message,
                error: error instanceof Error ? error.message : error ? String(error) : undefined,
            });
        };
        const hw = useHardwareStore.getState();
        const lab = usePedagogicalLabStore.getState();

        if (!lab.studentId || !lab.studentName) {
            console.warn('Student selection required for export');
        }

        // 1. Prepare Metadata + embedded trace
        let embeddedTrace: HardwareTraceV1 | undefined;
        try {
            embeddedTrace = hw.traceBuffer.length > 0
                ? createTrace(
                    hw.capabilities?.boardId || 'unknown',
                    hw.recordingStartTick ?? 0,
                    [...hw.traceBuffer]
                )
                : undefined;
        } catch (error) {
            pushWarning('trace', 'Failed to build hardware trace; continuing without trace.', error);
            embeddedTrace = undefined;
        }

        const { useLabStore: useModelLabStore, evaluateAtTick, fingerprintLabTemplate } = await loadLogic3dModule();
        const modelLab = useModelLabStore.getState();
        const recorder = (await import('../stores/runRecorderStore')).useRunRecorderStore.getState();

        // 2. Run lab evaluator for grade report (vectors + summary)
        const template = VIRTUAL_LAB_TEMPLATES.find(t => t.lab_id === lab.activeLabId);
        let vectors: Array<{ name: string; pass: boolean; error?: string }> = [];
        let gradeScore = 0;

        if (template && modelLab.labSession) {
            try {
                const templateHash = fingerprintLabTemplate(template);
                const report = evaluateAtTick(
                    modelLab.graph,
                    modelLab.timeline,
                    template,
                    templateHash,
                    modelLab.simulation.tick
                );
                gradeScore = report.score;
                vectors = report.checks.map(check => ({
                    name: check.label || check.id,
                    pass: check.status === 'pass',
                    error: check.status !== 'pass' ? (check.details || check.hint || `Status: ${check.status}`) : undefined,
                }));
            } catch (error) {
                pushWarning('evaluation', 'Failed to evaluate lab vectors; continuing with empty results.', error);
                vectors = [];
                gradeScore = 0;
            }
        }

        const passed = vectors.filter(v => v.pass).length;
        const failed = vectors.filter(v => !v.pass).length;
        const allPassed = vectors.length > 0 && failed === 0;

        const capsule: LabEvidenceCapsule & { summary?: any; vectors?: any[]; meta?: any } = {
            schemaVersion: 1,
            timestamp: new Date().toISOString(),
            labId: lab.activeLabId,
            student: {
                id: lab.studentId || 'anonymous',
                name: lab.studentName || 'Anonymous Student'
            },
            deviceBoardId: hw.capabilities?.boardId,
            deviceKey: hw.activeDevice?.deviceId,
            completedSteps: lab.completedSteps,
            isPass: allPassed || lab.completedSteps.length > 0,
            traceEvents: hw.traceBuffer.length,
            trace: embeddedTrace,
            stimulus: recorder.record?.stimulus || recorder.stimulus,
            summary: {
                passed,
                failed,
                total: vectors.length,
                all_passed: allPassed,
                score: gradeScore,
            },
            vectors,
            meta: {
                transportMode: modelLab.activeTransport.type,
                hardware: modelLab.activeTransport.type === 'bridge' ? {
                    board: hw.capabilities?.boardId || 'unknown',
                    port: 'CONNECTED',
                    agent: '127.0.0.1:4242',
                    verified: modelLab.activeTransport.getStatus().deviceVerified === true,
                    runVerified: lab.hardwareVerified, // Added per Phase 3 req
                } : undefined
            }
        };

        // Compute integrity hash (SHA-256 when available)
        const canonical = canonicalizeEvidence(capsule);
        try {
            const { hash } = await hashEvidenceAsync(canonical);
            capsule.evidenceHash = hash;
        } catch (error) {
            pushWarning('hash', 'Failed to compute evidence hash; leaving hash blank.', error);
        }

        // 3. Build ZIP (v1-compatible format for inspector)
        const zip = new JSZip();

        const manifest = {
            schema_version: 'v1',
            lab_id: lab.activeLabId,
            lab_version: template?.lab_version || '1.0.0',
            student_id: capsule.student.id,
            student: {
                name: capsule.student.name,
                id: capsule.student.id,
            },
            created_at: capsule.timestamp,
            timestamp: capsule.timestamp,
            redbyte_version: '0.1.0',
            files: {
                capsule: 'proofs/capsule.json',
                events: hw.traceBuffer.length > 0 ? 'proofs/events.ndjson' : null,
                circuit_snapshot: 'proofs/circuit_snapshot.json',
                project: 'project.json', // Added per validation requirement
                readme: 'README.md'      // Added per validation requirement
            }
        };

        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file('proofs/capsule.json', JSON.stringify(capsule, null, 2));

        // Trace as NDJSON (v1 path: proofs/events.ndjson)
        if (hw.traceBuffer.length > 0) {
            const ndjson = hw.traceBuffer
                .map(s => JSON.stringify(s))
                .join('\n');
            zip.file('proofs/events.ndjson', ndjson);
        }

        // Circuit snapshot: full graph state at export time
        zip.file('proofs/circuit_snapshot.json', JSON.stringify({
            exportedAt: capsule.timestamp,
            tick: modelLab.simulation.tick,
            nodeCount: modelLab.graph.nodes.length,
            wireCount: modelLab.graph.wires.length,
            graph: modelLab.graph,
        }, null, 2));

        // Project JSON: The complete unified project state
        const project = useUnifiedProjectStore.getState().currentProject;
        if (project) {
            zip.file('project.json', JSON.stringify(project, null, 2));
        } else {
            pushWarning('project', 'Unified project store is empty; project.json omitted.');
        }

        // README.md: Human readable summary
        let readmeContent = `# ${lab.activeLabId.toUpperCase()} Submission
        
**Student:** ${capsule.student.name} (${capsule.student.id})
**Date:** ${capsule.timestamp}
**Board:** ${capsule.deviceBoardId || 'N/A'}

## Self Check Status
${lab.selfCheckResults ? (lab.selfCheckResults.passed ? 'PASSED' : 'FAILED') : 'NOT RUN'}
${lab.selfCheckResults ? `Suite: ${lab.selfCheckResults.suiteId}` : ''}

## Completed Steps
${lab.completedSteps.map(s => `- Step ${s + 1}`).join('\n')}

## Evidence
- Trace Event Buffer: ${capsule.trace?.samples.length || 0} samples
`;
        if (warnings.length > 0) {
            readmeContent += `\n## Export Warnings\n${warnings.map(w => `- ${w.step}: ${w.message}`).join('\n')}\n`;
        }
        zip.file('README.md', readmeContent);

        // Self Check JSON
        if (lab.selfCheckResults) {
            zip.file('evidence/selfcheck.json', JSON.stringify(lab.selfCheckResults, null, 2));
        }

        // 4. Generate and Save
        if (warnings.length > 0) {
            zip.file('warnings.json', JSON.stringify({ schemaVersion: 1, createdAt: capsule.timestamp, warnings }, null, 2));
        }

        const blob = await zip.generateAsync({ type: 'blob' });

        // Generate standardized filename: RB-<labId>-<studentName>-<YYYY-MM-DD>.rb-lab.zip
        const dateOnly = capsule.timestamp.split('T')[0]; // YYYY-MM-DD
        const safeStudentName = (capsule.student.name || capsule.student.id || 'anonymous')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 32);
        const safeName = `RB-${capsule.labId}-${safeStudentName}-${dateOnly}.rb-lab.zip`;

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
        try {
            const zip = new JSZip();
            const warningPayload = {
                schemaVersion: 1,
                createdAt: new Date().toISOString(),
                warnings: [{
                    step: 'export',
                    message: 'Export failed; generated recovery bundle instead.',
                    error: error instanceof Error ? error.message : String(error),
                }],
            };
            zip.file('warnings.json', JSON.stringify(warningPayload, null, 2));
            zip.file('README.md', '# RedByte Export\n\nExport failed and produced a recovery bundle. See warnings.json for details.');

            const blob = await zip.generateAsync({ type: 'blob' });
            const dateOnly = new Date().toISOString().split('T')[0];
            const safeName = `RB-recovery-${dateOnly}.rb-lab.zip`;

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
            return true;
        } catch (fallbackError) {
            console.error('Failed to export recovery bundle', fallbackError);
            return false;
        }
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

        // 1. Schema Version Check (support both v1 and v2)
        if (json.schemaVersion !== 1 && json.schemaVersion !== 2) {
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
    const { useLabStore: useModelLabStore } = await loadLogic3dModule();
    const lab = useModelLabStore.getState();
    const status = lab.getTransportStatus();

    const filename = `grading_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    const content = JSON.stringify({
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        type: 'grading_evidence',
        meta: {
            transportMode: lab.activeTransport.type,
            hardware: lab.activeTransport.type === 'bridge' ? {
                board: 'uno',
                port: 'CONNECTED',
                agent: '127.0.0.1:4242',
                verified: lab.activeTransport.getStatus().deviceVerified === true,
            } : undefined
        },
        ...data
    }, null, 2);

    await fs.createFile('/' + filename, content);

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
 * Generate a SHA-256 hash of the evidence object for integrity checks.
 * Falls back to DJB2 if Web Crypto API is unavailable.
 */
export async function hashEvidenceAsync(evidence: any): Promise<{ hash: string; hashedBytes: number; hashAlg: string }> {
    const json = JSON.stringify(evidence);
    const hashedBytes = new TextEncoder().encode(json).byteLength;
    if (typeof globalThis.crypto?.subtle?.digest === 'function') {
        const data = new TextEncoder().encode(json);
        const buffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(buffer));
        const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return { hash: hex, hashedBytes, hashAlg: 'sha256' };
    }
    // Fallback: DJB2 for environments without Web Crypto
    return hashEvidence(evidence);
}

/**
 * Synchronous DJB2 hash fallback for non-async contexts.
 */
export function hashEvidence(evidence: any): { hash: string; hashedBytes: number; hashAlg: string } {
    const json = JSON.stringify(evidence);
    const hashedBytes = new TextEncoder().encode(json).byteLength;
    let hash = 5381;
    for (let i = 0; i < json.length; i++) {
        hash = ((hash << 5) + hash) + json.charCodeAt(i); /* hash * 33 + c */
    }
    return { hash: (hash >>> 0).toString(16), hashedBytes, hashAlg: 'djb2' };
}
