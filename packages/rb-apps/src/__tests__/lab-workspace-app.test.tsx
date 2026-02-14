import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateProjectSubmissionBundle = vi.fn();
const mockDownloadSubmissionBundle = vi.fn();
const mockPersistSubmissionBundleStatus = vi.fn();
const mockAnalyzeIntelligence = vi.fn();

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

vi.mock('../export/submissionBundle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../export/submissionBundle')>();
  return {
    ...actual,
    decodeSubmissionBundleStatus: (raw: string | null | undefined) => {
      if (!raw || typeof raw !== 'string') return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    SUBMISSION_BUNDLE_EVENT: 'rb:submission-bundle-generated',
    SUBMISSION_BUNDLE_STATUS_STORAGE_KEY: 'rb:submission-bundle:last',
  };
});

vi.mock('../intelligence/client', () => ({
  analyze: (...args: unknown[]) => mockAnalyzeIntelligence(...args),
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

    mockAnalyzeIntelligence.mockResolvedValue({
      summary: 'Run simulation and capture one waveform first.\nWhy it matters: this validates deterministic behavior.',
      actions: [
        {
          label: 'Configure probes',
          title: 'Configure probes',
          why: 'Signal capture is required for grounded evidence.',
          fixIntent: 'simulate.configureProbes',
          severity: 'warning',
          intent: 'open-stage',
          targetStage: 'simulate',
          targetTestId: 'lab-workspace-anchor-simulate-probes',
        },
      ],
      confidence: 0.88,
      citations: ['curriculum:lab-1#simulate'],
      debug: { source: 'lab-1' },
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
    expect(screen.getByTestId('lab-workspace-stage-pill').textContent ?? '').toMatch(/Design/i);
    expect(screen.getByTestId('lab-workspace-primary-cta').textContent ?? '').toMatch(/run sim/i);
    expect(screen.getByTestId('lab-workspace-build-primary-cta').textContent ?? '').toMatch(/do it now/i);
    expect(screen.getByTestId('lab-workspace-panel-build')).toBeTruthy();
    expect(screen.getByTestId('hdl-editor-panel-mock')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar')).toBeTruthy();
    expect(screen.getByTestId('workspace-status-pills')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar-checklist')).toBeTruthy();
    expect(screen.getByTestId('workspace-next-step')).toBeTruthy();
    expect(screen.getByTestId('workspace-edu-callouts')).toBeTruthy();
    expect(screen.getByTestId('workspace-expected-behavior')).toBeTruthy();
    expect(screen.getByTestId('workspace-intelligence')).toBeTruthy();
    fireEvent.click(screen.getByTestId('workspace-intelligence-ask'));
    await waitFor(() => {
      expect(screen.getByTestId('workspace-intelligence-summary')).toBeTruthy();
    });
    expect(mockAnalyzeIntelligence).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('workspace-intelligence-warning-action-0'));
    expect(screen.getByTestId('lab-workspace-panel-simulate')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar-next-action')).toBeTruthy();
    expect(screen.getByTestId('workspace-issues-blocking')).toBeTruthy();
    expect(screen.getByTestId('workspace-issues-warnings')).toBeTruthy();
    expect(screen.getByTestId('workspace-right-sidebar-fixes-empty')).toBeTruthy();

    fireEvent.click(screen.getByTestId('lab-workspace-tab-simulate'));
    expect(screen.getByTestId('lab-workspace-panel-simulate')).toBeTruthy();
    expect(screen.getByTestId('lab-workspace-simulate-primary-cta').textContent ?? '').toMatch(/do it now/i);
    expect(screen.getByTestId('lab-workspace-primary-cta').textContent ?? '').toMatch(/compare\s*\/\s*verify/i);
    expect(screen.getByTestId('lab-workspace-signal-legend')).toBeTruthy();
    expect(screen.getByTestId('compare-panel')).toBeTruthy();
    expect(screen.getByTestId('compare-verdict').textContent ?? '').toMatch(/pending/i);
    expect(screen.getByTestId('compare-top-mismatches')).toBeTruthy();
    expect(screen.getByTestId('compare-first-mismatch').textContent ?? '').toMatch(/n\/a|none/i);
    fireEvent.click(screen.getByTestId('compare-cta-capture-hardware'));
    expect(screen.getByTestId('lab-workspace-panel-hardware')).toBeTruthy();
    fireEvent.click(screen.getByTestId('lab-workspace-tab-simulate'));
    expect(screen.getByTestId('compare-cta-configure-probes')).toBeTruthy();

    fireEvent.click(screen.getByTestId('lab-workspace-tab-hardware'));
    expect(screen.getByTestId('lab-workspace-panel-hardware')).toBeTruthy();
    expect(screen.getByTestId('lab-workspace-hardware-primary-cta').textContent ?? '').toMatch(/do it now/i);
    expect(screen.getByTestId('lab-workspace-primary-cta').textContent ?? '').toMatch(/compare\s*\/\s*verify/i);
    expect(screen.getByTestId('hardware-panel-component-mock')).toBeTruthy();

    fireEvent.click(screen.getByTestId('lab-workspace-tab-submit'));
    expect(screen.getByTestId('lab-workspace-panel-submit')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('lab-workspace-submit-verdict')).toBeTruthy();
    });
    expect(screen.getByTestId('studio-verify-panel')).toBeTruthy();
    expect(screen.getByTestId('studio-verify-verdict')).toBeTruthy();
    expect(screen.getByTestId('studio-verify-blockers')).toBeTruthy();
    expect(screen.getByTestId('studio-verify-warning')).toBeTruthy();
    expect(screen.getByTestId('studio-verify-compare')).toBeTruthy();
    expect(screen.getByTestId('studio-verify-evidence-summary')).toBeTruthy();
    expect(screen.getByTestId('lab-workspace-package-summary')).toBeTruthy();
    expect(screen.getByTestId('lab-workspace-submit-primary-cta').textContent ?? '').toMatch(/do it now/i);
    expect(screen.getByTestId('lab-workspace-primary-cta').textContent ?? '').toMatch(/package evidence|export bundle/i);
    expect(screen.getByTestId('lab-workspace-bundle-contents-preview')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('workspace-right-sidebar-fixes')).toBeTruthy();
    });

    expect(screen.getByTestId('workspace-issues-blocking-chip')).toBeTruthy();
    expect(screen.getByTestId('workspace-issues-warnings-chip')).toBeTruthy();
    const blockingChipText = screen.getByTestId('workspace-issues-blocking-chip').textContent ?? '(0)';
    const blockingCount = Number.parseInt(blockingChipText.replace(/[^0-9]/g, ''), 10) || 0;
    const warningsCollapse = screen.getByTestId('workspace-issues-warnings-collapse') as HTMLDetailsElement;
    expect(warningsCollapse.open).toBe(blockingCount === 0);

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

    expect(screen.getByTestId('lab-workspace-package-last-bundle').textContent ?? '').toContain('rb-submission-bundle-lab-1.zip');

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
      const submitButton = screen.getByTestId('lab-workspace-generate-submission-bundle');
      expect(submitButton.getAttribute('disabled')).not.toBeNull();
      expect((submitButton.textContent ?? '').toLowerCase()).toContain('not ready');
    });

    mockAnalyzeIntelligence.mockResolvedValueOnce({
      summary: 'You are blocked because submit gates found required evidence gaps.',
      actions: [
        {
          label: 'Capture hardware trace',
          title: 'Capture hardware trace',
          why: 'Board evidence is required to clear this blocker.',
          fixIntent: 'hardware.captureTrace',
          severity: 'blocking',
        },
      ],
      confidence: 0.91,
      citations: ['curriculum:lab-3#submit'],
      debug: { grounding: ['curriculum:lab-3#submit', 'gate:hardware_required'] },
    });

    expect(screen.getByTestId('workspace-intelligence-explain-issues')).toBeTruthy();

    fireEvent.click(screen.getByTestId('workspace-intelligence-explain-issues'));
    await waitFor(() => {
      expect(screen.getByTestId('workspace-intelligence-summary')).toBeTruthy();
    });
    expect(mockAnalyzeIntelligence).toHaveBeenCalled();
    const callArgs = mockAnalyzeIntelligence.mock.calls[mockAnalyzeIntelligence.mock.calls.length - 1]?.[0] as {
      stage?: string;
      userIntent?: string;
      gates?: Array<{ code?: string }>;
    };
    expect(callArgs.stage).toBe('submit');
    expect(callArgs.userIntent).toBe('explain-issues');
    expect(Array.isArray(callArgs.gates) && callArgs.gates.length > 0).toBe(true);

    const verifyFixButton = screen.queryByTestId('studio-verify-fix-0');
    if (verifyFixButton) {
      fireEvent.click(verifyFixButton);
      expect(screen.getByTestId('lab-workspace-panel-hardware')).toBeTruthy();
      fireEvent.click(screen.getByTestId('lab-workspace-tab-submit'));
      expect(screen.getByTestId('studio-verify-panel')).toBeTruthy();
    }

    fireEvent.click(screen.getByTestId('workspace-intelligence-action-0'));
    expect(screen.getByTestId('lab-workspace-panel-hardware')).toBeTruthy();

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
