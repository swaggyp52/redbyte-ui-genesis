// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import JSZip from 'jszip';
import { useFileSystemStore } from '../stores/fileSystemStore.js';
import { useHardwareStore } from '../stores/hardwareStore.js';
import { useLabStore as usePedagogicalLabStore } from '../labs/labStore.js';
import { useLabStore as useModelLabStore, evaluateAtTick, fingerprintLabTemplate } from '@redbyte/rb-logic-3d';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { VIRTUAL_LAB_TEMPLATES } from '../apps/virtual-lab-templates.js';
import { createTrace } from '../hardware/traceFormat.js';
export async function exportEvidenceCapsule(filename) {
    try {
        const hw = useHardwareStore.getState();
        const lab = usePedagogicalLabStore.getState();
        if (!lab.studentId || !lab.studentName) {
            console.warn('Student selection required for export');
        }
        // 1. Prepare Metadata + embedded trace
        const embeddedTrace = hw.traceBuffer.length > 0
            ? createTrace(hw.capabilities?.boardId || 'unknown', hw.recordingStartTick ?? 0, [...hw.traceBuffer])
            : undefined;
        const modelLab = useModelLabStore.getState();
        const recorder = (await import('../stores/runRecorderStore')).useRunRecorderStore.getState();
        // 2. Run lab evaluator for grade report (vectors + summary)
        const template = VIRTUAL_LAB_TEMPLATES.find(t => t.lab_id === lab.activeLabId);
        let vectors = [];
        let gradeScore = 0;
        if (template && modelLab.labSession) {
            const templateHash = fingerprintLabTemplate(template);
            const report = evaluateAtTick(modelLab.graph, modelLab.timeline, template, templateHash, modelLab.simulation.tick);
            gradeScore = report.score;
            vectors = report.checks.map(check => ({
                name: check.label || check.id,
                pass: check.status === 'pass',
                error: check.status !== 'pass' ? (check.details || check.hint || `Status: ${check.status}`) : undefined,
            }));
        }
        const passed = vectors.filter(v => v.pass).length;
        const failed = vectors.filter(v => !v.pass).length;
        const allPassed = vectors.length > 0 && failed === 0;
        const capsule = {
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
        const { hash } = await hashEvidenceAsync(canonical);
        capsule.evidenceHash = hash;
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
                readme: 'README.md' // Added per validation requirement
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
        }
        // README.md: Human readable summary
        const readmeContent = `# ${lab.activeLabId.toUpperCase()} Submission
        
**Student:** ${capsule.student.name} (${capsule.student.id})
**Date:** ${new Date().toLocaleString()}
**Board:** ${capsule.deviceBoardId || 'N/A'}

## Self Check Status
${lab.selfCheckResults ? (lab.selfCheckResults.passed ? '✅ PASSED' : '❌ FAILED') : '❓ NOT RUN'}
${lab.selfCheckResults ? `Suite: ${lab.selfCheckResults.suiteId}` : ''}

## Completed Steps
${lab.completedSteps.map(s => `- Step ${s + 1}`).join('\n')}

## Evidence
- Trace Event Buffer: ${capsule.trace?.samples.length || 0} samples
`;
        zip.file('README.md', readmeContent);
        // Self Check JSON
        if (lab.selfCheckResults) {
            zip.file('evidence/selfcheck.json', JSON.stringify(lab.selfCheckResults, null, 2));
        }
        // 4. Generate and Save
        const blob = await zip.generateAsync({ type: 'blob' });
        let safeName = filename.replace(/\.json$/, '').replace(/\.zip$/, '');
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        safeName += `-${ts}.rb-lab.zip`;
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
    }
    catch (error) {
        console.error('Failed to export evidence capsule', error);
        return false;
    }
}
export async function loadEvidenceCapsule(fileId) {
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
        let json;
        try {
            json = JSON.parse(loadedFile.content);
        }
        catch (e) {
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
        return json;
    }
    catch (error) {
        console.error('Failed to load evidence capsule', error);
        return null;
    }
}
// Helper to export grading evidence
// Matches usage in LogicPlaygroundApp.tsx
export async function exportEvidence(data) {
    const fs = useFileSystemStore.getState();
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
export function canonicalizeEvidence(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(canonicalizeEvidence);
    }
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    for (const key of sortedKeys) {
        result[key] = canonicalizeEvidence(obj[key]);
    }
    return result;
}
/**
 * Generate a SHA-256 hash of the evidence object for integrity checks.
 * Falls back to DJB2 if Web Crypto API is unavailable.
 */
export async function hashEvidenceAsync(evidence) {
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
export function hashEvidence(evidence) {
    const json = JSON.stringify(evidence);
    const hashedBytes = new TextEncoder().encode(json).byteLength;
    let hash = 5381;
    for (let i = 0; i < json.length; i++) {
        hash = ((hash << 5) + hash) + json.charCodeAt(i); /* hash * 33 + c */
    }
    return { hash: (hash >>> 0).toString(16), hashedBytes, hashAlg: 'djb2' };
}
