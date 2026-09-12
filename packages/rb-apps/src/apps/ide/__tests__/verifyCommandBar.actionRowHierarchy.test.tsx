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
  it('offers one Run without a mode choice and states the optional check count', () => {
    const view = render(<VerifyCommandBar {...BASE} configuredCheckCount={0} />);
    expect(within(view.getByTestId('ide-verify-command-bar')).getAllByRole('button')).toHaveLength(1);
    expect(view.getByTestId('ide-vcb-check-count').textContent).toContain('0 optional checks');
    expect(view.queryByTestId('ide-vcb-observe-only')).toBeNull();
    expect(view.queryByTestId('ide-vcb-use-saved-checks')).toBeNull();
  });

  it('places scenario context before Run and its execution explanation after Run', () => {
    const view = render(<VerifyCommandBar {...BASE} experimentScenarioName="Carry propagation" />);
    const context = view.getByText('Carry propagation');
    const run = view.getByTestId('ide-vcb-run-authority');
    expect(context.compareDocumentPosition(run) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(run.compareDocumentPosition(view.getByTestId('ide-vcb-mode-explainer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Run available when no optional checks exist', () => {
    const onRun = vi.fn();
    const view = render(<VerifyCommandBar {...BASE} configuredCheckCount={0} onRun={onRun} />);
    fireEvent.click(view.getByTestId('ide-vcb-run'));
    expect(onRun).toHaveBeenCalledOnce();
    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toContain('without a pass/fail verdict');
  });

  it('dispatches current inputs and reproduction through distinct commands', () => {
    const onRun = vi.fn(); const onReproduce = vi.fn();
    const view = render(<VerifyCommandBar {...BASE} onRun={onRun} onReproduce={onReproduce} />);
    fireEvent.click(view.getByTestId('ide-vcb-reproduce'));
    expect(onReproduce).toHaveBeenCalledOnce(); expect(onRun).not.toHaveBeenCalled();
    fireEvent.click(view.getByTestId('ide-vcb-run'));
    expect(onRun).toHaveBeenCalledOnce(); expect(onReproduce).toHaveBeenCalledOnce();
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
    const observe = document.createElement('button');
    observe.textContent = 'Scenario navigation';
    document.body.appendChild(observe);
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
    observe.remove();
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
