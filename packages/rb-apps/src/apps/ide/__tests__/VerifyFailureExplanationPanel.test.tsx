// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { VerifyFailureExplanationPanel } from '../surfaces/VerifyFailureExplanationPanel';
import { classifyVerifyFailure } from '../surfaces/verify-failure-classifier';

describe('VerifyFailureExplanationPanel', () => {
  it('shows required signal key, expected, actual, and likely reason', () => {
    const classification = classifyVerifyFailure({
      expected: '1',
      actual: '0',
      isSequential: false,
    });

    const { getByTestId } = render(
      <VerifyFailureExplanationPanel
        failure={{ tick: 5, signal: 'LED0', expected: '1', actual: '0' }}
        classification={classification}
      />
    );

    expect(getByTestId('ide-verify-right-signal-key').textContent).toContain('LED0');
    expect(getByTestId('ide-verify-right-expected').textContent).toContain('1');
    expect(getByTestId('ide-verify-right-actual').textContent).toContain('0');
    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('expected 1, got 0');
  });

  it('shows an empty-state message when no failure is selected', () => {
    const { getByText } = render(
      <VerifyFailureExplanationPanel failure={null} classification={null} />
    );

    expect(getByText('Select a failing vector row to inspect expected vs actual output.')).toBeTruthy();
  });
});
