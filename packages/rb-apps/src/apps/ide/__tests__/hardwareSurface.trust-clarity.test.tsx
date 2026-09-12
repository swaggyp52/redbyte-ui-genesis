// @vitest-environment jsdom
//
// Board trust clarity.
//
// F-H2: When mapping is complete, the mapping guide collapses rather than occupying prime space
//       with guidance that no longer applies; an incomplete row is still flagged.
//
// F-H3: When mapping is complete, the Board's next step says what Build & Export will offer -
//       a draft package or a checked one - and, for a draft, the specific reason (no run recorded,
//       recorded run stale, ...) rather than generic "open Export" copy. These used to read the
//       hardware command strip, which the mapping workspace no longer draws; the promise moved to
//       the mapping header's next-action block, which is what a reader sees.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';
import type { ProjectHealth } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

afterEach(() => {
  cleanup();
});

// All-mapped rows — every required signal has a pin.
const COMPLETE_ROWS = [
  { id: 'sw0', label: 'sw0', direction: 'in' as const, pin: 'V17', required: true },
  { id: 'ld0', label: 'ld0', direction: 'out' as const, pin: 'U16', required: true },
];

function makeHealthVerifyNotRun(): ProjectHealth {
  return {
    lastVerify: null,
    lastExport: null,
    dirtySinceVerify: false,
    dirtySinceExport: true,
    blockingIssues: [],
  };
}

function makeHealthVerifyStale(): ProjectHealth {
  return {
    lastVerify: {
      status: 'pass',
      hash: 'old-hash',
      reportHash: 'old-report-hash',
      ranAtIso: '2026-03-08T00:00:00.000Z',
    },
    lastExport: null,
    dirtySinceVerify: true,
    dirtySinceExport: true,
    blockingIssues: [],
  };
}

function makeAuthorityForHealth(health: ProjectHealth, currentVerifyProjectHash: string | null = null) {
  return deriveProjectWorkflowAuthority({
    projectHealthCore: health,
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: health.lastVerify?.qualification,
    },
    verifyLastRun: health.lastVerify,
    currentVerifyProjectHash,
    currentExportHash: null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// F-H2: guide collapses when mapping is complete
// ─────────────────────────────────────────────────────────────────────────────

describe('HardwareSurface trust clarity — F-H2 (guide collapses when complete)', () => {
  it('RED TEST: hides the 3-step mapping guide when all required signals are mapped', () => {
    // Mapping is 100% complete (both rows have pins).
    // The guide ("Select a signal → Choose board control → Confirm binding") is stale
    // context at this point and should not take prime space.
    const health = makeHealthVerifyNotRun();
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Complete Mapping"
          expectedBehavior="sw0 drives ld0."
          mappingRows={COMPLETE_ROWS}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthorityForHealth(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    // Guide must NOT appear when mapping is complete.
    expect(queryByTestId('ide-hw-mapping-guide')).toBeNull();
  });

  it('RED TEST: hides the secondary Map Pins intro when all required signals are mapped', () => {
    // Once binding is complete, the surface should stop introducing a second
    // peer Map Pins section. The command strip remains the single authority.
    const health = makeHealthVerifyNotRun();
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Complete Mapping"
          expectedBehavior="sw0 drives ld0."
          mappingRows={COMPLETE_ROWS}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthorityForHealth(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(queryByTestId('ide-hw-map-reset-header')).toBeNull();
  });

  it('keeps the incomplete row and progress status visible without a second guide', () => {
    // One row has no pin — guide should still be visible.
    const health = makeHealthVerifyNotRun();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Incomplete Mapping"
          expectedBehavior="ld0 needs a pin."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: '', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthorityForHealth(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    // The incomplete row is flagged in the table's own vocabulary and marked for styling.
    expect(getByTestId('ide-hardware-mapping-progress').textContent).toContain('1 / 2 REQUIRED MAPPED');
    const status = getByTestId('ide-hw-map-row-status-ld0');
    expect(status.textContent).toContain('Unassigned');
    expect(status.querySelector('.rb-board-status')?.className).toContain('is-missing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F-H3: NEEDS REVIEW hint explains the specific fix path
// ─────────────────────────────────────────────────────────────────────────────

describe('HardwareSurface trust clarity — F-H3 (the next step names the package it leads to)', () => {
  it('names a draft package and the missing run when mapping is complete but nothing has been recorded', () => {
    // Mapping is 100% complete. Nothing has been run. Build & Export will offer a draft package,
    // and the Board says so - with the reason - instead of "inspect the package".
    const health = makeHealthVerifyNotRun();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Needs Verify"
          expectedBehavior="sw0 drives ld0."
          mappingRows={COMPLETE_ROWS}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthorityForHealth(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const next = getByTestId('ide-hw-mapping-next-action');
    expect(next.textContent).toMatch(/draft package/i);
    expect(getByTestId('ide-hw-mapping-next-reason').textContent).toMatch(/no run is recorded/i);
    expect(next.textContent).not.toMatch(/inspect the package/i);
  });

  it('does not fall back to pin-binding guidance once every required signal is mapped', () => {
    // With mapping complete the next-action block must not repeat "select a signal" copy, and the
    // primary control must lead on to Build & Export rather than to another mapping row.
    const health = makeHealthVerifyNotRun();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Needs Verify"
          expectedBehavior="sw0 drives ld0."
          mappingRows={COMPLETE_ROWS}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthorityForHealth(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const next = getByTestId('ide-hw-mapping-next-action');
    expect(next.textContent).not.toMatch(/select a signal/i);
    expect(next.textContent).not.toMatch(/assign /i);
    expect(getByTestId('ide-hw-continue-export').textContent).toMatch(/build & export/i);
  });

  it('names a draft package and the stale run when mapping is complete but the recorded run is stale', () => {
    // Mapping is 100% complete. A run was recorded and the design changed under it. Build & Export
    // will offer a draft package; the Board names the stale run as the reason.
    const health = makeHealthVerifyStale();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Stale Verify"
          expectedBehavior="sw0 drives ld0."
          mappingRows={COMPLETE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthorityForHealth(health, 'current-hash')}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const next = getByTestId('ide-hw-mapping-next-action');
    expect(next.textContent).toMatch(/draft package/i);
    expect(getByTestId('ide-hw-mapping-next-reason').textContent).toMatch(/stale/i);
    expect(next.textContent).not.toMatch(/inspect the package/i);
  });
});
