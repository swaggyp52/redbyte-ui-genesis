// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingOverlay } from '../components/OnboardingOverlay';

describe('OnboardingOverlay mode copy', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows import-specific guidance instead of design-only instructions on Import', () => {
    const { getByTestId, queryByText } = render(<OnboardingOverlay mode="import" />);

    expect(getByTestId('ide-onboarding-overlay').textContent).toContain('Start with a ZIP or HDL');
    expect(queryByText(/gate palette on the left/i)).toBeNull();
  });
});
