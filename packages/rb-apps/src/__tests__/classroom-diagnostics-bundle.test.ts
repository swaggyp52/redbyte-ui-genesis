import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { generateClassroomDiagnosticsBundle } from '../export/classroomDiagnosticsBundle';

describe('classroomDiagnosticsBundle', () => {
  it('generates deterministic bundle id and required entries', async () => {
    const input = {
      source: 'toolchain-setup' as const,
      mode: 'ta' as const,
      app: {
        envMode: 'test',
        appVersion: '1.0.0',
        buildId: 'abc123',
      },
      environment: {
        platform: 'win32',
        userAgent: 'vitest',
      },
      logs: [
        { run_id: 'run-1', ts: 2, step: 'probe' as const, level: 'info' as const, msg: 'b' },
        { run_id: 'run-1', ts: 1, step: 'probe' as const, level: 'info' as const, msg: 'a' },
      ],
      context: {
        sample: true,
      },
      readiness: {
        schema_version: 'student_readiness_v1' as const,
        overall: 'ready' as const,
        gates: [
          {
            id: 'toolchain_probe',
            label: 'Toolchain Probe',
            state: 'pass' as const,
            detail: 'ok',
          },
        ],
      },
    };

    const first = await generateClassroomDiagnosticsBundle(input);
    const second = await generateClassroomDiagnosticsBundle(input);
    expect(first.bundleId).toBe(second.bundleId);
    expect(first.filename).toBe(second.filename);

    const zip = await JSZip.loadAsync(first.bytes);
    const names = Object.keys(zip.files)
      .filter((name) => !zip.files[name]?.dir)
      .sort();
    expect(names).toEqual(['context.json', 'environment.json', 'logs/recent-logs.json', 'manifest.json', 'readiness.json']);

    const manifestText = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestText) as { bundleId: string; source: string; mode: string };
    expect(manifest.bundleId).toBe(first.bundleId);
    expect(manifest.source).toBe('toolchain-setup');
    expect(manifest.mode).toBe('ta');
  });
});
