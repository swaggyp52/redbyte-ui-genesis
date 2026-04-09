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
import { render } from '@testing-library/react';
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

  it('mode toggle precedes status chip in DOM (mode is center, status is right)', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} />);
    const modeToggle = getByTestId('ide-vcb-mode-toggle');
    const status = getByTestId('ide-vcb-status');
    const modeBeforeStatus =
      modeToggle.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(modeBeforeStatus).toBeTruthy();
  });

  it('save-as-expected is NOT inside the actions group', () => {
    const { getByTestId, container } = render(
      <VerifyCommandBar
        {...BASE}
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
        compareAvailable={true}
      />
    );
    const saveBtn = getByTestId('ide-vcb-save-expected');
    const actionsGroup = container.querySelector('.ide-vcb-group--actions');
    expect(actionsGroup).toBeTruthy();
    // save-expected must not be a descendant of the actions group
    expect(actionsGroup!.contains(saveBtn)).toBe(false);
  });

  it('save-as-expected is inside the status group (right side)', () => {
    const { getByTestId, container } = render(
      <VerifyCommandBar
        {...BASE}
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
        compareAvailable={true}
      />
    );
    const saveBtn = getByTestId('ide-vcb-save-expected');
    const statusGroup = container.querySelector('.ide-vcb-group--status');
    expect(statusGroup).toBeTruthy();
    expect(statusGroup!.contains(saveBtn)).toBe(true);
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
  it('mode toggle buttons are still present (Observe + Compare)', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} />);
    expect(getByTestId('ide-vcb-mode-observe')).toBeTruthy();
    expect(getByTestId('ide-vcb-mode-compare')).toBeTruthy();
  });

  it('active mode button has is-active class (Observe active by default)', () => {
    const { getByTestId } = render(<VerifyCommandBar {...BASE} isCompareMode={false} />);
    const observeBtn = getByTestId('ide-vcb-mode-observe');
    expect(observeBtn.className).toContain('is-active');
    const compareBtn = getByTestId('ide-vcb-mode-compare');
    expect(compareBtn.className).not.toContain('is-active');
  });
});
