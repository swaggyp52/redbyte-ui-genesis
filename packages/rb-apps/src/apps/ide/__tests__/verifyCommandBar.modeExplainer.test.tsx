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
      'Record observed outputs without grading expected values.'
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
      'Record observed outputs without grading expected values.'
    );

    view.rerender(
      <VerifyCommandBar
        {...BASE}
        isCompareMode={true}
      />
    );

    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toBe(
      'Check filled expected outputs against this run.'
    );
    expect(view.getByTestId('ide-vcb-observe-only').getAttribute('aria-pressed')).toBe('false');
    expect(view.getByTestId('ide-vcb-use-saved-checks').getAttribute('aria-pressed')).toBe('true');
  });

  it('explains Observe while Observe is selected, even when Compare is blocked', () => {
    // A run that works must not be made to look incomplete by the state of a run nobody asked
    // for. The blocked reason belongs to Compare, and only while Compare is what is selected.
    const reason = 'Fill in at least one expected output to compare against.';
    const view = render(
      <VerifyCommandBar
        {...BASE}
        isCompareMode={false}
        compareAvailable={false}
        compareUnavailableReason={reason}
      />
    );

    const explainer = view.getByTestId('ide-vcb-mode-explainer');
    expect(explainer.textContent).toBe('Record observed outputs without grading expected values.');
    expect(explainer.className).not.toContain('is-blocked-reason');
    // Observe itself stays runnable with no reference outputs anywhere in the project.
    expect((view.getByTestId('ide-vcb-run') as HTMLButtonElement).disabled).toBe(false);

    view.rerender(
      <VerifyCommandBar
        {...BASE}
        isCompareMode={true}
        compareAvailable={false}
        compareUnavailableReason={reason}
      />
    );

    const blocked = view.getByTestId('ide-vcb-mode-explainer');
    expect(blocked.textContent).toBe(reason);
    expect(blocked.className).toContain('is-blocked-reason');
  });

  it('offers adding expected outputs as a secondary action without demoting Observe', () => {
    const onAuthorExpectedOutputs = vi.fn();
    const view = render(
      <VerifyCommandBar
        {...BASE}
        isCompareMode={false}
        compareAvailable={false}
        compareUnavailableReason="No expected outputs are filled in yet."
        needsExpectedOutputs
        onAuthorExpectedOutputs={onAuthorExpectedOutputs}
      />
    );

    const add = view.getByTestId('ide-vcb-author-expected');
    expect(add.textContent).toBe('Add expected outputs');
    // Run is the primary action; adding references is offered beside it, not instead of it.
    expect((view.getByTestId('ide-vcb-run') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(add);
    expect(onAuthorExpectedOutputs).toHaveBeenCalledOnce();

    // With no such need, the offer is absent rather than disabled.
    view.rerender(
      <VerifyCommandBar {...BASE} isCompareMode={false} needsExpectedOutputs={false} />
    );
    expect(view.queryByTestId('ide-vcb-author-expected')).toBeNull();
  });
});
