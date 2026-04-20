// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { VerifyCommandBar, type VerifyCommandBarProps } from '../surfaces/verify/VerifyCommandBar';

const BASE: VerifyCommandBarProps = {
  isCompareMode: false,
  onSetObserve: vi.fn(),
  onSetCompare: vi.fn(),
  compareAvailable: false,
  onRun: vi.fn(),
  runLabel: 'Run current stimulus',
  runDisabled: false,
  onGenerate: vi.fn(),
  generateLabel: 'Seed stimulus',
  showGenerate: false,
  showSaveAsExpected: false,
  statusLabel: 'Draft',
  statusTone: 'idle',
  isSequential: false,
};

afterEach(() => {
  cleanup();
});

describe('VerifyCommandBar session header hierarchy', () => {
  it('keeps Run as the first primary action before the session summary cluster', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} />);
    const run = getByTestId('ide-vcb-run');
    const sessionSummary = getByTestId('ide-vcb-session-summary');
    expect(
      run.compareDocumentPosition(sessionSummary) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows the compact run-plan label inside the session summary when checks are available', () => {
    const { getByTestId } = render(
      <VerifyCommandBar {...BASE} compareAvailable={true} />
    );
    expect(getByTestId('ide-vcb-run-plan-label').textContent).toContain('Observe first');
  });

  it('uses a single run-plan toggle instead of the old mode toggle row', () => {
    const onSetCompare = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        onSetCompare={onSetCompare}
      />
    );

    expect(queryByTestId('ide-vcb-mode-toggle')).toBeNull();
    fireEvent.click(getByTestId('ide-vcb-run-plan-toggle'));
    expect(onSetCompare).toHaveBeenCalledOnce();
  });

  it('keeps utilities hidden until Tools opens', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
        showEditCases={true}
        onEditCases={vi.fn()}
      />
    );

    expect(queryByTestId('ide-vcb-utilities-panel')).toBeNull();
    fireEvent.click(getByTestId('ide-vcb-utilities-toggle'));
    expect(getByTestId('ide-vcb-utilities-panel')).toBeTruthy();
    expect(getByTestId('ide-vcb-run-plan-utility')).toBeTruthy();
    expect(getByTestId('ide-vcb-save-expected')).toBeTruthy();
    expect(getByTestId('ide-verify-run-proof-edit-vectors')).toBeTruthy();
  });

  it('keeps the run-plan toggle and detail toggle in the right-side status group', () => {
    const { getByTestId, container } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        showAnalysisToggle={true}
        onToggleAnalysis={vi.fn()}
      />
    );

    const statusGroup = container.querySelector('.ide-vcb-group--status');
    expect(statusGroup).toBeTruthy();
    expect(statusGroup!.contains(getByTestId('ide-vcb-run-plan-toggle'))).toBe(true);
    expect(statusGroup!.contains(getByTestId('ide-verify-drawer-toggle'))).toBe(true);
  });

  it('collapses status, evidence, and coverage into one session summary cluster', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        statusLabel="Observation only"
        evidenceLabel="3 observed rows"
        coverageLabel="80% coverage"
        sessionMetricsRow="inline"
      />
    );

    const summary = within(getByTestId('ide-vcb-session-summary'));
    expect(summary.getByTestId('ide-vcb-status')).toBeTruthy();
    expect(summary.getByTestId('ide-vcb-run-plan-label')).toBeTruthy();
    expect(summary.getByTestId('ide-vcb-evidence')).toBeTruthy();
    expect(summary.getByTestId('ide-vcb-coverage')).toBeTruthy();
  });
});
