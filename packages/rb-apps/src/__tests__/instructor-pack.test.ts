import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import { LAB_STARTER_KITS } from '../starterKits/labStarterKits';
import {
  createInstructorPack,
  createInstructorProjectArchiveBytes,
  INSTRUCTOR_PACK_STORAGE_KEY,
  loadImportedStarterPacks,
  parseInstructorPack,
  removeImportedStarterPack,
  upsertImportedStarterPack,
} from '../starterKits/instructorPack';
import { createRBProject } from '../export/projectFormat';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

describe('instructor pack export/import', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates deterministic pack bytes for same starter payload', async () => {
    const starter = LAB_STARTER_KITS[0];
    const projectArchiveBytes = await createInstructorProjectArchiveBytes(
      createRBProject({
        createdAt: '2026-02-12T00:00:00.000Z',
        name: 'Starter Fixture',
        circuit: { nodes: [], connections: [] },
      }),
    );

    const first = await createInstructorPack({
      starter,
      projectArchiveBytes,
    });
    const second = await createInstructorPack({
      starter,
      projectArchiveBytes,
    });

    expect(first.packId).toBe(second.packId);
    expect(first.filename).toBe(second.filename);
    expect(Array.from(first.bytes)).toEqual(Array.from(second.bytes));

    const zip = await JSZip.loadAsync(first.bytes);
    expect(zip.file('pack_manifest.json')).toBeTruthy();
    expect(zip.file('labStarterKit.json')).toBeTruthy();
    expect(zip.file('starter_project.rbx.zip')).toBeTruthy();
    expect(zip.file('README.txt')).toBeTruthy();
  });

  it('parses instructor pack and persists imported records', async () => {
    const starter = LAB_STARTER_KITS[0];
    const projectArchiveBytes = await createInstructorProjectArchiveBytes(
      createRBProject({
        createdAt: '2026-02-12T00:00:00.000Z',
        name: 'Starter Fixture 2',
        circuit: { nodes: [], connections: [] },
      }),
    );
    const bundle = await createInstructorPack({
      starter,
      projectArchiveBytes,
      rubric: {
        schema_version: 'rb_instructor_rubric_v1',
        rubric: starter.instructions.rubric,
      },
    });

    const parsed = await parseInstructorPack(bundle.bytes);
    expect(parsed.packId).toBe(bundle.packId);
    expect(parsed.starter.id).toBe(starter.id);
    expect(parsed.projectArchiveBase64).toBe(bytesToBase64(projectArchiveBytes));
    expect(parsed.contentHash.length).toBeGreaterThan(0);

    upsertImportedStarterPack(parsed);
    expect(localStorage.getItem(INSTRUCTOR_PACK_STORAGE_KEY)).toBeTruthy();
    expect(loadImportedStarterPacks().map((entry) => entry.packId)).toContain(bundle.packId);

    const afterRemove = removeImportedStarterPack(bundle.packId);
    expect(afterRemove.find((entry) => entry.packId === bundle.packId)).toBeUndefined();
  });

  it('fails import when a manifest-tracked file hash is invalid', async () => {
    const starter = LAB_STARTER_KITS[0];
    const projectArchiveBytes = await createInstructorProjectArchiveBytes(
      createRBProject({
        createdAt: '2026-02-12T00:00:00.000Z',
        name: 'Starter Fixture 3',
        circuit: { nodes: [], connections: [] },
      }),
    );
    const bundle = await createInstructorPack({
      starter,
      projectArchiveBytes,
    });

    const tamperedZip = await JSZip.loadAsync(bundle.bytes);
    tamperedZip.file('labStarterKit.json', '{"tampered":true}');
    const tamperedBytes = await tamperedZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
      platform: 'DOS',
    });

    await expect(parseInstructorPack(tamperedBytes)).rejects.toThrow(/hash verification failed/i);
  });
});
