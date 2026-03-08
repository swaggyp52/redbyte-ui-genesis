import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateProjectSubmissionBundle = vi.fn();
const mockPersistSubmissionBundleStatus = vi.fn();
const mockDownloadSubmissionBundle = vi.fn();
const mockOnOpenApp = vi.fn();

const workflowState = {
  currentStep: 'report',
  setStep: vi.fn(),
  studentIdentity: { id: 's001', name: 'Student One' },
  selectedLabId: 'lab-1',
  completeStep: vi.fn(),
  completedSteps: ['selection', 'specification', 'design', 'simulation', 'hardware', 'verification', 'report'],
  verificationResults: [],
  hardwareSnapshots: [],
  addHardwareSnapshot: vi.fn(),
};

let unifiedProjectState: any = {
  projectId: 'proj-1',
  name: 'Lab 1',
  description: 'Legacy lab project',
  createdAt: '2026-02-12T00:00:00.000Z',
  updatedAt: '2026-02-12T00:00:00.000Z',
  circuit: {
    schemaVersion: '1.0',
    nodes: [],
    connections: [],
    customChips: [],
  },
  simulation: {
    tickRate: 1,
    currentTick: 0,
    probes: [],
  },
  evidence: {
    actions: [],
    snapshots: [],
  },
};

const runRecorderState: any = {
  stimulus: [],
  record: null,
  replayTrace: [],
  verificationStatus: { status: 'unknown' },
  recordEvent: vi.fn(),
};

vi.mock('@redbyte/rb-primitives', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../components/GuidedLabShell', () => ({
  GuidedLabShell: ({ children }: { children: React.ReactNode }) => <div data-testid="guided-lab-shell">{children}</div>,
}));

vi.mock('../components/LabSelectionScreen', () => ({ LabSelectionScreen: () => <div /> }));
vi.mock('../labs/LabSpecificationView', () => ({ LabSpecificationView: () => <div /> }));
vi.mock('../components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../components/ConnectionCenterPanel', () => ({ ConnectionCenterPanel: () => <div /> }));

vi.mock('../stores/useLabWorkflowStore', () => ({
  useLabWorkflowStore: () => workflowState,
}));

vi.mock('../stores/hardwareSessionStore', () => ({
  useHardwareSessionStore: () => ({
    boot: vi.fn(),
    ensureSession: vi.fn(),
    bridge: { status: 'offline' },
    sessions: { basys3: { status: 'disconnected' } },
  }),
}));

vi.mock('../stores/runRecorderStore', () => {
  const hook = () => runRecorderState;
  (hook as any).getState = () => runRecorderState;
  return { useRunRecorderStore: hook };
});

vi.mock('../services/hardwareClient', () => ({
  hardwareClient: {
    subscribeIO: () => () => {},
  },
}));

vi.mock('../utils/bundleExport', () => ({
  exportV2Bundle: vi.fn(),
  downloadBlob: vi.fn(),
}));

vi.mock('@redbyte/rb-lab-engine', () => ({
  useUnifiedProjectStore: (selector: (state: { currentProject: unknown }) => unknown) =>
    selector({ currentProject: unifiedProjectState }),
}));

vi.mock('../export/submissionBundleWorkflow', () => ({
  generateProjectSubmissionBundle: (...args: unknown[]) => mockGenerateProjectSubmissionBundle(...args),
  persistSubmissionBundleStatus: (...args: unknown[]) => mockPersistSubmissionBundleStatus(...args),
  downloadSubmissionBundle: (...args: unknown[]) => mockDownloadSubmissionBundle(...args),
}));

const { default: LogicLabApp } = await import('../apps/LogicLabApp');

describe('LogicLabApp submission parity', () => {
  beforeEach(() => {
    mockGenerateProjectSubmissionBundle.mockReset();
    mockPersistSubmissionBundleStatus.mockReset();
    mockDownloadSubmissionBundle.mockReset();
    mockOnOpenApp.mockReset();
    workflowState.setStep.mockReset();
    workflowState.completeStep.mockReset();
    runRecorderState.recordEvent.mockReset();
    unifiedProjectState = {
      ...unifiedProjectState,
      projectId: 'proj-1',
    };

    mockGenerateProjectSubmissionBundle.mockResolvedValue({
      bundle: {
        filename: 'rb-submission-bundle-logic-lab.zip',
        bundleId: 'bundle-logic-lab',
        bytes: new Uint8Array([1, 2, 3]),
        manifest: {
          schema_version: 'rb_submission_manifest_v1',
          bundleSchemaVersion: 'rb_submission_bundle_v1',
          bundleId: 'bundle-logic-lab',
          status: 'pass',
          project: { kind: 'rb-project', version: 1, id: 'proj-1', name: 'Lab 1' },
          readiness: { overall: 'ready', gates: [] },
          includedFiles: [],
        },
      },
      status: {
        schema_version: 'rb_submission_bundle_status_v1',
        bundleId: 'bundle-logic-lab',
        filename: 'rb-submission-bundle-logic-lab.zip',
        reproducibilityStatus: 'pass',
      },
      reproducibility: {
        schema_version: 'rb_submission_reproducibility_v1',
        ok: true,
        status: 'pass',
        detail: 'Replay verification passed.',
        verificationStatus: 'pass',
        runRecord: {
          present: false,
          traceSamples: 0,
          replaySamples: 0,
          stimulusEvents: 0,
          tickCount: 0,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders submission button and runs shared submission workflow', async () => {
    render(<LogicLabApp windowId="win-1" onOpenApp={mockOnOpenApp} />);

    fireEvent.click(screen.getByTestId('ece-lab-generate-submission-bundle'));

    await waitFor(() => {
      expect(mockGenerateProjectSubmissionBundle).toHaveBeenCalledTimes(1);
      expect(mockPersistSubmissionBundleStatus).toHaveBeenCalledTimes(1);
      expect(mockDownloadSubmissionBundle).toHaveBeenCalledTimes(1);
    });
  });

  it('shows CTA when canonical snapshot is unavailable', async () => {
    unifiedProjectState = null;

    render(<LogicLabApp windowId="win-2" onOpenApp={mockOnOpenApp} />);

    fireEvent.click(screen.getByTestId('ece-lab-generate-submission-bundle'));
    expect(mockGenerateProjectSubmissionBundle).not.toHaveBeenCalled();

    const cta = await screen.findByTestId('logic-lab-open-ece-lab-cta');
    fireEvent.click(cta);
    expect(mockOnOpenApp).toHaveBeenCalledWith('ece-lab', { labId: 'lab-1' });
  });
});
