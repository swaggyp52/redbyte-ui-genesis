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
  runLabel: 'Run · observe only',
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

  it('keeps the session summary compact when checks are available', () => {
    const { getByTestId } = render(
      <VerifyCommandBar {...BASE} compareAvailable={true} />
    );
    expect(getByTestId('ide-vcb-session-summary').textContent).not.toContain('Observe first');
  });

  it('keeps the run-plan control in Tools when the utilities menu is available (no duplicate inline toggle)', () => {
    const onSetCompare = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        onSetCompare={onSetCompare}
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
      />
    );

    expect(queryByTestId('ide-vcb-mode-toggle')).toBeNull();
    expect(queryByTestId('ide-vcb-run-plan-toggle')).toBeNull();
    expect(queryByTestId('ide-vcb-use-saved-checks')).toBeNull();
    fireEvent.click(getByTestId('ide-vcb-utilities-toggle'));
    fireEvent.click(getByTestId('ide-vcb-run-plan-utility'));
    expect(onSetCompare).toHaveBeenCalledOnce();
  });

  it('shows an inline run-plan control when compare is available but Tools is not offered', () => {
    const onSetCompare = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        onSetCompare={onSetCompare}
      />
    );

    expect(queryByTestId('ide-vcb-utilities-toggle')).toBeNull();
    fireEvent.click(getByTestId('ide-vcb-use-saved-checks'));
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

  it('keeps only the detail toggle in the visible right-side status group', () => {
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
    expect(statusGroup!.contains(getByTestId('ide-verify-drawer-toggle'))).toBe(true);
    expect(container.querySelector('[data-testid=\"ide-vcb-run-plan-toggle\"]')).toBeNull();
  });

  it('collapses status, evidence, and coverage into one session summary cluster without a run-plan line', () => {
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
    expect(summary.getByTestId('ide-vcb-evidence')).toBeTruthy();
    expect(summary.getByTestId('ide-vcb-coverage')).toBeTruthy();
  });
});
