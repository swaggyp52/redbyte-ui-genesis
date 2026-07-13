// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { IdeLeftRail } from '../components/IdeLeftRail';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { IdeTopBar } from '../components/IdeTopBar';
import { IDE_MODE_DEFINITIONS, STUDENT_WORKFLOW_SUMMARY } from '../workflowStages';

describe('workflow stage authority', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
  });

  it('shows Map Pins as the hardware route label in the top bar and left rail', () => {
    const topBar = render(
      <IdeTopBar
        projectName="Adder"
        saveState="saved"
        currentMode="hardware"
      />
    );
    expect(topBar.getByTestId('ide-topbar-mode-label').textContent).toBe('Map Pins');

    const rail = render(
      <IdeLeftRail
        currentMode="hardware"
        onModeChange={vi.fn()}
      />
    );
    expect(rail.getByTestId('mode-button-hardware').textContent).toContain('Map Pins');
  });

  it('teaches the Design → Verify → Map Pins → Export workflow in onboarding', () => {
    const { getByTestId } = render(<OnboardingOverlay mode="project" />);
    expect(getByTestId('ide-onboarding-overlay').textContent).toContain(STUDENT_WORKFLOW_SUMMARY);
  });

  it('keeps top-bar context plain and limited to board, Browser E0, build, save, and Help', () => {
    const onHelp = vi.fn();
    const onWorkflowHelp = vi.fn();
    const view = render(
      <IdeTopBar
        projectName="Adder"
        boardTarget="Basys3"
        saveState="saved"
        currentMode="design"
        buildIdentity={{
          fullSha: 'abcdef123456',
          shortSha: 'abcdef1',
          buildDate: null,
          envLabel: 'dev',
          title: 'Build abcdef1 · env dev',
        }}
        onHelp={onHelp}
        onWorkflowHelp={onWorkflowHelp}
      />
    );

    expect(view.getByTestId('ide-board-chip').textContent).toBe('BoardBasys3');
    expect(view.getByTestId('ide-proof-scope').textContent).toBe('Browser E0');
    expect(view.getByTestId('ide-build-badge').textContent).toContain('abcdef1');
    expect(view.getByTestId('ide-save-state').getAttribute('aria-label')).toBe('saved');
    expect(view.getByTestId('ide-topbar-help-btn').textContent).toBe('Help');
    expect(view.queryByTestId('ide-topbar-workflow-help-btn')).toBeNull();

    fireEvent.click(view.getByTestId('ide-topbar-help-btn'));
    expect(onHelp).toHaveBeenCalledTimes(1);
    expect(onWorkflowHelp).not.toHaveBeenCalled();
  });

  it('keeps import out of the student-facing mode definitions', () => {
    expect(IDE_MODE_DEFINITIONS.map((definition) => definition.id)).toEqual([
      'project',
      'design',
      'verify',
      'hardware',
      'export',
    ]);
  });
});
