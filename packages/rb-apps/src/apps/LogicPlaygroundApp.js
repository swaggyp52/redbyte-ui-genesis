import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
// v1.0.1 - Multi-view enhancement with null safety
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { CircuitEngine, TickEngine, serialize, deserialize, decodeCircuitAsync, encodeCircuitCompressed, } from '@redbyte/rb-logic-core';
import { useSettingsStore, useUiTickStore, enableWatchdog, installFatalCapture, pushMount } from '@redbyte/rb-utils';
import { toast, OverlayRoot, OverlayPanel } from '@redbyte/rb-primitives';
import { useWindowStore } from '@redbyte/rb-windowing';
import { loadExample, listExamples, listExamplesByLayer, getLayerDescription } from '../examples';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useChipStore } from '../stores/chipStore';
import { useCircuitStore } from '../stores/circuitStore';
import { useTutorialStore } from '../tutorial/tutorialStore';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import { recognizePattern } from '../patterns/patternMatcher';
import { SaveChipModal } from '../components/SaveChipModal';
import { ChipLibraryModal } from '../components/ChipLibraryModal';
import { TraceViewer } from '../components/TraceViewer';
import { SplitViewLayout } from '../components/SplitViewLayout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { registerAllChips, registerChip, unregisterChip } from '../utils/chipRegistry';
import { useViewStateStore } from '../stores/viewStateStore';
import { useProbeStore } from '../stores/probeStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useOscilloscopeStore } from '../stores/oscilloscopeStore';
import { setGlobalViewStateSync, useLogicViewStore, findSmartSpawnPosition } from '@redbyte/rb-logic-view';
import { screenToWorld, snapToGrid, fitToBounds } from '@redbyte/rb-viewport';
import { useHierarchyStore } from '../stores/hierarchyStore';
import { buildProbeWireHighlights } from '../utils/probeHighlight';
import { useRunRecorderStore } from '../stores/runRecorderStore';
import { encodeRunRecord, indexStimulusByTick } from '../recording/runRecord';
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
import { createRBProject, decodeRBProject, encodeRBProject } from '../export/projectFormat';
import { stableStringify } from '../export/stableStringify';
import { verilogFromNetlist } from '../export/verilogExport';
import { HierarchyBreadcrumbs } from '../components/HierarchyBreadcrumbs';
import { KeyboardShortcutsHelp } from '../components/KeyboardShortcutsHelp';
import { QuickAddPalette } from '../components/QuickAddPalette';
import { StatusBar } from '../components/StatusBar';
import { TopCommandBar } from '../components/TopCommandBar';
import { RightDock } from '../components/RightDock';
import { EnhancedPalette } from '../components/EnhancedPalette';
import { HelpDock } from '../components/HelpDock';
import { useAutosaveCircuit, loadSavedCircuit, clearSavedCircuit } from '../utils/ceAutosave';
import { isCEMode, getCEConfig, isHeavyCircuit } from '../utils/ceMode';
import { ResetWorkspaceModal, ExampleGalleryModal, ExportBundleModal } from '../components/CEUIComponents';
import { ClassroomModeBanner } from '../components/ClassroomModeBanner';
import { useClassroomModeStore } from '../stores/classroomModeStore';
import { validateCircuitData } from '../utils/circuitValidation';
import { StartHerePanel } from '../components/StartHerePanel';
import { exportEvidence } from '../utils/evidenceExport';
import { useEvidenceViewerStore } from '../stores/evidenceViewerStore';
// Placeholder for evidence viewer (feature in development)
// Place appVersion at module scope to avoid ReferenceError in hooks
const appVersion = import.meta.env?.VITE_APP_VERSION ??
    'dev';
import { EvidenceViewerPanel } from '../components/EvidenceViewerPanel';
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
};
// Composite node types (built-in multi-gate circuits)
const COMPOSITE_NODES = [
    'RSLatch',
    'DFlipFlop',
    'JKFlipFlop',
    'FullAdder',
    'Counter4Bit',
];
const EXAMPLE_NOTES = {
    '11_d-flipflop': {
        title: 'D Flip-Flop Demo',
        description: 'Toggle Data, then run or step the clock to see Q update only on rising edges.',
    },
    '04_4bit-counter': {
        title: '4-bit Counter Demo',
        description: 'Run the clock and watch the lamps count in binary. Slow the tick rate to follow each step.',
    },
};
// Outer gate component: handles feature gates with stable hook set
export const LogicPlaygroundComponent = (props) => {
    // Gate-only hooks (stable and minimal - ALWAYS called)
    const evidenceBundle = useEvidenceViewerStore((s) => s.evidenceBundle);
    // Debug flags (useMemo is stable)
    const debugFlags = React.useMemo(() => {
        if (!import.meta.env.DEV)
            return new Set();
        const raw = localStorage.getItem('rb-debug-playground') || '';
        return new Set(raw
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean));
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
        return _jsx("div", { "data-testid": "playground-debug-disabled", children: "Playground view disabled by debug flag." });
    }
    if (evidenceBundle) {
        return _jsx(EvidenceViewerPanel, {});
    }
    // Render inner component with all the real hooks
    return _jsx(LogicPlaygroundInner, { ...props, debugFlags: debugFlags });
};
const LogicPlaygroundInner = ({ windowId, initialFileId, initialExampleId, resourceId, resourceType, onOpenApp, registerStateAccessor, unregisterStateAccessor, determinismRecorder, debugFlags, }) => {
    const disableToolStrip = debugFlags.has('disable-toolstrip');
    const disableRightDock = debugFlags.has('disable-rightdock');
    const disableSplitView = debugFlags.has('disable-splitview');
    // E2E flags via querystring (test-only)
    const e2eParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const e2eDisableQuad = e2eParams.get('disableQuad') === '1';
    const e2eCpuLite = e2eParams.get('cpuLite') === '1';
    const tickRate = useSettingsStore((state) => state.tickRate);
    const [circuit, setCircuit] = useState(() => {
        // Try to restore saved CE circuit first
        const savedCircuit = loadSavedCircuit();
        if (savedCircuit) {
            return savedCircuit;
        }
        return {
            nodes: [],
            connections: [],
        };
    });
    const setCircuitRef = useRef(setCircuit);
    const [engine, setEngine] = useState(() => new CircuitEngine(circuit));
    const [tickEngine, setTickEngine] = useState(() => new TickEngine(circuit, { tickRate }));
    const unifiedProject = useUnifiedProjectStore((s) => s.currentProject);
    const createNewProject = useUnifiedProjectStore((s) => s.createNewProject);
    const updateProject = useUnifiedProjectStore((s) => s.updateProject);
    const hasSyncedFromProjectRef = useRef(false);
    const lastRecordingKeyRef = useRef(null);
    const normalizeConnection = useCallback((conn) => {
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
    const toCircuitV1 = useCallback((src) => {
        return {
            schemaVersion: '1.0',
            nodes: src.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                x: node.x || 0,
                y: node.y || 0,
                rotation: node.rotation || 0,
                params: node.config || {},
                label: node.label,
                state: node.state || {},
            })),
            connections: src.connections.map((conn) => {
                const normalized = normalizeConnection(conn);
                return {
                    id: conn.id || `${normalized.fromNodeId}-${normalized.fromPin}-${normalized.toNodeId}-${normalized.toPin}`,
                    fromNodeId: normalized.fromNodeId,
                    fromPin: normalized.fromPin,
                    toNodeId: normalized.toNodeId,
                    toPin: normalized.toPin,
                };
            }),
            customChips: [],
        };
    }, [normalizeConnection]);
    const fromCircuitV1 = useCallback((src) => {
        return {
            nodes: src.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                x: node.x,
                y: node.y,
                rotation: node.rotation,
                config: node.params || {},
                label: node.label,
                state: node.state || {},
                inputs: {},
                outputs: {},
            })),
            connections: src.connections.map((conn) => ({
                id: conn.id,
                from: { nodeId: conn.fromNodeId, portName: conn.fromPin || 'out' },
                to: { nodeId: conn.toNodeId, portName: conn.toPin || 'in' },
            })),
        };
    }, []);
    const addToast = useCallback((message, kind = 'info', duration) => {
        toast[kind]({ message, duration });
    }, []);
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
    useEffect(() => {
        if (!unifiedProject && !createdProjectRef.current) {
            createNewProject('Untitled Project');
            createdProjectRef.current = true;
        }
    }, [unifiedProject, createNewProject]);
    useEffect(() => {
        if (!unifiedProject || hasSyncedFromProjectRef.current)
            return;
        if (circuit.nodes.length > 0 || circuit.connections.length > 0)
            return;
        if (unifiedProject.circuit.nodes.length === 0 && unifiedProject.circuit.connections.length === 0)
            return;
        const loadedCircuit = fromCircuitV1(unifiedProject.circuit);
        setCircuit(loadedCircuit);
        setEngine(new CircuitEngine(loadedCircuit));
        setTickEngine(new TickEngine(loadedCircuit, { tickRate }));
        hasSyncedFromProjectRef.current = true;
    }, [unifiedProject, circuit.nodes.length, circuit.connections.length, fromCircuitV1, tickRate]);
    useEffect(() => {
        if (!unifiedProject)
            return;
        if (!hasSyncedFromProjectRef.current && circuit.nodes.length === 0 && circuit.connections.length === 0)
            return;
        // Convert circuit and check if it actually changed before updating
        const newCircuitV1 = toCircuitV1(circuit);
        const circuitChanged = JSON.stringify(unifiedProject.circuit) !== JSON.stringify(newCircuitV1);
        if (!circuitChanged)
            return;
        updateProject((project) => ({
            ...project,
            circuit: newCircuitV1,
        }));
    }, [circuit, unifiedProject, updateProject, toCircuitV1]);
    // NOTE: useEffect for syncing record to unifiedProject is defined AFTER record is declared
    // (moved to line ~520 to avoid TDZ error - record comes from useRunRecorderStore)
    // Get stable circuit mutation methods from store (NO closures)
    const storeAddNode = useCircuitStore((state) => state.addNode);
    const storeUpdateNode = useCircuitStore((state) => state.updateNode);
    const storeUpdateCircuit = useCircuitStore((state) => state.updateCircuit);
    const examples = useRef(listExamples());
    // Helper to get all .rblogic files
    const getLogicFiles = () => getAllFiles().filter((f) => f.name.endsWith('.rblogic'));
    const [availableFiles, setAvailableFiles] = useState(getLogicFiles);
    const [selectedFileId, setSelectedFileId] = useState(initialFileId ?? '');
    const [selectedExampleId, setSelectedExampleId] = useState(initialExampleId ?? '');
    const [selectedChipId, setSelectedChipId] = useState('');
    const handleAddNode = useCallback((nodeType, position) => {
        // HARD_LIMIT = 20 (from circuitStore)
        if (circuit.nodes.length >= 20) {
            addToast('Cannot add component: Learning Sandbox limit (20 nodes) reached', 'warning', 4000);
            return;
        }
        let pos = position;
        if (!pos) {
            // Calculate center of view effectively
            // We don't have direct access to camera here usually, but we can get it from store
            // LogicCanvas uses useLogicViewStore.
            const viewState = useLogicViewStore.getState();
            const camera = viewState.camera;
            // Assuming standard 800x600 viewport approximate if width/height not available, 
            // or we can just spawn at (0,0) world coords corrected for camera
            // The view usually centers (0,0) initially.
            // Let's rely on camera being accurate.
            // Note: LogicPlayground doesn't know exact canvas dimensions easily here without ref.
            // But we can approximate or just use world (0,0) as base.
            const centerX = -camera.x / camera.zoom;
            const centerY = -camera.y / camera.zoom;
            pos = findSmartSpawnPosition(circuit.nodes, { x: centerX, y: centerY });
        }
        storeAddNode(nodeType, pos);
        // Nice-to-have feedback for keyboard/click add
        // addToast(`Added ${nodeType}`, 'success', 1000); 
    }, [circuit.nodes, storeAddNode, addToast]);
    const splitScreenMode = useLayoutStore((state) => state.splitScreenMode);
    const activeViews = useLayoutStore((state) => state.activeViews);
    const perspective = useLayoutStore((state) => state.perspective);
    const storeSetPerspective = useLayoutStore((state) => state.setPerspective);
    const { safeMode, isComplexityWarning } = useClassroomModeStore();
    const handleSetPerspective = useCallback((p) => {
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
        if (!unifiedProject || !record)
            return;
        const recordKey = record.createdAt || `record-${record.summary?.tickCount ?? 0}`;
        if (recordKey === lastRecordingKeyRef.current)
            return;
        const proofPack = buildProofPack(record, circuit, {
            appVersion,
            tickRate: currentHz,
            exampleId: selectedExampleId || undefined,
        });
        const recording = {
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
        window.rbTickCount = tickCount;
    }, [tickCount]);
    const [lastTickAt, setLastTickAt] = useState(null);
    const [projectName, setProjectName] = useState('Untitled Project');
    const [projectDescription, setProjectDescription] = useState('');
    const [projectCreatedAt, setProjectCreatedAt] = useState(() => new Date().toISOString());
    const [currentFileId, setCurrentFileId] = useState(initialFileId ?? null);
    const [isDirty, setIsDirty] = useState(false);
    const [selectedNodeType, setSelectedNodeType] = useState(null);
    const [draggingNodeType, setDraggingNodeType] = useState(null);
    const [dragPosition, setDragPosition] = useState(null);
    const [shareFallbackURL, setShareFallbackURL] = useState(null);
    const [showDecodeErrorModal, setShowDecodeErrorModal] = useState(false);
    const [isLoadingSharedCircuit, setIsLoadingSharedCircuit] = useState(false);
    const [showSaveAsModal, setShowSaveAsModal] = useState(false);
    const [saveAsFilename, setSaveAsFilename] = useState('circuit.rblogic');
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showSaveChipModal, setShowSaveChipModal] = useState(false);
    const [showChipLibrary, setShowChipLibrary] = useState(false);
    const [recognizedPattern, setRecognizedPattern] = useState(null);
    const [showTraceViewer, setShowTraceViewer] = useState(false);
    const [traceSnapshots, setTraceSnapshots] = useState([]);
    const [showCircuitHints, setShowCircuitHints] = useState(true);
    const [showSchematicHints, setShowSchematicHints] = useState(true);
    const [show3DHints, setShow3DHints] = useState(true);
    const [showOscilloscopeHints, setShowOscilloscopeHints] = useState(true);
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showExamplesModal, setShowExamplesModal] = useState(false);
    const [showStartHere, setShowStartHere] = useState(() => {
        // Show on first launch unless dismissed
        if (typeof localStorage === 'undefined')
            return false;
        return localStorage.getItem('rb-start-here-dismissed') !== 'true';
    });
    // CE Mode modals
    const [showCEResetModal, setShowCEResetModal] = useState(false);
    const [showCEExamplesModal, setShowCEExamplesModal] = useState(false);
    const [showCEExportModal, setShowCEExportModal] = useState(false);
    const ceMode = isCEMode();
    const ceConfig = getCEConfig();
    const [exampleNoteDismissed, setExampleNoteDismissed] = useState(false);
    const [highlightedPort, setHighlightedPort] = useState(null);
    const [debugSignals, setDebugSignals] = useState(null);
    const [debugTick, setDebugTick] = useState(null);
    const [mismatchWireHighlights, setMismatchWireHighlights] = useState(null);
    const [mismatchNodeIds, setMismatchNodeIds] = useState(null);
    const [mismatchPortKeys, setMismatchPortKeys] = useState(null);
    const autosaveIntervalRef = useRef(null);
    const historyDebounceRef = useRef(null);
    const patternRecognitionRef = useRef(null);
    const isDemoMode = import.meta.env?.VITE_PUBLIC_DEMO ===
        'true';
    const lastRecognizedPatternRef = useRef(null);
    const canvasAreaRef = useRef(null);
    const projectFileInputRef = useRef(null);
    const hasLoadedFromURL = useRef(false);
    const isHydratingRef = useRef(false); // Guard to prevent setting dirty during file load
    const replayIntervalRef = useRef(null);
    const replaySetupRef = useRef(false);
    const replayPausedRef = useRef(false);
    const replayContextRef = useRef(null);
    const preReplayStateRef = useRef(null);
    const engineRef = useRef(engine);
    const tickEngineRef = useRef(tickEngine);
    // Keep refs in sync with state
    // NOTE: Do NOT include setCircuit, setEngine, setTickEngine in dependencies!
    // These are state setters that change on every render, causing infinite loops.
    useEffect(() => {
        setCircuitRef.current = setCircuit;
        engineRef.current = engine;
        tickEngineRef.current = tickEngine;
    }, [engine, tickEngine]);
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
            // Only update if circuit actually changed (avoid infinite loops)
            if (state.circuit !== circuit) {
                if (import.meta.env.DEV) {
                    console.log('[LogicPlayground] Syncing circuit from store', {
                        storeNodes: state.circuit.nodes.length,
                        localNodes: circuit.nodes.length
                    });
                }
                setCircuit(state.circuit);
                // Also sync engines to keep them in sync with the new circuit
                engineRef.current.setCircuit(state.circuit);
                tickEngineRef.current.setCircuit(state.circuit);
            }
        });
        return unsubscribe;
    }, [circuit]); // Re-subscribe when circuit changes
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
                }
                catch (e) {
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
    // Crash recovery: Save to localStorage every 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            try {
                const backup = {
                    circuit: serialize(circuit),
                    timestamp: Date.now(),
                    fileId: currentFileId,
                };
                localStorage.setItem('rblogic_crash_backup', JSON.stringify(backup));
            }
            catch (error) {
                console.error('Crash backup error:', error);
            }
        }, 10000); // Every 10 seconds
        return () => clearInterval(interval);
    }, [circuit, currentFileId]);
    // Track circuit complexity for classroom guardrails
    useEffect(() => {
        const nodeCount = circuit.nodes.length;
        const edgeCount = circuit.connections.length;
        // Calculate max fan-out
        const fanOutCounts = new Map();
        circuit.connections.forEach((conn) => {
            const key = `${conn.from.nodeId}:${conn.from.portName}`;
            fanOutCounts.set(key, (fanOutCounts.get(key) || 0) + 1);
        });
        const maxFanOut = fanOutCounts.size > 0 ? Math.max(...fanOutCounts.values()) : 0;
        // Update classroom mode store
        const { setComplexity } = useClassroomModeStore.getState();
        setComplexity(nodeCount, edgeCount, maxFanOut);
    }, [circuit]);
    // Crash recovery: Check for backup on mount
    useEffect(() => {
        try {
            const backupStr = localStorage.getItem('rblogic_crash_backup');
            if (backupStr) {
                const backup = JSON.parse(backupStr);
                const ageMinutes = (Date.now() - backup.timestamp) / 60000;
                // Only restore if backup is less than 30 minutes old and we don't have a file loaded
                if (ageMinutes < 30 && !initialFileId && !initialExampleId && backup.circuit) {
                    const shouldRestore = confirm(`Found an auto-saved circuit from ${Math.round(ageMinutes)} minute(s) ago. Would you like to restore it?`);
                    if (shouldRestore) {
                        const restored = deserialize(backup.circuit);
                        setCircuit(restored);
                        engineRef.current.setCircuit(restored);
                        setIsDirty(true);
                        // Milestone D: Record circuit loaded event
                        if (determinismRecorder?.isRecording) {
                            determinismRecorder.recordCircuitLoaded(restored);
                        }
                        addToast('Circuit restored from auto-save', 'success', 4000);
                    }
                }
            }
        }
        catch (error) {
            console.error('Crash recovery error:', error);
        }
    }, []); // Only run once on mount
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
                addToast('💡 Press 4 to open Oscilloscope view and monitor signals', 'info', 6000);
                localStorage.setItem('rb-seen-scope-hint', '1');
            }, 2000); // Delay to avoid overwhelming on first load
            return () => clearTimeout(timer);
        }
    }, [initialExampleId, addToast]);
    // Milestone D: Register state accessor for determinism recording
    useEffect(() => {
        if (!windowId || !registerStateAccessor)
            return;
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
                }
                catch (e) {
                    // Ignore
                }
                pushMount('RB_READY_DISPATCHED');
            }
        }
    }, []); // Only once after initial render
    // Wrap TickEngine.stepOnce to record ticks and probe samples during recording/replay
    useEffect(() => {
        const shouldWrap = determinismRecorder?.isRecording ||
            recorderMode === 'recording' ||
            recorderMode === 'replaying';
        if (!shouldWrap)
            return;
        const engine = tickEngineRef.current;
        const originalStepOnce = engine.stepOnce.bind(engine);
        engine.stepOnce = function () {
            const prevTick = this.getTickCount();
            originalStepOnce();
            const newTick = this.getTickCount();
            if (determinismRecorder?.isRecording) {
                determinismRecorder.recordSimulationTick(prevTick, newTick);
            }
            const runState = useRunRecorderStore.getState();
            const activeMode = runState.mode;
            if (activeMode === 'recording' || activeMode === 'replaying') {
                const probesToSample = activeMode === 'recording'
                    ? runState.context?.probes
                    : runState.replay?.record.probes;
                if (probesToSample && probesToSample.length > 0) {
                    const signals = this.getEngine().getAllSignals();
                    const values = {};
                    probesToSample.forEach((probe) => {
                        const key = `${probe.nodeId}.${probe.portName}`;
                        values[probe.id] = (signals.get(key) ?? 0);
                    });
                    if (activeMode === 'recording') {
                        const startTick = runState.context?.startTick ?? 0;
                        const relativeTick = Math.max(0, newTick - startTick);
                        useRunRecorderStore.getState().recordTraceSample({ tick: relativeTick, values });
                    }
                    else {
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
        if (replaySetupRef.current)
            return;
        replaySetupRef.current = true;
        if (!preReplayStateRef.current) {
            const viewState = useLogicViewStore().getState();
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
        const replayCircuit = JSON.parse(JSON.stringify(replayRecord.circuitSnapshot));
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
            if (replayPausedRef.current)
                return;
            const context = replayContextRef.current;
            if (!context)
                return;
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
            const mappedSignals = new Map();
            rawSignals.forEach((v, k) => mappedSignals.set(k, (v > 0 ? 1 : 0)));
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
        if (recorderMode === 'replaying')
            return;
        if (!preReplayStateRef.current)
            return;
        const previous = preReplayStateRef.current;
        preReplayStateRef.current = null;
        replaySetupRef.current = false;
        restoreReplayState(previous, {
            setEngine,
            setTickEngine,
            setCircuit,
            setCurrentHz,
            setTickCount,
            setIsRunning,
        }, useLogicViewStore());
    }, [recorderMode]);
    // Use ref to track debugSignals for overlay updates without causing loops
    const debugSignalsRef = useRef(null);
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
        if (recorderMode !== 'replaying' || !replayRecord)
            return;
        if (!replayPaused)
            return;
        const context = replayContextRef.current;
        if (!context)
            return;
        const maxTick = context.maxTick;
        const targetTick = Math.min(Math.max(0, playheadTick), maxTick);
        const currentTick = context.tickEngine.getTickCount();
        if (targetTick < currentTick) {
            const resetCircuit = JSON.parse(JSON.stringify(replayRecord.circuitSnapshot));
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
        const mappedSignals = new Map();
        rawSignals.forEach((v, k) => mappedSignals.set(k, (v > 0 ? 1 : 0)));
        setDebugSignals(mappedSignals);
        setDebugTick(context.tickEngine.getTickCount());
    }, [recorderMode, replayRecord, replayPaused, playheadTick]);
    const runReplayTickOnce = useCallback(() => {
        const context = replayContextRef.current;
        if (!context)
            return false;
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
        if (recorderMode !== 'replaying')
            return;
        if (!pendingStepTicks || pendingStepTicks <= 0)
            return;
        if (!replayPausedRef.current)
            return;
        for (let i = 0; i < pendingStepTicks; i += 1) {
            if (!runReplayTickOnce())
                break;
        }
        useRunRecorderStore.setState({ pendingStepTicks: null });
    }, [pendingStepTicks, recorderMode, runReplayTickOnce]);
    useEffect(() => {
        if (recorderMode !== 'replaying')
            return;
        if (pendingJumpTick === null || pendingJumpTick === undefined)
            return;
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
        const handleKeyDown = (e) => {
            const inputFocused = isInputFocused();
            if (inputFocused) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (showKeyboardHelp)
                        setShowKeyboardHelp(false);
                    if (showQuickAdd)
                        setShowQuickAdd(false);
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
                if (showKeyboardHelp)
                    setShowKeyboardHelp(false);
                if (showQuickAdd)
                    setShowQuickAdd(false);
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
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                }
                if (e.key === '2') {
                    e.preventDefault();
                    setRightDockTab('health');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                }
                if (e.key === '3') {
                    e.preventDefault();
                    setRightDockTab('learn');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                }
                if (e.key === '4') {
                    e.preventDefault();
                    setRightDockTab('probes');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                }
                if (e.key === '5') {
                    e.preventDefault();
                    setRightDockTab('record');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                }
                if (e.key === '6') {
                    e.preventDefault();
                    setRightDockTab('chips');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
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
            if (!active)
                return false;
            if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') {
                return true;
            }
            return active.isContentEditable;
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showKeyboardHelp, showQuickAdd, setPerspective, isReplayMode]);
    // Sync hierarchy circuit with main circuit
    // Use refs to track last synced values and prevent infinite loops
    const lastSyncedHierarchyRef = useRef(null);
    const lastSyncedCircuitRef = useRef(null);
    const hierarchyCircuitRef = useRef(hierarchyCircuit);
    const circuitRef = useRef(circuit);
    // Keep refs in sync with state without triggering the main effect
    useEffect(() => {
        hierarchyCircuitRef.current = hierarchyCircuit;
    }, [hierarchyCircuit]);
    useEffect(() => {
        circuitRef.current = circuit;
    }, [circuit]);
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
        }
        else {
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
            if (hasLoadedFromURL.current)
                return;
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
                    const serialized = {
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
                }
                catch (error) {
                    addToast('Failed to load shared circuit', 'error');
                    console.error('URL circuit load error:', error);
                    setShowDecodeErrorModal(true);
                }
                finally {
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
            }
            else {
                // File doesn't exist, try to find by name match
                // Extract clean name from resourceId (e.g., "notes" -> "notes.txt" or just "notes")
                const nameMatchFile = availableFiles.find((f) => f.name.toLowerCase().includes(resourceId.toLowerCase()) ||
                    resourceId.toLowerCase().includes(f.name.toLowerCase()));
                if (nameMatchFile) {
                    handleLoadFile(nameMatchFile.id);
                    requestAnimationFrame(() => {
                        canvasAreaRef.current?.focus();
                    });
                }
                else {
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
            }
            else if (initialExampleId) {
                await handleLoadExample(initialExampleId);
            }
        };
        loadInitial();
    }, []);
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
                }
                catch (error) {
                    console.error('Autosave error:', error);
                }
            }, 5000);
        }
        return () => {
            if (autosaveIntervalRef.current) {
                clearTimeout(autosaveIntervalRef.current);
            }
        };
    }, [isDirty, currentFileId, circuit]);
    // Beforeunload warning for unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
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
        if (!windowId)
            return;
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
            title = `${title} •`;
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
    const handleNew = () => {
        // New phrasing: "Creating a new project will discard your current unsaved circuit. Are you sure?"
        if (!confirmReplacement('Creating a new project'))
            return;
        // FIX (P1): Reset all auxiliary stores (probes, recorder, scope)
        resetAppStores();
        // Set hydration guard to prevent marking dirty during load
        isHydratingRef.current = true;
        const emptyCircuit = { nodes: [], connections: [] };
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
    const handleNodeUpdate = (nodeId, updates) => {
        if (recorderMode === 'replaying')
            return;
        const updatedCircuit = {
            ...circuit,
            nodes: circuit.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
        };
        setCircuit(updatedCircuit);
        engineRef.current.setCircuit(updatedCircuit);
        setIsDirty(true);
    };
    const handleConnectionDelete = (connectionId) => {
        if (recorderMode === 'replaying')
            return;
        const [from, to] = connectionId.split('->');
        const [fromNodeId, fromPort] = from.split('.');
        const [toNodeId, toPort] = to.split('.');
        const updatedCircuit = {
            ...circuit,
            connections: circuit.connections.filter((c) => !(c.from.nodeId === fromNodeId &&
                c.from.portName === fromPort &&
                c.to.nodeId === toNodeId &&
                c.to.portName === toPort)),
        };
        setCircuit(updatedCircuit);
        engineRef.current.setCircuit(updatedCircuit);
        setIsDirty(true);
        addToast('Connection deleted', 'info');
    };
    const handleFocusNode = (nodeId, _portName) => {
        const viewStore = useViewStateStore.getState();
        viewStore.clearSelection();
        viewStore.selectNodes([nodeId], false);
        viewStore.setHighlightedNode(nodeId, 1600);
        viewStore.requestFocusNode(nodeId);
    };
    const handleLoadLearnExample = useCallback((example) => {
        if (!confirmReplacement('Loading a tutorial'))
            return;
        // Load the example's initial circuit
        const newCircuit = example.initialCircuit || { nodes: [], connections: [] };
        setCircuit(newCircuit);
        engineRef.current.setCircuit(newCircuit);
        setIsDirty(false);
        addToast(`Loaded: ${example.title}`, 'success');
    }, [addToast]);
    const handleExitLearnMode = useCallback(() => {
        // Just a placeholder - user can manually clear or load a file
        addToast('Exited learn mode', 'info');
    }, [addToast]);
    const handleCircuitChange = useCallback((updatedCircuit) => {
        // CRITICAL: Update local state AND store to keep them in sync
        setCircuit(updatedCircuit);
        engineRef.current.setCircuit(updatedCircuit);
        // Use circuitStore.commit to add to history
        const circuitStore = useCircuitStore.getState();
        // Only commit to history if not loading a file
        if (!isHydratingRef.current) {
            circuitStore.commit(updatedCircuit);
        }
        else {
            // During file load, update without history but enforce classroom limits
            circuitStore.updateCircuit(updatedCircuit, { skipHistory: true, enforceLimits: true });
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
                    addToast(`🎉 You just built a ${pattern.name}! ${pattern.description} (Layer ${pattern.layer})`, 'success', 6000);
                }
                else if (!pattern && lastRecognizedPatternRef.current) {
                    // Circuit changed - pattern no longer matches
                    lastRecognizedPatternRef.current = '';
                    setRecognizedPattern(null);
                }
            }, 2000);
        }
    }, [addToast]);
    // Probe handling
    const probedPorts = React.useMemo(() => {
        const set = new Set();
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
        const missing = [];
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
        if (!record)
            return;
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
        if (!record)
            return;
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
    const handleRunRecorderImportProofPack = useCallback((pack) => {
        const replayCircuit = JSON.parse(JSON.stringify(pack.runRecord.circuitSnapshot));
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
    }, [record, appVersion, currentHz]);
    const handleRunReplayStart = useCallback(() => {
        if (!record)
            return;
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
    const handleRunReplayStep = useCallback((ticks) => {
        stepReplay(ticks);
    }, [stepReplay]);
    const handleRunReplayJump = useCallback((tick) => {
        jumpReplay(tick);
    }, [jumpReplay]);
    const handleProbeToggle = useCallback((nodeId, portName, label) => {
        toggleProbeForPort(nodeId, portName, label);
    }, [toggleProbeForPort]);
    const handleRunRecorderFocus = useCallback((nodeId, portName) => {
        handleFocusNode(nodeId, portName);
        setHighlightedPort({ nodeId, portName });
    }, [handleFocusNode, setHighlightedPort]);
    const handleMismatchSelect = useCallback((probeId) => {
        if (!record)
            return;
        const probe = record.probes.find((item) => item.id === probeId);
        if (!probe)
            return;
        handleRunRecorderFocus(probe.nodeId, probe.portName);
        const suspect = buildSuspectSet(circuit, [{ nodeId: probe.nodeId, portName: probe.portName }], 4);
        const highlightMap = new Map();
        suspect.wireIds.forEach((wireId) => {
            highlightMap.set(wireId, ['#f97316']);
        });
        setMismatchWireHighlights(highlightMap);
        setMismatchNodeIds(new Set(suspect.nodeIds));
        setMismatchPortKeys(new Set([`${probe.nodeId}:${probe.portName}`]));
    }, [record, handleRunRecorderFocus, circuit]);
    // Memoize mismatch data to avoid recreating objects on every render
    // Only recalculate when verification status actually changes
    const verificationMismatchData = useMemo(() => {
        if (!record || verificationStatus.status !== 'fail' || !verificationStatus.mismatch) {
            return null;
        }
        const mismatchPorts = new Set();
        const combinedNodes = new Set();
        const combinedWires = new Set();
        verificationStatus.mismatch.probeIds.forEach((probeId) => {
            const probe = record.probes.find((item) => item.id === probeId);
            if (!probe)
                return;
            mismatchPorts.add(`${probe.nodeId}:${probe.portName}`);
            const suspect = buildSuspectSet(circuit, [{ nodeId: probe.nodeId, portName: probe.portName }], 4);
            suspect.nodeIds.forEach((nodeId) => combinedNodes.add(nodeId));
            suspect.wireIds.forEach((wireId) => combinedWires.add(wireId));
        });
        const highlightMap = new Map();
        combinedWires.forEach((wireId) => {
            highlightMap.set(wireId, ['#f97316']);
        });
        return { mismatchPorts, combinedNodes, highlightMap };
    }, [record, verificationStatus.status, verificationStatus.mismatch, circuit]);
    // Track last set mismatch data to only update state when actually different
    const lastMismatchDataRef = useRef(null);
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
    const handleInputToggled = useCallback((nodeId, portName, newValue) => {
        if (determinismRecorder?.isRecording) {
            determinismRecorder.recordInputToggled(nodeId, portName, newValue);
        }
        if (recorderMode === 'recording') {
            const startTick = useRunRecorderStore.getState().context?.startTick ?? 0;
            const tick = Math.max(0, tickEngineRef.current.getTickCount() - startTick);
            const node = circuit.nodes.find((item) => item.id === nodeId);
            const label = node ? `${node.type} ${portName}` : `${nodeId}.${portName}`;
            const event = {
                tick,
                type: 'input_toggled',
                nodeId,
                portName,
                value: newValue,
                label,
            };
            recordEvent(event);
        }
    }, [determinismRecorder, recorderMode, recordEvent, circuit.nodes]);
    const handleNodeDragStart = (nodeType, e) => {
        if (import.meta.env.DEV)
            console.log('[LogicPlayground] handleNodeDragStart', { nodeType });
        if (e) {
            try {
                e.dataTransfer.effectAllowed = 'copy';
                // CRITICAL FIX: Use correct MIME type for drag data
                e.dataTransfer.setData('application/x-redbyte-node-type', nodeType);
            }
            catch (error) {
                console.error('Failed to set drag data:', error);
            }
        }
        setDraggingNodeType(nodeType);
    };
    const handleNodeDragOver = (e) => {
        if (recorderMode === 'replaying')
            return;
        e.preventDefault();
        e.stopPropagation();
        if (!draggingNodeType)
            return;
        // Ensure we have valid client coordinates
        if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number')
            return;
        if (isNaN(e.clientX) || isNaN(e.clientY))
            return;
        const rect = canvasAreaRef.current?.getBoundingClientRect();
        if (!rect)
            return;
        // Validate rect properties
        if (typeof rect.left !== 'number' || typeof rect.top !== 'number')
            return;
        if (isNaN(rect.left) || isNaN(rect.top))
            return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Final NaN check before setting state
        if (isNaN(x) || isNaN(y))
            return;
        setDragPosition({ x, y });
    };
    const handleNodeDrop = (e) => {
        if (recorderMode === 'replaying')
            return;
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
        const viewStore = useLogicViewStore;
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
        }
        else {
            console.error('[LogicPlayground] Node was NOT added!');
            // Check if we hit the classroom guardrail (HARD_LIMIT=20)
            if (beforeCount >= 20) {
                addToast('Circuit limit reached (20 components max)', 'warning', 5000);
            }
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
        }
        else {
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
    const handleOpenFile = async (fileId) => {
        setShowOpenModal(false);
        await handleLoadFile(fileId);
    };
    // Helper for destructive actions
    const confirmReplacement = useCallback((actionDescription) => {
        if (isDirty) {
            return window.confirm(`${actionDescription} will discard your current unsaved circuit. Are you sure?`);
        }
        return true;
    }, [isDirty]);
    const handleLoadFile = async (fileId) => {
        if (!fileId)
            return;
        if (!confirmReplacement('Opening a file'))
            return;
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
        const serialized = file.content
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
    };
    const seedExampleProbes = (exampleId, loadedCircuit) => {
        const { clearProbes, addProbe } = useProbeStore.getState();
        clearProbes();
        const addIfNode = (nodeId, portName, label) => {
            if (!loadedCircuit.nodes.some((node) => node.id === nodeId))
                return;
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
    const handleLoadExample = async (exampleId) => {
        if (!exampleId)
            return;
        // Note: confirmReplacement is not defined in the snippet I see above, but it was in the file content I read.
        // Wait, I saw confirmReplacement in line 1936 in Step 77.
        // I need to make sure I don't break if confirmReplacement is not available in scope if it's a helper?
        // It seems to be a helper or imported. I'll include it.
        // Actually, looking at previous file reads, I don't see confirmReplacement definition. 
        // Is it a local helper? I better check if I can just leave it or if I need to define it?
        // Based on the view (Step 77), it is used. So I must keep it.
        // The previous error was matching content.
        // I'll assume confirmReplacement is available as I see it used.
        // WAIT. In step 50 (lines 1600-2399), I did NOT see confirmReplacement in handleLoadExample (lines 1922+).
        // In step 77 (lines 1922-2008), I DO see confirmReplacement on line 1936.
        // This implies the file changed or I missed it?
        // Actually, looking closer at Step 50 output:
        // 1922:   const handleLoadExample = async (exampleId: ExampleId | '') => {
        // 1923:     if (!exampleId) return;
        // 1924: 
        // 1925:     try {
        // ...
        // BUT in Step 77:
        // 1934:   const handleLoadExample = async (exampleId: ExampleId | '') => {
        // 1935:     if (!exampleId) return;
        // 1936:     if (!confirmReplacement('Loading an example')) return;
        // This is strange. The file content seems to be different?
        // Or maybe I am misreading line numbers.
        // In Step 50, handleLoadExample starts at 1922.
        // In Step 77, it starts at 1934.
        // So lines shifted down?
        // Ah, lines 1922-1931 in Step 77 are end of seedExampleProbes.
        // In Step 50, seedExampleProbes starts at 1897 and ends... around 1921?
        // Use diffs.
        // Step 50:
        // 1922:   const handleLoadExample = async (exampleId: ExampleId | '') => {
        // ...
        // Step 77 (showing lines 1922-2008):
        // 1922:       addIfNode('qbar-output', 'out', 'Q bar');
        // ...
        // 1934:   const handleLoadExample = async (exampleId: ExampleId | '') => {
        // There was a shift of about 12 lines.
        // AND line 1936 `confirmReplacement` appeared?
        // Did I edit the file?
        // I only tried to replace content and failed.
        // I added an import in Step 71. That adds 1 line.
        // Checks out: 1922 -> 1923?. No that doesn't explain 12 lines.
        // Wait, Step 77 shows `addIfNode` lines before `handleLoadExample`.
        // Step 50 shows `handleLoadExample` at 1922.
        // `seedExampleProbes` is right before it.
        // Maybe `confirmReplacement` IS there and I missed it in Step 50?
        // Re-reading Step 50 logic...
        // 1922:   const handleLoadExample = async (exampleId: ExampleId | '') => {
        // 1923:     if (!exampleId) return;
        // 1924: 
        // 1925:     try {
        // NO confirmReplacement in Step 50.
        // YES confirmReplacement in Step 77.
        // How did it get there?
        // Did user edit it? No user interaction.
        // Did I edit it? Step 71 added 1 import line.
        // Maybe `confirmReplacement` was there all along but I missed it?
        // No, I am reading the output of `view_file`.
        // Step 50 output is definitive for that moment.
        // Wait. Step 77 output:
        // 1936:     if (!confirmReplacement('Loading an example')) return;
        // This is a mystery. Unless `view_file` in Step 77 is showing me something else?
        // Step 77 file path: `c:/Users/conno/redbyte-ui/packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`
        // Is it possible the previous `replace_file_content` (Step 71) did more than just add an import?
        // "The following changes were made... import { validateCircuitData }..."
        // It didn't seem to add 12 lines or `confirmReplacement`.
        // Maybe `confirmReplacement` comes from `useCircuitStore` or something that I imported? No.
        // I suspect the file content in Step 77 is the *current* reality, regardless of how it got there.
        // I MUST match the current reality.
        // BUT, where is `confirmReplacement` defined?
        // I need to know if I should keep it or if it's an error in my view?
        // I'll trust Step 77.
        // Wait, `confirmReplacement` is likely a new helper I didn't see.
        // If I replace `handleLoadExample` entirely, I need to make sure I don't lose that check if it's important.
        // OR if it's not defined, removing it prevents a crash.
        // I'll check if `confirmReplacement` is defined in the file.
        if (!confirmReplacement('Loading an example'))
            return;
        try {
            // Set hydration guard to prevent marking dirty during load
            isHydratingRef.current = true;
            // Ensure clean state before loading example
            resetAppStores();
            let exampleToLoad = exampleId;
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
                    const deepRecurse = (depth) => {
                        if (depth > 5000)
                            return {};
                        return deepRecurse(depth + 1);
                    };
                    try {
                        deepRecurse(0);
                    }
                    catch (e) {
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
        }
        catch (error) {
            isHydratingRef.current = false;
            addToast(`Failed to load example: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            console.error('Error loading example:', error);
        }
    };
    const handleLoadTutorialExample = async (filename) => {
        // Map tutorial filenames to example IDs
        const exampleMap = {
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
        await handleLoadExample(exampleId);
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
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        // Set hydration guard to prevent marking dirty during load
                        isHydratingRef.current = true;
                        const json = JSON.parse(evt.target?.result);
                        const loadedCircuit = deserialize(json);
                        setCircuit(loadedCircuit);
                        const newEngine = new CircuitEngine(loadedCircuit);
                        setEngine(newEngine);
                        setTickEngine(new TickEngine(loadedCircuit, { tickRate: currentHz }));
                        setCurrentFileId(null);
                        setIsDirty(true);
                        // Clear hydration guard after load completes
                        isHydratingRef.current = false;
                    }
                    catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        addToast(`Failed to import circuit: ${errorMessage}`, 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };
    const handleRun = () => {
        if (recorderMode === 'replaying')
            return;
        // Enable tracing when starting simulation
        tickEngine.enableTracing(1000);
        tickEngine.start();
        setIsRunning(true);
    };
    const handlePause = () => {
        if (recorderMode === 'replaying')
            return;
        tickEngine.pause();
        setIsRunning(false);
        // Update trace snapshots when pausing
        const recorder = tickEngine.getTraceRecorder();
        if (recorder) {
            setTraceSnapshots(recorder.getSnapshots());
        }
    };
    const handleStep = () => {
        if (recorderMode === 'replaying')
            return;
        tickEngine.stepOnce();
        const newTick = tickEngine.getTickCount();
        setTickCount(newTick);
    };
    const handleResetTickCount = () => {
        if (recorderMode === 'replaying')
            return;
        tickEngine.resetTickCount();
        setTickCount(0);
    };
    const handleHzChange = (hz) => {
        if (recorderMode === 'replaying')
            return;
        setCurrentHz(hz);
        tickEngine.setTickRate(hz);
    };
    const handleSaveChip = (name, description, layer, inputs, outputs) => {
        if (!recognizedPattern)
            return;
        try {
            const chip = saveChipFromPattern(recognizedPattern, circuit, inputs, outputs);
            // Register the chip immediately so it can be used in circuits
            registerChip(chip);
            addToast(`Chip "${chip.name}" saved! You can now use it in your circuits.`, 'success', 4000);
            setShowSaveChipModal(false);
        }
        catch (error) {
            console.error('Failed to save chip:', error);
            addToast('Failed to save chip', 'error');
        }
    };
    const handleSelectChipFromLibrary = (chipId) => {
        const chip = getAllChips().find((c) => c.id === chipId);
        if (chip) {
            setSelectedNodeType(chip.name);
            addToast(`Click on canvas to place ${chip.name}`, 'info', 2000);
        }
    };
    const handleDeleteChip = (chipId) => {
        const chip = getAllChips().find((c) => c.id === chipId);
        if (chip) {
            // Unregister from NodeRegistry first to prevent ghost chips
            unregisterChip(chip.name);
        }
        deleteChip(chipId);
        addToast('Chip deleted', 'info');
    };
    const handleEnterChip = (nodeId) => {
        // Find the node in current circuit
        const node = circuit.nodes.find((n) => n.id === nodeId);
        if (!node)
            return;
        // Check if this node type is a chip
        const chip = getAllChips().find((c) => c.name === node.type);
        if (!chip) {
            addToast(`${node.type} is not a chip (it's a primitive component)`, 'info');
            return;
        }
        // Enter the chip's internal circuit
        enterChip(chip, nodeId);
        addToast(`Entered ${chip.name} • Press Esc to exit`, 'info', 3000);
    };
    const getNodeDescription = (nodeType) => {
        const descriptions = {
            PowerSource: 'Always ON - provides constant HIGH signal (1)',
            Switch: 'Toggle ON/OFF - click to toggle state',
            INPUT: 'Toggle ON/OFF - click to toggle state',
            Lamp: 'Visual indicator - lights up when signal is HIGH',
            OUTPUT: 'Visual indicator - lights up when signal is HIGH',
            Wire: 'Pass-through connection',
            AND: 'TRUE if both inputs are TRUE | Truth: 0,0→0 | 0,1→0 | 1,0→0 | 1,1→1',
            OR: 'TRUE if either input is TRUE | Truth: 0,0→0 | 0,1→1 | 1,0→1 | 1,1→1',
            NOT: 'Inverts input | Truth: 0→1 | 1→0',
            NAND: 'NOT AND - opposite of AND gate | Truth: 0,0→1 | 0,1→1 | 1,0→1 | 1,1→0',
            NOR: 'NOT OR - opposite of OR gate | Truth: 0,0→1 | 0,1→0 | 1,0→0 | 1,1→0',
            XOR: 'TRUE if inputs differ | Truth: 0,0→0 | 0,1→1 | 1,0→1 | 1,1→0',
            XNOR: 'TRUE if inputs are same | Truth: 0,0→1 | 0,1→0 | 1,0→0 | 1,1→1',
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
    const getChipMetadataForNode = (nodeType) => {
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
        const builtinMetadata = {
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
            RSLatch: { inputs: [{ id: 'R', name: 'R' }, { id: 'S', name: 'S' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q̅' }], layer: 3, color: '#ec4899' },
            DFlipFlop: { inputs: [{ id: 'D', name: 'D' }, { id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q̅' }], layer: 3, color: '#ec4899' },
            JKFlipFlop: { inputs: [{ id: 'J', name: 'J' }, { id: 'K', name: 'K' }, { id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q̅' }], layer: 3, color: '#ec4899' },
            FullAdder: { inputs: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'Cin', name: 'Cin' }], outputs: [{ id: 'Sum', name: 'Sum' }, { id: 'Cout', name: 'Cout' }], layer: 2, color: '#14b8a6' },
            Counter4Bit: { inputs: [{ id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q0', name: 'Q0' }, { id: 'Q1', name: 'Q1' }, { id: 'Q2', name: 'Q2' }, { id: 'Q3', name: 'Q3' }], layer: 4, color: '#f97316' },
        };
        const metadata = builtinMetadata[nodeType];
        if (!metadata)
            return undefined;
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
            }
            catch (clipboardError) {
                // Fallback: show modal with selectable input
                setShareFallbackURL(url.toString());
            }
        }
        catch (error) {
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
        const emptyCircuit = { nodes: [], connections: [] };
        setCircuit(emptyCircuit);
        const newEngine = new CircuitEngine(emptyCircuit);
        setEngine(newEngine);
        setTickEngine(new TickEngine(emptyCircuit, { tickRate: currentHz }));
        setCurrentFileId(null);
        setIsDirty(false);
        setShowDecodeErrorModal(false);
        addToast('Circuit reset', 'info');
    };
    const sanitizeFilename = useCallback((name) => {
        const trimmed = name.trim() || 'rb-project';
        return trimmed.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '_');
    }, []);
    const downloadText = useCallback((filename, text, type = 'application/json') => {
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }, []);
    const downloadBlob = useCallback((filename, blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }, []);
    const buildProject = useCallback(() => {
        const name = projectName.trim() || 'Untitled Project';
        return createRBProject({
            createdAt: projectCreatedAt,
            name,
            description: projectDescription.trim() || undefined,
            circuit,
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
    ]);
    const applyProject = useCallback((project) => {
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
        if (project.layout?.perspectiveId) {
            const perspectiveId = project.layout.perspectiveId;
            const validPerspectives = ['build', 'analyze', 'explain', 'explore', 'quad', 'circuit-only', 'schematic-only', 'scope-only', '3d-only', 'code-only', 'inspect', 'debug', 'schematic', 'learn'];
            if (validPerspectives.includes(perspectiveId)) {
                setPerspective(perspectiveId);
            }
        }
        if (typeof project.layout?.splitRatio === 'number') {
            setSplitRatio(project.layout.splitRatio);
        }
        if (project.layout?.dock) {
            setRightDockState(project.layout.dock.open ? 'expanded' : 'collapsed');
            const dockTab = project.layout.dock.tab;
            if (dockTab && ['inspector', 'health', 'learn', 'probes', 'record', 'chips'].includes(dockTab)) {
                setRightDockTab(dockTab);
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
    }, [
        tickRate,
        setPerspective,
        setSplitRatio,
        setRightDockState,
        setRightDockTab,
        setCircuit,
        setEngine,
        setTickEngine,
    ]);
    const handleNewProject = useCallback(() => {
        handleNew();
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
    }, [handleNew, resetRunRecorder]);
    const handleSaveProject = useCallback(() => {
        const project = buildProject();
        assertAppOutput('logic-playground', 'rb-project.json');
        downloadText('rb-project.json', encodeRBProject(project));
        addToast('Project exported', 'success');
    }, [buildProject, downloadText, addToast]);
    const handleSaveProjectArchive = useCallback(async () => {
        const project = buildProject();
        assertAppOutput('logic-playground', 'rbproj.zip');
        const zip = new JSZip();
        zip.file('rb-project.json', encodeRBProject(project));
        zip.file('circuit.rblogic', JSON.stringify(serialize(project.circuit), null, 2));
        zip.file('README.txt', 'RedByte project archive. Import rb-project.json from the Logic Playground to restore full state.');
        const blob = await zip.generateAsync({ type: 'blob' });
        const safeName = sanitizeFilename(project.name ?? 'rb-project');
        downloadBlob(`${safeName}.rbproj.zip`, blob);
        addToast('Project archive exported', 'success');
    }, [buildProject, downloadBlob, sanitizeFilename, addToast]);
    const handleOpenProject = useCallback(() => {
        projectFileInputRef.current?.click();
    }, []);
    const handleExportEvidence = useCallback(() => {
        try {
            exportEvidence({
                circuit,
                selectedExampleId,
                probes,
                tickCount,
                traceRecorder: tickEngine?.getTraceRecorder?.() ?? null,
            });
            addToast('Lab evidence exported', 'success');
        }
        catch (error) {
            console.error('[LogicPlayground] Evidence export failed:', error);
            addToast('Failed to export evidence', 'error');
        }
    }, [circuit, selectedExampleId, probes, tickCount, tickEngine, addToast]);
    const handleProjectFileChange = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const project = decodeRBProject(String(reader.result ?? ''));
                applyProject(project);
                addToast('Project loaded (simulation reset to apply state)', 'info');
            }
            catch (error) {
                console.error('Failed to load project', error);
                addToast('Failed to load project', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [applyProject, addToast]);
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
        if (!unifiedProject?.boardMap?.virtualIOState || !ioMapping)
            return;
        const { switches = [], buttons = [] } = unifiedProject.boardMap.virtualIOState;
        let hasChanges = false;
        const nextNodes = circuit.nodes.map((node) => {
            const mapping = ioMapping.inputs.find((m) => m.nodeId === node.id);
            if (!mapping || !mapping.pin)
                return node;
            let shouldBeOn = false;
            if (mapping.pin.startsWith('SW')) {
                const idx = parseInt(mapping.pin.slice(2), 10);
                shouldBeOn = !!switches[idx];
            }
            else if (mapping.pin.startsWith('BTN')) {
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
        if (!ioMapping)
            return {};
        const states = {};
        ioMapping.inputs.forEach((entry) => {
            const node = circuit.nodes.find((n) => n.id === entry.nodeId);
            if (node && node.state && entry.pin) {
                states[entry.pin] = !!node.state.on;
            }
        });
        return states;
    }, [ioMapping, circuit]);
    const ioOutputStates = useMemo(() => {
        if (!ioMapping)
            return {};
        const states = {};
        const signals = engine.getAllSignals();
        ioMapping.outputs.forEach((entry) => {
            if (entry.pin && entry.nodeId) {
                const val = signals.get(entry.nodeId);
                states[entry.pin] = (val ?? 0) > 0;
            }
        });
        return states;
    }, [ioMapping, tickCount, engine]);
    const handleIoToggleInput = useCallback((entry) => {
        if (!entry.nodeId)
            return;
        const node = circuit.nodes.find((n) => n.id === entry.nodeId);
        if (!node)
            return;
        // Toggle switch state
        const newState = !node.state?.on;
        const nextCircuit = {
            ...circuit,
            nodes: circuit.nodes.map((n) => n.id === entry.nodeId ? { ...n, state: { ...n.state, on: newState } } : n),
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
            }
            else if (entry.pin.startsWith('BTN')) {
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
    const handleIoAssignPin = useCallback((entry, pin) => {
        // Logic to update mapping in project
        console.log('Assign pin:', entry, pin);
    }, []);
    useEffect(() => {
        const handlePlaygroundCommand = (event) => {
            const detail = event.detail;
            if (!detail?.command)
                return;
            if (detail.windowId && detail.windowId !== windowId)
                return;
            const focused = useWindowStore.getState().getFocusedWindow();
            if (!focused || focused.id !== windowId)
                return;
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
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                    return;
                case 'playground-dock-health':
                    setRightDockTab('health');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                    return;
                case 'playground-dock-learn':
                    setRightDockTab('learn');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                    return;
                case 'playground-dock-probes':
                    setRightDockTab('probes');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                    return;
                case 'playground-dock-chips':
                    setRightDockTab('chips');
                    if (rightDockState === 'collapsed')
                        setRightDockState('peek');
                    return;
                case 'playground-toggle-wire': {
                    const logicView = useLogicViewStore().getState();
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
                    if (!size)
                        return;
                    if (circuit.nodes.length === 0) {
                        useLogicViewStore().getState().setCamera({ x: 0, y: 0, zoom: 1 });
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
                        useLogicViewStore().getState().setCamera({ x: 0, y: 0, zoom: 1 });
                        return;
                    }
                    const nextCamera = fitToBounds({ minX, maxX, minY, maxY }, size.width, size.height, 100, 2);
                    useLogicViewStore().getState().setCamera(nextCamera);
                    return;
                }
                case 'playground-reset-view':
                    useLogicViewStore().getState().setCamera({ x: 0, y: 0, zoom: 1 });
                    return;
                case 'playground-clear-scope':
                    useOscilloscopeStore.getState().requestClear();
                    return;
            }
        };
        window.addEventListener('rb:playground-command', handlePlaygroundCommand);
        return () => {
            window.removeEventListener('rb:playground-command', handlePlaygroundCommand);
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
    const viewLabel = splitScreenMode === 'single'
        ? activeViews[0] ?? 'circuit'
        : splitScreenMode === 'quad'
            ? activeViews.slice(0, 4).join('+')
            : activeViews.slice(0, 2).join('+');
    // Memoize chips array to avoid multiple store calls during render
    const allChips = React.useMemo(() => getAllChips(), [getAllChips]);
    // ====== CE MODE HANDLERS ======
    const handleCEResetWorkspace = () => {
        try {
            // Clear autosave
            clearSavedCircuit();
            // Reset circuit to empty
            const emptyCircuit = { nodes: [], connections: [] };
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
            useLogicViewStore().getState().setCamera({ x: 0, y: 0, zoom: 1 });
            addToast('Workspace reset to empty circuit', 'success');
            setShowCEResetModal(false);
        }
        catch (error) {
            console.error('Reset workspace error:', error);
            addToast('Failed to reset workspace', 'error');
        }
    };
    const handleCELoadExample = (example) => {
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
                }
                else {
                    addToast(`Example loaded successfully`, 'success');
                }
                setShowCEExamplesModal(false);
            }
            catch (error) {
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
    return (_jsx(ErrorBoundary, { children: _jsxs("div", { className: "h-full flex flex-col min-h-0 min-w-0 bg-gray-900 text-white", "data-testid": "logic-playground-root", children: [resourceId && (_jsxs("div", { className: "bg-cyan-900/30 border-b border-cyan-700 p-2 text-xs", children: ["Opened from Files: ", _jsx("span", { className: "font-semibold", children: resourceId }), " (", resourceType, ")"] })), _jsx(HierarchyBreadcrumbs, {}), _jsx(ClassroomModeBanner, {}), _jsx(TopCommandBar, { onExamples: ceMode ? () => setShowCEExamplesModal(true) : () => setShowExamplesModal(true), projectName: projectName, onNew: handleNew, onNewProject: handleNewProject, onSaveProject: handleSaveProject, onOpenProject: handleOpenProject, onExportProject: ceMode ? () => setShowCEExportModal(true) : handleExportProject, onSave: handleSave, onSaveAs: handleSaveAs, onShare: handleShare, isDirty: isDirty, onUndo: handleUndo, onRedo: handleRedo, canUndo: canUndo, canRedo: canRedo, isRunning: isRunning, onRun: handleRun, onPause: handlePause, onStep: handleStep, tickCount: tickCount, tickRate: currentHz, onTickRateChange: handleHzChange, onResetTickCount: handleResetTickCount, onReset: ceMode ? () => setShowCEResetModal(true) : undefined, perspective: perspective, onPerspectiveChange: setPerspective, schematicMiniEnabled: schematicMiniEnabled, onToggleSchematicMini: toggleSchematicMini, onManual: () => onOpenApp?.('user-manual'), onHelp: () => setShowKeyboardHelp(true), onStartHere: () => setShowStartHere(true), onExportEvidence: handleExportEvidence, onOpenEvidence: () => onOpenApp?.('submission-inspector') }), _jsx("input", { ref: projectFileInputRef, type: "file", accept: "application/json,.json", onChange: handleProjectFileChange, className: "hidden", "aria-label": "Open project file" }), _jsxs("div", { className: "flex-1 flex min-h-0 min-w-0 overflow-hidden", children: [_jsx(EnhancedPalette, { primitiveNodes: PRIMITIVE_NODES, compositeNodes: COMPOSITE_NODES, chips: allChips, onNodeDragStart: handleNodeDragStart, onAddNode: handleAddNode, onChipLibraryOpen: () => setShowChipLibrary(true), getChipMetadata: getChipMetadataForNode, getNodeDescription: getNodeDescription, isReplayMode: isReplayMode }), _jsxs("div", { ref: canvasAreaRef, tabIndex: -1, className: "flex-1 min-h-0 min-w-0 relative outline-none", "data-testid": "logic-canvas", onDragOver: handleNodeDragOver, onDrop: handleNodeDrop, onDragEnd: () => {
                                // Clean up drag state when drag ends
                                setDraggingNodeType(null);
                                setDragPosition(null);
                            }, children: [dragPosition && draggingNodeType && (_jsx("div", { className: "absolute pointer-events-none z-50", style: {
                                        left: `${dragPosition.x}px`,
                                        top: `${dragPosition.y}px`,
                                        transform: 'translate(-50%, -50%)',
                                    }, children: _jsx("div", { className: "px-3 py-2 bg-cyan-500/20 border-2 border-cyan-500 rounded-lg shadow-lg backdrop-blur-sm", children: _jsx("div", { className: "text-xs font-semibold text-cyan-300", children: draggingNodeType }) }) })), circuit.nodes.length === 0 && isDemoMode && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none z-10", children: _jsxs("div", { className: "bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg px-8 py-6 max-w-md text-center shadow-2xl", children: [_jsx("div", { className: "text-2xl text-cyan-400 mb-3", children: "Get Started" }), _jsxs("p", { className: "text-gray-300 text-sm leading-relaxed", children: ["Drag components from the left palette to begin building your circuit, or", ' ', _jsx("button", { onClick: () => setShowOpenModal(true), className: "text-cyan-400 hover:text-cyan-300 underline pointer-events-auto", children: "load an example" }), "."] })] }) })), disableSplitView ? (_jsx("div", { className: "flex h-full items-center justify-center text-sm text-gray-300", children: "Split view disabled by debug flag." })) : (_jsx(SplitViewLayout, { mode: e2eDisableQuad && splitScreenMode === 'quad' ? 'single' : splitScreenMode, views: e2eDisableQuad ? [activeViews[0] ?? 'circuit'] : activeViews, splitRatio: splitRatio, engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: handleUndo, onRedo: handleRedo, getChipMetadata: getChipMetadataForNode, onNodeDoubleClick: handleEnterChip, showCircuitHints: false, onDismissCircuitHints: () => setShowCircuitHints(false), showSchematicHints: false, onDismissSchematicHints: () => setShowSchematicHints(false), show3DHints: false, onDismiss3DHints: () => setShow3DHints(false), showOscilloscopeHints: false, onDismissOscilloscopeHints: () => setShowOscilloscopeHints(false), onInputToggled: handleInputToggled, onCircuitChange: handleCircuitChange, viewStateStore: useViewStateStore, onProbeToggle: handleProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: (section) => {
                                        setHelpDockSection(section);
                                        setShowHelpDock(true);
                                    }, disableToolStrip: disableToolStrip })), isReplayMode && (_jsx("div", { className: "absolute inset-0 z-30 pointer-events-none", children: _jsxs("div", { className: "absolute top-3 right-3 bg-gray-900/80 border border-gray-700 rounded px-2 py-2 text-[10px] text-cyan-300 font-mono pointer-events-auto", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "uppercase tracking-wide", children: "Replay" }), _jsxs("span", { children: ["t", playheadTick] })] }), _jsxs("div", { className: "mt-2 flex items-center gap-1", children: [_jsx("button", { onClick: replayPaused ? handleRunReplayResume : handleRunReplayPause, className: "px-1.5 py-0.5 border border-gray-600 rounded text-[10px] text-gray-200 hover:bg-gray-800", type: "button", children: replayPaused ? 'Play' : 'Pause' }), _jsx("button", { onClick: () => handleRunReplayStep(1), className: "px-1.5 py-0.5 border border-gray-600 rounded text-[10px] text-gray-200 hover:bg-gray-800", type: "button", disabled: !replayPaused, title: !replayPaused ? 'Pause replay to step' : undefined, children: "Step" }), _jsx("button", { onClick: () => handleRunReplayStep(10), className: "px-1.5 py-0.5 border border-gray-600 rounded text-[10px] text-gray-200 hover:bg-gray-800", type: "button", disabled: !replayPaused, title: !replayPaused ? 'Pause replay to step' : undefined, children: "+10" }), _jsx("button", { onClick: handleRunReplayStop, className: "px-1.5 py-0.5 border border-red-700 rounded text-[10px] text-red-300 hover:bg-red-900/30", type: "button", children: "Exit" })] })] }) })), selectedExampleId && EXAMPLE_NOTES[selectedExampleId] && !exampleNoteDismissed && (_jsx("div", { className: "absolute top-3 left-3 z-20 max-w-sm pointer-events-auto", children: _jsx("div", { className: "bg-slate-900/90 border border-slate-700 rounded-lg px-4 py-3 text-xs shadow-lg", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-cyan-300", children: "What to do" }), _jsx("div", { className: "text-sm font-semibold text-white", children: EXAMPLE_NOTES[selectedExampleId]?.title }), _jsx("div", { className: "text-gray-300 mt-1 leading-relaxed", children: EXAMPLE_NOTES[selectedExampleId]?.description })] }), _jsx("button", { onClick: () => setExampleNoteDismissed(true), className: "text-gray-500 hover:text-gray-300 transition-colors", "aria-label": "Dismiss example note", type: "button", children: "x" })] }) }) })), tutorialActive && _jsx(TutorialOverlay, { onLoadExample: handleLoadTutorialExample })] }), showHelpDock ? (_jsx(HelpDock, { visible: true, focusSection: helpDockSection, onClose: () => {
                                setShowHelpDock(false);
                                setHelpDockSection(null);
                            }, onLoadExample: (exampleId, highlightComponents) => {
                                handleLoadExample(exampleId);
                                // TODO: Implement component highlighting
                                if (highlightComponents && import.meta.env.DEV) {
                                    console.log('Highlighting components:', highlightComponents);
                                }
                            } })) : !disableRightDock ? (_jsx(RightDock, { circuit: circuit, engine: engine, isRunning: isRunning, isReplayMode: isReplayMode, onRun: handleRun, onPause: handlePause, onStep: handleStep, onResetTickCount: handleResetTickCount, ioMapping: ioMapping, ioInputStates: ioInputStates, ioOutputStates: ioOutputStates, onIoToggleInput: handleIoToggleInput, onIoInitialize: handleIoInitialize, onIoAssignPin: handleIoAssignPin, lastTickAt: lastTickAt, highlightProbePaths: highlightProbePaths, onToggleHighlightProbePaths: setHighlightProbePaths, onNodeUpdate: handleNodeUpdate, onConnectionDelete: handleConnectionDelete, onFocusNode: handleFocusNode, onIssueHover: (nodeId, portName) => {
                                if (!nodeId || !portName) {
                                    setHighlightedPort(null);
                                    return;
                                }
                                setHighlightedPort({ nodeId, portName });
                            }, tickCount: tickCount, tickRate: currentHz, onRecordArm: handleRunRecorderArm, onRecordStart: handleRunRecorderStart, onRecordStop: handleRunRecorderStop, onRecordReplayStart: handleRunReplayStart, onRecordReplayStop: handleRunReplayStop, onRecordReplayPause: handleRunReplayPause, onRecordReplayResume: handleRunReplayResume, onRecordReplayStep: handleRunReplayStep, onRecordReplayJump: handleRunReplayJump, onRecordVerify: verifyRunReplay, onRecordExport: handleRunRecorderExport, onRecordExportProof: handleRunRecorderExportProof, onRecordProof: handleRunRecorderProof, onRecordFocus: handleRunRecorderFocus, onRecordMismatchSelect: handleMismatchSelect, onRecordImportProofPack: handleRunRecorderImportProofPack, onLoadExample: handleLoadLearnExample, onExitLearnMode: handleExitLearnMode, chips: allChips, initialState: rightDockState, initialTab: rightDockTab, onStateChange: setRightDockState, onTabChange: setRightDockTab })) : null] }), isLoadingSharedCircuit && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsx(OverlayPanel, { className: "bg-gray-800 p-6 rounded-lg shadow-lg", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" }), _jsx("span", { className: "text-white", children: "Loading shared circuit..." })] }) }) })), shareFallbackURL && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-3 text-white", children: "Share Link Ready" }), _jsx("p", { className: "text-sm text-gray-300 mb-4", children: "Automatic clipboard copy failed. Please copy the link manually:" }), _jsx("input", { type: "text", readOnly: true, value: shareFallbackURL, onClick: (e) => e.currentTarget.select(), "aria-label": "Share link", className: "w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white font-mono text-sm mb-4", autoFocus: true }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { onClick: () => {
                                            navigator.clipboard.writeText(shareFallbackURL).catch(() => { });
                                            addToast('Link copied!', 'success');
                                            setShareFallbackURL(null);
                                        }, className: "px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm", children: "Copy" }), _jsx("button", { onClick: () => setShareFallbackURL(null), className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm", children: "Close" })] })] }) })), showDecodeErrorModal && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-3 text-red-400", children: "Invalid Share Link" }), _jsx("p", { className: "text-sm text-gray-300 mb-4", children: "This share link is invalid or corrupted. The circuit could not be loaded." }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { onClick: handleClearURLAndReset, className: "px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm", children: "Clear URL & Start Fresh" }), _jsx("button", { onClick: () => setShowDecodeErrorModal(false), className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm", children: "Close" })] }), _jsx("a", { href: "https://github.com/swaggyp52/redbyte-ui-genesis/issues", target: "_blank", rel: "noopener noreferrer", className: "block mt-4 text-xs text-cyan-400 hover:text-cyan-300", children: "Report Issue \u2192" })] }) })), showExportModal && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-3 text-white", children: "Export" }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsx("button", { onClick: () => {
                                            handleSaveProject();
                                            setShowExportModal(false);
                                        }, className: "w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left", children: "Project (rb-project.json)" }), _jsx("button", { onClick: () => {
                                            void handleSaveProjectArchive();
                                            setShowExportModal(false);
                                        }, className: "w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left", children: "Project Archive (.rbproj.zip)" }), _jsx("button", { onClick: () => {
                                            handleExportNetlist();
                                            setShowExportModal(false);
                                        }, className: "w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left", children: "Netlist (netlist.json)" }), _jsx("button", { onClick: () => {
                                            handleExportVerilog();
                                            setShowExportModal(false);
                                        }, className: "w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left", children: "Verilog (circuit.v)" }), _jsx("button", { onClick: () => {
                                            handleExportDebugBundle();
                                            setShowExportModal(false);
                                        }, className: "w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm text-left", children: "Debug Bundle (rb-debug-bundle.json)" })] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: () => setShowExportModal(false), className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm", children: "Close" }) })] }) })), showSaveAsModal && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-3 text-white", children: "Save Circuit As..." }), _jsx("input", { type: "text", value: saveAsFilename, onChange: (e) => setSaveAsFilename(e.target.value), onKeyDown: (e) => {
                                    if (e.key === 'Enter')
                                        confirmSaveAs();
                                    if (e.key === 'Escape')
                                        setShowSaveAsModal(false);
                                }, className: "w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white mb-4", placeholder: "circuit.rblogic", "aria-label": "Save as filename", autoFocus: true }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { onClick: confirmSaveAs, className: "px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm", children: "Save" }), _jsx("button", { onClick: () => setShowSaveAsModal(false), className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm", children: "Cancel" })] })] }) })), showOpenModal && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4", children: [_jsx("h3", { className: "text-lg font-semibold mb-3 text-white", children: "Open Circuit" }), availableFiles.length === 0 ? (_jsx("p", { className: "text-sm text-gray-300 mb-4", children: "No saved circuits found. Create one with Ctrl+S." })) : (_jsx("div", { className: "mb-4 max-h-64 overflow-y-auto", children: availableFiles.map((file, index) => (_jsxs("button", { onClick: () => handleOpenFile(file.id), onKeyDown: (e) => {
                                        if (e.key === 'Enter')
                                            handleOpenFile(file.id);
                                        if (e.key === 'Escape')
                                            setShowOpenModal(false);
                                    }, className: "w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded mb-2 text-white text-sm transition-colors", autoFocus: index === 0, children: [_jsx("div", { className: "font-medium", children: file.name }), _jsxs("div", { className: "text-xs text-gray-400", children: ["Modified: ", file.modified] })] }, file.id))) })), _jsx("div", { className: "flex gap-2 justify-end", children: _jsx("button", { onClick: () => setShowOpenModal(false), className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm", children: "Cancel" }) })] }) })), showExamplesModal && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: "bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col", children: [_jsx("h3", { className: "text-lg font-semibold mb-3 text-white", children: "Load Example" }), _jsx("div", { className: "flex-1 overflow-y-auto mb-4", children: [0, 1, 2, 3, 4, 5, 6].map((layer) => {
                                    const layerExamples = listExamplesByLayer(layer);
                                    if (layerExamples.length === 0)
                                        return null;
                                    return (_jsxs("div", { className: "mb-4", children: [_jsxs("h4", { className: "text-sm font-semibold text-cyan-400 mb-2", children: ["Layer ", layer, ": ", getLayerDescription(layer)] }), _jsx("div", { className: "space-y-1", children: layerExamples.map((ex) => (_jsx("button", { onClick: () => {
                                                        handleLoadExample(ex.id);
                                                        setShowExamplesModal(false);
                                                    }, className: "w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded text-white text-sm transition-colors", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium", children: ex.name }), _jsx("span", { className: "text-xs text-gray-400", children: ex.difficulty })] }) }, ex.id))) })] }, layer));
                                }) }), _jsx("div", { className: "flex gap-2 justify-end border-t border-gray-700 pt-4", children: _jsx("button", { onClick: () => setShowExamplesModal(false), className: "px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm", children: "Cancel" }) })] }) })), showSaveChipModal && recognizedPattern && (_jsx(SaveChipModal, { circuit: circuit, recognizedPattern: recognizedPattern, onSave: handleSaveChip, onCancel: () => setShowSaveChipModal(false) })), showTraceViewer && (_jsx(OverlayRoot, { className: "bg-black bg-opacity-50 flex items-center justify-center", children: _jsx(OverlayPanel, { className: "bg-gray-900 rounded-lg shadow-2xl w-[90%] h-[90%] max-w-5xl overflow-hidden border border-gray-700", children: _jsx(TraceViewer, { traces: traceSnapshots, circuit: circuit, currentTick: tickEngine.getTickCount(), onClose: () => setShowTraceViewer(false) }) }) })), _jsx(ChipLibraryModal, { isOpen: showChipLibrary, onClose: () => setShowChipLibrary(false), chips: allChips, onSelectChip: handleSelectChipFromLibrary, onDeleteChip: handleDeleteChip, onDragStart: handleNodeDragStart }), _jsx(KeyboardShortcutsHelp, { isOpen: showKeyboardHelp, onClose: () => setShowKeyboardHelp(false) }), _jsx(QuickAddPalette, { isOpen: showQuickAdd, onClose: () => setShowQuickAdd(false), onSelectComponent: (type) => {
                        if (isReplayMode)
                            return;
                        storeAddNode(type, getDefaultAddPosition());
                        setShowQuickAdd(false);
                    }, isReplayMode: isReplayMode }), _jsx(StartHerePanel, { isOpen: showStartHere, onClose: () => setShowStartHere(false), onLoadExample: async (exampleId) => {
                        // Load D Flip-Flop example
                        try {
                            const example = await loadExample(exampleId);
                            if (example) {
                                const deserialized = deserialize(example);
                                setCircuit(deserialized);
                                engine.setCircuit(deserialized);
                                tickEngine.setCircuit(deserialized);
                                addToast('Example loaded successfully', 'success');
                            }
                        }
                        catch (error) {
                            console.error('Failed to load example:', error);
                            addToast('Failed to load example', 'error');
                        }
                        setShowStartHere(false);
                    }, onOpenOscilloscope: () => {
                        setPerspective('analyze'); // Analyze perspective shows oscilloscope
                        setRightDockTab('probes');
                        if (rightDockState === 'collapsed') {
                            setRightDockState('expanded');
                        }
                        setShowStartHere(false);
                    }, onStartGuidedLab: () => {
                        setShowStartHere(false);
                        // Launch Lab Assignment App with Lab 1
                        if (onOpenApp) {
                            onOpenApp('ece-lab', { labId: 'guided-01' });
                        }
                        else {
                            addToast('Lab Assignment App not available in this environment', 'error');
                        }
                    } }), ceMode && (_jsxs(_Fragment, { children: [_jsx(ResetWorkspaceModal, { isOpen: showCEResetModal, onConfirm: handleCEResetWorkspace, onCancel: () => setShowCEResetModal(false) }), _jsx(ExampleGalleryModal, { isOpen: showCEExamplesModal, examples: [], onSelectExample: handleCELoadExample, onClose: () => setShowCEExamplesModal(false) }), _jsx(ExportBundleModal, { isOpen: showCEExportModal, circuit: circuit, exampleName: projectName, onClose: () => setShowCEExportModal(false) })] })), _jsx(StatusBar, { nodeCount: circuit.nodes.length, connectionCount: circuit.connections.length, selectedCount: 0, isRunning: isRunning, tickRate: currentHz, isDirty: isDirty, canUndo: canUndo, canRedo: canRedo, viewMode: viewLabel })] }) }));
};
// End of LogicPlaygroundApp components
export const LogicPlaygroundApp = {
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
