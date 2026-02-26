import JSZip from 'jszip';
import { decodeRBProject, type RBProject } from './projectFormat';
import type { IdeSubmissionGradeSummary } from './ideSubmissionBundle';
import type { VerifyRunLedgerEntry, RuntimeVerifyRun } from '../apps/ide/projectRuntime';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class NotASubmissionZipError extends Error {
  constructor(reason: string) {
    super(`Not a submission ZIP: ${reason}`);
    this.name = 'NotASubmissionZipError';
  }
}

export class SubmissionIntegrityError extends Error {
  constructor(reason: string) {
    super(`Submission integrity failed: ${reason}`);
    this.name = 'SubmissionIntegrityError';
  }
}

interface SubmissionManifestFileRecord {
  path: string;
  sha256: string;
  sizeBytes: number;
}

const REQUIRED_SUBMISSION_PATHS = [
  'grade/summary.json',
  'project.rbproj.json',
  'verify/run-ledger.json',
] as const;

// ─── Parsed result ────────────────────────────────────────────────────────────

export interface ParsedIdeSubmission {
  gradeSummary: IdeSubmissionGradeSummary;
  project: RBProject;
  verifyLastRun: RuntimeVerifyRun | null;
  verifyRunHistory: VerifyRunLedgerEntry[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export async function parseIdeSubmissionZip(
  bytes: ArrayBuffer
): Promise<ParsedIdeSubmission> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new NotASubmissionZipError('could not open as ZIP');
  }

  // Detection: manifest.json must exist with bundleId + schemaVersion
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new NotASubmissionZipError('missing manifest.json');
  }

  let manifest: Record<string, unknown>;
  try {
    const text = await manifestFile.async('text');
    manifest = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new NotASubmissionZipError('manifest.json is not valid JSON');
  }

  if (typeof manifest['bundleId'] !== 'string' || typeof manifest['schemaVersion'] !== 'string') {
    throw new NotASubmissionZipError('manifest.json missing bundleId or schemaVersion');
  }
  const manifestBundleId = manifest['bundleId'];

  // Detection: grade/summary.json must exist with rbSubmissionVersion: 'ide-submission-v1'
  const summaryFile = zip.file('grade/summary.json');
  if (!summaryFile) {
    throw new NotASubmissionZipError('missing grade/summary.json');
  }

  let gradeSummary: IdeSubmissionGradeSummary;
  try {
    const text = await summaryFile.async('text');
    const parsed = JSON.parse(text) as Partial<IdeSubmissionGradeSummary>;
    if (parsed.rbSubmissionVersion !== 'ide-submission-v1') {
      throw new NotASubmissionZipError(
        `grade/summary.json has unexpected rbSubmissionVersion: ${String(parsed.rbSubmissionVersion)}`
      );
    }
    gradeSummary = parsed as IdeSubmissionGradeSummary;
  } catch (err) {
    if (err instanceof NotASubmissionZipError) throw err;
    throw new NotASubmissionZipError('grade/summary.json is not valid JSON');
  }
  if (gradeSummary.bundleId !== manifestBundleId) {
    throw new SubmissionIntegrityError('grade summary bundleId does not match manifest bundleId');
  }
  const includedFiles = normalizeManifestFiles(manifest['includedFiles']);
  if (includedFiles) {
    await verifyIncludedFiles(zip, includedFiles);
  }

  // Parse project.rbproj.json
  const projectFile = zip.file('project.rbproj.json');
  if (!projectFile) {
    throw new Error('Submission ZIP is missing project.rbproj.json');
  }

  let project: RBProject;
  try {
    const text = await projectFile.async('text');
    project = decodeRBProject(text);
  } catch (err) {
    throw new Error(`Failed to decode project: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse verify/last-run.json (optional)
  let verifyLastRun: RuntimeVerifyRun | null = null;
  const lastRunFile = zip.file('verify/last-run.json');
  if (lastRunFile) {
    try {
      const text = await lastRunFile.async('text');
      verifyLastRun = JSON.parse(text) as RuntimeVerifyRun;
    } catch {
      // Non-fatal: last run missing or malformed
      verifyLastRun = null;
    }
  }

  // Parse verify/run-ledger.json (optional)
  let verifyRunHistory: VerifyRunLedgerEntry[] = [];
  const ledgerFile = zip.file('verify/run-ledger.json');
  if (ledgerFile) {
    try {
      const text = await ledgerFile.async('text');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        verifyRunHistory = parsed as VerifyRunLedgerEntry[];
      }
    } catch {
      verifyRunHistory = [];
    }
  }

  return { gradeSummary, project, verifyLastRun, verifyRunHistory };
}

function normalizeManifestFiles(rawIncludedFiles: unknown): SubmissionManifestFileRecord[] | null {
  if (rawIncludedFiles == null) {
    // Backward compatibility: legacy IDE submissions may not include integrity rows.
    return null;
  }
  if (!Array.isArray(rawIncludedFiles)) {
    throw new SubmissionIntegrityError('manifest includedFiles must be an array when present');
  }
  if (rawIncludedFiles.length === 0) {
    // Backward compatibility: older bundles used an empty includedFiles list.
    return null;
  }

  const normalized: SubmissionManifestFileRecord[] = [];
  const seenPaths = new Set<string>();
  for (const entry of rawIncludedFiles) {
    if (!entry || typeof entry !== 'object') {
      throw new SubmissionIntegrityError('manifest includedFiles contains a non-object entry');
    }
    const record = entry as {
      path?: unknown;
      sha256?: unknown;
      sizeBytes?: unknown;
    };
    if (
      typeof record.path !== 'string'
      || typeof record.sha256 !== 'string'
      || typeof record.sizeBytes !== 'number'
      || !Number.isFinite(record.sizeBytes)
      || record.sizeBytes < 0
    ) {
      throw new SubmissionIntegrityError('manifest includedFiles contains an invalid entry');
    }
    if (seenPaths.has(record.path)) {
      throw new SubmissionIntegrityError(`manifest includedFiles has duplicate path "${record.path}"`);
    }
    seenPaths.add(record.path);
    normalized.push({
      path: record.path,
      sha256: normalizeDigest(record.sha256),
      sizeBytes: record.sizeBytes,
    });
  }

  for (const requiredPath of REQUIRED_SUBMISSION_PATHS) {
    if (!seenPaths.has(requiredPath)) {
      throw new SubmissionIntegrityError(`manifest missing required file "${requiredPath}"`);
    }
  }
  return normalized;
}

function normalizeDigest(digest: string): string {
  return digest.trim().toLowerCase();
}

async function verifyIncludedFiles(
  zip: JSZip,
  manifestFiles: SubmissionManifestFileRecord[],
): Promise<void> {
  for (const fileRecord of manifestFiles) {
    const file = zip.file(fileRecord.path);
    if (!file) {
      throw new SubmissionIntegrityError(`missing file "${fileRecord.path}" listed in manifest`);
    }
    const fileBytes = await file.async('uint8array');
    if (fileBytes.byteLength !== fileRecord.sizeBytes) {
      throw new SubmissionIntegrityError(
        `size mismatch for "${fileRecord.path}" (expected ${fileRecord.sizeBytes}, got ${fileBytes.byteLength})`,
      );
    }
    const actualDigest = await sha256Hex(fileBytes);
    if (normalizeDigest(actualDigest) !== fileRecord.sha256) {
      throw new SubmissionIntegrityError(`hash mismatch for "${fileRecord.path}"`);
    }
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback aligns with the deterministic fallback in ideSubmissionBundle.ts.
  let hash = 5381;
  for (let index = 0; index < bytes.length; index++) {
    hash = ((hash << 5) + hash) + bytes[index]!;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
