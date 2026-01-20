// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '@redbyte/rb-logic-core';

type LogicFileKind = 'source' | 'artifact' | 'derived';

export interface LogicFile {
  id: string;
  name: string;
  kind: LogicFileKind;
  schemaVersion: 'v1';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  derivedFrom?: string | null;
  circuit: SerializedCircuitV1;
}

const STORAGE_KEY = 'rb:files:rblogic:v1';
const SEQ_KEY = 'rb:files:rblogic:seq:v1';
const FILE_ID_PREFIX = 'file-v2-';
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';
const DEFAULT_CREATED_BY = 'system';
const DEFAULT_KIND: LogicFileKind = 'source';
const FILE_SCHEMA_VERSION: LogicFile['schemaVersion'] = 'v1';
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

function normalizeFile(raw: Partial<LogicFile>): LogicFile {
  const updatedAt = raw.updatedAt ?? FALLBACK_CREATED_AT;
  const createdAt = raw.createdAt ?? updatedAt;

  return {
    id: raw.id ?? getNextFileId(),
    name: raw.name ?? 'Untitled',
    kind: raw.kind ?? DEFAULT_KIND,
    schemaVersion: raw.schemaVersion ?? FILE_SCHEMA_VERSION,
    createdAt,
    updatedAt,
    createdBy: raw.createdBy ?? DEFAULT_CREATED_BY,
    derivedFrom: raw.derivedFrom ?? null,
    circuit: raw.circuit ?? { version: 'v1', nodes: [], connections: [] },
  };
}

function loadFiles(): LogicFile[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data) as Partial<LogicFile>[];
    return parsed.map((entry) => normalizeFile(entry));
  } catch {
    return [];
  }
}

function saveFiles(files: LogicFile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function listFiles(): LogicFile[] {
  return loadFiles();
}

export function createFile(name: string, circuit: SerializedCircuitV1): LogicFile {
  const files = loadFiles();
  const now = new Date().toISOString();
  const newFile: LogicFile = {
    id: getNextFileId(),
    name,
    kind: DEFAULT_KIND,
    schemaVersion: FILE_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    createdBy: DEFAULT_CREATED_BY,
    derivedFrom: null,
    circuit,
  };
  files.push(newFile);
  saveFiles(files);
  return newFile;
}

export function renameFile(id: string, newName: string): void {
  const files = loadFiles();
  const file = files.find((f) => f.id === id);
  if (file) {
    file.name = newName;
    file.updatedAt = new Date().toISOString();
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

export function updateFile(id: string, circuit: SerializedCircuitV1): void {
  const files = loadFiles();
  const file = files.find((f) => f.id === id);
  if (file) {
    file.circuit = circuit;
    file.updatedAt = new Date().toISOString();
    saveFiles(files);
  }
}
