// @vitest-environment jsdom
// B-14 Slice 1 — Case-editor clarity: VerifyFirstRunPanel demotion
// Contract: hero panel absent when vectors exist; canvas is primary surface.
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

describe('B-14 Slice 1 — VerifyFirstRunPanel demotion (hero yields to canvas)', () => {
  it('hides VerifyFirstRunPanel when vectors exist and no lastRun (canvas should be primary)', () => {
    // First-run state: no lastRun, hasVectors=true
    // Hero panel must step aside so the StimulusCanvas is immediately visible
    const { queryByTestId } = render(
      <VerifySurface
        {...WITH_VECTORS}
        deterministicHash="b14-vectors-exist"
        verifyMode="combinational"
      />
    );

    expect(queryByTestId('ide-verify-first-run-panel')).toBeNull();
  });

  it('shows VerifyFirstRunPanel when no vectors exist (orientation still needed)', () => {
    // No vectors: student needs orientation → hero panel should appear
    const { getByTestId } = render(
      <VerifySurface
        {...NO_VECTORS}
        deterministicHash="b14-no-vectors"
        verifyMode="combinational"
      />
    );

    expect(getByTestId('ide-verify-first-run-panel')).toBeTruthy();
  });

  it('canvas (ide-verify-add-vector-form) still renders when vectors exist without hero panel', () => {
    // Removing the hero must not remove the canvas — regression guard
    const { getByTestId } = render(
      <VerifySurface
        {...WITH_VECTORS}
        deterministicHash="b14-canvas-present"
        verifyMode="combinational"
      />
    );

    expect(getByTestId('ide-verify-add-vector-form')).toBeTruthy();
  });

  it('canvas still renders when no vectors exist (hero + canvas both present)', () => {
    const { getByTestId } = render(
      <VerifySurface
        {...NO_VECTORS}
        deterministicHash="b14-canvas-no-vectors"
        verifyMode="combinational"
      />
    );

    expect(getByTestId('ide-verify-add-vector-form')).toBeTruthy();
  });

  it('blocked mode still suppresses VerifyFirstRunPanel even with vectors', () => {
    // Regression: blocked guard unchanged
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
