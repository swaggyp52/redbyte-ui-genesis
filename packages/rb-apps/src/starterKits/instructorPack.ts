import JSZip from 'jszip';
import { serialize } from '@redbyte/rb-logic-core';
import { stableHash } from '../utils/stableSerialize';
import { stableStringify } from '../export/stableStringify';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import type { LabStarterKit, LabStarterInstructions } from './labStarterKits';

const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00.000Z');
const INSTRUCTOR_PACK_SCHEMA_VERSION = 'rb_instructor_pack_v1' as const;
const INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION = 'rb_instructor_pack_manifest_v1' as const;
const INSTRUCTOR_PACK_LEGACY_STORAGE_KEY = 'rb:starter-packs:v1' as const;
export const INSTRUCTOR_PACK_STORAGE_KEY = 'rb:instructor-packs:v1' as const;
const PACK_MANIFEST_PATH = 'pack_manifest.json' as const;
const STARTER_PROJECT_PATH = 'starter_project.rbx.zip' as const;
const STARTER_METADATA_PATH = 'labStarterKit.json' as const;
const RUBRIC_PATH = 'rubric.json' as const;
const README_PATH = 'README.txt' as const;

interface InstructorPackFileManifestEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
}

interface InstructorPackManifest {
  schema_version: typeof INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION;
  packSchemaVersion: typeof INSTRUCTOR_PACK_SCHEMA_VERSION;
  packId: string;
  contentHash: string;
  labId: string;
  starterId: string;
  title: string;
  targetApp: 'logic-playground' | 'ece-lab';
  includedFiles: InstructorPackFileManifestEntry[];
}

interface InstructorPackMetadata {
  schema_version: typeof INSTRUCTOR_PACK_SCHEMA_VERSION;
  starter: {
    id: string;
    labId: string;
    title: string;
    timeEstimate: string;
    learningGoal: string;
    whatToDo: string;
    targetApp: 'logic-playground' | 'ece-lab';
    exampleId?: string;
    instructions: LabStarterInstructions;
  };
}

export interface InstructorPackExportInput {
  starter: LabStarterKit;
  projectArchiveBytes: Uint8Array;
  rubric?: unknown;
}

export interface InstructorPackExportResult {
  filename: string;
  bytes: Uint8Array;
  packId: string;
}

export interface ImportedStarterPackRecord {
  packId: string;
  contentHash: string;
  importedAtMs: number;
  starter: LabStarterKit;
  projectArchiveBase64: string;
  manifestSummary: {
    schemaVersion: typeof INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION;
    labId: string;
    starterId: string;
    title: string;
    targetApp: 'logic-playground' | 'ece-lab';
  };
  rubric?: unknown;
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }
  return stableHash(Array.from(bytes));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function sanitizeFilenameToken(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'lab';
}

function getInstructorPackReadme(starter: LabStarterKit): string {
  return [
    'RedByte Instructor Pack',
    '',
    `Lab: ${starter.labId} - ${starter.title}`,
    '',
    'Student steps:',
    '1) Open RedByte Home.',
    '2) Click "Import Instructor Pack" and select this ZIP.',
    '3) Open the imported starter card and follow the pinned instructions.',
    '4) Generate Submission Bundle and upload rb-submission-<id>.zip.',
    '',
    'This pack is integrity-checked by pack_manifest.json.',
  ].join('\n');
}

function buildContentHashSeed(entries: InstructorPackFileManifestEntry[]): Array<{
  path: string;
  sha256: string;
  sizeBytes: number;
}> {
  return entries
    .map((entry) => ({
      path: entry.path,
      sha256: entry.sha256,
      sizeBytes: entry.sizeBytes,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function computeContentHash(entries: InstructorPackFileManifestEntry[]): Promise<string> {
  return stableHash({
    schema_version: INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION,
    files: buildContentHashSeed(entries),
  });
}

function normalizeStarterFromMetadata(metadata: InstructorPackMetadata): LabStarterKit {
  const starter = metadata.starter;
  const exampleId = typeof starter.exampleId === 'string' && starter.exampleId.trim().length > 0
    ? starter.exampleId.trim()
    : undefined;
  return {
    id: starter.id,
    labId: starter.labId,
    title: starter.title,
    timeEstimate: starter.timeEstimate,
    learningGoal: starter.learningGoal,
    whatToDo: starter.whatToDo,
    targetApp: starter.targetApp,
    ...(exampleId ? { exampleId: exampleId as LabStarterKit['exampleId'] } : {}),
    instructions: starter.instructions,
  };
}

function normalizeImportedRecords(raw: unknown): ImportedStarterPackRecord[] {
  if (!Array.isArray(raw)) return [];
  const records: ImportedStarterPackRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<ImportedStarterPackRecord>;
    if (typeof candidate.packId !== 'string' || candidate.packId.trim().length === 0) continue;
    if (typeof candidate.projectArchiveBase64 !== 'string' || candidate.projectArchiveBase64.trim().length === 0) continue;
    const contentHash =
      typeof candidate.contentHash === 'string' && candidate.contentHash.trim().length > 0
        ? candidate.contentHash.trim()
        : candidate.packId.trim();
    if (!candidate.starter || typeof candidate.starter !== 'object') continue;
    const starter = candidate.starter as Partial<LabStarterKit>;
    if (
      typeof starter.id !== 'string' ||
      typeof starter.labId !== 'string' ||
      typeof starter.title !== 'string' ||
      typeof starter.timeEstimate !== 'string' ||
      typeof starter.learningGoal !== 'string' ||
      typeof starter.whatToDo !== 'string' ||
      (starter.targetApp !== 'logic-playground' && starter.targetApp !== 'ece-lab') ||
      !starter.instructions ||
      typeof starter.instructions !== 'object'
    ) {
      continue;
    }

    const instructions = starter.instructions as Partial<LabStarterInstructions>;
    if (
      typeof instructions.labId !== 'string' ||
      typeof instructions.title !== 'string' ||
      typeof instructions.timeEstimate !== 'string' ||
      typeof instructions.learningGoal !== 'string' ||
      !Array.isArray(instructions.steps) ||
      !Array.isArray(instructions.commonMistakes) ||
      !Array.isArray(instructions.submit) ||
      !Array.isArray(instructions.rubric)
    ) {
      continue;
    }

    records.push({
      packId: candidate.packId.trim(),
      contentHash,
      importedAtMs: typeof candidate.importedAtMs === 'number' ? candidate.importedAtMs : Date.now(),
      starter: {
        id: starter.id.trim(),
        labId: starter.labId.trim(),
        title: starter.title.trim(),
        timeEstimate: starter.timeEstimate.trim(),
        learningGoal: starter.learningGoal.trim(),
        whatToDo: starter.whatToDo.trim(),
        targetApp: starter.targetApp,
        ...(typeof starter.exampleId === 'string' && starter.exampleId.trim().length > 0
          ? { exampleId: starter.exampleId.trim() as LabStarterKit['exampleId'] }
          : {}),
        instructions: {
          labId: instructions.labId.trim(),
          title: instructions.title.trim(),
          timeEstimate: instructions.timeEstimate.trim(),
          learningGoal: instructions.learningGoal.trim(),
          steps: instructions.steps.filter((value): value is string => typeof value === 'string'),
          commonMistakes: instructions.commonMistakes.filter((value): value is string => typeof value === 'string'),
          submit: instructions.submit.filter((value): value is string => typeof value === 'string'),
          rubric: instructions.rubric.filter((value): value is string => typeof value === 'string'),
        },
      },
      projectArchiveBase64: candidate.projectArchiveBase64.trim(),
      manifestSummary: {
        schemaVersion: INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION,
        labId: starter.labId.trim(),
        starterId: starter.id.trim(),
        title: starter.title.trim(),
        targetApp: starter.targetApp,
      },
      ...(candidate.rubric !== undefined ? { rubric: candidate.rubric } : {}),
    });
  }
  return records.sort((left, right) => right.importedAtMs - left.importedAtMs);
}

export function loadImportedStarterPacks(): ImportedStarterPackRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const rawCurrent = window.localStorage.getItem(INSTRUCTOR_PACK_STORAGE_KEY);
    if (rawCurrent) return normalizeImportedRecords(JSON.parse(rawCurrent));
    const rawLegacy = window.localStorage.getItem(INSTRUCTOR_PACK_LEGACY_STORAGE_KEY);
    if (!rawLegacy) return [];
    const migrated = normalizeImportedRecords(JSON.parse(rawLegacy));
    if (migrated.length > 0) {
      window.localStorage.setItem(INSTRUCTOR_PACK_STORAGE_KEY, stableStringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
}

export function saveImportedStarterPacks(records: ImportedStarterPackRecord[]): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeImportedRecords(records)
    .slice(0, 24)
    .sort((left, right) => right.importedAtMs - left.importedAtMs);
  window.localStorage.setItem(INSTRUCTOR_PACK_STORAGE_KEY, stableStringify(normalized));
}

export function upsertImportedStarterPack(record: ImportedStarterPackRecord): ImportedStarterPackRecord[] {
  const existing = loadImportedStarterPacks().filter((entry) => entry.packId !== record.packId);
  const merged = [record, ...existing]
    .sort((left, right) => right.importedAtMs - left.importedAtMs)
    .slice(0, 24);
  saveImportedStarterPacks(merged);
  return merged;
}

export function removeImportedStarterPack(packId: string): ImportedStarterPackRecord[] {
  const next = loadImportedStarterPacks().filter((entry) => entry.packId !== packId);
  saveImportedStarterPacks(next);
  return next;
}

export async function createInstructorProjectArchiveBytes(project: RBProject): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('rb-project.json', encodeRBProject(project), { date: ZIP_ENTRY_DATE });
  zip.file('circuit.rblogic', JSON.stringify(serialize(project.circuit), null, 2), { date: ZIP_ENTRY_DATE });
  zip.file(
    README_PATH,
    'RedByte project archive. Import this file through canonical project import in RedByte.',
    { date: ZIP_ENTRY_DATE },
  );
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'DOS',
  });
}

export async function createInstructorPack(input: InstructorPackExportInput): Promise<InstructorPackExportResult> {
  const projectArchiveBlob = new Blob([input.projectArchiveBytes], { type: 'application/zip' });

  const starterMetadata: InstructorPackMetadata = {
    schema_version: INSTRUCTOR_PACK_SCHEMA_VERSION,
    starter: {
      id: input.starter.id,
      labId: input.starter.labId,
      title: input.starter.title,
      timeEstimate: input.starter.timeEstimate,
      learningGoal: input.starter.learningGoal,
      whatToDo: input.starter.whatToDo,
      targetApp: input.starter.targetApp,
      ...(input.starter.exampleId ? { exampleId: input.starter.exampleId } : {}),
      instructions: input.starter.instructions,
    },
  };
  const starterMetadataText = stableStringify(starterMetadata);
  const starterMetadataBytes = textBytes(starterMetadataText);
  const rubricText = input.rubric === undefined ? null : stableStringify(input.rubric);
  const rubricBytes = rubricText ? textBytes(rubricText) : null;
  const readmeText = getInstructorPackReadme(input.starter);
  const readmeBytes = textBytes(readmeText);

  const includedFiles: InstructorPackFileManifestEntry[] = [];
  includedFiles.push({
    path: STARTER_METADATA_PATH,
    sha256: await sha256Bytes(starterMetadataBytes),
    sizeBytes: starterMetadataBytes.byteLength,
  });
  includedFiles.push({
    path: STARTER_PROJECT_PATH,
    sha256: await sha256Bytes(input.projectArchiveBytes),
    sizeBytes: input.projectArchiveBytes.byteLength,
  });
  includedFiles.push({
    path: README_PATH,
    sha256: await sha256Bytes(readmeBytes),
    sizeBytes: readmeBytes.byteLength,
  });
  if (rubricBytes) {
    includedFiles.push({
      path: RUBRIC_PATH,
      sha256: await sha256Bytes(rubricBytes),
      sizeBytes: rubricBytes.byteLength,
    });
  }
  includedFiles.sort((left, right) => left.path.localeCompare(right.path));
  const contentHash = await computeContentHash(includedFiles);
  const packId = await stableHash({
    schema: INSTRUCTOR_PACK_SCHEMA_VERSION,
    labId: input.starter.labId,
    starterId: input.starter.id,
    contentHash,
  });

  const manifest: InstructorPackManifest = {
    schema_version: INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION,
    packSchemaVersion: INSTRUCTOR_PACK_SCHEMA_VERSION,
    packId,
    contentHash,
    labId: input.starter.labId,
    starterId: input.starter.id,
    title: input.starter.title,
    targetApp: input.starter.targetApp,
    includedFiles,
  };
  const manifestText = stableStringify(manifest);

  const zip = new JSZip();
  zip.file(PACK_MANIFEST_PATH, manifestText, { date: ZIP_ENTRY_DATE });
  zip.file(STARTER_METADATA_PATH, starterMetadataText, { date: ZIP_ENTRY_DATE });
  zip.file(STARTER_PROJECT_PATH, projectArchiveBlob, { date: ZIP_ENTRY_DATE });
  zip.file(README_PATH, readmeText, { date: ZIP_ENTRY_DATE });
  if (rubricText) {
    zip.file(RUBRIC_PATH, rubricText, { date: ZIP_ENTRY_DATE });
  }

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'DOS',
  });
  return {
    filename: `instructor-pack-${sanitizeFilenameToken(input.starter.labId)}-${contentHash}.zip`,
    bytes,
    packId,
  };
}

export async function parseInstructorPack(
  bytes: Uint8Array | ArrayBuffer | Blob,
): Promise<ImportedStarterPackRecord> {
  const sourceBytes = bytes instanceof Uint8Array
    ? bytes
    : bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : new Uint8Array(await bytes.arrayBuffer());

  const zip = await JSZip.loadAsync(sourceBytes);
  const manifestEntry = zip.file(PACK_MANIFEST_PATH) ?? zip.file('manifest.json');
  if (!manifestEntry) {
    throw new Error('Invalid instructor pack: pack_manifest.json is missing.');
  }
  const manifest = JSON.parse(await manifestEntry.async('text')) as Partial<InstructorPackManifest>;
  if (manifest.schema_version !== INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION) {
    throw new Error('Invalid instructor pack: unsupported manifest schema.');
  }

  const metadataEntry = zip.file(STARTER_METADATA_PATH);
  const projectEntry = zip.file(STARTER_PROJECT_PATH) ?? zip.file('starter.rbx.zip');
  if (!metadataEntry || !projectEntry) {
    throw new Error('Invalid instructor pack: missing starter payload files.');
  }

  const declaredFiles = Array.isArray(manifest.includedFiles)
    ? manifest.includedFiles
    : [];
  for (const declared of declaredFiles) {
    const path = typeof declared.path === 'string' ? declared.path.trim() : '';
    const expectedHash = typeof declared.sha256 === 'string' ? declared.sha256.trim() : '';
    if (!path || !expectedHash) {
      throw new Error('Invalid instructor pack: malformed file manifest entry.');
    }
    const file = zip.file(path);
    if (!file) {
      throw new Error(`Invalid instructor pack: missing manifest file "${path}".`);
    }
    const fileBytes = await file.async('uint8array');
    const actualHash = await sha256Bytes(fileBytes);
    if (actualHash !== expectedHash) {
      throw new Error(`Instructor pack hash verification failed for "${path}".`);
    }
  }

  const recomputedContentHash = await computeContentHash(
    declaredFiles
      .map((entry) => ({
        path: String(entry.path ?? ''),
        sha256: String(entry.sha256 ?? ''),
        sizeBytes: typeof entry.sizeBytes === 'number' ? entry.sizeBytes : 0,
      }))
      .filter((entry) => entry.path.length > 0 && entry.sha256.length > 0),
  );
  if (typeof manifest.contentHash === 'string' && manifest.contentHash.trim().length > 0) {
    if (manifest.contentHash.trim() !== recomputedContentHash) {
      throw new Error('Instructor pack content hash verification failed.');
    }
  }

  const metadataText = await metadataEntry.async('text');
  const metadata = JSON.parse(metadataText) as Partial<InstructorPackMetadata>;
  if (metadata.schema_version !== INSTRUCTOR_PACK_SCHEMA_VERSION || !metadata.starter) {
    throw new Error('Invalid instructor pack metadata schema.');
  }

  const projectBytes = await projectEntry.async('uint8array');
  const starter = normalizeStarterFromMetadata(metadata as InstructorPackMetadata);
  const rubricEntry = zip.file(RUBRIC_PATH);
  const rubric = rubricEntry ? JSON.parse(await rubricEntry.async('text')) as unknown : undefined;

  const fallbackPackId = await stableHash({
    schema: INSTRUCTOR_PACK_SCHEMA_VERSION,
    starterId: starter.id,
    targetApp: starter.targetApp,
    projectSha: await sha256Bytes(projectBytes),
    starterHash: await stableHash(starter),
  });

  const packId = manifest && typeof manifest.packId === 'string' && manifest.packId.trim().length > 0
    ? manifest.packId.trim()
    : fallbackPackId;
  const contentHash = manifest && typeof manifest.contentHash === 'string' && manifest.contentHash.trim().length > 0
    ? manifest.contentHash.trim()
    : recomputedContentHash;

  return {
    packId,
    contentHash,
    importedAtMs: Date.now(),
    starter,
    projectArchiveBase64: bytesToBase64(projectBytes),
    manifestSummary: {
      schemaVersion: INSTRUCTOR_PACK_MANIFEST_SCHEMA_VERSION,
      labId: typeof manifest.labId === 'string' && manifest.labId.trim().length > 0 ? manifest.labId.trim() : starter.labId,
      starterId: typeof manifest.starterId === 'string' && manifest.starterId.trim().length > 0 ? manifest.starterId.trim() : starter.id,
      title: typeof manifest.title === 'string' && manifest.title.trim().length > 0 ? manifest.title.trim() : starter.title,
      targetApp:
        manifest.targetApp === 'logic-playground' || manifest.targetApp === 'ece-lab'
          ? manifest.targetApp
          : starter.targetApp,
    },
    ...(rubric !== undefined ? { rubric } : {}),
  };
}

export function downloadInstructorPack(bundle: InstructorPackExportResult): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([bundle.bytes], { type: 'application/zip' }));
  link.download = bundle.filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function decodeInstructorPackProjectBase64(base64: string): Uint8Array {
  return base64ToBytes(base64);
}

export async function decodeInstructorProjectArchive(
  value: Uint8Array | ArrayBuffer | Blob,
): Promise<RBProject> {
  const sourceBytes = value instanceof Uint8Array
    ? value
    : value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(await value.arrayBuffer());
  const zip = await JSZip.loadAsync(sourceBytes);
  const projectEntry = zip.file('rb-project.json');
  if (!projectEntry) {
    throw new Error('Invalid starter_project.rbx.zip: rb-project.json is missing.');
  }
  return decodeRBProject(await projectEntry.async('text'));
}
