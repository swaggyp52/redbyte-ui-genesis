// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { VerifyFailureExplanationPanel } from '../surfaces/VerifyFailureExplanationPanel';
import { classifyVerifyFailure } from '../surfaces/verify-failure-classifier';

afterEach(() => {
  cleanup();
});

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

    expect(getByTestId('ide-verify-right-summary').textContent).toContain('At t5');
    expect(getByTestId('ide-verify-right-summary').textContent).toContain('LED0');
    expect(getByTestId('ide-verify-right-signal-key').textContent).toContain('LED0');
    expect(getByTestId('ide-verify-right-expected').textContent).toContain('1');
    expect(getByTestId('ide-verify-right-actual').textContent).toContain('0');
    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('expected 1, got 0');
    expect(getByTestId('ide-verify-right-next-step').textContent).toContain('LED0');
  });

  it('uses evidence reason to produce plain-language floating guidance and concrete next inspection step', () => {
    const classification = classifyVerifyFailure({
      expected: '1',
      actual: '-',
      isSequential: false,
    });

    const { getByTestId } = render(
      <VerifyFailureExplanationPanel
        failure={{ tick: 3, signal: 'sum_out', expected: '1', actual: '-' }}
        classification={classification}
        reasonCode="missing-output-sample"
      />
    );

    expect(getByTestId('ide-verify-right-summary').textContent).toContain('sum_out');
    expect(getByTestId('ide-verify-right-summary').textContent).toContain('t3');
    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('floating or undriven');
    expect(getByTestId('ide-verify-right-next-step').textContent).toContain('wire feeding sum_out');
  });

  it('uses pattern next-inspect guidance for mismatches to keep next action explicit', () => {
    const classification = classifyVerifyFailure({
      expected: '1',
      actual: '0',
      isSequential: false,
    });

    const { getByTestId } = render(
      <VerifyFailureExplanationPanel
        failure={{ tick: 7, signal: 'carry_out', expected: '1', actual: '0' }}
        classification={classification}
        patternNextInspect="Compare the last passing tick to t7 and inspect the carry path transition."
      />
    );

    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('carry_out mismatched at t7');
    expect(getByTestId('ide-verify-right-next-step').textContent).toContain('inspect the carry path transition');
  });

  it('frames sequential expectation failures as timing alignment work', () => {
    const classification = classifyVerifyFailure({
      expected: '1',
      actual: '0',
      isSequential: true,
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
    });

    const { getByTestId } = render(
      <VerifyFailureExplanationPanel
        failure={{ tick: 2, signal: 'Q', expected: '1', actual: '0' }}
        classification={classification}
      />
    );

    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('Clock or sample timing likely differs');
    expect(getByTestId('ide-verify-right-next-step').textContent).toContain('Inspect clock, reset, and enable alignment around t2');
  });

  it('shows an empty-state message when no failure is selected', () => {
    const { getByText } = render(
      <VerifyFailureExplanationPanel failure={null} classification={null} />
    );

    expect(getByText('Select a differing row to inspect expected vs observed output.')).toBeTruthy();
  });
});
