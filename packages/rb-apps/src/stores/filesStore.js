// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { recordAuditTransition } from '../utils/audit';
const STORAGE_KEY = 'rb:files:rblogic:v1';
const SEQ_KEY = 'rb:files:rblogic:seq:v1';
const FILE_ID_PREFIX = 'file-v2-';
const FILE_ID_RE = /^file-v2-\d+$/;
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';
const FILE_SCHEMA_VERSION = 'v1';
let fallbackSeq = 1;
function getNextFileId() {
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
    }
    catch {
        const next = fallbackSeq;
        fallbackSeq += 1;
        return `${FILE_ID_PREFIX}${next}`;
    }
}
function assertMetadata(metadata, opts) {
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
function assertValidFile(file) {
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
function normalizeFile(raw) {
    const updatedAt = raw.updated_at ??
        raw.updatedAt ??
        FALLBACK_CREATED_AT;
    const createdAt = raw.created_at ??
        raw.createdAt ??
        updatedAt;
    const file = {
        id: raw.id ?? getNextFileId(),
        name: raw.name ?? 'Untitled',
        kind: (raw.kind ?? 'unknown'),
        schema_version: raw.schema_version ??
            raw.schemaVersion ??
            'unknown',
        created_at: createdAt,
        updated_at: updatedAt,
        created_by: raw.created_by ??
            raw.createdBy ??
            '',
        derived_from: raw.derived_from ??
            raw.derivedFrom ??
            null,
        circuit: raw.circuit ??
            { version: 'v1', nodes: [], connections: [] },
    };
    assertValidFile(file);
    return file;
}
function loadFiles() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data)
            return [];
        const parsed = JSON.parse(data);
        return parsed.map((entry) => normalizeFile(entry));
    }
    catch {
        return [];
    }
}
function saveFiles(files) {
    files.forEach((file) => assertValidFile(file));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}
export function listFiles() {
    return loadFiles();
}
export function createFile(name, circuit, metadata) {
    const files = loadFiles();
    assertMetadata(metadata, { requireDerivedFrom: false });
    const existing = files.find((file) => file.name === name);
    if (existing && !metadata.derived_from) {
        throw new Error('File overwrite requires derived_from metadata.');
    }
    const now = new Date().toISOString();
    const newFile = {
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
    recordAuditTransition({
        scope: 'logic_files',
        action: 'create',
        before: files,
        after: nextFiles,
    });
    return newFile;
}
export function renameFile(id, newName) {
    const files = loadFiles();
    const file = files.find((f) => f.id === id);
    if (file) {
        const before = [...files];
        file.name = newName;
        file.updated_at = new Date().toISOString();
        saveFiles(files);
        recordAuditTransition({
            scope: 'logic_files',
            action: 'rename',
            before,
            after: files,
        });
    }
}
export function deleteFile(id) {
    const files = loadFiles();
    const filtered = files.filter((f) => f.id !== id);
    saveFiles(filtered);
    recordAuditTransition({
        scope: 'logic_files',
        action: 'delete',
        before: files,
        after: filtered,
    });
}
export function getFile(id) {
    const files = loadFiles();
    return files.find((f) => f.id === id) ?? null;
}
export function updateFile(id, circuit, metadata) {
    assertMetadata(metadata, { requireDerivedFrom: true });
    const files = loadFiles();
    const file = files.find((f) => f.id === id);
    if (file) {
        const before = [...files];
        file.circuit = circuit;
        file.updated_at = new Date().toISOString();
        file.kind = metadata.kind;
        file.schema_version = metadata.schema_version;
        file.created_by = metadata.created_by;
        file.derived_from = metadata.derived_from ?? null;
        saveFiles(files);
        recordAuditTransition({
            scope: 'logic_files',
            action: 'overwrite',
            before,
            after: files,
        });
    }
}
