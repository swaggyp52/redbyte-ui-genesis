// @vitest-environment jsdom

/**
 * Board & Constraints secondary-tool recovery.
 *
 * The v3 assignment workspace no longer renders the legacy Map tab/rail. Board
 * Check, Pre-flight, and Simulation remain optional after-mapping tools, and
 * each must return safely to the unified assignment workspace.
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ProjectHealth } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';
import { BoardSignalProvider } from '../BoardSignalContext';
import { HardwareSurface } from '../surfaces/HardwareSurface';

afterEach(() => {
  cleanup();
});

function makeHealth(): ProjectHealth {
  return {
    lastVerify: {
      status: 'pass',
      hash: 'verify-current-hash',
      reportHash: 'verify-report-hash',
      ranAtIso: '2026-04-29T00:00:00.000Z',
    },
    lastExport: {
      status: 'ok',
      hash: 'export-current-hash',
      ranAtIso: '2026-04-29T00:01:00.000Z',
    },
    dirtySinceVerify: false,
    dirtySinceExport: false,
    blockingIssues: [],
  };
}

function renderHardware() {
  const health = makeHealth();
  return render(
    <BoardSignalProvider>
      <HardwareSurface
        projectName="Mode Trap Test"
        expectedBehavior="Map pins, then escape any sub-mode without leaving the tab."
        mappingRows={[
          { id: 'clk', label: 'clk', direction: 'in', pin: 'W5', required: true },
          { id: 'sw0', label: 'sw0', direction: 'in', pin: 'V17', required: true },
          { id: 'ld0', label: 'ld0', direction: 'out', pin: 'U16', required: true },
        ]}
        expectedIoRows={[]}
        vectorsCount={1}
        health={health}
        workflowAuthority={deriveProjectWorkflowAuthority({
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
        })}
        onGenerateBringUpVectors={vi.fn()}
        onOpenExport={vi.fn()}
        onOpenVerify={vi.fn()}
      />
    </BoardSignalProvider>
  );
}

describe('HardwareSurface Board & Constraints recovery navigation', () => {
  it('opens on the unified assignment workspace without the superseded Map tab', () => {
    const { queryByTestId, getByTestId } = renderHardware();

    expect(getByTestId('ide-hw-board-workspace')).toBeTruthy();
    expect(getByTestId('ide-hw-map-table')).toBeTruthy();
    expect(queryByTestId('ide-hw-mode-btn-map')).toBeNull();
    expect(queryByTestId('ide-hw-stage-rail')).toBeNull();
    expect(queryByTestId('ide-hw-mode-exit-banner')).toBeNull();
  });

  it('shows a direct return affordance when entering Board Check', () => {
    const { getByTestId } = renderHardware();
    fireEvent.click(getByTestId('ide-hw-mode-btn-bringup'));
    const banner = getByTestId('ide-hw-mode-exit-banner');
    expect(banner).toBeTruthy();
    const backBtn = getByTestId('ide-hw-mode-exit-back');
    expect(backBtn.textContent).toMatch(/back to board & constraints/i);
    expect(getByTestId('ide-hw-mode-exit-hint').textContent).toMatch(/Board Check active/i);
  });

  it('clicking Back returns to the unified assignment workspace', () => {
    const { getByTestId, queryByTestId } = renderHardware();
    fireEvent.click(getByTestId('ide-hw-mode-btn-bringup'));
    expect(getByTestId('ide-hw-mode-exit-banner')).toBeTruthy();
    fireEvent.click(getByTestId('ide-hw-mode-exit-back'));

    expect(queryByTestId('ide-hw-mode-exit-banner')).toBeNull();
    expect(getByTestId('ide-hw-board-workspace')).toBeTruthy();
    expect(getByTestId('ide-hw-map-table')).toBeTruthy();
    expect(queryByTestId('ide-hw-mode-btn-map')).toBeNull();
  });

  it('Escape returns from a secondary tool to the unified assignment workspace', () => {
    const { getByTestId, queryByTestId } = renderHardware();
    fireEvent.click(getByTestId('ide-hw-mode-btn-proof'));
    expect(getByTestId('ide-hw-mode-exit-banner')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(queryByTestId('ide-hw-mode-exit-banner')).toBeNull();
    expect(getByTestId('ide-hw-board-workspace')).toBeTruthy();
    expect(getByTestId('ide-hw-map-table')).toBeTruthy();
    expect(queryByTestId('ide-hw-mode-btn-map')).toBeNull();
  });

  it('hint text is mode-specific (Board Check / Pre-flight / Simulation)', () => {
    const { getByTestId } = renderHardware();
    fireEvent.click(getByTestId('ide-hw-mode-btn-bringup'));
    expect(getByTestId('ide-hw-mode-exit-hint').textContent).toMatch(/Board Check/i);
    fireEvent.click(getByTestId('ide-hw-mode-btn-proof'));
    expect(getByTestId('ide-hw-mode-exit-hint').textContent).toMatch(/Pre-flight/i);
    fireEvent.click(getByTestId('ide-hw-mode-btn-live'));
    expect(getByTestId('ide-hw-mode-exit-hint').textContent).toMatch(/Simulation/i);
  });
});
