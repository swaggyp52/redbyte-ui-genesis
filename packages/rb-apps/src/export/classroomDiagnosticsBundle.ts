import JSZip from 'jszip';
import type {
  BuildLogEntry,
  StudentReadinessSummary,
  ToolProbeResult,
  ToolchainBuildPath,
  ToolchainDoctorReport,
  ToolchainPreflightStatus,
} from '../fpga/toolchainTypes';
import { stableStringify } from './stableStringify';
import { compareCodepoint } from './codepointSort';
import { hashBytes, stableHash } from '../utils/stableSerialize';
import type { RedByteUiMode } from '../utils/uiMode';

const ZIP_ENTRY_DATE = new Date('2000-01-01T00:00:00.000Z');
const CLASSROOM_DIAGNOSTICS_SCHEMA_VERSION = 'rb_classroom_diagnostics_bundle_v1' as const;

interface ClassroomDiagnosticsFileEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface ClassroomDiagnosticsBundleManifest {
  schema_version: typeof CLASSROOM_DIAGNOSTICS_SCHEMA_VERSION;
  bundleId: string;
  source: 'toolchain-setup' | 'submission-inspector';
  mode: RedByteUiMode;
  app: {
    envMode: string | null;
    appVersion: string | null;
    buildId: string | null;
  };
  environment: {
    platform: string | null;
    userAgent: string | null;
  };
  includedFiles: ClassroomDiagnosticsFileEntry[];
}

export interface ClassroomDiagnosticsBundleResult {
  filename: string;
  bundleId: string;
  bytes: Uint8Array;
  manifest: ClassroomDiagnosticsBundleManifest;
}

export interface ClassroomDiagnosticsBundleInput {
  source: 'toolchain-setup' | 'submission-inspector';
  mode: RedByteUiMode;
  app: {
    envMode?: string | null;
    appVersion?: string | null;
    buildId?: string | null;
  };
  environment: {
    platform?: string | null;
    userAgent?: string | null;
  };
  doctorReport?: ToolchainDoctorReport | null;
  readiness?: StudentReadinessSummary | null;
  probe?: ToolProbeResult | null;
  preflight?: ToolchainPreflightStatus | null;
  buildPath?: ToolchainBuildPath | null;
  logs?: BuildLogEntry[];
  context?: Record<string, unknown>;
}

interface BundleTextFile {
  path: string;
  text: string;
}

function sortBundleFiles(files: BundleTextFile[]): BundleTextFile[] {
  return [...files].sort((left, right) => compareCodepoint(left.path, right.path));
}

function sortLogs(logs: BuildLogEntry[]): BuildLogEntry[] {
  return [...logs].sort((left, right) => {
    if (left.run_id !== right.run_id) return compareCodepoint(left.run_id, right.run_id);
    if (left.ts !== right.ts) return left.ts - right.ts;
    if (left.step !== right.step) return compareCodepoint(left.step, right.step);
    if (left.level !== right.level) return compareCodepoint(left.level, right.level);
    return compareCodepoint(left.msg, right.msg);
  });
}

function toByteArray(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function generateClassroomDiagnosticsBundle(
  input: ClassroomDiagnosticsBundleInput,
): Promise<ClassroomDiagnosticsBundleResult> {
  const logsPayload = {
    schema_version: 'rb_classroom_diagnostics_logs_v1',
    entries: sortLogs(input.logs ?? []).slice(-200),
  };
  const environmentPayload = {
    schema_version: 'rb_classroom_diagnostics_environment_v1',
    mode: input.mode,
    app: {
      envMode: input.app.envMode ?? null,
      appVersion: input.app.appVersion ?? null,
      buildId: input.app.buildId ?? null,
    },
    environment: {
      platform: input.environment.platform ?? null,
      userAgent: input.environment.userAgent ?? null,
    },
  };

  const files: BundleTextFile[] = [
    {
      path: 'environment.json',
      text: stableStringify(environmentPayload),
    },
    {
      path: 'logs/recent-logs.json',
      text: stableStringify(logsPayload),
    },
  ];

  if (input.doctorReport) {
    files.push({ path: 'doctor-report.json', text: stableStringify(input.doctorReport) });
  }
  if (input.readiness) {
    files.push({ path: 'readiness.json', text: stableStringify(input.readiness) });
  }
  if (input.probe) {
    files.push({ path: 'probe.json', text: stableStringify(input.probe) });
  }
  if (input.preflight) {
    files.push({ path: 'preflight.json', text: stableStringify(input.preflight) });
  }
  if (input.buildPath) {
    files.push({ path: 'build-path.json', text: stableStringify(input.buildPath) });
  }
  if (input.context && Object.keys(input.context).length > 0) {
    files.push({
      path: 'context.json',
      text: stableStringify({
        schema_version: 'rb_classroom_diagnostics_context_v1',
        source: input.source,
        context: input.context,
      }),
    });
  }

  const sortedFiles = sortBundleFiles(files);
  const includedFiles: ClassroomDiagnosticsFileEntry[] = [];
  const fileHashes: Array<{ path: string; sha256: string }> = [];

  for (const file of sortedFiles) {
    const bytes = toByteArray(file.text);
    const sha256 = await hashBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    includedFiles.push({
      path: file.path,
      sha256,
      sizeBytes: bytes.byteLength,
    });
    fileHashes.push({ path: file.path, sha256 });
  }

  const bundleId = await stableHash({
    schema_version: CLASSROOM_DIAGNOSTICS_SCHEMA_VERSION,
    source: input.source,
    mode: input.mode,
    files: fileHashes,
  });

  const manifest: ClassroomDiagnosticsBundleManifest = {
    schema_version: CLASSROOM_DIAGNOSTICS_SCHEMA_VERSION,
    bundleId,
    source: input.source,
    mode: input.mode,
    app: {
      envMode: input.app.envMode ?? null,
      appVersion: input.app.appVersion ?? null,
      buildId: input.app.buildId ?? null,
    },
    environment: {
      platform: input.environment.platform ?? null,
      userAgent: input.environment.userAgent ?? null,
    },
    includedFiles,
  };

  const zip = new JSZip();
  zip.file('manifest.json', stableStringify(manifest), { date: ZIP_ENTRY_DATE });
  for (const file of sortedFiles) {
    zip.file(file.path, file.text, { date: ZIP_ENTRY_DATE });
  }

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'DOS',
  });

  return {
    filename: `rb-diagnostics-${bundleId}.zip`,
    bundleId,
    bytes,
    manifest,
  };
}

export function downloadClassroomDiagnosticsBundle(bundle: ClassroomDiagnosticsBundleResult): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([bundle.bytes], { type: 'application/zip' }));
  link.download = bundle.filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
