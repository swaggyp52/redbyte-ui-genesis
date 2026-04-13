// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VerifyFirstRunPanel } from '../surfaces/verify/VerifyFirstRunPanel';

afterEach(() => {
  cleanup();
});

describe('VerifyFirstRunPanel', () => {
  it('renders duplicate display labels without React key warnings', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <VerifyFirstRunPanel
        isSequential
        inputNames={['EN', 'EN', 'CLK']}
        outputNames={['LD0', 'LD0']}
        clockName="CLK"
        onGenerateStarter={() => {}}
        hasVectors={false}
      />
    );

    expect(screen.getAllByText('EN')).toHaveLength(2);
    expect(screen.getAllByText('LD0')).toHaveLength(2);
    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        typeof message === 'string' && message.includes('Encountered two children with the same key')
      )
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});