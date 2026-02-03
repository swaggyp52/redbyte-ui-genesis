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
import type {
  LabProjectV1,
  CapsuleIndex,
  EvidenceManifest,
  EvidenceFileEntry,
  IntegrityResult,
} from '@redbyte/rb-utils';
import { generateReadme } from './readmeGenerator';

// Get build version from environment or fallback
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA ?? 'dev';
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE ?? new Date().toISOString();

interface ExportWarning {
  step: string;
  message: string;
  error?: string;
}

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
  const safeProjectFallback: LabProjectV1 = {
    schemaVersion: '1.0',
    projectId: (project as any)?.projectId ?? `export-fallback-${Date.now()}`,
    name: (project as any)?.name ?? 'Recovered Project',
    description: (project as any)?.description ?? '',
    createdAt: (project as any)?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    circuit: (project as any)?.circuit ?? { schemaVersion: '1.0', nodes: [], connections: [] },
    simulation: (project as any)?.simulation ?? { tickRate: 20, currentTick: 0, probes: [] },
    labSpec: (project as any)?.labSpec ?? null,
    evidence: (project as any)?.evidence ?? { actions: [], snapshots: [] },
  };

  try {
    const zip = new JSZip();
    const files = new Map<string, string>();
    const warnings: ExportWarning[] = [];

    const pushWarning = (step: string, message: string, error?: unknown) => {
      warnings.push({
        step,
        message,
        error: error instanceof Error ? error.message : error ? String(error) : undefined,
      });
    };

    const safeSerialize = (value: unknown, step: string, fallback: unknown): string => {
      try {
        return stableSerialize(value);
      } catch (error) {
        pushWarning(step, 'Serialization failed; using fallback payload.', error);
        return stableSerialize(fallback);
      }
    };

    const safeHash = async (value: unknown, step: string): Promise<string> => {
      try {
        return await stableHash(value);
      } catch (error) {
        pushWarning(step, 'Hashing failed; using placeholder hash.', error);
        return 'sha256:ERROR';
      }
    };

    // -------------------------------------------------------------------------
    // 1. Serialize project.json
    // -------------------------------------------------------------------------

  const projectJson = safeSerialize(project, 'project', safeProjectFallback);
  const projectHash = await safeHash(project, 'project-hash');
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
  const actionsJson = safeSerialize(actionsLog, 'actions', actionsLog);
  const actionsHash = await safeHash(actionsLog, 'actions-hash');
  files.set('actions.log.json', actionsJson);
  zip.file('actions.log.json', actionsJson);

  // -------------------------------------------------------------------------
  // 2.5. Generate README.md (auto-generated human-readable summary)
  // -------------------------------------------------------------------------

  try {
    const readme = generateReadme(project);
    zip.file('README.md', readme);
  } catch (error) {
    pushWarning('readme', 'README generation failed; using fallback.', error);
    zip.file('README.md', '# RedByte Export\n\nREADME generation failed. See warnings.json for details.');
  }

  // -------------------------------------------------------------------------
  // 2.7. Add FPGA artifacts if available (verilog/ and bitstream/)
  // -------------------------------------------------------------------------

  const fpgaArtifacts = (project as any).fpgaArtifacts;
  if (fpgaArtifacts) {
    // Add Verilog source
    if (fpgaArtifacts.verilog) {
      zip.file('verilog/design.v', fpgaArtifacts.verilog);
      files.set('verilog/design.v', fpgaArtifacts.verilog);
    }

    // Add XDC constraints
    if (fpgaArtifacts.constraints) {
      zip.file('verilog/constraints.xdc', fpgaArtifacts.constraints);
      files.set('verilog/constraints.xdc', fpgaArtifacts.constraints);
    }

    // Add bitstream if available
    if (fpgaArtifacts.bitstream) {
      // Bitstream is binary - handle as Uint8Array or Blob
      if (fpgaArtifacts.bitstream instanceof Uint8Array) {
        zip.file('bitstream/design.bit', fpgaArtifacts.bitstream);
      } else if (typeof fpgaArtifacts.bitstream === 'string') {
        // If stored as base64 string
        zip.file('bitstream/design.bit', fpgaArtifacts.bitstream, { base64: true });
      }
    }

    // Add provenance metadata
    if (fpgaArtifacts.metadata) {
      const metadataJson = stableSerialize(fpgaArtifacts.metadata);
      zip.file('fpga/provenance.json', metadataJson);
      files.set('fpga/provenance.json', metadataJson);
    }
  }

  // -------------------------------------------------------------------------
  // 2.9. Add warnings.json if needed
  // -------------------------------------------------------------------------

  if (warnings.length > 0) {
    const warningsPayload = {
      schemaVersion: '1.0',
      createdAt: new Date().toISOString(),
      warnings,
    };
    const warningsJson = stableSerialize(warningsPayload);
    zip.file('warnings.json', warningsJson);
    files.set('warnings.json', warningsJson);
  }

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
    rootHash: await safeHash(fileEntries.map((f) => f.hash).join(''), 'manifest-root-hash'),
  };

  const manifestJson = safeSerialize(manifest, 'manifest', manifest);
  const manifestHash = await safeHash(manifest, 'manifest-hash');
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

  const capsuleJson = safeSerialize(capsule, 'capsule', capsule);
  zip.file('capsule.json', capsuleJson);

  // -------------------------------------------------------------------------
  // 5. Generate ZIP blob
  // -------------------------------------------------------------------------

    return zip.generateAsync({ type: 'blob' });
  } catch (error) {
    const fallbackZip = new JSZip();
    const warningPayload = {
      schemaVersion: '1.0',
      createdAt: new Date().toISOString(),
      warnings: [{
        step: 'export',
        message: 'Export failed; generated recovery bundle instead.',
        error: error instanceof Error ? error.message : String(error),
      }],
    };
    fallbackZip.file('project.json', stableSerialize(safeProjectFallback));
    fallbackZip.file('warnings.json', JSON.stringify(warningPayload, null, 2));
    fallbackZip.file('README.md', '# RedByte Export\n\nExport failed and produced a recovery bundle. See warnings.json for details.');
    return fallbackZip.generateAsync({ type: 'blob' });
  }
}

/**
 * Import evidence capsule and verify integrity.
 */
export async function importEvidenceCapsule(
  blob: Blob
): Promise<{
  project: LabProjectV1;
  capsule: CapsuleIndex;
  integrity: IntegrityResult;
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
  let integrity: IntegrityResult;
  if (projectIntact && manifestIntact) {
    integrity = {
      status: 'verified',
      message: 'Integrity verified - all hashes match',
    };
  } else if (!projectIntact) {
    integrity = {
      status: 'modified',
      message: 'Integrity warning: project modified (hash mismatch detected)',
      details: {
        expectedHash: capsule.projectHash,
        actualHash: actualProjectHash,
        modifiedFiles: ['project.json'],
      },
    };
  } else {
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

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}
