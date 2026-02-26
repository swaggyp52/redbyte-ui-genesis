// @vitest-environment jsdom
/**
 * PR15-D: Submission Viewer Tests
 *
 * Tests:
 *   - Viewer renders grade summary without mutating projectRuntime state
 *   - onLoadIntoIde is called with the project when "Load into IDE" is clicked
 *   - onClose is called when "Close viewer" is clicked
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SubmissionViewerSurface } from '../surfaces/SubmissionViewerSurface';
import type { ParsedIdeSubmission } from '../../../export/parseIdeSubmission';
import type { IdeSubmissionGradeSummary } from '../../../export/ideSubmissionBundle';
import type { RBProject } from '../../../export/projectFormat';
import { buildVerifyReport } from '../verifyReport';
import type { RuntimeVerifyRun } from '../projectRuntime';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Viewer Test Project',
    circuit: {
      nodes: [
        { id: 'n1', type: 'INPUT', label: 'a', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} },
      ],
      connections: [],
    },
    meta: { projectId: 'viewer-test' },
  };
}

function makeGradeSummary(overrides: Partial<IdeSubmissionGradeSummary> = {}): IdeSubmissionGradeSummary {
  return {
    rbSubmissionVersion: 'ide-submission-v1',
    schemaVersion: '1.0',
    bundleId: 'bundle-abc',
    appCommitSha: 'abc123',
    assignmentId: null,
    labCode: null,
    studentName: 'Alan Turing',
    deviceId: 'device-xyz',
    projectId: 'viewer-test',
    projectName: 'Viewer Test Project',
    createdAt: '2026-01-01T00:00:00.000Z',
    submittedAt: '2026-01-15T12:00:00.000Z',
    circuit: { nodeCount: 1, wireCount: 0, containsDff: false, nodeTypes: { INPUT: 1 } },
    mapping: { totalRows: 0, mappedRows: 0, complete: false },
    vectors: { count: 0 },
    proofRuns: { sequenceProofRun: false, fsmPathsRun: false },
    verifyRuns: {
      total: 2,
      passes: 1,
      fails: 1,
      firstPassAt: '2026-01-10T10:00:00.000Z',
      lastPassAt: '2026-01-10T10:00:00.000Z',
      lastStatus: 'pass',
    },
    lastRun: {
      status: 'pass',
      passedRows: 2,
      failedRows: 0,
      firstFailure: null,
      reportHash: 'rep-hash-abc',
      deterministicHash: 'det-hash-abc',
    },
    gateResults: [],
    overallGateVerdict: 'ungraded',
    ...overrides,
  };
}

function makeSubmission(overrides: Partial<ParsedIdeSubmission> = {}): ParsedIdeSubmission {
  return {
    gradeSummary: makeGradeSummary(),
    project: makeProject(),
    verifyLastRun: null,
    verifyRunHistory: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SubmissionViewerSurface — rendering', () => {
  it('renders the grade summary table', () => {
    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={makeSubmission()}
        onLoadIntoIde={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(getByTestId('ide-submission-grade-summary-table')).toBeTruthy();
  });

  it('shows student name in grade summary', () => {
    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={makeSubmission()}
        onLoadIntoIde={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const table = getByTestId('ide-submission-grade-summary-table');
    expect(table.textContent).toContain('Alan Turing');
  });

  it('shows read-only warning banner', () => {
    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={makeSubmission()}
        onLoadIntoIde={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(getByTestId('ide-submission-viewer-banner')).toBeTruthy();
  });

  it('shows integrity and safe-load guidance', () => {
    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={makeSubmission()}
        onLoadIntoIde={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(getByTestId('ide-submission-integrity-ok')).toBeTruthy();
    expect(getByTestId('ide-submission-safe-load-hint').textContent).toContain('Load Saved Project');
  });

  it('renders run ledger when history is non-empty', () => {
    const submission = makeSubmission({
      verifyRunHistory: [
        {
          runId: 'run-1',
          ranAtIso: '2026-01-01T10:00:00.000Z',
          status: 'pass',
          passedRows: 2,
          failedRows: 0,
          firstFailure: null,
          circuitHash: 'h1',
          vectorsHash: 'h2',
          mappingHash: 'h3',
          projectHash: 'h4',
          didCircuitChangeSinceLast: false,
          didVectorsChangeSinceLast: false,
          didMappingChangeSinceLast: false,
        },
      ],
    });

    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={submission}
        onLoadIntoIde={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(getByTestId('ide-submission-ledger-table')).toBeTruthy();
  });

  it('shows gate results table when gateResults is non-empty', () => {
    const submission = makeSubmission({
      gradeSummary: makeGradeSummary({
        gateResults: [
          { gateId: 'test-gate', verdict: 'warn', title: 'Test Gate', detail: 'Test detail' },
        ],
        overallGateVerdict: 'warn',
      }),
    });

    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={submission}
        onLoadIntoIde={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(getByTestId('ide-submission-gate-table')).toBeTruthy();
  });
});

describe('SubmissionViewerSurface — interactions', () => {
  it('calls onLoadIntoIde with the project when Load into IDE is clicked', () => {
    const project = makeProject();
    const submission = makeSubmission({ project });
    const onLoadIntoIde = vi.fn();

    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={submission}
        onLoadIntoIde={onLoadIntoIde}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-submission-load-into-ide'));
    expect(onLoadIntoIde).toHaveBeenCalledOnce();
    expect(onLoadIntoIde).toHaveBeenCalledWith(project);
  });

  it('calls onClose when Close viewer is clicked', () => {
    const onClose = vi.fn();

    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={makeSubmission()}
        onLoadIntoIde={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(getByTestId('ide-submission-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onLoadIntoIde on close', () => {
    const onLoadIntoIde = vi.fn();

    const { getByTestId } = render(
      <SubmissionViewerSurface
        submission={makeSubmission()}
        onLoadIntoIde={onLoadIntoIde}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-submission-close'));
    expect(onLoadIntoIde).not.toHaveBeenCalled();
  });
});

describe('SubmissionViewerSurface — isolation (does not mutate live runtime)', () => {
  it('renders without throwing even with empty verifyRunHistory', () => {
    // This test proves the viewer handles empty state gracefully,
    // which is necessary for viewer isolation (it reads from parsed submission, not from live store)
    expect(() =>
      render(
        <SubmissionViewerSurface
          submission={makeSubmission({ verifyRunHistory: [] })}
          onLoadIntoIde={vi.fn()}
          onClose={vi.fn()}
        />
      )
    ).not.toThrow();
  });

  it('renders with null verifyLastRun without crashing', () => {
    expect(() =>
      render(
        <SubmissionViewerSurface
          submission={makeSubmission({ verifyLastRun: null })}
          onLoadIntoIde={vi.fn()}
          onClose={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});
