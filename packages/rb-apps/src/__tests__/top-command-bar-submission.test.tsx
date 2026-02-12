import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopCommandBar } from '../components/TopCommandBar';

describe('TopCommandBar submission bundle action', () => {
  it('renders submission bundle action and surfaces last filename', () => {
    const onGenerateSubmissionBundle = vi.fn();
    render(
      <TopCommandBar
        isRunning={false}
        onRun={() => undefined}
        onPause={() => undefined}
        onStep={() => undefined}
        tickCount={3}
        tickRate={10}
        onTickRateChange={() => undefined}
        perspective="standard"
        onPerspectiveChange={() => undefined}
        onHelp={() => undefined}
        onGenerateSubmissionBundle={onGenerateSubmissionBundle}
        submissionBundleFilename="rb-submission-demo.zip"
        submissionBundleStatus="pass"
      />
    );

    const button = screen.getByTestId('logic-playground-generate-submission-bundle');
    fireEvent.click(button);
    expect(onGenerateSubmissionBundle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('logic-playground-submission-bundle-filename').textContent).toContain(
      'rb-submission-demo.zip'
    );
    expect(screen.getByTestId('logic-playground-autosave-state').textContent).toContain('Saved');
  });

  it('shows unsaved autosave pill when dirty', () => {
    render(
      <TopCommandBar
        isRunning={false}
        onRun={() => undefined}
        onPause={() => undefined}
        onStep={() => undefined}
        tickCount={0}
        tickRate={10}
        onTickRateChange={() => undefined}
        perspective="standard"
        onPerspectiveChange={() => undefined}
        onHelp={() => undefined}
        isDirty={true}
      />
    );

    expect(screen.getByTestId('logic-playground-autosave-state').textContent).toContain('Unsaved changes');
  });
});
