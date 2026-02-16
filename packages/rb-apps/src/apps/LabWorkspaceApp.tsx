import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { RedByteApp } from '../types';
import { HdlEditorPanel } from '../components/HdlEditorPanel';
import { HardwarePanelComponent } from './HardwarePanelApp';
import { getToolchainBackend, type ToolchainProjectInput } from '../fpga/toolchainBackend';
import type { RBFpgaConfig } from '../export/projectFormat';
import { createRBProject } from '../export/projectFormat';
import {
  decodeSubmissionBundleStatus,
  SUBMISSION_BUNDLE_EVENT,
  SUBMISSION_BUNDLE_STATUS_STORAGE_KEY,
  type SubmissionBundleManifest,
  type SubmissionBundleStatusSnapshot,
} from '../export/submissionBundle';
import {
  downloadSubmissionBundle,
  generateProjectSubmissionBundle,
  persistSubmissionBundleStatus,
} from '../export/submissionBundleWorkflow';
import type { VerificationStatus } from '../recording/runRecord';
import type { LabStarterInstructions } from '../starterKits/labStarterKits';
import {
  LAB_DEFINITIONS,
  getLabExpectedBehaviorVisual,
  getLabStageTeaching,
  type LabDefinition,
} from '../labs/labDefinitions';
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
import { SignalLegend } from '../components/SignalLegend';
import { analyze as analyzeIntelligence, type IntelligenceAction, type IntelligenceAnalyzePayload, type IntelligenceAnalyzeResult } from '../intelligence/client';
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

const STUDIO_LAST_STAGE_KEY = 'rb:studio:last-stage:v1';

type CompareMismatch = {
  signal: string;
  reason: string;
  firstTick?: number;
};

function resolveLabDefinition(starterInstructions?: LabStarterInstructions): LabDefinition | null {
  const requestedLabId = starterInstructions?.labId?.trim();
  if (!requestedLabId) return null;
  return LAB_DEFINITIONS.find((lab) => lab.id === requestedLabId) ?? null;
}

function inferMismatchSignal(code: string): string {
  const normalized = code.toLowerCase();
  if (normalized.includes('clock')) return 'clk';
  if (normalized.includes('wave') || normalized.includes('sim')) return 'sim_out';
  if (normalized.includes('hardware') || normalized.includes('board')) return 'hw_io';
  if (normalized.includes('opcode')) return 'opcode';
  if (normalized.includes('port')) return 'port_map';
  return normalized.replace(/[^a-z0-9]+/g, '_');
}

function toOneSentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Resolve this issue to continue.';
  const firstSentence = trimmed.split(/[.!?]\s/, 1)[0] ?? trimmed;
  return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
}

function isElementFocusable(element: HTMLElement): boolean {
  const focusableSelectors = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return element.matches(focusableSelectors);
}

function focusElement(target: HTMLElement): boolean {
  if (isElementFocusable(target)) {
    target.focus({ preventScroll: true });
    return document.activeElement === target;
  }

  const focusableChild = target.querySelector<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusableChild) {
    focusableChild.focus({ preventScroll: true });
    return document.activeElement === focusableChild;
  }

  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

function getStageFocusFallbackIds(stage: LabWorkspaceMode): string[] {
  if (stage === 'build') {
    return ['hdl-top-input', 'lab-workspace-anchor-build-top-module'];
  }
  if (stage === 'simulate') {
    return ['hdl-synth-button', 'lab-workspace-anchor-simulate-run'];
  }
  if (stage === 'hardware') {
    return ['hardware-detect-board-button', 'lab-workspace-anchor-hardware-board-detect'];
  }
  return ['studio-verify-panel', 'lab-workspace-anchor-submit-generate'];
}

const LabWorkspaceAppComponent: React.FC<LabWorkspaceProps> = ({ windowId, starterInstructions }) => {
  const [mode, setMode] = useState<LabWorkspaceMode>(() => {
    try {
      const stored = localStorage.getItem(STUDIO_LAST_STAGE_KEY);
      if (stored === 'build' || stored === 'simulate' || stored === 'hardware' || stored === 'submit') {
        return stored;
      }
    } catch {
      // ignore storage constraints and fall back
    }
    return 'build';
  });
  const [project, setProject] = useState<ToolchainProjectInput>({
    sources: [{ path: 'top.v', language: 'verilog', text: '' }],
    top: 'top',
  });
  const [fpga, setFpga] = useState<RBFpgaConfig>({ board: 'basys3', top: 'top' });
  const [isGeneratingSubmissionBundle, setIsGeneratingSubmissionBundle] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitGateResult, setSubmitGateResult] = useState<SubmissionGateResult>(EMPTY_SUBMISSION_GATES);
  const [lastBundleStatus, setLastBundleStatus] = useState<SubmissionBundleStatusSnapshot | null>(() => {
    try {
      return decodeSubmissionBundleStatus(localStorage.getItem(SUBMISSION_BUNDLE_STATUS_STORAGE_KEY));
    } catch {
      return null;
    }
  });
  const [lastBundleManifest, setLastBundleManifest] = useState<SubmissionBundleManifest | null>(null);
  const [isCheckingSubmitGates, setIsCheckingSubmitGates] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const isMountedRef = useRef(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  React.useEffect(() => {
    try {
      localStorage.setItem(STUDIO_LAST_STAGE_KEY, mode);
    } catch {
      // ignore storage constraints and continue
    }
  }, [mode]);

  React.useEffect(() => {
    const refreshBundleStatus = () => {
      try {
        setLastBundleStatus(decodeSubmissionBundleStatus(localStorage.getItem(SUBMISSION_BUNDLE_STATUS_STORAGE_KEY)));
      } catch {
        setLastBundleStatus(null);
      }
    };

    const onSubmissionBundleGenerated = () => {
      refreshBundleStatus();
    };

    refreshBundleStatus();
    window.addEventListener(SUBMISSION_BUNDLE_EVENT, onSubmissionBundleGenerated as EventListener);
    return () => {
      window.removeEventListener(SUBMISSION_BUNDLE_EVENT, onSubmissionBundleGenerated as EventListener);
    };
  }, []);

  const contextLabId = starterInstructions?.labId ?? 'freeplay';
  const contextTitle = labDefinition?.title ?? starterInstructions?.title ?? 'Freeplay';
  const contextGoal = labDefinition?.learningGoal ?? starterInstructions?.learningGoal ?? 'Practice the full RedByte loop.';
  const uiMode = useMemo(() => getRedByteUiMode(), []);
  const isTaMode = uiMode === 'ta';
  const [beginnerView, setBeginnerView] = useState<boolean>(() => !isTaMode);
  const [hardwareBoardDetected, setHardwareBoardDetected] = useState(false);
  const [intelligenceResult, setIntelligenceResult] = useState<IntelligenceAnalyzeResult | null>(null);
  const [isIntelligenceLoading, setIsIntelligenceLoading] = useState(false);

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

  const stepBlockingReason = useMemo(() => {
    const reasonMap: Partial<Record<LabWorkspaceMode, string>> = {};

    for (const issue of submitGateResult.issues) {
      if (issue.severity !== 'block') continue;
      const intent = resolveSubmissionGateFixIntent(issue);
      if (!reasonMap[intent.stage]) {
        reasonMap[intent.stage] = toOneSentence(issue.title || issue.message || 'Resolve blocker in this stage.');
      }
    }

    if (submitGateResult.verdict === 'block' && !reasonMap.submit) {
      reasonMap.submit = 'Resolve blocking submission checks before export.';
    }

    return reasonMap;
  }, [submitGateResult.issues, submitGateResult.verdict]);

  const projectName = useMemo(() => {
    const base = labDefinition?.title ?? starterInstructions?.title ?? 'Studio Project';
    return base.trim().length > 0 ? base : 'Studio Project';
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
    const defaultWhy = 'Design stage defines the circuit contract before any verification can be trusted.';
    const defaultProduce = 'a top module name and board/profile baseline';
    if (!labDefinition) {
      return {
        why: defaultWhy,
        produce: defaultProduce,
      };
    }
    const first = labDefinition.buildSteps[0] ?? 'Open the editor and set your top module.';
    const second = labDefinition.buildSteps[1] ?? defaultProduce;
    return {
      why: toOneSentence(first),
      produce: toOneSentence(second).replace(/\.$/, ''),
    };
  }, [labDefinition]);

  const simulateEmptyCopy = useMemo(() => {
    const defaultWhy = 'Simulation gives fast proof that logic behavior is correct before hardware capture.';
    const defaultProduce = 'at least one waveform or probe-backed run result';
    if (!labDefinition) {
      return {
        why: defaultWhy,
        produce: defaultProduce,
      };
    }
    const first = labDefinition.simulateChecks[0] ?? 'Run simulation once in this workspace.';
    const second = labDefinition.simulateChecks[1] ?? defaultProduce;
    return {
      why: toOneSentence(first),
      produce: toOneSentence(second).replace(/\.$/, ''),
    };
  }, [labDefinition]);

  const hardwareEmptyCopy = useMemo(() => {
    const defaultWhy = 'Hardware checks validate real-board behavior and close the sim-to-device gap.';
    const defaultProduce = 'a board detection and one captured hardware observation';
    if (!labDefinition) {
      return {
        why: defaultWhy,
        produce: defaultProduce,
      };
    }
    const first = labDefinition.hardwareSteps[0]
      ?? (labDefinition.requireHardwareEvidence
        ? 'Hardware evidence is required for this lab.'
        : 'Hardware is optional unless required by your lab.');
    const second = labDefinition.hardwareSteps[1]
      ?? (labDefinition.requireHardwareEvidence
        ? 'Detect your board and program at least one run before submitting.'
        : 'If no board is available, continue to Submit.');
    return {
      why: toOneSentence(first),
      produce: toOneSentence(second).replace(/\.$/, ''),
    };
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

  const stageTeaching = useMemo(() => getLabStageTeaching(contextLabId, mode), [contextLabId, mode]);

  const expectedBehaviorVisual = useMemo(() => getLabExpectedBehaviorVisual(contextLabId), [contextLabId]);

  const comparePanel = useMemo(() => {
    const hasSimTrace = recentRuns.simulated || recentRuns.synthesized || recentRuns.waveformCaptured;
    const hasHardwareTrace = recentRuns.hardwareObserved || hardwareBoardDetected;

    if (hasSimTrace && !hasHardwareTrace) {
      return {
        state: 'no-hardware' as const,
        verdict: 'PENDING',
        missing: ['Hardware capture trace'],
        mismatches: [] as CompareMismatch[],
      };
    }

    if (hasSimTrace && hasHardwareTrace) {
      const candidateIssues = submitGateResult.issues.filter((issue) => {
        const intent = resolveSubmissionGateFixIntent(issue);
        return intent.stage === 'simulate' || intent.stage === 'hardware';
      });
      const mismatches = candidateIssues.slice(0, 3).map((issue, index) => ({
        signal: inferMismatchSignal(issue.code),
        reason: issue.title,
        firstTick: index,
      }));
      return {
        state: 'complete' as const,
        verdict: mismatches.length > 0 ? 'MISMATCH' : 'MATCH',
        missing: [] as string[],
        mismatches,
      };
    }

    return {
      state: 'partial' as const,
      verdict: 'PENDING',
      missing: [
        ...(hasSimTrace ? [] : ['Simulation/probe trace']),
        ...(hasHardwareTrace ? [] : ['Hardware capture trace']),
      ],
      mismatches: [] as CompareMismatch[],
    };
  }, [hardwareBoardDetected, recentRuns.hardwareObserved, recentRuns.simulated, recentRuns.synthesized, recentRuns.waveformCaptured, submitGateResult.issues]);

  const hasSimulationEvidence = useMemo(
    () => recentRuns.waveformCaptured || recentRuns.simulated || recentRuns.synthesized,
    [recentRuns.simulated, recentRuns.synthesized, recentRuns.waveformCaptured],
  );

  const hasHardwareEvidence = useMemo(
    () => recentRuns.hardwareObserved || hardwareBoardDetected,
    [hardwareBoardDetected, recentRuns.hardwareObserved],
  );

  const verifyBlockingIssues = useMemo(
    () => submitGateResult.issues
      .filter((issue) => issue.severity === 'block')
      .sort((left, right) => {
        const leftKey = `${left.code}|${left.title}`;
        const rightKey = `${right.code}|${right.title}`;
        return leftKey.localeCompare(rightKey);
      })
      .slice(0, 3),
    [submitGateResult.issues],
  );

  const verifyWarningIssues = useMemo(
    () => submitGateResult.issues
      .filter((issue) => issue.severity !== 'block')
      .sort((left, right) => {
        const leftKey = `${left.code}|${left.title}`;
        const rightKey = `${right.code}|${right.title}`;
        return leftKey.localeCompare(rightKey);
      }),
    [submitGateResult.issues],
  );

  const requiredEvidencePresent = useMemo(() => {
    if (!hasSimulationEvidence) return false;
    if (labDefinition?.requireHardwareEvidence) return hasHardwareEvidence;
    return true;
  }, [hasHardwareEvidence, hasSimulationEvidence, labDefinition?.requireHardwareEvidence]);

  const verifyReady = useMemo(
    () => verifyBlockingIssues.length === 0 && requiredEvidencePresent,
    [requiredEvidencePresent, verifyBlockingIssues.length],
  );

  const submitEmptyCopy = useMemo(() => {
    const why = verifyReady
      ? 'Submit stage packages your verified evidence into a deterministic bundle.'
      : 'Submit stage turns readiness gaps into a clear, actionable package checklist.';
    const produce = verifyReady
      ? 'an exportable bundle with reproducibility and gate artifacts'
      : 'a prioritized list of blockers to clear before export';
    return { why, produce };
  }, [verifyReady]);

  const verifyEvidenceSummary = useMemo(() => {
    const includedFileCount = lastBundleManifest?.includedFiles?.length ?? 0;
    return [
      {
        key: 'sim',
        label: 'Simulation evidence',
        present: hasSimulationEvidence,
        detail: hasSimulationEvidence ? 'Captured simulation/probe signal evidence.' : 'Missing simulation/probe evidence.',
      },
      {
        key: 'hw',
        label: 'Hardware evidence',
        present: labDefinition?.requireHardwareEvidence ? hasHardwareEvidence : true,
        detail: labDefinition?.requireHardwareEvidence
          ? (hasHardwareEvidence ? 'Required hardware evidence is present.' : 'Required hardware evidence is missing.')
          : (hasHardwareEvidence ? 'Optional hardware evidence captured.' : 'Optional for this lab.'),
      },
      {
        key: 'gates',
        label: 'Submission gates',
        present: verifyBlockingIssues.length === 0,
        detail: verifyBlockingIssues.length === 0
          ? 'No blocking submission gates.'
          : `${verifyBlockingIssues.length} blocking gate(s) remain.`,
      },
      {
        key: 'manifest',
        label: 'Packaged proof manifest',
        present: includedFileCount > 0,
        detail: includedFileCount > 0
          ? `${includedFileCount} included file entries from latest package.`
          : 'Generate package to produce manifest proof entries.',
      },
    ];
  }, [hasHardwareEvidence, hasSimulationEvidence, labDefinition?.requireHardwareEvidence, lastBundleManifest?.includedFiles, verifyBlockingIssues.length]);

  const verifyPrimaryAction = useMemo(() => {
    if (verifyBlockingIssues.length > 0) {
      return resolveSubmissionGateFixIntent(verifyBlockingIssues[0]);
    }

    if (!hasSimulationEvidence) {
      return {
        stage: 'simulate' as const,
        targetTab: 'simulate' as const,
        label: 'Fix in Simulate',
        scrollToTestId: 'hdl-synth-button',
        fallbackScrollToTestIds: ['lab-workspace-anchor-simulate-run'],
      };
    }

    if (labDefinition?.requireHardwareEvidence && !hasHardwareEvidence) {
      return {
        stage: 'hardware' as const,
        targetTab: 'hardware' as const,
        label: 'Fix in Hardware',
        scrollToTestId: 'hardware-detect-board-button',
        fallbackScrollToTestIds: ['lab-workspace-anchor-hardware-board-detect'],
      };
    }

    return null;
  }, [hasHardwareEvidence, hasSimulationEvidence, labDefinition?.requireHardwareEvidence, verifyBlockingIssues]);

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

  const submitGateSummary = useMemo(() => {
    const blocked = submitGateResult.issues.filter((issue) => issue.severity === 'block').length;
    const warnings = submitGateResult.issues.filter((issue) => issue.severity !== 'block').length;
    return { blocked, warnings };
  }, [submitGateResult.issues]);

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
      ...getStageFocusFallbackIds(intent.stage),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (candidateTargets.length === 0) return;

    setTimeout(() => {
      if (!isMountedRef.current) return;
      for (const targetId of candidateTargets) {
        const selector = `[data-testid="${targetId}"]`;
        const target = document.querySelector(selector);
        if (!target || !(target instanceof HTMLElement)) continue;
        target.scrollIntoView({ block: 'center' });
        if (focusElement(target)) {
          break;
        }
      }
    }, 0);
  }, [handleOpenTab]);

  const handleStagePrimaryCta = useCallback((targetMode: LabWorkspaceMode, targetId: string, fallbackIds: string[] = []) => {
    if (targetMode === 'submit') {
      handleOpenTab('submit');
      const candidateTargets = [targetId, ...fallbackIds].filter((value) => value.trim().length > 0);
      if (candidateTargets.length === 0) return;
      setTimeout(() => {
        if (!isMountedRef.current) return;
        for (const candidate of candidateTargets) {
          const target = document.querySelector(`[data-testid="${candidate}"]`);
          if (!target || !(target instanceof HTMLElement)) continue;
          target.scrollIntoView({ block: 'center' });
          if (focusElement(target)) {
            break;
          }
        }
      }, 0);
      return;
    }

    applyFixIntent({
      stage: targetMode,
      targetTab: targetMode,
      label: 'Open',
      scrollToTestId: targetId,
      fallbackScrollToTestIds: fallbackIds,
    });
  }, [applyFixIntent, handleOpenTab]);

  const buildAnalyzePayload = useCallback((): IntelligenceAnalyzePayload => ({
    projectId: windowId,
    labId: contextLabId,
    stage: mode,
    projectSummary: `top=${project.top}; sources=${project.sources.length}; board=${fpga.board}; readiness=${submitGateResult.verdict}`,
    traces: {
      sim: (recentRuns.simulated || recentRuns.synthesized || recentRuns.waveformCaptured) ? 'present' : undefined,
      hw: (recentRuns.hardwareObserved || hardwareBoardDetected) ? 'present' : undefined,
    },
    gates: submitGateResult.issues.slice(0, 5).map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      title: issue.title,
      message: issue.message,
    })),
    userIntent: 'explain-next-step',
  }), [contextLabId, fpga.board, hardwareBoardDetected, mode, project.sources.length, project.top, recentRuns.hardwareObserved, recentRuns.simulated, recentRuns.synthesized, recentRuns.waveformCaptured, submitGateResult.issues, submitGateResult.verdict, windowId]);

  const handleAskRedByte = useCallback(async () => {
    setIsIntelligenceLoading(true);
    try {
      const result = await analyzeIntelligence(buildAnalyzePayload());
      if (!isMountedRef.current) return;
      setIntelligenceResult(result);
    } finally {
      if (isMountedRef.current) {
        setIsIntelligenceLoading(false);
      }
    }
  }, [buildAnalyzePayload]);

  const handleExplainIssues = useCallback(async () => {
    setIsIntelligenceLoading(true);
    try {
      const payload: IntelligenceAnalyzePayload = {
        projectId: windowId,
        labId: contextLabId,
        stage: 'submit',
        projectSummary: `top=${project.top}; board=${fpga.board}; simCaptured=${recentRuns.waveformCaptured ? 'yes' : 'no'}; hwCaptured=${recentRuns.hardwareObserved ? 'yes' : 'no'}; readiness=${submitGateResult.verdict}`,
        gates: submitGateResult.issues.map((issue) => ({
          code: issue.code,
          severity: issue.severity,
          title: issue.title,
          message: issue.message,
        })),
        userIntent: 'explain-issues',
      };
      const result = await analyzeIntelligence(payload);
      if (!isMountedRef.current) return;
      setIntelligenceResult(result);
    } finally {
      if (isMountedRef.current) {
        setIsIntelligenceLoading(false);
      }
    }
  }, [contextLabId, fpga.board, project.top, recentRuns.hardwareObserved, recentRuns.waveformCaptured, submitGateResult.issues, submitGateResult.verdict, windowId]);

  const mapActionToFixIntent = useCallback((action: IntelligenceAction): SubmissionGateFixIntent | null => {
    const key = action.fixIntent?.trim().toLowerCase();
    if (!key) return null;

    if (key === 'build.opentopmodule' || key === 'hardware.configureprofile') {
      return {
        stage: 'build',
        targetTab: 'build',
        label: action.title || action.label || 'Open Build',
        scrollToTestId: 'hdl-top-input',
        fallbackScrollToTestIds: ['lab-workspace-anchor-build-top-module'],
      };
    }

    if (key === 'simulate.configureprobes') {
      return {
        stage: 'simulate',
        targetTab: 'simulate',
        label: action.title || action.label || 'Open Simulate',
        scrollToTestId: 'hdl-synth-button',
        fallbackScrollToTestIds: ['lab-workspace-anchor-simulate-probes'],
      };
    }

    if (key === 'hardware.capturetrace') {
      return {
        stage: 'hardware',
        targetTab: 'hardware',
        label: action.title || action.label || 'Open Hardware',
        scrollToTestId: 'hardware-detect-board-button',
        fallbackScrollToTestIds: ['lab-workspace-anchor-hardware-board-detect'],
      };
    }

    return null;
  }, []);

  const handleIntelligenceAction = useCallback((action: IntelligenceAction) => {
    const mappedIntent = mapActionToFixIntent(action);
    if (mappedIntent) {
      applyFixIntent(mappedIntent);
      return;
    }

    if (action.fixIntent?.trim().toLowerCase() === 'submit.reviewgates') {
      handleOpenTab('submit');
      setTimeout(() => {
        const target = document.querySelector('[data-testid="lab-workspace-anchor-submit-generate"]');
        if (target instanceof HTMLElement) {
          target.scrollIntoView({ block: 'center' });
        }
      }, 0);
      return;
    }

    const targetStage = action.targetStage;
    if (!targetStage) return;

    if (targetStage === 'submit') {
      handleOpenTab('submit');
      return;
    }

    applyFixIntent({
      stage: targetStage,
      targetTab: targetStage,
      label: action.label || 'Open',
      scrollToTestId: action.targetTestId,
      fallbackScrollToTestIds: [],
    });
  }, [applyFixIntent, handleOpenTab, mapActionToFixIntent]);

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
      setLastBundleStatus(status);
      setLastBundleManifest(bundle.manifest);
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

  const stagePrimaryAction = useMemo<{ label: string; onClick: () => void }>(() => {
    if (mode === 'build') {
      return {
        label: 'Run Sim',
        onClick: () => {
          setRecentRuns((previous) => ({ ...previous, simulated: true, synthesized: true }));
          handleStagePrimaryCta('simulate', 'hdl-synth-button', ['lab-workspace-anchor-simulate-run']);
        },
      };
    }
    if (mode === 'simulate') {
      return {
        label: 'Compare / Verify',
        onClick: () => handleStagePrimaryCta('submit', 'studio-verify-panel', ['lab-workspace-anchor-submit-readiness']),
      };
    }
    if (mode === 'hardware') {
      return {
        label: 'Compare / Verify',
        onClick: () => handleStagePrimaryCta('submit', 'studio-verify-panel', ['lab-workspace-anchor-submit-readiness']),
      };
    }

    if (!verifyReady) {
      return {
        label: 'Package Evidence',
        onClick: () => {
          if (verifyPrimaryAction) {
            applyFixIntent(verifyPrimaryAction);
            return;
          }
          void handleExplainIssues();
        },
      };
    }

    return {
      label: 'Export Bundle',
      onClick: () => void handleGenerateSubmissionBundle(),
    };
  }, [applyFixIntent, handleExplainIssues, handleGenerateSubmissionBundle, handleStagePrimaryCta, mode, verifyPrimaryAction, verifyReady]);

  const handleWorkspaceKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const isEditableTarget = Boolean(
      target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
    );

    if (event.key === 'Escape') {
      const openDetails = rootRef.current?.querySelectorAll('details[open]') ?? [];
      const lastOpen = openDetails.length > 0 ? openDetails[openDetails.length - 1] : null;
      if (lastOpen instanceof HTMLDetailsElement) {
        lastOpen.open = false;
      }
      return;
    }

    if (event.key !== 'Enter') return;
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isEditableTarget) return;
    if (target?.closest('button, a[href], [role="button"]')) return;

    event.preventDefault();
    stagePrimaryAction.onClick();
  }, [stagePrimaryAction]);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} rb-ui-lab-page`}
      data-testid="lab-workspace-root"
      onKeyDown={handleWorkspaceKeyDown}
    >
      <div className={`${styles.header} rb-ui-lab-chrome-header`} data-testid="lab-workspace-header">
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
          <div className={styles.subtitle}>STUDIO STEP {modeIndex + 1} OF {LAB_WORKSPACE_MODES.length}</div>
          <div className={styles.goal}>{contextGoal}</div>
        </div>

        <div className={styles.headerCenter}>
          <div data-testid="lab-workspace-stepper" className={`${styles.stepper} rb-ui-lab-stepper`}>
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
                  {blocked ? (
                    <>
                      <span data-testid={`lab-workspace-tab-warning-${tabMode}`} style={{ display: 'none' }} />
                      <span data-testid={`lab-workspace-tab-reason-${tabMode}`} className={styles.stepReason}>
                        {stepBlockingReason[tabMode] ?? 'Resolve blocker in this stage.'}
                      </span>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.headerRight}>
          <StatusPill data-testid="lab-workspace-save-pill" label="UNSAVED" tone="unsaved" />
          <StatusPill data-testid="lab-workspace-readiness-pill" label={readinessLabel} tone={readinessTone} />
          <StatusPill data-testid="lab-workspace-status-pill" label={workspaceStatusLabel} tone={workspaceStatusTone} />
          <button
            type="button"
            data-testid="lab-workspace-primary-cta"
            className={styles.primaryAction}
            onClick={stagePrimaryAction.onClick}
          >
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
        <div data-testid="lab-workspace-main-scroll" className={`${styles.mainScroll} rb-ui-lab-page-scroll`}>
          <div className={styles.panelFade} style={{ opacity: panelVisible ? 1 : 0.9, transform: panelVisible ? 'translateY(0)' : 'translateY(6px)' }}>
            {(mode === 'build' || mode === 'simulate') && (
              <div data-testid={`lab-workspace-panel-${mode}`} className={`${styles.panelLifted} rb-ui-lab-panel-frame`} style={{ height: '100%', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                {mode === 'simulate' ? (
                  <div className={styles.stageLegend} data-testid="lab-workspace-signal-legend">
                    <SignalLegend
                      title="Signal Legend"
                      hint="Use neon cues only for signal meaning"
                      showExpectedVsActual
                      showDebounce
                      compact
                    />
                    <div data-testid="compare-panel" className={styles.comparePanel}>
                      <div className={styles.compareHeader}>Sim vs Hardware</div>
                      <div
                        data-testid="compare-verdict"
                        className={`${styles.compareVerdict} ${
                          comparePanel.verdict === 'MATCH'
                            ? styles.compareMatch
                            : comparePanel.verdict === 'MISMATCH'
                              ? styles.compareMismatch
                              : styles.comparePending
                        }`}
                      >
                        {comparePanel.verdict}
                      </div>

                      {comparePanel.state === 'no-hardware' ? (
                        <div className={styles.compareBody}>
                          No hardware trace yet. Capture once on Hardware tab to compare against simulation.
                        </div>
                      ) : null}

                      {comparePanel.state === 'partial' ? (
                        <div className={styles.compareBody}>
                          Partial data. Missing: {comparePanel.missing.join(', ')}.
                        </div>
                      ) : null}

                      {comparePanel.state === 'complete' ? (
                        <>
                          <div className={styles.compareBody}>
                            {comparePanel.verdict === 'MATCH'
                              ? 'Simulation and hardware traces are aligned for current checks.'
                              : 'Mismatch detected between simulation and hardware evidence.'}
                          </div>
                          <ul data-testid="compare-top-mismatches" className={styles.compareList}>
                            {(comparePanel.mismatches.length > 0
                              ? comparePanel.mismatches
                              : [{ signal: 'none', reason: 'No mismatches found.' }]
                            ).map((item) => (
                              <li key={`${item.signal}-${item.reason}`}>
                                <strong>{item.signal}</strong> — {item.reason}
                              </li>
                            ))}
                          </ul>
                          <div data-testid="compare-first-mismatch" className={styles.compareBody}>
                            First mismatch: {comparePanel.mismatches[0]?.firstTick !== undefined ? `tick ${comparePanel.mismatches[0]?.firstTick}` : 'none'}
                          </div>
                        </>
                      ) : (
                        <>
                          <ul data-testid="compare-top-mismatches" className={styles.compareList}>
                            <li>Awaiting trace data to compute mismatches.</li>
                          </ul>
                          <div data-testid="compare-first-mismatch" className={styles.compareBody}>First mismatch: n/a</div>
                        </>
                      )}

                      <div className={styles.compareActions}>
                        <button
                          type="button"
                          data-testid="compare-cta-configure-probes"
                          className={styles.compareActionButton}
                          onClick={() => handleStagePrimaryCta('simulate', 'hdl-synth-button', ['lab-workspace-anchor-simulate-probes'])}
                        >
                          Show me probes
                        </button>
                        <button
                          type="button"
                          data-testid="compare-cta-capture-hardware"
                          className={styles.compareActionButton}
                          onClick={() => handleStagePrimaryCta('hardware', 'hardware-detect-board-button', ['lab-workspace-anchor-hardware-board-detect'])}
                        >
                          Capture hardware trace
                        </button>
                      </div>

                      <details className={styles.compareWhy}>
                        <summary>Why this matters</summary>
                        <div>{getLabStageTeaching(contextLabId, 'simulate').concept}</div>
                      </details>
                    </div>
                  </div>
                ) : null}
                {mode === 'build' ? (
                  <div data-testid="lab-workspace-empty-build" className={styles.emptyState}>
                    <div className={styles.emptyIcon}>⚙️</div>
                    <div>
                      <div className={styles.emptyTitle}>Design</div>
                      <div className={styles.emptyBody}>{buildEmptyCopy.why}</div>
                      <ul className={styles.emptyList}>
                        <li>Produce: {buildEmptyCopy.produce}</li>
                      </ul>
                      <button
                        type="button"
                        data-testid="lab-workspace-build-primary-cta"
                        onClick={() => handleStagePrimaryCta('build', 'hdl-top-input', ['lab-workspace-anchor-build-top-module'])}
                        className={styles.coachCta}
                      >
                        Do it now
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
                      <div className={styles.emptyTitle}>Simulate</div>
                      <div className={styles.emptyBody}>{simulateEmptyCopy.why}</div>
                      <ul className={styles.emptyList}>
                        <li>Produce: {simulateEmptyCopy.produce}</li>
                      </ul>
                      <button
                        type="button"
                        data-testid="lab-workspace-simulate-primary-cta"
                        onClick={() => {
                          setRecentRuns((previous) => ({ ...previous, simulated: true, synthesized: true }));
                          handleStagePrimaryCta('simulate', 'hdl-synth-button', ['lab-workspace-anchor-simulate-run']);
                        }}
                        className={styles.coachCta}
                      >
                        Do it now
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
              <div data-testid="lab-workspace-panel-hardware" className={`${styles.panelLifted} rb-ui-lab-panel-frame`} style={{ height: '100%', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                <div data-testid="lab-workspace-empty-hardware" className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🔌</div>
                  <div>
                    <div className={styles.emptyTitle}>Hardware</div>
                    <div className={styles.emptyBody}>{hardwareEmptyCopy.why}</div>
                    <ul className={styles.emptyList}>
                      <li>Produce: {hardwareEmptyCopy.produce}</li>
                    </ul>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <button
                        type="button"
                        data-testid="lab-workspace-hardware-primary-cta"
                        onClick={() => handleStagePrimaryCta('hardware', 'hardware-detect-board-button', ['lab-workspace-anchor-hardware-board-detect'])}
                        className={styles.coachCta}
                      >
                        Do it now
                      </button>
                      {!hardwareBoardDetected ? (
                        <span data-testid="lab-workspace-hardware-optional-note" className={styles.emptyBody}>
                          Capture appears after detection.
                        </span>
                      ) : null}
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
              <div data-testid="lab-workspace-panel-submit" className={`${styles.panelLifted} ${styles.submitPanel} rb-ui-lab-panel-frame`}>
                <div data-testid="studio-verify-panel" className={styles.verifyPanel}>
                  <div
                    data-testid="studio-verify-verdict"
                    className={`${styles.verifyVerdictCard} ${verifyReady ? styles.verifyVerdictReady : styles.verifyVerdictNotReady}`}
                  >
                    <div className={styles.verifyTitle}>{verifyReady ? NEO_STATUS.READY : NEO_STATUS.NOT_READY}</div>
                    <div className={styles.verifyMuted} style={{ marginTop: 2 }}>
                      {verifyReady
                        ? 'Verify checks are clear. Continue to package export.'
                        : 'Project is not ready. Resolve blockers or missing evidence below.'}
                    </div>
                    {!verifyReady && verifyPrimaryAction ? (
                      <button
                        type="button"
                        data-testid="studio-verify-primary-fix"
                        onClick={() => applyFixIntent(verifyPrimaryAction)}
                        className={styles.verifyButton}
                        style={{ marginTop: 6 }}
                      >
                        {verifyPrimaryAction.label}
                      </button>
                    ) : null}
                  </div>

                  <div data-testid="studio-verify-blockers" className={styles.verifyIssues}>
                    {verifyBlockingIssues.length > 0 ? (
                      verifyBlockingIssues.map((issue, index) => {
                        const fixIntent = resolveSubmissionGateFixIntent(issue);
                        return (
                          <div
                            key={`verify-block-${issue.code}-${index}`}
                            className={`${styles.verifyIssueCard} ${styles.verifyIssueBlock}`}
                          >
                            <div className={styles.verifyTitle}>{issue.title}</div>
                            <div className={styles.verifyMuted} style={{ marginTop: 2 }}>{toOneSentence(issue.message)}</div>
                            <div className={styles.verifyActions}>
                              <button
                                type="button"
                                data-testid={`studio-verify-fix-${index}`}
                                onClick={() => applyFixIntent(fixIntent)}
                                className={styles.verifyButton}
                              >
                                {fixIntent.label}
                              </button>
                              {fixIntent.scrollToTestId || (fixIntent.fallbackScrollToTestIds?.length ?? 0) > 0 ? (
                                <button
                                  type="button"
                                  data-testid={`studio-verify-show-${index}`}
                                  onClick={() => applyFixIntent(fixIntent)}
                                  className={styles.verifyButton}
                                >
                                  Show me
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className={styles.verifyMuted}>No blocking issues detected.</div>
                    )}
                  </div>

                  <details data-testid="studio-verify-warning" className={styles.verifyWarningSection}>
                    <summary className={styles.verifyWarningSummary}>Warnings ({verifyWarningIssues.length})</summary>
                    {verifyWarningIssues.length > 0 ? (
                      <ul className={styles.verifyList}>
                        {verifyWarningIssues.map((issue, index) => (
                          <li key={`verify-warn-${issue.code}-${index}`} className={styles.verifyMuted}>
                            <strong>{issue.title}</strong> — {toOneSentence(issue.message)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className={styles.verifyMuted} style={{ marginTop: 6 }}>No warnings.</div>
                    )}
                  </details>

                  <div data-testid="studio-verify-compare">
                    <div data-testid="compare-panel" className={styles.comparePanel}>
                      <div className={styles.compareHeader}>Sim vs Hardware</div>
                      <div
                        data-testid="compare-verdict"
                        className={`${styles.compareVerdict} ${
                          comparePanel.verdict === 'MATCH'
                            ? styles.compareMatch
                            : comparePanel.verdict === 'MISMATCH'
                              ? styles.compareMismatch
                              : styles.comparePending
                        }`}
                      >
                        {comparePanel.verdict}
                      </div>

                      {comparePanel.state === 'no-hardware' ? (
                        <div className={styles.compareBody}>
                          No hardware trace yet. Capture once on Hardware tab to compare against simulation.
                        </div>
                      ) : null}

                      {comparePanel.state === 'partial' ? (
                        <div className={styles.compareBody}>
                          Partial data. Missing: {comparePanel.missing.join(', ')}.
                        </div>
                      ) : null}

                      {comparePanel.state === 'complete' ? (
                        <>
                          <div className={styles.compareBody}>
                            {comparePanel.verdict === 'MATCH'
                              ? 'Simulation and hardware traces are aligned for current checks.'
                              : 'Mismatch detected between simulation and hardware evidence.'}
                          </div>
                          <ul data-testid="compare-top-mismatches" className={styles.compareList}>
                            {(comparePanel.mismatches.length > 0
                              ? comparePanel.mismatches
                              : [{ signal: 'none', reason: 'No mismatches found.' }]
                            ).map((item) => (
                              <li key={`${item.signal}-${item.reason}`}>
                                <strong>{item.signal}</strong> — {item.reason}
                              </li>
                            ))}
                          </ul>
                          <div data-testid="compare-first-mismatch" className={styles.compareBody}>
                            First mismatch: {comparePanel.mismatches[0]?.firstTick !== undefined ? `tick ${comparePanel.mismatches[0]?.firstTick}` : 'none'}
                          </div>
                        </>
                      ) : (
                        <>
                          <ul data-testid="compare-top-mismatches" className={styles.compareList}>
                            <li>Awaiting trace data to compute mismatches.</li>
                          </ul>
                          <div data-testid="compare-first-mismatch" className={styles.compareBody}>First mismatch: n/a</div>
                        </>
                      )}

                      <div className={styles.compareActions}>
                        <button
                          type="button"
                          data-testid="compare-cta-configure-probes"
                          className={styles.compareActionButton}
                          onClick={() => handleStagePrimaryCta('simulate', 'hdl-synth-button', ['lab-workspace-anchor-simulate-probes'])}
                        >
                          Show me probes
                        </button>
                        <button
                          type="button"
                          data-testid="compare-cta-capture-hardware"
                          className={styles.compareActionButton}
                          onClick={() => handleStagePrimaryCta('hardware', 'hardware-detect-board-button', ['lab-workspace-anchor-hardware-board-detect'])}
                        >
                          Capture hardware trace
                        </button>
                      </div>

                      <details className={styles.compareWhy}>
                        <summary>Why this matters</summary>
                        <div>{getLabStageTeaching(contextLabId, 'simulate').concept}</div>
                      </details>
                    </div>
                  </div>

                  <div data-testid="studio-verify-evidence-summary" className={styles.verifyWarningSection}>
                    <div className={styles.verifyTitle} style={{ marginBottom: 4 }}>Evidence summary</div>
                    <ul className={styles.verifyEvidenceList}>
                      {verifyEvidenceSummary.map((entry) => (
                        <li key={entry.key} className={styles.verifyMuted}>
                          <strong>{entry.label}:</strong> {entry.present ? 'Present' : 'Missing'} · {entry.detail}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {mode === 'submit' && (submitGateResult.issues.length > 0 || submitGateResult.verdict !== 'pass') ? (
                    <details className={styles.verifyWarningSection}>
                      <summary className={styles.verifyWarningSummary}>Explain issues</summary>
                      <div className={styles.verifyIssues} style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          data-testid="studio-verify-explain-issues"
                          className={styles.verifyButton}
                          onClick={() => void handleExplainIssues()}
                          disabled={isIntelligenceLoading}
                        >
                          {isIntelligenceLoading ? 'Analyzing…' : 'Explain issues'}
                        </button>
                        {intelligenceResult ? (
                          <div className={styles.verifyMuted} style={{ whiteSpace: 'pre-line' }}>{intelligenceResult.summary}</div>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </div>

                <div data-testid="lab-workspace-empty-submit" className={styles.emptyState} style={{ borderBottom: 'none' }}>
                  <div className={styles.emptyIcon}>📦</div>
                  <div>
                    <div className={styles.emptyTitle}>Submit</div>
                    <div className={styles.emptyBody}>{submitEmptyCopy.why}</div>
                    <ul className={styles.emptyList}>
                      <li>Produce: {submitEmptyCopy.produce}</li>
                    </ul>
                    <button
                      type="button"
                      data-testid="lab-workspace-submit-primary-cta"
                      onClick={stagePrimaryAction.onClick}
                      className={styles.coachCta}
                    >
                      Do it now
                    </button>
                    <div className={styles.emptyBody} style={{ marginTop: 8 }}>Bundle preview:</div>
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

                <div className={styles.submitMeta}>
                  Export your deterministic submission bundle from the current Studio HDL/fpga snapshot.
                </div>

                <div
                  data-testid="lab-workspace-submit-verdict"
                  className={`${styles.submitVerdict} ${submitGateResult.verdict === 'pass' ? styles.submitVerdictReady : submitGateResult.verdict === 'warn' ? styles.submitVerdictWarning : styles.submitVerdictBlocked}`}
                >
                  <div className={styles.verifyTitle}>
                    {submitGateResult.verdict === 'pass' ? NEO_STATUS.READY : submitGateResult.verdict === 'warn' ? NEO_STATUS.WARNING : NEO_STATUS.NOT_READY}
                  </div>
                  <div className={styles.verifyMuted} style={{ marginTop: 2 }}>
                    {isCheckingSubmitGates
                      ? 'Validating lab-specific submission gates...'
                      : submitGateResult.issues.length > 0
                        ? `${submitGateResult.issues.length} issue(s) detected.`
                        : 'All lab-specific checks passed.'}
                  </div>
                </div>

                <div
                  data-testid="lab-workspace-package-summary"
                  className={styles.packageSummary}
                >
                  <div className={styles.verifyTitle}>Package Summary</div>
                  <div className={styles.submitMeta}>
                    Gates: {submitGateSummary.blocked} blocking · {submitGateSummary.warnings} warning
                    {submitGateSummary.warnings === 1 ? '' : 's'}
                  </div>
                  <div className={styles.proofChipRow}>
                    <span className={`${styles.proofChip} ${submitGateSummary.blocked === 0 ? styles.proofChipPass : styles.proofChipFail}`}>Gates</span>
                    <span className={`${styles.proofChip} ${hasSimulationEvidence ? styles.proofChipPass : styles.proofChipWarn}`}>Sim trace</span>
                    <span className={`${styles.proofChip} ${hasHardwareEvidence ? styles.proofChipPass : styles.proofChipWarn}`}>Hardware trace</span>
                    <span className={`${styles.proofChip} ${(lastBundleManifest?.includedFiles?.length ?? 0) > 0 ? styles.proofChipPass : styles.proofChipWarn}`}>Manifest</span>
                  </div>

                  {lastBundleStatus ? (
                    <div data-testid="lab-workspace-package-last-bundle" className={styles.submitMeta}>
                      Last package: {lastBundleStatus.filename} · {lastBundleStatus.reproducibilityStatus.toUpperCase()} · {lastBundleStatus.bundleId}
                    </div>
                  ) : (
                    <div className={styles.submitMeta}>
                      No package generated yet in this session.
                    </div>
                  )}

                  {lastBundleManifest?.includedFiles?.length ? (
                    <div data-testid="lab-workspace-package-included-files" className={styles.verifyWarningSection}>
                      <div className={styles.verifyTitle} style={{ marginBottom: 4 }}>Included files (proof)</div>
                      <ul className={styles.verifyEvidenceList}>
                        {lastBundleManifest.includedFiles.slice(0, 8).map((entry, index) => (
                          <li key={`${entry.path}-${index}`} data-testid={`lab-workspace-package-included-file-${index}`} className={styles.verifyMuted}>
                            {entry.path} · {entry.sizeBytes} bytes · {entry.sha256.slice(0, 12)}…
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div data-testid="lab-workspace-anchor-submit-readiness" style={{ display: 'none' }} />

                {isSubmissionBlocked && (
                  <div className={styles.blockedBanner} data-testid="lab-workspace-blocked-banner">
                    <div className={styles.blockedBannerTitle}>🔒 Submission Blocked</div>
                    <div className={styles.blockedBannerText}>Resolve the blocking issues below to enable export.</div>
                  </div>
                )}

                {submitGateResult.issues.length > 0 ? (
                  <div data-testid="lab-workspace-submit-gates" style={{ display: 'grid', gap: 8 }}>
                    {submitGateResult.issues.map((issue) => {
                      const fixIntent = resolveSubmissionGateFixIntent(issue);
                      return (
                        <div
                          key={issue.code}
                          className={`${styles.verifyIssueCard} ${issue.severity === 'block' ? styles.verifyIssueBlock : ''}`}
                        >
                          <div className={styles.verifyTitle} style={{ marginBottom: 2 }}>
                            <span className={`${styles.issueIcon} ${issue.severity === 'block' ? styles.issueIconBlock : styles.issueIconWarn}`}>
                              {issue.severity === 'block' ? '✕' : '!'}
                            </span>
                            {issue.severity.toUpperCase()} · {issue.title}
                          </div>
                          <div className={styles.verifyMuted}>{issue.message}</div>
                          {issue.fixHint ? <div className={styles.verifyMuted} style={{ marginTop: 4 }}>Fix: {issue.fixHint}</div> : null}
                          <button
                            type="button"
                            onClick={() => applyFixIntent(fixIntent)}
                            className={styles.verifyButton}
                            style={{ marginTop: 6 }}
                          >
                            {fixIntent.label}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div data-testid="lab-workspace-submit-gates-none" className={styles.verifyMuted}>
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

                {lastBundleStatus && submitGateResult.verdict !== 'block' ? (
                  <div className={styles.successBanner} data-testid="lab-workspace-success-banner">
                    <div>
                      <div className={styles.successBannerTitle}>✓ Export Successful</div>
                      <div className={styles.successBannerText}>Your submission bundle has been generated and saved.</div>
                      <div className={styles.successBannerFilename} data-testid="lab-workspace-submit-status">Generated: {lastBundleStatus.filename}</div>
                    </div>
                    <div className={styles.nextStepSection}>
                      <div className={styles.nextStepLabel}>Next Step</div>
                      <div className={styles.nextStepText}>Upload this bundle to Blackboard for instructor review.</div>
                    </div>
                  </div>
                ) : submitStatus ? (
                  <div className={styles.submitMeta}>
                    <div data-testid="lab-workspace-submit-status">{submitStatus}</div>
                    <div data-testid="lab-workspace-anchor-submit-bundle-preview" style={{ display: 'none' }} />
                  </div>
                ) : null}

                {isTaMode ? (
                  <div data-testid="lab-workspace-ta-only-links" className={styles.verifyMuted} style={{ borderTop: '1px solid var(--rb-ui-lab-border)', paddingTop: 8 }}>
                    Advanced
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
            conceptCallout={stageTeaching.concept}
            stageCommonMistake={stageTeaching.commonMistake}
            whatGoodLooksLike={stageTeaching.goodLooksLike}
            expectedBehaviorVisual={expectedBehaviorVisual}
            readinessLabel={readinessLabel}
            saveLabel="UNSAVED"
            statusLabel={workspaceStatusLabel}
            stageAccent={MODE_ACCENTS[mode]}
            primaryActionLabel={stagePrimaryAction.label}
            onPrimaryAction={stagePrimaryAction.onClick}
            onExportAction={() => void handleGenerateSubmissionBundle()}
            onFixIntent={applyFixIntent}
            onAskRedByte={handleAskRedByte}
            onExplainIssues={handleExplainIssues}
            showExplainIssues={mode === 'submit' && (submitGateResult.issues.length > 0 || submitGateResult.verdict !== 'pass')}
            askRedByteResult={intelligenceResult}
            askRedByteLoading={isIntelligenceLoading}
            onAskRedByteAction={handleIntelligenceAction}
          />
        </aside>
      </div>
    </div>
  );
};

export const LabWorkspaceApp: RedByteApp = {
  manifest: {
    id: 'lab-workspace',
    name: 'Studio',
    iconId: 'cpu',
    category: 'logic',
    defaultSize: { width: 900, height: 650 },
    persistence: 'session',
    hidden: false,
  },
  component: LabWorkspaceAppComponent,
};
