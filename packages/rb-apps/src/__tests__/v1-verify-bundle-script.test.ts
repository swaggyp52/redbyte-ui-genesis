import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { verifyBundleBytes } from '../../../../scripts/v1-verify-bundle.mjs';

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function makeValidBundleBytes(): Promise<Uint8Array> {
  const zip = new JSZip();
  const files = {
    'project.rbx.zip': '{"kind":"rb-project"}',
    'doctor-report.json': '{"schema_version":"rb_toolchain_doctor_v1"}',
    'reproducibility.json': '{"schema_version":"rb_submission_reproducibility_v1"}',
    'submission-gates.json': '{"schema_version":"rb_submission_gates_v1"}',
    'logs/submission-log.json': '{"schema_version":"rb_submission_log_v1","entries":[]}',
  } as const;

  for (const [filePath, content] of Object.entries(files)) {
    zip.file(filePath, content);
  }

  const includedFiles = await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const bytes = new TextEncoder().encode(content);
      return {
        path: filePath,
        sha256: await sha256(bytes),
        sizeBytes: bytes.byteLength,
      };
    })
  );

  zip.file(
    'manifest.json',
    JSON.stringify({
      schema_version: 'rb_submission_manifest_v1',
      bundleSchemaVersion: 'rb_submission_bundle_v1',
      bundleId: 'bundle-test',
      status: 'pass',
      project: {
        kind: 'rb-project',
        version: 1,
        id: 'project-1',
        name: 'Demo',
      },
      readiness: {
        overall: 'ready',
        gates: [],
      },
      includedFiles,
    })
  );

  return zip.generateAsync({ type: 'uint8array' });
}

describe('v1 bundle verifier', () => {
  it('accepts a valid submission bundle', async () => {
    const bytes = await makeValidBundleBytes();
    const result = await verifyBundleBytes(bytes);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects bundle with bad file hash', async () => {
    const zip = new JSZip();
    zip.file('project.rbx.zip', '{"kind":"rb-project"}');
    zip.file(
      'manifest.json',
      JSON.stringify({
        schema_version: 'rb_submission_manifest_v1',
        bundleSchemaVersion: 'rb_submission_bundle_v1',
        bundleId: 'bundle-test',
        status: 'pass',
        project: { kind: 'rb-project', version: 1, id: 'project-1', name: 'Demo' },
        readiness: { overall: 'ready', gates: [] },
        includedFiles: [{ path: 'project.rbx.zip', sha256: '0'.repeat(64), sizeBytes: 20 }],
      })
    );

    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const result = await verifyBundleBytes(bytes);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.includes('sha256 mismatch'))).toBe(true);
  });
});
