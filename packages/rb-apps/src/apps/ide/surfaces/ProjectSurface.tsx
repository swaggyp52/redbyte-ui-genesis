import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ProblemsPanel } from '../components/ProblemsPanel';
import { StartCenter, type StartCenterPeek } from './project/StartCenter';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import type { ProjectIoMappingKind } from '../examplesCatalog';
import type { ProjectHealth } from '../projectHealth';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import type { ProjectOutlineSummary } from '../projectOutline';
import type { VerifyRunLedgerEntry } from '../projectRuntime';
import type { ProjectSourceModel } from '../projectSourceModel';
import type { GuidedLabTaskDefinition } from '../labTaskDefinition';
import { getStudentFacingIoLabel } from '../ioLabels';
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
  /** Starter context for the loaded project, surfaced in the Overview. */
  starterContext?: {
    name: string;
    lab?: string;
    concept?: string;
    summary?: string;
    expectedBehavior?: string;
    nextAction?: string;
  } | null;
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
  /** Read-only look at a saved project for the Start Center preview; never loads it. */
  peekRecentProject?: (projectId: string) => StartCenterPeek | null;
  /** Recovery snapshot state for the Start Center's Recover section. */
  recovery?: { available: boolean; label: string | null; onRestore: () => void } | null;
  /** The present project hash, so the Runs document can mark runs current or stale. */
  currentProjectHash?: string | null;
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
  starterContext = null,
  onOpenExample,
  onOpenImport,
  guidedLabTask,
  onStartGuidedLab,
  onStartBlankProject,
  recentProjects = [],
  peekRecentProject,
  recovery = null,
  currentProjectHash = null,
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

  // ── Start center (no project open) ────────────────────────────────────────
  if (!readiness.hasCircuit) {
    return (
      <IdeSurfaceLayout
        mode="project"
        layoutIntent="workbench"
        leftDockMode="hidden"
        rightDockMode="hidden"
        consoleMode="hidden"
        shellDensity="immersive"
        surfaceFrame="edge-to-edge"
        inspector={null}
      >
        <div className="rb-start-host" data-testid="ide-project-panel">
          <div className="rb-start-host" data-testid="ide-project-command-center">
            <StartCenter
              recentProjects={recentProjects}
              guidedLabTask={guidedLabTask}
              onOpenExample={onOpenExample}
              onStartGuidedLab={onStartGuidedLab}
              onOpenRecentProject={onOpenRecentProject}
              onOpenSavedProjects={onOpenSavedProjects}
              onOpenImport={onOpenImport}
              onStartBlankProject={handleStartBlankProject}
              peekRecentProject={peekRecentProject}
              recovery={recovery}
              boardLabel={fpgaConfig?.board ?? 'Basys3'}
              fpgaPart={fpgaConfig?.part ?? 'xc7a35tcpg236-1'}
            />
          </div>
        </div>
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
            currentProjectHash={currentProjectHash ?? null}
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
            starter={starterContext}
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
      consoleMode={problems.length > 0 ? 'collapsed' : 'hidden'}
      console={<ProblemsPanel origin="bottom-panel" />}
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
