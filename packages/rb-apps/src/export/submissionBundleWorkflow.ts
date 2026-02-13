import { getToolchainBackend, type ToolchainProjectSnapshotInput } from '../fpga/toolchainBackend';
import type { RunRecord, VerificationStatus } from '../recording/runRecord';
import type { RBProject } from './projectFormat';
import { markProjectSubmissionCheckpoint } from '../utils/rbprojAutosave';
import {
  SUBMISSION_BUNDLE_EVENT,
  SUBMISSION_BUNDLE_STATUS_STORAGE_KEY,
  createSubmissionReproducibilityReport,
  encodeSubmissionBundleStatus,
  generateSubmissionBundle,
  type SubmissionBundleResult,
  type SubmissionBundleStatusSnapshot,
} from './submissionBundle';
import type { SubmissionGateResult } from '../labs/submissionGates';
import type { ToolchainDoctorReport } from '../fpga/toolchainTypes';

export interface GenerateProjectSubmissionBundleInput {
  project: RBProject;
  runRecord: RunRecord | null;
  verificationStatus: VerificationStatus;
  replayTraceSampleCount: number;
  includeRecordings: boolean;
  submissionGates?: SubmissionGateResult;
  doctorReport?: ToolchainDoctorReport;
}

export interface GenerateProjectSubmissionBundleResult {
  bundle: SubmissionBundleResult;
  status: SubmissionBundleStatusSnapshot;
  reproducibility: ReturnType<typeof createSubmissionReproducibilityReport>;
}

export function buildToolchainSnapshotFromProject(project: RBProject): ToolchainProjectSnapshotInput {
  return {
    hdl: project.hdl ?? {
      sources: [],
      ...(typeof project.fpga?.top === 'string' && project.fpga.top.trim().length > 0
        ? { top: project.fpga.top.trim() }
        : {}),
    },
    fpga: project.fpga ?? {
      board: 'basys3',
      ...(typeof project.hdl?.top === 'string' && project.hdl.top.trim().length > 0
        ? { top: project.hdl.top.trim() }
        : {}),
    },
  };
}

export async function generateProjectSubmissionBundle(
  input: GenerateProjectSubmissionBundleInput,
): Promise<GenerateProjectSubmissionBundleResult> {
  const doctorReport = input.doctorReport ?? await (async () => {
    const backend = getToolchainBackend();
    const toolchainSnapshot = buildToolchainSnapshotFromProject(input.project);
    return backend.doctorReport(toolchainSnapshot, { refreshProbe: true, logs: [] });
  })();
  const reproducibility = createSubmissionReproducibilityReport({
    runRecord: input.runRecord,
    verificationStatus: input.verificationStatus,
    replayTraceSampleCount: input.replayTraceSampleCount,
  });

  const bundle = await generateSubmissionBundle(input.project, {
    doctorReport,
    reproducibility,
    includeRecordings: input.includeRecordings,
    logs: doctorReport.logs ?? [],
    submissionGates: input.submissionGates,
  });

  const status: SubmissionBundleStatusSnapshot = {
    schema_version: 'rb_submission_bundle_status_v1',
    bundleId: bundle.bundleId,
    filename: bundle.filename,
    reproducibilityStatus: reproducibility.status,
  };

  return { bundle, status, reproducibility };
}

export function downloadSubmissionBundle(bundle: SubmissionBundleResult): void {
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(new Blob([bundle.bytes], { type: 'application/zip' }));
  downloadLink.download = bundle.filename;
  downloadLink.click();
  URL.revokeObjectURL(downloadLink.href);
}

export function persistSubmissionBundleStatus(
  status: SubmissionBundleStatusSnapshot,
  options?: { project?: RBProject; submittedAtMs?: number },
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    SUBMISSION_BUNDLE_STATUS_STORAGE_KEY,
    encodeSubmissionBundleStatus(status),
  );
  if (options?.project) {
    markProjectSubmissionCheckpoint(options.project, {
      bundleId: status.bundleId,
      submittedAtMs: options.submittedAtMs,
    });
  }
  window.dispatchEvent(new CustomEvent(SUBMISSION_BUNDLE_EVENT, { detail: status }));
}
