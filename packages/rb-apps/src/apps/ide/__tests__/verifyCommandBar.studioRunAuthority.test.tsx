// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerifyCommandBar } from '../surfaces/verify/VerifyCommandBar';

afterEach(cleanup);

describe('Simulation Studio command authority', () => {
  it('keeps one context-aware run command beside the five work lenses', () => {
    const onRun = vi.fn();
    const view = render(
      <VerifyCommandBar
        isCompareMode={true}
        onSetObserve={vi.fn()}
        onSetCompare={vi.fn()}
        compareAvailable={true}
        onRun={onRun}
        runLabel="Rerun simulation"
        runDisabled={false}
        workspaceMode="replay"
        onWorkspaceModeChange={vi.fn()}
        configuredCheckCount={16}
        hasReplay={true}
      />
    );

    const commandBar = view.getByTestId('ide-verify-command-bar');
    // The workbench's document tabs own Cases / Timing / Waveform; the command
    // bar carries no second instrument selector, only the run authority.
    expect(within(commandBar).queryAllByRole('tab')).toHaveLength(0);
    expect(view.queryByTestId('ide-vcb-run-mode')).toBeNull();
    expect(within(commandBar).getAllByTestId('ide-vcb-run')).toHaveLength(1);
    expect(view.getByTestId('ide-vcb-run').textContent).toBe('Rerun simulation');

    fireEvent.click(view.getByTestId('ide-vcb-run'));
    expect(onRun).toHaveBeenCalledOnce();
  });
});
