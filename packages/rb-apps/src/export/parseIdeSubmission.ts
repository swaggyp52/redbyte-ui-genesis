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
