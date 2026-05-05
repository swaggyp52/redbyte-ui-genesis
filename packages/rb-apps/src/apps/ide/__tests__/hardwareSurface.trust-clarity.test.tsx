// @vitest-environment jsdom
//
// F-H2 / F-H3 trust-clarity tests
//
// F-H2: When mapping is 100% complete, the 3-step mapping guide should collapse
//       and not occupy prime space with stale guidance.
//
// F-H3: When mapping is complete but Verify evidence is advisory (NEEDS REVIEW),
//       the next-action hint must name the specific fix path, not generic copy.

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

  it('still shows the 3-step guide when mapping is incomplete', () => {
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

    // Guide must appear when mapping is incomplete.
    expect(getByTestId('ide-hw-mapping-guide')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F-H3: NEEDS REVIEW hint explains the specific fix path
// ─────────────────────────────────────────────────────────────────────────────

describe('HardwareSurface trust clarity — F-H3 (NEEDS REVIEW explains fix path)', () => {
  it('RED TEST: next-action hint names specific Verify action when mapping is complete but no Verify evidence exists', () => {
    // Mapping is 100% complete. Verify has never run.
    // The NEEDS REVIEW chip shows but the hint should not be generic "or open Export".
    // It should name the specific condition: no trusted export evidence yet.
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

    // The mapping header hint must mention both Verify AND evidence (specific, not generic).
    // Current text "Mapping is complete. Run Verify or open Export." does not contain "evidence".
    const hint = getByTestId('ide-hw-mapping-header-hint');
    expect(hint.textContent).toMatch(/verify/i);
    expect(hint.textContent).toMatch(/evidence/i);
  });

  it('RED TEST: next-action hint names specific Verify action when mapping is complete but Verify evidence is stale', () => {
    // Mapping is 100% complete. Verify ran previously but is now stale.
    // The hint should name the stale-verify condition specifically, not offer a generic choice.
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

    // The mapping header hint must mention Verify AND evidence (condition-specific, not generic).
    // Current text "Mapping is complete. Run Verify or open Export." does not contain "evidence".
    const hint = getByTestId('ide-hw-mapping-header-hint');
    expect(hint.textContent).toMatch(/verify/i);
    expect(hint.textContent).toMatch(/evidence/i);
  });
});
