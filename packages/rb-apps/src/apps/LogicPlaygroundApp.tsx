// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
// v1.0.1 - Multi-view enhancement with null safety

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import {
  CircuitEngine,
  TickEngine,
  serialize,
  deserialize,
  NodeRegistry,
  decodeCircuitAsync,
  encodeCircuitCompressed,
  type Circuit,
  type SerializedCircuitV1,
} from '@redbyte/rb-logic-core';
import { LogicCanvas } from '@redbyte/rb-logic-view';
import { ViewAdapter } from '@redbyte/rb-logic-adapter';
import { Logic3DScene } from '@redbyte/rb-logic-3d';
import { useSettingsStore } from '@redbyte/rb-utils';
import { useToastStore, triggerNarrative } from '@redbyte/rb-shell';
import { useWindowStore } from '@redbyte/rb-windowing';
import { loadExample, listExamples, listExamplesByLayer, getLayerDescription, type ExampleId, type CircuitLayer } from '../examples';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useHistoryStore } from '../stores/historyStore';
import { useChipStore } from '../stores/chipStore';
import type { ChipPort } from '../stores/chipStore';
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
import { registerAllChips, registerChip, unregisterChip } from '../utils/chipRegistry';
import { useViewStateStore } from '../stores/viewStateStore';
import { setGlobalViewStateSync } from '@redbyte/rb-logic-view';
import { useHierarchyStore } from '../stores/hierarchyStore';
import { HierarchyBreadcrumbs } from '../components/HierarchyBreadcrumbs';
import { KeyboardShortcutsHelp } from '../components/KeyboardShortcutsHelp';
import { ComponentPalette } from '../components/ComponentPalette';
import { QuickAddPalette } from '../components/QuickAddPalette';
import { StatusBar } from '../components/StatusBar';
import { TopCommandBar } from '../components/TopCommandBar';
import { RightDock, type RightDockState } from '../components/RightDock';

type ViewMode = 'circuit' | 'schematic' | 'oscilloscope' | '3d';
type PlaygroundMode = 'build' | 'analyze' | 'learn' | 'quad';

// Primitive node types (built-in gates) organized by category
const PRIMITIVE_NODES = {
  'Basic I/O': ['PowerSource', 'Switch', 'INPUT', 'Lamp', 'OUTPUT', 'Wire'],
  'Logic Gates': ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'],
  'Timing': ['Clock', 'Delay'],
} as const;

// Composite node types (built-in multi-gate circuits)
const COMPOSITE_NODES = [
  'RSLatch',
  'DFlipFlop',
  'JKFlipFlop',
  'FullAdder',
  'Counter4Bit',
] as const;

interface LogicPlaygroundProps {
  windowId?: string;
  initialFileId?: string;
  initialExampleId?: ExampleId;
  resourceId?: string;
  resourceType?: 'file' | 'folder';
  // Determinism recording (Milestone D - optional, dev-only)
  registerStateAccessor?: (windowId: string, accessor: { getCircuit?: () => any }) => void;
  unregisterStateAccessor?: (windowId: string) => void;
  determinismRecorder?: any; // Type from useDeterminismRecorder hook
}

const LogicPlaygroundComponent: React.FC<LogicPlaygroundProps> = ({
  windowId,
  initialFileId,
  initialExampleId,
  resourceId,
  resourceType,
  registerStateAccessor,
  unregisterStateAccessor,
  determinismRecorder,
}) => {
  const { tickRate } = useSettingsStore();
  const { addToast } = useToastStore();
  const { active: tutorialActive, start: startTutorial } = useTutorialStore();
  const { setWindowTitle } = useWindowStore();
  const { getAllFiles, getFile, updateFileContent, createFile } = useFileSystemStore();
  const { pushState, undo, redo, canUndo, canRedo, clear: clearHistory } = useHistoryStore();
  const { saveChipFromPattern, getAllChips, getChip, deleteChip } = useChipStore();
  const {
    stack: hierarchyStack,
    currentCircuit: hierarchyCircuit,
    enterChip,
    exitToParent,
    exitToTop,
    setCurrentCircuit: setHierarchyCircuit,
    isEditMode,
    toggleEditMode,
  } = useHierarchyStore();
  const examples = useRef(listExamples());

  // Helper to get all .rblogic files
  const getLogicFiles = () => getAllFiles().filter((f) => f.name.endsWith('.rblogic'));

  const [availableFiles, setAvailableFiles] = useState<FileEntry[]>(getLogicFiles);
  const [selectedFileId, setSelectedFileId] = useState<string | ''>(initialFileId ?? '');
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleId | ''>(
    initialExampleId ?? ''
  );
  const [selectedChipId, setSelectedChipId] = useState<string>('');

  const [circuit, setCircuit] = useState<Circuit>(() => {
    return {
      nodes: [],
      connections: [],
    };
  });

  const [engine, setEngine] = useState<CircuitEngine>(() => new CircuitEngine(circuit));
  const [tickEngine, setTickEngine] = useState<TickEngine>(
    () => new TickEngine(engine, tickRate)
  );

  const [viewMode, setViewMode] = useState<ViewMode>('circuit');
  const [playgroundMode, setPlaygroundMode] = useState<PlaygroundMode>('build');
  const { splitScreenMode, activeViews, setSplitScreenMode, setActiveViews } = useViewStateStore();
  const [isRunning, setIsRunning] = useState(false);
  const [currentHz, setCurrentHz] = useState(tickRate);
  const [currentFileId, setCurrentFileId] = useState<string | null>(initialFileId ?? null);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [draggingNodeType, setDraggingNodeType] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [shareFallbackURL, setShareFallbackURL] = useState<string | null>(null);
  const [showDecodeErrorModal, setShowDecodeErrorModal] = useState(false);
  const [isLoadingSharedCircuit, setIsLoadingSharedCircuit] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsFilename, setSaveAsFilename] = useState('circuit.rblogic');
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showSaveChipModal, setShowSaveChipModal] = useState(false);
  const [showChipLibrary, setShowChipLibrary] = useState(false);
  const [recognizedPattern, setRecognizedPattern] = useState<RecognizedPattern | null>(null);
  const [showTraceViewer, setShowTraceViewer] = useState(false);
  const [traceSnapshots, setTraceSnapshots] = useState<any[]>([]);
  const [showCircuitHints, setShowCircuitHints] = useState(true);
  const [showSchematicHints, setShowSchematicHints] = useState(true);
  const [show3DHints, setShow3DHints] = useState(true);
  const [showOscilloscopeHints, setShowOscilloscopeHints] = useState(true);
  const [rightDockState, setRightDockState] = useState<RightDockState>('expanded');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);

  const autosaveIntervalRef = useRef<number | null>(null);
  const historyDebounceRef = useRef<number | null>(null);
  const patternRecognitionRef = useRef<number | null>(null);
  const lastRecognizedPatternRef = useRef<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const hasLoadedFromURL = useRef(false);
  const isHydratingRef = useRef(false); // Guard to prevent setting dirty during file load

  // Initialize global view state sync
  useEffect(() => {
    setGlobalViewStateSync(useViewStateStore);
  }, []);

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
      } catch (error) {
        console.error('Crash backup error:', error);
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [circuit, currentFileId]);

  // Crash recovery: Check for backup on mount
  useEffect(() => {
    try {
      const backupStr = localStorage.getItem('rblogic_crash_backup');
      if (backupStr) {
        const backup = JSON.parse(backupStr);
        const ageMinutes = (Date.now() - backup.timestamp) / 60000;

        // Only restore if backup is less than 30 minutes old and we don't have a file loaded
        if (ageMinutes < 30 && !initialFileId && !initialExampleId && backup.circuit) {
          const shouldRestore = confirm(
            `Found an auto-saved circuit from ${Math.round(ageMinutes)} minute(s) ago. Would you like to restore it?`
          );

          if (shouldRestore) {
            const restored = deserialize(backup.circuit);
            setCircuit(restored);
            engine.setCircuit(restored);
            setIsDirty(true);

            // Milestone D: Record circuit loaded event
            if (determinismRecorder?.isRecording) {
              determinismRecorder.recordCircuitLoaded(restored);
            }

            addToast({
              id: `restore-${Date.now()}`,
              message: 'Circuit restored from auto-save',
              type: 'success',
              duration: 4000,
            });
          }
        }
      }
    } catch (error) {
      console.error('Crash recovery error:', error);
    }
  }, []); // Only run once on mount

  // Milestone D: Register state accessor for determinism recording
  useEffect(() => {
    if (!windowId || !registerStateAccessor) return;

    // Register a function that returns the current circuit
    registerStateAccessor(windowId, {
      getCircuit: () => engine.getCircuit(),
    });

    // Cleanup on unmount
    return () => {
      if (unregisterStateAccessor) {
        unregisterStateAccessor(windowId);
      }
    };
  }, [windowId, registerStateAccessor, unregisterStateAccessor, engine]);

  // Milestone D: Wrap TickEngine.stepOnce to record simulation ticks during continuous run
  useEffect(() => {
    if (!determinismRecorder?.isRecording) return;

    // Save original stepOnce method
    const originalStepOnce = tickEngine.stepOnce.bind(tickEngine);

    // Override with recording version
    tickEngine.stepOnce = function(this: TickEngine) {
      const prevTick = this.getTickCount();
      originalStepOnce();
      const newTick = this.getTickCount();

      // Record the tick
      if (determinismRecorder?.isRecording) {
        determinismRecorder.recordSimulationTick(prevTick, newTick);
      }
    };

    // Restore original on cleanup or when recording stops
    return () => {
      tickEngine.stepOnce = originalStepOnce;
    };
  }, [tickEngine, determinismRecorder, determinismRecorder?.isRecording]);

  // Register saved chips on mount
  useEffect(() => {
    const chips = getAllChips();
    registerAllChips(chips);
  }, []); // Only run once on mount

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (e.key === 'Backspace' && hierarchyStack.length > 0 && !isInputFocused()) {
        e.preventDefault();
        exitToParent();
      }
      // E to toggle edit mode when inside a chip
      if (e.key === 'e' && hierarchyStack.length > 0 && !isInputFocused()) {
        e.preventDefault();
        toggleEditMode();
      }
      // ? to show keyboard shortcuts help
      if (e.key === '?' && !isInputFocused()) {
        e.preventDefault();
        setShowKeyboardHelp(true);
      }
      // Space to show quick add palette
      if (e.key === ' ' && !isInputFocused() && !showQuickAdd) {
        e.preventDefault();
        setShowQuickAdd(true);
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showKeyboardHelp) setShowKeyboardHelp(false);
        if (showQuickAdd) setShowQuickAdd(false);
      }
    };

    const isInputFocused = () => {
      const active = document.activeElement;
      return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [circuit, currentFileId, showKeyboardHelp, showQuickAdd]);

  // Sync hierarchy circuit with main circuit
  useEffect(() => {
    if (hierarchyStack.length > 0) {
      // We're inside a chip - use hierarchy circuit
      if (hierarchyCircuit && JSON.stringify(hierarchyCircuit) !== JSON.stringify(circuit)) {
        setCircuit(hierarchyCircuit);
        engine.setCircuit(hierarchyCircuit);
      }
    } else {
      // We're at top level - sync hierarchy with main
      if (JSON.stringify(hierarchyCircuit) !== JSON.stringify(circuit)) {
        setHierarchyCircuit(circuit);
      }
    }
  }, [hierarchyStack.length, hierarchyCircuit, circuit, engine, setHierarchyCircuit]);

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
          setTickEngine(new TickEngine(newEngine, tickRate));
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

  useEffect(() => {
    tickEngine.setTickRate(tickRate);
    setCurrentHz(tickRate);
  }, [tickRate]);

  // Playground mode: auto-adjust views based on mode
  useEffect(() => {
    switch (playgroundMode) {
      case 'build':
        // Build mode: Large Circuit + optional small Schematic preview
        setSplitScreenMode('single');
        setActiveViews(['circuit']);
        break;
      case 'analyze':
        // Analyze mode: Large Scope + Circuit smaller
        setSplitScreenMode('vertical');
        setActiveViews(['circuit', 'oscilloscope']);
        break;
      case 'learn':
        // Learn mode: Circuit emphasized (Help will be in side panel)
        setSplitScreenMode('single');
        setActiveViews(['circuit']);
        break;
      case 'quad':
        // Quad mode: 2×2 views
        setSplitScreenMode('quad');
        setActiveViews(['circuit', 'schematic', '3d', 'oscilloscope']);
        break;
    }
  }, [playgroundMode, setSplitScreenMode, setActiveViews]);

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
      title = `${title} •`;
    }

    setWindowTitle(windowId, title);
  }, [windowId, currentFileId, isDirty]);

  const handleNew = () => {
    // Set hydration guard to prevent marking dirty during load
    isHydratingRef.current = true;
    const emptyCircuit: Circuit = { nodes: [], connections: [] };
    setCircuit(emptyCircuit);
    const newEngine = new CircuitEngine(emptyCircuit);
    setEngine(newEngine);
    setTickEngine(new TickEngine(newEngine, currentHz));
    setCurrentFileId(null);
    setIsDirty(false);
    setIsRunning(false);
    setSelectedFileId('');
    setSelectedExampleId('');
    // Clear history when starting new circuit
    clearHistory();
    pushState(emptyCircuit);
    // Clear pattern recognition state
    lastRecognizedPatternRef.current = null;
    // Clear hydration guard after load completes
    isHydratingRef.current = false;
  };

  const handleUndo = () => {
    if (!canUndo()) {
      return;
    }

    const previousCircuit = undo();
    if (previousCircuit) {
      setCircuit(previousCircuit);
      const newEngine = new CircuitEngine(previousCircuit);
      setEngine(newEngine);
      setTickEngine(new TickEngine(newEngine, tickRate));
      setIsDirty(true);
      addToast('Undo', 'info');
    }
  };

  const handleRedo = () => {
    if (!canRedo()) {
      return;
    }

    const nextCircuit = redo();
    if (nextCircuit) {
      setCircuit(nextCircuit);
      const newEngine = new CircuitEngine(nextCircuit);
      setEngine(newEngine);
      setTickEngine(new TickEngine(newEngine, tickRate));
      setIsDirty(true);
      addToast('Redo', 'info');
    }
  };

  const handleNodeUpdate = (nodeId: string, updates: Partial<Node>) => {
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    };
    setCircuit(updatedCircuit);
    engine.setCircuit(updatedCircuit);
    setIsDirty(true);
  };

  const handleConnectionDelete = (connectionId: string) => {
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
    engine.setCircuit(updatedCircuit);
    setIsDirty(true);
    addToast('Connection deleted', 'info');
  };

  const handleNodeDragStart = (nodeType: string, e?: React.DragEvent) => {
    if (e) {
      try {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', nodeType);
      } catch (error) {
        console.error('Failed to set drag data:', error);
      }
    }
    setDraggingNodeType(nodeType);
  };

  const handleNodeDragOver = (e: React.DragEvent) => {
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

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Validate calculated position
    if (isNaN(x) || isNaN(y)) {
      setDraggingNodeType(null);
      setDragPosition(null);
      return;
    }

    // Create new node at drop position with correct structure
    const newNode = {
      id: `${draggingNodeType.toLowerCase()}-${Date.now()}`,
      type: draggingNodeType,
      position: { x, y },
      rotation: 0,
      config: {},
      state: {},
    };

    const updatedCircuit = {
      ...circuit,
      nodes: [...circuit.nodes, newNode],
    };

    setCircuit(updatedCircuit);
    engine.setCircuit(updatedCircuit);
    setIsDirty(true);
    addToast(`Added ${draggingNodeType}`, 'success');

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
    const file = getFile(fileId);
    if (!file) {
      addToast('File not found', 'error');
      return;
    }
    // Set hydration guard to prevent marking dirty during load
    isHydratingRef.current = true;

    // Parse the file content (JSON string) to get the serialized circuit
    const serialized: SerializedCircuitV1 = file.content
      ? JSON.parse(file.content)
      : { version: '1', nodes: [], connections: [] };

    const loadedCircuit = deserialize(serialized);
    setCircuit(loadedCircuit);
    const newEngine = new CircuitEngine(loadedCircuit);
    setEngine(newEngine);
    setTickEngine(new TickEngine(newEngine, tickRate));
    setCurrentFileId(file.id);
    setSelectedFileId(file.id);
    setSelectedExampleId('');
    setIsDirty(false);
    // Clear history and set initial state when loading file
    clearHistory();
    pushState(loadedCircuit);

    // Milestone D: Record circuit loaded event
    if (determinismRecorder?.isRecording) {
      determinismRecorder.recordCircuitLoaded(loadedCircuit);
    }
    // Clear pattern recognition state
    lastRecognizedPatternRef.current = null;
    // Clear hydration guard after load completes
    isHydratingRef.current = false;
  };

  const handleLoadExample = async (exampleId: ExampleId | '') => {
    if (!exampleId) return;

    try {
      // Set hydration guard to prevent marking dirty during load
      isHydratingRef.current = true;
      const exampleData = await loadExample(exampleId);
      const loadedCircuit = deserialize(exampleData);
      setCircuit(loadedCircuit);
      const newEngine = new CircuitEngine(loadedCircuit);
      setEngine(newEngine);
      setTickEngine(new TickEngine(newEngine, tickRate));
      setCurrentFileId(null);
      setSelectedFileId('');
      setSelectedExampleId(exampleId);
      setIsDirty(true);

      // Trigger narrative events for key examples
      if (exampleId === '10_sr-latch') {
        triggerNarrative('milestone.srLatchBuilt', { exampleId });
      } else if (exampleId === '11_d-flipflop') {
        triggerNarrative('milestone.dffUnderstood', { exampleId });
      } else if (exampleId === '04_4bit-counter') {
        triggerNarrative('milestone.counterRuns', { exampleId });
      } else if (exampleId === '05_simple-cpu') {
        triggerNarrative('milestone.cpuExplored', { exampleId });
      }
      // Clear history and set initial state when loading example
      clearHistory();
      pushState(loadedCircuit);

      // Milestone D: Record circuit loaded event
      if (determinismRecorder?.isRecording) {
        determinismRecorder.recordCircuitLoaded(loadedCircuit);
      }

      // Clear pattern recognition state
      lastRecognizedPatternRef.current = null;
      // Clear hydration guard after load completes
      isHydratingRef.current = false;

      const exampleName = examples.current.find((ex) => ex.id === exampleId)?.name ?? exampleId;
      addToast(`Loaded example: ${exampleName}`, 'success');
    } catch (error) {
      isHydratingRef.current = false;
      addToast(`Failed to load example: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      console.error('Error loading example:', error);
    }
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
            setTickEngine(new TickEngine(newEngine, currentHz));
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
      }
    };
    input.click();
  };

  const handleRun = () => {
    // Enable tracing when starting simulation
    tickEngine.enableTracing(1000);
    tickEngine.start();
    setIsRunning(true);
  };

  const handlePause = () => {
    tickEngine.pause();
    setIsRunning(false);

    // Update trace snapshots when pausing
    const recorder = tickEngine.getTraceRecorder();
    if (recorder) {
      setTraceSnapshots(recorder.getSnapshots());
    }
  };

  const handleStep = () => {
    const prevTick = tickEngine.getTickCount();
    tickEngine.stepOnce();
    const newTick = tickEngine.getTickCount();

    // Milestone D: Record simulation tick event
    if (determinismRecorder?.isRecording) {
      determinismRecorder.recordSimulationTick(prevTick, newTick);
    }
  };

  const handleHzChange = (hz: number) => {
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
    addToast(`Entered ${chip.name} • Press Esc to exit`, 'info', 3000);
  };

  const getNodeDescription = (nodeType: string): string => {
    const descriptions: Record<string, string> = {
      PowerSource: 'Always ON - provides constant HIGH signal (1)',
      Switch: 'Toggle ON/OFF - double-click to toggle state',
      INPUT: 'Toggle ON/OFF - double-click to toggle state',
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
      // Composite nodes
      RSLatch: { inputs: [{ id: 'R', name: 'R' }, { id: 'S', name: 'S' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q̅' }], layer: 3, color: '#ec4899' },
      DFlipFlop: { inputs: [{ id: 'D', name: 'D' }, { id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q̅' }], layer: 3, color: '#ec4899' },
      JKFlipFlop: { inputs: [{ id: 'J', name: 'J' }, { id: 'K', name: 'K' }, { id: 'CLK', name: 'CLK' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q̅' }], layer: 3, color: '#ec4899' },
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
    // Reset to empty circuit
    const emptyCircuit: Circuit = { nodes: [], connections: [] };
    setCircuit(emptyCircuit);
    const newEngine = new CircuitEngine(emptyCircuit);
    setEngine(newEngine);
    setTickEngine(new TickEngine(newEngine, currentHz));
    setCurrentFileId(null);
    setIsDirty(false);
    setShowDecodeErrorModal(false);
    addToast('Circuit reset', 'info');
  };

  // Memoize chips array to avoid multiple store calls during render
  const allChips = React.useMemo(() => getAllChips(), [getAllChips]);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Intent Resource Display */}
      {resourceId && (
        <div className="bg-cyan-900/30 border-b border-cyan-700 p-2 text-xs">
          Opened from Files: <span className="font-semibold">{resourceId}</span> ({resourceType})
        </div>
      )}

      {/* Hierarchy Breadcrumbs */}
      <HierarchyBreadcrumbs />

      {/* Top Command Bar - vNext Design */}
      <TopCommandBar
        onExamples={() => setShowExamplesModal(true)}
        onSave={handleSave}
        onShare={handleShare}
        isDirty={isDirty}
        isRunning={isRunning}
        onRun={handleRun}
        onPause={handlePause}
        onStep={handleStep}
        tickRate={currentHz}
        onTickRateChange={handleHzChange}
        viewMode={playgroundMode}
        onViewModeChange={setPlaygroundMode}
        onHelp={() => setShowKeyboardHelp(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Library */}
        <div className="w-48 border-r border-gray-700 overflow-y-auto p-2 bg-gray-850">
          {Object.entries(PRIMITIVE_NODES).map(([category, nodes]) => (
            <div key={category} className="mb-4">
              <h3 className="text-xs font-semibold mb-2 text-gray-400">{category.toUpperCase()}</h3>
              <div className="space-y-1">
                {nodes.map((type) => {
                  const metadata = getChipMetadataForNode(type);
                  const description = getNodeDescription(type);
                  const layerColor = metadata?.layer === 0 ? 'bg-blue-900/20 border-blue-700/30' : 'bg-green-900/20 border-green-700/30';
                  return (
                    <button
                      key={type}
                      draggable
                      onDragStart={(e) => handleNodeDragStart(type, e)}
                      className={`w-full text-left px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded cursor-move transition-colors border ${layerColor} group relative`}
                      title={description}
                    >
                      <div className="flex items-center justify-between">
                        <span>{type}</span>
                        {metadata && metadata.layer > 0 && (
                          <span className="text-[10px] text-gray-500">L{metadata.layer}</span>
                        )}
                      </div>
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-gray-900 border border-gray-600 rounded p-2 text-xs whitespace-nowrap z-50 shadow-xl">
                        {description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <h3 className="text-xs font-semibold mb-2 text-gray-400">COMPOSITE</h3>
          <div className="space-y-1 mb-4">
            {COMPOSITE_NODES.map((type) => {
              const metadata = getChipMetadataForNode(type);
              const description = getNodeDescription(type);
              const layerColors: Record<number, string> = {
                2: 'bg-teal-900/20 border-teal-700/30',
                3: 'bg-pink-900/20 border-pink-700/30',
                4: 'bg-orange-900/20 border-orange-700/30',
              };
              const layerColor = metadata?.layer ? layerColors[metadata.layer] || 'bg-gray-800' : 'bg-gray-800';
              return (
                <button
                  key={type}
                  draggable
                  onDragStart={(e) => handleNodeDragStart(type, e)}
                  className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-700 rounded cursor-move transition-colors border ${layerColor} group relative`}
                  title={description}
                >
                  <div className="flex items-center justify-between">
                    <span>{type}</span>
                    {metadata && metadata.layer && (
                      <span className="text-[10px] text-gray-500">L{metadata.layer}</span>
                    )}
                  </div>
                  {/* Tooltip on hover */}
                  <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-gray-900 border border-gray-600 rounded p-2 text-xs whitespace-nowrap z-50 shadow-xl max-w-xs">
                    {description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-400">MY CHIPS</h3>
            <button
              onClick={() => setShowChipLibrary(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
              title="Browse chip library"
            >
              Browse
            </button>
          </div>
          <div className="space-y-1">
            {allChips.length === 0 ? (
              <p className="text-xs text-gray-500 italic px-2 py-1">
                No saved chips yet
              </p>
            ) : (
              allChips.map((chip) => (
                <button
                  key={chip.id}
                  draggable
                  onDragStart={(e) => handleNodeDragStart(chip.name, e)}
                  className="w-full text-left px-2 py-1 text-xs bg-purple-900/30 hover:bg-purple-800/40 rounded cursor-move transition-colors border border-purple-700/30"
                  title={`${chip.description} • Layer ${chip.layer} • Drag to canvas`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{chip.name}</span>
                    <span className="text-[10px] text-purple-400 ml-1">L{chip.layer}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center - Canvas */}
        <div
          ref={canvasAreaRef}
          tabIndex={-1}
          className="flex-1 relative outline-none"
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
          {circuit.nodes.length === 0 && import.meta.env.VITE_PUBLIC_DEMO === 'true' && (
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

          <SplitViewLayout
            mode={splitScreenMode}
            views={activeViews}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
            onInputToggled={determinismRecorder?.isRecording ? determinismRecorder.recordInputToggled : undefined}
            onCircuitChange={(updatedCircuit) => {
              setCircuit(updatedCircuit);
              engine.setCircuit(updatedCircuit);
              tickEngine.setCircuit(updatedCircuit);
              setIsDirty(true);

              // Only mark dirty and handle history if not currently loading a file
              if (!isHydratingRef.current) {
                // Debounced history push (1 second after last change)
                if (historyDebounceRef.current) {
                  clearTimeout(historyDebounceRef.current);
                }
                historyDebounceRef.current = setTimeout(() => {
                  pushState(updatedCircuit);
                }, 1000) as unknown as number;

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
                      `🎉 You just built a ${pattern.name}! ${pattern.description} (Layer ${pattern.layer})`,
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
            }}
            viewStateStore={useViewStateStore}
          />

          {tutorialActive && <TutorialOverlay onLoadExample={handleLoadTutorialExample} />}
        </div>

        {/* Right Dock - vNext Design (replaces floating inspector) */}
        <RightDock
          circuit={circuit}
          engine={engine}
          isRunning={isRunning}
          onNodeUpdate={handleNodeUpdate}
          onConnectionDelete={handleConnectionDelete}
          chips={allChips}
          initialState={rightDockState}
          onStateChange={setRightDockState}
        />
      </div>

      {/* Loading Overlay */}
      {isLoadingSharedCircuit && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
              <span className="text-white">Loading shared circuit...</span>
            </div>
          </div>
        </div>
      )}

      {/* Clipboard Fallback Modal */}
      {shareFallbackURL && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-3 text-white">Share Link Ready</h3>
            <p className="text-sm text-gray-300 mb-4">
              Automatic clipboard copy failed. Please copy the link manually:
            </p>
            <input
              type="text"
              readOnly
              value={shareFallbackURL}
              onClick={(e) => e.currentTarget.select()}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white font-mono text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareFallbackURL).catch(() => {});
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
          </div>
        </div>
      )}

      {/* Decode Error Modal */}
      {showDecodeErrorModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
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
              Report Issue →
            </a>
          </div>
        </div>
      )}

      {/* Save As Modal */}
      {showSaveAsModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
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
          </div>
        </div>
      )}

      {/* Open File Modal */}
      {showOpenModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
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
          </div>
        </div>
      )}

      {/* Examples Modal */}
      {showExamplesModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
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
          </div>
        </div>
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
        <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg shadow-2xl w-[90%] h-[90%] max-w-5xl overflow-hidden border border-gray-700">
            <TraceViewer
              traces={traceSnapshots}
              circuit={circuit}
              currentTick={tickEngine.getTickCount()}
              onClose={() => setShowTraceViewer(false)}
            />
          </div>
        </div>
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
          handleAddNode(type);
          setShowQuickAdd(false);
        }}
      />

      {/* Status Bar */}
      <StatusBar
        nodeCount={circuit.nodes.length}
        connectionCount={circuit.connections.length}
        selectedCount={0}
        isRunning={isRunning}
        tickRate={currentHz}
        isDirty={isDirty}
        canUndo={canUndo()}
        canRedo={canRedo()}
        viewMode={splitScreenMode ? `${activeViews[0]}+${activeViews[1]}` : viewMode}
      />
    </div>
  );
};

export const LogicPlaygroundApp: RedByteApp = {
  manifest: {
    id: 'logic-playground',
    name: 'Logic Playground',
    iconId: 'logic',
    category: 'logic',
    defaultSize: { width: 1200, height: 800 },
    minSize: { width: 800, height: 600 },
  },
  component: LogicPlaygroundComponent,
};
