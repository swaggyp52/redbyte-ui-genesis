// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// IdeApp - IDE-first shell surface with deterministic mode markers.

import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { analyzeSequentialLogic, type Circuit } from '@redbyte/rb-logic-core';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { installFatalCapture, pushMount } from '@redbyte/rb-utils';
import type { TestVector } from '@redbyte/rb-utils';
import { decodeRBProject, type RBProject } from '../export/projectFormat';
import { digestValue } from '../utils/digest';
import { stableSerialize } from '../utils/stableSerialize';
import './ide/ide-root.css';
import { projectRuntimeCircuitToEditorStore } from './ide/circuitProjection';
import { deriveDesignCompilerDiagnostics } from './ide/designCompilerDiagnostics';
import { IdeLeftRail, type IdeMode } from './ide/components/IdeLeftRail';
import { IdeTopBar } from './ide/components/IdeTopBar';
import { IdeStatusBar } from './ide/components/IdeStatusBar';
import { IdeButton, IdeModal } from './ide/components/IdePrimitives';
import { ProjectSurface } from './ide/surfaces/ProjectSurface';
import type { DesignCompilerStatus } from './ide/surfaces/DesignSurface';
import type { VerifyFailureTarget } from './ide/surfaces/VerifySurface';
import { PipelineStrip } from './ide/components/PipelineStrip';
import { KeyboardShortcutsModal } from './ide/components/KeyboardShortcutsModal';
import { OnboardingOverlay } from './ide/components/OnboardingOverlay';
import { resolveIdeBuildIdentity } from './ide/buildIdentity';
import {
  resolveInitialIdeModeFromSearch,
  resolveRequestedIdeMode,
  resolveRestoredIdeMode,
} from './ide/startupMode';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThrowOnce } from '../components/ThrowOnce';
import { buildExportViewModel } from './ide/viewmodels/buildExportViewModel';
import {
  choosePrimaryDiagnosticAction,
  type IdeDiagnostic,
  type IdeDiagnosticRouteRequest,
} from './ide/diagnostics';
import type { VerifyDebugContext } from './ide/verifyDebug';
import { getStudentFacingIoLabel } from './ide/ioLabels';
import {
  IDE_EXAMPLES,
  getIdeExampleById,
} from './ide/examplesCatalog';
import {
  choosePrimaryProjectCta,
  deriveProjectHealth,
  type ProjectHealthExportResult,
  type ProjectHealthMode,
} from './ide/projectHealth';
import { deriveIoSignalRoles } from './ide/ioSignalRoles';
import { useProjectRuntime, type ProjectIoRow, type VerifyRunLedgerEntry } from './ide/projectRuntime';
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
import { netlistFromCircuit } from '../export/netlistExport';
import { vhdlFromNetlist } from '../export/vhdlExport';
import { buildVhdlTopLevelBindings } from '../fpga/boards/basys3/basys3Bundle';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';

const DesignSurface = React.lazy(() =>
  import('./ide/surfaces/DesignSurface').then((module) => ({ default: module.DesignSurface }))
);

const VerifySurface = React.lazy(() =>
  import('./ide/surfaces/VerifySurface').then((module) => ({ default: module.VerifySurface }))
);

const HardwareSurface = React.lazy(() =>
  import('./ide/surfaces/HardwareSurface').then((module) => ({ default: module.HardwareSurface }))
);

const ExportSurface = React.lazy(() =>
  import('./ide/surfaces/ExportSurface').then((module) => ({ default: module.ExportSurface }))
);

const ImportSurface = React.lazy(() =>
  import('./ide/surfaces/ImportSurface').then((module) => ({ default: module.ImportSurface }))
);

const DEFAULT_FPGA_PART = 'xc7a35tcpg236-1';

type IdeImportFidelity = 'full' | 'reconstructed' | 'partial';

interface IdeFpgaConfig {
  board: 'basys3';
  top: string;
  part: string;
}

interface IdeImportCommitMeta {
  fidelity: IdeImportFidelity;
  importMode: 'manifest' | 'reconstructed';
  reconstructionLevel: 'full' | 'ports-only' | 'empty';
  sourceName: string;
}

export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IdeMode>(() => resolveInitialIdeMode());
  const [pendingExampleId, setPendingExampleId] = useState<string | null>(null);
  const [diagnosticRouteRequest, setDiagnosticRouteRequest] = useState<IdeDiagnosticRouteRequest | null>(null);
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
  const sessionMetaRef = useRef<LabSessionMeta | null>(null);
  const exportProjectRef = useRef<typeof exportProject | null>(null);
  const pendingImportMetaRef = useRef<IdeImportCommitMeta | null>(null);
  const projectIdRef = useRef('');
  const projectNameRef = useRef('');
  const projectHashRef = useRef('');
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [vectorsAreAutoGenerated, setVectorsAreAutoGenerated] = useState(false);

  // Dev/test only — causes the named surface to throw once on mount
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const param = new URLSearchParams(window.location.search).get('__rb_throw');
    if (param) (window as any).__RB_THROW_SURFACE__ = param;
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
  const [importFidelity, setImportFidelity] = useState<IdeImportFidelity | null>(null);
  const lastSavedAt = useProjectRuntime((state) => state.lastSavedAt);
  const activeExampleId = useProjectRuntime((state) => state.activeExampleId);
  const projectIoRows = useProjectRuntime((state) => state.projectIoRows);
  const projectVectors = useProjectRuntime((state) => state.projectVectors);
  const circuit = useProjectRuntime((state) => state.circuit);
  const verifyLastRun = useProjectRuntime((state) => state.verifyLastRun);
  const verifyRunHistory = useProjectRuntime((state) => state.verifyRunHistory);
  const runtimeSim = useProjectRuntime((state) => state.sim);
  const projectHealthCore = useProjectRuntime((state) => state.projectHealthCore);
  const macros = useProjectRuntime((state) => state.macros);
  const loadExample = useProjectRuntime((state) => state.loadExample);
  const loadFromProject = useProjectRuntime((state) => state.loadFromProject);
  const setMappingPin = useProjectRuntime((state) => state.setMappingPin);
  const autoSuggestMapping = useProjectRuntime((state) => state.autoSuggestMapping);
  const setVectors = useProjectRuntime((state) => state.setVectors);
  const customVectors = useProjectRuntime((state) => state.customVectors);
  const setCustomVectors = useProjectRuntime((state) => state.setCustomVectors);
  const generateBringUpVectors = useProjectRuntime((state) => state.generateBringUpVectors);
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
  const setLastSavedAt = useProjectRuntime((state) => state.setLastSavedAt);
  const resetToActiveExample = useProjectRuntime((state) => state.resetToActiveExample);
  const customComponents = useProjectRuntime((state) => state.customComponents);
  const addCustomComponent = useProjectRuntime((state) => state.addCustomComponent);
  const saveMacro = useProjectRuntime((state) => state.saveMacro);
  const deleteMacro = useProjectRuntime((state) => state.deleteMacro);
  const instantiateMacro = useProjectRuntime((state) => state.instantiateMacro);
  const hasCircuit = circuit.nodes.length > 0;
  const hasDff = useMemo(
    () => deriveHasDff(circuit, verifyLastRun?.schedule),
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
  const hasVectors = projectVectors.length > 0;
  const latestVerifyPass = projectHealthCore.lastVerify?.status === 'pass' && !projectHealthCore.dirtySinceVerify;

  const readiness = useMemo(
    () => ({
      hasCircuit,
      hasIoMapping,
      hasVectors,
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
      projectHealthCore.lastVerify?.qualification,
      verifyLastRun?.qualification,
    ]
  );

  const projectHealth = useMemo(
    () =>
      deriveProjectHealth(projectHealthCore, {
        hasCircuit: readiness.hasCircuit,
        hasIoMapping: readiness.hasIoMapping,
        hasVectors: readiness.hasVectors,
        verifyQualification: readiness.verifyQualification,
      }),
    [projectHealthCore, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors, readiness.verifyQualification]
  );

  const primaryProjectCta = useMemo(
    () =>
      choosePrimaryProjectCta(projectHealth, {
        hasCircuit: readiness.hasCircuit,
        hasIoMapping: readiness.hasIoMapping,
        hasVectors: readiness.hasVectors,
        verifyQualification: readiness.verifyQualification,
      }),
    [projectHealth, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors, readiness.verifyQualification]
  );
  const statusBarGateStatus = useMemo<'pass' | 'warn' | 'fail'>(() => {
    if (projectHealth.blockingIssues.length > 0) return 'fail';
    if (projectHealthCore.lastVerify?.status === 'fail') return 'warn';
    if (projectHealth.dirtySinceVerify || projectHealth.dirtySinceExport) return 'warn';
    return 'pass';
  }, [
    projectHealth.blockingIssues.length,
    projectHealth.dirtySinceExport,
    projectHealth.dirtySinceVerify,
    projectHealthCore.lastVerify?.status,
  ]);

  const pendingExample = useMemo(
    () => (pendingExampleId ? getIdeExampleById(pendingExampleId) : undefined),
    [pendingExampleId]
  );
  const buildIdentity = useMemo(() => resolveIdeBuildIdentity(), []);
  const activeExample = useMemo(
    () => (activeExampleId ? getIdeExampleById(activeExampleId) : undefined),
    [activeExampleId]
  );
  const hardwareExpectedBehavior = useMemo(() => {
    const fromExample = activeExample?.expectedBehavior?.trim();
    if (fromExample && fromExample.length > 0) return fromExample;
    if (projectVectors.length > 0) {
      return `Run ${projectVectors.length} deterministic bring-up vector${
        projectVectors.length === 1 ? '' : 's'
      } and confirm mapped outputs on Basys3.`;
    }
    return 'Generate bring-up vectors, run verify, then confirm mapped outputs on Basys3.';
  }, [activeExample?.expectedBehavior, projectVectors.length]);

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
      setImportFidelity(null);
      setPendingExampleId(null);
      setCurrentMode('project');
    },
    [loadExample]
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
    generateBringUpVectors();
    setVectorsAreAutoGenerated(true);
  }, [generateBringUpVectors]);

  const handleProjectPrimaryAction = useCallback(() => {
    setCurrentMode(primaryProjectCta.mode);
  }, [primaryProjectCta.mode]);

  const handleVectorsChange = useCallback(
    (vectors: typeof projectVectors) => {
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
    [runRuntimeVerification]
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
    setCurrentMode('design');
  }, [verifyLastRun]);

  const handleClearDebugState = useCallback(() => {
    setDebugState(null);
    setDebugTickIndex(null);
  }, []);

  const handlePrevDebugTick = useCallback(() => {
    if (debugTickIndex == null || !verifyLastRun) return;
    const newIndex = debugTickIndex - 1;
    if (newIndex < 0) return;
    const sample = verifyLastRun.waveform[newIndex];
    if (!sample) return;
    const signals = new Map<string, 0 | 1>(
      Object.entries(sample.signals).map(([k, v]) => [k, v === '1' ? 1 : 0])
    );
    setDebugState({ tick: sample.tick, signals, context: null });
    setDebugTickIndex(newIndex);
  }, [debugTickIndex, verifyLastRun]);

  const handleNextDebugTick = useCallback(() => {
    if (debugTickIndex == null || !verifyLastRun) return;
    const newIndex = debugTickIndex + 1;
    if (newIndex >= verifyLastRun.waveform.length) return;
    const sample = verifyLastRun.waveform[newIndex];
    if (!sample) return;
    const signals = new Map<string, 0 | 1>(
      Object.entries(sample.signals).map(([k, v]) => [k, v === '1' ? 1 : 0])
    );
    setDebugState({ tick: sample.tick, signals, context: null });
    setDebugTickIndex(newIndex);
  }, [debugTickIndex, verifyLastRun]);

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
      projectHash: digestValue(backupProject),
      project: backupProject,
    });

    if (!snapshot) {
      return { name: null as string | null, failed: true };
    }

    return { name: backupName, failed: false };
  }, [hasCircuit, projectId, projectName, savedProjectHash]);

  const handleSafeLoadIntoIde = useCallback(
    (
      project: RBProject,
      options?: {
        sourceLabel?: string;
        savedProjectHash?: string | null;
        closeLoadModal?: boolean;
        nextMode?: IdeMode | null;
        backupCurrent?: boolean;
        importFidelity?: IdeImportFidelity | null;
      }
    ) => {
      const sourceLabel = options?.sourceLabel ?? project.name ?? 'project';
      const backup = options?.backupCurrent === false
        ? { name: null as string | null, failed: false }
        : createRecoveryBackup();

      try {
        loadFromProject(project);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown project error';
        setLastSavedAt(`Could not load ${sourceLabel}: ${reason}`);
        refreshSavedProjects();
        return false;
      }

      setFpgaConfig(buildIdeFpgaConfig(project));
      setImportFidelity(options?.importFidelity ?? null);
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
        setCurrentMode(options.nextMode);
      }
      return true;
    },
    [createRecoveryBackup, loadFromProject, refreshSavedProjects, setLastSavedAt]
  );

  const handleImportCommitted = useCallback((meta: IdeImportCommitMeta) => {
    pendingImportMetaRef.current = meta;
  }, []);

  const handleImportProject = useCallback(
    (project: RBProject) => {
      const importMeta = pendingImportMetaRef.current;
      pendingImportMetaRef.current = null;
      void handleSafeLoadIntoIde(project, {
        sourceLabel: `import "${project.name || 'project'}"`,
        savedProjectHash: null,
        backupCurrent: true,
        importFidelity: importMeta?.fidelity ?? null,
      });
    },
    [handleSafeLoadIntoIde]
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
  const mappedIoSignals = useMemo(
    () =>
      projectIoRows
        .filter((entry) => entry.pin.trim().length > 0)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          pin: entry.pin,
          direction: entry.direction,
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
      ioMapping: {
        inputs: projectIoRows
          .filter((entry) => entry.direction === 'in')
          .map((entry) => ({
            id: entry.id,
            nodeId: entry.nodeId,
            port: entry.port,
            label: entry.label,
            pin: entry.pin,
          })),
        outputs: projectIoRows
          .filter((entry) => entry.direction === 'out')
          .map((entry) => ({
            id: entry.id,
            nodeId: entry.nodeId,
            port: entry.port,
            label: entry.label,
            pin: entry.pin,
          })),
      },
      vectors: projectVectors,
      customComponents: customComponents.length > 0 ? customComponents : undefined,
      macros: macros.length > 0 ? macros : undefined,
      meta: {
        appSurface: 'ide-export',
        projectId,
        ...(studentName.trim() ? { studentName: studentName.trim() } : {}),
      },
    }),
    [
      circuit,
      customComponents,
      hdlText,
      macros,
      projectDescription,
      projectId,
      projectIoRows,
      projectName,
      projectVectors,
      studentName,
      effectiveTopEntityName,
      fpgaConfig.board,
      fpgaConfig.part,
      xdcText,
    ]
  );
  const projectHash = useMemo(() => digestValue(exportProject), [exportProject]);
  const determinismHash = projectHash;
  exportProjectRef.current = exportProject;
  projectIdRef.current = projectId;
  projectNameRef.current = projectName;
  projectHashRef.current = projectHash;
  sessionMetaRef.current = {
    version: 1,
    savedAt: Date.now(),
    projectId,
    currentMode,
    macros: macros.length > 0 ? macros : undefined,
    activeExampleId: activeExampleId ?? null,
    probedKeys: runtimeSim.probes.map((p) => p.key),
  };
  const saveState: 'saved' | 'unsaved' | 'autosaving' = useMemo(() => {
    if (isAutosaving) return 'autosaving';
    return projectHash === savedProjectHash ? 'saved' : 'unsaved';
  }, [isAutosaving, projectHash, savedProjectHash]);
  const hasUnsavedWork = projectHash !== savedProjectHash;

  const handleOpenExample = useCallback(
    (exampleId: string) => {
      if (activeExampleId === exampleId) return;
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
    });
    if (!snapshot) return;
    setSavedProjectHash(snapshot.projectHash);
    setLastSavedAt(`Saved ${formatSavedAtLabel(snapshot.savedAtIso)}`);
    refreshSavedProjects();
  }, [exportProject, projectHash, projectId, projectName, refreshSavedProjects, setLastSavedAt]);

  const handleSaveAsProject = useCallback(() => {
    const nextProjectId = createSaveAsProjectId(projectName, projectId, savedProjects);
    const nextProject: RBProject = {
      ...exportProject,
      meta: {
        ...(exportProject.meta ?? {}),
        projectId: nextProjectId,
      },
    };
    const nextHash = digestValue(nextProject);
    const snapshot = saveIdeProjectSnapshot({
      projectId: nextProjectId,
      projectName,
      projectHash: nextHash,
      project: nextProject,
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
    setImportFidelity(null);
    setSavedProjectHash(null);
    setLoadModalOpen(false);
    setLastSavedAt('Reset to active example');
    refreshSavedProjects();
  }, [activeExample?.name, refreshSavedProjects, resetToActiveExample, setLastSavedAt]);

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
  }, [currentMode, activeExampleId, runtimeSim.probes]);

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
    () => buildExportViewModel(exportProject, verifyLastRun),
    [exportProject, verifyLastRun]
  );
  const hardwareExpectedIoRows = useMemo(
    () => extractExpectedIoRows(exportViewModel.artifacts),
    [exportViewModel.artifacts]
  );

  const liveSignalRoles = useMemo(() => {
    if (!exportProject) return {};
    const scheduleContract = deriveVerifySchedule(
      exportProject.circuit,
      exportProject.ioMapping,
      exportProject.hdl
    );
    return deriveIoSignalRoles(projectIoRows, scheduleContract);
  }, [exportProject, projectIoRows]);
  const handleDiagnosticAction = useCallback((diagnostic: IdeDiagnostic) => {
    const action = choosePrimaryDiagnosticAction(diagnostic);
    if (!action) return;
    setCurrentMode(action.payload.mode as IdeMode);
    setDiagnosticRouteRequest((previous) => ({
      ...action.payload,
      diagnosticId: diagnostic.id,
      requestId: (previous?.requestId ?? 0) + 1,
    }));
  }, []);

  const designDiagnostics = useMemo(
    () => deriveDesignCompilerDiagnostics(exportProject),
    [exportProject]
  );

  const designCompilerStatus = useMemo<DesignCompilerStatus>(
    () => ({
      dirtySinceVerify: projectHealthCore.dirtySinceVerify,
      dirtySinceExport: projectHealthCore.dirtySinceExport,
      errorCount: designDiagnostics.filter((entry) => entry.severity === 'error').length,
      warningCount: designDiagnostics.filter((entry) => entry.severity === 'warn').length,
      diagnostics: designDiagnostics,
    }),
    [designDiagnostics, projectHealthCore.dirtySinceExport, projectHealthCore.dirtySinceVerify]
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
  const currentVerifyProjectHash = useMemo(
    () => buildCurrentVerifyProjectHash({ circuit, projectVectors, projectIoRows }),
    [circuit, projectIoRows, projectVectors]
  );
  const latestVerifyLedgerEntry = verifyRunHistory[verifyRunHistory.length - 1];
  const verifyIsCurrent = useMemo(() => deriveVerifyCurrent({
    hasVerifyRun: Boolean(verifyLastRun),
    latestVerifyLedgerEntry,
    currentVerifyProjectHash,
    dirtySinceVerify: projectHealthCore.dirtySinceVerify,
  }), [
    currentVerifyProjectHash,
    latestVerifyLedgerEntry,
    projectHealthCore.dirtySinceVerify,
    verifyLastRun,
  ]);
  const exportIsCurrent = useMemo(() => deriveExportCurrent({
    lastExport: projectHealthCore.lastExport,
    currentExportHash: exportViewModel.exportHash,
    dirtySinceExport: projectHealthCore.dirtySinceExport,
  }), [
    exportViewModel.exportHash,
    projectHealthCore.dirtySinceExport,
    projectHealthCore.lastExport,
  ]);

  const verifyMappedInputs = useMemo(
    () =>
      projectIoRows
        .filter((entry) => entry.direction === 'in' && entry.pin.trim().length > 0)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          pin: entry.pin,
        })),
    [projectIoRows]
  );

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
            const fromNodeId =
              typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
            const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
            return fromNodeId === targetNode.id || toNodeId === targetNode.id;
          })
        : undefined;

      setCurrentMode('design');
      setDiagnosticRouteRequest((previous) => ({
        mode: 'design',
        diagnosticId: `verify-fix-${desiredSignal}-${target.tick}`,
        requestId: (previous?.requestId ?? 0) + 1,
        nodeId: targetNode?.id,
        wireId: targetWire?.id,
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
    <div className="ide-root" data-testid="ide-root" data-redbyte-mode="ide">
      {autosaveAvailable && !hasCircuit && (
        <div className="ide-autosave-banner" data-testid="ide-autosave-banner">
          <span>You have unsaved work from a previous session.</span>
          <button onClick={handleRestoreAutosave}>Restore</button>
          <button onClick={() => { setAutosaveAvailable(false); localStorage.removeItem('rb-autosave-circuit'); }}>Dismiss</button>
        </div>
      )}
      <IdeTopBar
        projectName={projectName}
        projectId={projectId}
        saveState={saveState}
        currentMode={currentMode}
        buildIdentity={buildIdentity}
        onSave={handleSaveProject}
        onSaveAs={handleSaveAsProject}
        onLoad={handleOpenLoadModal}
        onResetToExample={handleResetToExample}
        onRunVerify={() => setCurrentMode('verify')}
        onExport={() => setCurrentMode('export')}
        onHelp={() => setShowShortcuts(true)}
      />

      <OnboardingOverlay mode={currentMode} />
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

      <div className="ide-layout-shell">
        <IdeLeftRail
          currentMode={currentMode}
          onModeChange={setCurrentMode}
          stepsCompleted={{ design: hasCircuit, verify: Boolean(latestVerifyPass), export: exportIsCurrent }}
        />
        <div className="ide-surface-column">
          <PipelineStrip
            currentMode={currentMode as ProjectHealthMode}
            health={projectHealth}
            primaryCta={primaryProjectCta}
            onNavigate={(mode) => setCurrentMode(mode as IdeMode)}
          />
        {currentMode === 'project' ? (
          <ErrorBoundary fallbackTitle="Project editor crashed">
            <ProjectSurface
              projectName={projectName}
              description={projectDescription}
              determinismHash={determinismHash}
              lastSavedAt={lastSavedAt}
              topModuleName={effectiveTopEntityName}
              readiness={readiness}
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
              }))}
              activeExampleId={activeExampleId}
              onOpenExample={handleOpenExample}
              primaryCtaLabel={primaryProjectCta.label}
              primaryCta={primaryProjectCta}
              onPrimaryCta={handleProjectPrimaryAction}
              onUpdateMappingPin={handleMappingPinChange}
              onAutoSuggestMapping={handleAutoSuggestMapping}
              onOpenDesign={() => setCurrentMode('design')}
              onOpenVerify={() => setCurrentMode('verify')}
              onOpenExport={() => setCurrentMode('export')}
              onOpenHardware={() => setCurrentMode('hardware')}
              onOpenImport={() => setCurrentMode('import')}
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
              onFpgaConfigChange={handleFpgaConfigChange}
              onSaveNow={() => {
                if (!exportProjectRef.current) return;
                const snap = saveIdeProjectSnapshot({
                  projectId,
                  projectName,
                  projectHash,
                  project: exportProjectRef.current,
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
                });
                isRestoringRef.current = false;
              }}
              onResetProject={() => {
                if (!window.confirm('Reset to the default example? All unsaved work will be lost.')) return;
                const backup = createRecoveryBackup();
                clearLabSessionMeta();
                resetToActiveExample();
                setFpgaConfig(buildIdeFpgaConfig({ name: activeExample?.name ?? projectNameRef.current }));
                setImportFidelity(null);
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
        ) : (
          <Suspense
            fallback={
              <div className="ide-copy" data-testid="ide-surface-loading">
                Loading {currentMode} workspace...
              </div>
            }
          >
          {currentMode === 'design' ? (
          <ErrorBoundary fallbackTitle="Design editor crashed">
            <ThrowOnce surface="design" />
            <DesignSurface
              onOpenPalette={() => null}
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
              viewportSeed={`${activeExampleId ?? 'custom'}:${projectId}`}
              ioRows={projectIoRows}
              onGoToHardware={() => setCurrentMode('hardware')}
              onGoToImport={() => setCurrentMode('import')}
              onGoToProject={() => setCurrentMode('project')}
              onGoToVerify={() => setCurrentMode('verify')}
              onClearDiagnostic={() => setDiagnosticRouteRequest(null)}
              topEntityName={effectiveTopEntityName}
              onSaveAsComponent={addCustomComponent}
              customComponentTypes={customComponents.map((c) => ({ type: c.name, title: c.name, description: c.description ?? '' }))}
              macros={macros}
              onSaveMacro={saveMacro}
              onDeleteMacro={deleteMacro}
              onInstantiateMacro={instantiateMacro}
              externalDebugSignals={debugState?.signals ?? null}
              externalDebugTick={debugState?.tick ?? null}
              externalDebugContext={debugState?.context ?? null}
              onClearExternalDebug={handleClearDebugState}
              onPrevDebugTick={handlePrevDebugTick}
              onNextDebugTick={handleNextDebugTick}
              debugTickIndex={debugTickIndex ?? undefined}
              debugTickCount={verifyLastRun?.waveform.length}
              activeVerifySignal={verifySelectedSignal}
            />
          </ErrorBoundary>
        ) : currentMode === 'verify' ? (
          <ErrorBoundary fallbackTitle="Verification crashed">
            <VerifySurface
              deterministicHash={determinismHash}
              hasVectors={projectVectors.length > 0}
              vectors={projectVectors}
              lastRun={verifyLastRun}
              mappingComplete={verifyMappingComplete}
              unmappedOutputLabels={unmappedOutputLabels}
              hasFloatingOutputWarning={verifyHasFloatingOutputWarning}
              probeSignals={runtimeSim.probes}
              mappedInputs={verifyMappedInputs}
              mappedSignals={mappedIoSignals}
              onVectorsChange={handleVectorsChange}
              onGenerateBasicVectors={handleGenerateVerifyBasics}
              onRunVerification={handleRunVerification}
              onClearVerification={handleClearVerification}
              onOpenProjectVectors={() => setCurrentMode('project')}
              onFixPath={handleVerifyFixPath}
              example={activeExample ?? null}
              onGoToDesign={() => setCurrentMode('design')}
              onGoToHardware={() => setCurrentMode('hardware')}
              hasDff={hasDff}
              vectorsAreAutoGenerated={vectorsAreAutoGenerated}
              onPreviewVector={(inputs) => {
                Object.entries(inputs).forEach(([signalId, value]) => {
                  setRuntimeSimInput(signalId, value as 0 | 1);
                });
              }}
              onDebugTickSelected={handleDebugTickSelected}
              onSignalSelected={setVerifySelectedSignal}
              onDeleteVector={(tickStr) => {
                const tick = Number(tickStr);
                let removed = false;
                setVectors(projectVectors.filter((v) => {
                  if (!removed && v.tick === tick) { removed = true; return false; }
                  return true;
                }));
              }}
              customVectors={customVectors}
              onCustomVectorsChange={setCustomVectors}
            />
          </ErrorBoundary>
        ) : currentMode === 'hardware' ? (
          <ErrorBoundary fallbackTitle="Hardware surface crashed">
            <HardwareSurface
              projectName={projectName}
              expectedBehavior={hardwareExpectedBehavior}
              mappingRows={projectIoRows}
              expectedIoRows={hardwareExpectedIoRows}
              vectorsCount={projectVectors.length}
              health={projectHealth}
              verifyCurrent={verifyIsCurrent}
              exportCurrent={exportIsCurrent}
              runtimeSim={runtimeSim}
              onSimSetInput={setRuntimeSimInput}
              onGenerateBringUpVectors={handleGenerateBringUpVectors}
              onOpenExport={() => setCurrentMode('export')}
              onOpenVerify={() => setCurrentMode('verify')}
              onGoToDesign={() => setCurrentMode('design')}
              onSetMappingPin={handleMappingPinChange}
              signalRoles={liveSignalRoles}
              verifyLastRun={verifyLastRun}
            />
          </ErrorBoundary>
        ) : currentMode === 'export' ? (
          <ErrorBoundary fallbackTitle="Export surface crashed">
            <ExportSurface
              project={exportProject}
              verifyResult={projectHealthCore.lastVerify}
              verifyLastRun={verifyLastRun}
              designReady={readiness.hasCircuit && readiness.hasIoMapping}
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
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary fallbackTitle="Import surface crashed">
            <ImportSurface
              onImportProject={handleImportProject}
              onImportCommitted={handleImportCommitted}
              projectIoRows={projectIoRows}
              onApplySuggestions={handleApplySuggestions}
              onGoToProject={() => setCurrentMode('project')}
              onGoToVerify={() => setCurrentMode('verify')}
              onGoToExport={() => setCurrentMode('export')}
            />
          </ErrorBoundary>
        )}
          </Suspense>
        )}
        </div>
      </div>

      <input
        ref={importFileInputRef}
        type="file"
        accept=".rbproj,.rbproj.json,.json,application/json"
        className="ide-hidden-file-input"
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

      <IdeStatusBar mode={currentMode} determinismHash={determinismHash} gateStatus={statusBarGateStatus} />
    </div>
    </BoardSignalProvider>
  );
};

function resolveInitialIdeMode(): IdeMode {
  if (typeof window === 'undefined') return 'project';
  return resolveInitialIdeModeFromSearch(window.location.search);
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
    (row) =>
      row.direction === 'in' &&
      /(^clk$|clock|clk100mhz)/i.test(getStudentFacingIoLabel(row, row.id)) &&
      row.pin.trim().length > 0
  );

  if (!clockRow) {
    return '# Clock constraint pending: map a clock-like input (clk/clock/clk100mhz) to CLK100MHZ.';
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

function toProjectIoMapping(projectIoRows: ProjectIoRow[]): {
  inputs: Array<{ id: string; nodeId: string; port: string; label: string; pin: string }>;
  outputs: Array<{ id: string; nodeId: string; port: string; label: string; pin: string }>;
} {
  return {
    inputs: projectIoRows
      .filter((row) => row.direction === 'in')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? '',
        port: row.port ?? '',
        label: row.label,
        pin: row.pin,
      })),
    outputs: projectIoRows
      .filter((row) => row.direction === 'out')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? '',
        port: row.port ?? '',
        label: row.label,
        pin: row.pin,
      })),
  };
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

export function buildCurrentVerifyProjectHash(input: {
  circuit: Circuit;
  projectVectors: TestVector[];
  projectIoRows: ProjectIoRow[];
}): string {
  return digestValue(
    stableSerialize({
      circuit: input.circuit,
      vectors: input.projectVectors,
      mapping: toProjectIoMapping(input.projectIoRows),
    })
  );
}

export function deriveVerifyCurrent(input: {
  hasVerifyRun: boolean;
  latestVerifyLedgerEntry?: Pick<VerifyRunLedgerEntry, 'projectHash'> | null;
  currentVerifyProjectHash: string;
  dirtySinceVerify: boolean;
}): boolean {
  if (!input.hasVerifyRun) return false;
  if (input.latestVerifyLedgerEntry) {
    return input.latestVerifyLedgerEntry.projectHash === input.currentVerifyProjectHash;
  }
  return !input.dirtySinceVerify;
}

export function deriveExportCurrent(input: {
  lastExport?: ProjectHealthExportResult;
  currentExportHash?: string | null;
  dirtySinceExport: boolean;
}): boolean {
  if (input.lastExport?.status !== 'ok') return false;
  if (input.lastExport.hash && input.currentExportHash) {
    return input.lastExport.hash === input.currentExportHash;
  }
  return !input.dirtySinceExport;
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
