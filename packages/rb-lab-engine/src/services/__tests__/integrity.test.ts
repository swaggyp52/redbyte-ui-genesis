// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Evidence Integrity Tests — H1 + H2 Validation
 *
 * Proves:
 * - Export produces capsule with SHA256 manifest
 * - Import verifies integrity correctly
 * - Tampering is detected
 * - Serialization is deterministic
 */

import { describe, it, expect } from 'vitest';
import { exportEvidenceCapsule, importEvidenceCapsule } from '../exportService';
import type { LabProjectV1 } from '@redbyte/rb-utils/labProjectSchema';

// Minimal valid project fixture
const createTestProject = (): LabProjectV1 => ({
  schemaVersion: '1.0',
  projectId: 'test-project-integrity',
  name: 'Integrity Test Project',
  description: 'Test project for evidence integrity validation',
  createdAt: '2025-01-31T00:00:00.000Z',
  updatedAt: '2025-01-31T00:00:00.000Z',
  circuit: {
    schemaVersion: '1.0',
    nodes: [
      { id: 'n1', type: 'SWITCH', x: 100, y: 100, label: 'A' },
      { id: 'n2', type: 'LED', x: 300, y: 100, label: 'Y' },
    ],
    connections: [
      { id: 'c1', from: 'n1', fromPort: 'out', to: 'n2', toPort: 'in' },
    ],
  },
  simulation: {
    tickRate: 20,
    currentTick: 0,
    probes: [],
  },
  evidence: {
    actions: [
      {
        v: 1,
        t: 'circuit/addNode',
        p: { nodeId: 'n1', componentType: 'SWITCH', x: 100, y: 100 },
        meta: { timestamp: '2025-01-31T00:00:00.000Z', sessionId: 'test-session' },
      },
    ],
    snapshots: [],
  },
});

describe('Evidence Integrity System (H1)', () => {
  it('exports capsule with cryptographic manifest', async () => {
    const project = createTestProject();
    const blob = await exportEvidenceCapsule(project);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);

    // Debug: list all files in ZIP
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const files = Object.keys(zip.files);
    console.log('Files in ZIP:', files);
    expect(files).toContain('project.json');
    expect(files).toContain('capsule.json');
    expect(files).toContain('manifest.json');
  });

  it('imports unmodified capsule with verified status', async () => {
    const project = createTestProject();
    const blob = await exportEvidenceCapsule(project);

    // Debug: check capsule structure
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const capsuleJson = await zip.file('capsule.json')?.async('string');
    console.log('Capsule contents:', capsuleJson);

    const { integrity, project: importedProject } = await importEvidenceCapsule(blob);

    expect(integrity.status).toBe('verified');
    expect(integrity.message).toContain('Integrity verified');
    expect(importedProject.projectId).toBe(project.projectId);
  });

  it('detects modified project.json', async () => {
    const project = createTestProject();
    const blob = await exportEvidenceCapsule(project);

    // Tamper with the blob by modifying project.json
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);

    const projectJson = await zip.file('project.json')?.async('string');
    if (!projectJson) throw new Error('project.json not found');

    const tamperedProject = JSON.parse(projectJson);
    tamperedProject.name = 'TAMPERED NAME';

    zip.file('project.json', JSON.stringify(tamperedProject, null, 2));

    const tamperedBlob = await zip.generateAsync({ type: 'blob' });

    const { integrity } = await importEvidenceCapsule(tamperedBlob);

    expect(integrity.status).toBe('modified');
    expect(integrity.message).toContain('modified');
    expect(integrity.details?.modifiedFiles).toContain('project.json');
  });

  it('capsule includes build version stamp', async () => {
    const project = createTestProject();
    const blob = await exportEvidenceCapsule(project);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);

    const capsuleJson = await zip.file('capsule.json')?.async('string');
    if (!capsuleJson) throw new Error('capsule.json not found');

    const capsule = JSON.parse(capsuleJson);

    expect(capsule.buildSHA).toBeDefined();
    expect(capsule.buildDate).toBeDefined();
    expect(capsule.schemaVersion).toBe('1.0');
  });

  it('manifest includes SHA256 hashes for all files', async () => {
    const project = createTestProject();
    const blob = await exportEvidenceCapsule(project);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);

    const manifestJson = await zip.file('manifest.json')?.async('string');
    if (!manifestJson) throw new Error('manifest.json not found');

    const manifest = JSON.parse(manifestJson);

    expect(manifest.files).toBeInstanceOf(Array);
    expect(manifest.files.length).toBeGreaterThan(0);

    for (const file of manifest.files) {
      expect(file.path).toBeDefined();
      expect(file.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(file.size).toBeGreaterThan(0);
    }

    expect(manifest.rootHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe('Deterministic Serialization (H2)', () => {
  it('produces identical hash for same project', async () => {
    const project = createTestProject();

    const blob1 = await exportEvidenceCapsule(project);
    const blob2 = await exportEvidenceCapsule(project);

    const { capsule: capsule1 } = await importEvidenceCapsule(blob1);
    const { capsule: capsule2 } = await importEvidenceCapsule(blob2);

    // Same project should produce same hashes
    expect(capsule1.projectHash).toBe(capsule2.projectHash);
    expect(capsule1.actionLogHash).toBe(capsule2.actionLogHash);
  });

  it('serialization is order-independent for object keys', async () => {
    // Create two projects with same data but different key order
    const project1 = createTestProject();
    const project2 = {
      projectId: project1.projectId,
      schemaVersion: project1.schemaVersion,
      name: project1.name,
      description: project1.description,
      createdAt: project1.createdAt,
      updatedAt: project1.updatedAt,
      circuit: project1.circuit,
      simulation: project1.simulation,
      evidence: project1.evidence,
    } as LabProjectV1;

    const blob1 = await exportEvidenceCapsule(project1);
    const blob2 = await exportEvidenceCapsule(project2);

    const { capsule: capsule1 } = await importEvidenceCapsule(blob1);
    const { capsule: capsule2 } = await importEvidenceCapsule(blob2);

    // Should produce identical hashes despite different key order
    expect(capsule1.projectHash).toBe(capsule2.projectHash);
  });

  it('changing data produces different hash', async () => {
    const project1 = createTestProject();
    const project2 = {
      ...createTestProject(),
      name: 'Different Name',
    };

    const blob1 = await exportEvidenceCapsule(project1);
    const blob2 = await exportEvidenceCapsule(project2);

    const { capsule: capsule1 } = await importEvidenceCapsule(blob1);
    const { capsule: capsule2 } = await importEvidenceCapsule(blob2);

    // Different data should produce different hashes
    expect(capsule1.projectHash).not.toBe(capsule2.projectHash);
  });
});
