// @vitest-environment jsdom

/**
 * Phase 2 Slice 1 — Contract tests for launchpad trio removal.
 *
 * The three fixed stage-status cards (Mapping / Verify / Export launchpad cards)
 * contradict the "current focus + why this is next owns the page" product direction.
 * The dock items already carry stage completion. The hero CTA already carries the
 * "next move." These tests confirm the fixed launchpad dashboard is gone while
 * core navigation contracts remain intact.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { BoardSignalProvider } from '../BoardSignalContext';

function makeProps(overrides: Partial<ProjectSurfaceProps> = {}): ProjectSurfaceProps {
  return {
    projectName: 'Test Project',
    description: '',
    determinismHash: 'abc123def456',
    topModuleName: 'top',
    lastSavedAt: 'Saved recently',
    simRunning: false,
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyPass: true,
      verifyQualification: undefined,
      missingRequiredCount: 0,
    },
    health: {
      lastVerify: {
        status: 'pass',
        hash: 'verify-hash',
        reportHash: 'report-hash',
        ranAtIso: '2026-02-27T00:00:00.000Z',
      },
      lastExport: undefined,
      dirtySinceVerify: false,
      dirtySinceExport: false,
      blockingIssues: [],
    },
    mappingRows: [],
    examples: [],
    activeExampleId: null,
    onOpenExample: vi.fn(),
    primaryCtaLabel: 'Export',
    primaryCta: { label: 'Export', mode: 'export', code: 'RBP1006' },
    onPrimaryCta: vi.fn(),
    onUpdateMappingPin: vi.fn(),
    onAutoSuggestMapping: vi.fn(),
    onOpenDesign: vi.fn(),
    onOpenVerify: vi.fn(),
    onOpenExport: vi.fn(),
    onOpenHardware: vi.fn(),
    onOpenImport: vi.fn(),
    recentProjects: [],
    onOpenSavedProjects: vi.fn(),
    onOpenRecentProject: vi.fn(),
    studentName: '',
    onStudentNameChange: vi.fn(),
    hasVerifyRun: true,
    ...overrides,
  };
}

describe('ProjectSurface — launchpad trio removed (Phase 2 Slice 1)', () => {
  it('does not render the ide-project-readiness-summary panel', () => {
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );
    expect(queryByTestId('ide-project-readiness-summary')).toBeNull();
  });

  it('does not render ide-launchpad-mapping card', () => {
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );
    expect(queryByTestId('ide-launchpad-mapping')).toBeNull();
  });

  it('does not render ide-launchpad-verify card', () => {
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );
    expect(queryByTestId('ide-launchpad-verify')).toBeNull();
  });

  it('does not render ide-launchpad-export card', () => {
    const { queryByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );
    expect(queryByTestId('ide-launchpad-export')).toBeNull();
  });

  it('still renders the hero CTA command strip as the authoritative next-move', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );
    expect(getByTestId('ide-project-command-strip-primary-cta')).toBeTruthy();
  });

  it('still renders all 4 dock stage navigation items', () => {
    const { getByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeProps()} />
      </BoardSignalProvider>
    );
    expect(getByTestId('ide-project-dock-nav-design')).toBeTruthy();
    expect(getByTestId('ide-project-dock-nav-verify')).toBeTruthy();
    expect(getByTestId('ide-project-dock-nav-hardware')).toBeTruthy();
    expect(getByTestId('ide-project-dock-nav-export')).toBeTruthy();
  });
});
