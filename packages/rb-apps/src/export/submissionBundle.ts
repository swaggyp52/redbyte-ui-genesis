import JSZip from 'jszip';
import { serialize } from '@redbyte/rb-logic-core';
import type { RBProject } from './projectFormat';
import { decodeRBProject, encodeRBProject } from './projectFormat';
import { stableStringify } from './stableStringify';
import { stableHash } from '../utils/stableSerialize';
import type { BuildLogEntry, ToolchainDoctorReport } from '../fpga/toolchainTypes';
import type { RunRecord, VerificationStatus } from '../recording/runRecord';
import type { SubmissionGateResult } from '../labs/submissionGates';

const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00.000Z');
const SUBMISSION_BUNDLE_SCHEMA_VERSION = 'rb_submission_bundle_v1' as const;
const SUBMISSION_REPRO_SCHEMA_VERSION = 'rb_submission_reproducibility_v1' as const;
const SUBMISSION_LOG_SCHEMA_VERSION = 'rb_submission_log_v1' as const;
const SUBMISSION_MANIFEST_SCHEMA_VERSION = 'rb_submission_manifest_v1' as const;

export const SUBMISSION_BUNDLE_EVENT = 'rb:submission-bundle-generated' as const;
export const SUBMISSION_BUNDLE_STATUS_STORAGE_KEY = 'rb:submission-bundle:last' as const;

export interface SubmissionBundleStatusSnapshot {
  schema_version: 'rb_submission_bundle_status_v1';
  bundleId: string;
  filename: string;
  reproducibilityStatus: SubmissionReproducibilityReport['status'];
}

export interface SubmissionReproducibilityReport {
  schema_version: typeof SUBMISSION_REPRO_SCHEMA_VERSION;
  ok: boolean;
  status: 'pass' | 'fail' | 'unknown';
  detail: string;
  verificationStatus: VerificationStatus['status'];
  runRecord: {
    present: boolean;
    traceSamples: number;
    replaySamples: number;
    stimulusEvents: number;
    tickCount: number;
  };
  mismatch?: VerificationStatus['mismatch'];
}

export interface SubmissionBundleManifestFileEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface SubmissionBundleManifest {
  schema_version: typeof SUBMISSION_MANIFEST_SCHEMA_VERSION;
  bundleSchemaVersion: typeof SUBMISSION_BUNDLE_SCHEMA_VERSION;
  bundleId: string;
  status: 'pass' | 'fail';
  project: {
    kind: RBProject['kind'];
    version: RBProject['version'];
    id: string | null;
    name: string;
  };
  readiness: {
    overall: 'ready' | 'needs_action';
    gates: Array<{
      id: string;
      state: string;
      detail: string;
    }>;
  };
  submissionGates?: {
    verdict: SubmissionGateResult['verdict'];
    issuesCount: number;
  };
  includedFiles: SubmissionBundleManifestFileEntry[];
}

export interface SubmissionBundleResult {
  filename: string;
  bundleId: string;
  bytes: Uint8Array;
  manifest: SubmissionBundleManifest;
}

export interface SubmissionGatesArtifact {
  schema_version: 'rb_submission_gates_v1';
  labId: string;
  timestamp: string;
  context: {
    projectId: string | null;
    projectName: string;
  };
  result: SubmissionGateResult;
}

interface SubmissionBundleOptions {
  doctorReport: ToolchainDoctorReport;
  reproducibility: SubmissionReproducibilityReport;
  includeRecordings?: boolean;
  logs?: BuildLogEntry[];
  submissionGates?: SubmissionGateResult;
}

interface BundleFile {
  path: string;
  bytes: Uint8Array;
  contentForZip: string | Uint8Array;
}

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 5381;
  for (let index = 0; index < bytes.length; index += 1) {
    hash = ((hash << 5) + hash) + bytes[index];
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sortBundleFiles(files: BundleFile[]): BundleFile[] {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

function sortBuildLogs(logs: BuildLogEntry[]): BuildLogEntry[] {
  return [...logs].sort((left, right) => {
    if (left.run_id !== right.run_id) return left.run_id.localeCompare(right.run_id);
    if (left.ts !== right.ts) return left.ts - right.ts;
    if (left.step !== right.step) return left.step.localeCompare(right.step);
    if (left.level !== right.level) return left.level.localeCompare(right.level);
    return left.msg.localeCompare(right.msg);
  });
}

async function createProjectArchiveBytes(project: RBProject): Promise<Uint8Array> {
  const zip = new JSZip();
  const encodedProject = encodeRBProject(project);
  const serializedCircuit = JSON.stringify(serialize(project.circuit), null, 2);
  zip.file('rb-project.json', encodedProject, { date: ZIP_ENTRY_DATE });
  zip.file('circuit.rblogic', serializedCircuit, { date: ZIP_ENTRY_DATE });
  zip.file(
    'README.txt',
    'RedByte project archive. Import rb-project.json from the Logic Playground to restore full state.',
    { date: ZIP_ENTRY_DATE }
  );
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'DOS',
  });
}

export function createSubmissionReproducibilityReport(input: {
  runRecord: RunRecord | null;
  verificationStatus: VerificationStatus;
  replayTraceSampleCount: number;
}): SubmissionReproducibilityReport {
  const runRecord = input.runRecord;
  const verification = input.verificationStatus;
  const replaySamples = Number.isFinite(input.replayTraceSampleCount)
    ? Math.max(0, Math.floor(input.replayTraceSampleCount))
    : 0;

  if (!runRecord) {
    return {
      schema_version: SUBMISSION_REPRO_SCHEMA_VERSION,
      ok: false,
      status: 'unknown',
      detail: 'No run record available for reproducibility verification.',
      verificationStatus: 'unknown',
      runRecord: {
        present: false,
        traceSamples: 0,
        replaySamples,
        stimulusEvents: 0,
        tickCount: 0,
      },
    };
  }

  const traceSamples = Array.isArray(runRecord.trace) ? runRecord.trace.length : 0;
  const stimulusEvents = Array.isArray(runRecord.stimulus) ? runRecord.stimulus.length : 0;
  const tickCount = typeof runRecord.summary?.tickCount === 'number' ? runRecord.summary.tickCount : 0;
  if (verification.status === 'pass') {
    return {
      schema_version: SUBMISSION_REPRO_SCHEMA_VERSION,
      ok: true,
      status: 'pass',
      detail: 'Replay verification passed.',
      verificationStatus: 'pass',
      runRecord: {
        present: true,
        traceSamples,
        replaySamples,
        stimulusEvents,
        tickCount,
      },
    };
  }

  if (verification.status === 'fail') {
    return {
      schema_version: SUBMISSION_REPRO_SCHEMA_VERSION,
      ok: false,
      status: 'fail',
      detail: verification.mismatch
        ? `Replay mismatch at tick ${verification.mismatch.tick}.`
        : 'Replay verification failed.',
      verificationStatus: 'fail',
      runRecord: {
        present: true,
        traceSamples,
        replaySamples,
        stimulusEvents,
        tickCount,
      },
      ...(verification.mismatch ? { mismatch: verification.mismatch } : {}),
    };
  }

  return {
    schema_version: SUBMISSION_REPRO_SCHEMA_VERSION,
    ok: false,
    status: 'unknown',
    detail: replaySamples > 0 ? 'Replay verification has not been run.' : 'Replay trace samples are missing.',
    verificationStatus: 'unknown',
    runRecord: {
      present: true,
      traceSamples,
      replaySamples,
      stimulusEvents,
      tickCount,
    },
  };
}

export async function generateSubmissionBundle(
  projectInput: RBProject,
  options: SubmissionBundleOptions
): Promise<SubmissionBundleResult> {
  const normalizedProject = decodeRBProject(encodeRBProject(projectInput));
  const projectArchiveBytes = await createProjectArchiveBytes(normalizedProject);
  const doctorReportBytes = textBytes(stableStringify(options.doctorReport));
  const reproducibilityBytes = textBytes(stableStringify(options.reproducibility));
  const logPayload = {
    schema_version: SUBMISSION_LOG_SCHEMA_VERSION,
    entries: sortBuildLogs(options.logs ?? []),
  };
  const logBytes = textBytes(stableStringify(logPayload));
  const submissionGateResult: SubmissionGateResult = options.submissionGates ?? {
    verdict: 'pass',
    issues: [],
  };
  const submissionGatesPayload: SubmissionGatesArtifact = {
    schema_version: 'rb_submission_gates_v1',
    labId:
      typeof normalizedProject.meta?.labId === 'string' && normalizedProject.meta.labId.trim().length > 0
        ? normalizedProject.meta.labId.trim()
        : 'freeplay',
    timestamp:
      (typeof normalizedProject.updatedAt === 'string' && normalizedProject.updatedAt.trim().length > 0
        ? normalizedProject.updatedAt.trim()
        : typeof normalizedProject.createdAt === 'string' && normalizedProject.createdAt.trim().length > 0
          ? normalizedProject.createdAt.trim()
          : '1970-01-01T00:00:00.000Z'),
    context: {
      projectId:
        typeof normalizedProject.meta?.projectId === 'string' && normalizedProject.meta.projectId.trim().length > 0
          ? normalizedProject.meta.projectId.trim()
          : null,
      projectName: normalizedProject.name,
    },
    result: submissionGateResult,
  };
  const submissionGatesBytes = textBytes(stableStringify(submissionGatesPayload));
  const projectArchiveSha = await sha256Bytes(projectArchiveBytes);
  const reproducibilityHash = await stableHash(options.reproducibility);
  const doctorReportId =
    typeof options.doctorReport.reportId === 'string' && options.doctorReport.reportId.trim().length > 0
      ? options.doctorReport.reportId.trim()
      : await stableHash(options.doctorReport);
  const bundleIdSeed = `${projectArchiveSha}:${doctorReportId}:${reproducibilityHash}:${SUBMISSION_BUNDLE_SCHEMA_VERSION}`;
  const bundleId = await stableHash(bundleIdSeed);

  const files: BundleFile[] = [
    {
      path: 'doctor-report.json',
      bytes: doctorReportBytes,
      contentForZip: stableStringify(options.doctorReport),
    },
    {
      path: 'logs/submission-log.json',
      bytes: logBytes,
      contentForZip: stableStringify(logPayload),
    },
    { path: 'project.rbx.zip', bytes: projectArchiveBytes, contentForZip: projectArchiveBytes },
    {
      path: 'reproducibility.json',
      bytes: reproducibilityBytes,
      contentForZip: stableStringify(options.reproducibility),
    },
    {
      path: 'submission-gates.json',
      bytes: submissionGatesBytes,
      contentForZip: stableStringify(submissionGatesPayload),
    },
  ];

  if (options.includeRecordings && normalizedProject.recorder?.lastRunRecord) {
    const recordingText = stableStringify(normalizedProject.recorder.lastRunRecord);
    files.push({
      path: 'recordings/last-run-record.json',
      bytes: textBytes(recordingText),
      contentForZip: recordingText,
    });
  }

  const sortedFiles = sortBundleFiles(files);
  const includedFiles: SubmissionBundleManifestFileEntry[] = [];
  for (const file of sortedFiles) {
    includedFiles.push({
      path: file.path,
      sha256: await sha256Bytes(file.bytes),
      sizeBytes: file.bytes.byteLength,
    });
  }

  const readinessGates = Array.isArray(options.doctorReport.studentReadiness?.gates)
    ? options.doctorReport.studentReadiness!.gates.map((gate) => ({
        id: gate.id,
        state: gate.state,
        detail: gate.detail,
      }))
    : [];
  const readinessOverall = options.doctorReport.studentReadiness?.overall ?? 'needs_action';
  const manifest: SubmissionBundleManifest = {
    schema_version: SUBMISSION_MANIFEST_SCHEMA_VERSION,
    bundleSchemaVersion: SUBMISSION_BUNDLE_SCHEMA_VERSION,
    bundleId,
    status: options.reproducibility.ok ? 'pass' : 'fail',
    project: {
      kind: normalizedProject.kind,
      version: normalizedProject.version,
      id: normalizedProject.meta?.projectId ?? null,
      name: normalizedProject.name,
    },
    readiness: {
      overall: readinessOverall,
      gates: readinessGates,
    },
    submissionGates: {
      verdict: submissionGateResult.verdict,
      issuesCount: submissionGateResult.issues.length,
    },
    includedFiles,
  };
  const manifestText = stableStringify(manifest);

  const bundleZip = new JSZip();
  bundleZip.file('manifest.json', manifestText, { date: ZIP_ENTRY_DATE });
  for (const file of sortedFiles) {
    bundleZip.file(file.path, file.contentForZip, { date: ZIP_ENTRY_DATE });
  }

  const bytes = await bundleZip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'DOS',
  });
  return {
    filename: `rb-submission-${bundleId}.zip`,
    bundleId,
    bytes,
    manifest,
  };
}

export function encodeSubmissionBundleStatus(status: SubmissionBundleStatusSnapshot): string {
  return stableStringify(status);
}

export function decodeSubmissionBundleStatus(raw: string | null | undefined): SubmissionBundleStatusSnapshot | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SubmissionBundleStatusSnapshot>;
    if (
      parsed?.schema_version !== 'rb_submission_bundle_status_v1' ||
      typeof parsed.bundleId !== 'string' ||
      parsed.bundleId.trim().length === 0 ||
      typeof parsed.filename !== 'string' ||
      parsed.filename.trim().length === 0 ||
      (parsed.reproducibilityStatus !== 'pass' &&
        parsed.reproducibilityStatus !== 'fail' &&
        parsed.reproducibilityStatus !== 'unknown')
    ) {
      return null;
    }
    return {
      schema_version: 'rb_submission_bundle_status_v1',
      bundleId: parsed.bundleId.trim(),
      filename: parsed.filename.trim(),
      reproducibilityStatus: parsed.reproducibilityStatus,
    };
  } catch {
    return null;
  }
}
