// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { OnboardingOverlay } from '../components/OnboardingOverlay';

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders only in Project mode for first-run orientation', () => {
    const project = render(<OnboardingOverlay mode="project" />);
    expect(project.queryByTestId('ide-onboarding-overlay')).not.toBeNull();

    project.unmount();

    const design = render(<OnboardingOverlay mode="design" />);
    expect(design.queryByTestId('ide-onboarding-overlay')).toBeNull();

    design.unmount();

    const importMode = render(<OnboardingOverlay mode="import" />);
    expect(importMode.queryByTestId('ide-onboarding-overlay')).toBeNull();
  });

  it('uses professional workflow and trust language', () => {
    const { getByTestId } = render(<OnboardingOverlay mode="project" />);

    const content = getByTestId('ide-onboarding-overlay').textContent ?? '';
    expect(content).toContain('Project -> Design → Verify → Map Pins → Export');
    expect(content).toContain('Draft export is artifact-ready');
    expect(content).toContain('Map Pins is required binding work, not behavior proof');
  });

  it('dismisses and persists the seen flag', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingOverlay mode="project" />);

    fireEvent.click(getByTestId('ide-onboarding-skip'));

    expect(localStorage.getItem('rb-onboarding-v1-seen')).toBe('1');
    expect(queryByTestId('ide-onboarding-overlay')).toBeNull();
  });

  it('opens Design when requested and persists dismissal', () => {
    const onOpenDesign = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <OnboardingOverlay mode="project" onOpenDesign={onOpenDesign} />
    );

    fireEvent.click(getByTestId('ide-onboarding-open-design'));

    expect(onOpenDesign).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('rb-onboarding-v1-seen')).toBe('1');
    expect(queryByTestId('ide-onboarding-overlay')).toBeNull();
  });
});
