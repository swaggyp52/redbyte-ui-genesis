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
import type {
  LabProjectV1,
  CapsuleIndex,
  EvidenceManifest,
  EvidenceFileEntry,
} from '@redbyte/rb-utils/labProjectSchema';

// Get build version from environment or fallback
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA ?? 'dev';
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE ?? new Date().toISOString();

// Simple stable serialization (breaks circular dependency with rb-apps)
function stableSerialize(obj: any): string {
  // Deterministic serialization with sorted keys at all levels
  const sortKeys = (value: any): any => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(sortKeys);
    }
    const sorted: any = {};
    Object.keys(value).sort().forEach(key => {
      sorted[key] = sortKeys(value[key]);
    });
    return sorted;
  };
  return JSON.stringify(sortKeys(obj), null, 2);
}

async function stableHash(obj: any): Promise<string> {
  const json = stableSerialize(obj);
  return await hashString(json);
}

export async function exportEvidenceCapsule(project: LabProjectV1): Promise<Blob> {
  const zip = new JSZip();
  const files = new Map<string, string>();

  // -------------------------------------------------------------------------
  // 1. Serialize project.json
  // -------------------------------------------------------------------------

  const projectJson = stableSerialize(project);
  const projectHash = await stableHash(project);
  files.set('project.json', projectJson);
  zip.file('project.json', projectJson);

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
  files.set('actions.log.json', actionsJson);
  zip.file('actions.log.json', actionsJson);

  // -------------------------------------------------------------------------
  // 3. Build evidence manifest
  // -------------------------------------------------------------------------

  const fileEntries: EvidenceFileEntry[] = [];
  for (const [path, content] of files.entries()) {
    fileEntries.push({
      path,
      hash: await hashString(content),
      size: new TextEncoder().encode(content).byteLength,
    });
  }

  const manifest: EvidenceManifest = {
    schemaVersion: '1.0',
    buildVersion: BUILD_SHA,
    buildDate: BUILD_DATE,
    createdAt: new Date().toISOString(),
    files: fileEntries,
    rootHash: await hashString(fileEntries.map((f) => f.hash).join('')),
  };

  const manifestJson = stableSerialize(manifest);
  const manifestHash = await stableHash(manifest);
  zip.file('manifest.json', manifestJson);

  // -------------------------------------------------------------------------
  // 4. Build capsule index (top-level metadata)
  // -------------------------------------------------------------------------

  const capsule: CapsuleIndex = {
    schemaVersion: '1.0',
    projectHash,
    actionLogHash: actionsHash,
    manifestHash,
    buildSHA: BUILD_SHA,
    buildDate: BUILD_DATE,
    createdAt: new Date().toISOString(),
    files: {
      project: 'project.json',
      actions: 'actions.log.json',
      manifest: 'manifest.json',
    },
  };

  const capsuleJson = stableSerialize(capsule);
  zip.file('capsule.json', capsuleJson);

  // -------------------------------------------------------------------------
  // 5. Generate ZIP blob
  // -------------------------------------------------------------------------

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Import evidence capsule and verify integrity.
 */
export async function importEvidenceCapsule(
  blob: Blob
): Promise<{
  project: LabProjectV1;
  capsule: CapsuleIndex;
  integrity: import('@redbyte/rb-utils/labProjectSchema').IntegrityResult;
}> {
  const zip = await JSZip.loadAsync(blob);

  // Read capsule index
  const capsuleFile = zip.file('capsule.json');
  if (!capsuleFile) {
    throw new Error('Invalid evidence capsule: missing capsule.json');
  }

  const capsuleJson = await capsuleFile.async('string');
  const capsule: CapsuleIndex = JSON.parse(capsuleJson);

  // Read project
  const projectFile = zip.file(capsule.files.project);
  if (!projectFile) {
    throw new Error('Invalid evidence capsule: missing project.json');
  }

  const projectJson = await projectFile.async('string');
  const project: LabProjectV1 = JSON.parse(projectJson);

  // Verify integrity
  const actualProjectHash = await stableHash(project);
  const projectIntact = actualProjectHash === capsule.projectHash;

  // Read manifest
  const manifestFile = zip.file(capsule.files.manifest);
  const manifestJson = await manifestFile?.async('string');
  const manifest: EvidenceManifest | undefined = manifestJson ? JSON.parse(manifestJson) : undefined;

  const actualManifestHash = manifest ? await stableHash(manifest) : '';
  const manifestIntact = actualManifestHash === capsule.manifestHash;

  // Determine integrity status
  let integrity: import('@redbyte/rb-utils/labProjectSchema').IntegrityResult;
  if (projectIntact && manifestIntact) {
    integrity = {
      status: 'verified',
      message: '✅ Integrity verified — all hashes match',
    };
  } else if (!projectIntact) {
    integrity = {
      status: 'modified',
      message: '⚠ Project modified — hash mismatch detected',
      details: {
        expectedHash: capsule.projectHash,
        actualHash: actualProjectHash,
        modifiedFiles: ['project.json'],
      },
    };
  } else {
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

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}
