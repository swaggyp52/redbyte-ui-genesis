// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Export Service — Evidence Capsule Generation
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
    const exportTimestamp = project?.updatedAt ?? project?.createdAt ?? DEFAULT_ISO_DATE;
    const zip = new JSZip();
    const files = new Map();
    const addTextFile = (path, content) => {
        zip.file(path, content, { date: ZIP_ENTRY_DATE });
        files.set(path, content);
    };
    const addZipFile = (path, content, options) => {
        zip.file(path, content, { ...(options ?? {}), date: ZIP_ENTRY_DATE });
    };
    // -------------------------------------------------------------------------
    // 1. Serialize project.json
    // -------------------------------------------------------------------------
    const projectJson = stableSerialize(project);
    const projectHash = await stableHash(project);
    addTextFile('project.json', projectJson);
    // -------------------------------------------------------------------------
    // 2. Serialize actions.log.json
    // -------------------------------------------------------------------------
    const actionsLog = {
        schemaVersion: '1.0',
        projectId: project.projectId,
        sessionActions: project.evidence.actions,
    };
    const actionsJson = stableSerialize(actionsLog);
    const actionsHash = await stableHash(actionsLog);
    addTextFile('actions.log.json', actionsJson);
    // -------------------------------------------------------------------------
    // 2.5. Generate README.md (auto-generated human-readable summary)
    // -------------------------------------------------------------------------
    const readme = generateReadme(project, { exportDate: exportTimestamp });
    addZipFile('README.md', readme);
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
        rootHash: await hashString(fileEntries.map((f) => f.hash).join('')),
    };
    const manifestJson = stableSerialize(manifest);
    const manifestHash = await stableHash(manifest);
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
    const capsuleJson = stableSerialize(capsule);
    addZipFile('capsule.json', capsuleJson);
    // -------------------------------------------------------------------------
    // 5. Generate ZIP blob
    // -------------------------------------------------------------------------
    return zip.generateAsync({ type: 'blob' });
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
            message: '✅ Integrity verified — all hashes match',
        };
    }
    else if (!projectIntact) {
        integrity = {
            status: 'modified',
            message: '⚠ Project modified — hash mismatch detected',
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
            message: '⚠ Manifest modified — hash mismatch detected',
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
