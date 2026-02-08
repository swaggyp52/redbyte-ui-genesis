// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { stableSerialize } from './stableSerialize';
import { hashBytesOffThread, stableHashOffThread } from './computeWorker';
/**
 * Build an evidence manifest from a set of named files.
 * Computes per-file SHA256 and a rootHash over the sorted file list.
 */
export async function buildEvidenceManifest(files, buildVersion) {
    const entries = [];
    // Sort paths for deterministic ordering
    const sortedPaths = Array.from(files.keys()).sort();
    for (const path of sortedPaths) {
        const data = files.get(path);
        const sha256 = await hashBytesOffThread(data);
        entries.push({
            path,
            sha256,
            sizeBytes: data.byteLength,
        });
    }
    // Root hash = SHA-256 of the sorted file entries
    const rootHash = await stableHashOffThread(entries);
    return {
        schemaVersion: '1.0',
        buildVersion,
        createdAt: new Date().toISOString(),
        files: entries,
        rootHash,
    };
}
/**
 * Serialize an evidence manifest to deterministic JSON.
 */
export function serializeManifest(manifest) {
    return stableSerialize(manifest);
}
/**
 * Verify an evidence capsule's integrity against its manifest.
 * Returns which files pass and which fail.
 */
export async function verifyEvidenceManifest(manifest, files) {
    if (!manifest || !manifest.schemaVersion) {
        return { status: 'unknown', manifest: null, failedFiles: [] };
    }
    const failedFiles = [];
    for (const entry of manifest.files) {
        const data = files.get(entry.path);
        if (!data) {
            failedFiles.push(entry.path);
            continue;
        }
        const actual = await hashBytesOffThread(data);
        if (actual !== entry.sha256) {
            failedFiles.push(entry.path);
        }
    }
    // Also check rootHash
    const currentEntries = [];
    const sortedPaths = Array.from(files.keys()).sort();
    for (const path of sortedPaths) {
        const data = files.get(path);
        const sha256 = await hashBytesOffThread(data);
        currentEntries.push({ path, sha256, sizeBytes: data.byteLength });
    }
    const currentRoot = await stableHashOffThread(currentEntries);
    if (currentRoot !== manifest.rootHash) {
        return { status: 'modified', manifest, failedFiles };
    }
    if (failedFiles.length > 0) {
        return { status: 'modified', manifest, failedFiles };
    }
    return { status: 'verified', manifest, failedFiles: [] };
}
