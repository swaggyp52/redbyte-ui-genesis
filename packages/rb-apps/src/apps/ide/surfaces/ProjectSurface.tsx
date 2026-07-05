import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BASYS3_ANODE_PINS,
  BASYS3_BUTTON_PINS,
  BASYS3_CLOCK_PIN,
  BASYS3_DP_PIN,
  BASYS3_LED_PINS,
  BASYS3_SEGMENT_PINS,
  BASYS3_SWITCH_PINS,
  resolveBasys3BoardAlias,
  resolveBasys3PackagePin,
} from '../../../fpga/boards/basys3/basys3Pins';
import {
  type ProjectHealth,
  type ProjectHealthIssue,
  type ProjectHealthMode,
  type ProjectPrimaryCta,
  type ProjectVerifyState,
} from '../projectHealth';
import type { IdeDiagnosticRouteRequest } from '../diagnostics';
import {
  deriveProjectWorkflowAuthority,
  type ProjectWorkflowAuthority,
} from '../projectWorkflowAuthority';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdePanel,
  IdeStatusPill,
  IdeTag,
} from '../components/IdePrimitives';
import { SurfaceCommandStrip, SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import {
  ProjectBridgePanel,
  type ProjectBridgeImportFidelity,
} from '../components/ProjectBridgePanel';
import {
  ProjectIdentityHeader,
  ProjectNextActionCard,
  ProjectMetricsRow,
  ProjectSessionCard,
  ExamplesBrowser,
  type BrowsableExample,
  type ProjectMetric,
  type ProjectNextActionTone,
} from '../components/ProjectSurfacePrimitives';
import { ProjectOverviewPanel } from '../components/ProjectOverviewPanel';
import { ProjectWarningsPanel } from '../components/ProjectWarningsPanel';
import type { ProjectOutlineSummary } from '../projectOutline';
import type { RuntimeSimState } from '../projectRuntime';
import type { GuidedLabTaskDefinition } from '../labTaskDefinition';
import { useIoBus } from '../ioBus';
import { useBoardSignal } from '../BoardSignalContext';
import { getStudentFacingIoLabel } from '../ioLabels';
import { LAB_STARTERS } from '../labStarters';
import { GANNON_PILOT_LABS, formatGannonPilotProofScope } from '../gannonPilotLabs';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import { getProjectKindDisplayName, type ProjectKind, type ScenarioAuthority } from '../projectIdentity';
import {
  EXPORT_STAGE_LABEL,
  MAP_PINS_STAGE_LABEL,
  PROGRAM_STAGE_LABEL,
  STUDENT_WORKFLOW_SUMMARY,
  VERIFY_STAGE_LABEL,
} from '../workflowStages';
import type { ProjectIoMappingKind } from '../examplesCatalog';
import type { IoSignalRole } from '../ioSignalRoles';
import type { IdeChromeContract } from '../chromeContract';
import { PROFESSIONAL_CLASSROOM_COPY } from '../productUiStandards';

export const CHROME_CONTRACT = {
  surfaceId: 'project',
  topStripSlots: ['command-bar'],
  leftDockPolicy: 'hidden',
  rightDockPolicy: 'always',
  exitPaths: [],
} satisfies IdeChromeContract;

export interface ProjectMappingRow {
  id: string;
  nodeId?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
  port: string;
  mappingKind?: ProjectIoMappingKind;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
}

export interface ProjectSurfaceProps {
  projectName: string;
  description: string;
  determinismHash: string;
  topModuleName: string;
  lastSavedAt: string;
  simRunning: boolean;
  readiness: {
    hasCircuit: boolean;
    hasIoMapping: boolean;
    hasVectors: boolean;
    verifyPass: boolean;
    verifyQualification?: 'incomplete-mapping';
    missingRequiredCount: number;
  };
  health: ProjectHealth;
  workflowAuthority?: ProjectWorkflowAuthority;
  mappingRows: ProjectMappingRow[];
  examples: Array<{
    id: string;
    name: string;
    summary: string;
    expectedBehavior: string;
    tags: string[];
    course: string;
    lab: string;
    concept: string;
    learningPath?: import('../examplesCatalog').ExampleLearningPath;
  }>;
  projectKind?: ProjectKind;
  sourceExampleId?: string | null;
  scenarioAuthority?: ScenarioAuthority;
  activeExampleId: string | null;
  onOpenExample: (exampleId: string) => void;
  primaryCtaLabel: string;
  primaryCta: ProjectPrimaryCta;
  onPrimaryCta: () => void;
  onUpdateMappingPin: (rowId: string, pin: string) => void;
  onAutoSuggestMapping: () => void;
  onOpenDesign: () => void;
  onOpenVerify: () => void;
  onOpenExport: () => void;
  onOpenHardware: () => void;
  onOpenImport: () => void;
  guidedLabTask?: GuidedLabTaskDefinition | null;
  onStartGuidedLab?: (labId: string) => void;
  onStartBlankProject?: () => void;
  recentProjects?: Array<{
    projectId: string;
    projectName: string;
    savedAtIso: string;
    projectHash: string;
  }>;
  onOpenSavedProjects?: () => void;
  onOpenRecentProject?: (projectId: string) => void;
  diagnosticRouteRequest?: IdeDiagnosticRouteRequest | null;
  runtimeSim?: RuntimeSimState;
  onGoToHardware?: () => void;
  onSaveNow?: () => void;
  onRestoreLastSave?: () => void;
  onResetProject?: () => void;
  /** Top-level save state of the project (mirrors top-bar). */
  saveState?: 'saved' | 'unsaved' | 'autosaving';
  /** Inline rename — when omitted the project name renders read-only. */
  onRenameProject?: (nextName: string) => void;
  studentName?: string;
  onStudentNameChange?: (name: string) => void;
  hasVerifyRun?: boolean;
  fpgaConfig?: { part: string; top: string; board: string };
  importFidelity?: 'full' | 'reconstructed' | 'partial' | null;
  onFpgaConfigChange?: (config: { part?: string; top?: string }) => void;
  /**
   * Pre-derived structural summary of the project (nodes, modules, IO).
   * Consumed by ProjectOverviewPanel. When omitted, the overview panel is
   * hidden — callers should always supply it in the real app; tests may omit.
   */
  outline?: ProjectOutlineSummary | null;
  /**
   * Navigate to the Design surface and focus the given macro for placement.
   * Optional — when omitted, macro rows in the Overview panel stay read-only.
   */
  onFocusMacro?: (macroId: string, macroName: string) => void;
  /**
   * Navigate to the Design surface and focus the given custom component
   * (palette-filtered). Optional — when omitted, component rows stay read-only.
   */
  onFocusCustomComponent?: (componentName: string) => void;
  /** Schedule-aware roles keyed by student-facing IO label (Design label / port name). */
  ioSignalRolesByLabel?: Record<string, IoSignalRole>;
}

const PROJECT_EMPTY_SIM: RuntimeSimState = {
  tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
  inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
};

const SECURITY_LOCK_STARTER_ID = '23_lab8-fsm-lock-starter-basys3';
const COURSE_LANDING_EXAMPLE_IDS = ['logic-gates', 'half-adder', 'two-bit-counter'] as const;
const SECURITY_LOCK_REFERENCE_PATH = 'labs/ece141-final-project';

export const ProjectSurface: React.FC<ProjectSurfaceProps> = ({
  projectName,
  description,
  determinismHash,
  topModuleName,
  lastSavedAt,
  simRunning,
  readiness,
  health,
  workflowAuthority,
  mappingRows,
  examples,
  projectKind = 'blank',
  sourceExampleId = null,
  scenarioAuthority = 'none',
  activeExampleId,
  onOpenExample,
  primaryCtaLabel,
  primaryCta,
  onPrimaryCta,
  onUpdateMappingPin,
  onAutoSuggestMapping,
  onOpenDesign,
  onOpenVerify,
  onOpenExport,
  onOpenHardware,
  onOpenImport,
  guidedLabTask,
  onStartGuidedLab,
  onStartBlankProject,
  recentProjects = [],
  onOpenSavedProjects,
  onOpenRecentProject,
  diagnosticRouteRequest,
  runtimeSim,
  onGoToHardware,
  onSaveNow,
  onRestoreLastSave,
  onResetProject,
  saveState = 'saved',
  onRenameProject,
  studentName = '',
  onStudentNameChange,
  hasVerifyRun = false,
  fpgaConfig,
  importFidelity,
  onFpgaConfigChange,
  outline = null,
  onFocusMacro,
  onFocusCustomComponent,
  ioSignalRolesByLabel = {},
}) => {
  const [highlightedMappingKey, setHighlightedMappingKey] = useState<string | null>(null);
  const [mappingExpanded, setMappingExpanded] = useState(false);
  const [mappingEditFeedback, setMappingEditFeedback] = useState<string | null>(null);
  const [identityStripEditing, setIdentityStripEditing] = useState(false);
  const [identityStripDraft, setIdentityStripDraft] = useState(projectName);
  const mappingFeedbackTimer = useRef<number | null>(null);
  const identityStripInputRef = useRef<HTMLInputElement | null>(null);
  const identityStripCancelBlurRef = useRef(false);
  const mappingInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mappingSectionRef = useRef<HTMLElement | null>(null);
  const examplesSectionRef = useRef<HTMLElement | null>(null);
  const highlightResetTimer = useRef<number | null>(null);
  const { activeBoardSignal, hoverBoardSignal } = useBoardSignal();
  const effectiveBoardSignal = hoverBoardSignal ?? activeBoardSignal;

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(highlightResetTimer.current);
      }
      if (mappingFeedbackTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(mappingFeedbackTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!identityStripEditing) setIdentityStripDraft(projectName);
  }, [identityStripEditing, projectName]);

  useEffect(() => {
    if (!identityStripEditing) return;
    identityStripInputRef.current?.focus();
    identityStripInputRef.current?.select();
  }, [identityStripEditing]);

  const startIdentityStripEdit = useCallback(() => {
    if (!onRenameProject) return;
    identityStripCancelBlurRef.current = false;
    setIdentityStripEditing(true);
  }, [onRenameProject]);

  const commitIdentityStripEdit = useCallback(() => {
    if (identityStripCancelBlurRef.current) {
      identityStripCancelBlurRef.current = false;
      return;
    }
    const trimmed = identityStripDraft.trim();
    setIdentityStripEditing(false);
    if (trimmed.length > 0 && trimmed !== projectName) {
      onRenameProject?.(trimmed);
      return;
    }
    setIdentityStripDraft(projectName);
  }, [identityStripDraft, onRenameProject, projectName]);

  const cancelIdentityStripEdit = useCallback(() => {
    identityStripCancelBlurRef.current = true;
    setIdentityStripDraft(projectName);
    setIdentityStripEditing(false);
  }, [projectName]);

  const commitMappingPin = useCallback(
    (rowId: string, pin: string) => {
      onUpdateMappingPin(rowId, pin);
      setMappingEditFeedback('Saved — board pins are stored on this project. Export uses this same table.');
      if (mappingFeedbackTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(mappingFeedbackTimer.current);
      }
      if (typeof window !== 'undefined') {
        mappingFeedbackTimer.current = window.setTimeout(() => {
          setMappingEditFeedback(null);
        }, 2800);
      }
    },
    [onUpdateMappingPin]
  );

  useEffect(() => {
    if (!diagnosticRouteRequest) return;
    if (diagnosticRouteRequest.mode !== 'project') return;

    const mappingKey = toMappingKey(
      diagnosticRouteRequest.mappingKey ?? diagnosticRouteRequest.portName ?? ''
    );
    if (!mappingKey) return;

    mappingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMappingExpanded(true);
    setHighlightedMappingKey(mappingKey);

    if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(highlightResetTimer.current);
    }
    if (typeof window !== 'undefined') {
      highlightResetTimer.current = window.setTimeout(() => {
        setHighlightedMappingKey(null);
      }, 1200);
    }
  }, [diagnosticRouteRequest]);

  const sortedMappingRows = useMemo(() => {
    const rows = mappingRows.map((row, index) => ({ ...row, sortIndex: index }));
    rows.sort((left, right) => {
      const leftMissing = left.pin.trim().length === 0 ? 0 : 1;
      const rightMissing = right.pin.trim().length === 0 ? 0 : 1;
      if (leftMissing !== rightMissing) return leftMissing - rightMissing;
      const leftRequired = left.required ? 0 : 1;
      const rightRequired = right.required ? 0 : 1;
      if (leftRequired !== rightRequired) return leftRequired - rightRequired;
      const labelOrder = compareText(left.label, right.label);
      if (labelOrder !== 0) return labelOrder;
      return left.sortIndex - right.sortIndex;
    });
    return rows;
  }, [mappingRows]);

  const unmappedRequiredCount = useMemo(
    () => sortedMappingRows.filter((row) => row.required && row.pin.trim().length === 0).length,
    [sortedMappingRows]
  );
  const mappedRequiredCount = useMemo(
    () => sortedMappingRows.filter((row) => row.required && row.pin.trim().length > 0).length,
    [sortedMappingRows]
  );
  const requiredCount = useMemo(
    () => sortedMappingRows.filter((row) => row.required).length,
    [sortedMappingRows]
  );
  const resolvedWorkflowAuthority = useMemo(
    () =>
      workflowAuthority ??
      deriveProjectWorkflowAuthority({
        projectHealthCore: health,
        readiness: {
          hasCircuit: readiness.hasCircuit,
          hasIoMapping: readiness.hasIoMapping,
          hasVectors: readiness.hasVectors,
          verifyQualification: readiness.verifyQualification,
        },
        verifyLastRun: health.lastVerify,
      }),
    [health, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors, readiness.verifyQualification, workflowAuthority]
  );
  const projectVerifyState = resolvedWorkflowAuthority.verifyState;
  const compareCurrent = resolvedWorkflowAuthority.compareCurrent;
  const comparePassIncomplete = resolvedWorkflowAuthority.comparePassIncomplete;
  const compareMatches = resolvedWorkflowAuthority.compareMatches;
  const compareDiffers = resolvedWorkflowAuthority.compareDiffers;
  const compareTraceOnly = resolvedWorkflowAuthority.compareTraceOnly;
  const activePrimaryCta = workflowAuthority?.primaryCta ?? primaryCta;
  const activePrimaryCtaLabel = workflowAuthority?.primaryCta.label ?? primaryCtaLabel;
  const blockingIssues = useMemo(() => health.blockingIssues, [health.blockingIssues]);
  const activeExample = useMemo(
    () => examples.find((example) => example.id === activeExampleId) ?? null,
    [activeExampleId, examples]
  );
  const [expandedGannonLabId, setExpandedGannonLabId] = useState(GANNON_PILOT_LABS[0]?.id ?? '');
  const starterExample = projectKind === 'example' ? activeExample : null;
  const featuredSecurityStarter = useMemo(
    () => examples.find((example) => example.id === SECURITY_LOCK_STARTER_ID) ?? null,
    [examples]
  );
  const isSecurityLockStarterActive = starterExample?.id === SECURITY_LOCK_STARTER_ID;
  const projectContextLabel = useMemo(() => {
    if (projectKind === 'blank' && readiness.hasCircuit) {
      return 'Fresh Project';
    }
    return getProjectKindDisplayName(projectKind);
  }, [projectKind, readiness.hasCircuit]);
  const showStarterGallery = examples.length > 0 && (projectKind === 'home' || projectKind === 'example');
  const missingRequiredRows = useMemo(
    () =>
      sortedMappingRows.filter((row) => row.required && row.pin.trim().length === 0).slice(0, 4),
    [sortedMappingRows]
  );

  const inputCount = useMemo(() => mappingRows.filter((r) => r.direction === 'in').length, [mappingRows]);
  const outputCount = useMemo(() => mappingRows.filter((r) => r.direction === 'out').length, [mappingRows]);
  const savedAgoLabel = useMemo(() => {
    if (!lastSavedAt) return null;
    try {
      const ts = new Date(lastSavedAt).getTime();
      if (isNaN(ts)) return null;
      const mins = Math.floor((Date.now() - ts) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins} min ago`;
      return `${Math.floor(mins / 60)}h ago`;
    } catch { return null; }
  }, [lastSavedAt]);
  const exportAvailable = resolvedWorkflowAuthority.exportAvailable;
  const exportPackageCurrent = resolvedWorkflowAuthority.exportPackageCurrent;
  const hasSuccessfulExportBundle = resolvedWorkflowAuthority.hasSuccessfulExportBundle;
  const hardwareReady = resolvedWorkflowAuthority.hardwareReady;
  const hardBlockingIssue = blockingIssues.find((issue) =>
    issue.code === 'RBP1000' ||
    issue.code === 'RBP1001' ||
    issue.code === 'RBP1003' ||
    issue.code === 'RBP1005' ||
    issue.code === 'RBP2001'
  ) ?? null;

  const heroStatusMessage = useMemo((): string => {
    if (!readiness.hasCircuit) return 'No circuit loaded yet - build fresh, load an example, or import HDL.';
    if (unmappedRequiredCount > 0)
      return `Circuit loaded - ${unmappedRequiredCount} required pin${unmappedRequiredCount !== 1 ? 's are' : ' is'} unmapped.`;
    if (!readiness.hasIoMapping) return 'Circuit loaded - map pins before hardware use.';
    if (!readiness.hasVectors)
      return 'Mapping complete - add vectors in Verify before you rely on Export or hardware.';
    if (projectVerifyState === 'stale')
      return 'Authored compare results are stale for the current circuit. Open Verify to trace the live design, refresh assertions, or intentionally keep the older reference.';
    if (comparePassIncomplete)
      return 'Assertions matched, but some outputs are still unmapped. Finish mapping before relying on hardware behavior.';
    if (compareTraceOnly)
      return 'Observation trace is current, but expected-output comparison has not run yet.';
    if (compareDiffers)
      return projectVerifyState === 'verify-error'
        ? 'Latest verify run hit a verification error. Export is still available, but inspect Verify before relying on the result.'
        : 'Assertions differ from observed outputs. Export is still available, but review the first difference before relying on the result.';
    if (!compareCurrent) {
      if (exportAvailable && !hasSuccessfulExportBundle) {
        return 'Comparison is not on the current design yet, and no successful export bundle exists. Rerun or open Verify, then build a fresh bundle in Export.';
      }
      return 'Compare results are not current for this design. Rerun Verify, then use Export to preview or build files when mapping allows.';
    }
    if (!exportPackageCurrent) {
      if (!hasSuccessfulExportBundle) {
        return 'No successful export bundle yet. Open Export and use Build Current Bundle when Verify and Map Pins are satisfied.';
      }
      return 'Your last export no longer matches the current circuit. Open Export to re-export a fresh bundle before downloading the Vivado package.';
    }
    return 'All stages complete - bring up on hardware.';
  }, [
    compareCurrent,
    compareDiffers,
    comparePassIncomplete,
    compareTraceOnly,
    exportAvailable,
    exportPackageCurrent,
    hasSuccessfulExportBundle,
    projectVerifyState,
    readiness.hasCircuit,
    readiness.hasIoMapping,
    readiness.hasVectors,
    unmappedRequiredCount,
  ]);

  const projectSummary = useMemo(() => {
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 0) return trimmedDescription;
    if (starterExample?.summary) return starterExample.summary;
    if (!readiness.hasCircuit) return 'Start from Project Home, then build fresh, load an example, or import HDL.';
    if (projectKind === 'blank') {
      return 'This circuit started from a blank canvas. Continue authoring, then map pins and verify before export.';
    }
    if (projectKind === 'custom') {
      return 'This is your authored circuit. Continue mapping, verify the current behavior, and refresh export when ready.';
    }
    if (projectKind === 'import') {
      return 'Imported circuit loaded. Review pins, verify the live behavior, and refresh export before downloading the Vivado package.';
    }
    if (projectKind === 'saved') {
      return 'Saved circuit restored. Pick up at the next required stage before exporting or programming hardware.';
    }
    return `Top module ${topModuleName || 'top'} is loaded and ready for setup.`;
  }, [description, projectKind, readiness.hasCircuit, starterExample?.summary, topModuleName]);

  const verifySummary = useMemo(
    () => getVerifySummary(health, projectVerifyState, compareMatches, comparePassIncomplete),
    [compareMatches, comparePassIncomplete, health, projectVerifyState]
  );
  const exportSummary = useMemo(
    () =>
      getExportSummary(
        health,
        exportAvailable,
        exportPackageCurrent,
        hardwareReady,
        hasSuccessfulExportBundle
      ),
    [exportAvailable, exportPackageCurrent, hasSuccessfulExportBundle, hardwareReady, health]
  );
  const heroStatusTone = hardBlockingIssue ? 'warn' : hardwareReady ? 'ok' : exportAvailable ? 'warn' : 'idle';
  const heroStatusLabel = hardBlockingIssue
    ? 'Action needed'
    : hardwareReady
      ? 'Trusted export ready'
      : activePrimaryCta.mode === 'verify'
        ? 'Verify next'
      : exportAvailable
        ? compareDiffers
          ? 'Review compare'
          : compareCurrent
            ? 'Export available'
          : 'Available export'
        : 'In progress';
  const heroAssistAction = useMemo(() => {
    if (!readiness.hasCircuit) {
      return {
        label: 'Import / Recover',
        onClick: onOpenImport,
      };
    }
    return {
      label: 'Open Design',
      onClick: onOpenDesign,
    };
  }, [onOpenDesign, onOpenImport, readiness.hasCircuit]);
  const nextStepReason = useMemo(() => {
    if (!readiness.hasCircuit) {
      return 'Pick a starter, import HDL, or open Design to begin the circuit workflow.';
    }
    if (unmappedRequiredCount > 0 || activePrimaryCta.mode === 'project') {
      return unmappedRequiredCount > 0
        ? `Assign the ${unmappedRequiredCount} remaining required pin${unmappedRequiredCount !== 1 ? 's' : ''} so Verify, Export, and Hardware describe the real board state.`
        : 'Review the Basys3 mapping before relying on downstream workflow stages.';
    }
    switch (activePrimaryCta.mode) {
      case 'design':
        return 'Return to Design to resolve circuit issues before you rely on Verify, Export, or Hardware.';
      case 'verify':
        if (projectVerifyState === 'stale') {
          return 'The circuit changed after the last authored comparison. Refresh Verify so Project, Export, and Hardware all reflect the current design.';
        }
        if (compareTraceOnly) {
          return 'Observed trace is current, but expected outputs still need to run before you treat Verify as trusted evidence.';
        }
        if (compareDiffers) {
          return 'The latest comparison differs from observed outputs. Inspect the mismatch before you rely on export or hardware behavior.';
        }
        return readiness.hasVectors
          ? 'Run Verify for the current circuit so the workflow has fresh comparison evidence.'
          : 'Add or rerun verification vectors so the current circuit has trusted comparison evidence.';
      case 'export':
        return exportPackageCurrent
          ? 'Export artifacts already match the current mapped design. Review them or open Export to download the trusted Vivado package.'
          : 'Build or refresh the current export bundle before moving to hardware.';
      case 'hardware':
        return 'Mapping, compare evidence, and export artifacts are current. Open Export to download the trusted Vivado package.';
      case 'import':
        return 'Bring in HDL or a Vivado ZIP, then continue through Design, Verify, Export, and Hardware from one project record.';
      default:
        return heroStatusMessage;
    }
  }, [
    activePrimaryCta.mode,
    compareDiffers,
    compareTraceOnly,
    exportPackageCurrent,
    heroStatusMessage,
    projectVerifyState,
    readiness.hasCircuit,
    readiness.hasVectors,
    unmappedRequiredCount,
  ]);
  const bridgeFidelity = useMemo<ProjectBridgeImportFidelity>(() => {
    if (importFidelity === 'full' || importFidelity === 'reconstructed' || importFidelity === 'partial') {
      return importFidelity;
    }
    if (projectKind === 'import') {
      return 'partial';
    }
    return 'native';
  }, [importFidelity, projectKind]);
  const handleProjectModeAction = useCallback(
    (mode: ProjectHealthMode) => {
      switch (mode) {
        case 'design':
          onOpenDesign();
          return;
        case 'verify':
          onOpenVerify();
          return;
        case 'export':
          onOpenExport();
          return;
        case 'hardware':
          onOpenHardware();
          return;
        case 'import':
          onOpenImport();
          return;
        case 'project':
          onOpenHardware();
          return;
        default:
          return;
      }
    },
    [onOpenDesign, onOpenExport, onOpenHardware, onOpenImport, onOpenVerify]
  );


  const ioBusIoRows = useMemo(
    () =>
      mappingRows
        .filter((r): r is ProjectMappingRow & { nodeId: string } => Boolean(r.nodeId))
        .map((r) => ({ nodeId: r.nodeId, label: r.label, direction: r.direction })),
    [mappingRows]
  );
  const ioBus = useIoBus({
    ioRows: ioBusIoRows,
    runtimeSim: runtimeSim ?? PROJECT_EMPTY_SIM,
    setInput: () => {},
  });

  const mappingRowClassNames = useMemo(
    () => sortedMappingRows.map((row, index) => buildMappingRowClass(row, index)),
    [sortedMappingRows]
  );

  const mappingRowsUi = useMemo(
    () =>
      sortedMappingRows.map((row, index) => {
        const mappingView = toMappingView(row, index);
        const mappingKey = toMappingKey(row.label || row.id);
        const displayLabel = getStudentFacingIoLabel(row);
        const rolePresentation = resolveMappingRolePresentation(row, ioSignalRolesByLabel);
        const directPin = isDirectPinRow(row);
        const swM2 = /^SW(\d+)$/i.exec(row.label);
        const ldM2 = /^LD(\d+)$/i.exec(row.label);
        const rowSigType = swM2 ? 'sw' : ldM2 ? 'ld' : null;
        const rowSigIdx = swM2 ? parseInt(swM2[1], 10) : ldM2 ? parseInt(ldM2[1], 10) : -1;
        const isActiveRow =
          !!effectiveBoardSignal &&
          !!rowSigType &&
          effectiveBoardSignal.type === rowSigType &&
          effectiveBoardSignal.index === rowSigIdx;
        const portCell = (
          <div
            key={`${row.id}-port`}
            className="ide-project-map-port-cell"
            data-testid={`ide-project-port-wrap-${mappingKey}`}
          >
            <span
              data-testid={`ide-project-port-${mappingKey}`}
              style={isActiveRow ? {
                background: 'color-mix(in srgb, var(--rb-signal) 12%, transparent)',
                borderRadius: 'var(--ide-radius-s)',
                padding: '1px 4px',
                cursor: onGoToHardware ? 'pointer' : undefined,
              } : undefined}
              onClick={isActiveRow && onGoToHardware ? () => onGoToHardware() : undefined}
            >
              <code style={{ fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>
                {displayLabel}
              </code>
            </span>
            <span
              className={`ide-project-map-req-badge${row.required ? ' is-required' : ' is-optional'}`}
              data-testid={`ide-project-map-req-${mappingKey}`}
            >
              {row.required ? 'Required' : 'Optional'}
            </span>
          </div>
        );
        const roleCell = (
          <span
            key={`${row.id}-role`}
            className="ide-project-map-role-cell"
            data-testid={`ide-project-role-${mappingKey}`}
            title={rolePresentation.title}
          >
            <IdeTag tone={rolePresentation.tagTone}>{rolePresentation.tag}</IdeTag>
          </span>
        );
        const pinCell = directPin ? (
          <div
            className={`ide-project-pin-field ide-project-pin-field--locked ${
              highlightedMappingKey === mappingKey ? 'is-highlighted' : ''
            }`}
            data-testid={`ide-project-pin-field-${mappingKey}`}
            title={
              mappingView.bindingDisplay !== '-'
                ? `Saved Basys3 binding: ${mappingView.bindingDisplay}`
                : `Assign this port in Map Pins. Suggested board resource: ${suggestBasys3Pin(row, index)}`
            }
          >
            <span className="ide-project-pin-locked-copy">
              {mappingView.bindingDisplay !== '-' ? mappingView.bindingDisplay : 'Assign in Map Pins'}
            </span>
          </div>
        ) : (
          <div
            className="ide-project-pin-field ide-project-pin-field--locked"
            data-testid={`ide-project-pin-locked-${mappingKey}`}
            title="This row is not a single Basys3 pin assignment. Change buses or slices in Design; Export still reflects structured entries."
          >
            <span className="ide-project-pin-locked-copy">Structured IO — edit in Design</span>
          </div>
        );
        return [
          portCell,
          roleCell,
          <span key={`${row.id}-alias`} data-testid={`ide-project-alias-${mappingKey}`}>
            {mappingView.aliasDisplay}
          </span>,
          pinCell,
          row.direction.toUpperCase(),
          <span key={`${row.id}-status`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IdeStatusPill tone={mappingView.statusTone}>
              {mappingView.statusLabel}
            </IdeStatusPill>
            {row.nodeId && (() => {
              const swM = /^SW(\d+)$/i.exec(row.label);
              const ldM = /^LD(\d+)$/i.exec(row.label);
              if (swM) {
                const bit = ioBus.state.sw[parseInt(swM[1], 10)] ?? 0;
                return (
                  <span
                    data-testid={`ide-project-live-dot-${row.id}`}
                    style={{ fontSize: 10, color: bit ? 'var(--rb-signal)' : 'var(--ide-text-subtle, #4a5568)' }}
                    title={`Live: ${bit ? 'HIGH' : 'LOW'}`}
                  >*</span>
                );
              }
              if (ldM) {
                const bit = ioBus.state.ld[parseInt(ldM[1], 10)] ?? 0;
                return (
                  <span
                    data-testid={`ide-project-live-dot-${row.id}`}
                    style={{ fontSize: 10, color: bit ? 'var(--rb-signal)' : 'var(--ide-text-subtle, #4a5568)' }}
                    title={`Live: ${bit ? 'HIGH' : 'LOW'}`}
                  >*</span>
                );
              }
              return null;
            })()}
          </span>,
        ];
      }),
    [
      effectiveBoardSignal,
      highlightedMappingKey,
      ioBus,
      ioSignalRolesByLabel,
      onGoToHardware,
      sortedMappingRows,
    ]
  );

  const stageCompletion = resolvedWorkflowAuthority.stageCompletion;
  const designCardDone = stageCompletion.design;
  const workflowTruthRows = useMemo(
    () => [
      {
        label: 'Design',
        tone: (designCardDone ? 'ok' : 'warn') as const,
        status: designCardDone ? 'CURRENT' : 'NEEDS CIRCUIT',
        copy: designCardDone
          ? 'Circuit structure is loaded in this project record.'
          : 'Start in Design before Verify, Map Pins, or Export can be trusted.',
      },
      {
        label: 'Verify',
        tone: (compareMatches ? 'ok' : 'warn') as const,
        status: compareMatches
          ? 'CHECKS CURRENT'
          : comparePassIncomplete
            ? 'REVIEW MAPPING'
            : compareDiffers
              ? 'CHECKS DIFFER'
              : compareTraceOnly
                ? 'OBSERVATION ONLY'
                : compareCurrent
                  ? 'TRACE CURRENT'
                  : 'NOT RUN',
        copy: verifySummary,
      },
      {
        label: MAP_PINS_STAGE_LABEL,
        tone: (readiness.hasIoMapping ? 'ok' : 'warn') as const,
        status: readiness.hasIoMapping ? 'READY' : 'BLOCKED',
        copy: readiness.hasIoMapping
          ? `${mappedRequiredCount}/${requiredCount} required pins assigned.`
          : `${unmappedRequiredCount} required pin${unmappedRequiredCount !== 1 ? 's are' : ' is'} still missing.`,
      },
      {
        label: EXPORT_STAGE_LABEL,
        tone: (exportPackageCurrent ? 'ok' : 'warn') as const,
        status: exportPackageCurrent ? 'CURRENT PACKAGE' : exportAvailable ? 'AVAILABLE' : 'BLOCKED',
        copy: exportSummary,
      },
    ],
    [
      compareCurrent,
      compareDiffers,
      compareMatches,
      comparePassIncomplete,
      compareTraceOnly,
      designCardDone,
      exportAvailable,
      exportPackageCurrent,
      exportSummary,
      mappedRequiredCount,
      readiness.hasIoMapping,
      requiredCount,
      unmappedRequiredCount,
      verifySummary,
    ]
  );
  const dockStageItems = useMemo(
    () => [
      {
        id: 'design',
        step: '01',
        label: 'Design',
        meta: stageCompletion.design ? 'Complete' : 'Start here',
        state: stageCompletion.design ? 'done' : activePrimaryCta.mode === 'design' ? 'active' : 'idle',
        onClick: onOpenDesign,
        testId: 'ide-project-dock-nav-design',
      },
      {
        id: 'verify',
        step: '02',
        label: 'Verify',
        meta: compareMatches
          ? 'Assertions match'
          : comparePassIncomplete
            ? 'Match review'
            : compareDiffers
              ? 'Assertions differ'
              : compareCurrent
                ? 'Simulation current'
                : activePrimaryCta.mode === 'verify'
                  ? 'Run now'
                  : 'Waiting',
        state: stageCompletion.verify ? 'done' : activePrimaryCta.mode === 'verify' ? 'active' : 'idle',
        onClick: onOpenVerify,
        testId: 'ide-project-dock-nav-verify',
      },
      {
        id: 'hardware',
        step: '03',
        label: MAP_PINS_STAGE_LABEL,
        meta: stageCompletion.hardware
          ? hardwareReady ? 'Ready to program' : 'Pins mapped'
          : activePrimaryCta.mode === 'hardware' ? 'Map now' : 'Needs pins',
        state: stageCompletion.hardware ? 'done' : activePrimaryCta.mode === 'hardware' ? 'active' : 'idle',
        onClick: onOpenHardware,
        testId: 'ide-project-dock-nav-hardware',
      },
      {
        id: 'export',
        step: '04',
        label: EXPORT_STAGE_LABEL,
        meta: stageCompletion.export ? 'Current' : exportAvailable ? 'Open now' : activePrimaryCta.mode === 'export' ? 'Next up' : 'Waiting',
        state: stageCompletion.export ? 'done' : exportAvailable && activePrimaryCta.mode === 'export' ? 'active' : 'idle',
        onClick: onOpenExport,
        testId: 'ide-project-dock-nav-export',
      },
    ],
    [
      stageCompletion,
      exportAvailable,
      hardwareReady,
      onOpenDesign,
      onOpenHardware,
      onOpenExport,
      onOpenVerify,
      activePrimaryCta.mode,
      compareCurrent,
      compareDiffers,
      compareMatches,
      comparePassIncomplete,
    ]
  );
  const hasRecentEntryPoints = recentProjects.length > 0 || Boolean(onOpenSavedProjects);
  const landingPrimaryExamples = useMemo(() => {
    const examplesById = new Map(examples.map((example) => [example.id, example]));
    const coursePathExamples = COURSE_LANDING_EXAMPLE_IDS
      .map((id) => examplesById.get(id))
      .filter((example): example is NonNullable<typeof example> => Boolean(example));

    return coursePathExamples.length === COURSE_LANDING_EXAMPLE_IDS.length
      ? coursePathExamples
      : examples.slice(0, 3);
  }, [examples]);
  const alternateStarterExamples = useMemo(() => {
    if (examples.length === 0) return [];
    if (!featuredSecurityStarter) return examples.slice(0, 3);
    return [
      featuredSecurityStarter,
      ...examples.filter((example) => example.id !== featuredSecurityStarter.id),
    ].slice(0, 4);
  }, [examples, featuredSecurityStarter]);
  const handleStartBlankProject = useCallback(() => {
    const start = onStartBlankProject ?? onOpenDesign;
    if (readiness.hasCircuit && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Build Fresh will replace the current workspace with a fresh blank project. Cancel keeps your current work. Confirm means replace current work; the current project will be replaced and local saved projects stay available.'
      );
      if (!confirmed) return;
    }
    start();
  }, [onOpenDesign, onStartBlankProject, readiness.hasCircuit]);
  const handleOpenGannonLabPack = useCallback(() => {
    if (typeof document !== 'undefined') {
      const labPack = document.querySelector<HTMLElement>('[data-testid="ide-project-gannon-lab-pack"]');
      if (labPack) {
        labPack.scrollIntoView({ behavior: 'smooth', block: 'start' });
        labPack.focus?.();
        return;
      }
    }

    const firstLab = GANNON_PILOT_LABS[0];
    if (firstLab) {
      onOpenExample(firstLab.exampleId);
    }
  }, [onOpenExample]);
  const handleOpenStarterPath = useCallback(() => {
    if (typeof document !== 'undefined') {
      const starterBrowser = document.querySelector<HTMLElement>('[data-testid="ide-project-examples-disclosure"]');
      if (starterBrowser) {
        if (starterBrowser.getAttribute('data-expanded') === 'false') {
          starterBrowser.querySelector<HTMLButtonElement>('[data-testid="ide-projectx-examples-toggle"]')?.click();
        }
        starterBrowser.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    const firstStarterId = landingPrimaryExamples[0]?.id;
    if (firstStarterId) {
      onOpenExample(firstStarterId);
    }
  }, [landingPrimaryExamples, onOpenExample]);
  return (
    <IdeSurfaceLayout
      mode="project"
      layoutIntent="workbench"
      consoleHasBlocking={false}
      consoleHasEntries={false}
      leftDockMode="hidden"
      consoleMode="hidden"
      inspector={null}
      hideRightDock
      productSpine={{
        statusLabel: readiness.hasCircuit ? heroStatusLabel : 'No circuit',
        statusTone: readiness.hasCircuit
          ? heroStatusTone === 'ok'
            ? 'ok'
            : heroStatusTone === 'warn'
              ? 'warn'
              : 'idle'
          : 'idle',
        detail: readiness.hasCircuit
          ? nextStepReason
          : PROFESSIONAL_CLASSROOM_COPY.projectFirstLaunchDetail,
        primaryLabel: readiness.hasCircuit ? `Continue to ${activePrimaryCtaLabel}` : 'Start a Lab',
        onPrimary: readiness.hasCircuit ? onPrimaryCta : undefined,
        recoveryLabel: readiness.hasCircuit ? heroAssistAction.label : 'Import / Recover',
        onRecovery: readiness.hasCircuit ? heroAssistAction.onClick : onOpenImport,
        doneLabel: readiness.hasCircuit
          ? 'Current project is loaded and the next surface is selected.'
          : 'A starter, blank design, saved project, or import is loaded.',
        blockedLabel: readiness.hasCircuit ? heroStatusMessage : 'No circuit loaded yet.',
      }}
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-project-start-dock">
          {/* Quick surface navigation */}
          <div className="ide-project-dock-nav" data-testid="ide-project-dock-nav">
            <p className="ide-surface-block-label">Jump to stage</p>
            <div className="ide-project-dock-stage-grid">
              {dockStageItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ide-project-dock-stage is-${item.state}`}
                  onClick={item.onClick}
                  data-testid={item.testId}
                >
                  <span className="ide-project-dock-stage-step">{item.step}</span>
                  <span className="ide-project-dock-stage-label">{item.label}</span>
                  <span className="ide-project-dock-stage-meta">{item.meta}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      }
      console={
        <section className="ide-workbench-console-content" data-testid="ide-project-console">
          <header className="ide-workbench-console-header">
            <h3>Project Console</h3>
            <span className="ide-workbench-console-mode">Project</span>
          </header>
          {blockingIssues.length > 0 ? (
            <IdeCallout tone="warn" title="Blocking issues">
              {blockingIssues[0]?.message}
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="Ready">
              No blockers. Continue through {STUDENT_WORKFLOW_SUMMARY}.
            </IdeCallout>
          )}
        </section>
      }
    >
      {/* Workspace: Hero - Examples - Mapping */}
      <IdePanel
        testId="ide-project-panel"
      >
        <div
          className={`ide-project-identity-strip${readiness.hasCircuit ? ' ide-project-identity-strip--loaded' : ''}`}
          data-testid="ide-project-identity-strip"
        >
          {identityStripEditing ? (
            <input
              ref={identityStripInputRef}
              type="text"
              className="ide-project-identity-name-input"
              value={identityStripDraft}
              aria-label="Project title"
              data-testid="ide-project-identity-strip-input"
              onChange={(event) => setIdentityStripDraft(event.target.value)}
              onBlur={commitIdentityStripEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitIdentityStripEdit();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelIdentityStripEdit();
                }
              }}
            />
          ) : onRenameProject ? (
            <button
              type="button"
              className="ide-project-identity-name ide-project-identity-name-button"
              title={`Rename project "${projectName}"`}
              aria-label={`Project title ${projectName}. Click or double-click to rename.`}
              data-testid="ide-project-identity-strip-title"
              onClick={startIdentityStripEdit}
              onDoubleClick={startIdentityStripEdit}
            >
              {projectName}
            </button>
          ) : (
            <span className="ide-project-identity-name" data-testid="ide-project-identity-strip-title">
              {projectName}
            </span>
          )}
          {studentName && (
            <span className="ide-project-identity-student">{studentName}</span>
          )}
        </div>
        {/* Sprint 10: 3-state layout - landing / loaded / submit */}
        {!readiness.hasCircuit ? (
          /* STATE A: No circuit - clean 3-option landing */
          <div className="ide-project-landing" data-testid="ide-project-landing">
            <div
              className="ide-project-command-center ide-project-command-center--launch"
              data-testid="ide-project-command-center"
            >
            <section className="ide-project-start-hub" data-testid="ide-project-start-hub">
              <div className="ide-project-landing-header">
                <p className="ide-surface-block-label">Project command center</p>
                <h2 className="ide-project-landing-title">
                  Project command center
                </h2>
                <p className="ide-project-landing-sub">
                  Pick the current job for this Basys3 project: build fresh, load a course starter,
                  reopen local work, or import and recover an existing design.
                </p>
                {guidedLabTask && onStartGuidedLab ? (
                  <button
                    type="button"
                    className="ide-project-guided-lab-inline"
                    onClick={() => onStartGuidedLab(guidedLabTask.id)}
                    data-testid="ide-project-guided-full-adder-lab"
                    title={guidedLabTask.assignment}
                  >
                    <span data-testid="ide-project-guided-full-adder-start">
                      {guidedLabTask.shortTitle} scratch lab
                    </span>
                    <small>A/B/Cin -&gt; Sum/Cout</small>
                  </button>
                ) : null}
                {/* Primary launch actions */}
                <div className="ide-project-primary-actions" data-testid="ide-project-primary-actions">
                  <button
                    type="button"
                    className="ide-project-primary-action ide-project-primary-action--lab is-primary"
                    onClick={handleOpenGannonLabPack}
                    data-testid="ide-project-start-a-lab-primary"
                    data-product-priority="primary"
                  >
                    <span className="ide-project-primary-action-icon" aria-hidden="true">LAB</span>
                    <span className="ide-project-primary-action-label">Start a Lab</span>
                    <span className="ide-project-primary-action-sub">Open the Gannon Pilot lab pack</span>
                  </button>
                  <button
                    type="button"
                    className="ide-project-primary-action ide-project-primary-action--build"
                    onClick={handleStartBlankProject}
                    data-testid="ide-project-build-fresh-primary"
                    data-product-priority="secondary"
                  >
                    <span className="ide-project-primary-action-icon" aria-hidden="true">+</span>
                    <span className="ide-project-primary-action-label">Build fresh</span>
                    <span className="ide-project-primary-action-sub">Empty canvas; cancel keeps current work</span>
                  </button>
                  <button
                    type="button"
                    className="ide-project-primary-action ide-project-primary-action--starter"
                    onClick={handleOpenStarterPath}
                    data-testid="ide-project-open-starter-primary"
                    data-product-priority="secondary"
                  >
                    <span className="ide-project-primary-action-icon" aria-hidden="true">OPEN</span>
                    <span className="ide-project-primary-action-label">Open Starter</span>
                    <span className="ide-project-primary-action-sub">Browse guided starter examples</span>
                  </button>
                  {onOpenImport && (
                    <button
                      type="button"
                      className="ide-project-primary-action ide-project-primary-action--import"
                      onClick={onOpenImport}
                      data-testid="ide-project-import-primary"
                      data-product-priority="secondary"
                    >
                      <span className="ide-project-primary-action-icon" aria-hidden="true">IN</span>
                      <span className="ide-project-primary-action-label">Import / Recover</span>
                      <span className="ide-project-primary-action-sub">Restore a RedByte ZIP or inspect HDL safely</span>
                    </button>
                  )}
                  {hasRecentEntryPoints && onOpenSavedProjects && (
                    <button
                      type="button"
                      className="ide-project-primary-action ide-project-primary-action--open"
                      onClick={onOpenSavedProjects}
                      data-testid="ide-project-open-existing-primary"
                      data-product-priority="secondary"
                    >
                      <span className="ide-project-primary-action-icon" aria-hidden="true">OPEN</span>
                      <span className="ide-project-primary-action-label">Open Saved Project</span>
                      <span className="ide-project-primary-action-sub">Resume previous work</span>
                    </button>
                  )}
                </div>
              </div>
              <div
                className="ide-project-start-summary"
                data-testid="ide-project-start-summary"
                data-hierarchy-surface="project"
                data-hierarchy-role="context"
              >
                <span className="ide-project-start-summary-chip">No circuit loaded</span>
                <span className="ide-project-start-summary-chip">Course starters available</span>
                <span className="ide-project-start-summary-chip">Next: Design</span>
                <span className="ide-project-start-summary-chip">Design -&gt; Verify -&gt; Map Pins -&gt; Export</span>
              </div>
              {/* Primary launch actions */}
              <div className="ide-project-primary-actions ide-project-primary-actions--legacy" hidden>
                <button
                  type="button"
                  className="ide-project-primary-action ide-project-primary-action--build"
                  onClick={handleStartBlankProject}
                  data-legacy-testid="ide-project-build-fresh-primary"
                >
                  <span className="ide-project-primary-action-icon" aria-hidden="true">+</span>
                  <span className="ide-project-primary-action-label">Build fresh</span>
                  <span className="ide-project-primary-action-sub">Start from an empty canvas</span>
                </button>
                {onOpenImport && (
                  <button
                    type="button"
                    className="ide-project-primary-action ide-project-primary-action--import"
                    onClick={onOpenImport}
                    data-legacy-testid="ide-project-import-primary"
                  >
                    <span className="ide-project-primary-action-icon" aria-hidden="true">IN</span>
                    <span className="ide-project-primary-action-label">Import / Recover</span>
                    <span className="ide-project-primary-action-sub">Restore a RedByte ZIP or inspect HDL safely</span>
                  </button>
                )}
                {hasRecentEntryPoints && onOpenSavedProjects && (
                  <button
                    type="button"
                    className="ide-project-primary-action ide-project-primary-action--open"
                    onClick={onOpenSavedProjects}
                    data-legacy-testid="ide-project-open-existing-primary"
                  >
                    <span className="ide-project-primary-action-icon" aria-hidden="true">OPEN</span>
                    <span className="ide-project-primary-action-label">Open Saved Project</span>
                    <span className="ide-project-primary-action-sub">Resume previous work</span>
                  </button>
                )}
              </div>
              <div
                className={`ide-project-start-grid${hasRecentEntryPoints ? '' : ' is-launch-only'}`}
                data-testid="ide-project-start-grid"
              >
                {hasRecentEntryPoints ? (
                  <div className="ide-project-recent-panel" data-testid="ide-project-recent-panel">
                    <div className="ide-project-recent-head">
                      <div>
                        <p className="ide-project-recent-title">Continue or reopen</p>
                        <p className="ide-project-recent-sub">
                          Pick up recent work or browse the full local project list.
                        </p>
                      </div>
                      {onOpenSavedProjects && (
                        <IdeButton
                          tone="secondary"
                          onClick={onOpenSavedProjects}
                          testId="ide-project-open-existing"
                        >
                          Open existing project...
                        </IdeButton>
                      )}
                    </div>
                    {recentProjects.length > 0 ? (
                      <div className="ide-project-recent-list">
                        {recentProjects.map((project) => (
                          <button
                            key={project.projectId}
                            type="button"
                            className="ide-project-recent-card"
                            onClick={() => onOpenRecentProject?.(project.projectId)}
                            data-testid={`ide-project-recent-${project.projectId}`}
                          >
                            <span className="ide-project-recent-card-title">{project.projectName}</span>
                            <span className="ide-project-recent-card-meta">
                              Saved {formatSavedAt(project.savedAtIso)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="ide-project-recent-empty">
                        No local saves yet. Start from a guided example or open a blank design.
                      </p>
                    )}
                  </div>
                ) : null}
                <div
                  className="ide-project-start-column"
                  data-testid="ide-project-start-column"
                  data-hierarchy-surface="project"
                  data-hierarchy-role="primary"
                  data-hierarchy-focal="command-center-paths"
                >
                  <div className="ide-project-start-column-head">
                    <p className="ide-project-recent-title">Course starters</p>
                    <p className="ide-project-recent-sub">
                      Load a guided design when the assignment begins from a starter.
                    </p>
                  </div>
                  <div className="ide-project-landing-options">
                    {landingPrimaryExamples.map((ex, index) => {
                      const preview = getExamplePreview(ex.id);
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          className="ide-project-landing-option"
                          onClick={() => { onOpenExample(ex.id); }}
                          data-testid={`ide-project-landing-example-${ex.id}`}
                          data-hierarchy-surface={index === 0 ? 'project' : undefined}
                          data-hierarchy-role={index === 0 ? 'next' : undefined}
                        >
                          <span className="ide-project-landing-option-eyebrow">{preview.eyebrow}</span>
                          <span className="ide-project-landing-option-title">{ex.name}</span>
                          <span className="ide-project-landing-option-sub">{ex.concept}</span>
                          {ex.expectedBehavior && (
                            <span className="ide-project-landing-option-learn">{ex.expectedBehavior}</span>
                          )}
                          <span className="ide-project-landing-option-cta">Load &amp; Design -&gt;</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
            </div>

            {/* Lab Starters Gallery */}
            <details
              className="ide-project-lab-gallery-disclosure"
              data-testid="ide-project-lab-gallery-disclosure"
              data-hierarchy-surface="project"
              data-hierarchy-role="advanced"
              open
            >
              <summary className="ide-project-lab-gallery-summary">All lab starters (8 labs)</summary>
              <div className="ide-project-lab-gallery" data-testid="ide-project-lab-gallery">
                {LAB_STARTERS.map((starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    className="ide-project-lab-card"
                    onClick={() => { onOpenExample(starter.example.id); }}
                    data-testid={`ide-project-lab-card-${starter.id}`}
                  >
                    <span className="ide-project-lab-card-number">Lab {starter.labNumber}</span>
                    <span className="ide-project-lab-card-title">{starter.title.replace(/^Lab \d+\s+[-\u2013\u2014]\s+/u, '')}</span>
                    <span className="ide-project-lab-card-desc">{starter.description}</span>
                    <div className="ide-project-lab-card-meta">
                      <span className={`ide-project-lab-card-badge ide-project-lab-card-badge--${starter.difficulty}`}>
                        {starter.difficulty}
                      </span>
                      <span className="ide-project-lab-card-time">{starter.estimatedMinutes} min</span>
                    </div>
                    <span className="ide-project-lab-card-cta">Start -&gt;</span>
                  </button>
                ))}
              </div>
            </details>
            <section
              className="ide-project-gannon-lab-pack"
              data-testid="ide-project-gannon-lab-pack"
              tabIndex={-1}
              aria-label="Gannon Pilot lab pack"
            >
              <header className="ide-project-gannon-lab-pack-header">
                <div>
                  <p className="ide-surface-block-label">Start a Lab</p>
                  <h3>Gannon Pilot lab pack</h3>
                  <p>
                    Five browser-first Basys3 labs for the pilot path. Students submit the generated ZIP;
                    Vivado build, bitstream, and board observation stay external unless the instructor assigns them.
                  </p>
                </div>
                <IdeStatusPill tone="warn">Browser E0</IdeStatusPill>
              </header>
              <div className="ide-project-gannon-lab-grid">
                {GANNON_PILOT_LABS.map((lab) => {
                  const expanded = expandedGannonLabId === lab.id;
                  return (
                    <article
                      key={lab.id}
                      className={`ide-project-gannon-lab-card${expanded ? ' is-expanded' : ''}`}
                      data-testid={`ide-project-gannon-lab-card-${lab.id}`}
                      data-expanded={expanded ? 'true' : 'false'}
                    >
                      <button
                        type="button"
                        className="ide-project-gannon-lab-card-header"
                        onClick={() => setExpandedGannonLabId(expanded ? '' : lab.id)}
                        data-testid={`ide-project-gannon-lab-details-${lab.id}`}
                        aria-expanded={expanded}
                      >
                        <span>Lab {lab.labNumber}</span>
                        <strong>{lab.title}</strong>
                        <small>{lab.difficulty}</small>
                      </button>
                      <div className="ide-project-gannon-lab-card-body" hidden={!expanded}>
                        <p><strong>Build:</strong> {lab.build}</p>
                        <p><strong>Submit:</strong> {lab.submit}</p>
                        <p><strong>Scope:</strong> {formatGannonPilotProofScope(lab.proofScope)}</p>
                        <IdeButton
                          tone="secondary"
                          onClick={() => onOpenExample(lab.exampleId)}
                          testId={`ide-project-gannon-lab-start-${lab.id}`}
                        >
                          {lab.startLabel}
                        </IdeButton>
                      </div>
                    </article>
                  );
                })}
              </div>
              <details className="ide-project-instructor-note" data-testid="ide-instructor-note">
                <summary>For instructors</summary>
                <p>
                  RedByte currently proves browser-E0 project package generation for these labs. Vivado build
                  evidence, bitstream generation, programming success, and observed board behavior are external
                  pilot checkpoints. Recommended pilot scope: Labs 1-5 as browser workflows, with separate
                  instructor-run Vivado or board checks when needed.
                </p>
              </details>
            </section>
          </div>
        ) : (
          <>
        {/* ─────────────────────────────────────────────────────────────────
            STRUCTURAL DASHBOARD — identity → next action → metrics
            New primitives that establish a real project home. The old
            SurfaceCommandStrip is replaced by ProjectNextActionCard below
            (which carries the legacy command-strip testids for compat).
            ───────────────────────────────────────────────────────────── */}
        <div
          className="ide-project-command-center ide-project-command-center--loaded"
          data-testid="ide-project-command-center"
        >
        <div className="ide-projectx-shell" data-testid="ide-projectx-shell">
          <section
            className="ide-project-command-board-v1"
            data-testid="ide-project-command-board-v1"
            aria-label="Loaded project command center"
          >
          <ProjectIdentityHeader
            projectName={projectName}
            onRenameProject={onRenameProject}
            projectKindLabel={projectContextLabel}
            sourceLabel={starterExample?.name}
            board={fpgaConfig?.board ?? 'Basys3'}
            saveState={saveState}
            lastSavedAt={savedAgoLabel ?? undefined}
            studentName={studentName || undefined}
          />
          <ProjectNextActionCard
            tone={
              heroStatusTone === 'ok'
                ? 'success'
                : heroStatusTone === 'warn'
                  ? hardBlockingIssue ? 'blocked' : 'attention'
                  : 'ready'
            }
            statusLabel={heroStatusLabel.toUpperCase()}
            title={`Current action: ${activePrimaryCtaLabel}`}
            subline={heroStatusMessage}
            sublineTestId="ide-project-hero-status"
            reason={nextStepReason}
            primaryLabel={`Continue to ${activePrimaryCtaLabel} →`}
            onPrimary={onPrimaryCta}
            primaryTestId="ide-project-command-strip-primary-cta"
            secondaryLabel={heroAssistAction.label}
            onSecondary={heroAssistAction.onClick}
            secondaryTestId="ide-project-command-strip-secondary-cta"
            rootTestId="ide-project-command-strip"
            reasonTestId="ide-project-command-strip-next-step-copy"
          />
          <section
            className="ide-project-command-mode-actions"
            data-testid="ide-project-command-mode-actions"
            aria-label="Current project commands"
          >
            <button
              type="button"
              className="ide-project-command-mode-action"
              onClick={onOpenDesign}
              data-testid="ide-project-command-action-design"
            >
              <span>Design</span>
              <strong>Edit circuit</strong>
            </button>
            <button
              type="button"
              className={`ide-project-command-mode-action${activePrimaryCta.mode === 'verify' ? ' is-next' : ''}`}
              onClick={onOpenVerify}
              data-testid="ide-project-command-action-verify"
            >
              <span>Verify</span>
              <strong>{activePrimaryCta.mode === 'verify' ? 'Next action' : 'Run checks'}</strong>
            </button>
            <button
              type="button"
              className={`ide-project-command-mode-action${activePrimaryCta.mode === 'project' ? ' is-next' : ''}`}
              onClick={onOpenHardware}
              data-testid="ide-project-command-action-map-pins"
            >
              <span>Map Pins</span>
              <strong>{unmappedRequiredCount > 0 ? `${unmappedRequiredCount} left` : 'Mapped'}</strong>
            </button>
            <button
              type="button"
              className={`ide-project-command-mode-action${activePrimaryCta.mode === 'export' || activePrimaryCta.mode === 'hardware' ? ' is-next' : ''}`}
              onClick={onOpenExport}
              data-testid="ide-project-command-action-export"
            >
              <span>Export</span>
              <strong>{exportPackageCurrent ? 'Current package' : exportAvailable ? 'Draft ready' : 'Build files'}</strong>
            </button>
          </section>
          {guidedLabTask && onStartGuidedLab ? (
            <section className="ide-guided-lab-card ide-guided-lab-card--loaded" data-testid="ide-project-guided-full-adder-lab-loaded">
              <div>
                <p className="ide-surface-block-label">Scratch lab</p>
                <h3>{guidedLabTask.title}</h3>
                <p>{guidedLabTask.assignment}</p>
              </div>
              <IdeButton
                tone="secondary"
                onClick={() => onStartGuidedLab(guidedLabTask.id)}
                testId="ide-project-guided-full-adder-restart"
              >
                Start from fresh lab
              </IdeButton>
            </section>
          ) : null}
          <div className="ide-project-evidence-strip-v1" data-testid="ide-project-evidence-strip-v1">
          <ProjectMetricsRow
            metrics={[
              {
                id: 'inputs',
                label: 'Inputs',
                value: String(inputCount),
                tone: 'neutral',
              },
              {
                id: 'outputs',
                label: 'Outputs',
                value: String(outputCount),
                tone: 'neutral',
              },
              {
                id: 'mapping',
                label: 'Mapped',
                value: `${mappedRequiredCount}/${requiredCount}`,
                tone: unmappedRequiredCount > 0 ? 'attention' : 'ok',
              },
              {
                id: 'verify',
                label: 'Verify',
                value:
                  projectVerifyState === 'stale'
                    ? 'Stale'
                    : compareMatches
                      ? 'Matched'
                      : compareDiffers
                        ? 'Differs'
                        : compareTraceOnly
                          ? 'Trace only'
                          : 'Not run',
                tone:
                  compareMatches && !comparePassIncomplete
                    ? 'ok'
                    : compareDiffers
                      ? 'blocked'
                      : 'neutral',
              },
              {
                id: 'export',
                label: 'Export',
                value: exportPackageCurrent
                  ? 'Current'
                  : exportAvailable
                    ? 'Draft'
                    : hasSuccessfulExportBundle
                      ? 'Stale'
                      : 'None',
                tone: exportPackageCurrent ? 'ok' : exportAvailable ? 'attention' : 'neutral',
              },
              {
                id: 'board',
                label: 'Board',
                value: fpgaConfig?.board ?? 'Basys3',
                tone: 'neutral',
              },
            ]}
          />
          </div>
          <section
            className="ide-project-entry-paths"
            data-testid="ide-project-entry-paths"
            aria-label="Project entry paths"
          >
            <header className="ide-project-entry-paths-header">
              <div>
                <p className="ide-surface-block-label">More paths</p>
                <h3 className="ide-project-entry-paths-title">Continue, starter, recover, or reopen</h3>
              </div>
              <p className="ide-project-entry-paths-copy">
                Current project stays active.
              </p>
            </header>
            <div className="ide-project-entry-path-grid">
              <button
                type="button"
                className="ide-project-entry-path is-primary"
                onClick={onPrimaryCta}
                data-testid="ide-project-path-continue"
              >
                <span className="ide-project-entry-path-label">Continue</span>
                <span className="ide-project-entry-path-sub">Next: {activePrimaryCtaLabel}</span>
              </button>
              <button
                type="button"
                className="ide-project-entry-path"
                onClick={handleOpenGannonLabPack}
                data-testid="ide-project-path-start-a-lab"
              >
                <span className="ide-project-entry-path-label">Start a Lab</span>
                <span className="ide-project-entry-path-sub">Gannon Pilot Labs 1-5</span>
              </button>
              <button
                type="button"
                className="ide-project-entry-path"
                onClick={handleStartBlankProject}
                data-testid="ide-project-path-build-fresh"
              >
                <span className="ide-project-entry-path-label">Build fresh</span>
                <span className="ide-project-entry-path-sub">Confirm replaces current work</span>
              </button>
              <button
                type="button"
                className="ide-project-entry-path"
                onClick={handleOpenStarterPath}
                data-testid="ide-project-path-course-starter"
              >
                <span className="ide-project-entry-path-label">Open Starter</span>
                <span className="ide-project-entry-path-sub">Guided examples</span>
              </button>
              <button
                type="button"
                className="ide-project-entry-path"
                onClick={onOpenImport}
                data-testid="ide-project-path-import-recover"
              >
                <span className="ide-project-entry-path-label">Import / Recover</span>
                <span className="ide-project-entry-path-sub">ZIP or HDL recovery</span>
              </button>
              <button
                type="button"
                className="ide-project-entry-path"
                onClick={onOpenSavedProjects}
                disabled={!onOpenSavedProjects}
                data-testid="ide-project-path-open-existing"
              >
                <span className="ide-project-entry-path-label">Open Recent</span>
                <span className="ide-project-entry-path-sub">Local saved work</span>
              </button>
            </div>
          </section>
          </section>
        </div>
        </div>
        {/*
          Audit pass (2026-05-02): the ProjectBridgePanel is project-internals
          (hash, fidelity, scenarioAuthority, hardwareReady flag, blocking-
          issue count). Students should not see a wall of internals on the
          home surface. Tuck it inside a collapsed disclosure so its testids
          remain in the DOM (tests are unaffected) but the surface reads as
          a project home, not a diagnostics dump.
        */}
        <details
          className="ide-project-bridge-disclosure"
          data-testid="ide-project-bridge-disclosure"
        >
          <summary className="ide-project-bridge-disclosure-summary">
            Project bridge &amp; determinism
          </summary>
          <ProjectBridgePanel
            projectName={projectName}
            projectKind={projectKind}
            sourceExampleId={sourceExampleId}
            determinismHash={determinismHash}
            topModuleName={topModuleName || 'top'}
            simulationTopName={`${topModuleName || 'top'}_tb`}
            fpgaBoard={fpgaConfig?.board ?? 'Basys3'}
            fpgaPart={fpgaConfig?.part ?? 'xc7a35tcpg236-1'}
            importFidelity={bridgeFidelity}
            scenarioAuthority={scenarioAuthority}
            health={health}
            readiness={{
              hasCircuit: readiness.hasCircuit,
              hasIoMapping: readiness.hasIoMapping,
              hasVectors: readiness.hasVectors,
              missingRequiredCount: unmappedRequiredCount,
            }}
            hardwareReady={hardwareReady}
            blockingIssueCount={blockingIssues.length}
          />
        </details>
        <ProjectWarningsPanel
          issues={blockingIssues}
          onNavigateFix={handleProjectModeAction}
        />
        {readiness.hasCircuit && (
        <section
          ref={mappingSectionRef}
          className="ide-export-section ide-project-map-pins-section"
          data-testid="ide-project-panel-mapping"
        >
          {/*
            R2 Project surface reconciliation: the legacy `Project details`
            details block duplicated the ProjectBridgePanel hash + fidelity +
            verify/export pills and was not covered by any active test. Its
            determinism hash now lives in the Bridge header (ide-project-bridge-hash).
            Its verify/export/dirty/unmapped flags are reflected by the
            Bridge Verify/Export field tones and by ProjectWarningsPanel.
          */}

          <header className="ide-project-map-pins-header" data-testid="ide-project-map-pins-header">
            <div>
              <h3 className="ide-export-section-header-title ide-project-map-pins-title">Board pin mapping</h3>
              <p className="ide-project-map-pins-sub" data-testid="ide-project-map-pipeline-copy">
                Project mirrors the saved board binding before building the Vivado package.
                Use Map Pins to assign or change pins.
              </p>
            </div>
            <div className="ide-project-map-pins-export-note" data-testid="ide-project-map-export-alignment">
              <span className="ide-surface-block-label">Export readiness</span>
              <p className="ide-project-map-pins-export-text">{exportSummary}</p>
            </div>
          </header>

          {hasVerifyRun && unmappedRequiredCount > 0 && (
            <div className="ide-project-map-post-verify" data-testid="ide-project-mapping-post-verify-hint">
              <IdeCallout tone="info" title="You verified the logic — finish board pins">
                Finish the highlighted required ports in Map Pins so the Vivado bundle matches what you simulated.
                Optional ports stay off the board unless you map them on purpose.
              </IdeCallout>
            </div>
          )}

          {/* FPGA Configuration - collapsed by default */}
          <details className="ide-project-identity-details" data-testid="ide-project-fpga-config">
            <summary>FPGA configuration</summary>
            <div className="ide-kv-list" style={{ marginTop: 'var(--rb-space-2)' }}>
              <div className="ide-kv-row">
                <span>Board</span>
                <span>{fpgaConfig?.board ?? 'Basys3'}</span>
              </div>
              <div className="ide-kv-row">
                <label htmlFor="ide-fpga-top-input">Top module</label>
                <input
                  id="ide-fpga-top-input"
                  type="text"
                  className="ide-input-inline"
                  value={fpgaConfig?.top ?? topModuleName ?? 'top'}
                  data-testid="ide-project-fpga-top"
                  onChange={(event) => onFpgaConfigChange?.({ top: event.currentTarget.value })}
                />
              </div>
              <div className="ide-kv-row">
                <label htmlFor="ide-fpga-part-input">Part number</label>
                <input
                  id="ide-fpga-part-input"
                  type="text"
                  className="ide-input-inline"
                  value={fpgaConfig?.part ?? 'xc7a35tcpg236-1'}
                  data-testid="ide-project-fpga-part"
                  onChange={(event) => onFpgaConfigChange?.({ part: event.currentTarget.value })}
                />
              </div>
              {importFidelity && (
                <div className="ide-kv-row">
                  <span>Import fidelity</span>
                  <span
                    data-testid="ide-project-import-fidelity"
                    className={`ide-chip ${importFidelity === 'full' ? 'ide-chip-ok' : importFidelity === 'reconstructed' ? 'ide-chip-warn' : 'ide-chip-err'}`}
                  >
                    {importFidelity === 'full' ? 'Full restore' : importFidelity === 'reconstructed' ? 'Reconstructed' : 'Partial'}
                  </span>
                </div>
              )}
            </div>
          </details>

          <div
            className={`ide-project-mapping-summary${unmappedRequiredCount > 0 ? ' has-error' : ''}`}
            data-testid="ide-project-mapping-summary-strip"
          >
            <span className="ide-project-mapping-summary-stat" data-testid="ide-project-mapping-stat">
              {unmappedRequiredCount > 0
                ? `${unmappedRequiredCount} port${unmappedRequiredCount !== 1 ? 's' : ''} unmapped`
                : `${mappedRequiredCount}/${requiredCount} required mapped`}
            </span>
            {unmappedRequiredCount > 0 && (
              <span className="ide-chip ide-chip-warn" data-testid="ide-project-mapping-warn-chip">
                {unmappedRequiredCount} unmapped
              </span>
            )}
            {missingRequiredRows.length > 0 && (
              <div
                className="ide-project-mapping-preview"
                data-testid="ide-project-mapping-missing-list"
              >
                {missingRequiredRows.map((row) => (
                  <span key={row.id} className="ide-project-mapping-preview-chip">
                    {getStudentFacingIoLabel(row)}
                  </span>
                ))}
                {unmappedRequiredCount > missingRequiredRows.length && (
                  <span className="ide-project-mapping-preview-more">
                    +{unmappedRequiredCount - missingRequiredRows.length} more
                  </span>
                )}
              </div>
            )}
            <IdeButton tone="secondary" onClick={onOpenHardware} testId="ide-project-open-map-pins">
              Open Map Pins
            </IdeButton>
            <button
              type="button"
              className={`ide-project-mapping-expand-btn${unmappedRequiredCount > 0 ? ' is-error' : ''}`}
              onClick={() => setMappingExpanded((previous) => !previous)}
              data-testid="ide-project-mapping-expand-btn"
              aria-expanded={mappingExpanded}
            >
              {mappingExpanded
                ? 'Close Mapping'
                : unmappedRequiredCount > 0 ? 'Fix Mapping' : 'Open Mapping'}
              <span className="ide-project-mapping-expand-arrow" aria-hidden="true">
                {mappingExpanded ? '^' : 'v'}
              </span>
            </button>
          </div>

          {mappingExpanded && (
            <div className="ide-project-mapping-table-wrap" data-testid="ide-project-mapping-table-wrap">
              <div className="ide-project-mapping-quick-hint" data-testid="ide-project-mapping-quick-hint">
                Project now shows mapping truth without editing it. Use <strong>Map Pins</strong> to assign the board
                resource, then return here to confirm the logical port, board name, and package pin line up.
              </div>
              <div
                className={`ide-project-mapping-status ${unmappedRequiredCount > 0 ? 'is-error' : 'is-complete'}`}
                data-testid="ide-project-mapping-banner"
              >
                <span className="ide-project-mapping-status-dot" />
                <span>
                  {unmappedRequiredCount > 0
                    ? `${unmappedRequiredCount} required port${unmappedRequiredCount !== 1 ? 's' : ''} still need a board pin`
                    : `${mappedRequiredCount} / ${requiredCount} required ports mapped — optional rows can stay blank`}
                </span>
              </div>
              <IdeDataTable
                columns={['Port', 'Role', 'Board label (pin)', 'Saved binding', 'Dir', 'Status']}
                rows={mappingRowsUi}
                testId="ide-project-mapping-table"
                getRowClassName={(rowIndex) => mappingRowClassNames[rowIndex]}
              />
            </div>
          )}
        </section>
        )}
        {/*
          OLD `ide-surface-command-stack` SurfaceCommandStrip removed — its job
          (status pill + reason copy + primary/secondary CTAs) is now owned by
          ProjectNextActionCard at the top of the loaded shell. The legacy
          `ide-project-command-strip*` testids continue to resolve there.
          A few legacy span testids that referenced extra meta copy are kept
          below as hidden anchors so any test that searches the DOM still
          finds them; visible meta is shown via the new structural layout.
        */}
        <div hidden aria-hidden="true" data-testid="ide-project-command-strip-legacy-meta">
          <span data-testid="ide-project-command-strip-continue-cta" />
          <span data-testid="ide-project-continue-cta" />
        </div>
        {/*
          R2 Project surface reconciliation: the old `ide-project-current-focus`
          hero duplicated the ProjectBridgePanel (identity/hash/fidelity/facts),
          the ProjectWarningsPanel (blockers), and the SurfaceCommandStrip
          (next-step reason / status / chips / CTA label). It has been replaced
          with a lean session panel carrying only what is genuinely unique:
          the project narrative and local session controls. Every other piece
          of truth is owned by its canonical panel above.
        */}
        <div className="ide-project-workspace-grid" data-testid="ide-project-workspace-grid">
          {outline && (
            <ProjectOverviewPanel
              outline={outline}
              onOpenDesign={onOpenDesign}
              onFocusMacro={onFocusMacro}
              onFocusCustomComponent={onFocusCustomComponent}
            />
          )}
          <section className="ide-project-session" data-testid="ide-project-session">
            <div className="ide-project-session-narrative" data-testid="ide-project-session-narrative">
              <p className="ide-surface-block-label">About this project</p>
              <h3 className="ide-project-session-title">
                {starterExample?.name ?? projectName}
              </h3>
              {projectSummary && (
                <p className="ide-project-session-summary">{projectSummary}</p>
              )}
              {starterExample?.expectedBehavior && (
                <p className="ide-project-session-goal">{starterExample.expectedBehavior}</p>
              )}
              {isSecurityLockStarterActive && (
                <p className="ide-copy" style={{ margin: 0 }} data-testid="ide-project-security-lock-path-note">
                  Student path: use this Lab 8 bridge to organize the design first. Advanced reference stays separate in <code>{SECURITY_LOCK_REFERENCE_PATH}</code>.
                </p>
              )}
            </div>
          </section>
          <ProjectSessionCard
            onSaveNow={onSaveNow}
            onOpenExisting={onOpenSavedProjects}
            onRestoreLastSave={onRestoreLastSave}
            onResetProject={onResetProject}
          />
        </div>

        {showStarterGallery && (
          <div ref={examplesSectionRef}>
            <ExamplesBrowser
              examples={examples.map((ex): BrowsableExample => ({
              id: ex.id,
              name: ex.name,
              concept: ex.concept,
              expectedBehavior: ex.expectedBehavior,
              course: ex.course,
              lab: ex.lab,
              tags: ex.tags ?? [],
              recommended: ex.id === featuredSecurityStarter?.id,
              learningPathOrder: ex.learningPath?.order,
              flagship: ex.learningPath?.flagship,
              openProof: ex.learningPath?.openProof,
            }))}
              activeExampleId={activeExampleId}
              onLoad={onOpenExample}
              defaultExpanded={projectKind === 'home' && !readiness.hasCircuit}
              testId="ide-project-examples-disclosure"
            />
          </div>
        )}
          </>
        )}
        {/*
          R2 reconciliation: a minimal, collapsed low-level diagnostics block.
          The Bridge owns student-facing status framing; this block only exposes
          machine-readable state (uppercase PASS/FAIL, DIRTY/CLEAN, full hashes)
          that CI contracts and deep-debug sessions rely on. It is intentionally
          buried under `<details>` so it does not clutter the primary surface.
        */}
        <details className="ide-project-diagnostics" data-testid="ide-project-diagnostics">
          <summary>Low-level diagnostics</summary>
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Determinism hash</span>
              <code data-testid="ide-project-hash-short">
                {determinismHash ? determinismHash.slice(0, 12) : '—'}
              </code>
            </div>
            <div className="ide-kv-row">
              <span>Last verify</span>
              <span data-testid="ide-project-last-verify-status">
                {compareTraceOnly
                  ? 'TRACE'
                  : (health.lastVerify?.status ?? 'none').toUpperCase()}
              </span>
            </div>
            <div className="ide-kv-row">
              <span>Verify hash</span>
              <code data-testid="ide-project-last-verify-hash">
                {health.lastVerify?.hash ?? '—'}
              </code>
            </div>
            <div className="ide-kv-row">
              <span>Dirty since verify</span>
              <span data-testid="ide-project-dirty-since-verify">
                {health.dirtySinceVerify ? 'DIRTY' : 'CLEAN'}
              </span>
            </div>
            <div className="ide-kv-row">
              <span>Dirty since export</span>
              <span data-testid="ide-project-dirty-since-export">
                {health.dirtySinceExport ? 'DIRTY' : 'CLEAN'}
              </span>
            </div>
          </div>
        </details>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

interface MappingView {
  aliasDisplay: string;
  bindingDisplay: string;
  statusTone: 'ok' | 'warn' | 'error';
  statusLabel: string;
}

function toMappingView(
  row: Pick<ProjectMappingRow, 'pin' | 'direction'>,
  index: number
): MappingView {
  const normalizedPin = row.pin.trim().toUpperCase();
  if (normalizedPin.length === 0) {
    return {
      aliasDisplay: '-',
      bindingDisplay: '-',
      statusTone: 'warn',
      statusLabel: 'Missing',
    };
  }

  const resolvedPin = resolveBasys3PackagePin(normalizedPin);
  if (!resolvedPin) {
    return {
      aliasDisplay: normalizedPin,
      bindingDisplay: normalizedPin,
      statusTone: 'error',
      statusLabel: 'Invalid',
    };
  }

  const alias =
    resolveBasys3BoardAlias(normalizedPin) ??
    (normalizedPin === resolvedPin
      ? inferAliasFromPackagePin(resolvedPin, row.direction, index)
      : normalizedPin);
  const labelFirst = `${alias} (pin ${resolvedPin})`;

  return {
    aliasDisplay: labelFirst,
    bindingDisplay: labelFirst,
    statusTone: 'ok',
    statusLabel: 'Mapped',
  };
}

function inferAliasFromPackagePin(
  packagePin: string,
  direction: 'in' | 'out',
  fallbackIndex: number
): string {
  if (packagePin === BASYS3_CLOCK_PIN) return 'CLK100MHZ';
  if (packagePin === BASYS3_DP_PIN) return 'DP';

  const switchIndex = BASYS3_SWITCH_PINS.indexOf(packagePin as (typeof BASYS3_SWITCH_PINS)[number]);
  if (switchIndex >= 0) return `SW${switchIndex}`;

  const buttonIndex = BASYS3_BUTTON_PINS.indexOf(packagePin as (typeof BASYS3_BUTTON_PINS)[number]);
  if (buttonIndex >= 0) {
    const buttonAliases = ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'];
    return buttonAliases[buttonIndex] ?? `BTN${buttonIndex}`;
  }

  const ledIndex = BASYS3_LED_PINS.indexOf(packagePin as (typeof BASYS3_LED_PINS)[number]);
  if (ledIndex >= 0) return `LD${ledIndex}`;

  const segIndex = BASYS3_SEGMENT_PINS.indexOf(packagePin as (typeof BASYS3_SEGMENT_PINS)[number]);
  if (segIndex >= 0) return `SEG${segIndex}`;

  const anodeIndex = BASYS3_ANODE_PINS.indexOf(packagePin as (typeof BASYS3_ANODE_PINS)[number]);
  if (anodeIndex >= 0) return `AN${anodeIndex}`;

  return direction === 'in' ? `SW${Math.min(fallbackIndex, 15)}` : `LD${Math.min(fallbackIndex, 15)}`;
}

function normalizeProjectMappingToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '');
}

function suggestBasys3Pin(
  signal: { id: string; label?: string; direction: 'in' | 'out' },
  index: number
): string {
  const normalizedToken = [signal.id, signal.label]
    .map((value) => normalizeProjectMappingToken(value ?? ''))
    .find((value) => value.length > 0) ?? '';
  if (signal.direction === 'in') {
    if (
      normalizedToken === 'clk' ||
      normalizedToken === 'clock' ||
      normalizedToken === 'clk100mhz' ||
      normalizedToken.endsWith('clk') ||
      normalizedToken.includes('clock')
    ) {
      return 'CLK100MHZ';
    }
    if (
      normalizedToken === 'rst' ||
      normalizedToken.endsWith('rst') ||
      normalizedToken.includes('reset')
    ) {
      return 'BTNC';
    }
    return `SW${Math.min(index, 15)}`;
  }
  return `LD${Math.min(index, 15)}`;
}

function formatSavedAt(value: string): string {
  if (!value) return 'not saved';
  return value.replace('T', ' ').replace('.000Z', 'Z');
}

function getExamplePreview(exampleId: string): {
  eyebrow: string;
  pill: string;
  rows: Array<{ left: string; right: string }>;
} {
  switch (exampleId) {
    case 'signal-tour':
      return {
        eyebrow: 'Switch map',
        pill: '1:1 flow',
        rows: [
          { left: 'SW0', right: 'LD0' },
          { left: 'SW1', right: 'LD1' },
          { left: 'SW2', right: 'LD2' },
        ],
      };
    case 'logic-gates':
      return {
        eyebrow: 'Truth table',
        pill: '3 outputs',
        rows: [
          { left: 'A,B', right: 'AND' },
          { left: 'A,B', right: 'OR' },
          { left: 'A!=B', right: 'XOR' },
        ],
      };
    case 'two-bit-counter':
      return {
        eyebrow: 'Basys3 clocked',
        pill: 'CLK100MHZ',
        rows: [
          { left: 'CLK100MHZ', right: 'Q0,Q1' },
          { left: 'SW0', right: 'enable' },
          { left: 'BTNC', right: 'sync RST' },
        ],
      };
    case SECURITY_LOCK_STARTER_ID:
      return {
        eyebrow: 'Lab 8 bridge',
        pill: 'ECE141',
        rows: [
          { left: 'IN0', right: 'Detect' },
          { left: 'ENTER', right: 'Step' },
          { left: 'M4', right: 'LOCK' },
        ],
      };
    default:
      return {
        eyebrow: 'Starter',
        pill: 'Preview',
        rows: [
          { left: 'IN0', right: 'OUT0' },
          { left: 'IN1', right: 'OUT1' },
          { left: 'IN2', right: 'OUT2' },
        ],
      };
  }
}

function getVerifySummary(
  health: ProjectHealth,
  projectVerifyState: ProjectVerifyState,
  compareMatches: boolean,
  comparePassIncomplete: boolean
): string {
  if (!health.lastVerify) return 'No comparison run yet - open Verify to define test vectors and compare observed outputs.';
  if (compareMatches) return 'Latest comparison run matches the current design.';
  if (comparePassIncomplete) {
    return 'Assertions matched the live design, but some required outputs still need board mapping review.';
  }
  if (projectVerifyState === 'stale') {
    return 'The last authored comparison belongs to an older design state. Open Verify to trace the current circuit, reset to stimulus-only, or intentionally rerun against the older reference.';
  }
  if (projectVerifyState === 'trace') {
    return 'A trace-only run is current. Expected-output comparison still needs to run before you rely on Verify.';
  }
  if (projectVerifyState === 'verify-error') {
    return 'Latest verify run hit a verification error before a clean comparison result was produced.';
  }
  if (health.lastVerify.status === 'fail') {
    return 'Assertions differ from observed outputs - open Verify to inspect the first difference.';
  }
  if (health.dirtySinceVerify) return 'Design changed since the last comparison run - rerun Verify before relying on the result.';
  return 'Compare results still need attention before you rely on them.';
}

function getExportSummary(
  health: ProjectHealth,
  exportAvailable: boolean,
  exportPackageCurrent: boolean,
  hardwareReady: boolean,
  hasOkBundle: boolean
): string {
  if (!health.lastExport) {
    if (!exportAvailable) return 'Export stays blocked until mapping is complete.';
    return 'No successful bundle in this project yet. Open Export and run Build Current Bundle to generate the ZIP (RTL, pin constraints, Vivado project, and README).';
  }
  if (health.lastExport.status === 'blocked') {
    return 'Latest export attempt was blocked. Open Export diagnostics before hardware.';
  }
  if (hardwareReady) return 'Latest export bundle is current and ready for hardware.';
  if (health.dirtySinceExport) {
    if (exportPackageCurrent) {
      return 'A previous export exists, but the project changed since then.';
    }
    if (hasOkBundle) {
      return 'A bundle was built, but the design has changed. Rebuild in Export so the download matches the current circuit.';
    }
    return 'Reopen Export to generate a bundle that matches the current design and Verify evidence.';
  }
  if (exportPackageCurrent) {
    return 'Export is available for download, review, or rebuild.';
  }
  if (hasOkBundle) {
    return 'The last successful bundle is stale. Open Export to re-export a build that matches the current circuit.';
  }
  return 'Build a successful export in Export to create a Vivado / lab submission package.';
}

function toMappingKey(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isDirectPinRow(row: Pick<ProjectMappingRow, 'mappingKind'>): boolean {
  const k = row.mappingKind ?? 'scalar';
  return k === 'scalar' || k === 'bit';
}

function buildMappingRowClass(row: ProjectMappingRow, sortIndex: number): string {
  const parts = ['ide-project-map-row'];
  if (!isDirectPinRow(row)) {
    return `${parts.join(' ')} ide-project-map-row--locked`;
  }
  const mv = toMappingView(row, sortIndex);
  const pin = row.pin.trim();
  if (mv.statusTone === 'error') parts.push('ide-project-map-row--invalid');
  else if (row.required && pin.length === 0) parts.push('ide-project-map-row--action');
  else if (!row.required) parts.push('ide-project-map-row--optional');
  else parts.push('ide-project-map-row--ok');
  return parts.join(' ');
}

type RoleTagTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'error';

function resolveMappingRolePresentation(
  row: ProjectMappingRow,
  roles: Record<string, IoSignalRole>
): { tag: string; title: string; tagTone: RoleTagTone } {
  const label = getStudentFacingIoLabel(row);
  const tr = row.timingRole;
  if (tr === 'clock') {
    return { tag: 'Clock', title: 'Hardware timing: clock input for sequential logic.', tagTone: 'accent' };
  }
  if (tr === 'reset') {
    return { tag: 'Reset', title: 'Hardware timing: reset or clear style input.', tagTone: 'warn' };
  }
  if (tr === 'manual_step') {
    return { tag: 'Step', title: 'Manual single-step / clock control.', tagTone: 'accent' };
  }
  if (tr === 'enable') {
    return { tag: 'Enable', title: 'Enable or gate style input.', tagTone: 'neutral' };
  }
  const r = roles[label];
  if (r === 'clock') {
    return { tag: 'Clock', title: 'Matched as clock from verify schedule and labels.', tagTone: 'accent' };
  }
  if (r === 'reset') {
    return { tag: 'Reset', title: 'Matched as reset from verify schedule or label pattern.', tagTone: 'warn' };
  }
  if (r === 'input') {
    return { tag: 'Data in', title: 'Top-level input exposed for board mapping.', tagTone: 'neutral' };
  }
  if (r === 'output') {
    return { tag: 'Data out', title: 'Top-level output exposed for board mapping.', tagTone: 'neutral' };
  }
  return {
    tag: row.direction === 'in' ? 'In' : 'Out',
    title: row.direction === 'in' ? 'Top-level input port.' : 'Top-level output port.',
    tagTone: 'neutral',
  };
}
