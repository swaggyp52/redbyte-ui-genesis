// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';

describe('VerifySurface board clock semantics', () => {
  it('treats a W5-bound input as a board clock source instead of an ordinary manual input lane', () => {
    const view = render(
      <VerifySurface
        deterministicHash="board-clock"
        hasVectors={true}
        verifyMode="sequential"
        vectors={[]}
        mappedInputs={[
          { id: 'phase_driver', label: 'Phase Driver', pin: 'W5' },
          { id: 'sw0', label: 'SW0', pin: 'V17' },
        ]}
        mappedSignals={[
          { id: 'phase_driver', label: 'Phase Driver', direction: 'in', pin: 'W5' },
          { id: 'sw0', label: 'SW0', direction: 'in', pin: 'V17' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ phase_driver: 'clock', sw0: 'input', ld0: 'output' }}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(view.getByTestId('ide-verify-sequential-helper').textContent).toContain(
      'board clock source'
    );
    expect(view.getByTestId('ide-verify-board-clock-source').textContent).toContain('CLK100MHZ');
    expect(view.getByTestId('ide-verify-board-clock-source').textContent).toContain('W5');
    expect(view.getByTestId('ide-verify-sequential-helper').textContent).toContain(
      'not a manual switch-style input lane'
    );
    expect(view.getByTestId('ide-stimulus-clock-badge').textContent).toContain('Board clock');
    expect(view.getByTestId('ide-stimulus-clock-detail').textContent).toContain('CLK100MHZ');
    expect(view.getByTestId('ide-stimulus-clock-detail').textContent).toContain('W5');
  });

  it('previews the deterministic clock row as soon as the board clock helper inserts stimulus', () => {
    const onVectorsChange = vi.fn();
    const view = render(
      <VerifySurface
        deterministicHash="board-clock-preview"
        hasVectors={true}
        verifyMode="sequential"
        vectors={[]}
        mappedInputs={[
          { id: 'phase_driver', label: 'Phase Driver', pin: 'W5' },
          { id: 'sw0', label: 'SW0', pin: 'V17' },
        ]}
        mappedSignals={[
          { id: 'phase_driver', label: 'Phase Driver', direction: 'in', pin: 'W5' },
          { id: 'sw0', label: 'SW0', direction: 'in', pin: 'V17' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ phase_driver: 'clock', sw0: 'input', ld0: 'output' }}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(view.getByTestId('ide-verify-clock-pattern-summary').textContent).toContain(
      'No clock row'
    );

    fireEvent.click(view.getByTestId('ide-stimulus-clock-pattern-alternating'));

    const nextVectors = onVectorsChange.mock.calls.at(-1)?.[0];
    expect(nextVectors).toEqual([
      expect.objectContaining({
        tick: 0,
        inputs: expect.objectContaining({ phase_driver: 0 }),
      }),
      expect.objectContaining({
        tick: 1,
        inputs: expect.objectContaining({ phase_driver: 1 }),
      }),
      expect.objectContaining({
        tick: 2,
        inputs: expect.objectContaining({ phase_driver: 0 }),
      }),
      expect.objectContaining({
        tick: 3,
        inputs: expect.objectContaining({ phase_driver: 1 }),
      }),
    ]);

    view.rerender(
      <VerifySurface
        deterministicHash="board-clock-preview"
        hasVectors={true}
        verifyMode="sequential"
        vectors={nextVectors}
        mappedInputs={[
          { id: 'phase_driver', label: 'Phase Driver', pin: 'W5' },
          { id: 'sw0', label: 'SW0', pin: 'V17' },
        ]}
        mappedSignals={[
          { id: 'phase_driver', label: 'Phase Driver', direction: 'in', pin: 'W5' },
          { id: 'sw0', label: 'SW0', direction: 'in', pin: 'V17' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ phase_driver: 'clock', sw0: 'input', ld0: 'output' }}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(view.getByTestId('ide-verify-clock-pattern-summary').textContent).toContain(
      '2 rising edges'
    );
    expect(view.getByTestId('ide-verify-clock-pattern-preview').textContent).toContain(
      't1=1 rising'
    );
  });
});
