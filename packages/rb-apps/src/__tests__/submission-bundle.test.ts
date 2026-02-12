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
    expect(Array.from(first.bytes)).toEqual(Array.from(second.bytes));

    const zip = await JSZip.loadAsync(first.bytes);
    expect(zip.file('manifest.json')).toBeTruthy();
    expect(zip.file('project.rbx.zip')).toBeTruthy();
    expect(zip.file('doctor-report.json')).toBeTruthy();
    expect(zip.file('reproducibility.json')).toBeTruthy();
    expect(zip.file('logs/submission-log.json')).toBeTruthy();

    const manifestEntry = zip.file('manifest.json');
    expect(manifestEntry).toBeTruthy();
    const manifestRaw = await manifestEntry!.async('string');
    const manifest = JSON.parse(manifestRaw) as {
      bundleId: string;
      includedFiles: Array<{ path: string; sha256: string }>;
    };
    expect(manifest.bundleId).toBe(first.bundleId);

    for (const entry of manifest.includedFiles) {
      const hash = await hashZipEntry(zip, entry.path);
      expect(hash).toBe(entry.sha256);
    }
  });
});
