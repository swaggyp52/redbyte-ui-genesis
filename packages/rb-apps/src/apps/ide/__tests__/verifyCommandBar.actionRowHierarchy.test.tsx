// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { VerifyCommandBar, type VerifyCommandBarProps } from '../surfaces/verify/VerifyCommandBar';

const BASE: VerifyCommandBarProps = {
  isCompareMode: false,
  onSetObserve: vi.fn(),
  onSetCompare: vi.fn(),
  compareAvailable: false,
  onRun: vi.fn(),
  runLabel: 'Run Observe',
  runDisabled: false,
};

afterEach(() => {
  cleanup();
});

describe('VerifyCommandBar compact run-loop hierarchy', () => {
  it('renders only the mode selector, one Run action, and one short explainer', () => {
    const view = render(<VerifyCommandBar {...BASE} />);
    const command = view.getByTestId('ide-verify-command-bar');
    const buttons = within(command).getAllByRole('button');

    expect(buttons).toHaveLength(3);
    expect(within(view.getByTestId('ide-vcb-run-authority')).getAllByRole('button')).toHaveLength(1);
    expect(view.getAllByTestId('ide-vcb-run')).toHaveLength(1);
    expect(view.queryByTestId('ide-vcb-generate')).toBeNull();
    expect(view.queryByTestId('ide-vcb-session-summary')).toBeNull();
    expect(view.queryByTestId('ide-vcb-support-actions')).toBeNull();
    expect(view.queryByTestId('ide-vcb-utilities-panel')).toBeNull();
    expect(command.querySelector('details')).toBeNull();
  });

  it('orders the selector before Run and the explainer after Run', () => {
    const view = render(<VerifyCommandBar {...BASE} />);
    const mode = view.getByTestId('ide-vcb-run-intent');
    const run = view.getByTestId('ide-vcb-run-authority');
    const explainer = view.getByTestId('ide-vcb-mode-explainer');

    expect(mode.compareDocumentPosition(run) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(run.compareDocumentPosition(explainer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps both mode choices visible and disables Compare until expected values exist', () => {
    const view = render(<VerifyCommandBar {...BASE} compareAvailable={false} />);

    expect(view.getByTestId('ide-vcb-observe-only').textContent).toBe('Observe');
    expect(view.getByTestId('ide-vcb-use-saved-checks').textContent).toBe('Compare');
    expect((view.getByTestId('ide-vcb-use-saved-checks') as HTMLButtonElement).disabled).toBe(true);
  });

  it('preserves Observe, Compare, and Run callback behavior', () => {
    const onSetCompare = vi.fn();
    const onSetObserve = vi.fn();
    const onRun = vi.fn();
    const view = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        onSetObserve={onSetObserve}
        onSetCompare={onSetCompare}
        onRun={onRun}
      />
    );

    fireEvent.click(view.getByTestId('ide-vcb-observe-only'));
    fireEvent.click(view.getByTestId('ide-vcb-use-saved-checks'));
    fireEvent.click(view.getByTestId('ide-vcb-run'));
    expect(onSetObserve).toHaveBeenCalledOnce();
    expect(onSetCompare).toHaveBeenCalledOnce();
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('restores keyboard focus to the updated Run command after completion', async () => {
    const view = render(<VerifyCommandBar {...BASE} runLabel="Run Compare" />);
    const run = view.getByTestId('ide-vcb-run');
    run.focus();
    fireEvent.click(run);

    view.rerender(<VerifyCommandBar {...BASE} runLabel="Running Compare" runDisabled={true} />);
    view.rerender(<VerifyCommandBar {...BASE} runLabel="Update Compare" runDisabled={false} />);

    await waitFor(() => expect(document.activeElement).toBe(view.getByTestId('ide-vcb-run')));
    expect(document.activeElement?.textContent).toContain('Update Compare');
  });

  it('restores Run focus when disabling it falls back to the document body', async () => {
    const view = render(<VerifyCommandBar {...BASE} runLabel="Run Compare" />);
    const run = view.getByTestId('ide-vcb-run');
    run.focus();
    fireEvent.click(run);

    view.rerender(<VerifyCommandBar {...BASE} runLabel="Running Compare" runDisabled={true} />);
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
    expect([document.body, document.documentElement]).toContain(document.activeElement);

    vi.mocked(window.requestAnimationFrame).mockImplementationOnce((callback) => {
      callback(0);
      return 1;
    });
    view.rerender(<VerifyCommandBar {...BASE} runLabel="Update Compare" runDisabled={false} />);

    await waitFor(() => expect(document.activeElement).toBe(view.getByTestId('ide-vcb-run')));
  });

  it('preserves a deliberate focus move while Run is active', async () => {
    const view = render(
      <VerifyCommandBar {...BASE} compareAvailable={true} runLabel="Run Compare" />
    );
    const run = view.getByTestId('ide-vcb-run');
    run.focus();
    fireEvent.click(run);

    view.rerender(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        runLabel="Running Compare"
        runDisabled={true}
      />
    );
    const observe = view.getByTestId('ide-vcb-observe-only');
    observe.focus();
    expect(document.activeElement).toBe(observe);

    vi.mocked(window.requestAnimationFrame).mockImplementationOnce((callback) => {
      callback(0);
      return 1;
    });
    view.rerender(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        runLabel="Update Compare"
        runDisabled={false}
      />
    );

    expect(document.activeElement).toBe(observe);
  });

  it('does not reintroduce legacy status, generation, or repair controls', () => {
    const view = render(
      <VerifyCommandBar
        {...BASE}
        compareAvailable={true}
        showGenerate={true}
        onGenerate={vi.fn()}
        generateLabel="Seed stimulus"
        showSaveAsExpected={true}
        onSaveAsExpected={vi.fn()}
        showEditCases={true}
        onEditCases={vi.fn()}
        showAnalysisToggle={true}
        onToggleAnalysis={vi.fn()}
        statusLabel="Checks need review"
      />
    );

    expect(view.queryByText('Seed stimulus')).toBeNull();
    expect(view.queryByText('Checks need review')).toBeNull();
    expect(view.queryByText('Edit expected outputs')).toBeNull();
    expect(view.queryByText('Inspect run')).toBeNull();
  });
});
