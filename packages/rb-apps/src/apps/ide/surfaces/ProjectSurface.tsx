import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ProjectHealth,
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
import { IdeButton, IdeModal, IdePanel } from '../components/IdePrimitives';
import { ProjectWarningsPanel } from '../components/ProjectWarningsPanel';
import type { ProjectOutlineSummary } from '../projectOutline';
import type { RuntimeSimState } from '../projectRuntime';
import type { GuidedLabTaskDefinition } from '../labTaskDefinition';
import { getStudentFacingIoLabel } from '../ioLabels';
import { LAB_STARTERS } from '../labStarters';
import { GANNON_PILOT_LABS, formatGannonPilotProofScope } from '../gannonPilotLabs';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import { getProjectKindDisplayName, type ProjectKind, type ScenarioAuthority } from '../projectIdentity';
import type { ProjectIoMappingKind } from '../examplesCatalog';
import type { IoSignalRole } from '../ioSignalRoles';
import type { IdeChromeContract } from '../chromeContract';
import { PROFESSIONAL_CLASSROOM_COPY } from '../productUiStandards';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { ProjectHierarchyDocument } from '../projectHierarchy';
import {
  deriveBehavioralEvidenceTierFromResult,
  formatBehavioralEvidenceTier,
} from '../simulationEvidence';
import './ProjectSurface.v3.css';

export const CHROME_CONTRACT = {
  surfaceId: 'project',
  topStripSlots: ['command-bar'],
  leftDockPolicy: 'hidden',
  rightDockPolicy: 'hidden',
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
  saveState?: 'saved' | 'unsaved' | 'autosaving' | 'saving' | 'save-failed';
  onRenameProject?: (nextName: string) => void;
  studentName?: string;
  onStudentNameChange?: (name: string) => void;
  hasVerifyRun?: boolean;
  fpgaConfig?: { part: string; top: string; board: string };
  importFidelity?: 'full' | 'reconstructed' | 'partial' | null;
  onFpgaConfigChange?: (config: { part?: string; top?: string }) => void;
  outline?: ProjectOutlineSummary | null;
  circuit?: Circuit;
  hierarchy?: ProjectHierarchyDocument;
  onFocusMacro?: (macroId: string, macroName: string) => void;
  onFocusCustomComponent?: (componentName: string) => void;
  ioSignalRolesByLabel?: Record<string, IoSignalRole>;
}

const COURSE_LANDING_EXAMPLE_IDS = ['logic-gates', 'half-adder', 'two-bit-counter'] as const;

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
  onSaveNow,
  onRestoreLastSave,
  onResetProject,
  saveState = 'saved',
  onRenameProject,
  hasVerifyRun = false,
  fpgaConfig,
  importFidelity,
  onFpgaConfigChange,
  outline = null,
  circuit,
  hierarchy,
  onFocusMacro,
  onFocusCustomComponent,
}) => {
  const [identityEditing, setIdentityEditing] = useState(false);
  const [identityDraft, setIdentityDraft] = useState(projectName);
  const [changeProjectOpen, setChangeProjectOpen] = useState(false);
  const [blankProjectDialogOpen, setBlankProjectDialogOpen] = useState(false);
  const [starterCatalogOpen, setStarterCatalogOpen] = useState(false);
  const [labCatalogOpen, setLabCatalogOpen] = useState(false);
  const [expandedLabId, setExpandedLabId] = useState(GANNON_PILOT_LABS[0]?.id ?? '');
  const [highlightedMappingKey, setHighlightedMappingKey] = useState<string | null>(null);
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const identityCancelBlurRef = useRef(false);
  const mappingSectionRef = useRef<HTMLElement | null>(null);
  const labCatalogRef = useRef<HTMLElement | null>(null);
  const starterCatalogRef = useRef<HTMLElement | null>(null);
  const highlightResetTimer = useRef<number | null>(null);
  const blankProjectConfirmingRef = useRef(false);

  useEffect(() => {
    if (!identityEditing) setIdentityDraft(projectName);
  }, [identityEditing, projectName]);

  useEffect(() => {
    if (!identityEditing) return;
    identityInputRef.current?.focus();
    identityInputRef.current?.select();
  }, [identityEditing]);

  useEffect(() => () => {
    if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(highlightResetTimer.current);
    }
  }, []);

  useEffect(() => {
    if (!diagnosticRouteRequest || diagnosticRouteRequest.mode !== 'project') return;
    const mappingKey = toMappingKey(
      diagnosticRouteRequest.mappingKey ?? diagnosticRouteRequest.portName ?? ''
    );
    if (!mappingKey) return;
    mappingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMappingKey(mappingKey);
    if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(highlightResetTimer.current);
    }
    if (typeof window !== 'undefined') {
      highlightResetTimer.current = window.setTimeout(() => setHighlightedMappingKey(null), 1200);
    }
  }, [diagnosticRouteRequest]);

  const sortedMappingRows = useMemo(() => {
    return mappingRows
      .map((row, index) => ({ ...row, sortIndex: index }))
      .sort((left, right) => {
        const missingOrder = Number(Boolean(left.pin.trim())) - Number(Boolean(right.pin.trim()));
        if (missingOrder !== 0) return missingOrder;
        if (left.required !== right.required) return left.required ? -1 : 1;
        const labelOrder = compareText(left.label, right.label);
        return labelOrder !== 0 ? labelOrder : left.sortIndex - right.sortIndex;
      });
  }, [mappingRows]);

  const requiredRows = useMemo(
    () => sortedMappingRows.filter((row) => row.required),
    [sortedMappingRows]
  );
  const missingRequiredRows = useMemo(
    () => requiredRows.filter((row) => row.pin.trim().length === 0),
    [requiredRows]
  );
  const mappedRequiredRows = useMemo(
    () => requiredRows.filter((row) => row.pin.trim().length > 0),
    [requiredRows]
  );
  const inputRows = useMemo(
    () => sortedMappingRows.filter((row) => row.direction === 'in'),
    [sortedMappingRows]
  );
  const outputRows = useMemo(
    () => sortedMappingRows.filter((row) => row.direction === 'out'),
    [sortedMappingRows]
  );

  const resolvedWorkflowAuthority = useMemo(
    () => workflowAuthority ?? deriveProjectWorkflowAuthority({
      projectHealthCore: health,
      readiness: {
        hasCircuit: readiness.hasCircuit,
        hasIoMapping: readiness.hasIoMapping,
        hasVectors: readiness.hasVectors,
        verifyQualification: readiness.verifyQualification,
      },
      verifyLastRun: health.lastVerify,
    }),
    [health, readiness, workflowAuthority]
  );
  const activePrimaryCta = workflowAuthority?.primaryCta ?? primaryCta;
  const activePrimaryCtaLabel = formatProjectWorkflowActionLabel(
    workflowAuthority?.primaryCta.label ?? primaryCtaLabel,
    activePrimaryCta.mode
  );
  const projectVerifyState = resolvedWorkflowAuthority.verifyState;
  const compareMatches = resolvedWorkflowAuthority.compareMatches;
  const compareDiffers = resolvedWorkflowAuthority.compareDiffers;
  const compareTraceOnly = resolvedWorkflowAuthority.compareTraceOnly;
  const compareCurrent = resolvedWorkflowAuthority.compareCurrent;
  const comparePassIncomplete = resolvedWorkflowAuthority.comparePassIncomplete;
  const exportAvailable = resolvedWorkflowAuthority.exportAvailable;
  const exportPackageCurrent = resolvedWorkflowAuthority.exportPackageCurrent;
  const hasSuccessfulExportBundle = resolvedWorkflowAuthority.hasSuccessfulExportBundle;
  const hardwareReady = resolvedWorkflowAuthority.hardwareReady;
  const blockingIssues = health.blockingIssues;
  const visibleBlockingIssues = useMemo(
    () => blockingIssues.map((issue) => issue.fixPath
      ? {
          ...issue,
          fixPath: {
            ...issue.fixPath,
            actionLabel: formatProjectWorkflowActionLabel(
              issue.fixPath.actionLabel,
              issue.fixPath.mode
            ),
          },
        }
      : issue),
    [blockingIssues]
  );

  const activeExample = useMemo(
    () => examples.find((example) => example.id === activeExampleId) ?? null,
    [activeExampleId, examples]
  );
  const starterExample = projectKind === 'example' ? activeExample : null;
  const projectContextLabel = projectKind === 'blank' && readiness.hasCircuit
    ? 'Fresh Project'
    : getProjectKindDisplayName(projectKind);
  const landingExamples = useMemo(() => {
    const examplesById = new Map(examples.map((example) => [example.id, example]));
    const courseExamples = COURSE_LANDING_EXAMPLE_IDS
      .map((id) => examplesById.get(id))
      .filter((example): example is NonNullable<typeof example> => Boolean(example));
    return courseExamples.length === COURSE_LANDING_EXAMPLE_IDS.length
      ? courseExamples
      : examples.slice(0, 4);
  }, [examples]);

  const savedAgoLabel = useMemo(() => formatSavedAtRelative(lastSavedAt), [lastSavedAt]);
  const projectSummary = useMemo(() => {
    const trimmed = description.trim();
    if (trimmed) return trimmed;
    if (starterExample?.summary) return starterExample.summary;
    if (!readiness.hasCircuit) return 'Choose a course lab, starter, saved project, import, or blank design.';
    if (projectKind === 'blank') return 'This circuit started from a blank canvas. Continue authoring, simulate it, assign board constraints, and build the handoff package.';
    if (projectKind === 'custom') return 'This is your authored circuit. Continue from the next required stage.';
    if (projectKind === 'import') return 'Imported design ready for review, simulation, board constraints, and package build.';
    if (projectKind === 'saved') return 'Saved project restored on this device.';
    return 'Authored digital-logic project.';
  }, [description, projectKind, readiness.hasCircuit, starterExample?.summary]);
  const verifySummary = useMemo(
    () => getVerifySummary(health, projectVerifyState, compareMatches, comparePassIncomplete, simRunning),
    [compareMatches, comparePassIncomplete, health, projectVerifyState, simRunning]
  );
  const exportSummary = useMemo(
    () => getExportSummary(
      health,
      exportAvailable,
      exportPackageCurrent,
      hardwareReady,
      hasSuccessfulExportBundle
    ),
    [exportAvailable, exportPackageCurrent, hardwareReady, hasSuccessfulExportBundle, health]
  );
  const blockingDesignIssue = health.blockingIssues.find((issue) => issue.code === 'RBP1006');
  const readinessLabel = blockingIssues.length > 0
    ? `${blockingIssues.length} blocking issue${blockingIssues.length === 1 ? '' : 's'}`
    : hardwareReady
      ? 'Browser-E0 handoff ready'
      : 'Project in progress';
  const heroStatusLabel = blockingDesignIssue
    ? 'DESIGN BLOCKED'
    : activePrimaryCta.mode === 'verify'
    ? 'SIMULATE NEXT'
    : hardwareReady
      ? 'Build & Export ready'
      : exportAvailable
        ? 'Build available'
        : 'Continue project';
  const heroStatusMessage = getProjectStatusMessage({
    readiness,
    projectVerifyState,
    compareMatches,
    compareDiffers,
    compareTraceOnly,
    compareCurrent,
    exportPackageCurrent,
    hardwareReady,
    missingRequiredCount: missingRequiredRows.length,
    blockingDesignIssueMessage: blockingDesignIssue?.message,
  });
  const nextStepReason = getNextStepReason({
    mode: activePrimaryCta.mode,
    readiness,
    projectVerifyState,
    compareDiffers,
    compareTraceOnly,
    exportPackageCurrent,
    missingRequiredCount: missingRequiredRows.length,
    fallback: heroStatusMessage,
  });

  const startIdentityEdit = useCallback(() => {
    if (!onRenameProject) return;
    identityCancelBlurRef.current = false;
    setIdentityEditing(true);
  }, [onRenameProject]);
  const commitIdentityEdit = useCallback(() => {
    if (identityCancelBlurRef.current) {
      identityCancelBlurRef.current = false;
      return;
    }
    const trimmed = identityDraft.trim();
    setIdentityEditing(false);
    if (trimmed && trimmed !== projectName) onRenameProject?.(trimmed);
    else setIdentityDraft(projectName);
  }, [identityDraft, onRenameProject, projectName]);
  const cancelIdentityEdit = useCallback(() => {
    identityCancelBlurRef.current = true;
    setIdentityDraft(projectName);
    setIdentityEditing(false);
  }, [projectName]);

  const handleStartBlankProject = useCallback(() => {
    const start = onStartBlankProject ?? onOpenDesign;
    if (readiness.hasCircuit) {
      blankProjectConfirmingRef.current = false;
      setBlankProjectDialogOpen(true);
      return;
    }
    start();
  }, [onOpenDesign, onStartBlankProject, readiness.hasCircuit]);
  const cancelBlankProject = useCallback(() => {
    setBlankProjectDialogOpen(false);
  }, []);
  const confirmBlankProject = useCallback(() => {
    if (blankProjectConfirmingRef.current) return;
    blankProjectConfirmingRef.current = true;
    setBlankProjectDialogOpen(false);
    (onStartBlankProject ?? onOpenDesign)();
  }, [onOpenDesign, onStartBlankProject]);
  const openLabCatalog = useCallback(() => {
    setLabCatalogOpen(true);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => labCatalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, []);
  const openStarterCatalog = useCallback(() => {
    setStarterCatalogOpen(true);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => starterCatalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, []);
  const handleProjectModeAction = useCallback((mode: ProjectHealthMode) => {
    switch (mode) {
      case 'design': onOpenDesign(); break;
      case 'verify': onOpenVerify(); break;
      case 'export': onOpenExport(); break;
      case 'hardware':
      case 'project': onOpenHardware(); break;
      case 'import': onOpenImport(); break;
      default: break;
    }
  }, [onOpenDesign, onOpenExport, onOpenHardware, onOpenImport, onOpenVerify]);

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
        statusTone: blockingIssues.length > 0 ? 'warn' : hardwareReady ? 'ok' : 'idle',
        detail: readiness.hasCircuit ? nextStepReason : PROFESSIONAL_CLASSROOM_COPY.projectFirstLaunchDetail,
        primaryLabel: readiness.hasCircuit ? `Next: ${activePrimaryCtaLabel}` : 'Start a Lab',
        onPrimary: undefined,
        recoveryLabel: readiness.hasCircuit ? 'Open Design' : 'Import / Recover',
        onRecovery: readiness.hasCircuit ? onOpenDesign : onOpenImport,
        doneLabel: readiness.hasCircuit ? 'Current project loaded.' : 'A project is loaded.',
        blockedLabel: readiness.hasCircuit ? heroStatusMessage : 'No circuit loaded yet.',
      }}
    >
      <IdePanel testId="ide-project-panel">
        <div className="ide-project-v3" data-testid="ide-project-command-center">
          {readiness.hasCircuit ? (
            <LoadedProjectOverview
              projectName={projectName}
              projectSummary={projectSummary}
              projectContextLabel={projectContextLabel}
              starterName={starterExample?.name}
              expectedBehavior={starterExample?.expectedBehavior}
              identityEditing={identityEditing}
              identityDraft={identityDraft}
              identityInputRef={identityInputRef}
              onIdentityDraftChange={setIdentityDraft}
              onStartIdentityEdit={startIdentityEdit}
              onCommitIdentityEdit={commitIdentityEdit}
              onCancelIdentityEdit={cancelIdentityEdit}
              canRename={Boolean(onRenameProject)}
              activePrimaryCta={activePrimaryCta}
              activePrimaryCtaLabel={activePrimaryCtaLabel}
              onPrimaryCta={onPrimaryCta}
              heroStatusLabel={heroStatusLabel}
              heroStatusMessage={heroStatusMessage}
              nextStepReason={nextStepReason}
              readinessLabel={readinessLabel}
              changeProjectOpen={changeProjectOpen}
              onToggleChangeProject={() => setChangeProjectOpen((open) => !open)}
              onStartBlankProject={handleStartBlankProject}
              onOpenStarterCatalog={openStarterCatalog}
              onOpenImport={onOpenImport}
              onOpenSavedProjects={onOpenSavedProjects}
              starterCatalogOpen={starterCatalogOpen}
              starterCatalogRef={starterCatalogRef}
              examples={examples}
              activeExampleId={activeExampleId}
              onOpenExample={onOpenExample}
              guidedLabTask={guidedLabTask}
              onStartGuidedLab={onStartGuidedLab}
              fpgaConfig={fpgaConfig}
              topModuleName={topModuleName}
              saveState={saveState}
              savedAgoLabel={savedAgoLabel}
              importFidelity={importFidelity}
              onFpgaConfigChange={onFpgaConfigChange}
              outline={outline}
              circuit={circuit}
              hierarchy={hierarchy}
              inputRows={inputRows}
              outputRows={outputRows}
              onOpenDesign={onOpenDesign}
              verifySummary={verifySummary}
              projectVerifyState={projectVerifyState}
              compareMatches={compareMatches}
              onOpenVerify={onOpenVerify}
              mappingSectionRef={mappingSectionRef}
              highlightedMappingKey={highlightedMappingKey}
              mappedRequiredRows={mappedRequiredRows}
              requiredRows={requiredRows}
              missingRequiredRows={missingRequiredRows}
              hasVerifyRun={hasVerifyRun}
              onOpenHardware={onOpenHardware}
              exportSummary={exportSummary}
              exportPackageCurrent={exportPackageCurrent}
              exportAvailable={exportAvailable}
              onOpenExport={onOpenExport}
              recentProjects={recentProjects}
              onOpenRecentProject={onOpenRecentProject}
              onSaveNow={onSaveNow}
              onRestoreLastSave={onRestoreLastSave}
              onResetProject={onResetProject}
              determinismHash={determinismHash}
              health={health}
              projectKind={projectKind}
              sourceExampleId={sourceExampleId}
              scenarioAuthority={scenarioAuthority}
              hasVectors={readiness.hasVectors}
              onFocusMacro={onFocusMacro}
              onFocusCustomComponent={onFocusCustomComponent}
            />
          ) : (
            <ProjectLanding
              onOpenLabCatalog={openLabCatalog}
              onStartBlankProject={handleStartBlankProject}
              onOpenStarterCatalog={openStarterCatalog}
              onOpenImport={onOpenImport}
              onOpenSavedProjects={onOpenSavedProjects}
              recentProjects={recentProjects}
              onOpenRecentProject={onOpenRecentProject}
              starterCatalogOpen={starterCatalogOpen}
              starterCatalogRef={starterCatalogRef}
              landingExamples={landingExamples}
              guidedLabTask={guidedLabTask}
              onStartGuidedLab={onStartGuidedLab}
              onOpenExample={onOpenExample}
              labCatalogOpen={labCatalogOpen}
              labCatalogRef={labCatalogRef}
              expandedLabId={expandedLabId}
              onToggleLab={setExpandedLabId}
            />
          )}

          {readiness.hasCircuit ? (
            <ProjectWarningsPanel issues={visibleBlockingIssues} onNavigateFix={handleProjectModeAction} />
          ) : null}
        </div>
      </IdePanel>
      {blankProjectDialogOpen ? (
        <IdeModal
          title="Start a new blank project?"
          body={(
            <div className="ide-project-build-fresh-dialog-copy">
              <p>
                Your current project will remain unchanged until you confirm.
                <br />
                Save or download a backup first if you need one.
              </p>
              <p>
                {saveState === 'unsaved'
                  ? 'This workspace has unsaved changes. Starting blank will discard them from the active workspace.'
                  : 'Starting blank replaces the active workspace. Saved and recent projects remain available.'}
              </p>
            </div>
          )}
          actions={(
            <>
              <IdeButton tone="ghost" onClick={cancelBlankProject} testId="ide-project-build-fresh-cancel">
                Cancel
              </IdeButton>
              <IdeButton tone="primary" onClick={confirmBlankProject} testId="ide-project-build-fresh-confirm">
                Start blank project
              </IdeButton>
            </>
          )}
          onClose={cancelBlankProject}
          testId="ide-project-build-fresh-dialog"
        />
      ) : null}
    </IdeSurfaceLayout>
  );
};

interface LoadedProjectOverviewProps {
  projectName: string;
  projectSummary: string;
  projectContextLabel: string;
  starterName?: string;
  expectedBehavior?: string;
  identityEditing: boolean;
  identityDraft: string;
  identityInputRef: React.RefObject<HTMLInputElement | null>;
  onIdentityDraftChange: (value: string) => void;
  onStartIdentityEdit: () => void;
  onCommitIdentityEdit: () => void;
  onCancelIdentityEdit: () => void;
  canRename: boolean;
  activePrimaryCta: ProjectPrimaryCta;
  activePrimaryCtaLabel: string;
  onPrimaryCta: () => void;
  heroStatusLabel: string;
  heroStatusMessage: string;
  nextStepReason: string;
  readinessLabel: string;
  changeProjectOpen: boolean;
  onToggleChangeProject: () => void;
  onStartBlankProject: () => void;
  onOpenStarterCatalog: () => void;
  onOpenImport: () => void;
  onOpenSavedProjects?: () => void;
  starterCatalogOpen: boolean;
  starterCatalogRef: React.RefObject<HTMLElement | null>;
  examples: ProjectSurfaceProps['examples'];
  activeExampleId: string | null;
  onOpenExample: (exampleId: string) => void;
  guidedLabTask?: GuidedLabTaskDefinition | null;
  onStartGuidedLab?: (labId: string) => void;
  fpgaConfig?: { part: string; top: string; board: string };
  topModuleName: string;
  saveState: 'saved' | 'unsaved' | 'autosaving' | 'saving' | 'save-failed';
  savedAgoLabel: string | null;
  importFidelity?: 'full' | 'reconstructed' | 'partial' | null;
  onFpgaConfigChange?: (config: { part?: string; top?: string }) => void;
  outline: ProjectOutlineSummary | null;
  circuit?: Circuit;
  hierarchy?: ProjectHierarchyDocument;
  inputRows: ProjectMappingRow[];
  outputRows: ProjectMappingRow[];
  onOpenDesign: () => void;
  verifySummary: string;
  projectVerifyState: ProjectVerifyState;
  compareMatches: boolean;
  onOpenVerify: () => void;
  mappingSectionRef: React.RefObject<HTMLElement | null>;
  highlightedMappingKey: string | null;
  mappedRequiredRows: ProjectMappingRow[];
  requiredRows: ProjectMappingRow[];
  missingRequiredRows: ProjectMappingRow[];
  hasVerifyRun: boolean;
  onOpenHardware: () => void;
  exportSummary: string;
  exportPackageCurrent: boolean;
  exportAvailable: boolean;
  onOpenExport: () => void;
  recentProjects: NonNullable<ProjectSurfaceProps['recentProjects']>;
  onOpenRecentProject?: (projectId: string) => void;
  onSaveNow?: () => void;
  onRestoreLastSave?: () => void;
  onResetProject?: () => void;
  determinismHash: string;
  health: ProjectHealth;
  projectKind: ProjectKind;
  sourceExampleId: string | null;
  scenarioAuthority: ScenarioAuthority;
  hasVectors: boolean;
  onFocusMacro?: (macroId: string, macroName: string) => void;
  onFocusCustomComponent?: (componentName: string) => void;
}

const LoadedProjectOverview: React.FC<LoadedProjectOverviewProps> = ({
  projectName,
  projectSummary,
  projectContextLabel,
  starterName,
  expectedBehavior,
  identityEditing,
  identityDraft,
  identityInputRef,
  onIdentityDraftChange,
  onStartIdentityEdit,
  onCommitIdentityEdit,
  onCancelIdentityEdit,
  canRename,
  activePrimaryCta,
  activePrimaryCtaLabel,
  onPrimaryCta,
  heroStatusLabel,
  heroStatusMessage,
  nextStepReason,
  readinessLabel,
  changeProjectOpen,
  onToggleChangeProject,
  onStartBlankProject,
  onOpenStarterCatalog,
  onOpenImport,
  onOpenSavedProjects,
  starterCatalogOpen,
  starterCatalogRef,
  examples,
  activeExampleId,
  onOpenExample,
  guidedLabTask,
  onStartGuidedLab,
  fpgaConfig,
  topModuleName,
  saveState,
  savedAgoLabel,
  importFidelity,
  onFpgaConfigChange,
  outline,
  circuit,
  hierarchy,
  inputRows,
  outputRows,
  onOpenDesign,
  verifySummary,
  projectVerifyState,
  compareMatches,
  onOpenVerify,
  mappingSectionRef,
  highlightedMappingKey,
  mappedRequiredRows,
  requiredRows,
  missingRequiredRows,
  hasVerifyRun,
  onOpenHardware,
  exportSummary,
  exportPackageCurrent,
  exportAvailable,
  onOpenExport,
  recentProjects,
  onOpenRecentProject,
  onSaveNow,
  onRestoreLastSave,
  onResetProject,
  determinismHash,
  health,
  projectKind,
  sourceExampleId,
  scenarioAuthority,
  hasVectors,
  onFocusMacro,
  onFocusCustomComponent,
}) => {
  const saveLabel = saveState === 'unsaved'
    ? 'Unsaved changes'
    : saveState === 'save-failed'
      ? 'Save failed'
      : saveState === 'autosaving'
        ? 'Autosaving...'
        : saveState === 'saving'
          ? 'Saving...'
          : savedAgoLabel
            ? `Saved ${savedAgoLabel}`
            : 'Saved locally';
  const fidelityLabel = importFidelity === 'full'
    ? 'Full restore'
    : importFidelity === 'reconstructed'
      ? 'Reconstructed'
      : importFidelity === 'partial'
        ? 'Partial'
        : null;
  const bridgeSubtitle = projectKind === 'example'
    ? `${projectContextLabel} - starter loaded${sourceExampleId ? `: ${sourceExampleId}` : ''}`
    : projectContextLabel;
  const lastVerifyStatus = health.lastVerify
    ? health.lastVerify.status.toUpperCase()
    : 'NONE';
  const behavioralEvidenceTier = deriveBehavioralEvidenceTierFromResult(
    health.lastVerify,
    health.dirtySinceVerify
  );
  const primaryButtonLabel = activePrimaryCta.mode === 'verify' && !/^continue\b/i.test(activePrimaryCtaLabel)
    ? `Continue to ${activePrimaryCtaLabel}`
    : activePrimaryCtaLabel;
  const designNodeCount = outline?.nodeCount ?? circuit?.nodes.length ?? 0;
  const designConnectionCount = outline?.connectionCount ?? circuit?.connections.length ?? 0;
  const reusableModuleNames = [
    ...(outline?.macros.map((macro) => macro.name) ?? []),
    ...(outline?.customComponents.map((component) => component.name) ?? []),
  ];
  const resolvedTopModule = fpgaConfig?.top?.trim() || topModuleName.trim() || 'No top module';
  const simulationSourceLabel = hasVectors
    ? scenarioAuthority === 'starter'
      ? 'Starter scenario vectors'
      : scenarioAuthority === 'authored' || scenarioAuthority === 'verified'
        ? 'Authored scenario vectors'
        : 'Project scenario vectors'
    : 'No scenario vectors';
  const simulationSourceDetail = health.lastVerify
    ? `${health.dirtySinceVerify ? 'Stale' : 'Current'} ${health.lastVerify.runKind === 'trace' ? 'simulation trace' : 'Compare result'}`
    : 'No simulation run recorded';
  const recentActivity = getRecentProjectActivity(health, recentProjects, savedAgoLabel);

  return (
    <>
      <section className="ide-project-v3-command-board" data-testid="ide-project-command-board-v1">
      <header className="ide-project-v3-header" data-testid="ide-project-identity-strip">
        <div className="ide-project-v3-identity">
          <p className="ide-surface-block-label">Project center · {projectContextLabel}</p>
          {identityEditing ? (
            <input
              ref={identityInputRef}
              type="text"
              className="ide-project-v3-title-input"
              value={identityDraft}
              aria-label="Project title"
              data-testid="ide-project-identity-strip-input"
              onChange={(event) => onIdentityDraftChange(event.target.value)}
              onBlur={onCommitIdentityEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onCommitIdentityEdit();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancelIdentityEdit();
                }
              }}
            />
          ) : canRename ? (
            <button
              type="button"
              className="ide-project-v3-title-button"
              onClick={onStartIdentityEdit}
              onDoubleClick={onStartIdentityEdit}
              data-testid="ide-project-identity-strip-title"
              aria-label={`Project title ${projectName}. Activate to rename.`}
            >
              {projectName}
            </button>
          ) : (
            <h1 className="ide-project-v3-title" data-testid="ide-project-identity-strip-title">
              {projectName}
            </h1>
          )}
          <p className="ide-project-v3-description" data-testid="ide-project-overview-summary">
            {projectSummary}
          </p>
          {starterName && starterName !== projectName ? (
            <p className="ide-project-v3-source" data-testid="ide-project-workspace-context">
              Started from <strong>{starterName}</strong>
            </p>
          ) : null}
          {expectedBehavior ? (
            <p className="ide-project-v3-goal" data-testid="ide-project-overview-goal">
              <strong>Goal:</strong> {expectedBehavior}
            </p>
          ) : null}
          <div className="ide-project-v3-meta" data-testid="ide-project-professional-facts">
            <div>
              <span>Readiness</span>
              <strong data-testid="ide-project-readiness-blocker-count">{readinessLabel}</strong>
              <small>{heroStatusMessage}</small>
            </div>
            <div data-testid="ide-project-design-sources">
              <span>Design sources</span>
              <strong>Circuit graph</strong>
              <small>
                {designNodeCount} components · {designConnectionCount} wires
                {fidelityLabel ? (
                  <span data-testid="ide-project-import-fidelity"> · {fidelityLabel} import</span>
                ) : null}
              </small>
            </div>
            <div data-testid="ide-project-module-hierarchy">
              <span>Module hierarchy</span>
              <strong>{resolvedTopModule}</strong>
              <small>
                {reusableModuleNames.length > 0
                  ? `Reusable: ${reusableModuleNames.join(', ')}`
                  : 'Top-level circuit only'}
              </small>
            </div>
            <div data-testid="ide-project-simulation-sources">
              <span>Simulation sources</span>
              <strong>{simulationSourceLabel}</strong>
              <small>{simulationSourceDetail}</small>
            </div>
            <div data-testid="ide-project-constraint-set">
              <span>Constraint set</span>
              <strong data-testid="ide-project-overview-board">{fpgaConfig?.board ?? 'Basys3'}</strong>
              <small>
                {mappedRequiredRows.length}/{requiredRows.length} required assignments
                {fpgaConfig?.part ? ` · ${fpgaConfig.part}` : ''}
              </small>
            </div>
            <div data-testid="ide-project-storage-summary">
              <span>Storage &amp; recovery</span>
              <strong data-testid="ide-project-overview-saved-state">{saveLabel}</strong>
              <small>This browser on this device{onRestoreLastSave ? ' · Restore last save action' : ''}</small>
            </div>
            <div data-testid="ide-project-recent-activity">
              <span>Recent activity</span>
              <strong>{recentActivity.label}</strong>
              <small>{recentActivity.detail}</small>
            </div>
          </div>
        </div>

        <section
          className="ide-project-v3-next"
          data-testid="ide-project-command-strip"
          aria-label="Recommended next action"
        >
          <span className="ide-project-v3-next-state" data-testid="ide-projectx-next-status">
            {heroStatusLabel}
          </span>
          <h2 data-testid="ide-projectx-next-title">Next: {activePrimaryCtaLabel}</h2>
          <p hidden data-testid="ide-project-hero-status">{heroStatusMessage}</p>
          <p className="ide-project-v3-next-reason" data-testid="ide-project-command-strip-next-step-copy">
            {nextStepReason}
          </p>
          <IdeButton
            tone="primary"
            onClick={onPrimaryCta}
            testId="ide-project-command-strip-primary-cta"
          >
            <span data-testid={`ide-project-command-action-${activePrimaryCta.mode}`}>
              {primaryButtonLabel}
            </span>
          </IdeButton>
        </section>
      </header>

      <div className="ide-project-v3-toolbar">
        <div className="ide-project-v3-actions">
          <IdeButton tone="ghost" onClick={onToggleChangeProject} testId="ide-project-change-project">
            {changeProjectOpen ? 'Close project choices' : 'Change Project'}
          </IdeButton>
          {onSaveNow ? (
            <IdeButton tone="secondary" onClick={onSaveNow} testId="ide-session-save-now">Save now</IdeButton>
          ) : null}
          {onRestoreLastSave ? (
            <IdeButton tone="ghost" onClick={onRestoreLastSave} testId="ide-session-restore">Restore last save</IdeButton>
          ) : null}
        </div>
        {onOpenSavedProjects || onResetProject ? (
          <details className="ide-project-v3-more-actions">
            <summary>More project actions</summary>
            <div>
            {onOpenSavedProjects ? (
              <IdeButton tone="ghost" onClick={onOpenSavedProjects} testId="ide-session-open-existing">Open existing</IdeButton>
            ) : null}
            {onResetProject ? (
              <IdeButton tone="danger" onClick={onResetProject} testId="ide-session-reset">Reset project</IdeButton>
            ) : null}
            </div>
          </details>
        ) : null}
      </div>

      {changeProjectOpen ? (
        <section className="ide-project-v3-change" data-testid="ide-project-entry-paths" aria-label="Change project">
          <header>
            <div>
              <p className="ide-surface-block-label">Change Project</p>
              <h2>Choose a different source</h2>
            </div>
            <p>Replacement confirmation remains in the project-open flow.</p>
          </header>
          <div className="ide-project-v3-actions">
            <IdeButton tone="secondary" onClick={onStartBlankProject} testId="ide-project-path-build-fresh">Build Fresh</IdeButton>
            <IdeButton tone="secondary" onClick={onOpenStarterCatalog} testId="ide-project-path-course-starter">Open Starter</IdeButton>
            <IdeButton tone="secondary" onClick={onOpenImport} testId="ide-project-path-import-recover">Import Project</IdeButton>
            {onOpenSavedProjects ? (
              <IdeButton tone="secondary" onClick={onOpenSavedProjects} testId="ide-project-path-open-existing">Open Existing</IdeButton>
            ) : null}
            {guidedLabTask && onStartGuidedLab ? (
              <IdeButton tone="secondary" onClick={() => onStartGuidedLab(guidedLabTask.id)} testId="ide-project-guided-full-adder-restart">
                Start fresh lab
              </IdeButton>
            ) : null}
          </div>
        </section>
      ) : null}
      <StarterCatalog
        catalogRef={starterCatalogRef}
        open={starterCatalogOpen}
        examples={examples}
        activeExampleId={activeExampleId}
        onOpenExample={onOpenExample}
        testId="ide-project-examples-disclosure"
      />
      </section>

      <section
        className="ide-project-v3-workspace"
        data-testid="ide-project-professional-overview"
        aria-label="Current project overview"
      >
        <header className="ide-project-v3-workspace-header">
          <div>
            <p className="ide-surface-block-label">Project workspace</p>
            <h2>Sources, structure, and next actions</h2>
          </div>
          <p>Inspect what belongs to the project, understand its interface, and continue where work remains.</p>
          <div
            className={`ide-project-evidence-tier is-${behavioralEvidenceTier}`}
            data-testid="ide-project-simulation-evidence-tier"
          >
            <span>Behavioral evidence</span>
            <strong>{formatBehavioralEvidenceTier(behavioralEvidenceTier)}</strong>
            <small>
              {behavioralEvidenceTier === 'validated'
                ? 'Current simulation with passing optional checks'
                : behavioralEvidenceTier === 'simulated'
                  ? 'Current simulation trace; checks are absent or not all passing'
                  : 'No current simulation evidence'}
            </small>
          </div>
        </header>

        <div className="ide-project-workbench-grid" data-testid="ide-project-workbench-grid">
          <aside className="ide-project-explorer" data-testid="ide-project-explorer">
            <header><span>PROJECT EXPLORER</span><strong>{projectName}</strong></header>
            <button type="button" className="is-active" onClick={onOpenDesign}>
              <span aria-hidden="true">◇</span><span><strong>{resolvedTopModule}</strong><small>Top visual module</small></span>
            </button>
            {(hierarchy?.modules ?? []).map((module) => (
              <button key={module.id} type="button" onClick={() => onFocusCustomComponent?.(module.name)}>
                <span aria-hidden="true">▣</span>
                <span><strong>{module.displayName}</strong><small>{module.ports.length} ports · visual source</small></span>
              </button>
            ))}
            <div className="ide-project-explorer-group">
              <span>Simulation</span><small>{simulationSourceLabel}</small>
            </div>
            <div className="ide-project-explorer-group">
              <span>Constraints</span><small>{fpgaConfig?.board ?? 'Basys3'} · {mappedRequiredRows.length}/{requiredRows.length} mapped</small>
            </div>
          </aside>

          <main className="ide-project-design-overview" data-testid="ide-project-design-overview">
            <header>
              <div><span>DESIGN OVERVIEW</span><h3>{resolvedTopModule}</h3></div>
              <IdeButton tone="secondary" onClick={onOpenDesign} testId="ide-project-overview-open-design-primary">Open in Design</IdeButton>
            </header>
            <p>{projectSummary}</p>
            {circuit && circuit.nodes.length > 0 ? <ProjectCircuitPreview circuit={circuit} inputRows={inputRows} outputRows={outputRows} /> : null}
            <div className="ide-project-interface-strip">
              <div><span>Inputs</span><strong>{inputRows.length}</strong><small>{inputRows.map(getStudentFacingIoLabel).join(', ') || 'None'}</small></div>
              <div><span>Outputs</span><strong>{outputRows.length}</strong><small>{outputRows.map(getStudentFacingIoLabel).join(', ') || 'None'}</small></div>
              <div><span>Components</span><strong>{designNodeCount}</strong><small>{designConnectionCount} wires</small></div>
              <div><span>Custom modules</span><strong>{hierarchy?.modules.length ?? 0}</strong><small>{(hierarchy?.modules ?? []).map((module) => module.displayName).join(', ') || 'None yet'}</small></div>
            </div>
          </main>

        <div className="ide-project-v3-stage-table" data-testid="ide-project-workspace-grid">
          <span className="ide-project-v3-readiness-anchor" data-testid="ide-project-readiness-workspace">
            Workflow readiness
          </span>
          <ProjectStageRow
            label="Design"
            state={outline ? `${outline.nodeCount} nodes, ${outline.connectionCount} connections` : 'Circuit loaded'}
            summary={`${inputRows.length} input${inputRows.length === 1 ? '' : 's'} and ${outputRows.length} output${outputRows.length === 1 ? '' : 's'} define the top-level interface.`}
            actionLabel="Open Design"
            onAction={onOpenDesign}
            testId="ide-project-summary-design"
            actionTestId="ide-project-overview-open-design"
          >
            <details className="ide-project-v3-stage-details">
              <summary>Design details</summary>
              <IoSummary inputRows={inputRows} outputRows={outputRows} />
              {circuit && circuit.nodes.length > 0 ? (
                <ProjectCircuitPreview circuit={circuit} inputRows={inputRows} outputRows={outputRows} />
              ) : null}
              {outline ? (
                <ProjectInventory
                  outline={outline}
                  onFocusMacro={onFocusMacro}
                  onFocusCustomComponent={onFocusCustomComponent}
                />
              ) : null}
            </details>
          </ProjectStageRow>

          <ProjectStageRow
            label="Simulate"
            state={formatBehavioralEvidenceTier(behavioralEvidenceTier)}
            summary={verifySummary}
            actionLabel="Open Simulate"
            onAction={onOpenVerify}
            testId="ide-project-summary-verify"
          />

          <section
            ref={mappingSectionRef}
            className={`ide-project-v3-stage-row${highlightedMappingKey ? ' is-highlighted' : ''}`}
            data-testid="ide-project-mapping-overview"
            aria-label="Board and constraints summary"
          >
            <div className="ide-project-v3-stage-name" data-testid="ide-project-mapping-summary-strip">
              <span>Board &amp; Constraints</span>
              <strong data-testid="ide-project-mapping-stat">
                {mappedRequiredRows.length}/{requiredRows.length} required mapped
              </strong>
            </div>
            <div className="ide-project-v3-stage-body" data-testid="ide-project-panel-mapping">
              <h3 data-testid="ide-project-map-pins-header">Board assignments</h3>
              <p className="ide-project-v3-mapping-headline">
                {missingRequiredRows.length > 0
                  ? `${missingRequiredRows.length} required signal${missingRequiredRows.length === 1 ? '' : 's'} still need a board resource`
                  : `${mappedRequiredRows.length}/${requiredRows.length} required signals mapped`}
              </p>
              <details className="ide-project-v3-stage-details">
                <summary>Mapping details</summary>
                <p data-testid="ide-project-map-pipeline-copy">
                  Project mirrors the saved board binding before building the Vivado package. Assignments change only in Board &amp; Constraints.
                </p>
                {missingRequiredRows.length > 0 ? (
                  <p className="ide-project-v3-missing" data-testid="ide-project-mapping-missing-list">
                    Missing: {missingRequiredRows.slice(0, 6).map(getStudentFacingIoLabel).join(', ')}
                    {missingRequiredRows.length > 6 ? `, +${missingRequiredRows.length - 6} more` : ''}
                  </p>
                ) : (
                  <p className="ide-project-v3-mapped-list">
                    Mapped: {mappedRequiredRows.slice(0, 6).map(getStudentFacingIoLabel).join(', ') || 'No required board signals'}
                  </p>
                )}
                {hasVerifyRun && missingRequiredRows.length > 0 ? (
                  <p className="ide-project-v3-handoff-note" data-testid="ide-project-mapping-post-verify-hint">
                    Logic was verified; finish board pins so the Vivado package matches the simulated interface.
                  </p>
                ) : null}
              </details>
              {missingRequiredRows.length > 0 ? (
                <strong className="ide-project-v3-missing-count" data-testid="ide-project-mapping-warn-chip">
                  {missingRequiredRows.length} unmapped
                </strong>
              ) : null}
            </div>
            <div className="ide-project-v3-stage-action">
              <IdeButton tone="secondary" onClick={onOpenHardware} testId="ide-project-open-map-pins">Open Board &amp; Constraints</IdeButton>
            </div>
          </section>

          <ProjectStageRow
            label="Build & Export"
            state={exportPackageCurrent ? 'Current package' : exportAvailable ? 'Available' : 'Blocked'}
            summary={exportSummary}
            actionLabel="Open Build & Export"
            onAction={onOpenExport}
            testId="ide-project-summary-export"
            actionTestId="ide-project-open-export"
          />
        </div>
        </div>
      </section>

      <RecentProjects
        projects={recentProjects}
        onOpenRecentProject={onOpenRecentProject}
        onOpenSavedProjects={onOpenSavedProjects}
      />

      <details className="ide-project-v3-record-shell" data-testid="ide-project-bridge-disclosure">
        <summary>Technical details</summary>
        <section className="ide-project-v3-record" data-testid="ide-project-bridge">
          <header>
            <div>
              <p className="ide-surface-block-label">Technical details</p>
              <h2 data-testid="ide-project-bridge-title">Project configuration and evidence</h2>
            </div>
            <p data-testid="ide-project-bridge-subtitle">{bridgeSubtitle}</p>
          </header>
          <dl>
          <div>
            <dt>Top module</dt>
            <dd>
              <input
                type="text"
                value={fpgaConfig?.top ?? topModuleName ?? 'top'}
                data-testid="ide-project-fpga-top"
                onChange={(event) => onFpgaConfigChange?.({ top: event.currentTarget.value })}
                readOnly={!onFpgaConfigChange}
              />
            </dd>
          </div>
          <div>
            <dt>FPGA part</dt>
            <dd>
              <input
                type="text"
                value={fpgaConfig?.part ?? 'xc7a35tcpg236-1'}
                data-testid="ide-project-fpga-part"
                onChange={(event) => onFpgaConfigChange?.({ part: event.currentTarget.value })}
                readOnly={!onFpgaConfigChange}
              />
            </dd>
          </div>
          <div>
            <dt>Board</dt>
            <dd data-testid="ide-project-bridge-board">{fpgaConfig?.board ?? 'Basys3'}</dd>
          </div>
          <div>
            <dt>Determinism hash</dt>
            <dd><code data-testid="ide-project-hash-short">{determinismHash ? determinismHash.slice(0, 12) : '-'}</code></dd>
          </div>
          <div>
            <dt>Last Verify</dt>
            <dd data-testid="ide-project-last-verify-status">{lastVerifyStatus}</dd>
          </div>
          <div>
            <dt>Verify hash</dt>
            <dd><code data-testid="ide-project-last-verify-hash">{health.lastVerify?.hash ?? '-'}</code></dd>
          </div>
          <div>
            <dt>Dirty since Verify</dt>
            <dd data-testid="ide-project-dirty-since-verify">{health.dirtySinceVerify ? 'DIRTY' : 'CLEAN'}</dd>
          </div>
          <div>
            <dt>Dirty since package build</dt>
            <dd data-testid="ide-project-dirty-since-export">{health.dirtySinceExport ? 'DIRTY' : 'CLEAN'}</dd>
          </div>
          <div>
            <dt>Scenario authority</dt>
            <dd>{scenarioAuthority}</dd>
          </div>
          {fidelityLabel ? (
            <div>
              <dt>Import fidelity</dt>
              <dd data-testid="ide-project-bridge-fidelity">{fidelityLabel}</dd>
            </div>
          ) : null}
          </dl>
        </section>
      </details>
    </>
  );
};

interface ProjectStageRowProps {
  label: string;
  state: string;
  summary: string;
  actionLabel: string;
  onAction: () => void;
  testId: string;
  actionTestId?: string;
  children?: React.ReactNode;
}

const ProjectStageRow: React.FC<ProjectStageRowProps> = ({
  label,
  state,
  summary,
  actionLabel,
  onAction,
  testId,
  actionTestId,
  children,
}) => (
  <div className="ide-project-v3-stage-row" data-testid={testId}>
    <div className="ide-project-v3-stage-name">
      <span>{label}</span>
      <strong>{state}</strong>
    </div>
    <div className="ide-project-v3-stage-body">
      <p>{summary}</p>
      {children}
    </div>
    <div className="ide-project-v3-stage-action">
      <IdeButton tone="secondary" onClick={onAction} testId={actionTestId}>{actionLabel}</IdeButton>
    </div>
  </div>
);

const IoSummary: React.FC<{
  inputRows: ProjectMappingRow[];
  outputRows: ProjectMappingRow[];
}> = ({ inputRows, outputRows }) => (
  <div className="ide-project-v3-io" data-testid="ide-project-design-io-summary">
    <div>
      <strong>Inputs</strong>
      <span>{inputRows.length ? inputRows.map(getStudentFacingIoLabel).join(', ') : 'None defined'}</span>
    </div>
    <div>
      <strong>Outputs</strong>
      <span>{outputRows.length ? outputRows.map(getStudentFacingIoLabel).join(', ') : 'None defined'}</span>
    </div>
  </div>
);

const ProjectCircuitPreview: React.FC<{
  circuit: Circuit;
  inputRows: ProjectMappingRow[];
  outputRows: ProjectMappingRow[];
}> = ({ circuit, inputRows, outputRows }) => {
  const preview = useMemo(() => {
    const nodes = circuit.nodes.slice(0, 24);
    const xs = nodes.map((node, index) => node.position?.x ?? node.x ?? index * 90);
    const ys = nodes.map((node, index) => node.position?.y ?? node.y ?? (index % 4) * 72);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const positionById = new Map(
      nodes.map((node, index) => {
        const x = node.position?.x ?? node.x ?? index * 90;
        const y = node.position?.y ?? node.y ?? (index % 4) * 72;
        return [
          node.id,
          {
            x: 54 + ((x - minX) / Math.max(1, maxX - minX)) * 492,
            y: 34 + ((y - minY) / Math.max(1, maxY - minY)) * 132,
          },
        ] as const;
      })
    );
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = circuit.connections
      .map((connection) => ({
        from: typeof connection.from === 'string' ? connection.from.split(/[.:/]/)[0] : connection.from.nodeId,
        to: typeof connection.to === 'string' ? connection.to.split(/[.:/]/)[0] : connection.to.nodeId,
      }))
      .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    return { nodes, positionById, edges };
  }, [circuit]);

  const inputLabels = new Map(inputRows.map((row) => [row.nodeId ?? row.id, getStudentFacingIoLabel(row)]));
  const outputLabels = new Map(outputRows.map((row) => [row.nodeId ?? row.id, getStudentFacingIoLabel(row)]));

  return (
    <figure className="ide-project-v3-circuit-preview" data-testid="ide-project-circuit-preview">
      <figcaption>
        <div>
          <span>Live circuit snapshot</span>
          <strong>{circuit.nodes.length} components · {circuit.connections.length} wires</strong>
        </div>
        <span>Read-only</span>
      </figcaption>
      <svg viewBox="0 0 600 200" role="img" aria-label="Read-only preview of the current circuit graph">
        {preview.edges.map((edge, index) => {
          const from = preview.positionById.get(edge.from);
          const to = preview.positionById.get(edge.to);
          if (!from || !to) return null;
          const mid = (from.x + to.x) / 2;
          return (
            <path
              key={`${edge.from}-${edge.to}-${index}`}
              className="ide-project-v3-preview-wire"
              d={`M ${from.x + 24} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x - 24} ${to.y}`}
            />
          );
        })}
        {preview.nodes.map((node) => {
          const point = preview.positionById.get(node.id);
          if (!point) return null;
          const logicalLabel = inputLabels.get(node.id) ?? outputLabels.get(node.id);
          const type = String(node.type).replace(/Node$/i, '');
          const category = inputLabels.has(node.id)
            ? 'input'
            : outputLabels.has(node.id)
              ? 'output'
              : /flip|latch|counter|clock/i.test(type)
                ? 'sequential'
                : 'logic';
          return (
            <g key={node.id} className={`ide-project-v3-preview-node is-${category}`}>
              <rect x={point.x - 24} y={point.y - 17} width="48" height="34" rx="7" />
              <text x={point.x} y={point.y + 4}>
                {(logicalLabel ?? node.label ?? type).slice(0, 9)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
};

const ProjectInventory: React.FC<{
  outline: ProjectOutlineSummary;
  onFocusMacro?: (macroId: string, macroName: string) => void;
  onFocusCustomComponent?: (componentName: string) => void;
}> = ({ outline, onFocusMacro, onFocusCustomComponent }) => (
  <div className="ide-project-v3-inventory" data-testid="ide-project-overview">
    <p>
      <strong>{outline.nodeCount}</strong> nodes, <strong>{outline.connectionCount}</strong> connections,
      {' '}<strong>{outline.nodeTypeBreakdown.length}</strong> component types.
    </p>
    {outline.macros.length > 0 || outline.customComponents.length > 0 ? (
      <div className="ide-project-v3-inventory-actions">
        {outline.macros.map((macro) => onFocusMacro ? (
          <button
            key={macro.id}
            type="button"
            onClick={() => onFocusMacro(macro.id, macro.name)}
            data-testid={`ide-project-overview-macro-${macro.id}-action`}
          >
            Macro: {macro.name} ({macro.ioSummary})
          </button>
        ) : <span key={macro.id}>Macro: {macro.name}</span>)}
        {outline.customComponents.map((component) => onFocusCustomComponent ? (
          <button
            key={component.name}
            type="button"
            onClick={() => onFocusCustomComponent(component.name)}
            data-testid={`ide-project-overview-custom-${component.name}-action`}
          >
            Component: {component.name} ({component.ioSummary})
          </button>
        ) : <span key={component.name}>Component: {component.name}</span>)}
      </div>
    ) : null}
  </div>
);

const ProjectLanding: React.FC<{
  onOpenLabCatalog: () => void;
  onStartBlankProject: () => void;
  onOpenStarterCatalog: () => void;
  onOpenImport: () => void;
  onOpenSavedProjects?: () => void;
  recentProjects: NonNullable<ProjectSurfaceProps['recentProjects']>;
  onOpenRecentProject?: (projectId: string) => void;
  starterCatalogOpen: boolean;
  starterCatalogRef: React.RefObject<HTMLElement | null>;
  landingExamples: ProjectSurfaceProps['examples'];
  guidedLabTask?: GuidedLabTaskDefinition | null;
  onStartGuidedLab?: (labId: string) => void;
  onOpenExample: (exampleId: string) => void;
  labCatalogOpen: boolean;
  labCatalogRef: React.RefObject<HTMLElement | null>;
  expandedLabId: string;
  onToggleLab: (labId: string) => void;
}> = ({
  onOpenLabCatalog,
  onStartBlankProject,
  onOpenStarterCatalog,
  onOpenImport,
  onOpenSavedProjects,
  recentProjects,
  onOpenRecentProject,
  starterCatalogOpen,
  starterCatalogRef,
  landingExamples,
  guidedLabTask,
  onStartGuidedLab,
  onOpenExample,
  labCatalogOpen,
  labCatalogRef,
  expandedLabId,
  onToggleLab,
}) => (
  <div className="ide-project-v3-landing" data-testid="ide-project-landing">
    <section className="ide-project-v3-welcome" data-testid="ide-project-start-hub">
      <div>
        <p className="ide-surface-block-label">Project</p>
        <h1 data-testid="ide-project-launch-title">Start your digital-logic project</h1>
        <p>Choose a course lab, continue local work, import a design, or begin with a blank canvas.</p>
      </div>
      <div className="ide-project-v3-launch" data-testid="ide-project-primary-actions">
        <button
          type="button"
          className="ide-button ide-button-primary"
          onClick={onOpenLabCatalog}
          data-testid="ide-project-start-a-lab-primary"
          data-product-priority="primary"
        >
          Start a Lab
        </button>
        <button type="button" className="ide-button ide-button-secondary" onClick={onStartBlankProject} data-testid="ide-project-build-fresh-primary">Build Fresh</button>
        <button type="button" className="ide-button ide-button-secondary" onClick={onOpenStarterCatalog} data-testid="ide-project-open-starter-primary">Open Starter</button>
        <button type="button" className="ide-button ide-button-secondary" onClick={onOpenImport} data-testid="ide-project-import-primary">Import Project</button>
        {onOpenSavedProjects ? (
          <button type="button" className="ide-button ide-button-secondary" onClick={onOpenSavedProjects} data-testid="ide-project-open-existing-primary">Open Existing</button>
        ) : null}
      </div>
      <p className="ide-project-v3-start-summary" data-testid="ide-project-start-summary">
        Start a Lab is the recommended course path. Every alternative remains directly available.
      </p>
    </section>

    <RecentProjects
      projects={recentProjects}
      onOpenRecentProject={onOpenRecentProject}
      onOpenSavedProjects={onOpenSavedProjects}
    />

    <StarterCatalog
      catalogRef={starterCatalogRef}
      open={starterCatalogOpen}
      examples={landingExamples}
      activeExampleId={null}
      onOpenExample={onOpenExample}
      guidedLabTask={guidedLabTask}
      onStartGuidedLab={onStartGuidedLab}
      testId="ide-project-starter-catalog"
    />

    <section
      ref={labCatalogRef}
      className="ide-project-v3-catalog ide-project-v3-labs"
      data-testid="ide-project-gannon-lab-pack"
      hidden={!labCatalogOpen}
    >
      <header>
        <div>
          <p className="ide-surface-block-label">Course labs</p>
          <h2>Gannon Pilot lab pack</h2>
        </div>
        <p>Browser-E0 project packages; Vivado build, bitstream, and board observation stay external.</p>
      </header>
      <div className="ide-project-v3-lab-list" data-testid="ide-project-gannon-disclosure">
        {GANNON_PILOT_LABS.map((lab) => {
          const expanded = expandedLabId === lab.id;
          return (
            <article key={lab.id} className="ide-project-v3-lab-row" data-testid={`ide-project-gannon-lab-card-${lab.id}`}>
              <button
                type="button"
                className="ide-project-v3-lab-heading"
                onClick={() => onToggleLab(expanded ? '' : lab.id)}
                data-testid={`ide-project-gannon-lab-details-${lab.id}`}
                aria-expanded={expanded}
              >
                <span>Lab {lab.labNumber}</span>
                <strong>{lab.title}</strong>
                <small>{lab.difficulty}</small>
              </button>
              <div className="ide-project-v3-lab-body" hidden={!expanded}>
                <p><strong>Build:</strong> {lab.build}</p>
                <p><strong>Submit:</strong> {lab.submit}</p>
                <p><strong>Scope:</strong> {formatGannonPilotProofScope(lab.proofScope)}</p>
                <IdeButton tone="secondary" onClick={() => onOpenExample(lab.exampleId)} testId={`ide-project-gannon-lab-start-${lab.id}`}>
                  {lab.startLabel}
                </IdeButton>
              </div>
            </article>
          );
        })}
      </div>
      <aside className="ide-project-v3-instructor-note" data-testid="ide-instructor-note">
        <strong>For instructors</strong>
        <p>Assign Vivado or physical-board checks separately when E1, E2, or E3 evidence is required.</p>
      </aside>
    </section>
  </div>
);

const StarterCatalog: React.FC<{
  catalogRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  examples: ProjectSurfaceProps['examples'];
  activeExampleId: string | null;
  onOpenExample: (exampleId: string) => void;
  guidedLabTask?: GuidedLabTaskDefinition | null;
  onStartGuidedLab?: (labId: string) => void;
  testId: string;
}> = ({ catalogRef, open, examples, activeExampleId, onOpenExample, guidedLabTask, onStartGuidedLab, testId }) => (
  <section
    ref={catalogRef}
    className="ide-project-v3-catalog"
    data-testid={testId}
    data-expanded={open ? 'true' : 'false'}
    hidden={!open}
  >
    <header>
      <div>
        <p className="ide-surface-block-label">Starter catalog</p>
        <h2>Choose a worked starting point</h2>
      </div>
      <p>Loading a starter opens its live circuit in Design.</p>
    </header>
    {guidedLabTask && onStartGuidedLab ? (
      <button
        type="button"
        className="ide-project-v3-guided-row"
        onClick={() => onStartGuidedLab(guidedLabTask.id)}
        data-testid="ide-project-guided-full-adder-lab"
      >
        <strong data-testid="ide-project-guided-full-adder-start">{guidedLabTask.shortTitle} scratch lab</strong>
        <span>{guidedLabTask.assignment}</span>
      </button>
    ) : null}
    <div className="ide-project-v3-starter-list" data-testid="ide-project-start-column">
      <div className="ide-project-v3-starter-heading">Course starters</div>
      {examples.map((example) => (
        <button
          key={example.id}
          type="button"
          className={activeExampleId === example.id ? 'is-active' : ''}
          onClick={() => onOpenExample(example.id)}
          data-testid={`ide-project-landing-example-${example.id}`}
        >
          <span
            className={activeExampleId === example.id ? 'is-active' : ''}
            data-testid={`ide-projectx-example-${example.id}`}
          >
            <strong className="ide-projectx-example-card-title">{example.name}</strong>
            <small>{example.concept}</small>
          </span>
          <span className="ide-project-v3-starter-action" data-testid={`ide-project-load-start-${example.id}`}>
            Load &amp; Design -&gt;
          </span>
        </button>
      ))}
      {LAB_STARTERS.map((starter) => (
        <button
          key={starter.id}
          type="button"
          onClick={() => onOpenExample(starter.example.id)}
          data-testid={`ide-project-lab-card-${starter.id}`}
        >
          <span>
            <strong>{starter.title}</strong>
            <small>{starter.description}</small>
          </span>
          <span className="ide-project-v3-starter-action">Start -&gt;</span>
        </button>
      ))}
    </div>
  </section>
);

const RecentProjects: React.FC<{
  projects: NonNullable<ProjectSurfaceProps['recentProjects']>;
  onOpenRecentProject?: (projectId: string) => void;
  onOpenSavedProjects?: () => void;
}> = ({ projects, onOpenRecentProject, onOpenSavedProjects }) => (
  <section className="ide-project-v3-recent" data-testid="ide-project-recent-panel">
    <header>
      <div>
        <p className="ide-surface-block-label">Recent projects</p>
        <h2>Continue work from this device</h2>
      </div>
      {onOpenSavedProjects ? (
        <IdeButton tone="secondary" onClick={onOpenSavedProjects} testId="ide-project-open-existing">Open existing project...</IdeButton>
      ) : null}
    </header>
    {projects.length > 0 ? (
      <div className="ide-project-v3-recent-list">
        {projects.slice(0, 4).map((project) => (
          <button
            key={project.projectId}
            type="button"
            onClick={() => onOpenRecentProject?.(project.projectId)}
            data-testid={`ide-project-recent-${project.projectId}`}
          >
            <strong>{project.projectName}</strong>
            <span title={formatSavedAt(project.savedAtIso)}>
              Saved {formatSavedAtRelative(project.savedAtIso) ?? formatSavedAt(project.savedAtIso)}
            </span>
          </button>
        ))}
      </div>
    ) : (
      <p className="ide-project-v3-empty">No saved projects yet. Your local saves will appear here.</p>
    )}
  </section>
);

function formatProjectWorkflowActionLabel(
  label: string,
  mode: ProjectHealthMode
): string {
  const trimmed = label.trim();
  if (/board\s*&\s*constraints/i.test(trimmed)) return trimmed;
  if (/map pins/i.test(trimmed)) {
    return trimmed.replace(/map pins/gi, 'Board & Constraints');
  }
  if (mode === 'verify' && !/simulat/i.test(trimmed)) {
    return trimmed
      .replace(/\bverification\b/gi, 'Simulation')
      .replace(/\bverify\b/gi, 'Simulate');
  }
  if (mode === 'export' && !/build\s*&\s*export/i.test(trimmed)) {
    return trimmed.replace(/\bexport\b/gi, 'Build & Export');
  }
  return trimmed;
}

function getProjectStatusMessage(input: {
  readiness: ProjectSurfaceProps['readiness'];
  projectVerifyState: ProjectVerifyState;
  compareMatches: boolean;
  compareDiffers: boolean;
  compareTraceOnly: boolean;
  compareCurrent: boolean;
  exportPackageCurrent: boolean;
  hardwareReady: boolean;
  missingRequiredCount: number;
  blockingDesignIssueMessage?: string;
}): string {
  if (!input.readiness.hasCircuit) return 'No circuit loaded yet.';
  if (input.blockingDesignIssueMessage) return `Design blocked - ${input.blockingDesignIssueMessage}`;
  if (input.missingRequiredCount > 0) return `${input.missingRequiredCount} required board signal${input.missingRequiredCount === 1 ? '' : 's'} still need mapping.`;
  if (!input.readiness.hasVectors) return 'Board assignments are complete - add vectors in Simulate before you rely on Build & Export or a hardware handoff.';
  if (input.projectVerifyState === 'stale') return 'The circuit changed after the latest comparison.';
  if (input.compareTraceOnly) return 'Observed outputs are current; expected-output comparison has not run.';
  if (input.compareDiffers) return 'The latest comparison differs from the expected outputs.';
  if (!input.compareCurrent) return 'Run Compare for the current circuit before relying on the handoff.';
  if (!input.exportPackageCurrent) return 'Simulation evidence is current; build a fresh handoff package.';
  if (input.hardwareReady) return 'Browser-E0 project evidence is current. Vivado and board proof remain external.';
  if (input.compareMatches) return 'Simulation matches the current design.';
  return 'Continue the current project workflow.';
}

function getNextStepReason(input: {
  mode: ProjectHealthMode;
  readiness: ProjectSurfaceProps['readiness'];
  projectVerifyState: ProjectVerifyState;
  compareDiffers: boolean;
  compareTraceOnly: boolean;
  exportPackageCurrent: boolean;
  missingRequiredCount: number;
  fallback: string;
}): string {
  if (!input.readiness.hasCircuit) return 'Start from a course lab, starter, saved project, import, or blank canvas.';
  if (input.mode === 'design') return 'Open the circuit workbench to resolve structure or connectivity issues.';
  if (input.mode === 'verify') {
    if (input.projectVerifyState === 'stale') return 'Rerun the comparison testbench because the design changed.';
    if (input.compareDiffers) return 'Inspect the first mismatch, repair the expected output or circuit, and rerun.';
    if (input.compareTraceOnly) return 'Add expected outputs and run Compare to establish project evidence.';
    return 'Author or run the current project testbench.';
  }
  if (input.mode === 'hardware' || input.mode === 'project' || input.missingRequiredCount > 0) {
    return 'Assign every required top-level signal to a Basys3 board resource.';
  }
  if (input.mode === 'export') {
    return input.exportPackageCurrent
      ? 'Review or download the package that matches this project state.'
      : 'Build the current Vivado handoff package.';
  }
  if (input.mode === 'import') return 'Review and apply a project candidate without replacing current work early.';
  return input.fallback;
}

function getVerifySummary(
  health: ProjectHealth,
  projectVerifyState: ProjectVerifyState,
  compareMatches: boolean,
  comparePassIncomplete: boolean,
  simRunning: boolean
): string {
  if (simRunning) return 'Simulation is running for the current project.';
  if (!health.lastVerify) return 'No comparison run yet. Open Simulate to author cases, run the circuit, and compare outputs.';
  if (compareMatches) return 'Latest Compare run matches the current design and expected outputs.';
  if (comparePassIncomplete) return 'Checks matched, but board mapping still needs review.';
  if (projectVerifyState === 'stale') return 'The last comparison belongs to an older design state.';
  if (projectVerifyState === 'trace') return 'Observed outputs are current; expected-output comparison has not run.';
  if (projectVerifyState === 'verify-error') return 'The latest run ended with a simulation error.';
  if (health.lastVerify.status === 'fail') return 'Expected and observed outputs differ. Inspect the first mismatch in Simulate.';
  return health.dirtySinceVerify
    ? 'The design changed after the last comparison.'
    : 'Comparison evidence needs review.';
}

function getExportSummary(
  health: ProjectHealth,
  exportAvailable: boolean,
  exportPackageCurrent: boolean,
  hardwareReady: boolean,
  hasOkBundle: boolean
): string {
  if (!health.lastExport) {
    return exportAvailable
      ? 'Draft handoff files are available in Build & Export. Build or download the bundle when you are ready.'
      : 'Build & Export remains blocked until required board assignments and project structure are complete.';
  }
  if (health.lastExport.status === 'blocked') return 'The latest package build was blocked. Open Build & Export for the owning repair path.';
  if (hardwareReady) return 'The current browser-E0 package is ready for Vivado handoff; external hardware proof is still pending.';
  if (health.dirtySinceExport || !exportPackageCurrent) {
    return hasOkBundle
      ? 'A previous bundle exists, but it is stale. Rebuild it from the current project.'
      : 'Build a successful package from the current project.';
  }
  return 'The current package is available to inspect, rebuild, or download.';
}

function formatSavedAt(value: string): string {
  if (!value) return 'not saved';
  return value.replace('T', ' ').replace('.000Z', 'Z');
}

function getRecentProjectActivity(
  health: ProjectHealth,
  recentProjects: NonNullable<ProjectSurfaceProps['recentProjects']>,
  savedAgoLabel: string | null
): { label: string; detail: string } {
  const activities: Array<{ label: string; atIso: string }> = [];
  const verifyAt = health.lastVerify?.ranAtIso;
  if (verifyAt) {
    activities.push({
      label: health.lastVerify?.runKind === 'trace'
        ? 'Simulation trace captured'
        : health.lastVerify?.status === 'pass'
          ? 'Compare passed'
          : 'Compare found differences',
      atIso: verifyAt,
    });
  }
  const exportAt = health.lastExport?.downloadedAtIso ?? health.lastExport?.ranAtIso;
  if (exportAt) {
    activities.push({
      label: health.lastExport?.status === 'ok' ? 'Handoff package created' : 'Package build blocked',
      atIso: exportAt,
    });
  }
  for (const project of recentProjects) {
    if (!project.savedAtIso) continue;
    activities.push({
      label: `Saved ${project.projectName}`,
      atIso: project.savedAtIso,
    });
  }

  activities.sort((left, right) => {
    const leftTime = new Date(left.atIso).getTime();
    const rightTime = new Date(right.atIso).getTime();
    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
    if (!Number.isFinite(leftTime)) return 1;
    if (!Number.isFinite(rightTime)) return -1;
    return rightTime - leftTime;
  });
  const latest = activities[0];
  if (latest) {
    return {
      label: latest.label,
      detail: formatSavedAtRelative(latest.atIso) ?? formatSavedAt(latest.atIso),
    };
  }
  if (savedAgoLabel) return { label: 'Project saved', detail: savedAgoLabel };
  return { label: 'No recorded run yet', detail: 'Save, simulate, or build a package to record activity' };
}

function formatSavedAtRelative(value: string): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return formatSavedAt(value);
}

function toMappingKey(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
