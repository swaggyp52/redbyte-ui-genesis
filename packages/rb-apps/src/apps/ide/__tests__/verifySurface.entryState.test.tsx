// @vitest-environment jsdom
// B-12 Slice 2 — Verify entry-state unification
// These tests describe the target: one blocked surface, one Run action, one sequential entry.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';

const minProps = {
  hasVectors: false,
  onOpenProjectVectors: vi.fn(),
};

const withVectors = {
  hasVectors: true,
  vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: {} }],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
};

describe('VerifySurface entry state — B-12 Slice 2', () => {
  // ── BLOCKED mode ────────────────────────────────────────────────────────────

  it('blocked mode renders a dedicated blocked surface', () => {
    const { getByTestId } = render(
      <VerifySurface
        {...minProps}
        deterministicHash="abc"
        verifyMode="blocked"
      />
    );

    expect(getByTestId('ide-verify-entry-blocked')).toBeTruthy();
  });

  it('blocked mode suppresses the command-bar Run button', () => {
    const { queryByTestId } = render(
      <VerifySurface
        {...minProps}
        deterministicHash="abc"
        verifyMode="blocked"
      />
    );

    expect(queryByTestId('ide-vcb-run')).toBeNull();
  });

  it('blocked mode suppresses the first-run panel', () => {
    const { queryByTestId } = render(
      <VerifySurface
        {...minProps}
        deterministicHash="abc"
        verifyMode="blocked"
      />
    );

    expect(queryByTestId('ide-verify-first-run-panel')).toBeNull();
  });

  it('blocked surface includes a design fix-path CTA', () => {
    const onGoToDesign = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...minProps}
        deterministicHash="abc"
        verifyMode="blocked"
        onGoToDesign={onGoToDesign}
      />
    );

    expect(getByTestId('ide-verify-blocked-fix-path')).toBeTruthy();
  });

  // ── COMBINATIONAL mode ──────────────────────────────────────────────────────

  it('combinational mode shows the command bar and no blocked surface', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        {...withVectors}
        deterministicHash="abc"
        verifyMode="combinational"
      />
    );

    expect(getByTestId('ide-verify-command-bar')).toBeTruthy();
    expect(queryByTestId('ide-verify-entry-blocked')).toBeNull();
  });

  // ── SEQUENTIAL mode — first-run entry ───────────────────────────────────────

  it('sequential mode shows clock helper in first-run state without a prior run', () => {
    const { getByTestId } = render(
      <VerifySurface
        {...withVectors}
        deterministicHash="abc"
        verifyMode="sequential"
      />
    );

    expect(getByTestId('ide-verify-sequential-helper')).toBeTruthy();
    expect(getByTestId('ide-verify-insert-clock-pattern')).toBeTruthy();
  });
});
