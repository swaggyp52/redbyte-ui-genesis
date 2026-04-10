// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { IdeLeftRail } from '../components/IdeLeftRail';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { IdeTopBar } from '../components/IdeTopBar';
import { STUDENT_WORKFLOW_SUMMARY } from '../workflowStages';

describe('workflow stage authority', () => {
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
});
