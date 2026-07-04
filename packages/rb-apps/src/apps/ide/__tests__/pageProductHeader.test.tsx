// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { PageProductHeader } from '../components/PageProductHeader';

afterEach(() => {
  cleanup();
});

describe('PageProductHeader', () => {
  it('preserves the old next-step selector while exposing the structured product spine', () => {
    const { getByTestId } = render(
      <PageProductHeader
        mode="hardware"
        state={{
          statusLabel: 'Mapping missing',
          statusTone: 'warn',
          detail: 'Map SW0 and LD0 before export.',
        }}
      />
    );

    expect(getByTestId('ide-next-step-guide-hardware').textContent).toContain('What do I do next?');
    expect(getByTestId('ide-next-step-guide-hardware').textContent).toContain('Map required pins');
    expect(getByTestId('ide-product-spine-hardware').textContent).toContain('Hardware / Map Pins');
    expect(getByTestId('ide-product-spine-status-hardware').textContent).toContain('Mapping missing');
    expect(getByTestId('ide-product-spine-next-hardware').textContent).toContain('Map SW0 and LD0');
    expect(getByTestId('ide-product-spine-boundary-hardware').textContent).toContain('E1');
    expect(getByTestId('ide-product-spine-recover-hardware').textContent).toContain('Select a row');
    expect((getByTestId('ide-product-spine-details-hardware') as HTMLDetailsElement).open).toBe(false);

    fireEvent.click(getByTestId('ide-product-spine-details-hardware').querySelector('summary')!);
    expect((getByTestId('ide-product-spine-details-hardware') as HTMLDetailsElement).open).toBe(true);
  });

  it('routes primary and recovery actions without creating a second state authority', () => {
    const onPrimary = vi.fn();
    const onRecovery = vi.fn();
    const { getByTestId } = render(
      <PageProductHeader
        mode="verify"
        state={{
          statusLabel: 'Compare FAIL',
          statusTone: 'error',
          primaryLabel: 'Rerun Compare',
          onPrimary,
          recoveryLabel: 'Inspect Design',
          onRecovery,
          blockedLabel: 'One failed output check needs repair.',
        }}
      />
    );

    fireEvent.click(getByTestId('ide-product-spine-primary-verify'));
    fireEvent.click(getByTestId('ide-product-spine-recovery-verify'));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(getByTestId('ide-product-spine-blocked-verify').textContent).toContain('failed output');
    expect(getByTestId('ide-product-spine-recover-verify').textContent).toContain('Use observed values');
  });

  it('keeps the Project spine expanded because Project is the orientation surface', () => {
    const { getByTestId } = render(
      <PageProductHeader
        mode="project"
        state={{
          statusLabel: 'No circuit',
          statusTone: 'idle',
          detail: 'Choose Start a Lab or Build fresh.',
        }}
      />
    );

    expect((getByTestId('ide-product-spine-details-project') as HTMLDetailsElement).open).toBe(true);
  });
});
