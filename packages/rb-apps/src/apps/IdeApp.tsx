// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// IdeApp - IDE-first shell surface with deterministic mode markers.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { installFatalCapture, pushMount } from '@redbyte/rb-utils';
import { decodeRBProject, type RBProject } from '../export/projectFormat';
import { useCircuitStore } from '../stores/circuitStore';
import { digestValue } from '../utils/digest';
import './ide/ide-root.css';
import { IdeLeftRail, type IdeMode } from './ide/components/IdeLeftRail';
import { IdeTopBar } from './ide/components/IdeTopBar';
import { IdeStatusBar } from './ide/components/IdeStatusBar';
import { IdeButton, IdeModal } from './ide/components/IdePrimitives';
import { ProjectSurface } from './ide/surfaces/ProjectSurface';
import { DesignSurface, type DesignCompilerStatus } from './ide/surfaces/DesignSurface';
import { VerifySurface, type VerifyFailureTarget } from './ide/surfaces/VerifySurface';
import { HardwareSurface } from './ide/surfaces/HardwareSurface';
import { ExportSurface } from './ide/surfaces/ExportSurface';
import { ImportSurface } from './ide/surfaces/ImportSurface';
import { PipelineStrip } from './ide/components/PipelineStrip';
import { buildExportViewModel } from './ide/viewmodels/buildExportViewModel';
import {
  choosePrimaryDiagnosticAction,
  type IdeDiagnostic,
  type IdeDiagnosticRouteRequest,
} from './ide/diagnostics';
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
import { useProjectRuntime } from './ide/projectRuntime';
import {
  decodePersistedIdeProject,
  listIdeProjectSnapshots,
  loadIdeProjectSnapshot,
  saveIdeProjectSnapshot,
  type PersistedIdeProjectIndexEntry,
} from './ide/projectPersistence';
import { BoardSignalProvider } from './ide/BoardSignalContext';

export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IdeMode>(() => resolveInitialIdeMode());
  const [pendingExampleId, setPendingExampleId] = useState<string | null>(null);
  const [diagnosticRouteRequest, setDiagnosticRouteRequest] = useState<IdeDiagnosticRouteRequest | null>(null);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<PersistedIdeProjectIndexEntry[]>([]);
  const [savedProjectHash, setSavedProjectHash] = useState<string | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const projectId = useProjectRuntime((state) => state.projectId);
  const projectName = useProjectRuntime((state) => state.projectName);
  const projectDescription = useProjectRuntime((state) => state.projectDescription);
  const lastSavedAt = useProjectRuntime((state) => state.lastSavedAt);
  const activeExampleId = useProjectRuntime((state) => state.activeExampleId);
  const projectIoRows = useProjectRuntime((state) => state.projectIoRows);
  const projectVectors = useProjectRuntime((state) => state.projectVectors);
  const circuit = useProjectRuntime((state) => state.circuit);
  const verifyLastRun = useProjectRuntime((state) => state.verifyLastRun);
  const runtimeSim = useProjectRuntime((state) => state.sim);
  const projectHealthCore = useProjectRuntime((state) => state.projectHealthCore);
  const loadExample = useProjectRuntime((state) => state.loadExample);
  const loadFromProject = useProjectRuntime((state) => state.loadFromProject);
  const setMappingPin = useProjectRuntime((state) => state.setMappingPin);
  const autoSuggestMapping = useProjectRuntime((state) => state.autoSuggestMapping);
  const setVectors = useProjectRuntime((state) => state.setVectors);
  const generateBringUpVectors = useProjectRuntime((state) => state.generateBringUpVectors);
  const markDesignMutated = useProjectRuntime((state) => state.markDesignMutated);
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
  const setRuntimeSimSelectedSignal = useProjectRuntime(
    (state) => state.actions.sim.setSelectedSignal
  );
  const toggleRuntimeSimProbe = useProjectRuntime((state) => state.actions.sim.toggleProbe);
  const recordExport = useProjectRuntime((state) => state.recordExport);
  const setProjectIdentity = useProjectRuntime((state) => state.setProjectIdentity);
  const setLastSavedAt = useProjectRuntime((state) => state.setLastSavedAt);
  const resetToActiveExample = useProjectRuntime((state) => state.resetToActiveExample);
  const hasCircuit = circuit.nodes.length > 0;
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
  const latestVerifyPass = projectHealthCore.lastVerify?.status === 'pass';

  const readiness = useMemo(
    () => ({
      hasCircuit,
      hasIoMapping,
      hasVectors,
      verifyPass: latestVerifyPass,
      missingRequiredCount,
    }),
    [hasCircuit, hasIoMapping, hasVectors, latestVerifyPass, missingRequiredCount]
  );

  const projectHealth = useMemo(
    () =>
      deriveProjectHealth(projectHealthCore, {
        hasCircuit: readiness.hasCircuit,
        hasIoMapping: readiness.hasIoMapping,
        hasVectors: readiness.hasVectors,
      }),
    [projectHealthCore, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors]
  );

  const primaryProjectCta = useMemo(
    () =>
      choosePrimaryProjectCta(projectHealth, {
        hasCircuit: readiness.hasCircuit,
        hasIoMapping: readiness.hasIoMapping,
        hasVectors: readiness.hasVectors,
      }),
    [projectHealth, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors]
  );

  const pendingExample = useMemo(
    () => (pendingExampleId ? getIdeExampleById(pendingExampleId) : undefined),
    [pendingExampleId]
  );
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

  const runtimeCircuitFingerprint = useMemo(() => digestValue(circuit), [circuit]);
  useEffect(() => {
    const store = useCircuitStore.getState();
    const storeFingerprint = digestValue(store.circuit);
    if (storeFingerprint === runtimeCircuitFingerprint) return;
    store.reset();
    store.updateCircuit(circuit, { skipHistory: true, enforceLimits: true });
  }, [circuit, runtimeCircuitFingerprint]);

  const applyExample = useCallback(
    (exampleId: string) => {
      loadExample(exampleId);
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
  const handleGenerateBringUpVectors = useCallback(() => {
    generateBringUpVectors();
    setCurrentMode('hardware');
  }, [generateBringUpVectors]);

  const handleProjectPrimaryAction = useCallback(() => {
    setCurrentMode(primaryProjectCta.mode);
  }, [primaryProjectCta.mode]);

  const handleVectorsChange = useCallback(
    (vectors: typeof projectVectors) => {
      setVectors(vectors);
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
      runRuntimeVerification(input);
    },
    [runRuntimeVerification]
  );

  const handleClearVerification = useCallback(() => {
    clearRuntimeVerification();
  }, [clearRuntimeVerification]);

  const handleDesignMutation = useCallback(() => {
    markDesignMutated(useCircuitStore.getState().circuit);
  }, [markDesignMutated]);

  const refreshSavedProjects = useCallback(() => {
    setSavedProjects(listIdeProjectSnapshots());
  }, []);

  const handleImportProject = useCallback(
    (project: RBProject) => {
      loadFromProject(project);
      setSavedProjectHash(null);
      refreshSavedProjects();
      setCurrentMode('project');
    },
    [loadFromProject, refreshSavedProjects]
  );

  const topEntityName = useMemo(() => buildTopEntityName(projectName), [projectName]);
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
  const hdlText = useMemo(
    () => buildVhdlFromMapping(topEntityName, projectIoRows),
    [projectIoRows, topEntityName]
  );
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
        top: topEntityName,
        sources: [
          {
            path: 'top.vhd',
            language: 'vhdl',
            text: hdlText,
          },
        ],
      },
      fpga: {
        board: 'basys3',
        top: topEntityName,
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
      meta: {
        appSurface: 'ide-export',
        projectId,
      },
    }),
    [
      circuit,
      hdlText,
      projectDescription,
      projectId,
      projectIoRows,
      projectName,
      projectVectors,
      topEntityName,
      xdcText,
    ]
  );
  const projectHash = useMemo(() => digestValue(exportProject), [exportProject]);
  const determinismHash = projectHash;
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
      if (!snapshot) return;
      const project = decodePersistedIdeProject(snapshot);
      if (!project) return;
      loadFromProject(project);
      setSavedProjectHash(snapshot.projectHash);
      setLastSavedAt(`Loaded ${entry.projectName}`);
      refreshSavedProjects();
      setLoadModalOpen(false);
    },
    [loadFromProject, refreshSavedProjects, setLastSavedAt]
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
        loadFromProject(parsed);
        setSavedProjectHash(null);
        setLastSavedAt(`Loaded file ${file.name}`);
        refreshSavedProjects();
        setLoadModalOpen(false);
      } catch {
        setLastSavedAt(`Load failed for ${file.name}`);
      }
    },
    [loadFromProject, refreshSavedProjects, setLastSavedAt]
  );

  const handleResetToExample = useCallback(() => {
    resetToActiveExample();
    setSavedProjectHash(null);
    setLoadModalOpen(false);
    setLastSavedAt('Reset to active example');
    refreshSavedProjects();
  }, [refreshSavedProjects, resetToActiveExample, setLastSavedAt]);

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

  const exportViewModel = useMemo(
    () => buildExportViewModel(exportProject, verifyLastRun),
    [exportProject, verifyLastRun]
  );
  const hardwareExpectedIoRows = useMemo(
    () => extractExpectedIoRows(exportViewModel.artifacts),
    [exportViewModel.artifacts]
  );
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

  const designCompilerStatus = useMemo<DesignCompilerStatus>(
    () => ({
      dirtySinceVerify: projectHealthCore.dirtySinceVerify,
      dirtySinceExport: projectHealthCore.dirtySinceExport,
      errorCount: exportViewModel.diagnostics.filter((entry) => entry.severity === 'error').length,
      warningCount: exportViewModel.diagnostics.filter((entry) => entry.severity === 'warn').length,
      diagnostics: exportViewModel.diagnostics,
    }),
    [exportViewModel.diagnostics, projectHealthCore.dirtySinceExport, projectHealthCore.dirtySinceVerify]
  );

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
    console.log('RB_IDE_APP_BOOT');
    return () => {
      if (typeof document !== 'undefined' && document.documentElement.dataset.redbyteMode === 'ide') {
        delete document.documentElement.dataset.redbyteMode;
      }
    };
  }, []);

  return (
    <BoardSignalProvider>
    <div className="ide-root" data-testid="ide-root" data-redbyte-mode="ide">
      <div className="ide-backdrop-gradient" aria-hidden="true" />

      <IdeTopBar
        projectName={projectName}
        projectId={projectId}
        saveState={saveState}
        onSave={handleSaveProject}
        onSaveAs={handleSaveAsProject}
        onLoad={handleOpenLoadModal}
        onResetToExample={handleResetToExample}
        onRunVerify={() => setCurrentMode('verify')}
        onExport={() => setCurrentMode('export')}
        onHelp={() => setCurrentMode('project')}
      />

      <div className="ide-layout-shell">
        <IdeLeftRail currentMode={currentMode} onModeChange={setCurrentMode} />
        <div className="ide-surface-column">
          <PipelineStrip
            currentMode={currentMode as ProjectHealthMode}
            health={projectHealth}
            primaryCta={primaryProjectCta}
            onNavigate={(mode) => setCurrentMode(mode as IdeMode)}
          />
        {currentMode === 'project' ? (
          <ProjectSurface
            projectName={projectName}
            description={projectDescription}
            determinismHash={determinismHash}
            lastSavedAt={lastSavedAt}
            topModuleName={topEntityName}
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
            diagnosticRouteRequest={diagnosticRouteRequest}
            onGoToHardware={() => setCurrentMode('hardware')}
          />
        ) : currentMode === 'design' ? (
          <DesignSurface
            onOpenPalette={() => null}
            onCircuitMutated={handleDesignMutation}
            onRuntimeAddNode={addDesignNode}
            onRuntimeAddIo={addDesignIo}
            onRuntimeAddBoardIo={addDesignBoardIo}
            onRuntimeConnect={connectDesignNodes}
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
            viewportSeed={`${activeExampleId ?? 'custom'}:${lastSavedAt}`}
            ioRows={projectIoRows}
            onGoToHardware={() => setCurrentMode('hardware')}
          />
        ) : currentMode === 'verify' ? (
          <VerifySurface
            deterministicHash={determinismHash}
            hasVectors={projectVectors.length > 0}
            vectors={projectVectors}
            lastRun={verifyLastRun}
            mappedInputs={verifyMappedInputs}
            mappedSignals={mappedIoSignals}
            onVectorsChange={handleVectorsChange}
            onRunVerification={handleRunVerification}
            onClearVerification={handleClearVerification}
            onOpenProjectVectors={() => setCurrentMode('project')}
            onFixPath={handleVerifyFixPath}
            example={activeExample ?? null}
            onGoToDesign={() => setCurrentMode('design')}
          />
        ) : currentMode === 'hardware' ? (
          <HardwareSurface
            projectName={projectName}
            expectedBehavior={hardwareExpectedBehavior}
            mappingRows={projectIoRows}
            expectedIoRows={hardwareExpectedIoRows}
            vectorsCount={projectVectors.length}
            health={projectHealth}
            runtimeSim={runtimeSim}
            onSimSetInput={setRuntimeSimInput}
            onGenerateBringUpVectors={handleGenerateBringUpVectors}
            onOpenExport={() => setCurrentMode('export')}
            onOpenVerify={() => setCurrentMode('verify')}
            onGoToDesign={() => setCurrentMode('design')}
          />
        ) : currentMode === 'export' ? (
          <ExportSurface
            project={exportProject}
            verifyResult={projectHealthCore.lastVerify}
            verifyLastRun={verifyLastRun}
            dirtySinceVerify={projectHealthCore.dirtySinceVerify}
            determinismHash={determinismHash}
            onExportResult={handleExportResult}
            onDiagnosticAction={handleDiagnosticAction}
            onOpenVerify={() => setCurrentMode('verify')}
          />
        ) : (
          <ImportSurface onImportProject={handleImportProject} />
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
          title="Load Saved Project"
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
                You can also load a <code>.rbproj.json</code> file from disk.
              </p>
            </div>
          }
          actions={
            <>
              <IdeButton tone="ghost" onClick={handleCloseLoadModal} testId="ide-load-close">
                Close
              </IdeButton>
              <IdeButton tone="secondary" onClick={handleOpenProjectFile} testId="ide-load-file">
                Load File
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

      <IdeStatusBar mode={currentMode} determinismHash={determinismHash} gateStatus="warn" />
    </div>
    </BoardSignalProvider>
  );
};

function resolveInitialIdeMode(): IdeMode {
  if (typeof window === 'undefined') return 'project';
  const requestedMode = new URLSearchParams(window.location.search).get('mode')?.trim().toLowerCase();
  switch (requestedMode) {
    case 'project':
    case 'design':
    case 'verify':
    case 'hardware':
    case 'export':
    case 'import':
      return requestedMode;
    default:
      return 'project';
  }
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

function buildVhdlFromMapping(topName: string, ioRows: Array<{ label: string; id: string; direction: 'in' | 'out' }>): string {
  const inputRows = ioRows.filter((row) => row.direction === 'in');
  const outputRows = ioRows.filter((row) => row.direction === 'out');

  const inputSignals = inputRows.map((row, index) => createSignalName(row.label || row.id, `in_${index}`));
  const outputSignals = outputRows.map((row, index) => createSignalName(row.label || row.id, `out_${index}`));

  const portLines: string[] = [];
  for (let index = 0; index < inputSignals.length; index++) {
    portLines.push(`    ${inputSignals[index]} : in  std_logic;`);
  }
  for (let index = 0; index < outputSignals.length; index++) {
    const suffix = index === outputSignals.length - 1 ? '' : ';';
    portLines.push(`    ${outputSignals[index]} : out std_logic${suffix}`);
  }

  const sourceSignal = inputSignals[0] ?? "'0'";
  const assignmentLines =
    outputSignals.length > 0
      ? outputSignals.map((signal) => `  ${signal} <= ${sourceSignal};`)
      : ['  -- No output ports declared yet.'];

  return [
    'library IEEE;',
    'use IEEE.STD_LOGIC_1164.ALL;',
    '',
    `entity ${topName} is`,
    '  port (',
    ...(portLines.length > 0
      ? portLines
      : ['    placeholder_in : in std_logic;', '    placeholder_out : out std_logic']),
    '  );',
    `end ${topName};`,
    '',
    `architecture rtl of ${topName} is`,
    'begin',
    ...assignmentLines,
    'end rtl;',
  ].join('\n');
}

function buildConstraintText(ioRows: Array<{ label: string; direction: 'in' | 'out'; pin: string; id: string }>): string {
  const clockRow = ioRows.find(
    (row) =>
      row.direction === 'in' &&
      /(^clk$|clock|clk100mhz)/i.test(row.label) &&
      row.pin.trim().length > 0
  );

  if (!clockRow) {
    return '# Clock constraint pending: map a clock-like input (clk/clock/clk100mhz) to CLK100MHZ.';
  }

  const clockSignal = createSignalName(clockRow.label || clockRow.id, 'clk');
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
