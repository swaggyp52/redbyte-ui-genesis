// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { IdeLeftRail } from '../components/IdeLeftRail';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { PipelineStrip } from '../components/PipelineStrip';
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

  it('shows Map Pins in the pipeline strip instead of Hardware', () => {
    const { getByTestId } = render(
      <PipelineStrip
        currentMode="hardware"
        health={{
          lastVerify: undefined,
          lastExport: undefined,
          dirtySinceVerify: false,
          dirtySinceExport: false,
          blockingIssues: [],
        }}
        primaryCta={{ label: 'Map Pins', mode: 'hardware', code: 'RBP1005' }}
        onNavigate={vi.fn()}
      />
    );

    const ariaLabel = getByTestId('ide-pipeline-stage-hardware').getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('Map Pins');
    expect(ariaLabel.toLowerCase()).toContain('active');
  });

  it('teaches the full Design → Verify → Map Pins → Export → Program workflow in onboarding', () => {
    const { getByTestId } = render(<OnboardingOverlay mode="project" />);
    expect(getByTestId('ide-onboarding-overlay').textContent).toContain(STUDENT_WORKFLOW_SUMMARY);
  });
});
