// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';
import type { ProjectHealth } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

afterEach(() => {
  cleanup();
});

function makeHealth(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
  return {
    lastVerify: {
      status: 'pass',
      hash: 'verify-hash',
      reportHash: 'verify-report-hash',
      ranAtIso: '2026-03-08T00:00:00.000Z',
    },
    lastExport: {
      status: 'ok',
      hash: 'export-hash',
      ranAtIso: '2026-03-08T00:10:00.000Z',
    },
    dirtySinceVerify: false,
    dirtySinceExport: false,
    blockingIssues: [],
    ...overrides,
  };
}

function makeAuthority(health: ProjectHealth) {
  return deriveProjectWorkflowAuthority({
    projectHealthCore: health,
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: health.lastVerify?.qualification,
    },
    verifyLastRun: health.lastVerify,
    currentVerifyProjectHash: health.lastVerify?.hash ?? null,
    currentExportHash: health.lastExport?.hash ?? null,
  });
}

const BASE_ROWS = [
  { id: 'sw0', label: 'sw0', direction: 'in' as const, pin: 'V17', required: true },
  { id: 'ld0', label: 'ld0', direction: 'out' as const, pin: 'U16', required: true },
];

describe('HardwareSurface — mapping workflow primitives', () => {
  it('renders HardwareMappingHeader with board name', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="AND Gate"
          expectedBehavior="sw0 drives ld0."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-mapping-header')).toBeTruthy();
    expect(getByTestId('ide-hw-mapping-header-board').textContent).toBe('Basys3');
  });

  it('shows Complete state and full count when all required signals are mapped', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Full Mapping"
          expectedBehavior="All mapped."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const stateEl = getByTestId('ide-hw-mapping-header-state');
    expect(stateEl.getAttribute('data-state')).toBe('complete');
    expect(stateEl.textContent).toMatch(/complete/i);
    expect(getByTestId('ide-hw-mapping-header-count').textContent).toMatch(/all 2 required/i);
  });

  it('shows Incomplete state when a required signal has no pin', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Partial Mapping"
          expectedBehavior="ld0 needs a pin."
          mappingRows={[
            { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
            { id: 'ld0', label: 'ld0', direction: 'out', pin: '', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const stateEl = getByTestId('ide-hw-mapping-header-state');
    expect(stateEl.getAttribute('data-state')).toBe('incomplete');
    expect(getByTestId('ide-hw-mapping-header-count').textContent).toContain('1 / 2');
  });

  it('shows design-first state when no boundary rows exist', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Empty Design"
          expectedBehavior="No signals yet."
          mappingRows={[]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    const stateEl = getByTestId('ide-hw-mapping-header-state');
    expect(stateEl.getAttribute('data-state')).toBe('design-first');
  });

  it('renders the 3-step mapping guide', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Guide Check"
          expectedBehavior="Test guide steps."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-mapping-guide')).toBeTruthy();
    expect(getByTestId('ide-hw-guide-step-1')).toBeTruthy();
    expect(getByTestId('ide-hw-guide-step-2')).toBeTruthy();
    expect(getByTestId('ide-hw-guide-step-3')).toBeTruthy();
  });

  it('shows step 1 as active and "Select a signal row" placeholder before any selection', () => {
    const health = makeHealth();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Step 1 Active"
          expectedBehavior="Step 1 should be active."
          mappingRows={BASE_ROWS}
          expectedIoRows={[]}
          vectorsCount={1}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
        />
      </BoardSignalProvider>
    );

    expect(getByTestId('ide-hw-guide-step-1').getAttribute('data-active')).toBe('true');
    expect(getByTestId('ide-hw-guide-step-value-1').textContent).toBe('Select a signal row');
    // Loop card testid preserved for existing contract
    expect(getByTestId('ide-hw-map-loop-card').textContent).toContain('Select a signal row');
  });

  it('marks step 1 as done and loop card updates after a mapped row is selected', () => {
    const health = makeHealth();
    const onSetMappingPin = vi.fn();
    const { getByTestId } = render(
      <BoardSignalProvider>
        <HardwareSurface
          projectName="Row Click Updates Guide"
          expectedBehavior="Clicking a row updates the guide."
          mappingRows={[
            { id: 'sig-in0', label: 'sig-in0', direction: 'in', pin: 'V17', required: true },
            { id: 'sig-out0', label: 'sig-out0', direction: 'out', pin: 'U16', required: true },
          ]}
          expectedIoRows={[]}
          vectorsCount={0}
          health={health}
          workflowAuthority={makeAuthority(health)}
          onGenerateBringUpVectors={vi.fn()}
          onOpenExport={vi.fn()}
          onOpenVerify={vi.fn()}
          onSetMappingPin={onSetMappingPin}
        />
      </BoardSignalProvider>
    );

    // Before click: step 1 active, loop card shows placeholder
    expect(getByTestId('ide-hw-guide-step-1').getAttribute('data-active')).toBe('true');
    expect(getByTestId('ide-hw-map-loop-card').textContent).toContain('Select a signal row');

    fireEvent.click(getByTestId('ide-hw-map-row-sig-in0'));

    // After click: step 1 is no longer active; loop card shows signal label
    expect(getByTestId('ide-hw-guide-step-1').getAttribute('data-active')).toBe('false');
    expect(getByTestId('ide-hw-map-loop-card').textContent).not.toContain('Select a signal row');
  });
});
