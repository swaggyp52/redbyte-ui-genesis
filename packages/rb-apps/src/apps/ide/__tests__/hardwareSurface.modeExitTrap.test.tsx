// @vitest-environment jsdom

/**
 * Slice N4 — Hardware mode-trap exit
 *
 * Contract: any time the user is in a non-map sub-mode (Board Check / Pre-flight /
 * Simulation), the surface MUST present an always-visible exit affordance and
 * MUST honor Escape to return to Map Pins. Without these, students reported
 * being "trapped" in the sub-mode with no way back unless they navigated away
 * from the Hardware tab and came back.
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

describe('HardwareSurface — Slice N4 mode-trap exit', () => {
  it('does NOT show the exit banner when in Map Pins mode (the default)', () => {
    const { queryByTestId, getByTestId } = renderHardware();
    expect(getByTestId('ide-hw-mode-btn-map').getAttribute('aria-selected')).toBe('true');
    expect(queryByTestId('ide-hw-mode-exit-banner')).toBeNull();
  });

  it('shows the exit banner with a Back-to-Map-Pins button when entering Board Check', () => {
    const { getByTestId } = renderHardware();
    fireEvent.click(getByTestId('ide-hw-mode-btn-bringup'));
    const banner = getByTestId('ide-hw-mode-exit-banner');
    expect(banner).toBeTruthy();
    const backBtn = getByTestId('ide-hw-mode-exit-back');
    expect(backBtn.textContent).toMatch(/back to map pins/i);
    expect(getByTestId('ide-hw-mode-exit-hint').textContent).toMatch(/Board Check active/i);
  });

  it('clicking Back returns to Map Pins and hides the exit banner', () => {
    const { getByTestId, queryByTestId } = renderHardware();
    fireEvent.click(getByTestId('ide-hw-mode-btn-bringup'));
    expect(getByTestId('ide-hw-mode-exit-banner')).toBeTruthy();
    fireEvent.click(getByTestId('ide-hw-mode-exit-back'));
    expect(queryByTestId('ide-hw-mode-exit-banner')).toBeNull();
    expect(getByTestId('ide-hw-mode-btn-map').getAttribute('aria-selected')).toBe('true');
  });

  it('Escape key returns to Map Pins from any sub-mode', () => {
    const { getByTestId, queryByTestId } = renderHardware();
    fireEvent.click(getByTestId('ide-hw-mode-btn-proof'));
    expect(getByTestId('ide-hw-mode-exit-banner')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryByTestId('ide-hw-mode-exit-banner')).toBeNull();
    expect(getByTestId('ide-hw-mode-btn-map').getAttribute('aria-selected')).toBe('true');
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
