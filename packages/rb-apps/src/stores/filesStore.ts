// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '@redbyte/rb-logic-core';

type LogicFileKind = 'source' | 'artifact' | 'derived';
type LogicFileSchemaVersion = 'v1';

interface FileMetadataInput {
  kind: LogicFileKind;
  schema_version: LogicFileSchemaVersion;
  created_by: string;
  derived_from?: string | null;
}

export interface LogicFile {
  id: string;
  name: string;
  kind: LogicFileKind;
  schema_version: LogicFileSchemaVersion;
  created_at: string;
  updated_at: string;
  created_by: string;
  derived_from?: string | null;
  circuit: SerializedCircuitV1;
}

const STORAGE_KEY = 'rb:files:rblogic:v1';
const SEQ_KEY = 'rb:files:rblogic:seq:v1';
const FILE_ID_PREFIX = 'file-v2-';
const FILE_ID_RE = /^file-v2-\d+$/;
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';
const FILE_SCHEMA_VERSION: LogicFileSchemaVersion = 'v1';
let fallbackSeq = 1;

function getNextFileId(): string {
  if (typeof window === 'undefined') {
    const next = fallbackSeq;
    fallbackSeq += 1;
    return `${FILE_ID_PREFIX}${next}`;
  }

  try {
    const raw = localStorage.getItem(SEQ_KEY);
    const parsed = raw ? parseInt(raw, 10) : 1;
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    localStorage.setItem(SEQ_KEY, String(next + 1));
    return `${FILE_ID_PREFIX}${next}`;
  } catch {
    const next = fallbackSeq;
    fallbackSeq += 1;
    return `${FILE_ID_PREFIX}${next}`;
  }
}

function assertMetadata(
  metadata: FileMetadataInput,
  opts: { requireDerivedFrom: boolean }
): void {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('File metadata is required for write operations.');
  }
  if (metadata.schema_version !== FILE_SCHEMA_VERSION) {
    throw new Error(`Invalid schema_version: ${String(metadata.schema_version)}`);
  }
  if (metadata.kind !== 'source' && metadata.kind !== 'artifact' && metadata.kind !== 'derived') {
    throw new Error(`Invalid kind: ${String(metadata.kind)}`);
  }
  if (!metadata.created_by || metadata.created_by.trim() === '') {
    throw new Error('created_by is required for file writes.');
  }
  if (opts.requireDerivedFrom && !metadata.derived_from) {
    throw new Error('derived_from is required when overwriting file content.');
  }
}

function assertValidFile(file: LogicFile): void {
  if (!FILE_ID_RE.test(file.id)) {
    throw new Error(`Invalid file id: ${file.id}`);
  }
  if (file.schema_version !== FILE_SCHEMA_VERSION) {
    throw new Error(`Invalid schema_version: ${file.schema_version}`);
  }
  if (file.kind !== 'source' && file.kind !== 'artifact' && file.kind !== 'derived') {
    throw new Error(`Invalid kind: ${file.kind}`);
  }
  if (!file.created_by || file.created_by.trim() === '') {
    throw new Error('created_by is required for file entries.');
  }
}

function normalizeFile(raw: Partial<LogicFile> & Record<string, unknown>): LogicFile {
  const updatedAt =
    (raw.updated_at as string | undefined) ??
    (raw.updatedAt as string | undefined) ??
    FALLBACK_CREATED_AT;
  const createdAt =
    (raw.created_at as string | undefined) ??
    (raw.createdAt as string | undefined) ??
    updatedAt;

  const file: LogicFile = {
    id: (raw.id as string | undefined) ?? getNextFileId(),
    name: (raw.name as string | undefined) ?? 'Untitled',
    kind: ((raw.kind as LogicFileKind | undefined) ?? 'unknown') as LogicFileKind,
    schema_version:
      (raw.schema_version as LogicFileSchemaVersion | undefined) ??
      (raw.schemaVersion as LogicFileSchemaVersion | undefined) ??
      ('unknown' as LogicFileSchemaVersion),
    created_at: createdAt,
    updated_at: updatedAt,
    created_by:
      (raw.created_by as string | undefined) ??
      (raw.createdBy as string | undefined) ??
      '',
    derived_from:
      (raw.derived_from as string | null | undefined) ??
      (raw.derivedFrom as string | null | undefined) ??
      null,
    circuit:
      (raw.circuit as SerializedCircuitV1 | undefined) ??
      { version: 'v1', nodes: [], connections: [] },
  };

  assertValidFile(file);
  return file;
}

function loadFiles(): LogicFile[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data) as Partial<LogicFile>[];
    return parsed.map((entry) => normalizeFile(entry as Record<string, unknown>));
  } catch {
    return [];
  }
}

function saveFiles(files: LogicFile[]): void {
  files.forEach((file) => assertValidFile(file));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function listFiles(): LogicFile[] {
  return loadFiles();
}

export function createFile(
  name: string,
  circuit: SerializedCircuitV1,
  metadata: FileMetadataInput
): LogicFile {
  const files = loadFiles();
  assertMetadata(metadata, { requireDerivedFrom: false });
  const existing = files.find((file) => file.name === name);
  if (existing && !metadata.derived_from) {
    throw new Error('File overwrite requires derived_from metadata.');
  }
  const now = new Date().toISOString();
  const newFile: LogicFile = {
    id: getNextFileId(),
    name,
    kind: metadata.kind,
    schema_version: metadata.schema_version,
    created_at: now,
    updated_at: now,
    created_by: metadata.created_by,
    derived_from: metadata.derived_from ?? null,
    circuit,
  };
  const nextFiles = [...files, newFile];
  saveFiles(nextFiles);
  return newFile;
}

export function renameFile(id: string, newName: string): void {
  const files = loadFiles();
  const file = files.find((f) => f.id === id);
  if (file) {
    file.name = newName;
    file.updated_at = new Date().toISOString();
    saveFiles(files);
  }
}

export function deleteFile(id: string): void {
  const files = loadFiles();
  const filtered = files.filter((f) => f.id !== id);
  saveFiles(filtered);
}

export function getFile(id: string): LogicFile | null {
  const files = loadFiles();
  return files.find((f) => f.id === id) ?? null;
}

export function updateFile(
  id: string,
  circuit: SerializedCircuitV1,
  metadata: FileMetadataInput
): void {
  assertMetadata(metadata, { requireDerivedFrom: true });
  const files = loadFiles();
  const file = files.find((f) => f.id === id);
  if (file) {
    file.circuit = circuit;
    file.updated_at = new Date().toISOString();
    file.kind = metadata.kind;
    file.schema_version = metadata.schema_version;
    file.created_by = metadata.created_by;
    file.derived_from = metadata.derived_from ?? null;
    saveFiles(files);
  }
}
