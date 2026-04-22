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

  it('keeps the next-run mode selector visible even when Tools is offered', () => {
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

    expect(getByTestId('ide-vcb-run-mode')).toBeTruthy();
    expect(queryByTestId('ide-vcb-run-plan-utility')).toBeNull();
    fireEvent.click(getByTestId('ide-vcb-use-saved-checks'));
    expect(onSetCompare).toHaveBeenCalledOnce();
  });

  it('shows explicit observe and compare choices when checks are available', () => {
    const onSetCompare = vi.fn();
    const onSetObserve = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        onSetObserve={onSetObserve}
        onSetCompare={onSetCompare}
      />
    );

    expect(queryByTestId('ide-vcb-utilities-toggle')).toBeNull();
    fireEvent.click(getByTestId('ide-vcb-observe-only'));
    expect(onSetObserve).toHaveBeenCalledOnce();
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
    expect(getByTestId('ide-vcb-save-expected')).toBeTruthy();
    expect(getByTestId('ide-verify-run-proof-edit-vectors')).toBeTruthy();
  });

  it('keeps detail controls on the right without moving the run mode into Tools', () => {
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
    expect(getByTestId('ide-vcb-run-mode')).toBeTruthy();
  });

  it('dedupes repeated session labels inside the session summary cluster', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        statusLabel="Checks need review"
        sessionStatusBadge="Checks need review"
        sessionTitle="Checks need review"
        sessionModeLabel="Checks armed"
        evidenceLabel="3 observed rows"
        coverageLabel="80% coverage"
        sessionMetricsRow="inline"
      />
    );

    const summary = within(getByTestId('ide-vcb-session-summary'));
    expect(summary.getByTestId('ide-vcb-status')).toBeTruthy();
    expect(summary.getByTestId('ide-vcb-evidence')).toBeTruthy();
    expect(summary.getByTestId('ide-vcb-coverage')).toBeTruthy();
    const fullText = getByTestId('ide-vcb-session-summary').textContent ?? '';
    expect(fullText.match(/Checks need review/g)?.length ?? 0).toBe(1);
  });

  it('renders a visible failure recovery line when provided (before opening details)', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        failureRecoveryLine="Find the first mismatch on the waveform, then fix checks or the circuit."
      />
    );
    expect(getByTestId('ide-vcb-failure-recovery').textContent).toContain('first mismatch');
  });
});
