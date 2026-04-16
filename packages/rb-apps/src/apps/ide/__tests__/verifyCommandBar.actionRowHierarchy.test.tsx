// @vitest-environment jsdom
// B-14 Action Row Hierarchy — structural contracts for VerifyCommandBar
//
// The command bar should read as a professional tool row:
//   PRIMARY: Run (leftmost, first in DOM, most prominent)
//   SECONDARY: mode toggle (center, smaller visual weight)
//   UTILITIES: save-as-expected (rightmost, ghost, low visual weight)
//   INFORMATIONAL: status + evidence chips (right-aligned)
//
// These tests lock in the DOM ordering contract so visual hierarchy
// cannot accidentally regress through future JSX edits.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { VerifyCommandBar, type VerifyCommandBarProps } from '../surfaces/verify/VerifyCommandBar';

const BASE: VerifyCommandBarProps = {
  isCompareMode: false,
  onSetObserve: vi.fn(),
  onSetCompare: vi.fn(),
  compareAvailable: false,
  onRun: vi.fn(),
  runLabel: 'Run',
  runDisabled: false,
  onGenerate: vi.fn(),
  generateLabel: 'Initialize inputs',
  showGenerate: false,
  showSaveAsExpected: false,
  statusLabel: 'Ready',
  statusTone: 'idle',
  isSequential: false,
};

describe('B-14 Action Row Hierarchy — DOM order contracts', () => {
  it('Run button precedes mode toggle in DOM (Run is leftmost primary action)', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} />);
    const run = getByTestId('ide-vcb-run');
    const modeToggle = getByTestId('ide-vcb-mode-toggle');
    // Run should come BEFORE mode toggle: mode toggle FOLLOWS run in DOM
    const runBeforeMode =
      run.compareDocumentPosition(modeToggle) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(runBeforeMode).toBeTruthy();
  });

  it('mode toggle precedes status chip in DOM (mode row above session strip)', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} />);
    const modeToggle = getByTestId('ide-vcb-mode-toggle');
    const status = getByTestId('ide-vcb-status');
    const modeBeforeStatus =
      modeToggle.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(modeBeforeStatus).toBeTruthy();
  });

  it('experiment context sits between mode toggle and utilities on the primary row', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
        experimentScenarioName="ALU smoke"
        experimentCaseLabel="Case t2"
        experimentTimingHint="Manual-event lab mode"
      />
    );
    const modeToggle = getByTestId('ide-vcb-mode-toggle');
    const experiment = getByTestId('ide-vcb-experiment-context');
    const utilitiesToggle = getByTestId('ide-vcb-utilities-toggle');
    expect(
      modeToggle.compareDocumentPosition(experiment) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      experiment.compareDocumentPosition(utilitiesToggle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('marks idle emphasis when no case is selected', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        experimentScenarioName="Bench"
        experimentCaseLabel="No case selected"
      />
    );
    const caseEl = getByTestId('ide-vcb-experiment-case');
    expect(caseEl.className).toContain('is-idle');
  });

  it('marks locus emphasis when a case tick is selected', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        experimentScenarioName="Bench"
        experimentCaseLabel="Case t0"
      />
    );
    const caseEl = getByTestId('ide-vcb-experiment-case');
    expect(caseEl.className).toContain('is-locus');
  });

  it('more-actions disclosure is NOT inside the actions group', () => {
    const { getByTestId, container } = render(
      <VerifyCommandBar
        {...BASE}
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
        compareAvailable={true}
      />
    );
    const utilitiesToggle = getByTestId('ide-vcb-utilities-toggle');
    const actionsGroup = container.querySelector('.ide-vcb-group--actions');
    expect(actionsGroup).toBeTruthy();
    expect(actionsGroup!.contains(utilitiesToggle)).toBe(false);
  });

  it('more-actions disclosure lives inside the status group (right side)', () => {
    const { getByTestId, container } = render(
      <VerifyCommandBar
        {...BASE}
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
        compareAvailable={true}
      />
    );
    const utilitiesToggle = getByTestId('ide-vcb-utilities-toggle');
    const statusGroup = container.querySelector('.ide-vcb-group--status');
    expect(statusGroup).toBeTruthy();
    expect(statusGroup!.contains(utilitiesToggle)).toBe(true);
  });

  it('Run button is inside the actions group', () => {
    const { getByTestId, container } = render(<VerifyCommandBar {...BASE} />);
    const run = getByTestId('ide-vcb-run');
    const actionsGroup = container.querySelector('.ide-vcb-group--actions');
    expect(actionsGroup!.contains(run)).toBe(true);
  });

  it('mode toggle is NOT in the actions group (secondary, not primary area)', () => {
    const { getByTestId, container } = render(<VerifyCommandBar {...BASE} />);
    const modeToggle = getByTestId('ide-vcb-mode-toggle');
    const actionsGroup = container.querySelector('.ide-vcb-group--actions');
    expect(actionsGroup!.contains(modeToggle)).toBe(false);
  });
});

describe('B-14 Action Row Hierarchy — mode toggle still works', () => {
  it('mode toggle buttons are still present (Stimulus + Assertions)', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} />);
    expect(getByTestId('ide-vcb-mode-observe').textContent).toContain('Stimulus');
    expect(getByTestId('ide-vcb-mode-compare').textContent).toContain('Assertions');
  });

  it('keeps secondary command-bar actions hidden until More actions opens', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifyCommandBar
        {...BASE}
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

  it('active mode button has is-active class (Stimulus active by default)', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} isCompareMode={false} />);
    const stimulusBtn = getByTestId('ide-vcb-mode-observe');
    expect(stimulusBtn.className).toContain('is-active');
    const assertionBtn = getByTestId('ide-vcb-mode-compare');
    expect(assertionBtn.className).not.toContain('is-active');
  });

  it('collapses status, evidence, and coverage into one session summary cluster instead of separate chips', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        statusLabel="Ready to run stimulus"
        evidenceLabel="Stimulus evidence"
        coverageLabel="8 ticks · 5 signals"
        isSequential={true}
      />
    );

    const sessionSummary = getByTestId('ide-vcb-session-summary');
    expect(sessionSummary).toContainElement(getByTestId('ide-vcb-status'));
    expect(sessionSummary).toContainElement(getByTestId('ide-vcb-evidence'));
    expect(sessionSummary).toContainElement(getByTestId('ide-vcb-coverage'));
  });

  it('separates session status and mode tokens so stimulus runs do not collapse into one smashed label', () => {
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        sessionStatusBadge="STIMULUS ONLY"
        sessionModeLabel="CAPTURE"
        primaryStatusTitle="Waveform recorded"
      />
    );

    const sessionMeta = getByTestId('ide-verify-session-meta');
    expect(sessionMeta.textContent).toContain('STIMULUS ONLY');
    expect(sessionMeta.textContent).toContain('CAPTURE');
    expect(sessionMeta.textContent).toContain('·');
  });
});
