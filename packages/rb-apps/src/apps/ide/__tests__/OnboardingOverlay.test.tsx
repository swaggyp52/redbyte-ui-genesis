// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingOverlay } from '../components/OnboardingOverlay';

describe('OnboardingOverlay mode copy', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not render the first-run overlay for Design mode', () => {
    const { queryByTestId } = render(<OnboardingOverlay mode="design" />);

    expect(queryByTestId('ide-onboarding-overlay')).toBeNull();
  });

  it('shows import-specific guidance instead of design-only instructions on Import', () => {
    const { getByTestId, queryByText } = render(<OnboardingOverlay mode="import" />);

    expect(getByTestId('ide-onboarding-overlay').textContent).toContain('Import a ZIP or paste HDL');
    expect(queryByText(/gate palette on the left/i)).toBeNull();
  });
});
