// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// IdeApp - IDE-first shell surface with deterministic mode markers.

import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { analyzeSequentialLogic, type Circuit } from '@redbyte/rb-logic-core';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import {
  installFatalCapture,
  materializeIoMappingFromHardwareMappingV2,
  pushMount,
  type TestVector,
} from '@redbyte/rb-utils';
import { decodeRBProject, type RBProject } from '../export/projectFormat';
import { digestValue } from '../utils/digest';
import { stableSerialize } from '../utils/stableSerialize';
import './ide/ide-root.css';
import './ide/ide-polish-pass.css';
import './ide/theme/redbyte-theme.css';
import './ide/theme/redbyte-primitives.css';
import './ide/unified-workbench-v3.css';
import './ide/visual-system-v1.css';
import { projectRuntimeCircuitToEditorStore } from './ide/circuitProjection';
import { detectVerifyMode, type VerifyMode } from './ide/verifyMode';
import { resolveVerifyInputNodeIds } from './ide/verifyNodeIdBridge';
import { deriveDesignCompilerDiagnostics } from './ide/designCompilerDiagnostics';
import { IdeStageNav, type IdeMode } from './ide/components/IdeStageNav';
import { getIdeModeLabel } from './ide/workflowStages';
import { IdeTopBar } from './ide/components/IdeTopBar';
import { IdeButton, IdeModal } from './ide/components/IdePrimitives';
import { ProjectSurface } from './ide/surfaces/ProjectSurface';
import { deriveProjectOutlineSummary } from './ide/projectOutline';
import type { DesignCompilerStatus } from './ide/surfaces/DesignSurface';
import type { VerifyFailureTarget } from './ide/surfaces/VerifySurface';
import { KeyboardShortcutsModal } from './ide/components/KeyboardShortcutsModal';
import { resolveIdeBuildIdentity } from './ide/buildIdentity';
import {
  normalizeIdeMode,
  resolveInitialIdeModeFromSearch,
  resolveRequestedIdeMode,
  resolveRestoredIdeMode,
} from './ide/startupMode';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThrowOnce } from '../components/ThrowOnce';
import { buildExportViewModel } from './ide/viewmodels/buildExportViewModel';
import { buildProjectExportPackageSourceHash } from './ide/exportTrustState';
import { buildCurrentVerifyProjectHash, toProjectIoMapping } from './ide/verifyProjectHash';
import {
  choosePrimaryDiagnosticAction,
  type IdeDiagnostic,
  type IdeDiagnosticRouteRequest,
} from './ide/diagnostics';
import {
  createDesignFocusRequest,
  type DesignFocusRequest,
} from './ide/designFocus';
import type { VerifyDebugContext } from './ide/verifyDebug';
import { getStudentFacingIoLabel } from './ide/ioLabels';
import {
  IDE_EXAMPLES,
  getIdeExampleById,
} from './ide/examplesCatalog';
import {
  deriveProjectHealth,
  deriveProjectVerifyState,
  type ProjectHealthExportResult,
  type ProjectHealthMode,
} from './ide/projectHealth';
import {
  deriveScenarioAuthority,
  hasExpectedOutputs,
} from './ide/projectIdentity';
import { deriveIoSignalRoles } from './ide/ioSignalRoles';
import { deriveTimingGuidance } from './ide/timingGuidance';
import {
  useProjectRuntime,
  type ProjectIoRow,
  type ProjectTestbenchSnapshot,
} from './ide/projectRuntime';
import {
  FULL_ADDER_LAB_ID,
  FULL_ADDER_SCRATCH_LAB,
  buildFullAdderTruthTableVectors,
  deriveFullAdderDesignChecklist,
  deriveFullAdderExportSummary,
  deriveFullAdderHardwareChecklist,
  getGuidedLabTask,
  resolveFullAdderLabIoRows,
  type GuidedLabSignal,
} from './ide/labTaskDefinition';
import type { IdeImportMeta } from './ide/projectImportMeta';
import {
  deriveProjectWorkflowAuthority,
  isDesignOwnedExportDiagnostic,
} from './ide/projectWorkflowAuthority';
import { resolveBasys3SignalBinding } from '../fpga/boards/basys3/basys3SignalSemantics';
import {
  decodePersistedIdeProject,
  listIdeProjectSnapshots,
  loadIdeProjectSnapshot,
  saveIdeProjectSnapshot,
  type PersistedIdeProjectIndexEntry,
} from './ide/projectPersistence';
import {
  saveLabSessionMeta,
  loadLabSessionMeta,
  clearLabSessionMeta,
  type LabSessionMeta,
} from './ide/persistence/labSession';
import { BoardSignalProvider } from './ide/BoardSignalContext';
import {
  computeVectorStimulusHash,
  getActiveScenario,
  type VerifyScenario,
} from './ide/verifyScenario';
import { netlistFromCircuit } from '../export/netlistExport';
import { vhdlFromNetlist } from '../export/vhdlExport';
import { buildVhdlTopLevelBindings } from '../fpga/boards/basys3/basys3Bundle';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';
import type { HardwareMappingV2EditOperation } from './ide/hardwareMappingV2EditorModel';

const loadDesignSurface = () =>
  import('./ide/surfaces/DesignSurface').then((module) => ({ default: module.DesignSurface }));
const loadVerifySurface = () =>
  import('./ide/surfaces/VerifySurface').then((module) => ({ default: module.VerifySurface }));
const loadHardwareSurface = () =>
  import('./ide/surfaces/HardwareSurface').then((module) => ({ default: module.HardwareSurface }));
const loadExportSurface = () =>
  import('./ide/surfaces/ExportSurface').then((module) => ({ default: module.ExportSurface }));
const loadImportSurface = () =>
  import('./ide/surfaces/ImportSurface').then((module) => ({ default: module.ImportSurface }));

const DesignSurface = React.lazy(loadDesignSurface);
const VerifySurface = React.lazy(loadVerifySurface);
const HardwareSurface = React.lazy(loadHardwareSurface);
const ExportSurface = React.lazy(loadExportSurface);
const ImportSurface = React.lazy(loadImportSurface);

const IDE_LAZY_SURFACE_LOADERS = [
  loadDesignSurface,
  loadVerifySurface,
  loadHardwareSurface,
  loadExportSurface,
  loadImportSurface,
] as const;

const IdeSurfaceLoadingFallback: React.FC<{ mode: Exclude<IdeMode, 'project'> }> = ({ mode }) => (
  <section
    className="ide-surface-loading-shell"
    data-ide-mode-marker={mode}
    data-testid="ide-surface-loading"
    aria-label={`Loading ${getIdeModeLabel(mode)} workspace`}
  >
    <main
      className="ide-surface-loading-workbench"
      data-testid="ide-mode-body"
      data-loading-surface={mode}
      aria-label={`${mode} workspace`}
      aria-busy="true"
    >
      <div className="ide-surface-loading-taskbar" aria-hidden="true" />
      <div className="ide-surface-loading-grid" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="ide-copy" role="status" aria-live="polite">
        Loading {getIdeModeLabel(mode)} workspace…
      </p>
    </main>
  </section>
);

const DEFAULT_FPGA_PART = 'xc7a35tcpg236-1';

interface IdeFpgaConfig {
  board: 'basys3';
  top: string;
  part: string;
}

// Re-export the canonical import-meta type so the rest of IdeApp stays backward-compatible.
type IdeImportCommitMeta = IdeImportMeta;
type IdeImportFidelity = IdeImportMeta['fidelity'];

type IdeCircuitConnection = Circuit['connections'][number];

function digestWorkspaceSnapshot(
  project: RBProject,
  scenarios: VerifyScenario[],
  activeScenarioId: string
): string {
  return digestValue({ project, scenarios, activeScenarioId });
}

function resolveConnectionRef(
  connection: IdeCircuitConnection,
  side: 'from' | 'to'
): { nodeId: string; portName: string } {
  const raw = connection[side];
  if (typeof raw === 'string') {
    const pinKey = side === 'from' ? 'fromPin' : 'toPin';
    const portKey = side === 'from' ? 'fromPort' : 'toPort';
    const portName =
      (connection as Record<string, unknown>)[pinKey] ??
      (connection as Record<string, unknown>)[portKey] ??
      (side === 'from' ? 'out' : 'in');
    return {
      nodeId: raw,
      portName:
        typeof portName === 'string' && portName.length > 0
          ? portName
          : side === 'from'
            ? 'out'
            : 'in',
    };
  }
  return {
    nodeId: raw.nodeId,
    portName: raw.portName ?? raw.port ?? (side === 'from' ? 'out' : 'in'),
  };
}

function toDesignWireId(connection: IdeCircuitConnection): string {
  const from = resolveConnectionRef(connection, 'from');
  const to = resolveConnectionRef(connection, 'to');
  return `${from.nodeId}.${from.portName}-${to.nodeId}.${to.portName}`;
}

export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IdeMode>(() => resolveInitialIdeMode());
  const activeMode = useMemo(() => normalizeIdeMode(currentMode), [currentMode]);
  const activeModeRef = useRef<IdeMode>(activeMode);
  const restoringModeFromHistoryRef = useRef(false);

  useEffect(() => {
    // The IDE is a connected workbench, so its stage chunks are warmed as soon
    // as the shell mounts. Navigation must never tear the workplane down while
    // the next stage waits on a network round trip.
    void Promise.allSettled(IDE_LAZY_SURFACE_LOADERS.map((loadSurface) => loadSurface()));
  }, []);
  const [pendingExampleId, setPendingExampleId] = useState<string | null>(null);
  const [diagnosticRouteRequest, setDiagnosticRouteRequest] = useState<IdeDiagnosticRouteRequest | null>(null);
  const [designFocusRequest, setDesignFocusRequest] = useState<DesignFocusRequest | null>(null);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<PersistedIdeProjectIndexEntry[]>([]);
  const [savedProjectHash, setSavedProjectHash] = useState<string | null>(null);
  const fpgaConfigBootstrappedRef = useRef(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [studentName, setStudentName] = useState<string>('');
  const hasRestoredRef = useRef(false);
  const [autosaveAvailable, setAutosaveAvailable] = useState(false);
  const isRestoringRef = useRef(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // C-1: Debug bridge — frozen circuit state from a verification tick
  const [debugState, setDebugState] = useState<{
    tick: number;
    signals: Map<string, 0 | 1>;
    context: VerifyDebugContext | null;
  } | null>(null);
  // C-1b: Index into verifyLastRun.waveform for tick navigation
  const [debugTickIndex, setDebugTickIndex] = useState<number | null>(null);
  // A2: Verify → Design signal linkage
  const [verifySelectedSignal, setVerifySelectedSignal] = useState<string | null>(null);
  const [verifySelectedTick, setVerifySelectedTick] = useState<number | null>(null);
  const sessionMetaRef = useRef<LabSessionMeta | null>(null);
  const exportProjectRef = useRef<typeof exportProject | null>(null);
  const blockingDesignIssueRef = useRef(false);
  const pendingImportMetaRef = useRef<IdeImportCommitMeta | null>(null);
  const projectIdRef = useRef('');
  const projectNameRef = useRef('');
  const projectHashRef = useRef('');
  const scenariosRef = useRef<VerifyScenario[]>([]);
  const activeScenarioIdRef = useRef('');
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [vectorsAreAutoGenerated, setVectorsAreAutoGenerated] = useState(false);

  // Dev/test only — causes the named surface to throw once on mount
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const param = new URLSearchParams(window.location.search).get('__rb_throw');
    if (param) (window as any).__RB_THROW_SURFACE__ = param;
  }, []);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    const replace = restoringModeFromHistoryRef.current;
    restoringModeFromHistoryRef.current = false;
    syncActiveModeIntoUrl(activeMode, { replace });
  }, [activeMode]);

  useEffect(() => {
    const handlePopState = () => {
      const restoredMode = resolveRestoredIdeMode(window.location.search);
      if (restoredMode === activeModeRef.current) return;
      restoringModeFromHistoryRef.current = true;
      setCurrentMode(restoredMode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?') return;
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      event.preventDefault();
      setShowShortcuts((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const projectId = useProjectRuntime((state) => state.projectId);
  const projectName = useProjectRuntime((state) => state.projectName);
  const projectDescription = useProjectRuntime((state) => state.projectDescription);
  const [fpgaConfig, setFpgaConfig] = useState<IdeFpgaConfig>(() => ({
    board: 'basys3',
    top: 'redbyte_top',
    part: DEFAULT_FPGA_PART,
  }));
  const [guidedLabViewportToken, setGuidedLabViewportToken] = useState(0);
  const importMeta = useProjectRuntime((state) => state.importMeta);
  const setImportMeta = useProjectRuntime((state) => state.setImportMeta);
  const importFidelity: IdeImportFidelity | null = importMeta?.fidelity ?? null;
  const lastSavedAt = useProjectRuntime((state) => state.lastSavedAt);
  const projectKind = useProjectRuntime((state) => state.projectKind);
  const sourceExampleId = useProjectRuntime((state) => state.sourceExampleId);
  const activeExampleId = useProjectRuntime((state) => state.activeExampleId);
  const activeLabTaskId = useProjectRuntime((state) => state.activeLabTaskId);
  const projectIoRows = useProjectRuntime((state) => state.projectIoRows);
  const hardwareMappingV2 = useProjectRuntime((state) => state.hardwareMappingV2);
  const scenarios = useProjectRuntime((state) => state.scenarios);
  const activeScenarioId = useProjectRuntime((state) => state.activeScenarioId);
  const circuit = useProjectRuntime((state) => state.circuit);
  const verifyLastRun = useProjectRuntime((state) => state.verifyLastRun);
  const verifyRunHistory = useProjectRuntime((state) => state.verifyRunHistory);
  const runtimeSim = useProjectRuntime((state) => state.sim);
  const projectHealthCore = useProjectRuntime((state) => state.projectHealthCore);
  const macros = useProjectRuntime((state) => state.macros);
  const loadExample = useProjectRuntime((state) => state.loadExample);
  const loadFromProject = useProjectRuntime((state) => state.loadFromProject);
  const setMappingPin = useProjectRuntime((state) => state.setMappingPin);
  const setMappingPins = useProjectRuntime((state) => state.setMappingPins);
  const applyHardwareMappingEdit = useProjectRuntime((state) => state.applyHardwareMappingEdit);
  const autoSuggestMapping = useProjectRuntime((state) => state.autoSuggestMapping);
  const setVectors = useProjectRuntime((state) => state.setVectors);
  const customVectors = useProjectRuntime((state) => state.customVectors);
  const setCustomVectors = useProjectRuntime((state) => state.setCustomVectors);
  const generateBringUpVectors = useProjectRuntime((state) => state.generateBringUpVectors);
  const generateStimulusVectors = useProjectRuntime((state) => state.generateStimulusVectors);
  const createVerifyScenario = useProjectRuntime((state) => state.createScenario);
  const duplicateVerifyScenario = useProjectRuntime((state) => state.duplicateScenario);
  const renameVerifyScenario = useProjectRuntime((state) => state.renameScenario);
  const deleteVerifyScenario = useProjectRuntime((state) => state.deleteScenario);
  const switchVerifyScenario = useProjectRuntime((state) => state.switchScenario);
  const updateVerifyScenarioSequentialPolicy = useProjectRuntime(
    (state) => state.updateScenarioSequentialPolicy
  );
  const appendVerifyScenarioStep = useProjectRuntime((state) => state.appendScenarioStep);
  const updateVerifyScenarioStep = useProjectRuntime((state) => state.updateScenarioStep);
  const moveVerifyScenarioStep = useProjectRuntime((state) => state.moveScenarioStep);
  const deleteVerifyScenarioStep = useProjectRuntime((state) => state.deleteScenarioStep);
  const applyCircuitMutation = useProjectRuntime((state) => state.applyCircuitMutation);
  const undoProjectEdit = useProjectRuntime((state) => state.undoProjectEdit);
  const redoProjectEdit = useProjectRuntime((state) => state.redoProjectEdit);
  const designUndoDepth = useProjectRuntime((state) => state.designPast.length);
  const designRedoDepth = useProjectRuntime((state) => state.designFuture.length);
  const addDesignNode = useProjectRuntime((state) => state.addDesignNode);
  const addDesignIo = useProjectRuntime((state) => state.addDesignIo);
  const addDesignBoardIo = useProjectRuntime((state) => state.addDesignBoardIo);
  const connectDesignNodes = useProjectRuntime((state) => state.connectDesignNodes);
  const runRuntimeVerification = useProjectRuntime((state) => state.actions.verify.run);
  const clearRuntimeVerification = useProjectRuntime((state) => state.actions.verify.clear);
  const runRuntimeSim = useProjectRuntime((state) => state.actions.sim.run);
  const pauseRuntimeSim = useProjectRuntime((state) => state.actions.sim.pause);
  const stepRuntimeSim = useProjectRuntime((state) => state.actions.sim.step);
  const resetRuntimeSim = useProjectRuntime((state) => state.actions.sim.reset);
  const setRuntimeSimSpeed = useProjectRuntime((state) => state.actions.sim.setSpeed);
  const setRuntimeSimInput = useProjectRuntime((state) => state.actions.sim.setInput);
  const setRuntimeSimSelectedSignal = useProjectRuntime((state) => state.actions.sim.setSelectedSignal);
  const toggleRuntimeSimProbe = useProjectRuntime((state) => state.actions.sim.toggleProbe);
  const recordExport = useProjectRuntime((state) => state.recordExport);
  const setProjectIdentity = useProjectRuntime((state) => state.setProjectIdentity);
  const setActiveLabTaskId = useProjectRuntime((state) => state.setActiveLabTaskId);
  const startBlankProject = useProjectRuntime((state) => state.startBlankProject);
  const replaceWithBlankProject = useProjectRuntime((state) => state.replaceWithBlankProject);
  const setLastSavedAt = useProjectRuntime((state) => state.setLastSavedAt);
  const resetToActiveExample = useProjectRuntime((state) => state.resetToActiveExample);
  const customComponents = useProjectRuntime((state) => state.customComponents);
  const addCustomComponent = useProjectRuntime((state) => state.addCustomComponent);
  const saveMacro = useProjectRuntime((state) => state.saveMacro);
  const deleteMacro = useProjectRuntime((state) => state.deleteMacro);
  const instantiateMacro = useProjectRuntime((state) => state.instantiateMacro);
  const hasCircuit = circuit.nodes.length > 0;
  const projectOutline = useMemo(
    () =>
      deriveProjectOutlineSummary({
        circuit,
        macros,
        customComponents,
        ioRows: projectIoRows,
      }),
    [circuit, macros, customComponents, projectIoRows],
  );
  const hasDff = useMemo(
    () => deriveHasDff(circuit, verifyLastRun?.schedule),
    [circuit, verifyLastRun?.schedule]
  );
  const verifyMode: VerifyMode = useMemo(
    () => detectVerifyMode(circuit, verifyLastRun?.schedule),
    [circuit, verifyLastRun?.schedule]
  );
  const missingRequiredCount = useMemo(
    () => projectIoRows.filter((entry) => entry.required && entry.pin.trim().length === 0).length,
    [projectIoRows]
  );
  const hasIoMapping = useMemo(
    () =>
      projectIoRows.filter((entry) => entry.required).length > 0 &&
      missingRequiredCount === 0,
    [missingRequiredCount, projectIoRows]
  );
  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );
  const authoritativeProjectVectors = activeScenario?.vectors ?? [];
  const hasVectors = authoritativeProjectVectors.length > 0 || customVectors.length > 0;
  const projectVerifyState = useMemo(
    () => deriveProjectVerifyState(projectHealthCore),
    [projectHealthCore]
  );
  const latestVerifyPass = projectVerifyState === 'assertions-match';
  const scenarioAuthority = useMemo(
    () =>
      deriveScenarioAuthority({
        projectKind,
        activeExampleId,
        hasVectors: authoritativeProjectVectors.length > 0,
        hasAssertions: hasExpectedOutputs(authoritativeProjectVectors),
        dirtySinceVerify: projectHealthCore.dirtySinceVerify,
        verifyStatus: projectHealthCore.lastVerify?.status ?? null,
        vectorsAreAutoGenerated,
      }),
    [
      activeExampleId,
      authoritativeProjectVectors,
      projectHealthCore.dirtySinceVerify,
      projectHealthCore.lastVerify?.status,
      projectKind,
      vectorsAreAutoGenerated,
    ]
  );

  const readiness = useMemo(
    () => ({
      hasCircuit,
      hasIoMapping,
      hasVectors,
      projectKind,
      verifyPass: latestVerifyPass,
      verifyQualification: verifyLastRun?.qualification ?? projectHealthCore.lastVerify?.qualification,
      missingRequiredCount,
    }),
    [
      hasCircuit,
      hasIoMapping,
      hasVectors,
      latestVerifyPass,
      missingRequiredCount,
      projectKind,
      projectHealthCore.lastVerify?.qualification,
      verifyLastRun?.qualification,
    ]
  );

  const pendingExample = useMemo(
    () => (pendingExampleId ? getIdeExampleById(pendingExampleId) : undefined),
    [pendingExampleId]
  );
  const buildIdentity = useMemo(() => resolveIdeBuildIdentity(), []);
  const activeExample = useMemo(
    () => (activeExampleId ? getIdeExampleById(activeExampleId) : undefined),
    [activeExampleId]
  );
  const activeStarterContext = useMemo(() => {
    if (projectKind !== 'example' || !activeExample) return null;
    return {
      name: activeExample.name,
      lab: activeExample.lab,
      concept: activeExample.concept,
      summary: activeExample.summary,
      expectedBehavior: activeExample.expectedBehavior,
      nextAction:
        activeExample.goals?.find((goal) => goal.trim().length > 0)?.trim() ??
        'Inspect the scaffold on the canvas, then continue editing or move to Verify.',
    };
  }, [activeExample, projectKind]);
  const activeGuidedLabTask = useMemo(() => getGuidedLabTask(activeLabTaskId), [activeLabTaskId]);
  const fullAdderLabDesignChecklist = useMemo(
    () =>
      activeGuidedLabTask?.id === FULL_ADDER_LAB_ID
        ? deriveFullAdderDesignChecklist(circuit, projectIoRows)
        : null,
    [activeGuidedLabTask?.id, circuit, projectIoRows]
  );
  const fullAdderLabHardwareChecklist = useMemo(
    () =>
      activeGuidedLabTask?.id === FULL_ADDER_LAB_ID
        ? deriveFullAdderHardwareChecklist(projectIoRows)
        : null,
    [activeGuidedLabTask?.id, projectIoRows]
  );
  const hardwareExpectedBehavior = useMemo(() => {
    const fromExample = activeExample?.expectedBehavior?.trim();
    if (fromExample && fromExample.length > 0) return fromExample;
    if (authoritativeProjectVectors.length > 0) {
      return `Run ${authoritativeProjectVectors.length} deterministic bring-up vector${
        authoritativeProjectVectors.length === 1 ? '' : 's'
      } and confirm mapped outputs on Basys3.`;
    }
    return 'Generate bring-up vectors, run verify, then confirm mapped outputs on Basys3.';
  }, [activeExample?.expectedBehavior, authoritativeProjectVectors.length]);

  // Projects runtime authority into the editor cache. This stays safe because
  // DesignSurface mutations now hand the next circuit directly back to runtime,
  // so the shell never re-reads useCircuitStore to decide canonical truth.
  useLayoutEffect(() => {
    projectRuntimeCircuitToEditorStore(circuit);
  }, [circuit]);

  const applyExample = useCallback(
    (exampleId: string) => {
      const example = getIdeExampleById(exampleId);
      loadExample(exampleId);
      setFpgaConfig(buildIdeFpgaConfig({ name: example?.name ?? projectNameRef.current }));
      setImportMeta(null);
      setDiagnosticRouteRequest(null);
      setDesignFocusRequest(null);
      setPendingExampleId(null);
      setCurrentMode('design');
      // Mark example vectors as auto-generated so they regenerate if the student edits the circuit.
      setVectorsAreAutoGenerated(true);
    },
    [loadExample, setImportMeta, setDiagnosticRouteRequest, setDesignFocusRequest]
  );

  const handleConfirmExampleReplace = useCallback(() => {
    if (!pendingExampleId) return;
    applyExample(pendingExampleId);
  }, [applyExample, pendingExampleId]);

  const handleCancelExampleReplace = useCallback(() => {
    setPendingExampleId(null);
  }, []);

  const handleMappingPinChange = useCallback(
    (rowId: string, pin: string) => {
      setMappingPin(rowId, pin);
    },
    [setMappingPin]
  );

  const handleAutoSuggestMapping = useCallback(() => {
    autoSuggestMapping();
  }, [autoSuggestMapping]);
  const handleApplyHardwareMappingEdit = useCallback(
    (operation: HardwareMappingV2EditOperation) => {
      applyHardwareMappingEdit(operation);
    },
    [applyHardwareMappingEdit]
  );
  const derivedTopEntityName = useMemo(() => buildTopEntityName(projectName), [projectName]);
  const effectiveTopEntityName = useMemo(
    () => normalizeTopEntityName(fpgaConfig.top, derivedTopEntityName),
    [derivedTopEntityName, fpgaConfig.top]
  );
  const handleFpgaConfigChange = useCallback(
    (config: { part?: string; top?: string }) => {
      setFpgaConfig((current) => ({
        ...current,
        top:
          config.top !== undefined
            ? normalizeTopEntityName(config.top, derivedTopEntityName)
            : current.top,
        part:
          config.part !== undefined
            ? normalizeFpgaPart(config.part)
            : current.part,
      }));
    },
    [derivedTopEntityName]
  );
  const handleGenerateBringUpVectors = useCallback(() => {
    generateBringUpVectors();
    setVectorsAreAutoGenerated(true);
    setCurrentMode('hardware');
  }, [generateBringUpVectors]);

  const handleGenerateVerifyBasics = useCallback(() => {
    generateStimulusVectors();
    setVectorsAreAutoGenerated(false);
  }, [generateStimulusVectors]);

  const handleStartGuidedLab = useCallback(
    (labId: string) => {
      if (labId !== FULL_ADDER_LAB_ID) return;
      const hasCurrentWork =
        circuit.nodes.length > 0 ||
        projectIoRows.length > 0 ||
        authoritativeProjectVectors.length > 0 ||
        customVectors.length > 0;
      if (
        hasCurrentWork &&
        typeof window !== 'undefined' &&
        !window.confirm(
          'Start the Full Adder lab from a fresh canvas? Your current project will be backed up by autosave, but this action replaces the live workspace.'
        )
      ) {
        return;
      }

      replaceWithBlankProject();
      setProjectIdentity({
        projectName: FULL_ADDER_SCRATCH_LAB.title,
        projectDescription: FULL_ADDER_SCRATCH_LAB.assignment,
        projectKind: 'blank',
        sourceExampleId: null,
        activeExampleId: null,
        scenarioAuthority: 'none',
      });
      setActiveLabTaskId(FULL_ADDER_LAB_ID);
      setFpgaConfig(buildIdeFpgaConfig({ name: FULL_ADDER_SCRATCH_LAB.shortTitle }));
      setImportMeta(null);
      setDiagnosticRouteRequest(null);
      setDesignFocusRequest(null);
      setSavedProjectHash(null);
      setVectorsAreAutoGenerated(false);
      setLastSavedAt('Started Full Adder scratch lab');
      setGuidedLabViewportToken((token) => token + 1);
      setCurrentMode('design');
    },
    [
      authoritativeProjectVectors.length,
      circuit.nodes.length,
      customVectors.length,
      projectIoRows.length,
      replaceWithBlankProject,
      setActiveLabTaskId,
      setImportMeta,
      setLastSavedAt,
      setProjectIdentity,
    ]
  );

  const handleAddFullAdderLabSignal = useCallback(
    (label: string) => {
      const spec = findFullAdderLabSignal(label);
      if (!spec) return;
      const nextCircuit = addGuidedLabBoundaryNode(circuit, spec);
      if (nextCircuit === circuit) return;
      applyCircuitMutation(nextCircuit);
      setActiveLabTaskId(FULL_ADDER_LAB_ID);
      setLastSavedAt(`Added Full Adder lab signal ${spec.label}`);
      setGuidedLabViewportToken((token) => token + 1);
    },
    [applyCircuitMutation, circuit, setActiveLabTaskId, setLastSavedAt]
  );

  const handleAddFullAdderLabBlock = useCallback(() => {
    const hasFullAdder = circuit.nodes.some((node) => String(node.type).toLowerCase() === 'fulladder');
    if (hasFullAdder) return;
    addDesignNode('FullAdder', { x: 252, y: 116 });
    setActiveLabTaskId(FULL_ADDER_LAB_ID);
    setLastSavedAt('Added FullAdder lab block');
    setGuidedLabViewportToken((token) => token + 1);
  }, [addDesignNode, circuit.nodes, setActiveLabTaskId, setLastSavedAt]);

  const handleCreateFullAdderTruthTable = useCallback(() => {
    const vectors = buildFullAdderTruthTableVectors(projectIoRows);
    if (vectors.length === 0) {
      setLastSavedAt('Full Adder truth table needs A, B, Cin, Sum, and Cout signals first.');
      return;
    }
    if (
      authoritativeProjectVectors.length > 0 &&
      typeof window !== 'undefined' &&
      !window.confirm('Replace the current Verify cases with the 8-row Full Adder truth table?')
    ) {
      return;
    }
    setVectors(vectors);
    setVectorsAreAutoGenerated(false);
    setActiveLabTaskId(FULL_ADDER_LAB_ID);
    setLastSavedAt('Created 8-case Full Adder truth table');
    setCurrentMode('verify');
  }, [
    authoritativeProjectVectors.length,
    projectIoRows,
    setActiveLabTaskId,
    setLastSavedAt,
    setVectors,
  ]);

  const handleApplyFullAdderSuggestedMapping = useCallback(() => {
    const io = resolveFullAdderLabIoRows(projectIoRows);
    const mappings = [
      [io.A, 'SW0'],
      [io.B, 'SW1'],
      [io.Cin, 'SW2'],
      [io.Sum, 'LD0'],
      [io.Cout, 'LD1'],
    ] as const;
    const updates: Record<string, string> = {};
    let applied = 0;
    for (const [row, alias] of mappings) {
      if (!row) continue;
      updates[row.id] = alias;
      applied += 1;
    }
    setMappingPins(updates);
    setActiveLabTaskId(FULL_ADDER_LAB_ID);
    setLastSavedAt(applied > 0 ? `Mapped ${applied} Full Adder lab signal${applied === 1 ? '' : 's'}` : 'No Full Adder lab signals to map yet.');
  }, [projectIoRows, setActiveLabTaskId, setLastSavedAt, setMappingPins]);

  const handleVectorsChange = useCallback(
    (vectors: TestVector[]) => {
      setVectors(vectors);
      setVectorsAreAutoGenerated(false);
    },
    [setVectors]
  );

  const handleExportResult = useCallback(
    (result: ProjectHealthExportResult) => {
      recordExport(result);
    },
    [recordExport]
  );

  const handleRunVerification = useCallback(
    (input: Parameters<typeof runRuntimeVerification>[0]) => {
      // Structural compiler/export blockers invalidate assertion grading. Keep
      // Observe available, but never let a checked run publish a misleading
      // PASS/FAIL while Design has no valid output authority.
      if (input.assertionMode && blockingDesignIssueRef.current) {
        setLastSavedAt('Compare is blocked until the Design issue is repaired.');
        return;
      }
      // Use the ref to avoid TDZ: exportProject (declared later in this function body)
      // cannot be used in a useCallback dep array declared here. exportProjectRef
      // is always up-to-date (assigned at line ~714 on every render).
      const ep = exportProjectRef.current;
      runRuntimeVerification({
        ...input,
        scheduleContract: ep
          ? deriveVerifySchedule(ep.circuit, ep.ioMapping, ep.hdl)
          : undefined,
      });
    },
    [runRuntimeVerification, setLastSavedAt]
  );

  const handleClearVerification = useCallback(() => {
    clearRuntimeVerification();
  }, [clearRuntimeVerification]);

  // C-2: Debug bridge handlers
  const handleDebugTickSelected = useCallback((
    tick: number,
    signals: Record<string, 0 | 1>,
    context?: VerifyDebugContext | null
  ) => {
    setDebugState({
      tick,
      signals: new Map(Object.entries(signals) as [string, 0 | 1][]),
      context: context ?? null,
    });
    const waveform = verifyLastRun?.waveform ?? [];
    const idx = waveform.findIndex((s) => s.tick === tick);
    setDebugTickIndex(idx >= 0 ? idx : null);
    setVerifySelectedTick(tick);
    setCurrentMode('design');
  }, [verifyLastRun]);

  const handleClearDebugState = useCallback(() => {
    setDebugState(null);
    setDebugTickIndex(null);
  }, []);

  const applyDebugTickIndex = useCallback((nextIndex: number) => {
    if (!verifyLastRun) return;
    if (nextIndex < 0 || nextIndex >= verifyLastRun.waveform.length) return;
    const sample = verifyLastRun.waveform[nextIndex];
    if (!sample) return;
    const signals = new Map<string, 0 | 1>(
      Object.entries(sample.signals).map(([key, value]) => [key, value === '1' ? 1 : 0])
    );
    setDebugState({ tick: sample.tick, signals, context: null });
    setDebugTickIndex(nextIndex);
    setVerifySelectedTick(sample.tick);
  }, [verifyLastRun]);

  const handlePrevDebugTick = useCallback(() => {
    if (debugTickIndex == null) return;
    applyDebugTickIndex(debugTickIndex - 1);
  }, [applyDebugTickIndex, debugTickIndex]);

  const handleNextDebugTick = useCallback(() => {
    if (debugTickIndex == null) return;
    applyDebugTickIndex(debugTickIndex + 1);
  }, [applyDebugTickIndex, debugTickIndex]);

  const handleSelectDebugTickIndex = useCallback((nextIndex: number) => {
    applyDebugTickIndex(nextIndex);
  }, [applyDebugTickIndex]);

  const handleDesignMutation = useCallback((nextCircuit: Circuit) => {
    applyCircuitMutation(nextCircuit);
    setDiagnosticRouteRequest(null);
  }, [applyCircuitMutation]);

  const refreshSavedProjects = useCallback(() => {
    setSavedProjects(listIdeProjectSnapshots());
  }, []);

  const handleApplySuggestions = useCallback(
    (items: Array<{ rowId: string; pin: string }>) => {
      for (const it of items) {
        setMappingPin(it.rowId, it.pin);
      }
      setCurrentMode('project');
    },
    [setMappingPin, setCurrentMode]
  );

  const createRecoveryBackup = useCallback(() => {
    if (!hasCircuit || !exportProjectRef.current) {
      return { name: null as string | null, failed: false };
    }
    if (savedProjectHash && savedProjectHash === projectHashRef.current) {
      return { name: null as string | null, failed: false };
    }

    const backupTimestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
    const backupName = `Backup - ${projectName} - ${backupTimestamp}`;
    const backupProject: RBProject = {
      ...exportProjectRef.current,
      name: backupName,
    };
    const backupId = `backup-${projectId}-${Date.now().toString(36)}`;
    const snapshot = saveIdeProjectSnapshot({
      projectId: backupId,
      projectName: backupName,
      projectHash: digestWorkspaceSnapshot(backupProject, scenarios, activeScenarioId),
      project: backupProject,
      scenarios,
      activeScenarioId,
    });

    if (!snapshot) {
      return { name: null as string | null, failed: true };
    }

    return { name: backupName, failed: false };
  }, [activeScenarioId, hasCircuit, projectId, projectName, savedProjectHash, scenarios]);

  const handleSafeLoadIntoIde = useCallback(
    (
      project: RBProject,
      options?: {
        sourceLabel?: string;
        savedProjectHash?: string | null;
        closeLoadModal?: boolean;
        nextMode?: IdeMode | null;
        backupCurrent?: boolean;
        importMeta?: IdeImportMeta | null;
        testbenchSnapshot?: ProjectTestbenchSnapshot;
      }
    ) => {
      const sourceLabel = options?.sourceLabel ?? project.name ?? 'project';
      const backup = options?.backupCurrent === false
        ? { name: null as string | null, failed: false }
        : createRecoveryBackup();

      try {
        loadFromProject(project, options?.testbenchSnapshot);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown project error';
        setLastSavedAt(`Could not load ${sourceLabel}: ${reason}`);
        refreshSavedProjects();
        return false;
      }

      setFpgaConfig(buildIdeFpgaConfig(project));
      setImportMeta(options?.importMeta ?? null);
      pendingImportMetaRef.current = null;
      setSavedProjectHash(options?.savedProjectHash ?? null);
      refreshSavedProjects();

      let statusMessage = `Loaded ${sourceLabel}.`;
      if (backup.name) {
        statusMessage = `Loaded ${sourceLabel}. Previous work backed up as "${backup.name}".`;
      } else if (backup.failed) {
        statusMessage = `Loaded ${sourceLabel}. Previous work could not be backed up.`;
      }
      setLastSavedAt(statusMessage);

      if (options?.closeLoadModal) {
        setLoadModalOpen(false);
      }
      if (options?.nextMode) {
        setCurrentMode(normalizeIdeMode(options.nextMode));
      }
      return true;
    },
    [createRecoveryBackup, loadFromProject, refreshSavedProjects, setImportMeta, setLastSavedAt]
  );

  const handleImportCommitted = useCallback((meta: IdeImportCommitMeta) => {
    pendingImportMetaRef.current = meta;
  }, []);

  const handleImportProject = useCallback(
    (project: RBProject) => {
      const pendingMeta = pendingImportMetaRef.current;
      pendingImportMetaRef.current = null;
      const restored = handleSafeLoadIntoIde(project, {
        sourceLabel: `import "${project.name || 'project'}"`,
        savedProjectHash: null,
        backupCurrent: true,
        importMeta: pendingMeta,
        // After a successful import, route to Design so the imported circuit
        // is immediately visible. Without this the import surface stays in
        // place and the load reads as silent — a TA/instructor importing a
        // student proof bundle could not tell the project actually loaded.
        nextMode: 'design',
      });
      if (restored) {
        setProjectIdentity({
          projectKind: 'import',
          activeExampleId: null,
          sourceExampleId: typeof project.meta?.sourceExampleId === 'string' ? project.meta.sourceExampleId : null,
          markDirty: false,
        });
      }
    },
    [handleSafeLoadIntoIde, setProjectIdentity]
  );

  const handleRestoreAutosave = useCallback(() => {
    try {
      const saved = localStorage.getItem('rb-autosave-circuit');
      if (!saved) {
        setAutosaveAvailable(false);
        return;
      }
      const parsed = decodeRBProject(saved);
      const restored = handleSafeLoadIntoIde(parsed, {
        sourceLabel: 'autosaved project',
        savedProjectHash: null,
        nextMode: 'project',
        backupCurrent: false,
      });
      if (restored) {
        localStorage.removeItem('rb-autosave-circuit');
      }
      setAutosaveAvailable(false);
    } catch (error) {
      console.warn('Failed to restore autosave:', error);
      localStorage.removeItem('rb-autosave-circuit');
      setAutosaveAvailable(false);
      setLastSavedAt('Autosave restore failed. The saved draft was invalid and was cleared.');
    }
  }, [handleSafeLoadIntoIde, setLastSavedAt]);

  useEffect(() => {
    if (fpgaConfigBootstrappedRef.current) return;
    fpgaConfigBootstrappedRef.current = true;
    setFpgaConfig((current) => {
      const next = buildIdeFpgaConfig({ name: projectName });
      if (
        current.board === next.board &&
        current.top === next.top &&
        current.part === next.part
      ) {
        return current;
      }
      return next;
    });
  }, [projectName]);

  useEffect(() => {
    if (activeMode !== 'design') return;
    if (projectKind !== 'home') return;
    if (hasCircuit) return;
    startBlankProject();
  }, [activeMode, hasCircuit, projectKind, startBlankProject]);

  const mappedIoSignals = useMemo(
    () =>
      projectIoRows
        .filter((entry) => entry.pin.trim().length > 0)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          pin: entry.pin,
          nodeId: entry.nodeId,
          direction: entry.direction,
        })),
    [projectIoRows]
  );
  const verifySignals = useMemo(
    () =>
      projectIoRows.map((entry) => ({
        id: entry.id,
        label: entry.label,
        pin: entry.pin,
        nodeId: entry.nodeId,
        direction: entry.direction,
      })),
    [projectIoRows]
  );
  const verifyInputSignals = useMemo(
    () =>
      projectIoRows
        .filter((entry) => entry.direction === 'in')
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          pin: entry.pin,
          nodeId: entry.nodeId,
        })),
    [projectIoRows]
  );
  const hdlText = useMemo(() => {
    try {
      const netlist = netlistFromCircuit(circuit);
      const ioMappingForExport = {
        inputs: projectIoRows
          .filter((r) => r.direction === 'in')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
        outputs: projectIoRows
          .filter((r) => r.direction === 'out')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
      };
      const hasMappedPins =
        ioMappingForExport.inputs.length > 0 || ioMappingForExport.outputs.length > 0;
      const bindings = hasMappedPins ? buildVhdlTopLevelBindings(ioMappingForExport) : {};
      return vhdlFromNetlist(netlist, { entityName: effectiveTopEntityName, ...bindings }).vhd;
    } catch {
      return '';
    }
  }, [circuit, effectiveTopEntityName, projectIoRows]);
  const xdcText = useMemo(() => buildConstraintText(projectIoRows), [projectIoRows]);

  const exportProject = useMemo<RBProject>(
    () => ({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-02-19T00:00:00.000Z',
      updatedAt: '2026-02-19T00:00:00.000Z',
      name: projectName,
      description: projectDescription,
      circuit: normalizeProjectCircuit(circuit),
      hdl: {
        top: effectiveTopEntityName,
        sources: [
          {
            path: 'top.vhd',
            language: 'vhdl',
            text: hdlText,
          },
        ],
      },
      fpga: {
        board: fpgaConfig.board,
        part: fpgaConfig.part,
        top: effectiveTopEntityName,
        constraints: {
          type: 'xdc',
          text: xdcText,
        },
      },
      ioMapping: materializeIoMappingFromHardwareMappingV2(hardwareMappingV2),
      hardwareMappingV2,
      vectors: authoritativeProjectVectors,
      customComponents: customComponents.length > 0 ? customComponents : undefined,
      macros: macros.length > 0 ? macros : undefined,
      meta: {
        appSurface: 'ide-export',
        projectId,
        projectKind,
        sourceExampleId,
        scenarioAuthority,
        ...(activeGuidedLabTask ? { labId: activeGuidedLabTask.id } : {}),
        ...(studentName.trim() ? { studentName: studentName.trim() } : {}),
      },
    }),
    [
      activeGuidedLabTask,
      circuit,
      customComponents,
      hdlText,
      macros,
      projectDescription,
      projectId,
      projectIoRows,
      hardwareMappingV2,
      projectKind,
      projectName,
      authoritativeProjectVectors,
      scenarioAuthority,
      sourceExampleId,
      studentName,
      effectiveTopEntityName,
      fpgaConfig.board,
      fpgaConfig.part,
      xdcText,
    ]
  );
  const determinismHash = useMemo(() => digestValue(exportProject), [exportProject]);
  const projectHash = useMemo(
    () => digestWorkspaceSnapshot(exportProject, scenarios, activeScenarioId),
    [activeScenarioId, exportProject, scenarios]
  );

  useEffect(() => {
    if (currentMode === activeMode) return;
    setCurrentMode(activeMode);
  }, [activeMode, currentMode]);

  useEffect(() => {
    if (projectKind === 'example' && activeExampleId) return;
    setVectorsAreAutoGenerated(false);
  }, [activeExampleId, projectKind]);

  // Auto-regenerate vectors when circuit changes AND vectors are auto-generated (not manually authored).
  // This keeps bringup/example vectors in sync with the current circuit I/O automatically.
  // IMPORTANT: must be declared AFTER determinismHash (line above) to avoid TDZ in minified bundle.
  const prevAutoRegenHashRef = useRef<string>('');
  useEffect(() => {
    if (!vectorsAreAutoGenerated || projectKind !== 'example' || !activeExampleId) {
      prevAutoRegenHashRef.current = '';
      return;
    }
    if (prevAutoRegenHashRef.current === '') {
      prevAutoRegenHashRef.current = determinismHash;
      return;
    }
    if (prevAutoRegenHashRef.current !== determinismHash) {
      generateBringUpVectors();
      prevAutoRegenHashRef.current = determinismHash;
    }
  }, [activeExampleId, determinismHash, generateBringUpVectors, projectKind, vectorsAreAutoGenerated]);

  exportProjectRef.current = exportProject;
  projectIdRef.current = projectId;
  projectNameRef.current = projectName;
  projectHashRef.current = projectHash;
  scenariosRef.current = scenarios;
  activeScenarioIdRef.current = activeScenarioId;
  sessionMetaRef.current = {
    version: 1,
    savedAt: Date.now(),
    projectId,
    currentMode: activeMode,
    macros: macros.length > 0 ? macros : undefined,
    activeExampleId: activeExampleId ?? null,
    projectKind,
    sourceExampleId,
    scenarioAuthority,
    probedKeys: runtimeSim.probes.map((p) => p.key),
  };
  const saveState: 'saved' | 'unsaved' | 'autosaving' = useMemo(() => {
    if (isAutosaving) return 'autosaving';
    return projectHash === savedProjectHash ? 'saved' : 'unsaved';
  }, [isAutosaving, projectHash, savedProjectHash]);
  const isPristineProjectHome = useMemo(
    () =>
      projectKind === 'home' &&
      !hasCircuit &&
      authoritativeProjectVectors.length === 0 &&
      customVectors.length === 0 &&
      !activeExampleId &&
      !sourceExampleId,
    [
      activeExampleId,
      authoritativeProjectVectors.length,
      customVectors.length,
      hasCircuit,
      projectKind,
      sourceExampleId,
    ]
  );
  const hasUnsavedWork = !isPristineProjectHome && projectHash !== savedProjectHash;

  const handleOpenExample = useCallback(
    (exampleId: string) => {
      if (activeExampleId === exampleId) {
        setCurrentMode('design');
        return;
      }
      if (hasUnsavedWork) {
        setPendingExampleId(exampleId);
        return;
      }
      applyExample(exampleId);
    },
    [activeExampleId, applyExample, hasUnsavedWork]
  );

  const handleSaveProject = useCallback(() => {
    const snapshot = saveIdeProjectSnapshot({
      projectId,
      projectName,
      projectHash,
      project: exportProject,
      scenarios,
      activeScenarioId,
    });
    if (!snapshot) return;
    setSavedProjectHash(snapshot.projectHash);
    setLastSavedAt(`Saved ${formatSavedAtLabel(snapshot.savedAtIso)}`);
    refreshSavedProjects();
  }, [activeScenarioId, exportProject, projectHash, projectId, projectName, refreshSavedProjects, scenarios, setLastSavedAt]);

  const handleRenameProject = useCallback(
    (nextName: string) => {
      const trimmed = nextName.trim();
      if (trimmed.length === 0 || trimmed === projectName) return;
      const followsProjectIdentity = projectKind === 'blank' || projectKind === 'custom';
      const renamedTop = followsProjectIdentity
        ? buildTopEntityName(trimmed)
        : effectiveTopEntityName;

      const renamedProject: RBProject = {
        ...exportProject,
        name: trimmed,
        hdl: exportProject.hdl
          ? { ...exportProject.hdl, top: renamedTop }
          : exportProject.hdl,
        fpga: exportProject.fpga
          ? { ...exportProject.fpga, top: renamedTop }
          : exportProject.fpga,
      };
      const renamedHash = digestWorkspaceSnapshot(renamedProject, scenarios, activeScenarioId);
      if (followsProjectIdentity) {
        setFpgaConfig((current) => ({ ...current, top: renamedTop }));
      }
      setProjectIdentity({ projectName: trimmed });

      const snapshot = saveIdeProjectSnapshot({
        projectId,
        projectName: trimmed,
        projectHash: renamedHash,
        project: renamedProject,
        scenarios,
        activeScenarioId,
      });

      if (snapshot) {
        setSavedProjectHash(snapshot.projectHash);
        const nextSessionMeta: LabSessionMeta = {
          ...(sessionMetaRef.current ?? {
            version: 1,
            savedAt: Date.now(),
            activeExampleId: null,
            probedKeys: [],
          }),
          version: 1,
          savedAt: Date.now(),
          projectId,
          currentMode: activeMode,
          activeExampleId: activeExampleId ?? null,
          projectKind,
          sourceExampleId,
          scenarioAuthority,
          probedKeys: runtimeSim.probes.map((probe) => probe.key),
        };
        sessionMetaRef.current = nextSessionMeta;
        saveLabSessionMeta(nextSessionMeta);
        setLastSavedAt(`Renamed and saved ${formatSavedAtLabel(snapshot.savedAtIso)}`);
        refreshSavedProjects();
        return;
      }

      setLastSavedAt('Unsaved changes - project renamed');
    },
    [
      activeExampleId,
      activeMode,
      exportProject,
      effectiveTopEntityName,
      projectId,
      projectKind,
      projectName,
      refreshSavedProjects,
      runtimeSim.probes,
      scenarioAuthority,
      setLastSavedAt,
      setProjectIdentity,
      sourceExampleId,
      scenarios,
      activeScenarioId,
    ]
  );

  const handleSaveAsProject = useCallback(() => {
    const nextProjectId = createSaveAsProjectId(projectName, projectId, savedProjects);
    const nextProject: RBProject = {
      ...exportProject,
      meta: {
        ...(exportProject.meta ?? {}),
        projectId: nextProjectId,
      },
    };
    const nextHash = digestWorkspaceSnapshot(nextProject, scenarios, activeScenarioId);
    const snapshot = saveIdeProjectSnapshot({
      projectId: nextProjectId,
      projectName,
      projectHash: nextHash,
      project: nextProject,
      scenarios,
      activeScenarioId,
    });
    if (!snapshot) return;
    setProjectIdentity({
      projectId: nextProjectId,
      markDirty: false,
    });
    setSavedProjectHash(snapshot.projectHash);
    setLastSavedAt(`Saved as ${nextProjectId}`);
    refreshSavedProjects();
  }, [
    exportProject,
    projectId,
    projectName,
    refreshSavedProjects,
    savedProjects,
    scenarios,
    activeScenarioId,
    setLastSavedAt,
    setProjectIdentity,
  ]);

  const handleOpenLoadModal = useCallback(() => {
    refreshSavedProjects();
    setLoadModalOpen(true);
  }, [refreshSavedProjects]);

  const handleCloseLoadModal = useCallback(() => {
    setLoadModalOpen(false);
  }, []);

  const handleLoadSavedProject = useCallback(
    (entry: PersistedIdeProjectIndexEntry) => {
      const snapshot = loadIdeProjectSnapshot(entry.projectId);
      if (!snapshot) {
        setLastSavedAt(`Could not load saved project "${entry.projectName}". The snapshot was missing.`);
        refreshSavedProjects();
        return;
      }
      const project = decodePersistedIdeProject(snapshot);
      if (!project) {
        setLastSavedAt(`Could not load saved project "${entry.projectName}". The snapshot was invalid.`);
        refreshSavedProjects();
        return;
      }
      void handleSafeLoadIntoIde(project, {
        sourceLabel: `saved project "${entry.projectName}"`,
        savedProjectHash: snapshot.projectHash,
        closeLoadModal: true,
        nextMode: 'project',
        backupCurrent: true,
        testbenchSnapshot: {
          scenarios: snapshot.scenarios,
          activeScenarioId: snapshot.activeScenarioId,
        },
      });
    },
    [handleSafeLoadIntoIde, refreshSavedProjects, setLastSavedAt]
  );

  const handleOpenRecentProject = useCallback(
    (projectIdToOpen: string) => {
      const entry = savedProjects.find((candidate) => candidate.projectId === projectIdToOpen);
      if (!entry) {
        refreshSavedProjects();
        setLastSavedAt(`Could not find the saved project "${projectIdToOpen}". Refresh the saved list and try again.`);
        return;
      }
      handleLoadSavedProject(entry);
    },
    [handleLoadSavedProject, refreshSavedProjects, savedProjects, setLastSavedAt]
  );

  const handleOpenProjectFile = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleProjectFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const raw = await file.text();
        const parsed = decodeRBProject(raw);
        void handleSafeLoadIntoIde(parsed, {
          sourceLabel: `file ${file.name}`,
          savedProjectHash: null,
          closeLoadModal: true,
          nextMode: 'project',
          backupCurrent: true,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown project error';
        setLastSavedAt(`Load failed for ${file.name}: ${reason}`);
      }
    },
    [handleSafeLoadIntoIde, setLastSavedAt]
  );

  const handleResetToExample = useCallback(() => {
    resetToActiveExample();
    setFpgaConfig(buildIdeFpgaConfig({ name: activeExample?.name ?? projectNameRef.current }));
    setImportMeta(null);
    setSavedProjectHash(null);
    setLoadModalOpen(false);
    setLastSavedAt('Reset to active example');
    refreshSavedProjects();
  }, [activeExample?.name, refreshSavedProjects, resetToActiveExample, setImportMeta, setLastSavedAt]);

  // One-time boot restore: reload last session on first mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    const meta = loadLabSessionMeta();
    if (!meta) return;
    const snapshot = loadIdeProjectSnapshot(meta.projectId);
    if (!snapshot) {
      clearLabSessionMeta();
      setLastSavedAt('Previous session could not be restored. Starting from the current project.');
      return;
    }
    const project = decodePersistedIdeProject(snapshot);
    if (!project) {
      clearLabSessionMeta();
      setLastSavedAt('Previous session was invalid and could not be restored.');
      return;
    }
    const requestedMode = resolveRequestedIdeMode(window.location.search);
    const restoredMode = resolveRestoredIdeMode(window.location.search);
    isRestoringRef.current = true;
    const restored = handleSafeLoadIntoIde(project, {
      sourceLabel: `previous session "${project.name}"`,
      savedProjectHash: snapshot.projectHash,
      nextMode: restoredMode,
      backupCurrent: false,
      testbenchSnapshot: {
        scenarios: snapshot.scenarios,
        activeScenarioId: snapshot.activeScenarioId,
      },
    });
    isRestoringRef.current = false;
    if (!restored) {
      clearLabSessionMeta();
      return;
    }
    if (requestedMode) {
      setLastSavedAt(`Resumed "${project.name}" and opened ${requestedMode}.`);
      return;
    }
    if (meta.currentMode !== 'project') {
      setLastSavedAt(`Resumed "${project.name}" on Project so you can continue from the home view.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  useEffect(() => {
    setSavedProjects(listIdeProjectSnapshots());
    const snapshot = loadIdeProjectSnapshot(projectId);
    setSavedProjectHash(snapshot?.projectHash ?? null);
  }, [projectId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!projectId.trim()) return;
    if (projectHash === savedProjectHash) return;

    setIsAutosaving(true);
    const timer = window.setTimeout(() => {
      const snapshot = saveIdeProjectSnapshot({
        projectId,
        projectName,
        projectHash,
        project: exportProject,
        scenarios,
        activeScenarioId,
      });
      if (snapshot) {
        setSavedProjectHash(snapshot.projectHash);
        setSavedProjects(listIdeProjectSnapshots());
        setLastSavedAt(`Autosaved ${formatSavedAtLabel(snapshot.savedAtIso)}`);
      }
      setIsAutosaving(false);
    }, 700);

    return () => {
      window.clearTimeout(timer);
      setIsAutosaving(false);
    };
  }, [
    exportProject,
    projectHash,
    projectId,
    projectName,
    scenarios,
    activeScenarioId,
    savedProjectHash,
    setLastSavedAt,
  ]);

  // Session meta: save mode + probes (debounced 500ms)
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      if (sessionMetaRef.current) {
        saveLabSessionMeta(sessionMetaRef.current);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeExampleId, currentMode, projectKind, runtimeSim.probes, scenarioAuthority, sourceExampleId]);

  // Auto-save full project to localStorage on every circuit change
  useEffect(() => {
    if (!hasCircuit) return;
    try {
      localStorage.setItem('rb-autosave-circuit', JSON.stringify(exportProject));
    } catch {
      // ignore quota errors
    }
  }, [exportProject, hasCircuit]);

  // On mount: check if a localStorage autosave exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rb-autosave-circuit');
      if (saved) {
        const parsed = decodeRBProject(saved);
        if (parsed && Array.isArray(parsed.circuit?.nodes) && parsed.circuit.nodes.length > 0) {
          setAutosaveAvailable(true);
        }
      }
    } catch {
      localStorage.removeItem('rb-autosave-circuit');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportViewModel = useMemo(
    () => buildExportViewModel(exportProject, verifyLastRun, activeScenario ?? undefined),
    [activeScenario, exportProject, verifyLastRun]
  );
  const currentExportPackageSourceHash = useMemo(
    () => buildProjectExportPackageSourceHash(exportProject, exportViewModel.artifacts),
    [exportProject, exportViewModel.artifacts]
  );
  const exportRequiredMappingGapCount = useMemo(
    () =>
      exportViewModel.pinTable.filter(
        (row) => row.required && row.status === 'missing'
      ).length,
    [exportViewModel.pinTable]
  );
  const exportHasRequiredMappingGap = exportRequiredMappingGapCount > 0;
  const effectiveReadiness = useMemo(
    () => ({
      ...readiness,
      hasIoMapping: readiness.hasIoMapping && !exportHasRequiredMappingGap,
      missingRequiredCount: readiness.missingRequiredCount + exportRequiredMappingGapCount,
    }),
    [exportHasRequiredMappingGap, exportRequiredMappingGapCount, readiness]
  );
  const designDiagnostics = useMemo(
    () => deriveDesignCompilerDiagnostics(exportProject),
    [exportProject]
  );
  const liveScheduleContract = useMemo(() => {
    if (!exportProject) return undefined;
    return deriveVerifySchedule(
      exportProject.circuit,
      exportProject.ioMapping,
      exportProject.hdl
    );
  }, [exportProject]);
  const exportDesignDiagnostics = useMemo(
    () =>
      exportViewModel.errors.filter(
        (diagnostic) =>
          diagnostic.canonical.blocking &&
          isDesignOwnedExportDiagnostic(
            diagnostic.code,
            liveScheduleContract?.timingMode
          )
      ),
    [exportViewModel.errors, liveScheduleContract?.timingMode]
  );
  const designSurfaceDiagnostics = useMemo(() => {
    const diagnosticsById = new Map(
      designDiagnostics.map((diagnostic) => [diagnostic.id, diagnostic] as const)
    );
    for (const diagnostic of exportDesignDiagnostics) {
      diagnosticsById.set(diagnostic.canonical.id, diagnostic.canonical);
    }
    return Array.from(diagnosticsById.values());
  }, [designDiagnostics, exportDesignDiagnostics]);
  const blockingDesignIssue = useMemo(() => {
    const exportDiagnostic = exportDesignDiagnostics[0];
    if (exportDiagnostic) {
      return {
        title: exportDiagnostic.title,
        message: exportDiagnostic.message,
        hint: exportDiagnostic.fix ?? exportDiagnostic.hint[0],
      };
    }
    const compilerDiagnostic = designDiagnostics.find(
      (diagnostic) => diagnostic.blocking || diagnostic.severity === 'error'
    );
    if (!compilerDiagnostic) return null;
    return {
      title: compilerDiagnostic.title,
      message: compilerDiagnostic.message,
      hint: compilerDiagnostic.hint[0],
    };
  }, [designDiagnostics, exportDesignDiagnostics]);
  const blockingDesignIssueMessage = useMemo(
    () =>
      blockingDesignIssue
        ? [blockingDesignIssue.title, blockingDesignIssue.message, blockingDesignIssue.hint]
            .filter(Boolean)
            .join(' ')
        : undefined,
    [blockingDesignIssue]
  );
  blockingDesignIssueRef.current = Boolean(blockingDesignIssue);
  const projectHealth = useMemo(
    () =>
      deriveProjectHealth(projectHealthCore, {
        hasCircuit: effectiveReadiness.hasCircuit,
        hasIoMapping: effectiveReadiness.hasIoMapping,
        hasVectors: effectiveReadiness.hasVectors,
        hasBlockingDesignIssue: Boolean(blockingDesignIssue),
        blockingDesignIssueMessage,
        projectKind: effectiveReadiness.projectKind,
        verifyQualification: effectiveReadiness.verifyQualification,
      }),
    [
      blockingDesignIssue,
      blockingDesignIssueMessage,
      effectiveReadiness.hasCircuit,
      effectiveReadiness.hasIoMapping,
      effectiveReadiness.hasVectors,
      effectiveReadiness.projectKind,
      effectiveReadiness.verifyQualification,
      projectHealthCore,
    ]
  );
  const hardwareExpectedIoRows = useMemo(
    () => extractExpectedIoRows(exportViewModel.artifacts),
    [exportViewModel.artifacts]
  );

  const liveSignalRoles = useMemo(() => {
    if (!liveScheduleContract) return {};
    return deriveIoSignalRoles(projectIoRows, liveScheduleContract);
  }, [liveScheduleContract, projectIoRows]);
  const liveTimingGuidance = useMemo(
    () => deriveTimingGuidance(liveScheduleContract),
    [liveScheduleContract]
  );
  const handleDiagnosticAction = useCallback((diagnostic: IdeDiagnostic) => {
    const action = choosePrimaryDiagnosticAction(diagnostic);
    if (!action) return;
    setCurrentMode(normalizeIdeMode(action.payload.mode));
    setDiagnosticRouteRequest((previous) => ({
      ...action.payload,
      diagnosticId: diagnostic.id,
      requestId: (previous?.requestId ?? 0) + 1,
    }));
  }, []);

  const designCompilerStatus = useMemo<DesignCompilerStatus>(
    () => ({
      dirtySinceVerify: projectHealthCore.dirtySinceVerify,
      dirtySinceExport: projectHealthCore.dirtySinceExport,
      errorCount: designSurfaceDiagnostics.filter((entry) => entry.severity === 'error').length,
      warningCount: designSurfaceDiagnostics.filter((entry) => entry.severity === 'warn').length,
      diagnostics: designSurfaceDiagnostics,
    }),
    [designSurfaceDiagnostics, projectHealthCore.dirtySinceExport, projectHealthCore.dirtySinceVerify]
  );
  const verifyMappingComplete = missingRequiredCount === 0;
  const unmappedOutputLabels = useMemo(
    () =>
      projectIoRows
        .filter((entry) => entry.direction === 'out' && entry.pin.trim().length === 0)
        .map((entry) => entry.label || entry.id),
    [projectIoRows]
  );
  const verifyHasFloatingOutputWarning = useMemo(
    () =>
      exportViewModel.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'RBEX4103' ||
          /floating output detected|has no driver|undriven output/i.test(diagnostic.message)
      ),
    [exportViewModel.diagnostics]
  );
  const verifyUnsupportedFeedbackDiagnostic = useMemo(() => {
    const exportDiagnostic =
      exportViewModel.diagnostics.find(
        (diagnostic) =>
          diagnostic.code === 'RBEX4102' ||
          /unsupported feedback|combinational loop/i.test(
            `${diagnostic.title} ${diagnostic.message}`
          )
      ) ?? null;
    if (exportDiagnostic) {
      return {
        title: exportDiagnostic.title,
        message: exportDiagnostic.message,
      };
    }

    const designDiagnostic =
      designDiagnostics.find((diagnostic) =>
        /feedback loop|combinational loop/i.test(
          `${diagnostic.title} ${diagnostic.message}`
        )
      ) ?? null;
    if (!designDiagnostic) return null;
    return {
      title: 'Unsupported feedback structure',
      message:
        'Feedback loop detected in the current circuit. Replace it with DLatch, DFlipFlop, RSLatch, or the exact 4-NAND D-latch topology before relying on compare/export.',
    };
  }, [designDiagnostics, exportViewModel.diagnostics]);
  const currentVerifyProjectHash = useMemo(
    () =>
      buildCurrentVerifyProjectHash({
        circuit,
        projectVectors: authoritativeProjectVectors,
        customVectors,
        projectIoRows,
      }),
    [authoritativeProjectVectors, circuit, customVectors, projectIoRows]
  );
  const currentVerifyReplayHash = useMemo(
    () =>
      buildCurrentVerifyReplayHash({
        circuit,
        projectVectors: authoritativeProjectVectors,
        customVectors,
        projectIoRows,
      }),
    [authoritativeProjectVectors, circuit, customVectors, projectIoRows]
  );
  const workflowAuthority = useMemo(
    () =>
      deriveProjectWorkflowAuthority({
        projectHealthCore,
        readiness: {
          hasCircuit: effectiveReadiness.hasCircuit,
          hasIoMapping: effectiveReadiness.hasIoMapping,
          hasVectors: effectiveReadiness.hasVectors,
          hasBlockingDesignIssue: Boolean(blockingDesignIssue),
          blockingDesignIssueMessage,
          projectKind: effectiveReadiness.projectKind,
          verifyQualification: effectiveReadiness.verifyQualification,
        },
        verifyLastRun,
        verifyRunHistory,
        currentVerifyProjectHash,
        currentExportHash: currentExportPackageSourceHash,
      }),
    [
      currentVerifyProjectHash,
      blockingDesignIssue,
      blockingDesignIssueMessage,
      currentExportPackageSourceHash,
      projectHealthCore,
      effectiveReadiness.hasCircuit,
      effectiveReadiness.hasIoMapping,
      effectiveReadiness.hasVectors,
      effectiveReadiness.projectKind,
      effectiveReadiness.verifyQualification,
      verifyLastRun,
      verifyRunHistory,
    ]
  );
  const primaryProjectCta = workflowAuthority.primaryCta;
  const fullAdderLabVerifyStatus = useMemo<'pass' | 'fail' | 'stale' | 'not-run'>(() => {
    if (projectHealthCore.dirtySinceVerify && projectHealthCore.lastVerify) return 'stale';
    if (projectVerifyState === 'assertions-match') return 'pass';
    if (projectHealthCore.lastVerify?.status === 'fail') return 'fail';
    return 'not-run';
  }, [projectHealthCore.dirtySinceVerify, projectHealthCore.lastVerify, projectVerifyState]);
  const fullAdderLabExportSummary = useMemo(
    () =>
      activeGuidedLabTask?.id === FULL_ADDER_LAB_ID &&
      fullAdderLabDesignChecklist &&
      fullAdderLabHardwareChecklist
        ? deriveFullAdderExportSummary({
            rows: projectIoRows,
            designChecklist: fullAdderLabDesignChecklist,
            hardwareChecklist: fullAdderLabHardwareChecklist,
            verifyStatus: fullAdderLabVerifyStatus,
            packageReady: workflowAuthority.trustedVerifyCurrent && !exportHasRequiredMappingGap,
            exportBlocked: exportViewModel.status === 'blocked',
          })
        : null,
    [
      activeGuidedLabTask?.id,
      exportHasRequiredMappingGap,
      exportViewModel.status,
      fullAdderLabDesignChecklist,
      fullAdderLabHardwareChecklist,
      fullAdderLabVerifyStatus,
      projectIoRows,
      workflowAuthority.trustedVerifyCurrent,
    ]
  );

  const handleProjectPrimaryAction = useCallback(() => {
    setCurrentMode(
      normalizeIdeMode(primaryProjectCta.mode === 'project' ? 'hardware' : primaryProjectCta.mode)
    );
  }, [primaryProjectCta.mode]);

  const handleVerifyFixPath = useCallback(
    (target: VerifyFailureTarget) => {
      const desiredSignal = normalizeSignalKey(target.signal);
      const mappingTarget = projectIoRows.find((row) => {
        const candidates = [row.label, row.id, row.port];
        return candidates.some((candidate) => normalizeSignalKey(candidate ?? '') === desiredSignal);
      });

      const mappedNode = mappingTarget
        ? exportProject.circuit.nodes.find((node) => node.id === mappingTarget.nodeId)
        : undefined;
      const namedNode = exportProject.circuit.nodes.find(
        (node) => normalizeSignalKey(node.label ?? node.id) === desiredSignal
      );
      const fallbackNode = exportProject.circuit.nodes.find(
        (node) => node.type === 'OUTPUT' || node.type === 'Lamp'
      );
      const targetNode = mappedNode ?? namedNode ?? fallbackNode;

      const targetWire = targetNode
        ? exportProject.circuit.connections.find((connection) => {
            const to = resolveConnectionRef(connection, 'to');
            return to.nodeId === targetNode.id;
          }) ??
          exportProject.circuit.connections.find((connection) => {
            const from = resolveConnectionRef(connection, 'from');
            const to = resolveConnectionRef(connection, 'to');
            return from.nodeId === targetNode.id || to.nodeId === targetNode.id;
          })
        : undefined;

      setCurrentMode('design');
      setDiagnosticRouteRequest((previous) => ({
        mode: 'design',
        diagnosticId: `verify-fix-${desiredSignal}-${target.tick}`,
        requestId: (previous?.requestId ?? 0) + 1,
        nodeId: targetNode?.id,
        wireId: targetWire ? toDesignWireId(targetWire) : undefined,
        portName: mappingTarget?.port ?? target.signal,
        mappingKey: mappingTarget?.id,
        signal: target.signal,
        tick: target.tick,
        panTo: targetNode
          ? {
              x: targetNode.position?.x ?? targetNode.x ?? 0,
              y: targetNode.position?.y ?? targetNode.y ?? 0,
              zoom: 1.25,
            }
          : undefined,
      }));
    },
    [exportProject.circuit.connections, exportProject.circuit.nodes, projectIoRows]
  );

  useEffect(() => {
    if (!diagnosticRouteRequest) return;
    if (diagnosticRouteRequest.mode !== 'design') return;
    if (!diagnosticRouteRequest.nodeId) return;
    if (typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      const viewState = useLogicViewStore.getState();
      viewState.setToolMode('select');
      viewState.selectMultipleNodes([diagnosticRouteRequest.nodeId!], false);
      if (diagnosticRouteRequest.wireId) {
        viewState.selectWire(diagnosticRouteRequest.wireId, true);
      }
      if (diagnosticRouteRequest.panTo) {
        const { x, y, zoom } = diagnosticRouteRequest.panTo;
        const nextZoom = typeof zoom === 'number' ? Math.max(0.6, Math.min(2.4, zoom)) : 1.2;
        viewState.setCamera({
          zoom: nextZoom,
          x: 420 - x * nextZoom,
          y: 240 - y * nextZoom,
        });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [diagnosticRouteRequest]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.redbyteMode = 'ide';
    }
    installFatalCapture({ force: true });
    pushMount('IdeApp: mounted');
    return () => {
      if (typeof document !== 'undefined' && document.documentElement.dataset.redbyteMode === 'ide') {
        delete document.documentElement.dataset.redbyteMode;
      }
    };
  }, []);

  // Force-save on tab/window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (projectIdRef.current && exportProjectRef.current) {
        saveIdeProjectSnapshot({
          projectId: projectIdRef.current,
          projectName: projectNameRef.current,
          projectHash: projectHashRef.current,
          project: exportProjectRef.current,
          scenarios: scenariosRef.current,
          activeScenarioId: activeScenarioIdRef.current,
        });
      }
      if (sessionMetaRef.current) {
        saveLabSessionMeta(sessionMetaRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty: refs provide current values

  return (
    <BoardSignalProvider>
    <div
      className="ide-root"
      data-testid="ide-root"
      data-redbyte-mode="ide"
      data-ide-stage={activeMode}
    >
      {autosaveAvailable && projectKind === 'home' && !hasCircuit && (
        <div className="ide-autosave-banner" data-testid="ide-autosave-banner">
          <span><strong>Restore previous session?</strong> A circuit from your last session is available. Restore it or start fresh.</span>
          <button onClick={handleRestoreAutosave}>Restore</button>
          <button onClick={() => { setAutosaveAvailable(false); localStorage.removeItem('rb-autosave-circuit'); }}>Dismiss</button>
        </div>
      )}
      <IdeTopBar
        projectName={projectName}
        projectId={projectId}
        boardTarget={fpgaConfig.board}
        saveState={saveState}
        currentMode={activeMode}
        buildIdentity={buildIdentity}
        onSave={handleSaveProject}
        onSaveAs={handleSaveAsProject}
        onLoad={handleOpenLoadModal}
        onResetToExample={handleResetToExample}
        onRunVerify={() => setCurrentMode('verify')}
        onExport={() => setCurrentMode('export')}
        onImport={() => setCurrentMode('import')}
        onRenameProject={handleRenameProject}
        onHelp={() => setShowShortcuts(true)}
      />

      <IdeStageNav
        currentMode={activeMode}
        onModeChange={setCurrentMode}
        stepsCompleted={{ project: hasCircuit, ...workflowAuthority.stageCompletion }}
        stepsBlocked={{
          design: Boolean(blockingDesignIssue),
          verify: !hasCircuit || Boolean(blockingDesignIssue),
          hardware: !hasCircuit || Boolean(blockingDesignIssue),
          export: !workflowAuthority.exportAvailable,
        }}
      />

      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

      <div className="ide-layout-shell">
        <div className="ide-surface-column">
        {activeMode === 'project' ? (
          <ErrorBoundary fallbackTitle="Project workspace encountered an error">
            <ProjectSurface
              projectName={projectName}
              description={projectDescription}
              determinismHash={determinismHash}
              lastSavedAt={lastSavedAt}
              topModuleName={effectiveTopEntityName}
              readiness={effectiveReadiness}
              health={projectHealth}
              mappingRows={projectIoRows}
              simRunning={runtimeSim.running}
              runtimeSim={runtimeSim}
              examples={IDE_EXAMPLES.map((example) => ({
                id: example.id,
                name: example.name,
                summary: example.summary,
                expectedBehavior: example.expectedBehavior,
                tags: example.tags,
                course: example.course,
                lab: example.lab,
                concept: example.concept,
                learningPath: example.learningPath,
              }))}
              projectKind={projectKind}
              sourceExampleId={sourceExampleId}
              scenarioAuthority={scenarioAuthority}
              activeExampleId={activeExampleId}
              onOpenExample={handleOpenExample}
              primaryCtaLabel={primaryProjectCta.label}
              primaryCta={primaryProjectCta}
              workflowAuthority={workflowAuthority}
              onPrimaryCta={handleProjectPrimaryAction}
              onUpdateMappingPin={handleMappingPinChange}
              onAutoSuggestMapping={handleAutoSuggestMapping}
              onOpenDesign={() => setCurrentMode('design')}
              onOpenVerify={() => setCurrentMode('verify')}
              onOpenExport={() => setCurrentMode('export')}
              onOpenHardware={() => setCurrentMode('hardware')}
              onOpenImport={() => setCurrentMode('import')}
              guidedLabTask={activeGuidedLabTask ?? FULL_ADDER_SCRATCH_LAB}
              onStartGuidedLab={handleStartGuidedLab}
              onStartBlankProject={() => {
                replaceWithBlankProject();
                setFpgaConfig(buildIdeFpgaConfig({ name: 'Untitled Project' }));
                if (projectKind === 'import') {
                  clearImportRecoveryUrlState();
                }
                setVectorsAreAutoGenerated(false);
                setCurrentMode('design');
              }}
              recentProjects={savedProjects.slice(0, 3)}
              onOpenSavedProjects={handleOpenLoadModal}
              onOpenRecentProject={handleOpenRecentProject}
              diagnosticRouteRequest={diagnosticRouteRequest}
              onGoToHardware={() => setCurrentMode('hardware')}
              studentName={studentName}
              onStudentNameChange={setStudentName}
              hasVerifyRun={verifyLastRun !== undefined}
              fpgaConfig={fpgaConfig}
              importFidelity={importFidelity}
              outline={projectOutline}
              circuit={circuit}
              onFocusMacro={(macroId, macroName) => {
                setDesignFocusRequest(
                  createDesignFocusRequest('macro', macroId, macroName)
                );
                setCurrentMode('design');
              }}
              onFocusCustomComponent={(componentName) => {
                setDesignFocusRequest(
                  createDesignFocusRequest(
                    'custom-component',
                    componentName,
                    componentName
                  )
                );
                setCurrentMode('design');
              }}
              ioSignalRolesByLabel={liveSignalRoles}
              onFpgaConfigChange={handleFpgaConfigChange}
              onSaveNow={() => {
                if (!exportProjectRef.current) return;
                const snap = saveIdeProjectSnapshot({
                  projectId,
                  projectName,
                  projectHash,
                  project: exportProjectRef.current,
                  scenarios,
                  activeScenarioId,
                });
                if (snap) {
                  setSavedProjectHash(snap.projectHash);
                  setSavedProjects(listIdeProjectSnapshots());
                  setLastSavedAt(`Saved ${new Date(snap.savedAtIso).toLocaleTimeString()}`);
                }
                if (sessionMetaRef.current) saveLabSessionMeta(sessionMetaRef.current);
              }}
              onRestoreLastSave={() => {
                if (!window.confirm('Restore the last saved project? Unsaved changes will be lost.')) return;
                const snap = loadIdeProjectSnapshot(projectId);
                if (!snap) { window.alert('No saved session found.'); return; }
                const proj = decodePersistedIdeProject(snap);
                if (!proj) { window.alert('Saved session could not be decoded.'); return; }
                isRestoringRef.current = true;
                handleSafeLoadIntoIde(proj, {
                  sourceLabel: 'last saved project',
                  savedProjectHash: snap.projectHash,
                  nextMode: 'project',
                  backupCurrent: true,
                  testbenchSnapshot: {
                    scenarios: snap.scenarios,
                    activeScenarioId: snap.activeScenarioId,
                  },
                });
                isRestoringRef.current = false;
              }}
              saveState={saveState}
              onRenameProject={handleRenameProject}
              onResetProject={() => {
                if (!window.confirm('Reset to the default example? All unsaved work will be lost.')) return;
                const backup = createRecoveryBackup();
                clearLabSessionMeta();
                resetToActiveExample();
                setFpgaConfig(buildIdeFpgaConfig({ name: activeExample?.name ?? projectNameRef.current }));
                setImportMeta(null);
                setCurrentMode('project');
                setSavedProjectHash(null);
                if (backup.name) {
                  setLastSavedAt(`Reset to example. Previous work backed up as "${backup.name}".`);
                } else if (backup.failed) {
                  setLastSavedAt('Reset to example. Previous work could not be backed up.');
                } else {
                  setLastSavedAt('Reset to example');
                }
                refreshSavedProjects();
              }}
            />
          </ErrorBoundary>
        ) : activeMode === 'design' ? (
          <ErrorBoundary fallbackTitle="Design workspace encountered an error">
            <Suspense
              fallback={<IdeSurfaceLoadingFallback mode="design" />}
            >
            <ThrowOnce surface="design" />
            <DesignSurface
              onCircuitMutated={handleDesignMutation}
              onRuntimeAddNode={addDesignNode}
              onRuntimeAddIo={addDesignIo}
              onRuntimeAddBoardIo={addDesignBoardIo}
              onRuntimeConnect={connectDesignNodes}
              onRuntimeUndo={undoProjectEdit}
              onRuntimeRedo={redoProjectEdit}
              runtimeUndoDepth={designUndoDepth}
              runtimeRedoDepth={designRedoDepth}
              compilerStatus={designCompilerStatus}
              onDiagnosticAction={handleDiagnosticAction}
              diagnosticRouteRequest={diagnosticRouteRequest}
              runtimeSim={runtimeSim}
              onRuntimeSimRun={runRuntimeSim}
              onRuntimeSimPause={pauseRuntimeSim}
              onRuntimeSimStep={stepRuntimeSim}
              onRuntimeSimReset={resetRuntimeSim}
              onRuntimeSimSetSpeed={setRuntimeSimSpeed}
              onRuntimeSimSetInput={setRuntimeSimInput}
              onRuntimeSimSetSelectedSignal={setRuntimeSimSelectedSignal}
              onRuntimeSimToggleProbe={toggleRuntimeSimProbe}
              viewportSeed={`${projectId}:${guidedLabViewportToken}`}
              starterContext={activeStarterContext ?? undefined}
              ioRows={projectIoRows}
              onGoToHardware={() => setCurrentMode('hardware')}
              onGoToImport={() => setCurrentMode('import')}
              onGoToProject={() => setCurrentMode('project')}
              onGoToVerify={() => setCurrentMode('verify')}
              onClearDiagnostic={() => setDiagnosticRouteRequest(null)}
              designFocusRequest={designFocusRequest}
              onClearDesignFocus={() => setDesignFocusRequest(null)}
              topEntityName={effectiveTopEntityName}
              onSaveAsComponent={addCustomComponent}
              customComponentTypes={customComponents.map((c) => ({ type: c.name, title: c.name, description: c.description ?? '' }))}
              customComponentDefs={customComponents}
              macros={macros}
              onSaveMacro={saveMacro}
              onDeleteMacro={deleteMacro}
              onInstantiateMacro={instantiateMacro}
              externalDebugSignals={debugState?.signals ?? null}
              externalDebugTick={debugState?.tick ?? null}
              externalDebugContext={debugState?.context ?? null}
              replaySession={verifyLastRun ?? null}
              onClearExternalDebug={handleClearDebugState}
              onClearVerifyFocus={() => {
                setVerifySelectedSignal(null);
                setVerifySelectedTick(null);
              }}
              onPrevDebugTick={handlePrevDebugTick}
              onNextDebugTick={handleNextDebugTick}
              onSelectDebugTickIndex={handleSelectDebugTickIndex}
              debugTickIndex={debugTickIndex ?? undefined}
              debugTickCount={verifyLastRun?.waveform.length}
              activeVerifySignal={verifySelectedSignal}
              timingGuidance={liveTimingGuidance}
              guidedLabTask={activeGuidedLabTask}
              guidedLabDesignChecklist={fullAdderLabDesignChecklist}
              onAddGuidedLabInput={handleAddFullAdderLabSignal}
              onAddGuidedLabOutput={handleAddFullAdderLabSignal}
              onAddGuidedLabFullAdder={handleAddFullAdderLabBlock}
            />
            </Suspense>
          </ErrorBoundary>
        ) : activeMode === 'verify' ? (
          <ErrorBoundary fallbackTitle="Verify workspace encountered an error">
            <Suspense
              fallback={<IdeSurfaceLoadingFallback mode="verify" />}
            >
            <VerifySurface
              circuitGraph={circuit}
              deterministicHash={currentVerifyReplayHash}
              projectName={projectName}
              board={fpgaConfig?.board ?? 'Basys3'}
              hasVectors={hasVectors}
              vectors={authoritativeProjectVectors}
              lastRun={verifyLastRun}
              designBlockingIssue={blockingDesignIssue ?? undefined}
              mappingComplete={verifyMappingComplete}
              unmappedOutputLabels={unmappedOutputLabels}
              hasFloatingOutputWarning={verifyHasFloatingOutputWarning}
              probeSignals={runtimeSim.probes}
              mappedInputs={verifyInputSignals}
              mappedSignals={verifySignals}
              onVectorsChange={handleVectorsChange}
              onGenerateBasicVectors={handleGenerateVerifyBasics}
              onRunVerification={handleRunVerification}
              onClearVerification={handleClearVerification}
              onOpenProjectVectors={() => setCurrentMode('project')}
              onFixPath={handleVerifyFixPath}
              example={activeExample ?? null}
              onGoToDesign={() => setCurrentMode('design')}
              onGoToDesignWithInputs={(inputs) => {
                setCurrentMode('design');
                const resolved = resolveVerifyInputNodeIds(inputs, verifySignals);
                Object.entries(resolved).forEach(([nodeId, value]) => {
                  setRuntimeSimInput(nodeId, value);
                });
              }}
              onGoToHardware={() => setCurrentMode('hardware')}
              onGoToImport={() => setCurrentMode('import')}
              onGoToExport={() => setCurrentMode('export')}
              verifyMode={verifyMode}
              vectorsAreAutoGenerated={vectorsAreAutoGenerated}
              onPreviewVector={(inputs) => {
                const resolved = resolveVerifyInputNodeIds(inputs as Record<string, 0 | 1>, verifySignals);
                Object.entries(resolved).forEach(([nodeId, value]) => {
                  setRuntimeSimInput(nodeId, value as 0 | 1);
                });
              }}
              onDebugTickSelected={handleDebugTickSelected}
              onSignalSelected={setVerifySelectedSignal}
              selectedTickOverride={verifySelectedTick}
              onSelectedTickChange={setVerifySelectedTick}
              liveSignalRoles={liveSignalRoles}
              liveScheduleContract={liveScheduleContract}
              timingGuidance={liveTimingGuidance}
              unsupportedFeedbackDiagnostic={
                verifyUnsupportedFeedbackDiagnostic
              }
              onDeleteVector={(tickStr) => {
                const tick = Number(tickStr);
                let removed = false;
                setVectors(authoritativeProjectVectors.filter((v) => {
                  if (!removed && v.tick === tick) { removed = true; return false; }
                  return true;
                }));
              }}
              customVectors={customVectors}
              onCustomVectorsChange={setCustomVectors}
              scenarios={scenarios}
              activeScenarioId={activeScenario?.id ?? null}
              activeScenario={activeScenario}
              onCreateScenario={createVerifyScenario}
              onDuplicateScenario={duplicateVerifyScenario}
              onRenameScenario={renameVerifyScenario}
              onDeleteScenario={deleteVerifyScenario}
              onSwitchScenario={switchVerifyScenario}
              onUpdateScenarioSequentialPolicy={updateVerifyScenarioSequentialPolicy}
              onAppendScenarioStep={appendVerifyScenarioStep}
              onUpdateScenarioStep={updateVerifyScenarioStep}
              onMoveScenarioStep={moveVerifyScenarioStep}
              onDeleteScenarioStep={deleteVerifyScenarioStep}
              projectKind={projectKind}
              sourceExampleId={sourceExampleId}
              scenarioAuthority={scenarioAuthority}
              guidedLabTask={activeGuidedLabTask}
              guidedLabDesignChecklist={fullAdderLabDesignChecklist}
              onCreateGuidedLabTruthTable={handleCreateFullAdderTruthTable}
            />
            </Suspense>
          </ErrorBoundary>
        ) : activeMode === 'hardware' ? (
          <ErrorBoundary fallbackTitle="Map Pins workspace encountered an error">
            <Suspense
              fallback={<IdeSurfaceLoadingFallback mode="hardware" />}
            >
            <HardwareSurface
              projectName={projectName}
              expectedBehavior={hardwareExpectedBehavior}
              mappingRows={projectIoRows}
              mappingProjection={exportViewModel.mappingProjection}
              missingRequiredPortsFromExport={exportRequiredMappingGapCount}
              expectedIoRows={hardwareExpectedIoRows}
              vectorsCount={authoritativeProjectVectors.length}
              health={projectHealth}
              workflowAuthority={workflowAuthority}
              runtimeSim={runtimeSim}
              onSimSetInput={setRuntimeSimInput}
              onGenerateBringUpVectors={handleGenerateBringUpVectors}
              onOpenExport={() => setCurrentMode('export')}
              onOpenVerify={() => setCurrentMode('verify')}
              onGoToDesign={() => setCurrentMode('design')}
              onGoToProject={() => setCurrentMode('project')}
              onSetMappingPin={handleMappingPinChange}
              hardwareMappingV2={hardwareMappingV2}
              onApplyHardwareMappingEdit={handleApplyHardwareMappingEdit}
              signalRoles={liveSignalRoles}
              timingGuidance={liveTimingGuidance}
              verifyLastRun={verifyLastRun}
              activeScenario={activeScenario ?? undefined}
              scenarios={scenarios}
              exportBlockingDiagnostics={exportViewModel.errors}
              exportViewStatus={exportViewModel.status}
              designTopEntityName={exportViewModel.topAuthority.designTop}
              topLevelVhdlText={exportProject.hdl?.sources?.find((s) => s.language === 'vhdl')?.text}
              onRepairExportDiagnostic={(diagnostic) => handleDiagnosticAction(diagnostic.canonical)}
              guidedLabTask={activeGuidedLabTask}
              guidedLabHardwareChecklist={fullAdderLabHardwareChecklist}
              onApplyGuidedLabMapping={handleApplyFullAdderSuggestedMapping}
            />
            </Suspense>
          </ErrorBoundary>
        ) : activeMode === 'export' ? (
          <ErrorBoundary fallbackTitle="Export workspace encountered an error">
            <Suspense
              fallback={<IdeSurfaceLoadingFallback mode="export" />}
            >
            <ExportSurface
              project={exportProject}
              verifyResult={projectHealthCore.lastVerify}
              verifyLastRun={verifyLastRun}
              lastExport={projectHealthCore.lastExport}
              designBlockingIssue={blockingDesignIssue ?? undefined}
              designReady={workflowAuthority.designReady}
              workflowAuthority={workflowAuthority}
              activeScenario={activeScenario ?? undefined}
              dirtySinceVerify={projectHealthCore.dirtySinceVerify}
              determinismHash={determinismHash}
              onExportResult={handleExportResult}
              onDiagnosticAction={handleDiagnosticAction}
              onOpenVerify={() => setCurrentMode('verify')}
              example={activeExample ?? null}
              onGoToHardware={() => setCurrentMode('hardware')}
              onGoToProject={() => setCurrentMode('project')}
              onGoToDesign={() => setCurrentMode('design')}
              onUpdateMappingPin={handleMappingPinChange}
              timingGuidance={liveTimingGuidance}
              guidedLabTask={activeGuidedLabTask}
              guidedLabExportSummary={fullAdderLabExportSummary}
            />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary fallbackTitle="Import workspace encountered an error">
            <Suspense
              fallback={<IdeSurfaceLoadingFallback mode="import" />}
            >
            <ImportSurface
              onImportProject={handleImportProject}
              onImportCommitted={handleImportCommitted}
              projectIoRows={projectIoRows}
              onApplySuggestions={handleApplySuggestions}
              onGoToProject={() => setCurrentMode('project')}
              onGoToDesign={() => setCurrentMode('design')}
              onGoToVerify={() => setCurrentMode('verify')}
              onGoToExport={() => setCurrentMode('export')}
              activeGuidedLabTask={activeGuidedLabTask ?? FULL_ADDER_SCRATCH_LAB}
            />
            </Suspense>
          </ErrorBoundary>
        )}
        </div>
      </div>

      <input
        ref={importFileInputRef}
        type="file"
        accept=".rbproj,.rbproj.json,.json,application/json"
        hidden
        onChange={(event) => {
          void handleProjectFileSelected(event);
        }}
        data-testid="ide-project-file-input"
      />

      {loadModalOpen ? (
        <IdeModal
          title="Open Existing Project"
          body={
            <div className="ide-load-project-modal" data-testid="ide-load-project-modal">
              {savedProjects.length > 0 ? (
                <div className="ide-load-project-list" data-testid="ide-load-project-list">
                  {savedProjects.map((entry) => (
                    <button
                      key={entry.projectId}
                      type="button"
                      className="ide-load-project-row"
                      onClick={() => handleLoadSavedProject(entry)}
                      data-testid={`ide-load-project-${entry.projectId}`}
                    >
                      <span>{entry.projectName}</span>
                      <span className="ide-status-mono">{entry.projectHash.slice(0, 10)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ide-copy">No local saved projects found yet.</p>
              )}
              <p className="ide-copy">
                You can also open a <code>.rbproj.json</code> file from disk.
              </p>
            </div>
          }
          actions={
            <>
              <IdeButton tone="ghost" onClick={handleCloseLoadModal} testId="ide-load-close">
                Close
              </IdeButton>
              <IdeButton tone="secondary" onClick={handleOpenProjectFile} testId="ide-load-file">
                Open .rbproj File
              </IdeButton>
            </>
          }
          onClose={handleCloseLoadModal}
          testId="ide-load-modal"
        />
      ) : null}

      {pendingExample ? (
        <IdeModal
          title="Replace current workspace with example?"
          body={
            <p className="ide-copy">
              Opening <strong>{pendingExample.name}</strong> replaces the current workspace state.
              Continue only if you want to discard unsaved progress.
            </p>
          }
          actions={
            <>
              <IdeButton tone="ghost" onClick={handleCancelExampleReplace} testId="ide-example-cancel">
                Keep current project
              </IdeButton>
              <IdeButton tone="danger" onClick={handleConfirmExampleReplace} testId="ide-example-confirm">
                Replace with example
              </IdeButton>
            </>
          }
          onClose={handleCancelExampleReplace}
          testId="ide-example-confirm-modal"
        />
      ) : null}
    </div>
    </BoardSignalProvider>
  );
};

function resolveInitialIdeMode(): IdeMode {
  if (typeof window === 'undefined') return 'project';
  return resolveInitialIdeModeFromSearch(window.location.search);
}

interface ModeUrlSyncOptions {
  replace?: boolean;
}

function syncActiveModeIntoUrl(activeMode: IdeMode, options: ModeUrlSyncOptions = {}): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const currentMode = params.get('mode');
  const requestedMode = resolveRequestedIdeMode(window.location.search);
  if (requestedMode === activeMode) return;
  if (!currentMode && activeMode === 'project') return;

  params.set('mode', activeMode);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  const historyState =
    window.history.state && typeof window.history.state === 'object'
      ? { ...window.history.state, rbIdeMode: activeMode }
      : { rbIdeMode: activeMode };
  const shouldReplace = Boolean(options.replace || (currentMode && !requestedMode));
  if (shouldReplace) {
    window.history.replaceState(historyState, '', nextUrl);
    return;
  }
  window.history.pushState(historyState, '', nextUrl);
}

function clearImportRecoveryUrlState(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('importActive') && !params.has('importSource')) return;
  params.delete('importActive');
  params.delete('importSource');
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

function normalizeSignalKey(value: string): string {
  return value.trim().toLowerCase().replace(/\[[^\]]+\]/g, '');
}

function normalizeProjectCircuit(circuit: RBProject['circuit']): RBProject['circuit'] {
  return {
    nodes: circuit.nodes.map((node) => {
      const x = node.position?.x ?? node.x ?? 0;
      const y = node.position?.y ?? node.y ?? 0;
      return {
        ...node,
        position: node.position ?? { x, y },
        x,
        y,
        config: node.config ?? {},
        state: node.state ?? {},
      };
    }),
    connections: circuit.connections.map((connection) => ({ ...connection })),
  };
}

function buildTopEntityName(projectName: string): string {
  const normalized = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = normalized.length > 0 ? normalized : 'redbyte_top';
  return /^[a-z]/.test(base) ? base : `rb_${base}`;
}

function normalizeTopEntityName(value: string | undefined, fallbackTopEntity: string): string {
  const fallback = fallbackTopEntity.trim().length > 0 ? fallbackTopEntity : 'redbyte_top';
  const normalized = (value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return fallback;
  return /^[A-Za-z_]/.test(normalized) ? normalized : `rb_${normalized}`;
}

function normalizeFpgaPart(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_FPGA_PART;
}

function findFullAdderLabSignal(label: string): GuidedLabSignal | null {
  const normalized = normalizeSignalKey(label);
  return (
    [...FULL_ADDER_SCRATCH_LAB.inputs, ...FULL_ADDER_SCRATCH_LAB.outputs].find(
      (signal) => normalizeSignalKey(signal.label) === normalized
    ) ?? null
  );
}

function addGuidedLabBoundaryNode(circuit: Circuit, signal: GuidedLabSignal): Circuit {
  const normalizedLabel = normalizeSignalKey(signal.label);
  const alreadyExists = circuit.nodes.some(
    (node) =>
      normalizeSignalKey(node.label ?? node.id) === normalizedLabel &&
      (signal.direction === 'in' ? node.type === 'INPUT' : node.type === 'OUTPUT')
  );
  if (alreadyExists) return circuit;

  const inputIndex = FULL_ADDER_SCRATCH_LAB.inputs.findIndex((entry) => entry.label === signal.label);
  const outputIndex = FULL_ADDER_SCRATCH_LAB.outputs.findIndex((entry) => entry.label === signal.label);
  const position =
    signal.direction === 'in'
      ? { x: 80, y: 80 + Math.max(0, inputIndex) * 36 }
      : { x: 464, y: 98 + Math.max(0, outputIndex) * 36 };
  const nodeId = nextGuidedLabNodeId(circuit, `lab_${signal.label}`);

  return {
    nodes: [
      ...circuit.nodes,
      {
        id: nodeId,
        type: signal.direction === 'in' ? 'INPUT' : 'OUTPUT',
        label: signal.label,
        position,
        x: position.x,
        y: position.y,
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [...circuit.connections],
  };
}

function nextGuidedLabNodeId(circuit: Circuit, label: string): string {
  const base = label.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'lab_node';
  const existing = new Set(circuit.nodes.map((node) => node.id));
  if (!existing.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

function buildIdeFpgaConfig(project: Partial<Pick<RBProject, 'name' | 'hdl' | 'fpga'>>): IdeFpgaConfig {
  const projectName = (project.name ?? '').trim();
  const fallbackTop = buildTopEntityName(projectName);
  return {
    board: 'basys3',
    top: normalizeTopEntityName(project.hdl?.top ?? project.fpga?.top, fallbackTop),
    part: normalizeFpgaPart(project.fpga?.part),
  };
}


function buildConstraintText(
  ioRows: Array<{
    label: string;
    direction: 'in' | 'out';
    pin: string;
    id: string;
    port?: string;
  }>
): string {
  const clockRow = ioRows.find(
    (row) => row.direction === 'in' && resolveBasys3SignalBinding(row)?.role === 'clock'
  );

  if (!clockRow) {
    return '# Clock constraint pending: map the design clock to the Basys3 board clock CLK100MHZ / W5.';
  }

  const clockSignal = createSignalName(getStudentFacingIoLabel(clockRow, clockRow.id), 'clk');
  return `create_clock -name sys_clk -period 10.000 [get_ports ${clockSignal}]`;
}

function createSignalName(raw: string, fallback: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return fallback;
  return /^[a-z]/.test(normalized) ? normalized : `sig_${normalized}`;
}

function extractExpectedIoRows(
  artifacts: ReturnType<typeof buildExportViewModel>['artifacts']
): Array<{ signal: string; tick: number; expected: string }> {
  const expectedIo = artifacts.find((artifact) => artifact.path === 'EXPECTED_IO.json');
  if (!expectedIo || expectedIo.content.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(expectedIo.content) as {
      signals?: Array<{
        signal?: string;
        values?: Array<{ tick?: number; expected?: string | number }>;
      }>;
    };
    const rows: Array<{ signal: string; tick: number; expected: string }> = [];
    for (const signalRow of parsed.signals ?? []) {
      const signal = (signalRow.signal ?? '').trim();
      if (signal.length === 0) continue;
      for (const value of signalRow.values ?? []) {
        if (!Number.isFinite(value.tick)) continue;
        rows.push({
          signal,
          tick: Math.max(0, Math.floor(Number(value.tick))),
          expected: String(value.expected ?? '0'),
        });
      }
    }
    return rows
      .sort((left, right) => {
        if (left.tick !== right.tick) return left.tick - right.tick;
        return left.signal.localeCompare(right.signal);
      })
      .slice(0, 40);
  } catch {
    return [];
  }
}

/**
 * Derive whether the current circuit contains clocked/sequential macros.
 *
 * Circuit graph is checked FIRST so that a sequential design is identified
 * immediately — before (and independent of) any prior verify run.
 * The run schedule is a fallback for HDL-import paths where the circuit graph
 * may not carry DFF nodes directly.
 */
export function deriveHasDff(
  circuit: Circuit,
  verifyLastRunSchedule: string | undefined
): boolean {
  return (
    analyzeSequentialLogic(circuit).hasClockedMacros ||
    verifyLastRunSchedule === 'clocked_macro'
  );
}

export { buildCurrentVerifyProjectHash };

export function buildCurrentVerifyReplayHash(input: {
  circuit: Circuit;
  projectVectors: TestVector[];
  customVectors?: TestVector[];
  projectIoRows: ProjectIoRow[];
}): string {
  return digestValue(
    stableSerialize({
      circuit: input.circuit,
      stimulusHash: computeVectorStimulusHash([
        ...input.projectVectors,
        ...(input.customVectors ?? []),
      ].map((vector) => ({
        tick: vector.tick,
        inputs: canonicalizeVerifyReplayInputs(vector.inputs ?? {}, input.projectIoRows),
      }))),
      mapping: toProjectIoMapping(input.projectIoRows),
    })
  );
}

function canonicalizeVerifyReplayInputs(
  inputs: Record<string, boolean | number>,
  projectIoRows: ProjectIoRow[]
): Record<string, boolean | number> {
  const inputAliasMap = buildVerifyReplayInputAliasMap(projectIoRows);
  return Object.fromEntries(
    Object.entries(inputs)
      .map(([key, value]) => [inputAliasMap.get(normalizeVerifyReplayKey(key)) ?? key, value])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function buildVerifyReplayInputAliasMap(projectIoRows: ProjectIoRow[]): Map<string, string> {
  const aliasMap = new Map<string, string>();
  for (const row of projectIoRows) {
    if (row.direction !== 'in') continue;
    const aliases = [row.id, row.label, row.nodeId ?? '', `${row.nodeId ?? ''}.${row.port ?? ''}`];
    for (const alias of aliases) {
      const normalized = normalizeVerifyReplayKey(alias);
      if (!normalized) continue;
      aliasMap.set(normalized, row.id);
    }
  }
  return aliasMap;
}

function normalizeVerifyReplayKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function formatSavedAtLabel(savedAtIso: string): string {
  const normalized = savedAtIso.trim();
  if (!normalized) return 'recently';
  return normalized.replace('T', ' ').replace('.000Z', 'Z');
}

function createSaveAsProjectId(
  projectName: string,
  currentProjectId: string,
  existingProjects: PersistedIdeProjectIndexEntry[]
): string {
  const usedIds = new Set(existingProjects.map((entry) => entry.projectId));
  const baseSeed = normalizeProjectIdSeed(projectName);
  let candidate = `${baseSeed}-copy`;
  let suffix = 2;
  while (candidate === currentProjectId || usedIds.has(candidate)) {
    candidate = `${baseSeed}-copy-${String(suffix).padStart(2, '0')}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeProjectIdSeed(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? `rb-${normalized}` : 'rb-project';
}

export default IdeApp;
