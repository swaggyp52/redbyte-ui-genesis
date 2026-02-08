// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Export Service - Evidence Capsule Generation
 *
 * Creates ZIP archives with:
 * - capsule.json (index with hashes)
 * - project.json (full project state)
 * - actions.log.json (action log)
 * - manifest.json (integrity manifest)
 *
 * CRITICAL: All hashes use stableSerialize + SHA256 for deterministic integrity.
 */
import JSZip from 'jszip';
import { generateReadme } from './readmeGenerator';
// Get build version from environment or fallback
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA ?? 'dev';
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE ?? 'dev';
const DEFAULT_ISO_DATE = '1970-01-01T00:00:00.000Z';
const ZIP_ENTRY_DATE = new Date('1980-01-01T00:00:00.000Z');
// Simple stable serialization (breaks circular dependency with rb-apps)
function stableSerialize(obj) {
    // Deterministic serialization with sorted keys at all levels
    const sortKeys = (value) => {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map(sortKeys);
        }
        const sorted = {};
        Object.keys(value).sort().forEach(key => {
            sorted[key] = sortKeys(value[key]);
        });
        return sorted;
    };
    return JSON.stringify(sortKeys(obj), null, 2);
}
async function stableHash(obj) {
    const json = stableSerialize(obj);
    return await hashString(json);
}
export async function exportEvidenceCapsule(project) {
    const exportTimestamp = project?.updatedAt ??
        project?.createdAt ??
        DEFAULT_ISO_DATE;
    const safeProjectFallback = {
        schemaVersion: '1.0',
        projectId: project?.projectId ?? 'export-fallback',
        name: project?.name ?? 'Recovered Project',
        description: project?.description ?? '',
        createdAt: project?.createdAt ?? DEFAULT_ISO_DATE,
        updatedAt: project?.updatedAt ??
            project?.createdAt ??
            DEFAULT_ISO_DATE,
        circuit: project?.circuit ?? { schemaVersion: '1.0', nodes: [], connections: [] },
        simulation: project?.simulation ?? { tickRate: 20, currentTick: 0, probes: [] },
        labSpec: project?.labSpec ?? null,
        evidence: project?.evidence ?? { actions: [], snapshots: [] },
    };
    try {
        const zip = new JSZip();
        const files = new Map();
        const warnings = [];
        const addTextFile = (path, content) => {
            zip.file(path, content, { date: ZIP_ENTRY_DATE });
            files.set(path, content);
        };
        const addZipFile = (path, content, options) => {
            zip.file(path, content, { ...(options ?? {}), date: ZIP_ENTRY_DATE });
        };
        const pushWarning = (step, message, error) => {
            warnings.push({
                step,
                message,
                error: error instanceof Error ? error.message : error ? String(error) : undefined,
            });
        };
        const safeSerialize = (value, step, fallback) => {
            try {
                return stableSerialize(value);
            }
            catch (error) {
                pushWarning(step, 'Serialization failed; using fallback payload.', error);
                return stableSerialize(fallback);
            }
        };
        const safeHash = async (value, step) => {
            try {
                return await stableHash(value);
            }
            catch (error) {
                pushWarning(step, 'Hashing failed; using placeholder hash.', error);
                return 'sha256:ERROR';
            }
        };
        // -------------------------------------------------------------------------
        // 1. Serialize project.json
        // -------------------------------------------------------------------------
        const projectJson = safeSerialize(project, 'project', safeProjectFallback);
        const projectHash = await safeHash(project, 'project-hash');
        addTextFile('project.json', projectJson);
        // -------------------------------------------------------------------------
        // 2. Serialize actions.log.json
        // -------------------------------------------------------------------------
        const actionsLog = {
            schemaVersion: '1.0',
            projectId: project.projectId,
            sessionActions: project.evidence.actions,
        };
        const actionsJson = safeSerialize(actionsLog, 'actions', actionsLog);
        const actionsHash = await safeHash(actionsLog, 'actions-hash');
        addTextFile('actions.log.json', actionsJson);
        // -------------------------------------------------------------------------
        // 2.5. Generate README.md (auto-generated human-readable summary)
        // -------------------------------------------------------------------------
        try {
            const readme = generateReadme(project, { exportDate: exportTimestamp });
            addZipFile('README.md', readme);
        }
        catch (error) {
            pushWarning('readme', 'README generation failed; using fallback.', error);
            addZipFile('README.md', '# RedByte Export\n\nREADME generation failed. See warnings.json for details.');
        }
        // -------------------------------------------------------------------------
        // 2.7. Add FPGA artifacts if available (verilog/ and bitstream/)
        // -------------------------------------------------------------------------
        const fpgaArtifacts = project.fpgaArtifacts;
        if (fpgaArtifacts) {
            // Add Verilog source
            if (fpgaArtifacts.verilog) {
                addTextFile('verilog/design.v', fpgaArtifacts.verilog);
            }
            // Add XDC constraints
            if (fpgaArtifacts.constraints) {
                addTextFile('verilog/constraints.xdc', fpgaArtifacts.constraints);
            }
            // Add bitstream if available
            if (fpgaArtifacts.bitstream) {
                // Bitstream is binary - handle as Uint8Array or Blob
                if (fpgaArtifacts.bitstream instanceof Uint8Array) {
                    addZipFile('bitstream/design.bit', fpgaArtifacts.bitstream);
                }
                else if (typeof fpgaArtifacts.bitstream === 'string') {
                    // If stored as base64 string
                    addZipFile('bitstream/design.bit', fpgaArtifacts.bitstream, { base64: true });
                }
            }
            // Add provenance metadata
            if (fpgaArtifacts.metadata) {
                const metadataJson = stableSerialize(fpgaArtifacts.metadata);
                addTextFile('fpga/provenance.json', metadataJson);
            }
        }
        // -------------------------------------------------------------------------
        // 2.9. Add warnings.json if needed
        // -------------------------------------------------------------------------
        if (warnings.length > 0) {
            const warningsPayload = {
                schemaVersion: '1.0',
                createdAt: exportTimestamp,
                warnings,
            };
            const warningsJson = stableSerialize(warningsPayload);
            addTextFile('warnings.json', warningsJson);
        }
        // -------------------------------------------------------------------------
        // 3. Build evidence manifest
        // -------------------------------------------------------------------------
        const fileEntries = [];
        const sortedFiles = Array.from(files.entries()).sort(([a], [b]) => a.localeCompare(b));
        for (const [path, content] of sortedFiles) {
            fileEntries.push({
                path,
                hash: await hashString(content),
                size: new TextEncoder().encode(content).byteLength,
            });
        }
        const manifest = {
            schemaVersion: '1.0',
            buildVersion: BUILD_SHA,
            buildDate: BUILD_DATE,
            createdAt: exportTimestamp,
            files: fileEntries,
            rootHash: await safeHash(fileEntries.map((f) => f.hash).join(''), 'manifest-root-hash'),
        };
        const manifestJson = safeSerialize(manifest, 'manifest', manifest);
        const manifestHash = await safeHash(manifest, 'manifest-hash');
        addZipFile('manifest.json', manifestJson);
        // -------------------------------------------------------------------------
        // 4. Build capsule index (top-level metadata)
        // -------------------------------------------------------------------------
        const capsule = {
            schemaVersion: '1.0',
            projectHash,
            actionLogHash: actionsHash,
            manifestHash,
            buildSHA: BUILD_SHA,
            buildDate: BUILD_DATE,
            createdAt: exportTimestamp,
            files: {
                project: 'project.json',
                actions: 'actions.log.json',
                manifest: 'manifest.json',
            },
        };
        const capsuleJson = safeSerialize(capsule, 'capsule', capsule);
        addZipFile('capsule.json', capsuleJson);
        // -------------------------------------------------------------------------
        // 5. Generate ZIP blob
        // -------------------------------------------------------------------------
        return zip.generateAsync({ type: 'blob' });
    }
    catch (error) {
        const fallbackZip = new JSZip();
        const fallbackTimestamp = project?.updatedAt ??
            project?.createdAt ??
            DEFAULT_ISO_DATE;
        const warningPayload = {
            schemaVersion: '1.0',
            createdAt: fallbackTimestamp,
            warnings: [{
                    step: 'export',
                    message: 'Export failed; generated recovery bundle instead.',
                    error: error instanceof Error ? error.message : String(error),
                }],
        };
        fallbackZip.file('project.json', stableSerialize(safeProjectFallback), { date: ZIP_ENTRY_DATE });
        fallbackZip.file('warnings.json', JSON.stringify(warningPayload, null, 2), { date: ZIP_ENTRY_DATE });
        fallbackZip.file('README.md', '# RedByte Export\n\nExport failed and produced a recovery bundle. See warnings.json for details.', { date: ZIP_ENTRY_DATE });
        return fallbackZip.generateAsync({ type: 'blob' });
    }
}
/**
 * Import evidence capsule and verify integrity.
 */
export async function importEvidenceCapsule(blob) {
    const zip = await JSZip.loadAsync(blob);
    // Read capsule index
    const capsuleFile = zip.file('capsule.json');
    if (!capsuleFile) {
        throw new Error('Invalid evidence capsule: missing capsule.json');
    }
    const capsuleJson = await capsuleFile.async('string');
    const capsule = JSON.parse(capsuleJson);
    // Read project
    const projectFile = zip.file(capsule.files.project);
    if (!projectFile) {
        throw new Error('Invalid evidence capsule: missing project.json');
    }
    const projectJson = await projectFile.async('string');
    const project = JSON.parse(projectJson);
    // Verify integrity
    const actualProjectHash = await stableHash(project);
    const projectIntact = actualProjectHash === capsule.projectHash;
    // Read manifest
    const manifestFile = zip.file(capsule.files.manifest);
    const manifestJson = await manifestFile?.async('string');
    const manifest = manifestJson ? JSON.parse(manifestJson) : undefined;
    const actualManifestHash = manifest ? await stableHash(manifest) : '';
    const manifestIntact = actualManifestHash === capsule.manifestHash;
    // Determine integrity status
    let integrity;
    if (projectIntact && manifestIntact) {
        integrity = {
            status: 'verified',
            message: 'Integrity verified - all hashes match',
        };
    }
    else if (!projectIntact) {
        integrity = {
            status: 'modified',
            message: 'Integrity warning: project modified (hash mismatch detected)',
            details: {
                expectedHash: capsule.projectHash,
                actualHash: actualProjectHash,
                modifiedFiles: ['project.json'],
            },
        };
    }
    else {
        integrity = {
            status: 'modified',
            message: 'Integrity warning: manifest modified (hash mismatch detected)',
            details: {
                expectedHash: capsule.manifestHash,
                actualHash: actualManifestHash,
                modifiedFiles: ['manifest.json'],
            },
        };
    }
    return { project, capsule, integrity };
}
// ============================================================================
// Helper Functions
// ============================================================================
async function hashString(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
}
