import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeRBProject, type RBProject } from '../export/projectFormat';
import type { SubmissionGateResult } from '../labs/submissionGates';

const { SubmissionInspectorApp } = await import('../apps/SubmissionInspectorApp');
const SubmissionInspectorComponent = SubmissionInspectorApp.component as React.ComponentType<{
  onOpenSubmissionProject?: (payload: { project: RBProject; targetAppId: 'logic-playground' | 'ece-lab' }) => void | Promise<void>;
}>;

interface SubmissionFixtureOptions {
  doctorGates?: Array<{
    id: string;
    label: string;
    state: 'pass' | 'warn' | 'fail';
    detail: string;
    nextAction?: string;
  }>;
  repro?: {
    status: 'pass' | 'fail' | 'unknown';
    detail: string;
    ok?: boolean;
  };
  submissionGates?: SubmissionGateResult;
  omitDoctorReport?: boolean;
  omitReproducibility?: boolean;
  omitSubmissionGates?: boolean;
}

async function createSubmissionBundleFile(
  options: SubmissionFixtureOptions = {},
): Promise<{ file: File; bytes: Uint8Array }> {
  const project: RBProject = {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Bundle Fixture',
    circuit: { nodes: [], connections: [] },
    meta: { projectId: 'fixture-1', appSurface: 'ece-lab' },
  };

  const projectArchive = new JSZip();
  projectArchive.file('rb-project.json', encodeRBProject(project));
  projectArchive.file('circuit.rblogic', JSON.stringify({ nodes: [], connections: [] }));
  const projectArchiveBytes = await projectArchive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

  const submissionGates = options.submissionGates ?? { verdict: 'pass', issues: [] };
  const submissionGatesArtifact = {
    schema_version: 'rb_submission_gates_v1',
    labId: 'lab-3',
    timestamp: '2026-01-01T00:00:00.000Z',
    context: {
      projectId: 'fixture-1',
      projectName: 'Bundle Fixture',
    },
    result: submissionGates,
  };

  const submission = new JSZip();
  submission.file(
    'manifest.json',
    JSON.stringify(
      {
        schema_version: 'rb_submission_manifest_v1',
        bundleSchemaVersion: 'rb_submission_bundle_v1',
        bundleId: 'bundle-fixture-1',
        status: 'pass',
        project: { kind: 'rb-project', version: 1, id: 'fixture-1', name: 'Bundle Fixture' },
        readiness: {
          overall: 'ready',
          gates: [{ id: 'toolchain', state: 'pass', detail: 'All tools verified.' }],
        },
        submissionGates: {
          verdict: submissionGates.verdict,
          issuesCount: submissionGates.issues.length,
        },
        includedFiles: [],
      },
      null,
      2,
    ),
  );
  const doctorGates = options.doctorGates ?? [
    { id: 'toolchain_probe', label: 'Toolchain Probe', state: 'pass', detail: 'Toolchain probe passed.' },
  ];
  if (!options.omitDoctorReport) {
    submission.file(
      'doctor-report.json',
      JSON.stringify({
        reportId: 'doctor-fixture-1',
        backend_id: 'vivado',
        studentReadiness: {
          overall: 'ready',
          gates: doctorGates,
        },
      }),
    );
  }
  const repro = options.repro ?? {
    status: 'pass' as const,
    detail: 'Replay verification passed.',
    ok: true,
  };
  if (!options.omitReproducibility) {
    submission.file(
      'reproducibility.json',
      JSON.stringify({
        schema_version: 'rb_submission_reproducibility_v1',
        ok: typeof repro.ok === 'boolean' ? repro.ok : repro.status === 'pass',
        status: repro.status,
        detail: repro.detail,
        verificationStatus: repro.status === 'unknown' ? 'unknown' : repro.status,
        runRecord: { present: true, traceSamples: 0, replaySamples: 0, stimulusEvents: 0, tickCount: 0 },
      }),
    );
  }
  if (!options.omitSubmissionGates) {
    submission.file('submission-gates.json', JSON.stringify(submissionGatesArtifact));
  }
  submission.file('project.rbx.zip', projectArchiveBytes);
  const submissionBytes = await submission.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const file = new File([submissionBytes], 'rb-submission-fixture.zip', { type: 'application/zip' });
  return { file, bytes: submissionBytes };
}

describe('SubmissionInspectorApp submission bundle import', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows diagnostics export action only in TA mode', async () => {
    window.localStorage.setItem('rb:mode:v1', 'ta');
    render(<SubmissionInspectorComponent />);
    const { file, bytes } = await createSubmissionBundleFile();
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const input = screen.getByLabelText('Upload submission file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('submission-inspector-grader-summary')).toBeInTheDocument();
    });
    expect(screen.getByTestId('submission-inspector-export-diagnostics-button')).toBeInTheDocument();
  });

  it('hides grading surfaces in classroom lockdown for student mode', () => {
    window.localStorage.setItem('rb:classroom-lockdown:v1', JSON.stringify({ enabled: true }));
    render(<SubmissionInspectorComponent />);
    expect(screen.getByTestId('submission-inspector-lockdown')).toBeInTheDocument();
    expect(screen.queryByLabelText('Upload submission file')).not.toBeInTheDocument();
  });

  it('parses submission bundle and opens embedded project via callback', async () => {
    const onOpenSubmissionProject = vi.fn();
    render(<SubmissionInspectorComponent onOpenSubmissionProject={onOpenSubmissionProject} />);

    const { file, bytes } = await createSubmissionBundleFile();
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const input = screen.getByLabelText('Upload submission file') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('submission-inspector-grader-summary')).toBeInTheDocument();
    });
    expect(screen.getByText('bundle-fixture-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('submission-inspector-open-embedded-project'));

    await waitFor(() => expect(onOpenSubmissionProject).toHaveBeenCalledTimes(1));
    expect(onOpenSubmissionProject).toHaveBeenCalledWith(
      expect.objectContaining({
        targetAppId: 'ece-lab',
        project: expect.objectContaining({
          name: 'Bundle Fixture',
        }),
      }),
    );
  });

  it('renders NOT READY verdict with deterministic top failing gates and fail reason', async () => {
    render(<SubmissionInspectorComponent />);
    const { file, bytes } = await createSubmissionBundleFile({
      doctorGates: [
        { id: 'doctor_export', label: 'Doctor Export', state: 'fail', detail: 'Doctor export missing.', nextAction: 'Export doctor report.' },
        { id: 'toolchain_ui', label: 'Toolchain UI', state: 'fail', detail: 'Toolchain UI not configured.', nextAction: 'Open Toolchain Setup.' },
        { id: 'preflight', label: 'Preflight', state: 'warn', detail: 'Preflight warnings pending.', nextAction: 'Resolve warnings.' },
        { id: 'toolchain_probe', label: 'Toolchain Probe', state: 'fail', detail: 'Probe failed.', nextAction: 'Run probe.' },
      ],
      repro: {
        status: 'fail',
        detail: 'Replay mismatch at tick 42.\nAdditional debug line.',
        ok: false,
      },
    });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const input = screen.getByLabelText('Upload submission file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('submission-inspector-grade-verdict-label').textContent).toContain('NOT READY');
    });
    expect(screen.getByTestId('submission-inspector-repro-summary').textContent).toContain('FAIL');
    expect(screen.getByTestId('submission-inspector-repro-summary').textContent).toContain('Replay mismatch at tick 42.');
    expect(screen.getByTestId('submission-inspector-failing-gate-toolchain_probe')).toBeInTheDocument();
    expect(screen.getByTestId('submission-inspector-failing-gate-toolchain_ui')).toBeInTheDocument();
    expect(screen.getByTestId('submission-inspector-failing-gate-doctor_export')).toBeInTheDocument();
    expect(screen.queryByTestId('submission-inspector-failing-gate-preflight')).not.toBeInTheDocument();
  });

  it('shows NOT READY when submission gates include a blocking issue', async () => {
    render(<SubmissionInspectorComponent />);
    const { file, bytes } = await createSubmissionBundleFile({
      doctorGates: [
        { id: 'toolchain_probe', label: 'Toolchain Probe', state: 'pass', detail: 'Probe complete.' },
      ],
      repro: {
        status: 'pass',
        detail: 'Replay verification passed.',
        ok: true,
      },
      submissionGates: {
        verdict: 'block',
        issues: [
          {
            code: 'top_module_mismatch',
            severity: 'block',
            title: 'Top module is missing or incorrect',
            message: 'Expected top module top.',
          },
        ],
      },
    });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const input = screen.getByLabelText('Upload submission file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('submission-inspector-grade-verdict-label').textContent).toContain('NOT READY');
    });
    expect(screen.getByTestId('submission-inspector-failing-gate-submission_gate:top_module_mismatch')).toBeInTheDocument();
  });

  it('renders READY verdict when gates pass and reproducibility is pass', async () => {
    render(<SubmissionInspectorComponent />);
    const { file, bytes } = await createSubmissionBundleFile({
      doctorGates: [
        { id: 'toolchain_probe', label: 'Toolchain Probe', state: 'pass', detail: 'Probe complete.' },
        { id: 'preflight', label: 'Preflight', state: 'pass', detail: 'Preflight passed.' },
      ],
      repro: {
        status: 'pass',
        detail: 'Replay verification passed.',
        ok: true,
      },
    });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const input = screen.getByLabelText('Upload submission file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('submission-inspector-grade-verdict-label').textContent).toContain('READY');
    });
    expect(screen.getByTestId('submission-inspector-repro-summary').textContent).toContain('PASS');
  });

  it('renders READY (NO REPRO) when gates pass and reproducibility is skipped', async () => {
    render(<SubmissionInspectorComponent />);
    const { file, bytes } = await createSubmissionBundleFile({
      doctorGates: [
        { id: 'toolchain_probe', label: 'Toolchain Probe', state: 'pass', detail: 'Probe complete.' },
        { id: 'preflight', label: 'Preflight', state: 'pass', detail: 'Preflight passed.' },
      ],
      repro: {
        status: 'unknown',
        detail: 'Recording not present for replay verification.',
        ok: false,
      },
    });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const input = screen.getByLabelText('Upload submission file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('submission-inspector-grade-verdict-label').textContent).toContain('READY (NO REPRO)');
    });
    expect(screen.getByTestId('submission-inspector-repro-summary').textContent).toContain('SKIPPED');
  });

  it('handles missing optional submission artifacts gracefully', async () => {
    render(<SubmissionInspectorComponent />);
    const { file, bytes } = await createSubmissionBundleFile({
      omitDoctorReport: true,
      omitReproducibility: true,
      omitSubmissionGates: true,
    });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const input = screen.getByLabelText('Upload submission file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId('submission-inspector-grade-verdict-label')).toBeInTheDocument();
    });
    expect(screen.getByTestId('submission-inspector-summary-lab-id').textContent).toContain('unknown');
    expect(screen.getByTestId('submission-inspector-summary-timestamp').textContent).toContain('unknown');
    expect(screen.getByTestId('submission-inspector-summary-toolchain').textContent).toContain('unknown');
  });
});
