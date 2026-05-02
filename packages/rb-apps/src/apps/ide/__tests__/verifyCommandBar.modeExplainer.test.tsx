// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { VerifyCommandBar, type VerifyCommandBarProps } from '../surfaces/verify/VerifyCommandBar';

const BASE: VerifyCommandBarProps = {
  isCompareMode: false,
  onSetObserve: vi.fn(),
  onSetCompare: vi.fn(),
  compareAvailable: true,
  onRun: vi.fn(),
  runLabel: 'Run observe pass',
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

describe('VerifyCommandBar mode explainer contract', () => {
  it('renders the inline Observe explainer beside the run-mode selector', () => {
    const onSetObserve = vi.fn();
    const onSetCompare = vi.fn();
    const { getByTestId } = render(
      <VerifyCommandBar
        {...BASE}
        isCompareMode={false}
        onSetObserve={onSetObserve}
        onSetCompare={onSetCompare}
      />
    );

    expect(getByTestId('ide-vcb-mode-explainer').textContent).toBe(
      'Run the stimulus and record observed outputs. No comparison.'
    );
    expect(getByTestId('ide-vcb-observe-only').getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('ide-vcb-use-saved-checks').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(getByTestId('ide-vcb-observe-only'));
    fireEvent.click(getByTestId('ide-vcb-use-saved-checks'));

    expect(onSetObserve).toHaveBeenCalledOnce();
    expect(onSetCompare).toHaveBeenCalledOnce();
  });

  it('switches the explainer text when Compare mode becomes active', () => {
    const view = render(
      <VerifyCommandBar
        {...BASE}
        isCompareMode={false}
      />
    );

    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toBe(
      'Run the stimulus and record observed outputs. No comparison.'
    );

    view.rerender(
      <VerifyCommandBar
        {...BASE}
        isCompareMode={true}
      />
    );

    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toBe(
      'Compare the run against saved expected outputs.'
    );
    expect(view.getByTestId('ide-vcb-observe-only').getAttribute('aria-pressed')).toBe('false');
    expect(view.getByTestId('ide-vcb-use-saved-checks').getAttribute('aria-pressed')).toBe('true');
  });
});
