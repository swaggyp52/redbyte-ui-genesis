import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateProjectSubmissionBundle = vi.fn();
const mockDownloadSubmissionBundle = vi.fn();
const mockPersistSubmissionBundleStatus = vi.fn();

vi.mock('../components/HdlEditorPanel', () => ({
  HdlEditorPanel: () => <div data-testid="hdl-editor-panel-mock">HDL Editor</div>,
}));

vi.mock('../apps/HardwarePanelApp', () => ({
  HardwarePanelComponent: () => <div data-testid="hardware-panel-component-mock">Hardware Panel</div>,
}));

vi.mock('../export/submissionBundleWorkflow', () => ({
  generateProjectSubmissionBundle: (...args: unknown[]) => mockGenerateProjectSubmissionBundle(...args),
  downloadSubmissionBundle: (...args: unknown[]) => mockDownloadSubmissionBundle(...args),
  persistSubmissionBundleStatus: (...args: unknown[]) => mockPersistSubmissionBundleStatus(...args),
}));

const { LabWorkspaceApp } = await import('../apps/LabWorkspaceApp');
const Component = LabWorkspaceApp.component as React.ComponentType<{
  windowId: string;
  starterInstructions?: {
    labId: string;
    title: string;
    timeEstimate: string;
    learningGoal: string;
    steps: string[];
    commonMistakes: string[];
    submit: string[];
    rubric: string[];
  };
}>;

describe('LabWorkspaceApp', () => {
  beforeEach(() => {
    mockGenerateProjectSubmissionBundle.mockReset();
    mockDownloadSubmissionBundle.mockReset();
    mockPersistSubmissionBundleStatus.mockReset();

    mockGenerateProjectSubmissionBundle.mockResolvedValue({
      bundle: {
        filename: 'rb-submission-bundle-lab-1.zip',
        bundleId: 'bundle-lab-1',
        bytes: new Uint8Array([1, 2, 3]),
      },
      status: {
        schema_version: 'rb_submission_bundle_status_v1',
        bundleId: 'bundle-lab-1',
        filename: 'rb-submission-bundle-lab-1.zip',
        reproducibilityStatus: 'pass',
      },
      reproducibility: {
        ok: true,
      },
    });
  });

  it('renders reusable build/sim/hardware/submit surfaces in workspace tabs', async () => {
    render(
      <Component
        windowId="w1"
        starterInstructions={{
          labId: 'lab-1',
          title: 'Lab 1',
          timeEstimate: '30-45 min',
          learningGoal: 'Goal',
          steps: [],
          commonMistakes: [],
          submit: [],
          rubric: [],
        }}
      />,
    );

    expect(screen.getByText(/Lab 1 - Basic Gate Operation/i)).toBeTruthy();
    expect(screen.getByTestId('lab-workspace-header')).toBeTruthy();
    expect(screen.getByTestId('lab-workspace-stepper')).toBeTruthy();
    expect(screen.getByTestId('lab-workspace-stage-pill').textContent ?? '').toMatch(/Build/i);
    expect(screen.getByTestId('lab-workspace-panel-build')).toBeTruthy();
    expect(screen.getByTestId('hdl-editor-panel-mock')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar')).toBeTruthy();
    expect(screen.getByTestId('workspace-status-pills')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar-checklist')).toBeTruthy();
    expect(screen.getByTestId('workspace-next-step')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar-next-action')).toBeTruthy();
    expect(screen.getByTestId('workspace-issues-blocking')).toBeTruthy();
    expect(screen.getByTestId('workspace-issues-warnings')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar-fixes-empty')).toBeTruthy();

    fireEvent.click(screen.getByTestId('lab-workspace-tab-simulate'));
    expect(screen.getByTestId('lab-workspace-panel-simulate')).toBeTruthy();

    fireEvent.click(screen.getByTestId('lab-workspace-tab-hardware'));
    expect(screen.getByTestId('lab-workspace-panel-hardware')).toBeTruthy();
    expect(screen.getByTestId('hardware-panel-component-mock')).toBeTruthy();

    fireEvent.click(screen.getByTestId('lab-workspace-tab-submit'));
    expect(screen.getByTestId('lab-workspace-panel-submit')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('lab-workspace-submit-verdict')).toBeTruthy();
    });
    expect(screen.getByTestId('lab-workspace-bundle-contents-preview')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('workspace-right-sidebar-fixes')).toBeTruthy();
    });

    const firstFix = screen.queryByTestId('workspace-right-sidebar-fix-0');
    if (firstFix) {
      fireEvent.click(firstFix);

      const firstFixText = firstFix.textContent ?? '';
      if (/simulate/i.test(firstFixText)) {
        expect(screen.getByTestId('lab-workspace-panel-simulate')).toBeTruthy();
      } else if (/hardware/i.test(firstFixText)) {
        expect(screen.getByTestId('lab-workspace-panel-hardware')).toBeTruthy();
      } else {
        expect(screen.getByTestId('lab-workspace-panel-build')).toBeTruthy();
      }
    } else {
      expect(screen.getByTestId('workspace-right-sidebar-fixes-empty')).toBeTruthy();
    }
  });

  it('generates submission bundle from submit tab and persists status', async () => {
    render(
      <Component
        windowId="w2"
        starterInstructions={{
          labId: 'lab-1',
          title: 'Lab 1',
          timeEstimate: '30-45 min',
          learningGoal: 'Goal',
          steps: [],
          commonMistakes: [],
          submit: [],
          rubric: [],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('lab-workspace-tab-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('lab-workspace-generate-submission-bundle').getAttribute('disabled')).toBeNull();
    });
    fireEvent.click(screen.getByTestId('lab-workspace-generate-submission-bundle'));

    await waitFor(() => {
      expect(mockGenerateProjectSubmissionBundle).toHaveBeenCalledTimes(1);
      expect(mockDownloadSubmissionBundle).toHaveBeenCalledTimes(1);
      expect(mockPersistSubmissionBundleStatus).toHaveBeenCalledTimes(1);
    });

    const firstCall = mockGenerateProjectSubmissionBundle.mock.calls[0]?.[0] as {
      project: { meta?: { labId?: string; appSurface?: string } };
    };
    expect(firstCall.project.meta?.labId).toBe('lab-1');
    expect(firstCall.project.meta?.appSurface).toBe('lab-workspace');
    expect(screen.getByTestId('lab-workspace-submit-status').textContent ?? '').toMatch(/generated/i);
  });

  it('shows freeplay mode without submit gates', () => {
    render(
      <Component
        windowId="w3"
        starterInstructions={{
          labId: 'freeplay',
          title: 'Freeplay',
          timeEstimate: 'Flexible',
          learningGoal: 'Build anything',
          steps: [],
          commonMistakes: [],
          submit: [],
          rubric: [],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('lab-workspace-tab-submit'));
    expect(screen.getByTestId('lab-workspace-submit-gates-none')).toBeTruthy();
  });

  it('blocks generation for blocking lab gates but not for freeplay', async () => {
    const { rerender } = render(
      <Component
        windowId="w4"
        starterInstructions={{
          labId: 'lab-3',
          title: 'Lab 3',
          timeEstimate: '55-75 min',
          learningGoal: 'Goal',
          steps: [],
          commonMistakes: [],
          submit: [],
          rubric: [],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('lab-workspace-tab-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('lab-workspace-generate-submission-bundle').getAttribute('disabled')).not.toBeNull();
    });

    rerender(
      <Component
        windowId="w5"
        starterInstructions={{
          labId: 'freeplay',
          title: 'Freeplay',
          timeEstimate: 'Flexible',
          learningGoal: 'Build anything',
          steps: [],
          commonMistakes: [],
          submit: [],
          rubric: [],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('lab-workspace-tab-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('lab-workspace-generate-submission-bundle').getAttribute('disabled')).toBeNull();
    });
  });
});
