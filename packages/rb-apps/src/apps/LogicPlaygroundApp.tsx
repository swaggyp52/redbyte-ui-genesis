// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
// v1.0.1 - Multi-view enhancement with null safety

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import type { RedByteApp } from '../types';
import type { LabProjectV1, CircuitV1, RecordingV1 } from '@redbyte/rb-utils';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import {
  CircuitEngine,
  TickEngine,
  serialize,
  deserialize,
  NodeRegistry,
  decodeCircuitAsync,
  encodeCircuitCompressed,
  toCircuitV1,
  fromCircuitV1,
  type Circuit,
  type SerializedCircuitV1,
  type Node,
  type Connection,
} from '@redbyte/rb-logic-core';
import { LogicCanvas } from '@redbyte/rb-logic-view';
import { ViewAdapter } from '@redbyte/rb-logic-adapter';
import { useSettingsStore, useUiTickStore, enableWatchdog, installFatalCapture, pushMount } from '@redbyte/rb-utils';
import { toast, OverlayRoot, OverlayPanel } from '@redbyte/rb-primitives';
import type { ToastKind } from '@redbyte/rb-primitives';
import { useWindowStore } from '@redbyte/rb-windowing';
import { loadExample, listExamples, listExamplesByLayer, getLayerDescription, type ExampleId, type CircuitLayer } from '../examples';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useChipStore } from '../stores/chipStore';
import type { ChipPort } from '../stores/chipStore';
import { useCircuitStore } from '../stores/circuitStore';
import type { FileEntry } from '../apps/files/fsTypes';
import { useTutorialStore } from '../tutorial/tutorialStore';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import { recognizePattern, type RecognizedPattern } from '../patterns/patternMatcher';
import { SaveChipModal } from '../components/SaveChipModal';
import { ChipLibraryModal } from '../components/ChipLibraryModal';
import { OscilloscopeView } from '../components/OscilloscopeView';
import { SchematicView } from '../components/SchematicView';
import { PropertyInspector } from '../components/PropertyInspector';
import { TraceViewer } from '../components/TraceViewer';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { registerAllChips, registerChip, unregisterChip } from '../utils/chipRegistry';
import { useViewStateStore } from '../stores/viewStateStore';
import { digestValue } from '../utils/digest';
import { useProbeStore } from '../stores/probeStore';
import { useLayoutStore, type PerspectiveId, type LearnSubview } from '../stores/layoutStore';
import { useOscilloscopeStore } from '../stores/oscilloscopeStore';
import { setGlobalViewStateSync, useLogicViewStore, findSmartSpawnPosition } from '@redbyte/rb-logic-view';
import { screenToWorld, snapToGrid, fitToBounds } from '@redbyte/rb-viewport';
import { useHierarchyStore } from '../stores/hierarchyStore';
import { buildProbeWireHighlights } from '../utils/probeHighlight';
import { useRunRecorderStore } from '../stores/runRecorderStore';
import { encodeRunRecord, indexStimulusByTick, type RunStimulusEvent, type ProofPack } from '../recording/runRecord';
import { buildProofPack, encodeProofPack } from '../recording/proofPack';
import { applyStimulusEvents } from '../recording/stimulus';
import JSZip from 'jszip';
import { buildSuspectSet } from '../utils/mismatchLocalization';
import { buildDebugOverlayFromSignals } from '../recording/runRecordUtils';
import { restoreReplayState } from '../utils/replayRestore';
import { assertAppOutput, registerAppInvariants } from '../utils/appInvariants';
import { analyzeCircuitHealth } from '../logic/circuitHealth';
import { buildDebugBundle } from '../export/debugBundle';
import { netlistFromCircuit } from '../export/netlistExport';
import {
  createRBProject,
  decodeRBProject,
  encodeRBProject,
  type RBProject,
  type RBFpgaConfig,
} from '../export/projectFormat';
import { stableStringify } from '../export/stableStringify';
import { verilogFromNetlist } from '../export/verilogExport';
import { HierarchyBreadcrumbs } from '../components/HierarchyBreadcrumbs';
import { KeyboardShortcutsHelp } from '../components/KeyboardShortcutsHelp';
import { ComponentPalette } from '../components/ComponentPalette';
import { QuickAddPalette } from '../components/QuickAddPalette';
import { StatusBar } from '../components/StatusBar';
import { TopCommandBar } from '../components/TopCommandBar';
import { GuardrailConfirmModal } from '@redbyte/rb-primitives';
import { RightDock, type RightDockTab } from '../components/RightDock';
import { EnhancedPalette } from '../components/EnhancedPalette';
import { HelpDock } from '../components/HelpDock';
import { coerceToolchainProjectInput, type ToolchainProjectInput } from '../fpga/toolchainBackend';
import { useRenderStormDetector } from '../hooks/useRenderStormDetector';
import { useAutosaveCircuit, useRestoreCircuit, loadSavedCircuit, clearSavedCircuit } from '../utils/ceAutosave';
import {
  getRbprojAutosaveKey,
  getCanonicalProjectAutosaveKey,
  loadRbprojAutosave,
  migrateRbprojAutosaveIfNeeded,
  useRbprojAutosave,
} from '../utils/rbprojAutosave';
import { useUnifiedRecoverySurface } from '../utils/unifiedRecovery';
import { saveSnapshot, loadSnapshot, initSnapshotSystem, clearAllSnapshots, wasLastShutdownClean } from '../utils/snapshotSystem';
import { isCEMode, getCEConfig, isHeavyCircuit } from '../utils/ceMode';
import { ResetWorkspaceModal, ExampleGalleryModal, ExportBundleModal } from '../components/CEUIComponents';
import { ClassroomModeBanner } from '../components/ClassroomModeBanner';
import { RecoveryBanner } from '../components/RecoveryBanner';
import { useClassroomModeStore } from '../stores/classroomModeStore';
import { validateCircuitData } from '../utils/circuitValidation';
import { StartHerePanel } from '../components/StartHerePanel';
import { useEvidenceViewerStore } from '../stores/evidenceViewerStore';


// Placeholder for evidence viewer (feature in development)
// Place appVersion at module scope to avoid ReferenceError in hooks
const appVersion =
  (import.meta as ImportMeta & { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ??
  'dev';

import { EvidenceViewerPanel } from '../components/EvidenceViewerPanel';

const buildDefaultHdlProject = (): ToolchainProjectInput => ({
  sources: [],
});

const buildDefaultFpgaProject = (): RBFpgaConfig => ({
  board: 'basys3',
});

const LOGIC_PLAYGROUND_INVARIANTS = {
  reads: ['circuit_store', 'probe_store', 'file_system', 'examples', 'settings'],
  writes: ['circuit_store', 'probe_store', 'file_system', 'settings.tick_rate', 'layout', 'oscilloscope', 'run_recorder'],
  outputs: [
    'rb-project.json',
    'rbproj.zip',
    'netlist.json',
    'circuit.v',
    'rb-debug-bundle.json',
    'run-record.json',
    'proof-pack.json',
  ],
};

registerAppInvariants('logic-playground', LOGIC_PLAYGROUND_INVARIANTS);

// Primitive node types (built-in gates) organized by category
const PRIMITIVE_NODES = {
  'Basic I/O': ['PowerSource', 'Switch', 'INPUT', 'Lamp', 'OUTPUT', 'Wire'],
  'Logic Gates': ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'],
  'Timing': ['Clock', 'Delay'],
  'Analog': ['VoltageSource', 'LDR', 'FixedResistor', 'VoltageDivider', 'LM358'],
} as const;

// Composite node types (built-in multi-gate circuits)
const COMPOSITE_NODES = [
  'RSLatch',
  'DFlipFlop',
  'JKFlipFlop',
  'FullAdder',
  'Counter4Bit',
] as const;

const EXAMPLE_NOTES: Partial<Record<ExampleId, { title: string; description: string }>> = {
  '11_d-flipflop': {
    title: 'D Flip-Flop Demo',
    description: 'Toggle Data, then run or step the clock to see Q update only on rising edges.',
  },
  '04_4bit-counter': {
    title: '4-bit Counter Demo',
    description: 'Run the clock and watch the lamps count in binary. Slow the tick rate to follow each step.',
  },
};

interface LogicPlaygroundProps {
  windowId?: string;
  initialFileId?: string;
  initialExampleId?: ExampleId;
  resourceId?: string;
  resourceType?: 'file' | 'folder';
  recoveredData?: unknown;
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
  /** Intent: open a specific dock tab on mount (e.g., 'learn', 'info', 'probes') */
  dockTab?: string;
  /** Intent: open a specific learn subview on mount (e.g., 'lessons', 'help', 'manual') */
  dockSubview?: string;
  /** Intent: open examples gallery on mount */
  showExamples?: boolean;
  // Determinism recording (Milestone D - optional, dev-only)
  registerStateAccessor?: (windowId: string, accessor: { getCircuit?: () => any }) => void;
  unregisterStateAccessor?: (windowId: string) => void;
  determinismRecorder?: any; // Type from useDeterminismRecorder hook
}

// Outer gate component: handles feature gates with stable hook set
export const LogicPlaygroundComponent: React.FC<LogicPlaygroundProps> = (props) => {
  useRenderStormDetector('LogicPlaygroundComponent');
  // Gate-only hooks (stable and minimal - ALWAYS called)
  const evidenceBundle = useEvidenceViewerStore((s) => s.evidenceBundle);

  // Debug flags (useMemo is stable)
  const debugFlags = React.useMemo(() => {
    if (!import.meta.env.DEV) return new Set<string>();
    const raw = localStorage.getItem('rb-debug-playground') || '';
    return new Set(
      raw
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    );
  }, []);
  const disablePlaygroundView = debugFlags.has('disable-playground-view');

  // Debug logging (no hooks)
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[playground-debug] flags', Array.from(debugFlags));
  }

  // PHASE 2C: Install fatal capture + mount breadcrumb (no hooks)
  if (import.meta.env.DEV || navigator.webdriver) {
    installFatalCapture();
    pushMount('LogicPlaygroundApp:start');
  }

  // Early returns - SAFE because hook set above is stable
  if (disablePlaygroundView) {
    console.log('[LP_TRACE] Early return: playground view disabled');
    return <div data-testid="playground-debug-disabled">Playground view disabled by debug flag.</div>;
  }

  if (evidenceBundle) {
    console.log('[LP_TRACE] Early return: evidence viewer');
    return <EvidenceViewerPanel />;
  }

  // Render inner component with all the real hooks
  console.log('[LP_TRACE] About to render LogicPlaygroundInner');
  return <LogicPlaygroundInner {...props} debugFlags={debugFlags} />;
};

// Circuit fingerprint for identity checks (prevents feedback loops)
function computeCircuitFingerprint(circuit: Circuit): string {
  // Fast fingerprint: node count + edge count + sorted node/edge metadata
  const nodeData = circuit.nodes
    .map(n => `${n.id}:${n.type}:${n.position?.x ?? n.x ?? 0}:${n.position?.y ?? n.y ?? 0}:${Number.isFinite(n.rotation) ? n.rotation : 0}`)
    .sort()
    .join('|');
  const edgeData = circuit.connections
    .map(c => {
      const fromId = typeof c.from === 'string' ? c.from : c.from?.nodeId ?? '';
      const toId = typeof c.to === 'string' ? c.to : c.to?.nodeId ?? '';
      const fromPort = typeof c.from === 'string' ? (c as any).fromPin ?? (c as any).fromPort : (c.from as any)?.portName ?? (c.from as any)?.port ?? '';
      const toPort = typeof c.to === 'string' ? (c as any).toPin ?? (c as any).toPort : (c.to as any)?.portName ?? (c.to as any)?.port ?? '';
      return `${fromId}:${fromPort}->${toId}:${toPort}`;
    })
    .sort()
    .join('|');
  return digestValue({ nodes: nodeData, edges: edgeData });
}

// Inner component: all hooks live here, only mounted when gates pass
interface LogicPlaygroundInnerProps extends LogicPlaygroundProps {
  debugFlags: Set<string>;
}

const LogicPlaygroundInner: React.FC<LogicPlaygroundInnerProps> = ({
  windowId,
  initialFileId,
  initialExampleId,
  resourceId,
  resourceType,
  recoveredData,
  onOpenApp,
  dockTab,
  dockSubview,
  showExamples,
  registerStateAccessor,
  unregisterStateAccessor,
  determinismRecorder,
  debugFlags,
}) => {
  console.log('[LP_TRACE] LogicPlaygroundInner render start', { windowId, initialFileId, initialExampleId, resourceId, resourceType });
  useRenderStormDetector('LogicPlaygroundInner');
  const disableToolStrip = debugFlags.has('disable-toolstrip');
  const disableRightDock = debugFlags.has('disable-rightdock');

  // HDL editor enablement: env flag (build-time) OR URL param (runtime) OR localStorage debug flag (fallback)
  const enableHdlTab = useMemo(() => {
    const viteEnv = (import.meta as any)?.env ?? {};
    const envFlag =
      viteEnv.VITE_RB_TOOLCHAIN_UI === '1' ||
      viteEnv.RB_TOOLCHAIN_UI === '1' ||
      (typeof process !== 'undefined' ? (process as any)?.env?.RB_TOOLCHAIN_UI === '1' : false);

    const urlFlag = (() => {
      if (typeof window === 'undefined') return false;
      try {
        return new URLSearchParams(window.location.search).get('rb_hdl') === '1';
      } catch {
        return false;
      }
    })();

    const localStorageFlag = (() => {
      if (typeof window === 'undefined') return false;
      try {
        const raw = localStorage.getItem('rb-debug-playground') || '';
        return raw
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
          .includes('hdl-editor');
      } catch {
        return false;
      }
    })();

    return envFlag || urlFlag || localStorageFlag;
  }, []);

  // E2E flags via querystring (test-only)
  const e2eParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const e2eDisableQuad = e2eParams.get('disableQuad') === '1';
  const e2eCpuLite = e2eParams.get('cpuLite') === '1';
  const e2eDisableSplitView =
    e2eParams.get('disableSplitView') === '1' || e2eParams.get('disable3d') === '1';

  const disableSplitView = debugFlags.has('disable-splitview') || e2eDisableSplitView;

  const tickRate = useSettingsStore((state) => state.tickRate);
  type GuardrailConfig = {
    title: string;
    message: string;
    lossItems?: string[];
    confirmLabel?: string;
    confirmTone?: 'danger' | 'warning';
    onConfirm: () => void;
    onExport?: () => void;
  };
  const [guardrail, setGuardrail] = useState<GuardrailConfig | null>(null);
  const closeGuardrail = useCallback(() => setGuardrail(null), []);

  // Circuit state is canonical in circuitStore (RC-P1: eliminate dual source)
  const circuit = useCircuitStore((state) => state.circuit);
  const storeSetEngine = useCircuitStore((state) => state.setEngine);
  const storeSetTickEngine = useCircuitStore((state) => state.setTickEngine);
  const storeCommit = useCircuitStore((state) => state.commit);
  const storeUpdateCircuit = useCircuitStore((state) => state.updateCircuit);

  const setCircuit = useCallback(
    (next: Circuit | ((prev: Circuit) => Circuit), opts?: { skipHistory?: boolean; enforceLimits?: boolean }) => {
      const current = useCircuitStore.getState().circuit;
      const resolved = typeof next === 'function' ? next(current) : next;
      storeUpdateCircuit(resolved, opts);
    },
    [storeUpdateCircuit]
  );

  // Local refs for engine instances
  const [engine, setEngine] = useState<CircuitEngine>(() => new CircuitEngine(circuit));
  const [tickEngine, setTickEngine] = useState<TickEngine>(
    () => new TickEngine(circuit, { tickRate })
  );

  // Sync engine instances to store on creation
  useEffect(() => {
    storeSetEngine(engine);
    storeSetTickEngine(tickEngine);
  }, [engine, tickEngine, storeSetEngine, storeSetTickEngine]);

  const unifiedProject = useUnifiedProjectStore((s) => s.currentProject);
  const createNewProject = useUnifiedProjectStore((s) => s.createNewProject);
  const updateProject = useUnifiedProjectStore((s) => s.updateProject);

  const hasSyncedFromProjectRef = useRef(false);
  const lastRecordingKeyRef = useRef<string | null>(null);

  // Helper for connection normalization (used by app-specific logic)
  const normalizeConnection = useCallback((conn: Connection) => {
    const fromIsString = typeof conn.from === 'string';
    const toIsString = typeof conn.to === 'string';

    const fromNodeId = fromIsString ? conn.from : conn.from.nodeId;
    const toNodeId = toIsString ? conn.to : conn.to.nodeId;

    const fromPin = fromIsString
      ? conn.fromPin ?? conn.fromPort ?? 'out'
      : conn.from.portName ?? conn.from.port ?? conn.fromPin ?? conn.fromPort ?? 'out';

    const toPin = toIsString
      ? conn.toPin ?? conn.toPort ?? 'in'
      : conn.to.portName ?? conn.to.port ?? conn.toPin ?? conn.toPort ?? 'in';

    return { fromNodeId, toNodeId, fromPin, toPin };
  }, []);

  const addToast = useCallback(
    (message: string, kind: ToastKind = 'info', duration?: number) => {
      toast[kind]({ message, duration });
    },
    []
  );
  const tutorialActive = useTutorialStore((state) => state.active);
  const startTutorial = useTutorialStore((state) => state.start);
  const setWindowTitle = useWindowStore((state) => state.setWindowTitle);
  const getAllFiles = useFileSystemStore((state) => state.getAllFiles);
  const getFile = useFileSystemStore((state) => state.getFile);
  const updateFileContent = useFileSystemStore((state) => state.updateFileContent);
  const createFile = useFileSystemStore((state) => state.createFile);
  const saveChipFromPattern = useChipStore((state) => state.saveChipFromPattern);
  const getAllChips = useChipStore((state) => state.getAllChips);
  const getChip = useChipStore((state) => state.getChip);
  const deleteChip = useChipStore((state) => state.deleteChip);
  const hierarchyStack = useHierarchyStore((state) => state.stack);
  const hierarchyCircuit = useHierarchyStore((state) => state.currentCircuit);
  const enterChip = useHierarchyStore((state) => state.enterChip);
  const exitToParent = useHierarchyStore((state) => state.exitToParent);
  const exitToTop = useHierarchyStore((state) => state.exitToTop);
  const setHierarchyCircuit = useHierarchyStore((state) => state.setCurrentCircuit);
  const isEditMode = useHierarchyStore((state) => state.isEditMode);
  const toggleEditMode = useHierarchyStore((state) => state.toggleEditMode);

  const createdProjectRef = useRef(false);
  const buildProjectRef = useRef<(() => RBProject) | null>(null);
  const applyProjectRef = useRef<((project: RBProject) => void) | null>(null);
  const recoveredDataRef = useRef<unknown | null>(null);
  const hasAppliedRecoveryRef = useRef(false);
  const getProjectSnapshot = useCallback(() => {
    const builder = buildProjectRef.current;
    return builder ? builder() : null;
  }, []);

  // Single hydration effect: when project loads/opens, hydrate circuitStore from unifiedProject (RC-P1)
  useEffect(() => {
    console.log('[LP_TRACE] Hydration effect fired', { hasProject: Boolean(unifiedProject), hasSynced: hasSyncedFromProjectRef.current });
    if (!unifiedProject) return;
    if (hasSyncedFromProjectRef.current) return;

    const savedCircuit = loadSavedCircuit();
    const initialCircuit = savedCircuit || { nodes: [], connections: [] };

    if (unifiedProject.circuit.nodes.length > 0 || unifiedProject.circuit.connections.length > 0) {
      // Project has circuit data: load it
      const loadedCircuit = fromCircuitV1(unifiedProject.circuit);
      storeCommit(loadedCircuit);
      setEngine(new CircuitEngine(loadedCircuit));
      setTickEngine(new TickEngine(loadedCircuit, { tickRate }));
    } else if (initialCircuit.nodes.length > 0 || initialCircuit.connections.length > 0) {
      // No project circuit, but CE autosave exists: use it
      storeCommit(initialCircuit);
      setEngine(new CircuitEngine(initialCircuit));
      setTickEngine(new TickEngine(initialCircuit, { tickRate }));
    } else {
      // Empty: initialize engines with empty circuit
      setEngine(new CircuitEngine(initialCircuit));
      setTickEngine(new TickEngine(initialCircuit, { tickRate }));
    }

    hasSyncedFromProjectRef.current = true;
  }, [unifiedProject, tickRate, storeCommit]);

  // Sync circuitStore changes to unifiedProject (one-way from store → project)
  useEffect(() => {
    console.log('[LP_TRACE] updateProject effect fired', { hasProject: Boolean(unifiedProject), hasSynced: hasSyncedFromProjectRef.current });
    if (!unifiedProject) return;
    if (!hasSyncedFromProjectRef.current) return;

    const nextCircuit = toCircuitV1(circuit);
    const currentCircuitKey = stableStringify(unifiedProject.circuit);
    const nextCircuitKey = stableStringify(nextCircuit);
    if (currentCircuitKey === nextCircuitKey) return;

    updateProject((project) => ({
      ...project,
      circuit: nextCircuit,
    }));
  }, [circuit, unifiedProject, updateProject]);

  // Create new project at startup
  useEffect(() => {
    console.log('[LP_TRACE] Create project effect fired', { hasProject: Boolean(unifiedProject), hasCreated: createdProjectRef.current });
    if (!unifiedProject && !createdProjectRef.current) {
      console.log('[LP_TRACE] Creating new project');
      createNewProject('Untitled Project');
      createdProjectRef.current = true;
    }
  }, [unifiedProject, createNewProject]);

  // Debug instrumentation for Playwright gates (RC-P1)
  useEffect(() => {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      window.__RB_DEBUG__ = {
        ...((window as any).__RB_DEBUG__ || {}),
        getCircuit: () => useCircuitStore.getState().circuit,
      };
    }
  }, []);






  // Get stable circuit mutation methods from store (NO closures)
  const storeAddNode = useCircuitStore((state) => state.addNode);
  const storeUpdateNode = useCircuitStore((state) => state.updateNode);



  const examples = useRef(listExamples());

  // Helper to get all .rblogic files
  const getLogicFiles = () => getAllFiles().filter((f) => f.name.endsWith('.rblogic'));

  const [availableFiles, setAvailableFiles] = useState<FileEntry[]>(getLogicFiles);
  const [selectedFileId, setSelectedFileId] = useState<string | ''>(initialFileId ?? '');
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleId | ''>(
    initialExampleId ?? ''
  );


  const [selectedChipId, setSelectedChipId] = useState<string>('');



  const handleAddNode = useCallback((nodeType: string, position?: { x: number; y: number }) => {
    // Always use smart spawn positioning (camera-centered + collision avoidance)
    const viewState = useLogicViewStore.getState();
    const camera = viewState.camera;
    const centerX = -camera.x / camera.zoom;
    const centerY = -camera.y / camera.zoom;

    const pos = position ?? findSmartSpawnPosition(circuit.nodes, { x: centerX, y: centerY });

    storeAddNode(nodeType, pos);
  }, [circuit.nodes, storeAddNode]);



  const splitScreenMode = useLayoutStore((state) => state.splitScreenMode);
  const activeViews = useLayoutStore((state) => state.activeViews);
  const perspective = useLayoutStore((state) => state.perspective);
  const storeSetPerspective = useLayoutStore((state) => state.setPerspective);
  const { safeMode, isComplexityWarning } = useClassroomModeStore();

  const handleSetPerspective = useCallback((p: PerspectiveId) => {
    const shouldBlock = safeMode || isComplexityWarning;
    if (shouldBlock && (p === 'quad' || p === '3d-only' || p === 'explore')) {
      addToast(`Cannot switch to ${p}: Disabled in Safe Mode or High Complexity`, 'warning', 3000);
      return;
    }
    storeSetPerspective(p);
  }, [safeMode, isComplexityWarning, storeSetPerspective, addToast]);

  const setPerspective = handleSetPerspective; // Alias for minimal refactor

  const splitRatio = useLayoutStore((state) => state.splitRatio);
  const setSplitRatio = useLayoutStore((state) => state.setSplitRatio);
  const rightDockState = useLayoutStore((state) => state.rightDockState);
  const rightDockTab = useLayoutStore((state) => state.rightDockTab);
  const showHelpDock = useLayoutStore((state) => state.showHelpDock);
  const helpDockSection = useLayoutStore((state) => state.helpDockSection);
  const schematicMiniEnabled = useLayoutStore((state) => state.schematicMiniEnabled);
  const toggleSchematicMini = useLayoutStore((state) => state.toggleSchematicMini);
  const setRightDockState = useLayoutStore((state) => state.setRightDockState);
  const setRightDockTab = useLayoutStore((state) => state.setRightDockTab);
  const setShowHelpDock = useLayoutStore((state) => state.setShowHelpDock);
  const setHelpDockSection = useLayoutStore((state) => state.setHelpDockSection);

  const applyLayoutSnapshot = useCallback((layout: any) => {
    if (!layout || typeof layout !== 'object') return;
    if (layout.perspective) storeSetPerspective(layout.perspective);
    if (typeof layout.splitRatio === 'number') setSplitRatio(layout.splitRatio);
    if (layout.rightDockState) setRightDockState(layout.rightDockState);
    if (layout.rightDockTab) setRightDockTab(layout.rightDockTab);
    if (typeof layout.showHelpDock === 'boolean') setShowHelpDock(layout.showHelpDock);
    if (layout.helpDockSection) setHelpDockSection(layout.helpDockSection);
    if (typeof layout.schematicMiniEnabled === 'boolean') {
      const currentMini = useLayoutStore.getState().schematicMiniEnabled;
      if (currentMini !== layout.schematicMiniEnabled) {
        useLayoutStore.getState().toggleSchematicMini();
      }
    }
  }, [setHelpDockSection, setRightDockState, setRightDockTab, setShowHelpDock, setSplitRatio, storeSetPerspective]);

  const handleRecoverSnapshot = useCallback(() => {
    const snapshot = loadSnapshot();
    if (!snapshot) {
      return;
    }
    try {
      const payload = snapshot.payload || {};
      const projectRef = payload.projectRef as { kind?: string; projectId?: string } | undefined;
      if (projectRef?.kind === 'rbproj' && typeof projectRef.projectId === 'string') {
        const key = getCanonicalProjectAutosaveKey(projectRef.projectId);
        const saved = loadRbprojAutosave(key);
        if (saved && applyProjectRef.current) {
          const decoded = decodeRBProject(saved.projectJson);
          applyProjectRef.current(decoded);
        }
      } else {
        const projectPayload = payload.project as RBProject | undefined;
        if (projectPayload && applyProjectRef.current) {
          applyProjectRef.current(projectPayload);
        } else {
          if (payload.circuit) {
            useCircuitStore.getState().updateCircuit(payload.circuit as Circuit, { skipHistory: true, enforceLimits: true });
            setCircuit(payload.circuit as Circuit);
            engineRef.current.setCircuit(payload.circuit as Circuit);
          }
          if (payload.layout) {
            applyLayoutSnapshot(payload.layout);
          }
        }
      }
      addToast('Recovered last session snapshot', 'success');
    } catch (error) {
      console.error('[Recovery] Failed to restore snapshot', error);
      addToast('Recovery failed; starting fresh', 'error');
    }
  }, [addToast, applyLayoutSnapshot, setCircuit]);

  const handleStartFresh = useCallback(() => {
    clearAllSnapshots();
  }, []);

  const getLayoutSnapshot = useCallback(() => ({
    perspective,
    splitScreenMode,
    activeViews,
    splitRatio,
    rightDockState,
    rightDockTab,
    showHelpDock,
    helpDockSection,
    schematicMiniEnabled,
  }), [
    perspective,
    splitScreenMode,
    activeViews,
    splitRatio,
    rightDockState,
    rightDockTab,
    showHelpDock,
    helpDockSection,
    schematicMiniEnabled,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initSnapshotSystem(() => ({
      circuit: useCircuitStore.getState().circuit,
      layout: {
        perspective: useLayoutStore.getState().perspective,
        splitScreenMode: useLayoutStore.getState().splitScreenMode,
        activeViews: useLayoutStore.getState().activeViews,
        splitRatio: useLayoutStore.getState().splitRatio,
        rightDockState: useLayoutStore.getState().rightDockState,
        rightDockTab: useLayoutStore.getState().rightDockTab,
        showHelpDock: useLayoutStore.getState().showHelpDock,
        helpDockSection: useLayoutStore.getState().helpDockSection,
        schematicMiniEnabled: useLayoutStore.getState().schematicMiniEnabled,
      },
      flags: { safeMode: useClassroomModeStore.getState().safeMode },
      project: getProjectSnapshot(),
    }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'autosave', false, getProjectSnapshot() ?? undefined);
  }, [
    circuit,
    getLayoutSnapshot,
    safeMode,
  ]);
  const probes = useProbeStore((state) => state.probes);
  const toggleProbeForPort = useProbeStore((state) => state.toggleProbeForPort);
  const highlightProbePaths = useViewStateStore((state) => state.highlightProbePaths);
  const setHighlightProbePaths = useViewStateStore((state) => state.setHighlightProbePaths);
  const oscilloscopePauseScroll = useOscilloscopeStore((state) => state.pauseScroll);
  const oscilloscopeTimeWindowSec = useOscilloscopeStore((state) => state.timeWindowSec);
  const oscilloscopeShowTickGuides = useOscilloscopeStore((state) => state.showTickGuides);
  const recorderMode = useRunRecorderStore((state) => state.mode);
  const record = useRunRecorderStore((state) => state.record);
  const verificationStatus = useRunRecorderStore((state) => state.verificationStatus);
  const recordEvent = useRunRecorderStore((state) => state.recordEvent);
  const replayState = useRunRecorderStore((state) => state.replay);
  const replayPaused = useRunRecorderStore((state) => state.replayPaused);
  const pendingStepTicks = useRunRecorderStore((state) => state.pendingStepTicks);
  const pendingJumpTick = useRunRecorderStore((state) => state.pendingJumpTick);
  const playheadTick = useRunRecorderStore((state) => state.playheadTick);
  const setReplayPaused = useRunRecorderStore((state) => state.setReplayPaused);
  const stepReplay = useRunRecorderStore((state) => state.stepReplay);
  const jumpReplay = useRunRecorderStore((state) => state.jumpReplay);
  const armRunRecorder = useRunRecorderStore((state) => state.arm);
  const startRunRecording = useRunRecorderStore((state) => state.startRecording);
  const stopRunRecording = useRunRecorderStore((state) => state.stopRecording);
  const startRunReplay = useRunRecorderStore((state) => state.startReplay);
  const stopRunReplay = useRunRecorderStore((state) => state.stopReplay);
  const verifyRunReplay = useRunRecorderStore((state) => state.verifyReplay);
  const resetRunRecorder = useRunRecorderStore((state) => state.reset);
  const setDebugOverlay = useRunRecorderStore((state) => state.setDebugOverlay);
  const replayRecord = replayState?.record ?? null;
  const uiTick = useUiTickStore((state) => state.uiTick);
  const isReplayMode = recorderMode === 'replaying';

  // Sync record to unifiedProject (moved here to avoid TDZ - record must be defined first)
  useEffect(() => {
    if (!unifiedProject || !record) return;
    const recordKey = record.createdAt || `record-${record.summary?.tickCount ?? 0}`;
    if (recordKey === lastRecordingKeyRef.current) return;

    const proofPack = buildProofPack(record, circuit, {
      appVersion,
      tickRate: currentHz,
      exampleId: selectedExampleId || undefined,
    });

    const recording: RecordingV1 = {
      id: `rec-${record.createdAt || Date.now()}`,
      createdAt: record.createdAt || new Date().toISOString(),
      tickCount: record.summary?.tickCount ?? 0,
      eventCount: (record.stimulus?.length ?? 0) + (record.trace?.length ?? 0),
      events: [
        { kind: 'runRecord', data: record },
        { kind: 'proofPack', data: proofPack },
      ],
    };

    updateProject((project) => ({
      ...project,
      recordings: [recording],
    }));

    lastRecordingKeyRef.current = recordKey;
  }, [record, unifiedProject, updateProject, circuit, appVersion, tickRate, selectedExampleId]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentHz, setCurrentHz] = useState(tickRate);
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    (window as any).rbTickCount = tickCount;
  }, [tickCount]);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCreatedAt, setProjectCreatedAt] = useState(() => new Date().toISOString());
  const [projectId, setProjectId] = useState(() => crypto.randomUUID?.() ?? `proj-${Date.now()}`);
  const [hdlProject, setHdlProject] = useState<ToolchainProjectInput>(() => buildDefaultHdlProject());
  const [fpgaProject, setFpgaProject] = useState<RBFpgaConfig>(() => buildDefaultFpgaProject());
  const [currentFileId, setCurrentFileId] = useState<string | null>(initialFileId ?? null);
  const [isDirty, setIsDirty] = useState(false);
  const handleHdlProjectChange = useCallback((next: ToolchainProjectInput) => {
    setHdlProject(next);
    setIsDirty(true);
  }, [setHdlProject, setIsDirty]);
  const handleFpgaProjectChange = useCallback((next: RBFpgaConfig) => {
    setFpgaProject(next);
    setIsDirty(true);
  }, [setFpgaProject, setIsDirty]);

  const legacyRbprojAutosaveKey = useMemo(
    () => getRbprojAutosaveKey('logic-playground', windowId),
    [windowId],
  );
  const rbprojAutosaveKey = useMemo(() => getCanonicalProjectAutosaveKey(projectId), [projectId]);
  useEffect(() => {
    migrateRbprojAutosaveIfNeeded(legacyRbprojAutosaveKey, rbprojAutosaveKey);
  }, [legacyRbprojAutosaveKey, rbprojAutosaveKey]);
  const applyRbprojProject = useCallback(
    (project: RBProject) => {
      const applier = applyProjectRef.current;
      if (applier) applier(project);
    },
    [],
  );
  const rbprojAutosaveResult = useRbprojAutosave({
    autosaveKey: rbprojAutosaveKey,
    isDirty,
    getProject: getProjectSnapshot,
    applyProject: applyRbprojProject,
    changeDeps: [circuit, projectName, projectDescription, enableHdlTab ? hdlProject : null, enableHdlTab ? fpgaProject : null],
  });

  // Unified recovery coordinator (autosave > workspace > none)
  const unifiedRecovery = useUnifiedRecoverySurface({
    rbprojAutosave: rbprojAutosaveResult,
    projectId,
    onRestoreWorkspace: handleRecoverSnapshot,
    onDismissWorkspace: handleStartFresh,
  });

  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [draggingNodeType, setDraggingNodeType] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [shareFallbackURL, setShareFallbackURL] = useState<string | null>(null);
  const [showDecodeErrorModal, setShowDecodeErrorModal] = useState(false);
  const [isLoadingSharedCircuit, setIsLoadingSharedCircuit] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsFilename, setSaveAsFilename] = useState('circuit.rblogic');
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveChipModal, setShowSaveChipModal] = useState(false);
  const [showChipLibrary, setShowChipLibrary] = useState(false);
  const [recognizedPattern, setRecognizedPattern] = useState<RecognizedPattern | null>(null);
  const [showTraceViewer, setShowTraceViewer] = useState(false);
  const [traceSnapshots, setTraceSnapshots] = useState<any[]>([]);
  const [showCircuitHints, setShowCircuitHints] = useState(true);
  const [showSchematicHints, setShowSchematicHints] = useState(true);
  const [show3DHints, setShow3DHints] = useState(true);
  const [showOscilloscopeHints, setShowOscilloscopeHints] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [showStartHere, setShowStartHere] = useState(() => {
    // Show on first launch unless dismissed
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('rb-start-here-dismissed') !== 'true';
  });

  // CE Mode modals
  const [showCEResetModal, setShowCEResetModal] = useState(false);
  const [showCEExamplesModal, setShowCEExamplesModal] = useState(false);
  const [showCEExportModal, setShowCEExportModal] = useState(false);
  const ceMode = isCEMode();
  const ceConfig = getCEConfig();
  const [exampleNoteDismissed, setExampleNoteDismissed] = useState(false);
  const [highlightedPort, setHighlightedPort] = useState<{ nodeId: string; portName: string } | null>(
    null
  );
  const [debugSignals, setDebugSignals] = useState<Map<string, 0 | 1> | null>(null);
  const [debugTick, setDebugTick] = useState<number | null>(null);
  const [mismatchWireHighlights, setMismatchWireHighlights] = useState<Map<string, string[]> | null>(
    null
  );
  const [mismatchNodeIds, setMismatchNodeIds] = useState<Set<string> | null>(null);
  const [mismatchPortKeys, setMismatchPortKeys] = useState<Set<string> | null>(null);

  const autosaveIntervalRef = useRef<number | null>(null);
  const historyDebounceRef = useRef<number | null>(null);
  const patternRecognitionRef = useRef<number | null>(null);

  const isDemoMode =
    (import.meta as ImportMeta & { env?: { VITE_PUBLIC_DEMO?: string } }).env?.VITE_PUBLIC_DEMO ===
    'true';

  const lastRecognizedPatternRef = useRef<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedFromURL = useRef(false);
  const isHydratingRef = useRef(false); // Guard to prevent setting dirty during file load
  const lastStoreCircuitFpRef = useRef<string | null>(null); // Track last store circuit fingerprint to prevent feedback loops
  const replayIntervalRef = useRef<number | null>(null);
  const replaySetupRef = useRef(false);
  const replayPausedRef = useRef(false);
  const replayContextRef = useRef<{
    engine: CircuitEngine;
    tickEngine: TickEngine;
    eventsByTick: Map<number, RunStimulusEvent[]>;
    maxTick: number;
  } | null>(null);
  const preReplayStateRef = useRef<{
    circuit: Circuit;
    engine: CircuitEngine;
    tickEngine: TickEngine;
    tickRate: number;
    isRunning: boolean;
    tickCount: number;
    viewState: {
      camera: import('@redbyte/rb-logic-view').Camera;
      selection: import('@redbyte/rb-logic-view').Selection;
    };
  } | null>(null);
  const engineRef = useRef<CircuitEngine>(engine);
  const tickEngineRef = useRef<TickEngine>(tickEngine);
  const circuitRef = useRef<Circuit>(circuit);
  const setCircuitRef = useRef<typeof setCircuit | null>(null);

  // Keep refs in sync with state
  // NOTE: Do NOT include setCircuit, setEngine, setTickEngine in dependencies!
  // These are state setters that change on every render, causing infinite loops.
  useEffect(() => {
    setCircuitRef.current = setCircuit;
    engineRef.current = engine;
    tickEngineRef.current = tickEngine;
  }, [engine, tickEngine]);

  useEffect(() => {
    circuitRef.current = circuit;
  }, [circuit]);

  // Sync circuit store with engine instances
  useEffect(() => {
    useCircuitStore.getState().setEngine(engine);
    useCircuitStore.getState().setTickEngine(tickEngine);
  }, [engine, tickEngine]);

  // CRITICAL FIX: Sync local circuit state FROM circuitStore
  // This ensures StatusBar and all UI components see updates when circuitStore.addNode() is called.
  // Without this, the store updates but local state stays stale, causing "Components: 0" bug.
  useEffect(() => {
    const unsubscribe = useCircuitStore.subscribe((state) => {
      const current = circuitRef.current;
      // Only update if circuit actually changed (avoid infinite loops)
      if (state.circuit !== current) {
        if (import.meta.env.DEV) {
          console.log('[LogicPlayground] Syncing circuit from store', {
            storeNodes: state.circuit.nodes.length,
            localNodes: current.nodes.length
          });
        }
        setCircuit(state.circuit);
        // Engine sync happens in updateCircuit now, no need to duplicate here
      }
    });
    return unsubscribe;
  }, []);

  // Initialize global view state sync
  useEffect(() => {
    setGlobalViewStateSync(useViewStateStore);
  }, []);

  // Evidence Viewer Loading
  useEffect(() => {
    if (resourceId && resourceId.endsWith('.rbev')) {
      // Need to defer to next tick or ensure file system is ready?
      // getFile is synchronous if loaded.
      const file = getFile(resourceId);
      if (file && file.content) {
        try {
          const bundle = JSON.parse(file.content);
          // Auto-verify legacy/simple bundles for now
          // Real verification would check hash against content, but here we just load it.
          useEvidenceViewerStore.getState().setEvidence(bundle, 'UNVERIFIED');
        } catch (e) {
          console.error('Failed to load evidence', e);
          addToast('Failed to load evidence capsule', 'error');
        }
      }
    }
  }, [resourceId, getFile, addToast]);

  // Classroom Edition: autosave circuit on mutations
  useAutosaveCircuit();

  useEffect(() => {
    replayPausedRef.current = replayPaused;
  }, [replayPaused]);

  // Crash recovery handled by snapshot system.

  // Track circuit complexity for classroom guardrails
  useEffect(() => {
    const nodeCount = circuit.nodes.length;
    const edgeCount = circuit.connections.length;

    // Calculate max fan-out
    const fanOutCounts = new Map<string, number>();
    circuit.connections.forEach((conn) => {
      const key = `${conn.from.nodeId}:${conn.from.portName}`;
      fanOutCounts.set(key, (fanOutCounts.get(key) || 0) + 1);
    });
    const maxFanOut = fanOutCounts.size > 0 ? Math.max(...fanOutCounts.values()) : 0;

    // Update classroom mode store
    const { setComplexity } = useClassroomModeStore.getState();
    setComplexity(nodeCount, edgeCount, maxFanOut);
  }, [circuit]);

  // Crash recovery handled by snapshot system.

  // Show Start Here panel on first open
  useEffect(() => {
    const dismissed = localStorage.getItem('rb-start-here-dismissed');
    if (!dismissed) {
      setShowStartHere(true);
    }
  }, []);

  // One-time hint for oscilloscope view discovery
  useEffect(() => {
    const hasSeenScopeHint = localStorage.getItem('rb-seen-scope-hint');
    if (!hasSeenScopeHint && !initialExampleId) {
      const timer = setTimeout(() => {
        addToast('IDEA Press 4 to open Oscilloscope view and monitor signals', 'info', 6000);
        localStorage.setItem('rb-seen-scope-hint', '1');
      }, 2000); // Delay to avoid overwhelming on first load
      return () => clearTimeout(timer);
    }
  }, [initialExampleId, addToast]);

  // Milestone D: Register state accessor for determinism recording
  useEffect(() => {
    if (!windowId || !registerStateAccessor) return;

    // Register a function that returns the current circuit
    registerStateAccessor(windowId, {
      getCircuit: () => engineRef.current.getCircuit(),
    });

    // Cleanup on unmount
    return () => {
      if (unregisterStateAccessor) {
        unregisterStateAccessor(windowId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId]);
  // registerStateAccessor and unregisterStateAccessor are stable callbacks from Shell
  // and should NOT be in deps - they don't need to trigger re-registration

  // PHASE 0: Dispatch readiness signal after all critical UI components have mounted
  useEffect(() => {
    if (import.meta.env.DEV || navigator.webdriver) {
      pushMount('RB_READY_EFFECT_FIRED');
    }

    // Check if root element is ready (TopCommandBar + RightDock + main view mounted)
    const rootEl = document.querySelector('[data-testid="logic-playground-root"]');
    const topBarEl = document.querySelector('[data-testid="top-command-bar"]');
    const rightDockEl = document.querySelector('[data-testid="right-dock"]');

    if (rootEl && topBarEl && rightDockEl) {
      // Mark root as ready
      rootEl.setAttribute('data-ready', 'true');

      // Dispatch window event for test automation
      window.dispatchEvent(new Event('rb:logic-playground-ready'));

      // Enable runaway loop watchdog for crash detection
      enableWatchdog();

      if (import.meta.env.DEV) {
        console.log('RB_READY');
        console.log('[LogicPlayground] Readiness signal dispatched');

        // Persist for post-mortem
        try {
          localStorage.setItem('__RB_LAST_READY__', '1');
        } catch (e) {
          // Ignore
        }

        pushMount('RB_READY_DISPATCHED');
      }
    }
  }, []); // Only once after initial render

  // Wrap TickEngine.stepOnce to record ticks and probe samples during recording/replay
  useEffect(() => {
    const shouldWrap =
      determinismRecorder?.isRecording ||
      recorderMode === 'recording' ||
      recorderMode === 'replaying';
    if (!shouldWrap) return;

    const engine = tickEngineRef.current;
    const originalStepOnce = engine.stepOnce.bind(engine);

    engine.stepOnce = function (this: TickEngine) {
      const prevTick = this.getTickCount();
      originalStepOnce();
      const newTick = this.getTickCount();

      if (determinismRecorder?.isRecording) {
        determinismRecorder.recordSimulationTick(prevTick, newTick);
      }

      const runState = useRunRecorderStore.getState();
      const activeMode = runState.mode;
      if (activeMode === 'recording' || activeMode === 'replaying') {
        const probesToSample =
          activeMode === 'recording'
            ? runState.context?.probes
            : runState.replay?.record.probes;
        if (probesToSample && probesToSample.length > 0) {
          const signals = this.getEngine().getAllSignals();
          const values: Record<string, 0 | 1> = {};
          probesToSample.forEach((probe) => {
            const key = `${probe.nodeId}.${probe.portName}`;
            values[probe.id] = (signals.get(key) ?? 0) as 0 | 1;
          });
          if (activeMode === 'recording') {
            const startTick = runState.context?.startTick ?? 0;
            const relativeTick = Math.max(0, newTick - startTick);
            useRunRecorderStore.getState().recordTraceSample({ tick: relativeTick, values });
          } else {
            useRunRecorderStore.getState().recordReplaySample({ tick: newTick, values });
          }
        }
      }
    };

    return () => {
      engine.stepOnce = originalStepOnce;
    };
  }, [determinismRecorder, determinismRecorder?.isRecording, recorderMode]);

  useEffect(() => {
    if (recorderMode !== 'replaying' || !replayRecord) {
      replaySetupRef.current = false;
      replayContextRef.current = null;
      setDebugSignals(null);
      setDebugTick(null);
      setDebugOverlay(null);
      setMismatchWireHighlights(null);
      setMismatchNodeIds(null);
      setMismatchPortKeys(null);
      return;
    }

    if (replaySetupRef.current) return;
    replaySetupRef.current = true;

    if (!preReplayStateRef.current) {
      const viewState = (useLogicViewStore() as any).getState();
      preReplayStateRef.current = {
        circuit,
        engine,
        tickEngine,
        tickRate: currentHz,
        isRunning,
        tickCount: tickEngine.getTickCount(),
        viewState: {
          camera: viewState.camera,
          selection: viewState.selection,
        },
      };
      tickEngine.pause();
    }

    if (replayIntervalRef.current) {
      window.clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }

    const replayCircuit = JSON.parse(JSON.stringify(replayRecord.circuitSnapshot)) as Circuit;
    const newEngine = new CircuitEngine(replayCircuit);
    const newTickEngine = new TickEngine(replayCircuit, {
      tickRate: replayRecord.engineConfig.tickRate,
    });

    setEngine(newEngine);
    setTickEngine(newTickEngine);
    setCircuit(replayCircuit);
    setIsRunning(false);
    setCurrentHz(replayRecord.engineConfig.tickRate);
    newTickEngine.pause();

    const eventsByTick = indexStimulusByTick(replayRecord.stimulus);
    const tickInterval = Math.max(16, Math.floor(1000 / replayRecord.engineConfig.tickRate));
    const maxTick = replayRecord.summary.durationTicks ?? replayRecord.summary.tickCount;

    replayContextRef.current = {
      engine: newEngine,
      tickEngine: newTickEngine,
      eventsByTick,
      maxTick,
    };

    replayIntervalRef.current = window.setInterval(() => {
      if (replayPausedRef.current) return;
      const context = replayContextRef.current;
      if (!context) return;
      const { tickEngine, eventsByTick: tickEvents, engine: replayEngine, maxTick: replayMaxTick } = context;

      const tick = tickEngine.getTickCount();
      const events = tickEvents.get(tick) ?? [];
      if (events.length > 0) {
        setCircuit((prev) => {
          const nextCircuit = applyStimulusEvents(prev, events);
          replayEngine.setCircuit(nextCircuit);
          tickEngine.setCircuit(nextCircuit);
          return nextCircuit;
        });
      }

      tickEngine.stepOnce();
      const nextTick = tickEngine.getTickCount();
      useRunRecorderStore.getState().setPlayheadTick(nextTick);
      const rawSignals = tickEngine.getEngine().getAllSignals();
      const mappedSignals = new Map<string, 0 | 1>();
      rawSignals.forEach((v, k) => mappedSignals.set(k, (v > 0 ? 1 : 0) as 0 | 1));
      setDebugSignals(mappedSignals);
      setDebugTick(nextTick);

      if (nextTick >= replayMaxTick) {
        if (replayIntervalRef.current) {
          window.clearInterval(replayIntervalRef.current);
          replayIntervalRef.current = null;
        }
        stopRunReplay();
      }
    }, tickInterval);

    return () => {
      if (replayIntervalRef.current) {
        window.clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
      replayContextRef.current = null;
    };
  }, [
    recorderMode,
    replayRecord,
    stopRunReplay,
    circuit,
    engine,
    tickEngine,
    currentHz,
    isRunning,
  ]);

  useEffect(() => {
    if (recorderMode === 'replaying') return;
    if (!preReplayStateRef.current) return;

    const previous = preReplayStateRef.current;
    preReplayStateRef.current = null;
    replaySetupRef.current = false;

    restoreReplayState(
      previous,
      {
        setEngine,
        setTickEngine,
        setCircuit,
        setCurrentHz,
        setTickCount,
        setIsRunning,
      },
      useLogicViewStore() as any
    );
  }, [recorderMode]);

  // Use ref to track debugSignals for overlay updates without causing loops
  const debugSignalsRef = useRef<Map<string, 0 | 1> | null>(null);
  debugSignalsRef.current = debugSignals;

  useEffect(() => {
    if (recorderMode === 'replaying' && debugSignalsRef.current) {
      const tick = debugTick ?? playheadTick;
      setDebugOverlay(buildDebugOverlayFromSignals(debugSignalsRef.current, tick, currentHz));
      return;
    }
    setDebugOverlay(null);
  }, [recorderMode, debugTick, playheadTick, currentHz, setDebugOverlay]);

  useEffect(() => {
    if (recorderMode !== 'replaying' || !replayRecord) return;
    if (!replayPaused) return;
    const context = replayContextRef.current;
    if (!context) return;

    const maxTick = context.maxTick;
    const targetTick = Math.min(Math.max(0, playheadTick), maxTick);
    const currentTick = context.tickEngine.getTickCount();

    if (targetTick < currentTick) {
      const resetCircuit = JSON.parse(JSON.stringify(replayRecord.circuitSnapshot)) as Circuit;
      const resetEngine = new CircuitEngine(resetCircuit);
      const resetTickEngine = new TickEngine(resetCircuit, {
        tickRate: replayRecord.engineConfig.tickRate,
      });
      context.engine = resetEngine;
      context.tickEngine = resetTickEngine;
      setEngine(resetEngine);
      setTickEngine(resetTickEngine);
    }

    while (context.tickEngine.getTickCount() < targetTick) {
      const tick = context.tickEngine.getTickCount();
      const events = context.eventsByTick.get(tick) ?? [];
      if (events.length > 0) {
        const nextCircuit = applyStimulusEvents(context.engine.getCircuit(), events);
        context.engine.setCircuit(nextCircuit);
        context.tickEngine.setCircuit(nextCircuit);
      }
      context.tickEngine.stepOnce();
    }

    const rawSignals = context.tickEngine.getEngine().getAllSignals();
    const mappedSignals = new Map<string, 0 | 1>();
    rawSignals.forEach((v, k) => mappedSignals.set(k, (v > 0 ? 1 : 0) as 0 | 1));
    setDebugSignals(mappedSignals);
    setDebugTick(context.tickEngine.getTickCount());
  }, [recorderMode, replayRecord, replayPaused, playheadTick]);

  const runReplayTickOnce = useCallback(() => {
    const context = replayContextRef.current;
    if (!context) return false;

    const { tickEngine: replayTickEngine, eventsByTick, engine: replayEngine, maxTick } = context;
    const tick = replayTickEngine.getTickCount();
    const events = eventsByTick.get(tick) ?? [];
    if (events.length > 0) {
      setCircuit((prev) => {
        const nextCircuit = applyStimulusEvents(prev, events);
        replayEngine.setCircuit(nextCircuit);
        replayTickEngine.setCircuit(nextCircuit);
        return nextCircuit;
      });
    }

    replayTickEngine.stepOnce();
    const newTick = replayTickEngine.getTickCount();
    useRunRecorderStore.getState().setPlayheadTick(newTick);

    if (newTick >= maxTick) {
      stopRunReplay();
      return false;
    }
    return true;
  }, [stopRunReplay]);

  useEffect(() => {
    if (recorderMode !== 'replaying') return;
    if (!pendingStepTicks || pendingStepTicks <= 0) return;
    if (!replayPausedRef.current) return;

    for (let i = 0; i < pendingStepTicks; i += 1) {
      if (!runReplayTickOnce()) break;
    }

    useRunRecorderStore.setState({ pendingStepTicks: null });
  }, [pendingStepTicks, recorderMode, runReplayTickOnce]);

  useEffect(() => {
    if (recorderMode !== 'replaying') return;
    if (pendingJumpTick === null || pendingJumpTick === undefined) return;

    useRunRecorderStore.getState().setPlayheadTick(pendingJumpTick);
    useRunRecorderStore.setState({ pendingJumpTick: null });
  }, [pendingJumpTick, recorderMode]);

  // Register saved chips on mount
  useEffect(() => {
    const chips = getAllChips();
    registerAllChips(chips);
  }, []); // Only run once on mount

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inputFocused = isInputFocused();
      if (inputFocused) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (showKeyboardHelp) setShowKeyboardHelp(false);
          if (showQuickAdd) setShowQuickAdd(false);
        }
        return;
      }
      // Ctrl+Z or Cmd+Z for Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z for Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+Shift+C or Cmd+Shift+C for share
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handleShare();
      }
      // Ctrl+Shift+S or Cmd+Shift+S for Save As
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleSaveAs();
      }
      // Ctrl+S or Cmd+S for Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+O or Cmd+O for Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpen();
      }
      // Ctrl+L or Cmd+L for Chip Library
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setShowChipLibrary(true);
      }
      // Escape to exit hierarchy
      if (e.key === 'Escape' && hierarchyStack.length > 0) {
        e.preventDefault();
        exitToParent();
      }
      // Backspace to exit hierarchy (alternative)
      if (e.key === 'Backspace' && hierarchyStack.length > 0) {
        e.preventDefault();
        exitToParent();
      }
      // E to toggle edit mode when inside a chip
      if (e.key === 'e' && hierarchyStack.length > 0) {
        e.preventDefault();
        toggleEditMode();
      }
      // ? to show keyboard shortcuts help
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        setShowKeyboardHelp(true);
      }
      // Shift+? to show Start Here panel
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowStartHere(true);
      }
      // Space to show quick add palette
      if (e.key === ' ' && !showQuickAdd && !isReplayMode) {
        e.preventDefault();
        setShowQuickAdd(true);
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showKeyboardHelp) setShowKeyboardHelp(false);
        if (showQuickAdd) setShowQuickAdd(false);
        if (!showKeyboardHelp && !showQuickAdd && hierarchyStack.length === 0) {
          canvasAreaRef.current?.focus();
        }
      }

      // Shift+P to open Probes tab
      if (e.key === 'P' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setRightDockTab('probes');
        if (rightDockState === 'collapsed') {
          setRightDockState('peek');
        }
      }

      // Ctrl/Cmd+1..6: dock tabs
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setRightDockTab('inspector');
          if (rightDockState === 'collapsed') setRightDockState('peek');
        }
        if (e.key === '2') {
          e.preventDefault();
          setRightDockTab('health');
          if (rightDockState === 'collapsed') setRightDockState('peek');
        }
        if (e.key === '3') {
          e.preventDefault();
          setRightDockTab('learn');
          if (rightDockState === 'collapsed') setRightDockState('peek');
        }
        if (e.key === '4') {
          e.preventDefault();
          setRightDockTab('probes');
          if (rightDockState === 'collapsed') setRightDockState('peek');
        }
        if (e.key === '5') {
          e.preventDefault();
          setRightDockTab('record');
          if (rightDockState === 'collapsed') setRightDockState('peek');
        }
        if (e.key === '6') {
          e.preventDefault();
          setRightDockTab('chips');
          if (rightDockState === 'collapsed') setRightDockState('peek');
        }
      }

      // Number keys 1-5 for single-view layouts
      if (e.key === '1' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPerspective('circuit-only');
      }
      if (e.key === '2' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPerspective('schematic-only');
      }
      if (e.key === '3' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPerspective('scope-only');
      }
      if (e.key === '4' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPerspective('3d-only');
      }
      if (e.key === '5' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPerspective('code-only');
      }

      // Shift+Number for workflow layouts
      if (e.key === '!' && e.shiftKey) { // Shift+1
        e.preventDefault();
        setPerspective('build');
      }
      if (e.key === '@' && e.shiftKey) { // Shift+2
        e.preventDefault();
        setPerspective('explain');
      }
      if (e.key === '#' && e.shiftKey) { // Shift+3
        e.preventDefault();
        setPerspective('analyze');
      }
      if (e.key === '$' && e.shiftKey) { // Shift+4
        e.preventDefault();
        setPerspective('explore');
      }
      if (e.key === '%' && e.shiftKey) { // Shift+5
        e.preventDefault();
        setPerspective('quad');
      }
    };

    const isInputFocused = () => {
      const active = document.activeElement;
      if (!active) return false;
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') {
        return true;
      }
      return (active as HTMLElement).isContentEditable;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showKeyboardHelp, showQuickAdd, setPerspective, isReplayMode]);

  // Sync hierarchy circuit with main circuit
  // Use refs to track last synced values and prevent infinite loops
  const lastSyncedHierarchyRef = useRef<Circuit | null>(null);
  const lastSyncedCircuitRef = useRef<Circuit | null>(null);
  const hierarchyCircuitRef = useRef<Circuit | null>(hierarchyCircuit);

  // Keep refs in sync with state without triggering the main effect
  useEffect(() => {
    hierarchyCircuitRef.current = hierarchyCircuit;
  }, [hierarchyCircuit]);

  useEffect(() => {
    // Only trigger on hierarchyStack changes, not on circuit/hierarchyCircuit changes
    // Read current values from refs to avoid circular updates
    const currentHierarchyCircuit = hierarchyCircuitRef.current;
    const currentCircuit = circuitRef.current;

    if (hierarchyStack.length > 0) {
      // We're inside a chip - use hierarchy circuit
      // Only sync if hierarchyCircuit actually changed (reference check)
      if (currentHierarchyCircuit && currentHierarchyCircuit !== lastSyncedHierarchyRef.current) {
        lastSyncedHierarchyRef.current = currentHierarchyCircuit;
        // Only update if circuit is actually different
        if (currentCircuit !== currentHierarchyCircuit) {
          setCircuit(currentHierarchyCircuit);
          engineRef.current.setCircuit(currentHierarchyCircuit);
        }
      }
    } else {
      // We're at top level - sync hierarchy with main
      // Only sync if circuit reference changed and hierarchy needs updating
      if (currentCircuit !== lastSyncedCircuitRef.current && currentCircuit !== currentHierarchyCircuit) {
        lastSyncedCircuitRef.current = currentCircuit;
        setHierarchyCircuit(currentCircuit);
      }
    }
  }, [hierarchyStack.length]);

  // Load circuit from URL if present
  useEffect(() => {
    const detectAndLoadCircuitFromURL = async () => {
      // Idempotent guard - only load once
      if (hasLoadedFromURL.current) return;

      const params = new URLSearchParams(window.location.search);
      const circuitParam = params.get('circuit');

      if (circuitParam) {
        hasLoadedFromURL.current = true;
        setIsLoadingSharedCircuit(true);

        try {
          // Set hydration guard to prevent marking dirty during load
          isHydratingRef.current = true;
          // Use async decoder to support both legacy and compressed (c1:) formats
          const decoded = await decodeCircuitAsync(circuitParam);
          // Convert back to SerializedCircuitV1 format
          const serialized: SerializedCircuitV1 = {
            version: '1',
            nodes: Array.isArray(decoded.gates) ? decoded.gates : [],
            connections: Array.isArray(decoded.wires) ? decoded.wires : [],
          };
          const loadedCircuit = deserialize(serialized);
          setCircuit(loadedCircuit);
          const newEngine = new CircuitEngine(loadedCircuit);
          setEngine(newEngine);
          setTickEngine(new TickEngine(loadedCircuit, { tickRate }));
          setCurrentFileId(null);
          setIsDirty(true);
          // Clear hydration guard after load completes
          isHydratingRef.current = false;

          // Milestone D: Record circuit loaded event
          if (determinismRecorder?.isRecording) {
            determinismRecorder.recordCircuitLoaded(loadedCircuit);
          }

          addToast('Loaded shared circuit', 'success');

          // Clear URL parameter
          window.history.replaceState({}, '', window.location.pathname);
        } catch (error) {
          addToast('Failed to load shared circuit', 'error');
          console.error('URL circuit load error:', error);
          setShowDecodeErrorModal(true);
        } finally {
          setIsLoadingSharedCircuit(false);
        }
      }
    };

    detectAndLoadCircuitFromURL();
  }, []);

  useEffect(() => {
    if (isReplayMode && showQuickAdd) {
      setShowQuickAdd(false);
    }
  }, [isReplayMode, showQuickAdd]);

  // Load circuit from open-with intent resourceId
  useEffect(() => {
    if (resourceId && resourceType === 'file') {
      // Try to find existing file by resourceId (exact match)
      const existingFile = availableFiles.find((f) => f.id === resourceId);

      if (existingFile) {
        // File exists, load it
        handleLoadFile(existingFile.id);
        // Focus canvas area after loading - PHASE_Z: using requestAnimationFrame for deterministic focus
        requestAnimationFrame(() => {
          canvasAreaRef.current?.focus();
        });
      } else {
        // File doesn't exist, try to find by name match
        // Extract clean name from resourceId (e.g., "notes" -> "notes.txt" or just "notes")
        const nameMatchFile = availableFiles.find((f) =>
          f.name.toLowerCase().includes(resourceId.toLowerCase()) ||
          resourceId.toLowerCase().includes(f.name.toLowerCase())
        );

        if (nameMatchFile) {
          handleLoadFile(nameMatchFile.id);
          requestAnimationFrame(() => {
            canvasAreaRef.current?.focus();
          });
        } else {
          // No match found, create new empty circuit file with resourceId as name
          const serialized = serialize(circuit);
          const contentStr = JSON.stringify(serialized);
          // Ensure filename has .rblogic extension
          const filename = resourceId.endsWith('.rblogic') ? resourceId : `${resourceId}.rblogic`;
          const newFileId = createFile('documents', filename, contentStr);
          setCurrentFileId(newFileId);
          setAvailableFiles(getLogicFiles());
          setSelectedFileId(newFileId);
          setIsDirty(false);
          addToast(`Created new circuit: ${filename}`, 'success');
          requestAnimationFrame(() => {
            canvasAreaRef.current?.focus();
          });
        }
      }
    }
  }, [resourceId, resourceType]);

  // Load initial circuit
  useEffect(() => {
    const loadInitial = async () => {
      if (initialFileId) {
        await handleLoadFile(initialFileId);
      } else if (initialExampleId) {
        await handleLoadExample(initialExampleId);
      }
    };
    loadInitial();
  }, []);

  // Intent props: open a specific dock tab/subview on mount
  useEffect(() => {
    if (dockTab) {
      const store = useLayoutStore.getState();
      store.openDock(
        dockTab as any,
        (dockSubview as LearnSubview) || undefined,
      );
    }
    if (showExamples) {
      setShowExamplesModal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intent props are mount-only

  useEffect(() => {
    tickEngine.setTickRate(tickRate);
    setCurrentHz(tickRate);
  }, [tickRate]);

  // Track tick count for UI display
  useEffect(() => {
    setTickCount(tickEngine.getTickCount());
  }, [tickEngine, uiTick]);

  useEffect(() => {
    setLastTickAt(Date.now());
  }, [tickCount]);

  useEffect(() => {
    setExampleNoteDismissed(false);
  }, [selectedExampleId]);

  // Layout is driven by the perspective store.
  useEffect(() => { }, [perspective]);

  // Autosave after 5 seconds of idle (debounced)
  useEffect(() => {
    // Clear any existing timeout
    if (autosaveIntervalRef.current) {
      clearTimeout(autosaveIntervalRef.current);
      autosaveIntervalRef.current = null;
    }

    // Only set timeout if dirty and has file association
    if (isDirty && currentFileId) {
      autosaveIntervalRef.current = setTimeout(() => {
        try {
          const serialized = serialize(circuit);
          const contentStr = JSON.stringify(serialized);
          updateFileContent(currentFileId, contentStr);
          setIsDirty(false); // Clear dirty state after autosave
        } catch (error) {
          console.error('Autosave error:', error);
        }
      }, 5000) as unknown as number;
    }

    return () => {
      if (autosaveIntervalRef.current) {
        clearTimeout(autosaveIntervalRef.current);
      }
    };
  }, [isDirty, currentFileId, circuit]);

  // Beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Modern browsers ignore custom message
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Update window title with filename and dirty indicator
  useEffect(() => {
    if (!windowId) return;

    let title = 'Logic Playground';

    // Add filename if file is loaded
    if (currentFileId) {
      const file = getFile(currentFileId);
      if (file) {
        title = file.name;
      }
    }

    // Add dirty indicator
    if (isDirty) {
      title = `${title} *`;
    }

    setWindowTitle(windowId, title);
  }, [windowId, currentFileId, isDirty]);




  // Helper to strictly reset all ephemeral app stores to prevent state leaks
  const resetAppStores = useCallback(() => {
    // 1. Clear Probes
    useProbeStore.getState().clearProbes();
    // 2. Clear Oscilloscope history/view
    useOscilloscopeStore.getState().requestClear();
    // 3. Reset Run Recorder/Replay state
    useRunRecorderStore.getState().reset();
    // 4. Reset UI tick (visual sync)
    useUiTickStore.setState({ uiTick: 0 });
    // 5. Clear global selection (pre-emptively)
    useLogicViewStore.getState().clearSelection();
  }, []);

  const executeNew = () => {
    // FIX (P1): Reset all auxiliary stores (probes, recorder, scope)
    resetAppStores();

    // Set hydration guard to prevent marking dirty during load
    isHydratingRef.current = true;
    const emptyCircuit: Circuit = { nodes: [], connections: [] };

    // FIX (P1): Reset authoritative store (clears history + updates state)
    // Subscription will sync this back to local state/engines automatically
    useCircuitStore.getState().reset();

    setCircuit(emptyCircuit);
    const newEngine = new CircuitEngine(emptyCircuit);
    setEngine(newEngine);
    setTickEngine(new TickEngine(emptyCircuit, { tickRate: currentHz }));
    setCurrentFileId(null);
    setIsDirty(false);
    setIsRunning(false);
    setSelectedFileId('');
    setSelectedExampleId('');
    // Clear pattern recognition state
    lastRecognizedPatternRef.current = null;
    // Clear hydration guard after load completes
    isHydratingRef.current = false;
  };

  const handleNew = () => {
    confirmReplacement('Create a new project', executeNew);
  };

  const handleUndo = () => {
    const circuitStore = useCircuitStore.getState();
    if (!circuitStore.canUndo()) {
      return;
    }

    circuitStore.undo();
    addToast('Undo', 'info');
  };

  const handleRedo = () => {
    const circuitStore = useCircuitStore.getState();
    if (!circuitStore.canRedo()) {
      return;
    }

    circuitStore.redo();
    addToast('Redo', 'info');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const undoHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { windowId?: string } | undefined;
      if (detail?.windowId && windowId && detail.windowId !== windowId) return;
      handleUndo();
    };
    const redoHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { windowId?: string } | undefined;
      if (detail?.windowId && windowId && detail.windowId !== windowId) return;
      handleRedo();
    };
    window.addEventListener('rb:history-undo', undoHandler as EventListener);
    window.addEventListener('rb:history-redo', redoHandler as EventListener);
    return () => {
      window.removeEventListener('rb:history-undo', undoHandler as EventListener);
      window.removeEventListener('rb:history-redo', redoHandler as EventListener);
    };
  }, [windowId, handleUndo, handleRedo]);

  const handleNodeUpdate = (nodeId: string, updates: Partial<Node>) => {
    if (recorderMode === 'replaying') return;
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    };
    setCircuit(updatedCircuit);
    engineRef.current.setCircuit(updatedCircuit);
    setIsDirty(true);
  };

  const handleConnectionDelete = (connectionId: string) => {
    if (recorderMode === 'replaying') return;
    const [from, to] = connectionId.split('->');
    const [fromNodeId, fromPort] = from.split('.');
    const [toNodeId, toPort] = to.split('.');

    const updatedCircuit = {
      ...circuit,
      connections: circuit.connections.filter(
        (c) =>
          !(
            c.from.nodeId === fromNodeId &&
            c.from.portName === fromPort &&
            c.to.nodeId === toNodeId &&
            c.to.portName === toPort
          )
      ),
    };
    setCircuit(updatedCircuit);
    engineRef.current.setCircuit(updatedCircuit);
    setIsDirty(true);
    addToast('Connection deleted', 'info');
  };

  const handleFocusNode = (nodeId: string, _portName?: string) => {
    const viewStore = useViewStateStore.getState();
    viewStore.clearSelection();
    viewStore.selectNodes([nodeId], false);
    viewStore.setHighlightedNode(nodeId, 1600);
    viewStore.requestFocusNode(nodeId);
  };

  // Helper for destructive actions (must be before handleLoadLearnExample which uses it)
  const openGuardrail = useCallback((config: GuardrailConfig) => {
    setGuardrail(config);
  }, []);

  const confirmReplacement = useCallback(
    (actionDescription: string, onProceed: () => void) => {
      openGuardrail({
        title: `${actionDescription}?`,
        message: `${actionDescription} will replace the current workspace.`,
        lossItems: ['Current circuit', 'Undo/redo history', 'Unsaved changes'],
        confirmLabel: actionDescription,
        confirmTone: 'danger',
        onConfirm: () => {
          saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'autosave', true, getProjectSnapshot() ?? undefined);
          onProceed();
        },
        onExport: () => setShowCEExportModal(true),
      });
      return false;
    },
    [openGuardrail, setShowCEExportModal, circuit, getLayoutSnapshot, safeMode, getProjectSnapshot]
  );

  const handleLoadLearnExample = useCallback(
    (example: any) => {
      confirmReplacement('Load tutorial', () => {
        const newCircuit = example.initialCircuit || { nodes: [], connections: [] };
        setCircuit(newCircuit);
        engineRef.current.setCircuit(newCircuit);
        setIsDirty(false);
        addToast(`Loaded: ${example.title}`, 'success');
      });
    },
    [addToast, confirmReplacement]
  );

  const handleExitLearnMode = useCallback(() => {
    // Just a placeholder - user can manually clear or load a file
    addToast('Exited learn mode', 'info');
  }, [addToast]);

  const handleCircuitChange = useCallback((updatedCircuit: Circuit) => {
    // Compute fingerprint for incoming circuit
    const incomingFp = computeCircuitFingerprint(updatedCircuit);

    // Prevent feedback loop: if this circuit update came from the store (same fingerprint), skip re-commit
    if (lastStoreCircuitFpRef.current === incomingFp) {
      if (import.meta.env.DEV) {
        console.log('[LogicPlaygroundApp] Suppressed feedback loop (fingerprints match)');
      }
      return;
    }

    // Prevent feedback loop: if circuit is already in store, do nothing
    const circuitStore = useCircuitStore.getState();
    if (circuitStore.circuit === updatedCircuit) {
      return;
    }

    // CRITICAL: Update local state AND store to keep them in sync
    setCircuit(updatedCircuit);
    engineRef.current.setCircuit(updatedCircuit);

    // Use circuitStore.commit to add to history

    // Only commit to history if not loading a file
    if (!isHydratingRef.current) {
      // Prevent feedback loop: don't commit if circuit is already in store
      if (circuitStore.circuit !== updatedCircuit) {
        circuitStore.commit(updatedCircuit);
        // Update ref to track what we just committed (prevents feedback loop on next store→canvas update)
        lastStoreCircuitFpRef.current = incomingFp;
      }
    } else {
      // During file load, update without history but enforce classroom limits
      circuitStore.updateCircuit(updatedCircuit, { skipHistory: true, enforceLimits: true });
      lastStoreCircuitFpRef.current = incomingFp;
    }

    setIsDirty(true);

    // Only handle pattern recognition if not currently loading a file
    if (!isHydratingRef.current) {
      // Debounced pattern recognition (2 seconds after last change)
      if (patternRecognitionRef.current) {
        clearTimeout(patternRecognitionRef.current);
      }
      patternRecognitionRef.current = setTimeout(() => {
        const pattern = recognizePattern(updatedCircuit);
        if (pattern && pattern.name !== lastRecognizedPatternRef.current) {
          lastRecognizedPatternRef.current = pattern.name;
          setRecognizedPattern(pattern);
          addToast(
            `! You just built a ${pattern.name}! ${pattern.description} (Layer ${pattern.layer})`,
            'success',
            6000
          );
        } else if (!pattern && lastRecognizedPatternRef.current) {
          // Circuit changed - pattern no longer matches
          lastRecognizedPatternRef.current = '';
          setRecognizedPattern(null);
        }
      }, 2000) as unknown as number;
    }
  }, [addToast]);

  // Probe handling
  const probedPorts = React.useMemo(() => {
    const set = new Set<string>();
    probes.forEach((probe) => {
      set.add(`${probe.nodeId}.${probe.portName}`);
    });
    return set;
  }, [probes]);

  const probeWireHighlights = React.useMemo(() => {
    if (!highlightProbePaths) {
      return new Map();
    }
    return buildProbeWireHighlights(circuit, probes);
  }, [circuit, probes, highlightProbePaths]);

  const buildRunRecorderContext = useCallback(() => {
    const enabledProbes = probes.filter((probe) => probe.enabled);
    return {
      circuitSnapshot: JSON.parse(JSON.stringify(circuit)),
      tickRate: currentHz,
      probes: enabledProbes.map((probe) => ({
        id: probe.id,
        nodeId: probe.nodeId,
        portName: probe.portName,
        label: probe.label,
        color: probe.color,
      })),
      startTick: tickEngineRef.current.getTickCount(),
      appVersion,
    };
  }, [circuit, currentHz, probes, appVersion]);

  const getMissingProbeNodes = useCallback(() => {
    const nodeIds = new Set(circuit.nodes.map((node) => node.id));
    const missing: string[] = [];
    probes.forEach((probe) => {
      if (!nodeIds.has(probe.nodeId)) {
        missing.push(probe.nodeId);
      }
    });
    return missing;
  }, [circuit.nodes, probes]);

  const handleRunRecorderArm = useCallback(() => {
    armRunRecorder(buildRunRecorderContext());
  }, [armRunRecorder, buildRunRecorderContext]);

  const handleRunRecorderStart = useCallback(() => {
    startRunRecording(buildRunRecorderContext());
  }, [startRunRecording, buildRunRecorderContext]);

  const handleRunRecorderStop = useCallback(() => {
    stopRunRecording(tickEngineRef.current.getTickCount(), getMissingProbeNodes());
  }, [stopRunRecording, getMissingProbeNodes]);

  const handleRunRecorderProof = useCallback(() => {
    resetRunRecorder();
    startRunRecording(buildRunRecorderContext());
  }, [resetRunRecorder, startRunRecording, buildRunRecorderContext]);

  const handleRunRecorderExport = useCallback(() => {
    if (!record) return;
    assertAppOutput('logic-playground', 'run-record.json');
    const json = encodeRunRecord(record);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-record-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [record]);

  const handleRunRecorderExportProof = useCallback(() => {
    if (!record) return;
    assertAppOutput('logic-playground', 'proof-pack.json');
    const proofPack = buildProofPack(record, circuit, {
      appVersion,
      tickRate: currentHz,
      exampleId: selectedExampleId || undefined,
    });
    const json = encodeProofPack(proofPack);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proof-pack-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [record, circuit, appVersion, currentHz, selectedExampleId]);

  const handleRunRecorderImportProofPack = useCallback(
    (pack: ProofPack) => {
      const replayCircuit = JSON.parse(JSON.stringify(pack.runRecord.circuitSnapshot)) as Circuit;
      const newEngine = new CircuitEngine(replayCircuit);
      const newTickEngine = new TickEngine(replayCircuit, {
        tickRate: pack.runRecord.engineConfig.tickRate,
      });
      setCircuit(replayCircuit);
      setEngine(newEngine);
      setTickEngine(newTickEngine);
      setCurrentHz(pack.runRecord.engineConfig.tickRate);
      setIsRunning(false);
      setTickCount(newTickEngine.getTickCount());
      setIsDirty(true);
    },
    [record, appVersion, currentHz]
  );

  const handleRunReplayStart = useCallback(() => {
    if (!record) return;
    startRunReplay(record);
  }, [record, startRunReplay]);

  const handleRunReplayStop = useCallback(() => {
    stopRunReplay();
  }, [stopRunReplay]);

  const handleRunReplayPause = useCallback(() => {
    setReplayPaused(true);
  }, [setReplayPaused]);

  const handleRunReplayResume = useCallback(() => {
    setReplayPaused(false);
  }, [setReplayPaused]);

  const handleRunReplayStep = useCallback(
    (ticks: number) => {
      stepReplay(ticks);
    },
    [stepReplay]
  );

  const handleRunReplayJump = useCallback(
    (tick: number) => {
      jumpReplay(tick);
    },
    [jumpReplay]
  );

  const handleProbeToggle = useCallback((nodeId: string, portName: string, label: string) => {
    toggleProbeForPort(nodeId, portName, label);
  }, [toggleProbeForPort]);

  const handleRunRecorderFocus = useCallback(
    (nodeId: string, portName: string) => {
      handleFocusNode(nodeId, portName);
      setHighlightedPort({ nodeId, portName });
    },
    [handleFocusNode, setHighlightedPort]
  );

  const handleMismatchSelect = useCallback(
    (probeId: string) => {
      if (!record) return;
      const probe = record.probes.find((item) => item.id === probeId);
      if (!probe) return;
      handleRunRecorderFocus(probe.nodeId, probe.portName);

      const suspect = buildSuspectSet(
        circuit,
        [{ nodeId: probe.nodeId, portName: probe.portName }],
        4
      );
      const highlightMap = new Map<string, string[]>();
      suspect.wireIds.forEach((wireId) => {
        highlightMap.set(wireId, ['#f97316']);
      });
      setMismatchWireHighlights(highlightMap);
      setMismatchNodeIds(new Set(suspect.nodeIds));
      setMismatchPortKeys(new Set([`${probe.nodeId}:${probe.portName}`]));
    },
    [record, handleRunRecorderFocus, circuit]
  );

  // Memoize mismatch data to avoid recreating objects on every render
  // Only recalculate when verification status actually changes
  const verificationMismatchData = useMemo(() => {
    if (!record || verificationStatus.status !== 'fail' || !verificationStatus.mismatch) {
      return null;
    }

    const mismatchPorts = new Set<string>();
    const combinedNodes = new Set<string>();
    const combinedWires = new Set<string>();

    verificationStatus.mismatch.probeIds.forEach((probeId) => {
      const probe = record.probes.find((item) => item.id === probeId);
      if (!probe) return;
      mismatchPorts.add(`${probe.nodeId}:${probe.portName}`);
      const suspect = buildSuspectSet(circuit, [{ nodeId: probe.nodeId, portName: probe.portName }], 4);
      suspect.nodeIds.forEach((nodeId) => combinedNodes.add(nodeId));
      suspect.wireIds.forEach((wireId) => combinedWires.add(wireId));
    });

    const highlightMap = new Map<string, string[]>();
    combinedWires.forEach((wireId) => {
      highlightMap.set(wireId, ['#f97316']);
    });

    return { mismatchPorts, combinedNodes, highlightMap };
  }, [record, verificationStatus.status, verificationStatus.mismatch, circuit]);

  // Track last set mismatch data to only update state when actually different
  const lastMismatchDataRef = useRef<typeof verificationMismatchData>(null);

  useEffect(() => {
    // Only update state if the computed data actually changed
    if (verificationMismatchData === lastMismatchDataRef.current) {
      return;
    }
    lastMismatchDataRef.current = verificationMismatchData;

    if (!verificationMismatchData) {
      setMismatchPortKeys(null);
      setMismatchNodeIds(null);
      setMismatchWireHighlights(null);
      return;
    }

    setMismatchPortKeys(verificationMismatchData.mismatchPorts);
    setMismatchNodeIds(verificationMismatchData.combinedNodes);
    setMismatchWireHighlights(verificationMismatchData.highlightMap);
  }, [verificationMismatchData]);

  const handleInputToggled = useCallback(
    (nodeId: string, portName: string, newValue: 0 | 1) => {
      if (determinismRecorder?.isRecording) {
        determinismRecorder.recordInputToggled(nodeId, portName, newValue);
      }
      if (recorderMode === 'recording') {
        const startTick = useRunRecorderStore.getState().context?.startTick ?? 0;
        const tick = Math.max(0, tickEngineRef.current.getTickCount() - startTick);
        const node = circuit.nodes.find((item) => item.id === nodeId);
        const label = node ? `${node.type} ${portName}` : `${nodeId}.${portName}`;
        const event: RunStimulusEvent = {
          tick,
          type: 'input_toggled',
          nodeId,
          portName,
          value: newValue,
          label,
        };
        recordEvent(event);
      }
    },
    [determinismRecorder, recorderMode, recordEvent, circuit.nodes]
  );

  const handleNodeDragStart = (nodeType: string, e?: React.DragEvent) => {
    if (import.meta.env.DEV) console.log('[LogicPlayground] handleNodeDragStart', { nodeType });
    if (e) {
      try {
        e.dataTransfer.effectAllowed = 'copy';
        // CRITICAL FIX: Use correct MIME type for drag data
        e.dataTransfer.setData('application/x-redbyte-node-type', nodeType);
      } catch (error) {
        console.error('Failed to set drag data:', error);
      }
    }
    setDraggingNodeType(nodeType);
  };

  const handleNodeDragOver = (e: React.DragEvent) => {
    if (recorderMode === 'replaying') return;
    e.preventDefault();
    e.stopPropagation();
    if (!draggingNodeType) return;

    // Ensure we have valid client coordinates
    if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return;
    if (isNaN(e.clientX) || isNaN(e.clientY)) return;

    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Validate rect properties
    if (typeof rect.left !== 'number' || typeof rect.top !== 'number') return;
    if (isNaN(rect.left) || isNaN(rect.top)) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Final NaN check before setting state
    if (isNaN(x) || isNaN(y)) return;

    setDragPosition({ x, y });
  };

  const handleNodeDrop = (e: React.DragEvent) => {
    if (recorderMode === 'replaying') return;
    e.preventDefault();
    e.stopPropagation();

    if (!draggingNodeType || !canvasAreaRef.current) {
      setDraggingNodeType(null);
      setDragPosition(null);
      return;
    }

    // Ensure we have valid client coordinates
    if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number') {
      setDraggingNodeType(null);
      setDragPosition(null);
      return;
    }

    if (isNaN(e.clientX) || isNaN(e.clientY)) {
      setDraggingNodeType(null);
      setDragPosition(null);
      return;
    }

    const rect = canvasAreaRef.current.getBoundingClientRect();

    // Validate rect properties
    if (typeof rect.left !== 'number' || typeof rect.top !== 'number') {
      setDraggingNodeType(null);
      setDragPosition(null);
      return;
    }

    if (isNaN(rect.left) || isNaN(rect.top)) {
      setDraggingNodeType(null);
      setDragPosition(null);
      return;
    }

    // Get screen coordinates relative to canvas
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Validate calculated position
    if (isNaN(screenX) || isNaN(screenY)) {
      setDraggingNodeType(null);
      setDragPosition(null);
      return;
    }

    // Get current camera state and convert screen to world coordinates
    const viewStore = useLogicViewStore as any;
    const { camera, snapToGrid: shouldSnap, gridSize } = viewStore.getState();
    const worldPos = screenToWorld(screenX, screenY, camera);

    // Optionally snap to grid
    const finalX = shouldSnap ? snapToGrid(worldPos.x, gridSize) : worldPos.x;
    const finalY = shouldSnap ? snapToGrid(worldPos.y, gridSize) : worldPos.y;

    if (import.meta.env.DEV) {
      console.log('[LogicPlayground] handleNodeDrop', {
        nodeType: draggingNodeType,
        position: { x: finalX, y: finalY },
        beforeCount: circuit.nodes.length
      });
    }

    // CRITICAL FIX: Call circuitStore.addNode() instead of bypassing the store
    // The old code directly called setCircuit() which didn't update the store,
    // causing the footer to show "Components: 0" even after placement.
    const beforeCount = useCircuitStore.getState().circuit.nodes.length;
    storeAddNode(draggingNodeType, { x: finalX, y: finalY });
    const afterCount = useCircuitStore.getState().circuit.nodes.length;

    if (import.meta.env.DEV) {
      console.log('[LogicPlayground] After addNode', {
        beforeCount,
        afterCount,
        added: afterCount > beforeCount
      });
    }

    // Check if node was added successfully
    if (afterCount > beforeCount) {
      addToast(`Added ${draggingNodeType}`, 'success');
    } else {
      console.error('[LogicPlayground] Node was NOT added!');
      addToast('Could not add component — circuit may be at its limit', 'warning', 5000);
    }

    setDraggingNodeType(null);
    setDragPosition(null);
  };

  const handleSave = () => {
    const serialized = serialize(circuit);
    const contentStr = JSON.stringify(serialized);

    if (currentFileId) {
      updateFileContent(currentFileId, contentStr);
      setAvailableFiles(getLogicFiles());
      setIsDirty(false);
      const file = getFile(currentFileId);
      if (file) {
        addToast(`Saved to ${file.name}`, 'success');
      }
    } else {
      // No file yet, show Save As modal
      setShowSaveAsModal(true);
    }
  };

  const handleSaveAs = () => {
    const defaultName = currentFileId
      ? getFile(currentFileId)?.name || 'circuit.rblogic'
      : 'circuit.rblogic';
    setSaveAsFilename(defaultName);
    setShowSaveAsModal(true);
  };

  const confirmSaveAs = () => {
    if (!saveAsFilename.trim()) {
      addToast('Filename cannot be empty', 'error');
      return;
    }

    const serialized = serialize(circuit);
    const contentStr = JSON.stringify(serialized);
    // Ensure filename has .rblogic extension
    const filename = saveAsFilename.endsWith('.rblogic') ? saveAsFilename : `${saveAsFilename}.rblogic`;
    const newFileId = createFile('documents', filename, contentStr);
    setCurrentFileId(newFileId);
    setAvailableFiles(getLogicFiles());
    setSelectedFileId(newFileId);
    setIsDirty(false);
    setShowSaveAsModal(false);
    addToast(`Saved as ${filename}`, 'success');
  };

  const handleOpen = () => {
    setShowOpenModal(true);
  };

  const handleOpenFile = async (fileId: string) => {
    setShowOpenModal(false);
    await handleLoadFile(fileId);
  };


  const handleLoadFile = async (fileId: string | null) => {
    if (!fileId) return;
    confirmReplacement('Open file', async () => {
      const file = getFile(fileId);
      if (!file) {
        addToast('File not found', 'error');
        return;
      }
      // Set hydration guard to prevent marking dirty during load
      isHydratingRef.current = true;

      // Reset stores before loading file
      resetAppStores();

      // Parse the file content (JSON string) to get the serialized circuit
      const serialized: SerializedCircuitV1 = file.content
        ? JSON.parse(file.content)
        : { version: '1', nodes: [], connections: [] };

      const loadedCircuit = deserialize(serialized);
      setCircuit(loadedCircuit);
      const newEngine = new CircuitEngine(loadedCircuit);
      setEngine(newEngine);
      setTickEngine(new TickEngine(loadedCircuit, { tickRate }));
      setCurrentFileId(file.id);
      setSelectedFileId(file.id);
      setSelectedExampleId('');
      setIsDirty(false);

      // Milestone D: Record circuit loaded event
      if (determinismRecorder?.isRecording) {
        determinismRecorder.recordCircuitLoaded(loadedCircuit);
      }
      // Clear pattern recognition state
      lastRecognizedPatternRef.current = null;
      // Clear hydration guard after load completes
      isHydratingRef.current = false;
    });
  };

  const seedExampleProbes = (exampleId: ExampleId, loadedCircuit: Circuit) => {
    const { clearProbes, addProbe } = useProbeStore.getState();
    clearProbes();

    const addIfNode = (nodeId: string, portName: string, label: string) => {
      if (!loadedCircuit.nodes.some((node) => node.id === nodeId)) return;
      addProbe({ nodeId, portName, label });
    };

    if (exampleId === '11_d-flipflop') {
      addIfNode('clock', 'out', 'Clock out');
      addIfNode('data', 'out', 'Data in');
      addIfNode('q-output', 'out', 'Q output');
      addIfNode('qbar-output', 'out', 'Q bar');
    }

    if (exampleId === '04_4bit-counter') {
      addIfNode('clock1', 'out', 'Clock out');
      addIfNode('counter', 'Q0', 'Counter Q0');
      addIfNode('counter', 'Q1', 'Counter Q1');
      addIfNode('counter', 'Q2', 'Counter Q2');
      addIfNode('counter', 'Q3', 'Counter Q3');
    }
  };

  const handleLoadExample = async (exampleId: ExampleId | '') => {
    if (!exampleId) return;
    const run = async () => {
      try {
        // Set hydration guard to prevent marking dirty during load
        isHydratingRef.current = true;

        // Ensure clean state before loading example
        resetAppStores();

        let exampleToLoad: ExampleId = exampleId as ExampleId;
        // CPU lite mode: swap heavy CPU for a lightweight counter and show a banner
        if (exampleToLoad === '05_simple-cpu' && e2eCpuLite) {
          console.info('RB_CPU_LITE_ENABLED', { ts: Date.now() });
          addToast('CPU lite mode enabled for E2E', 'info');
          exampleToLoad = '04_4bit-counter';
        }

        const exampleData = await loadExample(exampleToLoad);

        // PHASE 2: Validation Boundary
        const validation = validateCircuitData(exampleData);
        if (!validation.valid) {
          throw new Error(`Example data invalid: ${validation.error}`);
        }

        const loadedCircuit = deserialize(exampleData);

        // PHASE 1.5: DEV-only fault injection for ISSUE-B validation (stack overflow)
        if (import.meta.env.DEV) {
          const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          if (params.get('fault') === 'deep-recursion') {
            console.warn('[FAULT INJECTION] ISSUE-B: deep-recursion - expect stack overflow');
            // Recursive function that will exceed stack depth
            const deepRecurse = (depth: number): any => {
              if (depth > 5000) return {};
              return deepRecurse(depth + 1);
            };
            try {
              deepRecurse(0);
            } catch (e) {
              console.error(`RB_RUNAWAY_LOOP_DETECTED: DEEP_RECURSION ${String(e)}`);
              throw e;
            }
          }
        }

        // PHASE 3: Authoritative Store Update
        // Use circuitStore.updateCircuit which enforces limits and handles history
        useCircuitStore.getState().updateCircuit(loadedCircuit, { skipHistory: false, enforceLimits: true });

        // Sync local state immediately
        setCircuit(loadedCircuit);
        // NOTE: We do NOT create new Engine/TickEngine here.
        // The store.updateCircuit call updates the existing engines in the store.
        // Since local engine state is synced from store, this is strict and correct.

        setCurrentFileId(null);
        setSelectedFileId('');
        setSelectedExampleId(exampleId);
        setIsDirty(true);

        // Trigger narrative events for key examples
        // Note: Narrative system temporarily disabled to avoid circular dependency
        // if (exampleId === '10_sr-latch') {
        //   triggerNarrative('milestone.srLatchBuilt', { exampleId });
        // } else if (exampleId === '11_d-flipflop') {
        //   triggerNarrative('milestone.dffUnderstood', { exampleId });
        // } else if (exampleId === '04_4bit-counter') {
        //   triggerNarrative('milestone.counterRuns', { exampleId });
        // } else if (exampleId === '05_simple-cpu') {
        //   triggerNarrative('milestone.cpuExplored', { exampleId });
        // }

        // Milestone D: Record circuit loaded event
        if (determinismRecorder?.isRecording) {
          determinismRecorder.recordCircuitLoaded(loadedCircuit);
        }

        seedExampleProbes(exampleToLoad, loadedCircuit);
        if (exampleToLoad === '11_d-flipflop' || exampleToLoad === '04_4bit-counter') {
          setPerspective('debug');
        }

        // UX Polish: Auto-start simulation for examples so they feel "alive" immediately
        setIsRunning(true);
        if (tickEngineRef.current) {
          tickEngineRef.current.start();
        }

        // Clear pattern recognition state
        lastRecognizedPatternRef.current = null;
        // Clear hydration guard after load completes
        isHydratingRef.current = false;

        const exampleName = examples.current.find((ex) => ex.id === exampleToLoad)?.name ?? exampleToLoad;
        addToast(`Loaded example: ${exampleName}`, 'success');
      } catch (error) {
        isHydratingRef.current = false;
        addToast(`Failed to load example: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        console.error('Error loading example:', error);
      }
    };

    confirmReplacement('Load example', () => {
      void run();
    });
  };

  const handleLoadTutorialExample = async (filename: string) => {
    // Map tutorial filenames to example IDs
    const exampleMap: Record<string, ExampleId> = {
      '01_wire-lamp.json': '01_wire-lamp',
      '02_and-gate.json': '02_and-gate',
      '04_4bit-counter.json': '04_4bit-counter',
      '05_simple-cpu.json': '05_simple-cpu',
    };

    const exampleId = exampleMap[filename];
    if (!exampleId) {
      addToast(`Tutorial example not found: ${filename}`, 'warning');
      return;
    }

    await handleLoadExample(exampleId as ExampleId);
    const exampleName = examples.current.find((ex) => ex.id === exampleId)?.name ?? filename;
    addToast(`Loaded example: ${exampleName}`, 'success');
  };

  const handleExport = () => {
    const serialized = serialize(circuit);
    const blob = new Blob([JSON.stringify(serialized, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circuit.rblogic';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rblogic,application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const inputEl = e.target as HTMLInputElement;
        confirmReplacement('Import circuit', () => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              // Set hydration guard to prevent marking dirty during load
              isHydratingRef.current = true;
              const json = JSON.parse(evt.target?.result as string);
              const loadedCircuit = deserialize(json);
              setCircuit(loadedCircuit);
              const newEngine = new CircuitEngine(loadedCircuit);
              setEngine(newEngine);
              setTickEngine(new TickEngine(loadedCircuit, { tickRate: currentHz }));
              setCurrentFileId(null);
              setIsDirty(true);
              // Clear hydration guard after load completes
              isHydratingRef.current = false;
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              addToast(`Failed to import circuit: ${errorMessage}`, 'error');
            }
          };
          reader.readAsText(file);
          inputEl.value = '';
        });
      }
    };
    input.click();
  };

  const handleRun = () => {
    if (recorderMode === 'replaying') return;
    // Enable tracing when starting simulation
    tickEngine.enableTracing(1000);
    tickEngine.start();
    setIsRunning(true);
  };

  const handlePause = () => {
    if (recorderMode === 'replaying') return;
    tickEngine.pause();
    setIsRunning(false);

    // Update trace snapshots when pausing
    const recorder = tickEngine.getTraceRecorder();
    if (recorder) {
      setTraceSnapshots(recorder.getSnapshots());
    }
  };

  const handleStep = () => {
    if (recorderMode === 'replaying') return;
    try {
      const circuitSnapshot = tickEngine.getCircuit();
      const missingBehaviors = circuitSnapshot.nodes
        .map((node) => node.type)
        .filter((type) => !NodeRegistry.has(type));
      if (missingBehaviors.length > 0) {
        console.error('[LP_ENGINE] Missing node behaviors:', missingBehaviors);
      }
      if (typeof window !== 'undefined') {
        const debug = (window as any).__RB_DEBUG__ ?? {};
        debug.lastStep = {
          tick: tickEngine.getTickCount(),
          nodes: circuitSnapshot.nodes.length,
          connections: circuitSnapshot.connections.length,
          missingBehaviors,
        };
        (window as any).__RB_DEBUG__ = debug;
      }
      console.error('[LP_ENGINE] stepOnce() before', {
        tick: tickEngine.getTickCount(),
        nodes: circuitSnapshot.nodes.length,
        connections: circuitSnapshot.connections.length,
      });
      tickEngine.stepOnce();
      const newTick = tickEngine.getTickCount();
      console.error('[LP_ENGINE] stepOnce() after', { tick: newTick });
      setTickCount(newTick);
    } catch (err) {
      console.error('[LP_ENGINE] stepOnce() failed:', err);
      throw err;
    }
  };

  const handleResetTickCount = () => {
    if (recorderMode === 'replaying') return;
    tickEngine.resetTickCount();
    setTickCount(0);
  };

  const handleHzChange = (hz: number) => {
    if (recorderMode === 'replaying') return;
    setCurrentHz(hz);
    tickEngine.setTickRate(hz);
  };

  const handleSaveChip = (
    name: string,
    description: string,
    layer: number,
    inputs: ChipPort[],
    outputs: ChipPort[]
  ) => {
    if (!recognizedPattern) return;

    try {
      const chip = saveChipFromPattern(recognizedPattern, circuit, inputs, outputs);

      // Register the chip immediately so it can be used in circuits
      registerChip(chip);

      addToast(`Chip "${chip.name}" saved! You can now use it in your circuits.`, 'success', 4000);
      setShowSaveChipModal(false);
    } catch (error) {
      console.error('Failed to save chip:', error);
      addToast('Failed to save chip', 'error');
    }
  };

  const handleSelectChipFromLibrary = (chipId: string) => {
    const chip = getAllChips().find((c) => c.id === chipId);
    if (chip) {
      setSelectedNodeType(chip.name);
      addToast(`Click on canvas to place ${chip.name}`, 'info', 2000);
    }
  };

  const handleDeleteChip = (chipId: string) => {
    const chip = getAllChips().find((c) => c.id === chipId);
    if (chip) {
      // Unregister from NodeRegistry first to prevent ghost chips
      unregisterChip(chip.name);
    }
    deleteChip(chipId);
    addToast('Chip deleted', 'info');
  };

  const handleEnterChip = (nodeId: string) => {
    // Find the node in current circuit
    const node = circuit.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Check if this node type is a chip
    const chip = getAllChips().find((c) => c.name === node.type);
    if (!chip) {
      addToast(`${node.type} is not a chip (it's a primitive component)`, 'info');
      return;
    }

    // Enter the chip's internal circuit
    enterChip(chip, nodeId);
    addToast(`Entered ${chip.name} * Press Esc to exit`, 'info', 3000);
  };

  const getNodeDescription = (nodeType: string): string => {
    const descriptions: Record<string, string> = {
      PowerSource: 'Always ON - provides constant HIGH signal (1)',
      Switch: 'Toggle ON/OFF - click to toggle state',
      INPUT: 'Toggle ON/OFF - click to toggle state',
      Lamp: 'Visual indicator - lights up when signal is HIGH',
      OUTPUT: 'Visual indicator - lights up when signal is HIGH',
      Wire: 'Pass-through connection',
      AND: 'TRUE if both inputs are TRUE | Truth: 0,0->0 | 0,1->0 | 1,0->0 | 1,1->1',
      OR: 'TRUE if either input is TRUE | Truth: 0,0->0 | 0,1->1 | 1,0->1 | 1,1->1',
      NOT: 'Inverts input | Truth: 0->1 | 1->0',
      NAND: 'NOT AND - opposite of AND gate | Truth: 0,0->1 | 0,1->1 | 1,0->1 | 1,1->0',
      NOR: 'NOT OR - opposite of OR gate | Truth: 0,0->1 | 0,1->0 | 1,0->0 | 1,1->0',
      XOR: 'TRUE if inputs differ | Truth: 0,0->0 | 0,1->1 | 1,0->1 | 1,1->0',
      XNOR: 'TRUE if inputs are same | Truth: 0,0->1 | 0,1->0 | 1,0->0 | 1,1->1',
      Clock: 'Oscillates between HIGH/LOW periodically',
      Delay: 'Delays signal by configured number of ticks',
      VoltageSource: 'Analog supply - outputs a constant voltage (set in state/config)',
      LDR: 'Light-dependent resistor - outputs resistance based on light level',
      FixedResistor: 'Fixed resistor - outputs a constant resistance value',
      VoltageDivider: 'Computes Vout from Vin, R1, and R2',
      LM358: 'Comparator - outputs 1 when V+ > V-',
      RSLatch: 'Set-Reset memory latch - remembers 1 bit using feedback',
      DFlipFlop: 'D Flip-Flop - captures data on clock edge',
      JKFlipFlop: 'JK Flip-Flop - versatile flip-flop with toggle capability',
      FullAdder: 'Adds 2 bits + carry-in, outputs sum + carry-out',
      Counter4Bit: '4-bit binary counter - counts from 0 to 15',
    };
    return descriptions[nodeType] || nodeType;
  };

  const getChipMetadataForNode = (nodeType: string) => {
    // First check if it's a custom chip
    const chip = getAllChips().find((c) => c.name === nodeType);
    if (chip) {
      return {
        name: chip.name,
        inputs: chip.inputs.map((port) => ({ id: port.id, name: port.name })),
        outputs: chip.outputs.map((port) => ({ id: port.id, name: port.name })),
        color: chip.iconColor,
        layer: chip.layer,
      };
    }

    // Otherwise, provide metadata for built-in node types
    const builtinMetadata: Record<string, { inputs: Array<{ id: string; name: string }>; outputs: Array<{ id: string; name: string }>; layer: number; color?: string }> = {
      PowerSource: { inputs: [], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#ef4444' },
      Switch: { inputs: [], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#3b82f6' },
      INPUT: { inputs: [], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#3b82f6' },
      Lamp: { inputs: [{ id: 'in', name: 'in' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#fbbf24' },
      OUTPUT: { inputs: [{ id: 'in', name: 'in' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#fbbf24' },
      Wire: { inputs: [{ id: 'in', name: 'in' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#6b7280' },
      AND: { inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#8b5cf6' },
      OR: { inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#8b5cf6' },
      NOT: { inputs: [{ id: 'in', name: 'in' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#8b5cf6' },
      NAND: { inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#8b5cf6' },
      NOR: { inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#8b5cf6' },
      XOR: { inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], outputs: [{ id: 'out', name: 'out' }], layer: 1, color: '#10b981' },
      XNOR: { inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], outputs: [{ id: 'out', name: 'out' }], layer: 1, color: '#10b981' },
      Clock: { inputs: [], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#f59e0b' },
      Delay: { inputs: [{ id: 'in', name: 'in' }], outputs: [{ id: 'out', name: 'out' }], layer: 0, color: '#6b7280' },
      VoltageSource: { inputs: [], outputs: [{ id: 'out', name: 'out' }], layer: 2, color: '#38bdf8' },
      LDR: { inputs: [], outputs: [{ id: 'resistance', name: 'resistance' }, { id: 'v_out', name: 'v_out' }], layer: 2, color: '#facc15' },
      FixedResistor: { inputs: [], outputs: [{ id: 'resistance', name: 'resistance' }], layer: 2, color: '#cbd5f5' },
      VoltageDivider: { inputs: [{ id: 'v_in', name: 'v_in' }, { id: 'r1', name: 'r1' }, { id: 'r2', name: 'r2' }], outputs: [{ id: 'v_out', name: 'v_out' }], layer: 2, color: '#60a5fa' },
      LM358: { inputs: [{ id: 'V_plus', name: 'V+' }, { id: 'V_minus', name: 'V-' }], outputs: [{ id: 'out', name: 'out' }], layer: 2, color: '#fb7185' },
      // Composite nodes
      RSLatch: { inputs: [{ id: 'R', name: 'R' }, { id: 'S', name: 'S' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q' }], layer: 3, color: '#ec4899' },
      DFlipFlop: { inputs: [{ id: 'D', name: 'D' }, { id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q' }], layer: 3, color: '#ec4899' },
      JKFlipFlop: { inputs: [{ id: 'J', name: 'J' }, { id: 'K', name: 'K' }, { id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q' }], layer: 3, color: '#ec4899' },
      FullAdder: { inputs: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'Cin', name: 'Cin' }], outputs: [{ id: 'Sum', name: 'Sum' }, { id: 'Cout', name: 'Cout' }], layer: 2, color: '#14b8a6' },
      Counter4Bit: { inputs: [{ id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q0', name: 'Q0' }, { id: 'Q1', name: 'Q1' }, { id: 'Q2', name: 'Q2' }, { id: 'Q3', name: 'Q3' }], layer: 4, color: '#f97316' },
    };

    const metadata = builtinMetadata[nodeType];
    if (!metadata) return undefined;

    return {
      name: nodeType,
      inputs: metadata.inputs,
      outputs: metadata.outputs,
      color: metadata.color,
      layer: metadata.layer,
    };
  };

  const handleShare = async () => {
    try {
      const serialized = serialize(circuit);
      // Convert SerializedCircuitV1 to Circuit format for encoding
      const circuitForEncoding = {
        gates: serialized.nodes,
        wires: serialized.connections,
        inputs: [],
        outputs: [],
        metadata: {
          name: currentFileId ? getFile(currentFileId)?.name : 'Shared Circuit',
          version: serialized.version,
        },
      };

      // Lazy-load compressed encoder via async wrapper (code-splits pako)
      const encoded = await encodeCircuitCompressed(circuitForEncoding);

      const url = new URL(window.location.href);
      url.searchParams.set('circuit', encoded);

      // Try to copy to clipboard
      try {
        await navigator.clipboard.writeText(url.toString());
        addToast('Share link copied to clipboard!', 'success');
      } catch (clipboardError) {
        // Fallback: show modal with selectable input
        setShareFallbackURL(url.toString());
      }
    } catch (error) {
      addToast('Failed to create share link', 'error');
      console.error('Share error:', error);
    }
  };

  const handleClearURLAndReset = () => {
    // Clear URL parameter
    window.history.replaceState({}, '', window.location.pathname);

    resetAppStores();
    useCircuitStore.getState().reset(); // Ensure detailed history reset too

    // Reset to empty circuit
    const emptyCircuit: Circuit = { nodes: [], connections: [] };
    setCircuit(emptyCircuit);
    const newEngine = new CircuitEngine(emptyCircuit);
    setEngine(newEngine);
    setTickEngine(new TickEngine(emptyCircuit, { tickRate: currentHz }));
    setCurrentFileId(null);
    setIsDirty(false);
    setHdlProject(buildDefaultHdlProject());
    setFpgaProject(buildDefaultFpgaProject());
    setShowDecodeErrorModal(false);
    addToast('Circuit reset', 'info');
  };

  const sanitizeFilename = useCallback((name: string) => {
    const trimmed = name.trim() || 'rb-project';
    return trimmed.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '_');
  }, []);

  const downloadText = useCallback((filename: string, text: string, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadBlob = useCallback((filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const buildProject = useCallback((): RBProject => {
    const name = projectName.trim() || 'Untitled Project';
    const normalizedConstraintsText =
      typeof fpgaProject.constraints?.text === 'string'
        ? fpgaProject.constraints.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        : '';
    const hasFpgaConstraints = normalizedConstraintsText.trim().length > 0;
    const hasFpgaPreset = typeof fpgaProject.preset === 'string' && fpgaProject.preset.trim().length > 0;
    const fpga =
      enableHdlTab && (hasFpgaConstraints || hasFpgaPreset)
        ? {
            ...fpgaProject,
            top: typeof fpgaProject.top === 'string' && fpgaProject.top.trim().length > 0 ? fpgaProject.top : hdlProject.top,
            constraints: hasFpgaConstraints ? { type: 'xdc' as const, text: normalizedConstraintsText } : undefined,
            preset: hasFpgaPreset ? fpgaProject.preset : undefined,
          }
        : undefined;
    return createRBProject({
      createdAt: projectCreatedAt,
      name,
       description: projectDescription.trim() || undefined,
       circuit,
       hdl:
         enableHdlTab &&
         ((typeof hdlProject.top === 'string' && hdlProject.top.trim().length > 0) ||
           (Array.isArray(hdlProject.sources) && hdlProject.sources.some((s) => s.text.trim().length > 0)))
            ? hdlProject
            : undefined,
        fpga,
        layout: {
          perspectiveId: perspective,
          splitRatio,
          dock: {
           open: rightDockState !== 'collapsed',
          tab: rightDockTab,
        },
      },
      probes,
      oscilloscope: {
        timeWindowSec: oscilloscopeTimeWindowSec,
        paused: oscilloscopePauseScroll,
        showTickGuides: oscilloscopeShowTickGuides,
      },
      recorder: record ? { lastRunRecord: record } : undefined,
      meta: {
        appVersion,
        tickRate: currentHz,
        projectId,
        appSurface: 'logic-playground',
      },
    });
  }, [
    projectCreatedAt,
    projectName,
    projectDescription,
    circuit,
    perspective,
    splitRatio,
    rightDockState,
    rightDockTab,
    probes,
    oscilloscopeTimeWindowSec,
    oscilloscopePauseScroll,
    oscilloscopeShowTickGuides,
    record,
    appVersion,
    currentHz,
    projectId,
    enableHdlTab,
    hdlProject,
    fpgaProject,
  ]);

  useEffect(() => {
    buildProjectRef.current = buildProject;
  }, [buildProject]);

  const applyProject = useCallback(
    (project: RBProject) => {
      isHydratingRef.current = true;
      resetAppStores(); // Clear everything before applying project state

      const nextCircuit = project.circuit ?? { nodes: [], connections: [] };
      const nextTickRate = project.meta?.tickRate ?? tickRate;
      const newEngine = new CircuitEngine(nextCircuit);
      const newTickEngine = new TickEngine(nextCircuit, { tickRate: nextTickRate });

      setCircuit(nextCircuit);
      setEngine(newEngine);
      setTickEngine(newTickEngine);
      setCurrentHz(nextTickRate);
      useSettingsStore.getState().setTickRate(nextTickRate);
      setTickCount(newTickEngine.getTickCount());
      setIsRunning(false);
      setIsDirty(false);
      setCurrentFileId(null);
      setSelectedFileId('');
      setSelectedExampleId('');
      lastRecognizedPatternRef.current = null;

      setProjectName(project.name ?? 'Untitled Project');
      setProjectDescription(project.description ?? '');
      setProjectCreatedAt(project.createdAt ?? new Date().toISOString());
      if (typeof project.meta?.projectId === 'string' && project.meta.projectId.trim().length > 0) {
        setProjectId(project.meta.projectId.trim());
      }

      const coercedHdl = coerceToolchainProjectInput(project.hdl);
      setHdlProject(coercedHdl ?? buildDefaultHdlProject());

      const rawFpga = project.fpga;
      const nextFpga = rawFpga && rawFpga.board === 'basys3' ? rawFpga : buildDefaultFpgaProject();
      const normalizedFpgaConstraintsText =
        typeof nextFpga.constraints?.text === 'string'
          ? nextFpga.constraints.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          : '';
      const hasFpgaConstraints = normalizedFpgaConstraintsText.trim().length > 0;
      setFpgaProject({
        ...nextFpga,
        constraints: hasFpgaConstraints ? { type: 'xdc', text: normalizedFpgaConstraintsText } : undefined,
        preset: typeof nextFpga.preset === 'string' && nextFpga.preset.trim().length > 0 ? nextFpga.preset : undefined,
        top: typeof nextFpga.top === 'string' && nextFpga.top.trim().length > 0 ? nextFpga.top : undefined,
      });

      if (project.layout?.perspectiveId) {
        const perspectiveId = project.layout.perspectiveId;
        const validPerspectives = ['build', 'analyze', 'explain', 'explore', 'quad', 'circuit-only', 'schematic-only', 'scope-only', '3d-only', 'code-only', 'inspect', 'debug', 'schematic', 'learn'] as const;
        if ((validPerspectives as readonly string[]).includes(perspectiveId)) {
          setPerspective(perspectiveId as PerspectiveId);
        }
      }
      if (typeof project.layout?.splitRatio === 'number') {
        setSplitRatio(project.layout.splitRatio);
      }
      if (project.layout?.dock) {
        setRightDockState(project.layout.dock.open ? 'expanded' : 'collapsed');
        const dockTab = project.layout.dock.tab;
        if (dockTab && ['inspector', 'health', 'learn', 'probes', 'record', 'chips'].includes(dockTab)) {
          setRightDockTab(dockTab as RightDockTab);
        }
        if (dockTab === 'hdl' && enableHdlTab) {
          setRightDockTab('hdl');
        }
      }

      useProbeStore.getState().setProbes(project.probes ?? []);

      const oscilloscopeStore = useOscilloscopeStore.getState();
      if (typeof project.oscilloscope?.timeWindowSec === 'number') {
        oscilloscopeStore.setTimeWindowSec(project.oscilloscope.timeWindowSec);
      }
      if (typeof project.oscilloscope?.paused === 'boolean') {
        oscilloscopeStore.setPauseScroll(project.oscilloscope.paused);
      }
      if (typeof project.oscilloscope?.showTickGuides === 'boolean') {
        oscilloscopeStore.setShowTickGuides(project.oscilloscope.showTickGuides);
      }

      useRunRecorderStore.getState().setRecord(project.recorder?.lastRunRecord ?? null);
      isHydratingRef.current = false;
    },
    [
      tickRate,
      setPerspective,
      setSplitRatio,
      setRightDockState,
      setRightDockTab,
      setCircuit,
      setEngine,
      setTickEngine,
      enableHdlTab,
    ]
  );

  useEffect(() => {
    applyProjectRef.current = applyProject;
  }, [applyProject]);

  useEffect(() => {
    if (!recoveredData || hasAppliedRecoveryRef.current) return;
    recoveredDataRef.current = recoveredData;

    try {
      const snapshot = recoveredData as { payload?: { project?: RBProject; circuit?: Circuit; layout?: unknown } } | null;
      const payload = snapshot?.payload ?? {};

      if (payload.project) {
        applyProject(payload.project);
      } else {
        if (payload.circuit) {
          useCircuitStore.getState().updateCircuit(payload.circuit as Circuit, { skipHistory: true, enforceLimits: true });
          setCircuit(payload.circuit as Circuit);
          engineRef.current.setCircuit(payload.circuit as Circuit);
        }
        if (payload.layout) {
          applyLayoutSnapshot(payload.layout);
        }
      }
      addToast('Recovered previous session', 'success');
    } catch (error) {
      console.error('[Recovery] Failed to apply recovered data', error);
      addToast('Recovery failed; starting fresh', 'error');
    } finally {
      hasAppliedRecoveryRef.current = true;
    }
  }, [recoveredData, applyProject, applyLayoutSnapshot, addToast, setCircuit]);

  const handleNewProject = useCallback(() => {
    handleNew();
    saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'reset-workspace', true, getProjectSnapshot() ?? undefined);
    useLayoutStore.getState().resetLayout();
    useProbeStore.getState().clearProbes();
    useOscilloscopeStore.getState().setPauseScroll(false);
    useOscilloscopeStore.getState().setShowTimeCursor(true);
    useOscilloscopeStore.getState().setTimeWindowSec(10);
    useOscilloscopeStore.getState().setShowTickGuides(true);
    resetRunRecorder();
    setProjectName('Untitled Project');
    setProjectDescription('');
    setProjectCreatedAt(new Date().toISOString());
  }, [handleNew, resetRunRecorder, circuit, getLayoutSnapshot, safeMode]);

  const handleSaveProject = useCallback(() => {
    saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'autosave', true, getProjectSnapshot() ?? undefined);
    const project = buildProject();
    assertAppOutput('logic-playground', 'rb-project.json');
    downloadText('rb-project.json', encodeRBProject(project));
    addToast('Project exported', 'success');
  }, [buildProject, downloadText, addToast, circuit, getLayoutSnapshot, safeMode, getProjectSnapshot]);

  const handleSaveProjectArchive = useCallback(async () => {
    saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'autosave', true, getProjectSnapshot() ?? undefined);
    const project = buildProject();
    assertAppOutput('logic-playground', 'rbproj.zip');
    const zip = new JSZip();
    zip.file('rb-project.json', encodeRBProject(project));
    zip.file('circuit.rblogic', JSON.stringify(serialize(project.circuit), null, 2));
    zip.file(
      'README.txt',
      'RedByte project archive. Import rb-project.json from the Logic Playground to restore full state.'
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const safeName = sanitizeFilename(project.name ?? 'rb-project');
    downloadBlob(`${safeName}.rbproj.zip`, blob);
    addToast('Project archive exported', 'success');
  }, [buildProject, downloadBlob, sanitizeFilename, addToast, circuit, getLayoutSnapshot, safeMode, getProjectSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { windowId?: string } | undefined;
      if (detail?.windowId && windowId && detail.windowId !== windowId) return;
      if (ceMode) {
        setShowCEExportModal(true);
      } else {
        saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'autosave', true, getProjectSnapshot() ?? undefined);
        void handleSaveProjectArchive();
      }
    };
    window.addEventListener('rb:export-request', handler as EventListener);
    return () => window.removeEventListener('rb:export-request', handler as EventListener);
  }, [windowId, ceMode, handleSaveProjectArchive, circuit, getLayoutSnapshot, safeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'autosave', true, getProjectSnapshot() ?? undefined);
    };
    window.addEventListener('rb:hardware-session', handler as EventListener);
    return () => window.removeEventListener('rb:hardware-session', handler as EventListener);
  }, [circuit, getLayoutSnapshot, safeMode]);

  // rb:open-dock event bridge — lets Shell (and other packages) open a dock tab+subview
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const VALID_TABS = new Set<string>(['inspector', 'health', 'learn', 'probes', 'record', 'chips', 'io']);
    const VALID_SUBVIEWS = new Set<string>(['lessons', 'help', 'manual']);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || typeof detail.tab !== 'string' || !VALID_TABS.has(detail.tab)) return;
      const subview = typeof detail.subview === 'string' && VALID_SUBVIEWS.has(detail.subview)
        ? (detail.subview as LearnSubview)
        : undefined;
      const errorCode = typeof detail.errorCode === 'string' ? detail.errorCode : undefined;
      useLayoutStore.getState().openDock(detail.tab as RightDockTab, subview, errorCode);
    };
    window.addEventListener('rb:open-dock', handler);
    return () => window.removeEventListener('rb:open-dock', handler);
  }, []);

  const handleOpenProject = useCallback(() => {
    projectFileInputRef.current?.click();
  }, []);

  const handleExportEvidence = useCallback(() => {
    saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'autosave', true, getProjectSnapshot() ?? undefined);

    void (async () => {
      const { exportEvidence } = await import('../utils/evidenceExport');
      exportEvidence({
        circuit,
        selectedExampleId,
        probes,
        tickCount,
        traceRecorder: tickEngine?.getTraceRecorder?.() ?? null,
      });
      addToast('Lab evidence exported', 'success');
    })().catch((error) => {
      console.error('[LogicPlayground] Evidence export failed:', error);
      addToast('Failed to export evidence', 'error');
    });
  }, [circuit, selectedExampleId, probes, tickCount, tickEngine, addToast, getLayoutSnapshot, safeMode, getProjectSnapshot]);

  const handleProjectFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const inputEl = event.target;
      confirmReplacement('Import project', () => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const project = decodeRBProject(String(reader.result ?? ''));
            applyProject(project);
            addToast('Project loaded (simulation reset to apply state)', 'info');
          } catch (error) {
            console.error('Failed to load project', error);
            addToast('Failed to load project', 'error');
          }
        };
        reader.readAsText(file);
        inputEl.value = '';
      });
    },
    [applyProject, addToast, confirmReplacement]
  );

  const handleExportProject = useCallback(() => {
    setShowExportModal(true);
  }, []);

  const handleExportNetlist = useCallback(() => {
    const netlist = netlistFromCircuit(circuit);
    assertAppOutput('logic-playground', 'netlist.json');
    downloadText('netlist.json', stableStringify(netlist));
  }, [circuit, downloadText]);

  const handleExportVerilog = useCallback(() => {
    const netlist = netlistFromCircuit(circuit);
    const verilog = verilogFromNetlist(netlist);
    assertAppOutput('logic-playground', 'circuit.v');
    downloadText('circuit.v', verilog, 'text/plain');
  }, [circuit, downloadText]);

  const handleExportDebugBundle = useCallback(() => {
    const project = buildProject();
    const health = analyzeCircuitHealth(circuit);
    const proofPack = record
      ? buildProofPack(record, circuit, { appVersion, tickRate: currentHz })
      : undefined;
    const bundle = buildDebugBundle({
      project,
      circuit,
      proofPack,
      health,
      runRecord: record ?? undefined,
    });
    assertAppOutput('logic-playground', 'rb-debug-bundle.json');
    downloadText('rb-debug-bundle.json', stableStringify(bundle));
  }, [buildProject, circuit, record, appVersion, currentHz, downloadText]);

  // Board IO Handling
  const ioMapping = unifiedProject?.ioMapping;

  // Sync VirtualIOState -> Circuit Nodes (from 3D Lab or other apps)
  useEffect(() => {
    if (!unifiedProject?.boardMap?.virtualIOState || !ioMapping) return;

    const { switches = [], buttons = [] } = unifiedProject.boardMap.virtualIOState;
    let hasChanges = false;
    const nextNodes = circuit.nodes.map((node) => {
      const mapping = ioMapping.inputs.find((m) => m.nodeId === node.id);
      if (!mapping || !mapping.pin) return node;

      let shouldBeOn = false;
      if (mapping.pin.startsWith('SW')) {
        const idx = parseInt(mapping.pin.slice(2), 10);
        shouldBeOn = !!switches[idx];
      } else if (mapping.pin.startsWith('BTN')) {
        const idx = parseInt(mapping.pin.slice(3), 10);
        shouldBeOn = !!buttons[idx];
      }

      const current = !!node.state?.on;
      if (current !== shouldBeOn) {
        hasChanges = true;
        return { ...node, state: { ...node.state, on: shouldBeOn } };
      }
      return node;
    });

    if (hasChanges) {
      setCircuit({ ...circuit, nodes: nextNodes });
      // Also update engine instance
      const nextCircuit = { ...circuit, nodes: nextNodes };
      engine.setCircuit(nextCircuit);
      tickEngine.setCircuit(nextCircuit);
    }
  }, [unifiedProject?.boardMap?.virtualIOState, ioMapping, circuit, engine, tickEngine]);

  const ioInputStates = useMemo(() => {
    if (!ioMapping) return {};
    const states: Record<string, boolean> = {};
    ioMapping.inputs.forEach((entry) => {
      const node = circuit.nodes.find((n) => n.id === entry.nodeId);
      if (node && node.state && entry.pin) {
        states[entry.pin] = !!node.state.on;
      }
    });
    return states;
  }, [ioMapping, circuit]);

  const ioOutputStates = useMemo(() => {
    if (!ioMapping) return {};
    const states: Record<string, boolean> = {};
    const signals = engine.getAllSignals();
    ioMapping.outputs.forEach((entry) => {
      if (entry.pin && entry.nodeId) {
        const val = signals.get(entry.nodeId);
        states[entry.pin] = (val ?? 0) > 0;
      }
    });
    return states;
  }, [ioMapping, tickCount, engine]);

  const handleIoToggleInput = useCallback((entry: any) => {
    if (!entry.nodeId) return;
    const node = circuit.nodes.find((n) => n.id === entry.nodeId);
    if (!node) return;

    // Toggle switch state
    const newState = !node.state?.on;
    const nextCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) =>
        n.id === entry.nodeId ? { ...n, state: { ...n.state, on: newState } } : n
      ),
    };
    setCircuit(nextCircuit);
    engine.setCircuit(nextCircuit);
    tickEngine.setCircuit(nextCircuit);

    // Sync to Unified Project (VirtualIOState)
    if (entry.pin && unifiedProject) {
      const currentMap = unifiedProject.boardMap ?? {
        boardProfileId: 'basys3',
        virtualIOState: { switches: [], buttons: [] },
        signalToPinMap: {}
      };

      const nextSwitches = [...(currentMap.virtualIOState?.switches ?? [])];
      const nextButtons = [...(currentMap.virtualIOState?.buttons ?? [])];
      let changed = false;

      if (entry.pin.startsWith('SW')) {
        const idx = parseInt(entry.pin.slice(2), 10);
        if (!Number.isNaN(idx)) {
          nextSwitches[idx] = newState;
          changed = true;
        }
      } else if (entry.pin.startsWith('BTN')) {
        const idx = parseInt(entry.pin.slice(3), 10);
        if (!Number.isNaN(idx)) {
          nextButtons[idx] = newState;
          changed = true;
        }
      }

      if (changed) {
        updateProject((p) => ({
          ...p,
          boardMap: {
            ...currentMap,
            virtualIOState: { switches: nextSwitches, buttons: nextButtons },
          },
        }));
      }
    }
  }, [circuit, engine, tickEngine, unifiedProject, updateProject]);

  const handleIoInitialize = useCallback(() => {
    // TODO: Auto-map?
  }, []);

  const handleIoAssignPin = useCallback((entry: any, pin: string) => {
    // Logic to update mapping in project
    console.log('Assign pin:', entry, pin);
  }, []);

  useEffect(() => {
    const handlePlaygroundCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string; windowId?: string }>).detail;
      if (!detail?.command) return;

      if (detail.windowId && detail.windowId !== windowId) return;

      const focused = useWindowStore.getState().getFocusedWindow();
      if (!focused || focused.id !== windowId) return;

      switch (detail.command) {
        case 'playground-project-new':
          handleNewProject();
          return;
        case 'playground-project-save':
          handleSaveProject();
          return;
        case 'playground-project-open':
          handleOpenProject();
          return;
        case 'playground-project-export':
          handleExportProject();
          return;
        case 'playground-layout-build':
          setPerspective('build');
          return;
        case 'playground-layout-analyze':
          setPerspective('analyze');
          return;
        case 'playground-layout-explain':
          setPerspective('explain');
          return;
        case 'playground-layout-explore':
          setPerspective('explore');
          return;
        case 'playground-layout-quad':
          setPerspective('quad');
          return;
        case 'playground-layout-circuit-only':
          setPerspective('circuit-only');
          return;
        case 'playground-layout-schematic-only':
          setPerspective('schematic-only');
          return;
        case 'playground-layout-scope-only':
          setPerspective('scope-only');
          return;
        case 'playground-layout-3d-only':
          setPerspective('3d-only');
          return;
        case 'playground-layout-code-only':
          setPerspective('code-only');
          return;
        case 'playground-dock-info':
          setRightDockTab('inspector');
          if (rightDockState === 'collapsed') setRightDockState('peek');
          return;
        case 'playground-dock-health':
          setRightDockTab('health');
          if (rightDockState === 'collapsed') setRightDockState('peek');
          return;
        case 'playground-dock-learn':
          setRightDockTab('learn');
          if (rightDockState === 'collapsed') setRightDockState('peek');
          return;
        case 'playground-dock-probes':
          setRightDockTab('probes');
          if (rightDockState === 'collapsed') setRightDockState('peek');
          return;
        case 'playground-dock-chips':
          setRightDockTab('chips');
          if (rightDockState === 'collapsed') setRightDockState('peek');
          return;
        case 'playground-toggle-wire': {
          const logicView = (useLogicViewStore() as any).getState();
          const editingState = logicView.editingState;
          if (editingState.wireStartPort) {
            logicView.endWire();
            return;
          }
          logicView.setToolMode(logicView.toolMode === 'wire' ? 'select' : 'wire');
          return;
        }
        case 'playground-toggle-pause-scroll':
          useOscilloscopeStore.getState().togglePauseScroll();
          return;
        case 'playground-fit-view': {
          const size = useViewStateStore.getState().circuitViewSize;
          if (!size) return;
          if (circuit.nodes.length === 0) {
            (useLogicViewStore() as any).getState().setCamera({ x: 0, y: 0, zoom: 1 });
            return;
          }
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          circuit.nodes.forEach((node) => {
            minX = Math.min(minX, node.position.x);
            maxX = Math.max(maxX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxY = Math.max(maxY, node.position.y);
          });
          if (!isFinite(minX)) {
            (useLogicViewStore() as any).getState().setCamera({ x: 0, y: 0, zoom: 1 });
            return;
          }
          const nextCamera = fitToBounds({ minX, maxX, minY, maxY }, size.width, size.height, 100, 2);
          (useLogicViewStore() as any).getState().setCamera(nextCamera);
          return;
        }
        case 'playground-reset-view':
          (useLogicViewStore() as any).getState().setCamera({ x: 0, y: 0, zoom: 1 });
          return;
        case 'playground-clear-scope':
          useOscilloscopeStore.getState().requestClear();
          return;
      }
    };

    window.addEventListener('rb:playground-command', handlePlaygroundCommand as EventListener);
    return () => {
      window.removeEventListener('rb:playground-command', handlePlaygroundCommand as EventListener);
    };
  }, [
    windowId,
    circuit.nodes,
    rightDockState,
    handleNewProject,
    handleSaveProject,
    handleOpenProject,
    handleExportProject,
    setPerspective,
    setRightDockTab,
    setRightDockState,
  ]);

  const getDefaultAddPosition = () => {
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 400, y: 300 };
    }
    return { x: rect.width / 2, y: rect.height / 2 };
  };

  const canUndo = useCircuitStore.getState().canUndo();
  const canRedo = useCircuitStore.getState().canRedo();

  const viewLabel =
    splitScreenMode === 'single'
      ? activeViews[0] ?? 'circuit'
      : splitScreenMode === 'quad'
        ? activeViews.slice(0, 4).join('+')
        : activeViews.slice(0, 2).join('+');
  // Memoize chips array to avoid multiple store calls during render
  const allChips = React.useMemo(() => getAllChips(), [getAllChips]);

  // ====== CE MODE HANDLERS ======

  const handleCEResetWorkspace = () => {
    try {
      saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'reset-workspace', true, getProjectSnapshot() ?? undefined);
      // Clear autosave
      clearSavedCircuit();

      // Reset circuit to empty
      const emptyCircuit: Circuit = { nodes: [], connections: [] };
      setCircuit(emptyCircuit);
      engine.setCircuit(emptyCircuit);
      tickEngine.setCircuit(emptyCircuit);

      // Reset tick count
      tickEngine.resetTickCount();
      setTickCount(0);

      // Stop simulation
      if (isRunning) {
        tickEngine.pause();
        setIsRunning(false);
      }

      // Reset view
      setPerspective('build');
      (useLogicViewStore() as any).getState().setCamera({ x: 0, y: 0, zoom: 1 });

      addToast('Workspace reset to empty circuit', 'success');
      setShowCEResetModal(false);
    } catch (error) {
      console.error('Reset workspace error:', error);
      addToast('Failed to reset workspace', 'error');
    }
  };

  const handleResetWorkspace = useCallback(() => {
    if (ceMode) {
      handleCEResetWorkspace();
      return;
    }
    saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'reset-workspace', true, getProjectSnapshot() ?? undefined);
    executeNew();
    useLayoutStore.getState().resetLayout();
    addToast('Workspace reset', 'success');
  }, [ceMode, handleCEResetWorkspace, circuit, getLayoutSnapshot, safeMode, executeNew, addToast]);

  const handleResetLayout = useCallback(() => {
    saveSnapshot(circuit, getLayoutSnapshot(), { safeMode }, 'reset-layout', true, getProjectSnapshot() ?? undefined);
    useLayoutStore.getState().resetLayout();
    addToast('Layout reset', 'info');
  }, [circuit, getLayoutSnapshot, safeMode, addToast]);

  const handleCELoadExample = (example: any) => {
    const run = async () => {
      try {
        // example is the CEExample object with circuit already loaded
        const exampleCircuit = example.circuit || example;

        setCircuit(exampleCircuit);
        engine.setCircuit(exampleCircuit);
        tickEngine.setCircuit(exampleCircuit);

        // Pause simulation on load (especially for heavy circuits)
        if (isRunning) {
          tickEngine.pause();
          setIsRunning(false);
        }

        // Check if heavy and warn
        const nodeCount = exampleCircuit.nodes.length;
        const connCount = exampleCircuit.connections.length;
        if (isHeavyCircuit(nodeCount, connCount)) {
          addToast(`Large circuit loaded (${nodeCount} nodes). Simulation paused.`, 'info', 4000);
        } else {
          addToast(`Example loaded successfully`, 'success');
        }

        setShowCEExamplesModal(false);
      } catch (error) {
        console.error('Load example error:', error);
        addToast('Failed to load example', 'error');
      }
    };

    confirmReplacement('Load example', () => {
      void run();
    });
  };

  const handleCEExportBundle = () => {
    // ExportBundleModal handles the download internally
    // Just close the modal when user confirms
    addToast('Circuit exported successfully', 'success');
    setShowCEExportModal(false);
  };

  // PHASE 2C: Mount breadcrumb before JSX return
  if (import.meta.env.DEV || navigator.webdriver) {
    pushMount('LogicPlaygroundApp:return');
  }

  console.log('[LP_TRACE] About to return JSX', { hasUnifiedProject: Boolean(unifiedProject), hasCircuit: Boolean(circuit), nodeCount: circuit?.nodes?.length });

  return (
    <ErrorBoundary>
      <div className="h-full flex flex-col min-h-0 min-w-0 bg-gray-900 text-white" data-testid="logic-playground-root">
        {guardrail && (
          <GuardrailConfirmModal
            isOpen={Boolean(guardrail)}
            title={guardrail.title}
            message={guardrail.message}
            lossItems={guardrail.lossItems}
            confirmLabel={guardrail.confirmLabel}
            confirmTone={guardrail.confirmTone}
            onConfirm={() => {
              guardrail.onConfirm();
              closeGuardrail();
            }}
            onCancel={closeGuardrail}
            onExport={guardrail.onExport}
          />
        )}
        {/* Unified recovery flow (autosave > workspace > none) */}
        {unifiedRecovery.mode === 'autosave' && (
          <GuardrailConfirmModal
            isOpen={true}
            title="Restore autosave?"
            message={`An autosave is available from ${new Date(
              unifiedRecovery.autosaveMeta?.savedAtMs ?? Date.now(),
            ).toLocaleString()}. Restore it now?`}
            lossItems={['Discarding autosave will permanently delete the autosaved copy.']}
            confirmLabel="Restore"
            cancelLabel="Discard"
            confirmTone="warning"
            onConfirm={unifiedRecovery.restoreAutosave}
            onCancel={unifiedRecovery.discardAutosave}
          />
        )}
        {unifiedRecovery.mode === 'workspace' && (
          <RecoveryBanner onRecover={unifiedRecovery.restoreWorkspace} onStartFresh={unifiedRecovery.dismissWorkspace} />
        )}
        {syncWarning && (
          <div className="bg-amber-900/80 border-b border-amber-600 px-4 py-2 text-xs text-amber-100 flex items-center justify-between">
            <span>{syncWarning}</span>
            <button
              type="button"
              onClick={() => setSyncWarning(null)}
              className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Intent Resource Display */}
        {resourceId && (
          <div className="bg-cyan-900/30 border-b border-cyan-700 p-2 text-xs">
            Opened from Files: <span className="font-semibold">{resourceId}</span> ({resourceType})
          </div>
        )}

        {/* Hierarchy Breadcrumbs */}
        <HierarchyBreadcrumbs />

        {/* Classroom guardrail banners */}
        <ClassroomModeBanner />

        {/* Top Command Bar - vNext Design */}
        <TopCommandBar
          onExamples={ceMode ? () => setShowCEExamplesModal(true) : () => setShowExamplesModal(true)}
          projectName={projectName}
          onNew={handleNew}
          onNewProject={handleNewProject}
          onSaveProject={handleSaveProject}
          onOpenProject={handleOpenProject}
          onExportProject={ceMode ? () => setShowCEExportModal(true) : handleExportProject}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onShare={handleShare}
          isDirty={isDirty}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          isRunning={isRunning}
          onRun={handleRun}
          onPause={handlePause}
          onStep={handleStep}
          tickCount={tickCount}
          tickRate={currentHz}
          onTickRateChange={handleHzChange}
          onResetTickCount={handleResetTickCount}
          onReset={ceMode ? () => setShowCEResetModal(true) : undefined}
          perspective={perspective}
          onPerspectiveChange={setPerspective}
          schematicMiniEnabled={schematicMiniEnabled}
          onToggleSchematicMini={toggleSchematicMini}
          onManual={() => useLayoutStore.getState().openDock('learn', 'manual')}
          onHelp={() => setShowKeyboardHelp(true)}
          onStartHere={() => setShowStartHere(true)}
          onExportEvidence={handleExportEvidence}
          onOpenEvidence={() => onOpenApp?.('submission-inspector')}
          onResetWorkspace={handleResetWorkspace}
          onResetLayout={handleResetLayout}
        />

        <input
          ref={projectFileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleProjectFileChange}
          className="hidden"
          aria-label="Open project file"
        />

        <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
          {/* Left Sidebar - Enhanced Palette (PR3) */}
          <EnhancedPalette
            primitiveNodes={PRIMITIVE_NODES}
            compositeNodes={COMPOSITE_NODES}
            chips={allChips}
            onNodeDragStart={handleNodeDragStart}
            onAddNode={handleAddNode}
            onChipLibraryOpen={() => setShowChipLibrary(true)}
            getChipMetadata={getChipMetadataForNode}
            getNodeDescription={getNodeDescription}
            isReplayMode={isReplayMode}
          />

          {/* Center - Canvas */}
          <div
            ref={canvasAreaRef}
            tabIndex={-1}
            className="flex-1 min-h-0 min-w-0 relative outline-none"
            data-testid="logic-canvas"
            onDragOver={handleNodeDragOver}
            onDrop={handleNodeDrop}
            onDragEnd={() => {
              // Clean up drag state when drag ends
              setDraggingNodeType(null);
              setDragPosition(null);
            }}
          >
            {/* Drag preview indicator */}
            {dragPosition && draggingNodeType && (
              <div
                className="absolute pointer-events-none z-50"
                style={{
                  left: `${dragPosition.x}px`,
                  top: `${dragPosition.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="px-3 py-2 bg-cyan-500/20 border-2 border-cyan-500 rounded-lg shadow-lg backdrop-blur-sm">
                  <div className="text-xs font-semibold text-cyan-300">{draggingNodeType}</div>
                </div>
              </div>
            )}

            {/* Empty State Message (shown when canvas is empty in demo mode) */}
            {circuit.nodes.length === 0 && isDemoMode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg px-8 py-6 max-w-md text-center shadow-2xl">
                  <div className="text-2xl text-cyan-400 mb-3">Get Started</div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Drag components from the left palette to begin building your circuit, or{' '}
                    <button
                      onClick={() => setShowOpenModal(true)}
                      className="text-cyan-400 hover:text-cyan-300 underline pointer-events-auto"
                    >
                      load an example
                    </button>
                    .
                  </p>
                </div>
              </div>
            )}

            {disableSplitView ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-300">
                Split view disabled by debug flag.
              </div>
            ) : (
              <SplitViewLayout
                mode={e2eDisableQuad && splitScreenMode === 'quad' ? 'single' : splitScreenMode}
                views={e2eDisableQuad ? [activeViews[0] ?? 'circuit'] : activeViews}
                splitRatio={splitRatio}
                windowId={windowId}
                engine={engine}
                tickEngine={tickEngine}
                circuit={circuit}
                isRunning={isRunning}
                tickCount={tickCount}
                debugSignals={debugSignals}
                debugTick={debugTick}
                mismatchWireHighlights={mismatchWireHighlights}
                mismatchNodeIds={mismatchNodeIds}
                mismatchPortKeys={mismatchPortKeys}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                getChipMetadata={getChipMetadataForNode}
                onNodeDoubleClick={handleEnterChip}
                showCircuitHints={false}
                onDismissCircuitHints={() => setShowCircuitHints(false)}
                showSchematicHints={false}
                onDismissSchematicHints={() => setShowSchematicHints(false)}
                show3DHints={false}
                onDismiss3DHints={() => setShow3DHints(false)}
                showOscilloscopeHints={false}
                onDismissOscilloscopeHints={() => setShowOscilloscopeHints(false)}
                onInputToggled={handleInputToggled}
                onCircuitChange={handleCircuitChange}
                viewStateStore={useViewStateStore}
                onProbeToggle={handleProbeToggle}
                probedPorts={probedPorts}
                probeWireHighlights={probeWireHighlights}
                highlightedPort={highlightedPort}
                isReplayMode={isReplayMode}
                onHelpOpen={(section) => {
                  setHelpDockSection(section);
                  setShowHelpDock(true);
                }}
                disableToolStrip={disableToolStrip}
              />
            )}
            {isReplayMode && (
              <div className="absolute inset-0 z-30 pointer-events-none">
                <div className="absolute top-3 right-3 bg-gray-900/80 border border-gray-700 rounded px-2 py-2 text-[10px] text-cyan-300 font-mono pointer-events-auto">
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wide">Replay</span>
                    <span>t{playheadTick}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      onClick={replayPaused ? handleRunReplayResume : handleRunReplayPause}
                      className="px-1.5 py-0.5 border border-gray-600 rounded text-[10px] text-gray-200 hover:bg-gray-800"
                      type="button"
                    >
                      {replayPaused ? 'Play' : 'Pause'}
                    </button>
                    <button
                      onClick={() => handleRunReplayStep(1)}
                      className="px-1.5 py-0.5 border border-gray-600 rounded text-[10px] text-gray-200 hover:bg-gray-800"
                      type="button"
                      disabled={!replayPaused}
                      title={!replayPaused ? 'Pause replay to step' : undefined}
                    >
                      Step
                    </button>
                    <button
                      onClick={() => handleRunReplayStep(10)}
                      className="px-1.5 py-0.5 border border-gray-600 rounded text-[10px] text-gray-200 hover:bg-gray-800"
                      type="button"
                      disabled={!replayPaused}
                      title={!replayPaused ? 'Pause replay to step' : undefined}
                    >
                      +10
                    </button>
                    <button
                      onClick={handleRunReplayStop}
                      className="px-1.5 py-0.5 border border-red-700 rounded text-[10px] text-red-300 hover:bg-red-900/30"
                      type="button"
                    >
                      Exit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedExampleId && EXAMPLE_NOTES[selectedExampleId] && !exampleNoteDismissed && (
              <div className="absolute top-3 left-3 z-20 max-w-sm pointer-events-auto">
                <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-4 py-3 text-xs shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-cyan-300">
                        What to do
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {EXAMPLE_NOTES[selectedExampleId]?.title}
                      </div>
                      <div className="text-gray-300 mt-1 leading-relaxed">
                        {EXAMPLE_NOTES[selectedExampleId]?.description}
                      </div>
                    </div>
                    <button
                      onClick={() => setExampleNoteDismissed(true)}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                      aria-label="Dismiss example note"
                      type="button"
                    >
                      x
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tutorialActive && <TutorialOverlay onLoadExample={handleLoadTutorialExample} />}
          </div>

          {/* Right Dock or Help Dock depending on perspective */}
          {showHelpDock ? (
            <HelpDock
              visible={true}
              focusSection={helpDockSection}
              onClose={() => {
                setShowHelpDock(false);
                setHelpDockSection(null);
              }}
              onLoadExample={(exampleId, highlightComponents) => {
                handleLoadExample(exampleId);
                // TODO: Implement component highlighting
                if (highlightComponents && import.meta.env.DEV) {
                  console.log('Highlighting components:', highlightComponents);
                }
              }}
            />
          ) : !disableRightDock ? (
            <RightDock
              circuit={circuit}
              engine={engine}
              isRunning={isRunning}
              windowId={windowId}
              isReplayMode={isReplayMode}
              onRun={handleRun}
              onPause={handlePause}

              onStep={handleStep}
              onResetTickCount={handleResetTickCount}
              ioMapping={ioMapping}
              ioInputStates={ioInputStates}
              ioOutputStates={ioOutputStates}
              onIoToggleInput={handleIoToggleInput}
              onIoInitialize={handleIoInitialize}
              onIoAssignPin={handleIoAssignPin}
              enableHdlTab={enableHdlTab}
              hdlProject={hdlProject}
              onHdlProjectChange={handleHdlProjectChange}
              fpgaProject={fpgaProject}
              onFpgaProjectChange={handleFpgaProjectChange}
              lastTickAt={lastTickAt}
              highlightProbePaths={highlightProbePaths}
              onToggleHighlightProbePaths={setHighlightProbePaths}
              onNodeUpdate={handleNodeUpdate}
              onConnectionDelete={handleConnectionDelete}
              onFocusNode={handleFocusNode}
              onIssueHover={(nodeId, portName) => {
                if (!nodeId || !portName) {
                  setHighlightedPort(null);
                  return;
                }
                setHighlightedPort({ nodeId, portName });
              }}
              tickCount={tickCount}
              tickRate={currentHz}
              onRecordArm={handleRunRecorderArm}
              onRecordStart={handleRunRecorderStart}
              onRecordStop={handleRunRecorderStop}
              onRecordReplayStart={handleRunReplayStart}
              onRecordReplayStop={handleRunReplayStop}
              onRecordReplayPause={handleRunReplayPause}
              onRecordReplayResume={handleRunReplayResume}
              onRecordReplayStep={handleRunReplayStep}
              onRecordReplayJump={handleRunReplayJump}
              onRecordVerify={verifyRunReplay}
              onRecordExport={handleRunRecorderExport}
              onRecordExportProof={handleRunRecorderExportProof}
              onRecordProof={handleRunRecorderProof}
              onRecordFocus={handleRunRecorderFocus}
              onRecordMismatchSelect={handleMismatchSelect}
              onRecordImportProofPack={handleRunRecorderImportProofPack}
              onLoadExample={handleLoadLearnExample}
              onExitLearnMode={handleExitLearnMode}
              onOpenApp={onOpenApp}
              chips={allChips}
              initialState={rightDockState}
              initialTab={rightDockTab}
              onStateChange={setRightDockState}
              onTabChange={setRightDockTab}
            />
          ) : null}
        </div>

        {/* Loading Overlay */}
        {isLoadingSharedCircuit && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
                <span className="text-white">Loading shared circuit...</span>
              </div>
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Clipboard Fallback Modal */}
        {shareFallbackURL && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4">
              <h3 className="text-lg font-semibold mb-3 text-white">Share Link Ready</h3>
              <p className="text-sm text-gray-300 mb-4">
                Automatic clipboard copy failed. Please copy the link manually:
              </p>
              <input
                type="text"
                readOnly
                value={shareFallbackURL}
                onClick={(e) => e.currentTarget.select()}
                aria-label="Share link"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white font-mono text-sm mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareFallbackURL).catch(() => { });
                    addToast('Link copied!', 'success');
                    setShareFallbackURL(null);
                  }}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm"
                >
                  Copy
                </button>
                <button
                  onClick={() => setShareFallbackURL(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                >
                  Close
                </button>
              </div>
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Decode Error Modal */}
        {showDecodeErrorModal && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-3 text-red-400">Invalid Share Link</h3>
              <p className="text-sm text-gray-300 mb-4">
                This share link is invalid or corrupted. The circuit could not be loaded.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleClearURLAndReset}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm"
                >
                  Clear URL & Start Fresh
                </button>
                <button
                  onClick={() => setShowDecodeErrorModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                >
                  Close
                </button>
              </div>
              <a
                href="https://github.com/swaggyp52/redbyte-ui-genesis/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-4 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Report Issue -&gt;
              </a>
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-3 text-white">Export</h3>
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => {
                    handleSaveProject();
                    setShowExportModal(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left"
                >
                  Project (rb-project.json)
                </button>
                <button
                  onClick={() => {
                    void handleSaveProjectArchive();
                    setShowExportModal(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left"
                >
                  Project Archive (.rbproj.zip)
                </button>
                <button
                  onClick={() => {
                    handleExportNetlist();
                    setShowExportModal(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left"
                >
                  Netlist (netlist.json)
                </button>
                <button
                  onClick={() => {
                    handleExportVerilog();
                    setShowExportModal(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left"
                >
                  Verilog (circuit.v)
                </button>
                <button
                  onClick={() => {
                    handleExportDebugBundle();
                    setShowExportModal(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left"
                >
                  Debug Bundle (rb-debug-bundle.json)
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                >
                  Close
                </button>
              </div>
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Save As Modal */}
        {showSaveAsModal && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-3 text-white">Save Circuit As...</h3>
              <input
                type="text"
                value={saveAsFilename}
                onChange={(e) => setSaveAsFilename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmSaveAs();
                  if (e.key === 'Escape') setShowSaveAsModal(false);
                }}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white mb-4"
                placeholder="circuit.rblogic"
                aria-label="Save as filename"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={confirmSaveAs}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveAsModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Open File Modal */}
        {showOpenModal && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-3 text-white">Open Circuit</h3>
              {availableFiles.length === 0 ? (
                <p className="text-sm text-gray-300 mb-4">
                  No saved circuits found. Create one with Ctrl+S.
                </p>
              ) : (
                <div className="mb-4 max-h-64 overflow-y-auto">
                  {availableFiles.map((file, index) => (
                    <button
                      key={file.id}
                      onClick={() => handleOpenFile(file.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleOpenFile(file.id);
                        if (e.key === 'Escape') setShowOpenModal(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded mb-2 text-white text-sm transition-colors"
                      autoFocus={index === 0}
                    >
                      <div className="font-medium">{file.name}</div>
                      <div className="text-xs text-gray-400">
                        Modified: {file.modified}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Examples Modal */}
        {showExamplesModal && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
              <h3 className="text-lg font-semibold mb-3 text-white">Load Example</h3>
              <div className="flex-1 overflow-y-auto mb-4">
                {([0, 1, 2, 3, 4, 5, 6] as CircuitLayer[]).map((layer) => {
                  const layerExamples = listExamplesByLayer(layer);
                  if (layerExamples.length === 0) return null;
                  return (
                    <div key={layer} className="mb-4">
                      <h4 className="text-sm font-semibold text-cyan-400 mb-2">
                        Layer {layer}: {getLayerDescription(layer)}
                      </h4>
                      <div className="space-y-1">
                        {layerExamples.map((ex) => (
                          <button
                            key={ex.id}
                            onClick={() => {
                              handleLoadExample(ex.id);
                              setShowExamplesModal(false);
                            }}
                            className="w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded text-white text-sm transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{ex.name}</span>
                              <span className="text-xs text-gray-400">{ex.difficulty}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 justify-end border-t border-gray-700 pt-4">
                <button
                  onClick={() => setShowExamplesModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Save as Chip Modal */}
        {showSaveChipModal && recognizedPattern && (
          <SaveChipModal
            circuit={circuit}
            recognizedPattern={recognizedPattern}
            onSave={handleSaveChip}
            onCancel={() => setShowSaveChipModal(false)}
          />
        )}

        {/* Trace Viewer Modal */}
        {showTraceViewer && (
          <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
            <OverlayPanel className="bg-gray-900 rounded-lg shadow-2xl w-[90%] h-[90%] max-w-5xl overflow-hidden border border-gray-700">
              <TraceViewer
                traces={traceSnapshots}
                circuit={circuit}
                currentTick={tickEngine.getTickCount()}
                onClose={() => setShowTraceViewer(false)}
              />
            </OverlayPanel>
          </OverlayRoot>
        )}

        {/* Chip Library Modal */}
        <ChipLibraryModal
          isOpen={showChipLibrary}
          onClose={() => setShowChipLibrary(false)}
          chips={allChips}
          onSelectChip={handleSelectChipFromLibrary}
          onDeleteChip={handleDeleteChip}
          onDragStart={handleNodeDragStart}
        />

        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsHelp
          isOpen={showKeyboardHelp}
          onClose={() => setShowKeyboardHelp(false)}
        />

        {/* Quick Add Palette */}
        <QuickAddPalette
          isOpen={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          onSelectComponent={(type) => {
            console.log(`[LogicPlaygroundApp] onSelectComponent called with: ${type}`);
            if (isReplayMode) return;
            const pos = getDefaultAddPosition();
            console.log(`[LogicPlaygroundApp] Calling storeAddNode(${type}, ${JSON.stringify(pos)})`);
            storeAddNode(type, pos);
            console.log(`[LogicPlaygroundApp] storeAddNode completed`);
            setShowQuickAdd(false);
          }}
          isReplayMode={isReplayMode}
        />

        {/* Start Here Panel */}
        <StartHerePanel
          isOpen={showStartHere}
          onClose={() => setShowStartHere(false)}
          onLoadExample={async (exampleId) => {
            // Load D Flip-Flop example
            try {
              const example = await loadExample(exampleId as ExampleId);
              if (example) {
                const deserialized = deserialize(example);
                setCircuit(deserialized);
                engine.setCircuit(deserialized);
                tickEngine.setCircuit(deserialized);
                addToast('Example loaded successfully', 'success');
              }
            } catch (error) {
              console.error('Failed to load example:', error);
              addToast('Failed to load example', 'error');
            }
            setShowStartHere(false);
          }}
          onOpenOscilloscope={() => {
            setPerspective('analyze'); // Analyze perspective shows oscilloscope
            setRightDockTab('probes');
            if (rightDockState === 'collapsed') {
              setRightDockState('expanded');
            }
            setShowStartHere(false);
          }}
          onStartGuidedLab={() => {
            setShowStartHere(false);
            // Launch Lab Assignment App with Lab 1
            if (onOpenApp) {
              onOpenApp('ece-lab', { labId: 'guided-01' });
            } else {
              addToast('Lab Assignment App not available in this environment', 'error');
            }
          }}
        />

        {/* CE Mode Modals */}
        {ceMode && (
          <>
            <ResetWorkspaceModal
              isOpen={showCEResetModal}
              onConfirm={handleCEResetWorkspace}
              onCancel={() => setShowCEResetModal(false)}
            />

            <ExampleGalleryModal
              isOpen={showCEExamplesModal}
              examples={[]} // TODO: Load CE example pack
              onSelectExample={handleCELoadExample}
              onClose={() => setShowCEExamplesModal(false)}
            />

            <ExportBundleModal
              isOpen={showCEExportModal}
              circuit={circuit}
              exampleName={projectName}
              onClose={() => setShowCEExportModal(false)}
            />
          </>
        )}

        {/* Status Bar */}
        <StatusBar
          nodeCount={circuit.nodes.length}
          connectionCount={circuit.connections.length}
          selectedCount={0}
          isRunning={isRunning}
          tickRate={currentHz}
          isDirty={isDirty}
          saveStatusText={undefined}
          canUndo={canUndo}
          canRedo={canRedo}
          viewMode={viewLabel}
        />


      </div>
    </ErrorBoundary>
  );
};

// End of LogicPlaygroundApp components

export const LogicPlaygroundApp: RedByteApp = {
  manifest: {
    id: 'logic-playground',
    name: 'Logic Playground',
    iconId: 'logic',
    category: 'logic',
    defaultSize: { width: 1200, height: 720 },
    minSize: { width: 800, height: 600 },
  },
  component: LogicPlaygroundComponent,
};
