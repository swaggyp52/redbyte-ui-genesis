import JSZip from 'jszip';
import type { RBProject } from './projectFormat';
import { encodeRBProject } from './projectFormat';
import { stableSerialize } from '../utils/stableSerialize';
import { stableStringify } from './stableStringify';
import type { VerifyRunLedgerEntry, RuntimeVerifyRun } from '../apps/ide/projectRuntime';
import {
  validateSubmissionForLab,
} from '../labs/submissionGates';
import { deriveProofRunFlags } from '../labs/proofRunFlags';
import { compareCodepoint } from './codepointSort';

const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00.000Z');

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface IdeSubmissionGradeSummary {
  rbSubmissionVersion: 'ide-submission-v1';
  schemaVersion: '1.0';
  bundleId: string;
  appCommitSha: string;
  assignmentId: string | null;
  labCode: string | null;
  studentName: string | null;
  deviceId: string | null;
  projectId: string | null;
  projectName: string;
  createdAt: string;
  submittedAt: string;

  circuit: {
    nodeCount: number;
    wireCount: number;
    containsDff: boolean;
    nodeTypes: Record<string, number>;
  };
  mapping: {
    totalRows: number;
    mappedRows: number;
    complete: boolean;
  };
  vectors: { count: number };
  proofRuns: {
    sequenceProofRun: boolean;
    fsmPathsRun: boolean;
  };

  verifyRuns: {
    total: number;
    passes: number;
    fails: number;
    firstPassAt: string | null;
    lastPassAt: string | null;
    lastStatus: 'pass' | 'fail' | 'none';
  };
  lastRun: {
    status: 'pass' | 'fail' | 'none';
    passedRows: number;
    failedRows: number;
    firstFailure: { tick: number; signal: string; expected: string; actual: string } | null;
    reportHash: string;
    deterministicHash: string;
  } | null;

  gateResults: Array<{
    gateId: string;
    verdict: 'pass' | 'warn' | 'block';
    title: string;
    detail: string;
  }>;
  overallGateVerdict: 'pass' | 'warn' | 'block' | 'ungraded';
}

export interface IdeSubmissionBundleResult {
  filename: string;
  downloadFilename: string;
  bytes: Uint8Array;
  gradeSummary: IdeSubmissionGradeSummary;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buffer))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
  }
  // DJB2 fallback
  let hash = 5381;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) + hash) + bytes[i]!;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getOrCreateDeviceId(): string {
  const KEY = 'rb:device-id:v1';
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.trim().length > 0) return existing.trim();
    const id = generateSimpleUuid();
    localStorage.setItem(KEY, id);
    return id;
  }
  return 'device-unavailable';
}

function generateSimpleUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function computeNodeTypes(nodes: RBProject['circuit']['nodes']): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  }
  return counts;
}

async function buildGradeSummary(input: {
  project: RBProject;
  verifyLastRun: RuntimeVerifyRun | null;
  verifyRunHistory: VerifyRunLedgerEntry[];
  submittedAt: string;
  appCommitSha: string;
  bundleId: string;
  deviceId: string;
}): Promise<IdeSubmissionGradeSummary> {
  const { project, verifyLastRun, verifyRunHistory, submittedAt, appCommitSha, bundleId, deviceId } = input;

  // Circuit summary
  const nodes = project.circuit.nodes;
  const connections = project.circuit.connections;
  const containsDff = nodes.some((n) => n.type === 'DFlipFlop' || n.type === 'Register1' || n.type === 'RegisterBus' || n.type === 'StateBank');

  // Mapping summary
  const allRows = [
    ...(project.ioMapping?.inputs ?? []),
    ...(project.ioMapping?.outputs ?? []),
  ];
  const mappedRows = allRows.filter((r) => (r.pin ?? '').trim() !== '').length;

  // Verify run summary
  const passes = verifyRunHistory.filter((r) => r.status === 'pass').length;
  const fails = verifyRunHistory.filter((r) => r.status === 'fail').length;
  const firstPassEntry = verifyRunHistory.find((r) => r.status === 'pass') ?? null;
  const lastPassEntry = [...verifyRunHistory].reverse().find((r) => r.status === 'pass') ?? null;
  const lastStatus: 'pass' | 'fail' | 'none' =
    verifyRunHistory.length === 0 ? 'none' : (verifyRunHistory[verifyRunHistory.length - 1]!.status);

  // Gate results (only if labId is set)
  const labId = project.meta?.labId;
  let gateResults: IdeSubmissionGradeSummary['gateResults'] = [];
  let overallGateVerdict: IdeSubmissionGradeSummary['overallGateVerdict'] = 'ungraded';
  const proofRuns = await deriveProofRunFlags(project, labId ?? null);

  if (labId && labId.trim().length > 0) {
    const gateResult = validateSubmissionForLab(labId.trim(), {
      projectSnapshot: project,
      doctorReport: null,
      recentRuns: proofRuns,
    });
    gateResults = gateResult.issues.map((issue) => ({
      gateId: issue.code,
      verdict: issue.severity === 'block' ? 'block' : 'warn',
      title: issue.title,
      detail: issue.message,
    }));
    overallGateVerdict = gateResult.verdict;
  }

  return {
    rbSubmissionVersion: 'ide-submission-v1',
    schemaVersion: '1.0',
    bundleId,
    appCommitSha,
    assignmentId: labId ?? null,
    labCode: project.meta?.labCode ?? null,
    studentName: project.meta?.studentName ?? null,
    deviceId,
    projectId: project.meta?.projectId ?? null,
    projectName: project.name,
    createdAt: project.createdAt,
    submittedAt,
    circuit: {
      nodeCount: nodes.length,
      wireCount: connections.length,
      containsDff,
      nodeTypes: computeNodeTypes(nodes),
    },
    mapping: {
      totalRows: allRows.length,
      mappedRows,
      complete: allRows.length > 0 && mappedRows === allRows.length,
    },
    vectors: { count: (project.vectors ?? []).length },
    proofRuns: {
      sequenceProofRun: proofRuns.sequenceProofRun === true,
      fsmPathsRun: proofRuns.fsmPathsRun === true,
    },
    verifyRuns: {
      total: verifyRunHistory.length,
      passes,
      fails,
      firstPassAt: firstPassEntry?.ranAtIso ?? null,
      lastPassAt: lastPassEntry?.ranAtIso ?? null,
      lastStatus,
    },
    lastRun: verifyLastRun
      ? {
          status: verifyLastRun.status,
          passedRows: verifyLastRun.report.rows.filter((r) => r.status === 'pass').length,
          failedRows: verifyLastRun.report.rows.filter((r) => r.status === 'fail').length,
          firstFailure: verifyLastRun.report.firstFailingTick !== undefined
            ? (() => {
                const failRow = verifyLastRun.report.rows.find((r) => r.status === 'fail');
                return failRow
                  ? { tick: failRow.tick, signal: failRow.signal, expected: failRow.expected, actual: failRow.actual }
                  : null;
              })()
            : null,
          reportHash: verifyLastRun.reportHash,
          deterministicHash: verifyLastRun.deterministicHash,
        }
      : null,
    gateResults,
    overallGateVerdict,
  };
}

const README_TEXT = `RedByte IDE Submission Bundle
==============================

This ZIP contains your graded circuit submission from the RedByte Logic IDE.

Contents:
  manifest.json          — File inventory with SHA-256 hashes
  grade/summary.json     — Machine-readable grade summary (LMS-parseable)
  project.rbproj.json    — Full project (circuit, vectors, mapping) — re-importable
  verify/last-run.json   — Last verification run (full report + hashes)
  verify/run-ledger.json — All verification run history with change detection

How to re-import:
  1. Open RedByte IDE (https://ide.redbyte.io)
  2. Go to Import
  3. Upload this ZIP — the viewer will open automatically

deviceId note:
  This bundle includes a random device ID from your browser's localStorage.
  It is used for deduplication only and is not linked to any personal account.

Questions? Contact your instructor.
`;

// ─── Main export function ─────────────────────────────────────────────────────

export async function generateIdeSubmissionBundle(input: {
  project: RBProject;
  verifyLastRun: RuntimeVerifyRun | null;
  verifyRunHistory: VerifyRunLedgerEntry[];
  submittedAt: string;
  appCommitSha: string;
}): Promise<IdeSubmissionBundleResult> {
  const { project, verifyLastRun, verifyRunHistory, submittedAt, appCommitSha } = input;

  const deviceId = getOrCreateDeviceId();

  // Encode files
  const projectJson = encodeRBProject(project);
  const lastRunJson = verifyLastRun ? stableStringify(verifyLastRun) : null;
  const ledgerJson = stableStringify(verifyRunHistory);
  const readmeTxt = README_TEXT;

  // Compute per-file hashes for manifest + bundleId seed
  const projectBytes = textBytes(projectJson);
  const ledgerBytes = textBytes(ledgerJson);
  const readmeBytes = textBytes(readmeTxt);

  const projectSha = await sha256Hex(projectBytes);
  const ledgerSha = await sha256Hex(ledgerBytes);
  const readmeSha = await sha256Hex(readmeBytes);

  let lastRunSha = 'none';
  let lastRunBytes: Uint8Array | null = null;
  if (lastRunJson) {
    lastRunBytes = textBytes(lastRunJson);
    lastRunSha = await sha256Hex(lastRunBytes);
  }

  // bundleId is content-addressed from file hashes only (NOT submittedAt)
  const fileHashes = {
    'project.rbproj.json': projectSha,
    'verify/last-run.json': lastRunSha,
    'verify/run-ledger.json': ledgerSha,
    'README.txt': readmeSha,
  };

  // Use stableSerialize for deterministic hash input
  const bundleIdInput = stableSerialize(fileHashes);
  const bundleIdBytes = textBytes(bundleIdInput);
  const bundleId = await sha256Hex(bundleIdBytes);

  // Build grade summary (submittedAt lives here but NOT in bundleId)
  const gradeSummary = await buildGradeSummary({
    project,
    verifyLastRun,
    verifyRunHistory,
    submittedAt,
    appCommitSha,
    bundleId,
    deviceId,
  });
  const summaryJson = stableStringify(gradeSummary);
  const summaryBytes = textBytes(summaryJson);
  const summarySha = await sha256Hex(summaryBytes);

  // Manifest
  const manifestFiles: Array<{ path: string; sha256: string; sizeBytes: number }> = [
    { path: 'README.txt', sha256: readmeSha, sizeBytes: readmeBytes.byteLength },
    { path: 'grade/summary.json', sha256: summarySha, sizeBytes: summaryBytes.byteLength },
    { path: 'project.rbproj.json', sha256: projectSha, sizeBytes: projectBytes.byteLength },
    ...(lastRunBytes ? [{ path: 'verify/last-run.json', sha256: lastRunSha, sizeBytes: lastRunBytes.byteLength }] : []),
    { path: 'verify/run-ledger.json', sha256: ledgerSha, sizeBytes: ledgerBytes.byteLength },
  ].sort((a, b) => compareCodepoint(a.path, b.path));

  const manifest = {
    schemaVersion: '1.0',
    bundleId,
    appCommitSha,
    deviceId,
    includedFiles: manifestFiles,
  };
  const manifestJson = stableStringify(manifest);

  // Assemble ZIP deterministically
  const zip = new JSZip();
  zip.file('manifest.json', manifestJson, { date: ZIP_ENTRY_DATE });
  zip.file('README.txt', readmeTxt, { date: ZIP_ENTRY_DATE });
  zip.file('grade/summary.json', summaryJson, { date: ZIP_ENTRY_DATE });
  zip.file('project.rbproj.json', projectJson, { date: ZIP_ENTRY_DATE });
  if (lastRunJson) {
    zip.file('verify/last-run.json', lastRunJson, { date: ZIP_ENTRY_DATE });
  }
  zip.file('verify/run-ledger.json', ledgerJson, { date: ZIP_ENTRY_DATE });

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'DOS',
  });

  return {
    filename: `rb-submission-${bundleId.slice(0, 16)}.zip`,
    downloadFilename: 'rb-submission.zip',
    bytes,
    gradeSummary,
  };
}
