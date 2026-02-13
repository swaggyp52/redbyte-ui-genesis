import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { RedByteApp } from '../types';
import { HdlEditorPanel } from '../components/HdlEditorPanel';
import { HardwarePanelComponent } from './HardwarePanelApp';
import { getToolchainBackend, type ToolchainProjectInput } from '../fpga/toolchainBackend';
import type { RBFpgaConfig } from '../export/projectFormat';
import { createRBProject } from '../export/projectFormat';
import {
  downloadSubmissionBundle,
  generateProjectSubmissionBundle,
  persistSubmissionBundleStatus,
} from '../export/submissionBundleWorkflow';
import type { VerificationStatus } from '../recording/runRecord';
import type { LabStarterInstructions } from '../starterKits/labStarterKits';
import { LAB_DEFINITIONS, type LabDefinition } from '../labs/labDefinitions';
import {
  type SubmissionGateResult,
  validateSubmissionForLab,
} from '../labs/submissionGates';
import {
  LAB_WORKSPACE_MODES,
  LAB_WORKSPACE_MODE_LABELS,
  buildWorkspaceChecklist,
  getWorkspaceModeIndex,
  type LabWorkspaceMode,
} from './labWorkspace/workspaceUx';
import { resolveSubmissionGateFixIntent, type SubmissionGateFixIntent } from './labWorkspace/fixIntentMap';
import { WorkspaceRightSidebar } from '../components/WorkspaceRightSidebar';
import { getRedByteUiMode } from '../utils/uiMode';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { EmptyStateCard } from '../components/EmptyStateCard';
import { NEO_LABELS, NEO_STATUS } from '../ui/neoGlossary';
import { NEO_MODE_ICONS } from '../ui/neoIcons';
import styles from './LabWorkspaceApp.module.css';

const MODE_ICONS: Record<LabWorkspaceMode, string> = NEO_MODE_ICONS;

const MODE_ACCENTS: Record<LabWorkspaceMode, string> = {
  build: 'var(--rb-accent-build)',
  simulate: 'var(--rb-accent-sim)',
  hardware: 'var(--rb-accent-hardware)',
  submit: 'var(--rb-accent-submit)',
};

const EMPTY_VERIFICATION: VerificationStatus = { status: 'unknown' };
const EMPTY_SUBMISSION_GATES: SubmissionGateResult = { verdict: 'pass', issues: [] };

interface LabWorkspaceProps {
  windowId: string;
  starterInstructions?: LabStarterInstructions;
}

function resolveLabDefinition(starterInstructions?: LabStarterInstructions): LabDefinition | null {
  const requestedLabId = starterInstructions?.labId?.trim();
  if (!requestedLabId) return null;
  return LAB_DEFINITIONS.find((lab) => lab.id === requestedLabId) ?? null;
}

const LabWorkspaceAppComponent: React.FC<LabWorkspaceProps> = ({ windowId, starterInstructions }) => {
  const [mode, setMode] = useState<LabWorkspaceMode>('build');
  const [project, setProject] = useState<ToolchainProjectInput>({
    sources: [{ path: 'top.v', language: 'verilog', text: '' }],
    top: 'top',
  });
  const [fpga, setFpga] = useState<RBFpgaConfig>({ board: 'basys3', top: 'top' });
  const [isGeneratingSubmissionBundle, setIsGeneratingSubmissionBundle] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitGateResult, setSubmitGateResult] = useState<SubmissionGateResult>(EMPTY_SUBMISSION_GATES);
  const [isCheckingSubmitGates, setIsCheckingSubmitGates] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const isMountedRef = useRef(true);
  const [recentRuns, setRecentRuns] = useState<{
    simulated: boolean;
    synthesized: boolean;
    waveformCaptured: boolean;
    hardwareObserved: boolean;
  }>({
    simulated: false,
    synthesized: false,
    waveformCaptured: false,
    hardwareObserved: false,
  });

  const labDefinition = useMemo(() => resolveLabDefinition(starterInstructions), [starterInstructions]);
  const checklist = useMemo(() => buildWorkspaceChecklist(labDefinition), [labDefinition]);

  const modeIndex = useMemo(() => getWorkspaceModeIndex(mode), [mode]);

  const contextLabId = starterInstructions?.labId ?? 'freeplay';
  const contextTitle = labDefinition?.title ?? starterInstructions?.title ?? 'Freeplay';
  const contextGoal = labDefinition?.learningGoal ?? starterInstructions?.learningGoal ?? 'Practice the full RedByte loop.';
  const uiMode = useMemo(() => getRedByteUiMode(), []);
  const isTaMode = uiMode === 'ta';
  const [beginnerView, setBeginnerView] = useState<boolean>(() => !isTaMode);
  const [hardwareBoardDetected, setHardwareBoardDetected] = useState(false);

  const readinessLabel = useMemo(() => {
    if (submitGateResult.verdict === 'pass') return NEO_STATUS.READY;
    if (submitGateResult.verdict === 'warn') return NEO_STATUS.WARNING;
    return NEO_STATUS.NOT_READY;
  }, [submitGateResult.verdict]);

  const readinessTone = useMemo<StatusPillTone>(() => {
    if (submitGateResult.verdict === 'pass') return 'ready';
    if (submitGateResult.verdict === 'warn') return 'warning';
    return 'notReady';
  }, [submitGateResult.verdict]);

  const workspaceStatusLabel = useMemo(() => {
    if (isCheckingSubmitGates || isGeneratingSubmissionBundle) return NEO_STATUS.RUNNING;
    if (submitStatus?.toLowerCase().includes('failed')) return NEO_STATUS.ERROR;
    if (submitStatus?.toLowerCase().includes('generated')) return NEO_STATUS.DONE;
    if (submitStatus?.toLowerCase().includes('blocked') || submitStatus?.toLowerCase().includes('warning')) return NEO_STATUS.WARNING;
    return NEO_STATUS.READY;
  }, [isCheckingSubmitGates, isGeneratingSubmissionBundle, submitStatus]);

  const workspaceStatusTone = useMemo<StatusPillTone>(() => {
    if (workspaceStatusLabel === 'RUNNING') return 'running';
    if (workspaceStatusLabel === 'ERROR') return 'error';
    if (workspaceStatusLabel === 'DONE') return 'done';
    if (workspaceStatusLabel === 'WARNING') return 'warning';
    return 'ready';
  }, [workspaceStatusLabel]);

  const stepHasBlockingIssue = useMemo(() => {
    const mapping: Record<LabWorkspaceMode, boolean> = {
      build: false,
      simulate: false,
      hardware: false,
      submit: submitGateResult.verdict === 'block',
    };

    for (const issue of submitGateResult.issues) {
      if (issue.severity !== 'block') continue;
      const intent = resolveSubmissionGateFixIntent(issue);
      mapping[intent.stage] = true;
    }

    return mapping;
  }, [submitGateResult.issues, submitGateResult.verdict]);

  const projectName = useMemo(() => {
    const base = labDefinition?.title ?? starterInstructions?.title ?? 'Lab Workspace Project';
    return base.trim().length > 0 ? base : 'Lab Workspace Project';
  }, [labDefinition?.title, starterInstructions?.title]);

  const nextStepText = useMemo(() => {
    if (!labDefinition) {
      return mode === 'build'
        ? 'Open the editor and start with a small HDL target, then move to Simulate.'
        : mode === 'simulate'
          ? 'Run simulation once and capture one evidence artifact before moving on.'
          : mode === 'hardware'
            ? 'Hardware is optional; connect a board only if available, then proceed to Submit.'
            : 'Review readiness and generate your submission bundle when checks are green.';
    }

    if (mode === 'build') {
      const first = labDefinition.buildSteps[0] ?? 'Complete build requirements for this lab.';
      const second = labDefinition.buildSteps[1] ?? 'Confirm top module and board profile before simulation.';
      return `${first} ${second}`;
    }
    if (mode === 'simulate') {
      const first = labDefinition.simulateChecks[0] ?? 'Run simulation checks for this lab.';
      const second = labDefinition.simulateChecks[1] ?? 'Capture one waveform/probe artifact.';
      return `${first} ${second}`;
    }
    if (mode === 'hardware') {
      const first = labDefinition.hardwareSteps[0] ?? 'Hardware is optional unless required by your lab.';
      const second = labDefinition.hardwareSteps[1] ?? 'If no board is available, continue to Submit.';
      return `${first} ${second}`;
    }
    const first = labDefinition.submitEvidence[0] ?? 'Generate the submission bundle.';
    const second = labDefinition.submitEvidence[1] ?? 'Ensure required evidence is included before exporting.';
    return `${first} ${second}`;
  }, [labDefinition, mode]);

  const buildEmptyCopy = useMemo(() => {
    if (!labDefinition) {
      return 'Start from template or open the editor to define your top module and profile.';
    }
    const first = labDefinition.buildSteps[0] ?? 'Open the editor and set your top module.';
    const second = labDefinition.buildSteps[1] ?? 'Apply the expected board preset/profile before simulation.';
    return `${first} ${second}`;
  }, [labDefinition]);

  const simulateEmptyCopy = useMemo(() => {
    if (!labDefinition) {
      return 'Run simulation to capture waveform/probe evidence before submitting.';
    }
    const first = labDefinition.simulateChecks[0] ?? 'Run simulation once in this workspace.';
    const second = labDefinition.simulateChecks[1] ?? 'Capture at least one waveform/probe artifact.';
    return `${first} ${second}`;
  }, [labDefinition]);

  const hardwareEmptyCopy = useMemo(() => {
    if (!labDefinition) {
      return 'Hardware is optional for many labs. Connect a board if available, or continue to Submit.';
    }
    const first = labDefinition.hardwareSteps[0]
      ?? (labDefinition.requireHardwareEvidence
        ? 'Hardware evidence is required for this lab.'
        : 'Hardware is optional unless required by your lab.');
    const second = labDefinition.hardwareSteps[1]
      ?? (labDefinition.requireHardwareEvidence
        ? 'Detect your board and program at least one run before submitting.'
        : 'If no board is available, continue to Submit.');
    return `${first} ${second}`;
  }, [labDefinition]);

  const stagePassLooksLike = useMemo(() => {
    if (!labDefinition) {
      if (mode === 'build') return ['Top module is set and preset/profile is selected.'];
      if (mode === 'simulate') return ['Synthesis runs without errors and logs show expected behavior.'];
      if (mode === 'hardware') return ['Board is detected and one programming run completes.'];
      return ['Submission bundle generates with the expected artifacts included.'];
    }

    if (mode === 'build') {
      return [
        labDefinition.buildSteps[0] ?? 'Build requirements are complete.',
        labDefinition.rubric[0] ?? 'Design compiles and matches lab expectations.',
      ].filter((item) => item.trim().length > 0).slice(0, 2);
    }
    if (mode === 'simulate') {
      return [
        labDefinition.simulateChecks[0] ?? 'Simulation runs for required checks.',
        labDefinition.rubric[1] ?? labDefinition.simulateChecks[1] ?? 'Expected outputs are observed in probes/logs.',
      ].filter((item) => item.trim().length > 0).slice(0, 2);
    }
    if (mode === 'hardware') {
      return [
        labDefinition.hardwareSteps[0] ?? 'Board/session requirements are satisfied.',
        labDefinition.hardwareSteps[1] ?? 'At least one hardware observation is captured.',
      ].filter((item) => item.trim().length > 0).slice(0, 2);
    }
    return [
      labDefinition.submitEvidence[0] ?? 'Submission bundle is generated.',
      labDefinition.submitEvidence[1] ?? 'Included evidence matches lab expectations.',
    ].filter((item) => item.trim().length > 0).slice(0, 2);
  }, [labDefinition, mode]);

  const stageCommonMistakes = useMemo(() => {
    if (!labDefinition) {
      if (mode === 'build') return ['Top module is unset or mismatched.'];
      if (mode === 'simulate') return ['Simulation is skipped before submission.'];
      if (mode === 'hardware') return ['Board is disconnected but hardware steps are assumed complete.'];
      return ['Bundle generated before required evidence is captured.'];
    }

    return labDefinition.commonMistakes
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 2);
  }, [labDefinition, mode]);

  const submitEvidenceList = useMemo(() => {
    if (!labDefinition) {
      return [
        'project.rbx.zip snapshot',
        'doctor-report.json',
        'reproducibility.json',
        'submission-gates.json',
      ];
    }
    return labDefinition.submitEvidence
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 4);
  }, [labDefinition]);

  const bundleContentsPreview = useMemo(() => {
    const preview = [
      'project.rbx.zip (workspace snapshot)',
      'doctor-report.json (toolchain summary)',
      'reproducibility.json',
      'submission-gates.json',
    ];
    if (recentRuns.waveformCaptured) {
      preview.push('recordings/last-run-record.json (waveform/replay evidence)');
    }
    return preview;
  }, [recentRuns.waveformCaptured]);

  const isSubmissionBlocked = contextLabId !== 'freeplay' && submitGateResult.verdict === 'block';

  const buildWorkspaceProjectSnapshot = useCallback(() => {
    const now = new Date().toISOString();
    return createRBProject({
      createdAt: now,
      name: projectName,
      circuit: { nodes: [], connections: [] },
      hdl: project,
      fpga,
      meta: {
        appSurface: 'lab-workspace',
        labId: contextLabId,
        labStepIndex: 3,
        projectId: `${windowId}:${contextLabId}`,
      },
    });
  }, [contextLabId, fpga, project, projectName, windowId]);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    setPanelVisible(false);
    const frame = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  React.useEffect(() => {
    if (mode !== 'submit') return;
    let canceled = false;
    setIsCheckingSubmitGates(true);
    void (async () => {
      const snapshot = buildWorkspaceProjectSnapshot();
      try {
        const backend = getToolchainBackend();
        const doctorReport = await backend.doctorReport({ hdl: project, fpga }, { refreshProbe: true, logs: [] });
        if (canceled) return;
        setSubmitGateResult(
          validateSubmissionForLab(contextLabId, {
            projectSnapshot: snapshot,
            doctorReport,
            buildPath: doctorReport.buildPath ?? null,
            recentRuns,
          }),
        );
      } catch {
        if (canceled) return;
        setSubmitGateResult(
          validateSubmissionForLab(contextLabId, {
            projectSnapshot: snapshot,
            doctorReport: null,
            buildPath: null,
            recentRuns,
          }),
        );
      } finally {
        if (!canceled) {
          setIsCheckingSubmitGates(false);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [buildWorkspaceProjectSnapshot, contextLabId, fpga, mode, project, recentRuns]);

  const handleOpenTab = useCallback((nextMode: LabWorkspaceMode) => {
    setMode(nextMode);
    if (nextMode === 'simulate') {
      setRecentRuns((previous) => ({
        ...previous,
        simulated: true,
        synthesized: true,
      }));
    }
    if (nextMode === 'hardware') {
      setRecentRuns((previous) => ({
        ...previous,
        hardwareObserved: true,
      }));
    }
  }, []);

  const applyFixIntent = useCallback((intent: SubmissionGateFixIntent) => {
    handleOpenTab(intent.stage);
    const candidateTargets = [
      intent.scrollToTestId,
      ...(intent.fallbackScrollToTestIds ?? []),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (candidateTargets.length === 0) return;

    setTimeout(() => {
      if (!isMountedRef.current) return;
      for (const targetId of candidateTargets) {
        const selector = `[data-testid="${targetId}"]`;
        const target = document.querySelector(selector);
        if (!target || !(target instanceof HTMLElement)) continue;
        target.scrollIntoView({ block: 'center' });
        break;
      }
    }, 0);
  }, [handleOpenTab]);

  const handleStagePrimaryCta = useCallback((targetMode: 'build' | 'simulate' | 'hardware', targetId: string, fallbackIds: string[] = []) => {
    applyFixIntent({
      stage: targetMode,
      targetTab: targetMode,
      label: 'Open',
      scrollToTestId: targetId,
      fallbackScrollToTestIds: fallbackIds,
    });
  }, [applyFixIntent]);

  const handleGenerateSubmissionBundle = useCallback(async () => {
    if (isGeneratingSubmissionBundle) return;
    if (isSubmissionBlocked) {
      setSubmitStatus('Submission blocked. Resolve required issues before generating a bundle.');
      return;
    }
    setIsGeneratingSubmissionBundle(true);
    setSubmitStatus(null);

    try {
      const rbProject = buildWorkspaceProjectSnapshot();
      const backend = getToolchainBackend();
      const doctorReport = await backend.doctorReport({ hdl: rbProject.hdl ?? project, fpga: rbProject.fpga ?? fpga }, { refreshProbe: true, logs: [] });
      const atomicSubmissionGates = validateSubmissionForLab(contextLabId, {
        projectSnapshot: rbProject,
        doctorReport,
        buildPath: doctorReport.buildPath ?? null,
        recentRuns,
      });
      setSubmitGateResult(atomicSubmissionGates);

      const blockedAtExport = contextLabId !== 'freeplay' && atomicSubmissionGates.verdict === 'block';
      if (blockedAtExport) {
        setSubmitStatus('Submission blocked by preflight. Resolve required issues, then retry.');
        return;
      }

      const { bundle, status, reproducibility } = await generateProjectSubmissionBundle({
        project: rbProject,
        runRecord: null,
        verificationStatus: EMPTY_VERIFICATION,
        replayTraceSampleCount: 0,
        includeRecordings: true,
        submissionGates: atomicSubmissionGates,
        doctorReport,
      });

      persistSubmissionBundleStatus(status, { project: rbProject });
      downloadSubmissionBundle(bundle);
      setSubmitStatus(
        reproducibility.ok
          ? `Submission bundle generated: ${bundle.filename}`
          : `Submission bundle generated with reproducibility warnings: ${bundle.filename}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'submission_bundle_export_failed';
      setSubmitStatus(`Submission bundle failed before export: ${message}. Fix preflight/toolchain status and retry.`);
    } finally {
      setIsGeneratingSubmissionBundle(false);
    }
  }, [buildWorkspaceProjectSnapshot, contextLabId, fpga, isGeneratingSubmissionBundle, isSubmissionBlocked, project, recentRuns]);

  const stagePrimaryAction = useMemo(() => {
    if (mode === 'build') {
      return {
        label: NEO_LABELS.OPEN_EDITOR,
        onClick: () => handleStagePrimaryCta('build', 'hdl-top-input', ['lab-workspace-anchor-build-top-module']),
      };
    }
    if (mode === 'simulate') {
      return {
        label: NEO_LABELS.RUN_SIMULATION,
        onClick: () => {
          setRecentRuns((previous) => ({ ...previous, simulated: true, synthesized: true }));
          handleStagePrimaryCta('simulate', 'hdl-synth-button', ['lab-workspace-anchor-simulate-run']);
        },
      };
    }
    if (mode === 'hardware') {
      return {
        label: hardwareBoardDetected ? NEO_LABELS.PROGRAM_BOARD : NEO_LABELS.DETECT_BOARD,
        onClick: () => handleStagePrimaryCta('hardware', 'hardware-detect-board-button', ['lab-workspace-anchor-hardware-board-detect']),
      };
    }
    return {
      label: isSubmissionBlocked ? NEO_LABELS.FIX_BLOCKERS : NEO_LABELS.GENERATE_BUNDLE,
      onClick: () => void handleGenerateSubmissionBundle(),
    };
  }, [handleGenerateSubmissionBundle, handleStagePrimaryCta, hardwareBoardDetected, isSubmissionBlocked, mode]);

  return (
    <div className={styles.root} data-testid="lab-workspace-root">
      <div className={styles.header} data-testid="lab-workspace-header">
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <StatusPill
              data-testid="lab-workspace-stage-pill"
              label={`${MODE_ICONS[mode]} ${LAB_WORKSPACE_MODE_LABELS[mode]}`}
              tone={mode === 'build' ? 'build' : mode === 'simulate' ? 'simulate' : mode === 'hardware' ? 'hardware' : 'submit'}
            />
            <StatusPill label={contextLabId.toUpperCase()} tone="warning" />
          </div>
          <div className={styles.title}>{contextTitle}</div>
          <div className={styles.subtitle}>STAGE {modeIndex + 1} OF {LAB_WORKSPACE_MODES.length}</div>
          <div className={styles.goal}>{contextGoal}</div>
        </div>

        <div className={styles.headerCenter}>
          <div data-testid="lab-workspace-stepper" className={styles.stepper}>
            {LAB_WORKSPACE_MODES.map((tabMode) => {
              const tabIndex = getWorkspaceModeIndex(tabMode);
              const completed = tabIndex < modeIndex;
              const current = mode === tabMode;
              const blocked = stepHasBlockingIssue[tabMode];
              const stepTone = MODE_ACCENTS[tabMode];
              const stateClassName = [
                styles.stepButton,
                current ? styles.stepCurrent : '',
                completed ? styles.stepComplete : '',
                blocked ? styles.stepBlocked : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={tabMode}
                  onClick={() => handleOpenTab(tabMode)}
                  data-testid={`lab-workspace-tab-${tabMode}`}
                  className={stateClassName}
                  style={{ ['--rb-step-accent' as string]: stepTone }}
                >
                  <div className={styles.stepMeta}>
                    <span className={styles.stepContent}>
                      <span className={styles.stepIcon}>{MODE_ICONS[tabMode]}</span>
                      {LAB_WORKSPACE_MODE_LABELS[tabMode]}
                    </span>
                    <span className={styles.stepState}>{completed ? '✓' : blocked ? '•' : '○'}</span>
                  </div>
                  <div className={styles.stepRail}>
                    <div className={styles.stepRailFill} style={{ background: stepTone }} />
                  </div>
                  {blocked ? <span data-testid={`lab-workspace-tab-warning-${tabMode}`} style={{ display: 'none' }} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.headerRight}>
          <StatusPill data-testid="lab-workspace-save-pill" label="UNSAVED" tone="unsaved" />
          <StatusPill data-testid="lab-workspace-readiness-pill" label={readinessLabel} tone={readinessTone} />
          <StatusPill data-testid="lab-workspace-status-pill" label={workspaceStatusLabel} tone={workspaceStatusTone} />
          <button type="button" className={styles.primaryAction} onClick={stagePrimaryAction.onClick}>
            {stagePrimaryAction.label}
          </button>
          <button
            type="button"
            data-testid="lab-workspace-beginner-toggle"
            onClick={() => setBeginnerView((previous) => !previous)}
            className={styles.primaryAction}
          >
            BEGINNER {beginnerView ? 'DONE' : 'NOT READY'}
          </button>
        </div>
      </div>

      <div className={styles.stageLayout}>
        <div data-testid="lab-workspace-main-scroll" className={styles.mainScroll}>
          <div className={styles.panelFade} style={{ opacity: panelVisible ? 1 : 0.9, transform: panelVisible ? 'translateY(0)' : 'translateY(6px)' }}>
            {(mode === 'build' || mode === 'simulate') && (
              <div data-testid={`lab-workspace-panel-${mode}`} className={styles.panelLifted} style={{ height: '100%', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                {mode === 'build' ? (
                  <div data-testid="lab-workspace-empty-build" className={styles.emptyState}>
                    <div className={styles.emptyIcon}>⚙️</div>
                    <div>
                      <div className={styles.emptyTitle}>Start by creating your top module.</div>
                      <div className={styles.emptyBody}>{buildEmptyCopy}</div>
                      <button
                        type="button"
                        data-testid="lab-workspace-build-primary-cta"
                        onClick={() => handleStagePrimaryCta('build', 'hdl-top-input', ['lab-workspace-anchor-build-top-module'])}
                        className={styles.coachCta}
                      >
                        {NEO_LABELS.OPEN_EDITOR}
                      </button>
                      <span data-testid="lab-workspace-anchor-build-top-module" style={{ display: 'none' }}>Top module selector</span>
                      <span data-testid="lab-workspace-anchor-build-preset" style={{ display: 'none' }}>Preset/profile selector</span>
                      <span data-testid="lab-workspace-anchor-build-syntax-errors" style={{ display: 'none' }}>Syntax/error section</span>
                    </div>
                  </div>
                ) : (
                  <div data-testid="lab-workspace-empty-simulate" className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📊</div>
                    <div>
                      <EmptyStateCard
                        testId="lab-workspace-simulate-empty-card"
                        headline="No waveform session yet"
                        description={simulateEmptyCopy}
                        primaryLabel="Run Simulation"
                        onPrimaryClick={() => {
                          setRecentRuns((previous) => ({ ...previous, simulated: true, synthesized: true }));
                          handleStagePrimaryCta('simulate', 'hdl-synth-button', ['lab-workspace-anchor-simulate-run']);
                        }}
                        secondaryLabel="Why this matters"
                      />
                      <button
                        type="button"
                        data-testid="lab-workspace-simulate-primary-cta"
                        onClick={() => {
                          setRecentRuns((previous) => ({ ...previous, simulated: true, synthesized: true }));
                          handleStagePrimaryCta('simulate', 'hdl-synth-button', ['lab-workspace-anchor-simulate-run']);
                        }}
                        className={styles.coachCta}
                        style={{ marginTop: 8 }}
                      >
                        {NEO_LABELS.RUN_SIMULATION}
                      </button>
                      <span data-testid="lab-workspace-anchor-simulate-run" style={{ display: 'none' }}>Run sim CTA</span>
                      <span data-testid="lab-workspace-anchor-simulate-waveform" style={{ display: 'none' }}>Waveform capture section</span>
                      <span data-testid="lab-workspace-anchor-simulate-probes" style={{ display: 'none' }}>Probe list section</span>
                    </div>
                  </div>
                )}
                <HdlEditorPanel
                  project={project}
                  beginnerView={beginnerView && !isTaMode}
                  onProjectChange={setProject}
                  fpga={fpga}
                  onFpgaChange={setFpga}
                />
              </div>
            )}

            {mode === 'hardware' && (
              <div data-testid="lab-workspace-panel-hardware" className={styles.panelLifted} style={{ height: '100%', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                <div data-testid="lab-workspace-empty-hardware" className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🔌</div>
                  <div>
                    <div className={styles.emptyTitle}>Connect Basys3 board to enable programming.</div>
                    <div className={styles.emptyBody}>{hardwareEmptyCopy}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {hardwareBoardDetected ? (
                        <button
                          type="button"
                          data-testid="lab-workspace-hardware-primary-cta"
                          onClick={() => handleStagePrimaryCta('hardware', 'hardware-program-button', ['lab-workspace-anchor-hardware-program-bitstream'])}
                          className={styles.coachCta}
                        >
                          {NEO_LABELS.PROGRAM_BOARD}
                        </button>
                      ) : (
                        <span data-testid="lab-workspace-hardware-optional-note" className={styles.emptyBody}>
                          Connect board appears after detection.
                        </span>
                      )}
                    </div>
                    <span data-testid="lab-workspace-anchor-hardware-board-detect" style={{ display: 'none' }}>Board detect</span>
                    <span data-testid="lab-workspace-anchor-hardware-program-bitstream" style={{ display: 'none' }}>Program generated bitstream</span>
                    <span data-testid="lab-workspace-anchor-hardware-connection-help" style={{ display: 'none' }}>Connection help</span>
                  </div>
                </div>
                <HardwarePanelComponent
                  beginnerView={beginnerView && !isTaMode}
                  onBoardDetectedChange={setHardwareBoardDetected}
                />
              </div>
            )}

            {mode === 'submit' && (
              <div data-testid="lab-workspace-panel-submit" className={styles.panelLifted} style={{ padding: 16, display: 'grid', gap: 12 }}>
                <div data-testid="lab-workspace-empty-submit" className={styles.emptyState} style={{ borderBottom: 'none' }}>
                  <div className={styles.emptyIcon}>📦</div>
                  <div>
                    <div className={styles.emptyTitle}>Fix blockers or generate submission bundle.</div>
                    <div className={styles.emptyBody}>What will be included:</div>
                    <ul data-testid="lab-workspace-bundle-contents-preview" style={{ margin: '6px 0 0 16px', padding: 0, display: 'grid', gap: 4 }}>
                      {bundleContentsPreview.map((item, index) => (
                        <li key={`bundle-preview-${index}-${item}`} style={{ fontSize: 11, color: 'var(--rb-text-2, #94a3b8)' }}>
                          {item}
                        </li>
                      ))}
                      {submitEvidenceList.map((item, index) => (
                        <li key={`submit-evidence-${index}-${item}`} style={{ fontSize: 11, color: 'var(--rb-text-2, #94a3b8)' }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--rb-text-2, #94a3b8)' }}>
                  Generate your deterministic submission bundle from the current workspace HDL/fpga snapshot.
                </div>

                <div
                  data-testid="lab-workspace-submit-verdict"
                  style={{
                    border: '1px solid var(--rb-border, #333)',
                    borderLeft: `3px solid ${submitGateResult.verdict === 'pass' ? '#22c55e' : submitGateResult.verdict === 'warn' ? '#f59e0b' : '#ef4444'}`,
                    borderRadius: 6,
                    background: 'var(--rb-surface-1, #1e1e2e)',
                    padding: '8px 10px',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {submitGateResult.verdict === 'pass' ? NEO_STATUS.READY : submitGateResult.verdict === 'warn' ? NEO_STATUS.WARNING : NEO_STATUS.NOT_READY}
                  </div>
                  <div style={{ marginTop: 2, color: 'var(--rb-text-2, #94a3b8)' }}>
                    {isCheckingSubmitGates
                      ? 'Validating lab-specific submission gates...'
                      : submitGateResult.issues.length > 0
                        ? `${submitGateResult.issues.length} issue(s) detected.`
                        : 'All lab-specific checks passed.'}
                  </div>
                </div>

                <div data-testid="lab-workspace-anchor-submit-readiness" style={{ display: 'none' }} />

                {submitGateResult.issues.length > 0 ? (
                  <div data-testid="lab-workspace-submit-gates" style={{ display: 'grid', gap: 8 }}>
                    {submitGateResult.issues.map((issue) => {
                      const fixIntent = resolveSubmissionGateFixIntent(issue);
                      return (
                        <div
                          key={issue.code}
                          style={{
                            border: '1px solid var(--rb-border, #333)',
                            borderLeft: `3px solid ${issue.severity === 'block' ? '#f97316' : '#f59e0b'}`,
                            borderRadius: 6,
                            padding: '8px 10px',
                            background: 'var(--rb-surface-1, #1e1e2e)',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{issue.severity.toUpperCase()} · {issue.title}</div>
                          <div>{issue.message}</div>
                          {issue.fixHint ? <div style={{ marginTop: 4, color: 'var(--rb-text-2, #94a3b8)' }}>Fix: {issue.fixHint}</div> : null}
                          <button
                            type="button"
                            onClick={() => applyFixIntent(fixIntent)}
                            style={{
                              marginTop: 6,
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--rb-border, #333)',
                              background: 'var(--rb-surface-2, #252538)',
                              color: 'var(--rb-text, #e4e4e7)',
                              cursor: 'pointer',
                              fontSize: 11,
                            }}
                          >
                            {fixIntent.label}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div data-testid="lab-workspace-submit-gates-none" style={{ fontSize: 12, color: 'var(--rb-text-2, #94a3b8)' }}>
                    {contextLabId === 'freeplay' ? 'Freeplay mode: no lab-specific submit gates.' : 'No submission issues detected.'}
                  </div>
                )}

                <div data-testid="lab-workspace-anchor-submit-generate">
                  <button
                    onClick={() => void handleGenerateSubmissionBundle()}
                    disabled={isGeneratingSubmissionBundle || isCheckingSubmitGates || isSubmissionBlocked}
                    data-testid="lab-workspace-generate-submission-bundle"
                    className={styles.submitAction}
                  >
                    {isCheckingSubmitGates || isGeneratingSubmissionBundle ? NEO_STATUS.RUNNING : isSubmissionBlocked ? NEO_STATUS.NOT_READY : NEO_STATUS.DONE}
                  </button>
                </div>

                {submitStatus ? (
                  <div style={{ fontSize: 12, color: 'var(--rb-text-2, #94a3b8)' }}>
                    <div data-testid="lab-workspace-submit-status">{submitStatus}</div>
                    <div data-testid="lab-workspace-anchor-submit-bundle-preview" style={{ display: 'none' }} />
                  </div>
                ) : null}

                {isTaMode ? (
                  <div data-testid="lab-workspace-ta-only-links" style={{ fontSize: 11, color: 'var(--rb-text-3, #71717a)', borderTop: '1px solid var(--rb-border-subtle)', paddingTop: 8 }}>
                    TA TOOLS · Toolchain Setup · Submission Inspector · Diagnostics
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <aside className={styles.sidePanel} data-testid="lab-workspace-sidepanel">
          <WorkspaceRightSidebar
            mode={mode}
            modeIndex={modeIndex}
            checklist={checklist}
            issues={mode === 'submit' ? submitGateResult.issues : []}
            labGoal={labDefinition?.whatToDo}
            nextStepText={nextStepText}
            passCriteria={stagePassLooksLike}
            commonMistakes={stageCommonMistakes}
            readinessLabel={readinessLabel}
            saveLabel="UNSAVED"
            statusLabel={workspaceStatusLabel}
            stageAccent={MODE_ACCENTS[mode]}
            onFixIntent={applyFixIntent}
          />
        </aside>
      </div>
    </div>
  );
};

export const LabWorkspaceApp: RedByteApp = {
  manifest: {
    id: 'lab-workspace',
    name: 'Lab Workspace',
    iconId: 'cpu',
    category: 'logic',
    defaultSize: { width: 900, height: 650 },
    persistence: 'session',
    hidden: false,
  },
  component: LabWorkspaceAppComponent,
};
