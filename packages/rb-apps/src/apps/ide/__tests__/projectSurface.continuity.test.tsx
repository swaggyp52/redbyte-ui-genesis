// @vitest-environment jsdom

/**
 * Project surface cross-surface continuity tests.
 *
 * Verifies that every major blocker shown on Project:
 *   1. Tells the student which surface resolves it
 *   2. Offers a direct action button to that surface
 *   3. Export trust state is explained clearly
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
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
    primaryCtaLabel: 'Verify',
    primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1002' },
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

describe('ProjectSurface — blocker-to-surface routing', () => {
  it('unmapped output blocker (RBP1005) includes an action button pointing to Hardware', () => {
    const onOpenHardware = vi.fn();
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: true,
              verifyPass: true,
              verifyQualification: 'incomplete-mapping',
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: {
                status: 'pass',
                hash: 'h',
                ranAtIso: '2026-02-27T00:00:00Z',
              },
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [],
            },
            onOpenHardware,
          })}
        />
      </BoardSignalProvider>
    );

    // RBP1005 is auto-generated when verifyPassIncomplete — fixPath mode: 'hardware'
    const actionBtns = getAllByTestId('ide-project-blocker-0-action');
    const lastBtn = actionBtns[actionBtns.length - 1];
    expect(lastBtn.textContent).toContain('Hardware');
    fireEvent.click(lastBtn);
    expect(onOpenHardware).toHaveBeenCalled();
  });

  it('missing verify vectors blocker includes an action button pointing to Verify', () => {
    const onOpenVerify = vi.fn();
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                {
                  code: 'RBP1002',
                  message: 'No verification vectors defined.',
                  fixPath: { mode: 'verify', actionLabel: 'Add Test Vectors' },
                },
              ],
            },
            primaryCtaLabel: 'Verify',
            primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1002' },
            onOpenVerify,
          })}
        />
      </BoardSignalProvider>
    );

    const actionBtns = getAllByTestId('ide-project-blocker-0-action');
    const lastBtn = actionBtns[actionBtns.length - 1];
    // Button says the fixPath actionLabel, which is "Add Test Vectors"
    expect(lastBtn.textContent).toContain('Vectors');
    fireEvent.click(lastBtn);
    expect(onOpenVerify).toHaveBeenCalled();
  });

  it('verify-failed blocker includes an action button pointing to Verify', () => {
    const onOpenVerify = vi.fn();
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: true,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: { status: 'fail', hash: 'h', ranAtIso: '2026-02-27T00:00:00Z' },
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                {
                  code: 'RBP1003',
                  message: 'Latest verification run failed.',
                  fixPath: { mode: 'verify', actionLabel: 'Run Verification' },
                },
              ],
            },
            primaryCtaLabel: 'Verify',
            primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1003' },
            onOpenVerify,
          })}
        />
      </BoardSignalProvider>
    );

    const actionBtns = getAllByTestId('ide-project-blocker-0-action');
    const lastBtn = actionBtns[actionBtns.length - 1];
    expect(lastBtn.textContent).toContain('Verification');
    fireEvent.click(lastBtn);
    expect(onOpenVerify).toHaveBeenCalled();
  });

  it('export trust explanation clearly names Verify as the dependency when AVAILABLE not TRUSTED', () => {
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [
                {
                  code: 'RBP1002',
                  message: 'No verification vectors defined.',
                  fixPath: { mode: 'verify', actionLabel: 'Add Test Vectors' },
                },
              ],
            },
            primaryCtaLabel: 'Verify',
            primaryCta: { label: 'Verify', mode: 'verify', code: 'RBP1002' },
          })}
        />
      </BoardSignalProvider>
    );

    const explanations = getAllByTestId('ide-project-export-explanation');
    const explanation = explanations[explanations.length - 1];
    // Must say AVAILABLE (not TRUSTED)
    expect(explanation.textContent).toContain('AVAILABLE');
    // Must explain that Verify is the missing piece
    expect(explanation.textContent).toContain('Verify');
    // Must say it is not trusted
    expect(explanation.textContent).toContain('Not a trusted handoff');
  });

  it('readiness panel shows Go to Verify action when verify is not trusted', () => {
    const onOpenVerify = vi.fn();
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [],
            },
            onOpenVerify,
          })}
        />
      </BoardSignalProvider>
    );

    const gotoVerify = getAllByTestId('ide-project-readiness-goto-verify');
    expect(gotoVerify.length).toBeGreaterThan(0);
    fireEvent.click(gotoVerify[gotoVerify.length - 1]);
    expect(onOpenVerify).toHaveBeenCalled();
  });

  it('readiness panel shows Go to Verify action for export when AVAILABLE not TRUSTED', () => {
    const onOpenVerify = vi.fn();
    const { getAllByTestId } = render(
      <BoardSignalProvider>
        <ProjectSurface
          {...makeProps({
            readiness: {
              hasCircuit: true,
              hasIoMapping: true,
              hasVectors: false,
              verifyPass: false,
              missingRequiredCount: 0,
            },
            health: {
              lastVerify: undefined,
              lastExport: undefined,
              dirtySinceVerify: false,
              dirtySinceExport: false,
              blockingIssues: [],
            },
            onOpenVerify,
          })}
        />
      </BoardSignalProvider>
    );

    const gotoVerifyForExport = getAllByTestId('ide-project-readiness-goto-verify-for-export');
    expect(gotoVerifyForExport.length).toBeGreaterThan(0);
    fireEvent.click(gotoVerifyForExport[gotoVerifyForExport.length - 1]);
    expect(onOpenVerify).toHaveBeenCalled();
  });
});
