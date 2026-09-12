// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { VerifyCommandBar, type VerifyCommandBarProps } from '../surfaces/verify/VerifyCommandBar';
const BASE: VerifyCommandBarProps = { isCompareMode: false, onSetObserve: vi.fn(), onSetCompare: vi.fn(),
  compareAvailable: false, onRun: vi.fn(), runLabel: 'Run', runDisabled: false };
afterEach(cleanup);

describe('Run explains its actual inputs and checks', () => {
  it('states that zero checks produce a recording without a verdict', () => {
    const view = render(<VerifyCommandBar {...BASE} configuredCheckCount={0} />);
    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toContain('without a pass/fail verdict');
    expect((view.getByTestId('ide-vcb-run') as HTMLButtonElement).disabled).toBe(false);
    expect(view.queryByRole('button', { name: /^Compare$/ })).toBeNull();
  });
  it('automatically explains the current check count when checks are added or removed', () => {
    const view = render(<VerifyCommandBar {...BASE} configuredCheckCount={0} />);
    view.rerender(<VerifyCommandBar {...BASE} configuredCheckCount={3} />);
    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toBe('3 saved checks are evaluated automatically.');
    view.rerender(<VerifyCommandBar {...BASE} configuredCheckCount={0} />);
    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toContain('No checks configured');
  });
  it('states a structural blocking reason in visible text and prevents dispatch', () => {
    const onRun = vi.fn();
    const reason = 'Connect the undriven output before checking it.';
    const view = render(<VerifyCommandBar {...BASE} onRun={onRun} runDisabled runBlockedReason={reason} />);
    expect(view.getByTestId('ide-vcb-mode-explainer').textContent).toBe(reason);
    expect(view.getByTestId('ide-vcb-mode-explainer').className).toContain('is-blocked-reason');
    fireEvent.click(view.getByTestId('ide-vcb-run')); expect(onRun).not.toHaveBeenCalled();
  });
  it('offers reproduction only when a recording can be selected', () => {
    const view = render(<VerifyCommandBar {...BASE} />);
    expect(view.queryByTestId('ide-vcb-reproduce')).toBeNull();
    const onReproduce = vi.fn();
    view.rerender(<VerifyCommandBar {...BASE} onReproduce={onReproduce} />);
    fireEvent.click(view.getByTestId('ide-vcb-reproduce')); expect(onReproduce).toHaveBeenCalledOnce();
  });
  it('explains unavailable saved inputs without disabling the current draft run', () => {
    const onReproduce = vi.fn(); const reason = 'This recording did not retain reproduction inputs.';
    const view = render(<VerifyCommandBar {...BASE} onReproduce={onReproduce} reproduceDisabledReason={reason} />);
    expect(view.getByText(reason)).toBeTruthy();
    fireEvent.click(view.getByTestId('ide-vcb-reproduce')); expect(onReproduce).not.toHaveBeenCalled();
    expect((view.getByTestId('ide-vcb-run') as HTMLButtonElement).disabled).toBe(false);
  });
});
