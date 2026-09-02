import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import type { ProjectIoMappingKind } from '../examplesCatalog';
import type { ProjectHealth } from '../projectHealth';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import { IdeButton, IdePanel } from '../components/IdePrimitives';
import { ExamplesBrowser } from '../components/ProjectSurfacePrimitives';
import type { ProjectOutlineSummary } from '../projectOutline';
import type { VerifyRunLedgerEntry } from '../projectRuntime';
import type { ProjectSourceModel } from '../projectSourceModel';
import type { GuidedLabTaskDefinition } from '../labTaskDefinition';
import { getStudentFacingIoLabel } from '../ioLabels';
import { LAB_STARTERS } from '../labStarters';
import { GANNON_PILOT_LABS, formatGannonPilotProofScope } from '../gannonPilotLabs';
import { getProjectKindDisplayName, type ProjectKind } from '../projectIdentity';
import type { IdeChromeContract } from '../chromeContract';
import type { ProjectHierarchyDocument } from '../projectHierarchy';
import type { ConstraintSetsDocument } from '../constraintSets';
import type { CrossProbeIndex } from '../sourceCrossProbe';
import {
  deriveProjectWorkflowAuthority,
  type ProjectWorkflowAuthority,
} from '../projectWorkflowAuthority';
import { useEngineeringSelection, type EngineeringObjectRef, type SelectionOrigin } from '../engineeringSelection';
import { documentKey, type WorkbenchDocument } from '../workbenchDocuments';
import type { IdeMode } from '../workflowStages';
import { ProjectExplorer } from './project/ProjectExplorer';
import { ProjectOverviewDocument } from './project/ProjectOverviewDocument';
import { ProjectSourcesDocument } from './project/ProjectSourcesDocument';
import { ProjectArchitectureDocument } from './project/ProjectArchitectureDocument';
import { ProjectRunsDocument } from './project/ProjectRunsDocument';
import { ProjectSourceFileDocument } from './project/ProjectSourceFileDocument';
import { ProjectInspector } from './project/ProjectInspector';
import {
  deriveOverviewFacts,
  deriveProjectCompileOrder,
  deriveProjectExplorer,
  type ProjectArtifactSummary,
  type ProjectProblem,
  type ProjectScenarioSummary,
} from './project/projectWorkbenchModel';
import './ProjectSurface.v3.css';
import './project/project-workbench.css';

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
  activeExampleId: string | null;
  onOpenExample: (exampleId: string) => void;
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
  runHistory?: VerifyRunLedgerEntry[];
  /** First-class source/fileset authority (imported HDL, constraints, scripts). */
  sourceModel?: ProjectSourceModel;
  /** Live source ↔ visual cross-probe (derived read-model). */
  crossProbe?: { index: CrossProbeIndex; sourceLabels: Record<string, string> };
  fpgaConfig?: { part: string; top: string; board: string };
  importFidelity?: 'full' | 'reconstructed' | 'partial' | null;
  onFpgaConfigChange?: (config: { part?: string; top?: string }) => void;
  outline?: ProjectOutlineSummary | null;
  circuit?: Circuit;
  hierarchy?: ProjectHierarchyDocument;
  scenarios?: readonly ProjectScenarioSummary[];
  activeScenarioId?: string | null;
  constraintSets?: ConstraintSetsDocument;
  artifacts?: readonly ProjectArtifactSummary[];
  problems?: readonly ProjectProblem[];
  saveState?: 'saved' | 'unsaved' | 'autosaving' | 'saving' | 'save-failed';
  /** The active workbench document (Project workspace kinds). Null ⇒ Overview. */
  document?: WorkbenchDocument | null;
  onOpenDocument?: (doc: WorkbenchDocument) => void;
  onNavigateMode?: (mode: IdeMode) => void;
}

const COURSE_LANDING_EXAMPLE_IDS = ['logic-gates', 'half-adder', 'two-bit-counter'] as const;

/**
 * Project workspace. With no project open it is the start center; with a
 * project open it is a real engineering workspace: explorer (left dock),
 * documents (Overview / Sources / Compile Order / source file) in the center,
 * and a property-grid inspector for the selected engineering object (right
 * dock, absent when nothing is selected). All data is derived from the
 * canonical authorities; nothing here is a second store.
 */
export const ProjectSurface: React.FC<ProjectSurfaceProps> = ({
  projectName,
  description,
  determinismHash,
  topModuleName,
  lastSavedAt,
  readiness,
  health,
  workflowAuthority,
  mappingRows,
  examples,
  projectKind = 'blank',
  activeExampleId,
  onOpenExample,
  onOpenImport,
  guidedLabTask,
  onStartGuidedLab,
  onStartBlankProject,
  recentProjects = [],
  onOpenSavedProjects,
  onOpenRecentProject,
  runHistory = [],
  sourceModel,
  crossProbe,
  fpgaConfig,
  importFidelity,
  onFpgaConfigChange,
  outline = null,
  circuit,
  hierarchy,
  scenarios = [],
  activeScenarioId = null,
  constraintSets,
  artifacts = [],
  problems = [],
  saveState = 'saved',
  document = null,
  onOpenDocument,
  onNavigateMode,
}) => {
  const [starterCatalogOpen, setStarterCatalogOpen] = useState(false);
  const [labCatalogOpen, setLabCatalogOpen] = useState(false);
  const [expandedLabId, setExpandedLabId] = useState(GANNON_PILOT_LABS[0]?.id ?? '');
  const labCatalogRef = useRef<HTMLElement | null>(null);
  const starterCatalogRef = useRef<HTMLElement | null>(null);

  const selected = useEngineeringSelection((state) => state.selected);
  const selectRef = useEngineeringSelection((state) => state.select);
  const clearSelection = useEngineeringSelection((state) => state.clear);

  // A Project selection that references a non-Project object is left alone;
  // the inspector simply has nothing to say about it.
  useEffect(() => () => undefined, []);

  const navigateMode = useCallback((mode: IdeMode) => onNavigateMode?.(mode), [onNavigateMode]);
  const openDocument = useCallback(
    (doc: WorkbenchDocument) => {
      if (onOpenDocument) onOpenDocument(doc);
      else navigateMode(doc.kind === 'schematic' ? 'design' : doc.kind === 'board-io' ? 'hardware' : doc.kind === 'package-artifact' ? 'export' : doc.kind === 'cases' || doc.kind === 'timing' || doc.kind === 'waveform' ? 'verify' : 'project');
    },
    [navigateMode, onOpenDocument]
  );
  const select = useCallback(
    (ref: EngineeringObjectRef, origin: SelectionOrigin = 'explorer') => selectRef(ref, origin),
    [selectRef]
  );

  const sortedMappingRows = useMemo(
    () =>
      mappingRows
        .map((row, index) => ({ ...row, sortIndex: index }))
        .sort((left, right) => {
          if (left.direction !== right.direction) return left.direction === 'in' ? -1 : 1;
          const labelOrder = compareText(left.label, right.label);
          return labelOrder !== 0 ? labelOrder : left.sortIndex - right.sortIndex;
        })
        .map((row) => ({ ...row, label: getStudentFacingIoLabel(row) })),
    [mappingRows]
  );
  const requiredRows = useMemo(() => sortedMappingRows.filter((row) => row.required), [sortedMappingRows]);
  const mappedRequiredRows = useMemo(() => requiredRows.filter((row) => row.pin.trim().length > 0), [requiredRows]);

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
    [health, readiness, workflowAuthority]
  );

  const activeExample = useMemo(
    () => examples.find((example) => example.id === activeExampleId) ?? null,
    [activeExampleId, examples]
  );
  const landingExamples = useMemo(() => {
    const examplesById = new Map(examples.map((example) => [example.id, example]));
    const courseExamples = COURSE_LANDING_EXAMPLE_IDS.map((id) => examplesById.get(id)).filter(
      (example): example is NonNullable<typeof example> => Boolean(example)
    );
    return courseExamples.length === COURSE_LANDING_EXAMPLE_IDS.length ? courseExamples : examples.slice(0, 4);
  }, [examples]);

  const boardLabel = fpgaConfig?.board ?? 'Basys3';
  const fpgaPart = fpgaConfig?.part ?? 'xc7a35tcpg236-1';
  const resolvedTop = fpgaConfig?.top?.trim() || topModuleName.trim() || 'top';

  const ioLabelByNodeId = useMemo(
    () => new Map(sortedMappingRows.filter((row) => row.nodeId).map((row) => [row.nodeId as string, row.label])),
    [sortedMappingRows]
  );
  const moduleNameByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    const byId = new Map((hierarchy?.modules ?? []).map((module) => [module.id, module]));
    for (const node of circuit?.nodes ?? []) {
      const definitionId = typeof node.config?.moduleDefinitionId === 'string' ? node.config.moduleDefinitionId : '';
      const definition = byId.get(definitionId);
      if (definition) map.set(node.id, definition.displayName || definition.name);
    }
    return map;
  }, [circuit, hierarchy]);

  const explorerGroups = useMemo(
    () =>
      deriveProjectExplorer({
        topModuleName: resolvedTop,
        circuit,
        hierarchy,
        outline,
        sourceModel,
        scenarios,
        activeScenarioId,
        constraintSets,
        boardLabel,
        mappingRows: sortedMappingRows,
        artifacts,
        runs: runHistory,
        problems,
      }),
    [activeScenarioId, artifacts, boardLabel, circuit, constraintSets, hierarchy, outline, problems, resolvedTop, runHistory, scenarios, sortedMappingRows, sourceModel]
  );
  const compileOrder = useMemo(
    () => deriveProjectCompileOrder({ topModuleName: resolvedTop, hierarchy, sourceModel }),
    [hierarchy, resolvedTop, sourceModel]
  );

  const simulation = useMemo(() => {
    const state = resolvedWorkflowAuthority.verifyState;
    if (state === 'assertions-match') return { label: 'current · pass', tone: 'ok' as const };
    if (state === 'trace') return { label: 'observed', tone: 'ok' as const };
    if (state === 'stale') return { label: 'stale', tone: 'warn' as const };
    if (state === 'assertions-differ') return { label: 'failing', tone: 'error' as const };
    if (state === 'verify-error') return { label: 'error', tone: 'error' as const };
    return { label: 'not run', tone: undefined };
  }, [resolvedWorkflowAuthority.verifyState]);
  const packageState = useMemo(() => {
    if (!health.lastExport) {
      return resolvedWorkflowAuthority.exportAvailable
        ? { label: 'draft available · not built', tone: undefined }
        : { label: 'blocked', tone: 'warn' as const };
    }
    if (health.lastExport.status === 'blocked') return { label: 'last build blocked', tone: 'error' as const };
    if (health.dirtySinceExport || !resolvedWorkflowAuthority.exportPackageCurrent) return { label: 'stale · rebuild', tone: 'warn' as const };
    return { label: 'current', tone: 'ok' as const };
  }, [health.dirtySinceExport, health.lastExport, resolvedWorkflowAuthority.exportAvailable, resolvedWorkflowAuthority.exportPackageCurrent]);

  const savedLabel = useMemo(() => {
    if (saveState === 'unsaved') return 'unsaved changes';
    if (saveState === 'save-failed') return 'save failed';
    if (saveState === 'autosaving' || saveState === 'saving') return 'saving…';
    const relative = formatSavedAtRelative(lastSavedAt);
    return relative ? `saved ${relative}` : 'saved locally';
  }, [lastSavedAt, saveState]);

  const facts = useMemo(
    () =>
      deriveOverviewFacts({
        projectName,
        projectKindLabel: `${projectKind === 'blank' && readiness.hasCircuit ? 'Fresh project' : getProjectKindDisplayName(projectKind)}${
          activeExample && projectKind === 'example' ? ` · ${activeExample.name}` : ''
        }${importFidelity ? ` · import ${importFidelity}` : ''}`,
        boardLabel,
        fpgaPart,
        sourceFileCount: sourceModel?.files.length ?? 0,
        moduleCount: (hierarchy?.modules.length ?? 0) + 1,
        nodeCount: outline?.nodeCount ?? circuit?.nodes.length ?? 0,
        connectionCount: outline?.connectionCount ?? circuit?.connections.length ?? 0,
        inputCount: sortedMappingRows.filter((row) => row.direction === 'in').length,
        outputCount: sortedMappingRows.filter((row) => row.direction === 'out').length,
        scenarios,
        activeScenarioId,
        health,
        simulationLabel: simulation.label,
        simulationTone: simulation.tone,
        mappedRequired: mappedRequiredRows.length,
        requiredTotal: requiredRows.length,
        packageLabel: packageState.label,
        packageTone: packageState.tone,
        problemCount: problems.length,
        savedLabel,
        determinismHash,
      }),
    [activeExample, activeScenarioId, boardLabel, circuit, determinismHash, fpgaPart, health, hierarchy, importFidelity, mappedRequiredRows.length, outline, packageState, problems.length, projectKind, projectName, readiness.hasCircuit, requiredRows.length, savedLabel, scenarios, simulation, sortedMappingRows, sourceModel]
  );

  const handleStartBlankProject = useCallback(() => {
    (onStartBlankProject ?? (() => navigateMode('design')))();
  }, [navigateMode, onStartBlankProject]);
  const openLabCatalog = useCallback(() => {
    setLabCatalogOpen(true);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => labCatalogRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  }, []);
  const openStarterCatalog = useCallback(() => {
    setStarterCatalogOpen(true);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => starterCatalogRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  }, []);

  // ── Start center (no project open) ────────────────────────────────────────
  if (!readiness.hasCircuit) {
    return (
      <IdeSurfaceLayout mode="project" layoutIntent="readable" leftDockMode="hidden" rightDockMode="hidden" consoleMode="hidden" inspector={null}>
        <IdePanel testId="ide-project-panel">
          <div className="ide-project-v3" data-testid="ide-project-command-center">
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
          </div>
        </IdePanel>
      </IdeSurfaceLayout>
    );
  }

  // ── Loaded project: explorer · document · inspector ───────────────────────
  const activeFile = document?.kind === 'source-file' ? sourceModel?.files.find((file) => file.id === document.fileId) ?? null : null;
  const documentNode = (() => {
    switch (document?.kind) {
      case 'architecture':
        return (
          <ProjectArchitectureDocument
            topModuleName={resolvedTop}
            circuit={circuit}
            hierarchy={hierarchy}
            ioLabelByNodeId={ioLabelByNodeId}
            moduleNameByNodeId={moduleNameByNodeId}
            mappingRows={sortedMappingRows}
            selected={selected}
            onSelect={(ref) => select(ref, 'architecture')}
            onOpenDocument={openDocument}
          />
        );
      case 'runs':
        return (
          <ProjectRunsDocument
            runs={runHistory ?? []}
            problems={problems}
            scenarios={scenarios ?? []}
            activeScenarioId={activeScenarioId ?? null}
            selected={selected}
            onSelect={(ref) => select(ref, 'runs')}
            onOpenDocument={openDocument}
            onNavigateMode={navigateMode}
          />
        );
      case 'sources':
        return (
          <ProjectSourcesDocument
            mode="sources"
            topModuleName={resolvedTop}
            circuit={circuit}
            hierarchy={hierarchy}
            sourceModel={sourceModel}
            compileOrder={compileOrder}
            selected={selected}
            onSelect={(ref) => select(ref, 'sources')}
            onOpenDocument={openDocument}
          />
        );
      case 'compile-order':
        return (
          <ProjectSourcesDocument
            mode="compile-order"
            topModuleName={resolvedTop}
            circuit={circuit}
            hierarchy={hierarchy}
            sourceModel={sourceModel}
            compileOrder={compileOrder}
            selected={selected}
            onSelect={(ref) => select(ref, 'compile-order')}
            onOpenDocument={openDocument}
          />
        );
      case 'source-file':
        return (
          <ProjectSourceFileDocument
            file={activeFile}
            fileId={document.fileId}
            crossProbe={crossProbe?.index ?? null}
            selected={selected}
            onSelect={(ref) => select(ref, 'source-file')}
          />
        );
      default:
        return (
          <ProjectOverviewDocument
            projectName={projectName}
            topModuleName={resolvedTop}
            canEditTop={Boolean(onFpgaConfigChange)}
            onSetTop={(top) => onFpgaConfigChange?.({ top })}
            facts={facts}
            circuit={circuit}
            ioLabelByNodeId={ioLabelByNodeId}
            moduleNameByNodeId={moduleNameByNodeId}
            mappingRows={sortedMappingRows}
            problems={problems}
            selected={selected}
            onSelect={(ref) => select(ref, 'project-overview')}
            onOpenDocument={openDocument}
            onNavigateMode={navigateMode}
          />
        );
    }
  })();

  const inspector = (
    <ProjectInspector
      selected={selected}
      projectName={projectName}
      topModuleName={resolvedTop}
      boardLabel={boardLabel}
      fpgaPart={fpgaPart}
      circuit={circuit}
      hierarchy={hierarchy}
      outline={outline}
      sourceModel={sourceModel}
      crossProbe={crossProbe?.index ?? null}
      sourceLabels={crossProbe?.sourceLabels ?? {}}
      scenarios={scenarios}
      constraintSets={constraintSets}
      mappingRows={sortedMappingRows}
      artifacts={artifacts}
      runs={runHistory}
      problems={problems}
      onOpenDocument={openDocument}
      onNavigateMode={navigateMode}
      onClose={clearSelection}
    />
  );
  const inspectorHasContent = Boolean(selected) && inspectorSupports(selected);

  return (
    <IdeSurfaceLayout
      mode="project"
      layoutIntent="workbench"
      leftDockMode="visible"
      rightDockMode={inspectorHasContent ? 'visible' : 'hidden'}
      consoleMode="hidden"
      shellDensity="immersive"
      surfaceFrame="edge-to-edge"
      dock={
        <ProjectExplorer
          groups={explorerGroups}
          selected={selected}
          onSelect={(ref) => select(ref, 'explorer')}
          onOpenDocument={openDocument}
          onNavigateMode={navigateMode}
          activeDocumentKey={document ? documentKey(document) : 'project-overview'}
        />
      }
      inspector={inspectorHasContent ? inspector : null}
    >
      <div className="ide-project-workbench" data-testid="ide-project-panel" data-document={document?.kind ?? 'project-overview'}>
        {documentNode}
      </div>
      <p hidden data-testid="ide-project-overview-summary">{description.trim() || activeExample?.summary || ''}</p>
    </IdeSurfaceLayout>
  );
};

function inspectorSupports(ref: EngineeringObjectRef | null): boolean {
  if (!ref) return false;
  switch (ref.kind) {
    case 'project':
    case 'module':
    case 'node':
    case 'signal':
    case 'component':
    case 'macro':
    case 'scenario':
    case 'constraint-set':
    case 'source-range':
    case 'artifact':
    case 'run':
    case 'problem':
      return true;
    default:
      return false;
  }
}

// ── Start center ─────────────────────────────────────────────────────────────

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
      <div className="ide-project-v3-welcome-copy">
        <h1 data-testid="ide-project-launch-title">Start a project</h1>
        <p>Open a course lab, continue local work, import a design, or begin with a blank canvas.</p>
      </div>
      <div className="ide-project-v3-launch" data-testid="ide-project-primary-actions">
        <button
          type="button"
          className="ide-button ide-button-primary ide-project-v3-launch-primary"
          onClick={onOpenLabCatalog}
          data-testid="ide-project-start-a-lab-primary"
          data-product-priority="primary"
        >
          <strong>Start a Lab</strong>
          <small>Gannon course path — opens the lab's live circuit.</small>
        </button>
        <div className="ide-project-v3-launch-secondary" role="group" aria-label="Other ways to start">
          <button type="button" className="ide-button ide-button-secondary" onClick={onOpenStarterCatalog} data-testid="ide-project-open-starter-primary">Open Starter</button>
          <button type="button" className="ide-button ide-button-secondary" onClick={onOpenImport} data-testid="ide-project-import-primary">Import Project</button>
          {onOpenSavedProjects ? (
            <button type="button" className="ide-button ide-button-secondary" onClick={onOpenSavedProjects} data-testid="ide-project-open-existing-primary">Open Existing</button>
          ) : null}
          <button type="button" className="ide-button ide-button-secondary" onClick={onStartBlankProject} data-testid="ide-project-build-fresh-primary">Build Fresh</button>
        </div>
      </div>
    </section>

    <RecentProjects projects={recentProjects} onOpenRecentProject={onOpenRecentProject} onOpenSavedProjects={onOpenSavedProjects} />

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
          <h2>Gannon Pilot lab pack</h2>
        </div>
        <p>Browser-simulated project packages; Vivado build, bitstream, and board observation stay external.</p>
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
  <section ref={catalogRef} className="ide-project-v3-catalog" data-testid={testId} data-expanded={open ? 'true' : 'false'} hidden={!open}>
    <header>
      <div>
        <h2>Starter catalog</h2>
      </div>
      <p>Loading a starter opens its live circuit in Design.</p>
    </header>
    {guidedLabTask && onStartGuidedLab ? (
      <button type="button" className="ide-project-v3-guided-row" onClick={() => onStartGuidedLab(guidedLabTask.id)} data-testid="ide-project-guided-full-adder-lab">
        <strong data-testid="ide-project-guided-full-adder-start">{guidedLabTask.shortTitle} scratch lab</strong>
        <span>{guidedLabTask.assignment}</span>
      </button>
    ) : null}
    <div className="ide-project-v3-starter-list" data-testid="ide-project-start-column">
      <ExamplesBrowser
        examples={examples.map((example) => ({
          id: example.id,
          name: example.name,
          concept: example.concept,
          expectedBehavior: example.expectedBehavior,
          course: example.course,
          lab: example.lab,
          tags: example.tags,
          learningPathOrder: example.learningPath?.order,
          flagship: example.learningPath?.flagship,
          openProof: example.learningPath?.openProof,
        }))}
        activeExampleId={activeExampleId}
        onLoad={onOpenExample}
        testId="ide-project-examples-browser"
      />
      {LAB_STARTERS.map((starter) => (
        <button key={starter.id} type="button" onClick={() => onOpenExample(starter.example.id)} data-testid={`ide-project-lab-card-${starter.id}`}>
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
        <h2>Recent projects</h2>
      </div>
      {onOpenSavedProjects ? (
        <IdeButton tone="secondary" onClick={onOpenSavedProjects} testId="ide-project-open-existing">Open existing project...</IdeButton>
      ) : null}
    </header>
    {projects.length > 0 ? (
      <div className="ide-project-v3-recent-list">
        {projects.slice(0, 4).map((project) => (
          <button key={project.projectId} type="button" onClick={() => onOpenRecentProject?.(project.projectId)} data-testid={`ide-project-recent-${project.projectId}`}>
            <strong>{project.projectName}</strong>
            <span title={formatSavedAt(project.savedAtIso)}>
              Saved {formatSavedAtRelative(project.savedAtIso) ?? formatSavedAt(project.savedAtIso)}
            </span>
          </button>
        ))}
      </div>
    ) : (
      <p className="ide-project-v3-empty">No saved projects yet. Local saves appear here.</p>
    )}
  </section>
);

function formatSavedAt(value: string): string {
  if (!value) return 'not saved';
  return value.replace('T', ' ').replace('.000Z', 'Z');
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

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
