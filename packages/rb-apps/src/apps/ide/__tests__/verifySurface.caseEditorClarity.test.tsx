// @vitest-environment jsdom
// B-14 Slice 1 - Case-editor clarity: the old first-run hero is gone and the
// stimulus editor remains the primary authoring surface in every draft state.
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

describe('B-14 Slice 1 - Verify first-run demotion (canvas owns the page)', () => {
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

  it('keeps the first-run workspace story and canvas visible when no vectors exist', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...NO_VECTORS}
        deterministicHash="b14-no-vectors"
        verifyMode="combinational"
      />
    );

    expect(queryByTestId('ide-verify-first-run-panel')).toBeNull();
    expect(getByTestId('ide-verify-workspace-story').textContent).toContain('Stimulus - Run - Observe');
    expect(getByTestId('ide-verify-add-vector-form')).toBeTruthy();
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

  it('canvas still renders when no vectors exist', () => {
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
