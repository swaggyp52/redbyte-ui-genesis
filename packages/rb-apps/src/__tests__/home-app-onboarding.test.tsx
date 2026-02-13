import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRBProject, encodeRBProject } from '../export/projectFormat';
import {
  getCanonicalProjectAutosaveKey,
  markProjectSubmissionCheckpoint,
  saveProjectAutosaveDirtyState,
  saveRbprojAutosave,
  upsertRecentProject,
} from '../utils/rbprojAutosave';
import { LAB_STARTER_KITS } from '../starterKits/labStarterKits';
import { createInstructorPack, createInstructorProjectArchiveBytes } from '../starterKits/instructorPack';

vi.mock('@redbyte/rb-icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('../utils/ceMode', () => ({
  isCEMode: () => false,
}));

const { HomeApp } = await import('../apps/HomeApp');
const HomeAppComponent = HomeApp.component as React.ComponentType<{
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
  onOpenStarterProject?: (starter: {
    exampleId: string;
    targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace';
    starterId?: string;
    instructions?: {
      labId: string;
      title: string;
      timeEstimate: string;
      learningGoal: string;
      steps: string[];
      commonMistakes: string[];
      submit: string[];
      rubric: string[];
    };
  }) => void;
  onOpenInstructorPackProject?: (starter: {
    starterId: string;
    targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace';
    packId: string;
    projectArchiveBase64: string;
    instructions: {
      labId: string;
      title: string;
      timeEstimate: string;
      learningGoal: string;
      steps: string[];
      commonMistakes: string[];
      submit: string[];
      rubric: string[];
    };
  }) => void;
  onOpenRecentProject?: (request: { projectId: string; targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' }) => void;
}>;

describe('HomeApp examples-first onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses student mode defaults to hide TA export mission', () => {
    render(<HomeAppComponent onOpenApp={vi.fn()} />);
    expect(screen.queryByTestId('home-mission-studio-export')).not.toBeInTheDocument();
  });

  it('shows TA export mission when TA mode override is set', () => {
    localStorage.setItem('rb:mode:v1', 'ta');
    render(<HomeAppComponent onOpenApp={vi.fn()} />);
    expect(screen.getByTestId('home-mission-studio-export')).toBeInTheDocument();
  });

  it('shows quickstart and lab starters when no recent activity exists', () => {
    render(<HomeAppComponent onOpenApp={vi.fn()} />);

    expect(screen.getByTestId('home-quickstart-banner')).toBeInTheDocument();
    expect(screen.getByTestId('home-starters')).toBeInTheDocument();
    expect(screen.getByTestId('home-no-recent-hint')).toBeInTheDocument();
  });

  it('opens starter project via canonical starter import callback', () => {
    const onOpenApp = vi.fn();
    const onOpenStarterProject = vi.fn();
    render(<HomeAppComponent onOpenApp={onOpenApp} onOpenStarterProject={onOpenStarterProject} />);

    fireEvent.click(screen.getByTestId('home-starter-wire-lamp'));

    expect(onOpenStarterProject).toHaveBeenCalledWith(
      expect.objectContaining({
        exampleId: '01_wire-lamp',
        targetAppId: 'lab-workspace',
        starterId: 'wire-lamp',
      })
    );
    expect(onOpenApp).not.toHaveBeenCalled();
  });

  it('shows starter instructions modal and opens starter from modal CTA', () => {
    const onOpenStarterProject = vi.fn();
    render(<HomeAppComponent onOpenStarterProject={onOpenStarterProject} />);

    fireEvent.click(screen.getByTestId('home-starter-instructions-wire-lamp'));
    expect(screen.getByTestId('home-starter-instructions-modal')).toBeInTheDocument();
    expect(screen.getByText(/Do this/i)).toBeInTheDocument();
    expect(screen.getByText(/Common mistakes/i)).toBeInTheDocument();
    expect(screen.getByText(/What to submit/i)).toBeInTheDocument();
    expect(screen.getByText(/Rubric hooks/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('home-starter-instructions-open'));
    expect(onOpenStarterProject).toHaveBeenCalledWith(
      expect.objectContaining({
        exampleId: '01_wire-lamp',
        targetAppId: 'lab-workspace',
        starterId: 'wire-lamp',
        instructions: expect.objectContaining({
          labId: 'lab-1',
          timeEstimate: expect.any(String),
          steps: expect.any(Array),
        }),
      })
    );
  });

  it('persists quickstart dismissal and keeps it hidden on next render', () => {
    const onOpenApp = vi.fn();
    const { unmount } = render(<HomeAppComponent onOpenApp={onOpenApp} />);

    fireEvent.click(screen.getByTestId('home-quickstart-dismiss'));

    expect(localStorage.getItem('rb:home:quickstart-dismissed:v1')).toBe('1');

    unmount();
    render(<HomeAppComponent onOpenApp={onOpenApp} />);
    expect(screen.queryByTestId('home-quickstart-banner')).not.toBeInTheDocument();
  });

  it('opens recent project via canonical recent-project callback', () => {
    const projectId = 'proj-home-recent';
    const project = createRBProject({
      createdAt: '2026-02-12T00:00:00.000Z',
      name: 'Recent Project',
      circuit: { nodes: [], connections: [] },
      meta: { projectId, appSurface: 'logic-playground' },
    });
    saveRbprojAutosave(getCanonicalProjectAutosaveKey(projectId), {
      version: 1,
      savedAtMs: 100,
      contentHash: 'hash-recent',
      projectJson: encodeRBProject(project),
    });
    saveProjectAutosaveDirtyState(projectId, {
      version: 1,
      dirty: true,
      lastSavedHash: 'hash-recent',
      savedAtMs: 100,
    });
    upsertRecentProject({
      projectId,
      name: 'Recent Project',
      appHint: 'logic-playground',
      hasUnsaved: true,
      lastOpenedAt: 100,
      autosaveSavedAtMs: 100,
      lastSavedHash: 'hash-recent',
    });

    const onOpenRecentProject = vi.fn();
    render(<HomeAppComponent onOpenRecentProject={onOpenRecentProject} />);

    fireEvent.click(screen.getByTestId('home-recent-project-open-proj-home-recent'));
    expect(onOpenRecentProject).toHaveBeenCalledWith({
      projectId,
      targetAppId: 'lab-workspace',
    });
  });

  it('deletes recent project entry and clears it from the list', () => {
    const projectId = 'proj-home-delete';
    upsertRecentProject({
      projectId,
      name: 'Delete Me',
      appHint: 'logic-playground',
      hasUnsaved: true,
      lastOpenedAt: 200,
    });

    render(<HomeAppComponent onOpenApp={vi.fn()} />);
    expect(screen.getByTestId('home-recent-project-proj-home-delete')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('home-recent-project-delete-proj-home-delete'));
    expect(screen.queryByTestId('home-recent-project-proj-home-delete')).not.toBeInTheDocument();
  });

  it('shows Open (not Restore) after submission checkpoint marks project clean', () => {
    const projectId = 'proj-home-submitted';
    const project = createRBProject({
      createdAt: '2026-02-12T00:00:00.000Z',
      name: 'Submitted Project',
      circuit: { nodes: [], connections: [] },
      meta: { projectId, appSurface: 'logic-playground' },
    });
    saveRbprojAutosave(getCanonicalProjectAutosaveKey(projectId), {
      version: 1,
      savedAtMs: 110,
      contentHash: 'hash-submitted',
      projectJson: encodeRBProject(project),
    });
    saveProjectAutosaveDirtyState(projectId, {
      version: 1,
      dirty: true,
      lastSavedHash: 'hash-submitted',
      savedAtMs: 110,
    });
    upsertRecentProject({
      projectId,
      name: 'Submitted Project',
      appHint: 'logic-playground',
      hasUnsaved: true,
      lastOpenedAt: 110,
    });

    markProjectSubmissionCheckpoint(project, {
      bundleId: 'bundle-submitted-001',
      submittedAtMs: 150,
    });

    render(<HomeAppComponent />);
    expect(screen.getByTestId('home-recent-project-open-proj-home-submitted').textContent).toBe('Open');
    expect(screen.getByTestId('home-recent-project-submission-proj-home-submitted').textContent).toContain(
      'Last submitted',
    );
  });

  it('opens imported instructor starter pack via canonical callback', () => {
    localStorage.setItem(
      'rb:instructor-packs:v1',
      JSON.stringify([
        {
          packId: 'pack-123',
          contentHash: 'content-hash-123',
          importedAtMs: 200,
          starter: {
            id: 'wire-lamp',
            labId: 'lab-1',
            title: 'Wire + Lamp',
            timeEstimate: '15-20 minutes',
            learningGoal: 'Understand signal flow from input to output.',
            whatToDo: 'Verify that the lamp follows the input.',
            targetApp: 'logic-playground',
            exampleId: '01_wire-lamp',
            instructions: {
              labId: 'lab-1',
              title: 'Wire + Lamp',
              timeEstimate: '15-20 minutes',
              learningGoal: 'Understand signal flow from input to output.',
              steps: ['Open starter', 'Toggle the switch'],
              commonMistakes: ['Lamp not wired to output'],
              submit: ['Generate Submission Bundle'],
              rubric: ['Output reflects input'],
            },
          },
          projectArchiveBase64: 'UklGRg==',
          manifestSummary: {
            schemaVersion: 'rb_instructor_pack_manifest_v1',
            labId: 'lab-1',
            starterId: 'wire-lamp',
            title: 'Wire + Lamp',
            targetApp: 'logic-playground',
          },
        },
      ]),
    );

    const onOpenInstructorPackProject = vi.fn();
    render(<HomeAppComponent onOpenInstructorPackProject={onOpenInstructorPackProject} />);

    fireEvent.click(screen.getByTestId('home-imported-starter-open-pack-123'));
    expect(onOpenInstructorPackProject).toHaveBeenCalledWith(
      expect.objectContaining({
        starterId: 'wire-lamp',
        targetAppId: 'lab-workspace',
        packId: 'pack-123',
        projectArchiveBase64: 'UklGRg==',
      }),
    );
  });

  it('imports instructor pack from dropzone and uses pack instructions', async () => {
    const starter = LAB_STARTER_KITS[0];
    const customStarter = {
      ...starter,
      title: 'Imported Lab 1',
      instructions: {
        ...starter.instructions,
        steps: ['UNIQUE PACK STEP: use imported instructions'],
      },
    };
    const projectArchiveBytes = await createInstructorProjectArchiveBytes(
      createRBProject({
        createdAt: '2026-02-12T00:00:00.000Z',
        name: 'Imported Starter Fixture',
        circuit: { nodes: [], connections: [] },
      }),
    );
    const pack = await createInstructorPack({
      starter: customStarter,
      projectArchiveBytes,
      rubric: { rubric: ['Imported rubric hook'] },
    });
    const file = {
      name: pack.filename,
      type: 'application/zip',
      arrayBuffer: async () =>
        pack.bytes.buffer.slice(pack.bytes.byteOffset, pack.bytes.byteOffset + pack.bytes.byteLength),
    } as unknown as File;

    const onOpenInstructorPackProject = vi.fn();
    render(<HomeAppComponent onOpenInstructorPackProject={onOpenInstructorPackProject} />);

    fireEvent.drop(screen.getByTestId('home-instructor-pack-dropzone'), {
      dataTransfer: { files: [file] },
    });

    await screen.findByText(/Imported instructor pack: Imported Lab 1/i);
    expect(screen.getByTestId('home-imported-starters')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`home-imported-starter-instructions-${pack.packId}`));
    expect(screen.getByText('UNIQUE PACK STEP: use imported instructions')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('home-starter-instructions-open'));
    expect(onOpenInstructorPackProject).toHaveBeenCalledWith(
      expect.objectContaining({
        packId: pack.packId,
        instructions: expect.objectContaining({
          steps: ['UNIQUE PACK STEP: use imported instructions'],
        }),
      }),
    );
  });
});
