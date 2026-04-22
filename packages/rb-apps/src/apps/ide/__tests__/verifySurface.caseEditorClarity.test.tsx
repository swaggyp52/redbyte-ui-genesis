// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';

const WITH_VECTORS = {
  hasVectors: true,
  vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
};

const NO_VECTORS = {
  hasVectors: false,
  vectors: [],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
};

describe('Verify first-run composition', () => {
  it('does not render the retired first-run hero when vectors exist and no lastRun', () => {
    const { queryByTestId } = render(
      <VerifySurface
        {...WITH_VECTORS}
        deterministicHash="b14-vectors-exist"
        verifyMode="combinational"
      />
    );

    expect(queryByTestId('ide-verify-first-run-panel')).toBeNull();
  });

  it('does not render the retired workspace story when no vectors exist', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...NO_VECTORS}
        deterministicHash="b14-no-vectors"
        verifyMode="combinational"
      />
    );

    expect(queryByTestId('ide-verify-first-run-panel')).toBeNull();
    expect(queryByTestId('ide-verify-workspace-story')).toBeNull();
    expect(getByTestId('ide-verify-add-vector-form')).toBeTruthy();
    expect(getByTestId('ide-vwp-header-run-note').textContent).toContain('Author stimulus');
  });

  it('keeps the stimulus canvas visible when vectors exist without a hero panel', () => {
    const { getByTestId } = render(
      <VerifySurface
        {...WITH_VECTORS}
        deterministicHash="b14-canvas-present"
        verifyMode="combinational"
      />
    );

    expect(getByTestId('ide-verify-add-vector-form')).toBeTruthy();
  });

  it('keeps the stimulus canvas visible when no vectors exist', () => {
    const { getByTestId } = render(
      <VerifySurface
        {...NO_VECTORS}
        deterministicHash="b14-canvas-no-vectors"
        verifyMode="combinational"
      />
    );

    expect(getByTestId('ide-verify-add-vector-form')).toBeTruthy();
  });

  it('blocked mode still suppresses the retired first-run hero', () => {
    const { queryByTestId } = render(
      <VerifySurface
        {...WITH_VECTORS}
        deterministicHash="b14-blocked-with-vectors"
        verifyMode="blocked"
      />
    );

    expect(queryByTestId('ide-verify-first-run-panel')).toBeNull();
  });
});
