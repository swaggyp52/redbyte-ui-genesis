import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { RBProject } from '../export/projectFormat';
import { generateSubmissionBundle } from '../export/submissionBundle';
import type { ToolchainDoctorReport } from '../fpga/toolchainTypes';

const FIXED_PROJECT: RBProject = {
  kind: 'rb-project',
  version: 1,
  createdAt: '2026-02-12T00:00:00.000Z',
  updatedAt: '2026-02-12T00:00:00.000Z',
  name: 'Submission Demo',
  circuit: {
    nodes: [],
    connections: [],
  },
  meta: {
    appVersion: 'test',
    projectId: 'project-1',
    appSurface: 'logic-playground',
  },
};

const FIXED_DOCTOR_REPORT: ToolchainDoctorReport = {
  schema_version: 'rb_toolchain_doctor_v1',
  reportId: 'doctor-1',
  backend_id: 'vivado',
  bridge_url: 'http://127.0.0.1:4242',
  probe: null,
  studentReadiness: {
    schema_version: 'student_readiness_v1',
    overall: 'ready',
    gates: [
      {
        id: 'toolchain_probe',
        label: 'Toolchain Probe',
        state: 'pass',
        detail: 'Probe complete',
      },
    ],
  },
  logs: [],
};

const FIXED_REPRO = {
  schema_version: 'rb_submission_reproducibility_v1' as const,
  ok: true,
  status: 'pass' as const,
  detail: 'Replay verification passed.',
  verificationStatus: 'pass' as const,
  runRecord: {
    present: true,
    traceSamples: 0,
    replaySamples: 0,
    stimulusEvents: 0,
    tickCount: 0,
  },
};

async function hashZipEntry(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`missing zip entry: ${path}`);
  const bytes = await entry.async('uint8array');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

describe('submission bundle export', () => {
  it('creates deterministic submission bundle zip with required files', async () => {
    const first = await generateSubmissionBundle(FIXED_PROJECT, {
      doctorReport: FIXED_DOCTOR_REPORT,
      reproducibility: FIXED_REPRO,
      logs: [],
    });
    const second = await generateSubmissionBundle(FIXED_PROJECT, {
      doctorReport: FIXED_DOCTOR_REPORT,
      reproducibility: FIXED_REPRO,
      logs: [],
    });

    expect(first.bundleId).toBe(second.bundleId);
    expect(first.filename).toBe(second.filename);
    expect(first.manifest).toEqual(second.manifest);

    const zip = await JSZip.loadAsync(first.bytes);
    const zipSecond = await JSZip.loadAsync(second.bytes);
    expect(zip.file('manifest.json')).toBeTruthy();
    expect(zip.file('project.rbx.zip')).toBeTruthy();
    expect(zip.file('doctor-report.json')).toBeTruthy();
    expect(zip.file('reproducibility.json')).toBeTruthy();
    expect(zip.file('submission-gates.json')).toBeTruthy();
    expect(zip.file('logs/submission-log.json')).toBeTruthy();

    const submissionGatesEntry = zip.file('submission-gates.json');
    expect(submissionGatesEntry).toBeTruthy();
    const submissionGatesRaw = await submissionGatesEntry!.async('string');
    const submissionGates = JSON.parse(submissionGatesRaw) as {
      schema_version: string;
      labId: string;
      timestamp: string;
      context: { projectId: string | null; projectName: string };
      result: { verdict: string; issues: unknown[] };
    };
    expect(submissionGates.schema_version).toBe('rb_submission_gates_v1');
    expect(submissionGates.labId).toBe('freeplay');
    expect(submissionGates.timestamp).toBe(FIXED_PROJECT.updatedAt);
    expect(submissionGates.context).toEqual({
      projectId: FIXED_PROJECT.meta?.projectId ?? null,
      projectName: FIXED_PROJECT.name,
    });
    expect(submissionGates.result.verdict).toBe('pass');
    expect(Array.isArray(submissionGates.result.issues)).toBe(true);

    const manifestEntry = zip.file('manifest.json');
    expect(manifestEntry).toBeTruthy();
    const manifestRaw = await manifestEntry!.async('string');
    const manifest = JSON.parse(manifestRaw) as {
      bundleId: string;
      includedFiles: Array<{ path: string; sha256: string }>;
    };
    expect(manifest.bundleId).toBe(first.bundleId);

    const secondManifestEntry = zipSecond.file('manifest.json');
    expect(secondManifestEntry).toBeTruthy();
    const secondManifestRaw = await secondManifestEntry!.async('string');
    const secondManifest = JSON.parse(secondManifestRaw) as {
      bundleId: string;
      includedFiles: Array<{ path: string; sha256: string }>;
    };
    expect(secondManifest).toEqual(manifest);

    for (const entry of manifest.includedFiles) {
      const hash = await hashZipEntry(zip, entry.path);
      const secondHash = await hashZipEntry(zipSecond, entry.path);
      expect(hash).toBe(entry.sha256);
      expect(secondHash).toBe(entry.sha256);
    }
  });
});
