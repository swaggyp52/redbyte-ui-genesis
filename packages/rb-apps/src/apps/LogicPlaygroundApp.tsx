// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

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
import { useToastStore } from '@redbyte/rb-shell';
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
import { registerAllChips, registerChip, unregisterChip } from '../utils/chipRegistry';

type ViewMode = 'circuit' | 'schematic' | 'oscilloscope' | '3d';

// Primitive node types (built-in gates)
const PRIMITIVE_NODES = [
  'PowerSource',
  'Switch',
  'Lamp',
  'Wire',
  'AND',
  'OR',
  'NOT',
  'NAND',
  'XOR',
  'Clock',
  'Delay',
] as const;

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
}

const LogicPlaygroundComponent: React.FC<LogicPlaygroundProps> = ({
  windowId,
  initialFileId,
  initialExampleId,
  resourceId,
  resourceType,
}) => {
  const { tickRate } = useSettingsStore();
  const { addToast } = useToastStore();
  const { active: tutorialActive, start: startTutorial } = useTutorialStore();
  const { setWindowTitle } = useWindowStore();
  const { getAllFiles, getFile, updateFileContent, createFile } = useFileSystemStore();
  const { pushState, undo, redo, canUndo, canRedo, clear: clearHistory } = useHistoryStore();
  const { saveChipFromPattern, getAllChips, getChip, deleteChip } = useChipStore();
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

  const autosaveIntervalRef = useRef<number | null>(null);
  const historyDebounceRef = useRef<number | null>(null);
  const patternRecognitionRef = useRef<number | null>(null);
  const lastRecognizedPatternRef = useRef<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const hasLoadedFromURL = useRef(false);
  const isHydratingRef = useRef(false); // Guard to prevent setting dirty during file load

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [circuit, currentFileId]);

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

    // Create new node at drop position
    const newNode: Node = {
      id: `${draggingNodeType.toLowerCase()}-${Date.now()}`,
      type: draggingNodeType,
      x,
      y,
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
    // Clear pattern recognition state
    lastRecognizedPatternRef.current = null;
    // Clear hydration guard after load completes
    isHydratingRef.current = false;
  };

  const handleLoadExample = async (exampleId: ExampleId | '') => {
    if (!exampleId) return;
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
    // Clear history and set initial state when loading example
    clearHistory();
    pushState(loadedCircuit);
    // Clear pattern recognition state
    lastRecognizedPatternRef.current = null;
    // Clear hydration guard after load completes
    isHydratingRef.current = false;
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
    tickEngine.stepOnce();
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

      {/* Top Toolbar */}
      <div className="border-b border-gray-700 p-2 flex items-center gap-2 flex-wrap text-sm">
        <button
          onClick={handleNew}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          New
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-cyan-700 hover:bg-cyan-600 rounded"
        >
          Save{isDirty ? '*' : ''}
        </button>
        <div className="flex items-center gap-2">
          <select
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(e.target.value)}
            className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs"
          >
            <option value="">Select file...</option>
            {availableFiles.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleLoadFile(selectedFileId)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Load File
          </button>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        <div className="flex items-center gap-2">
          <select
            value={selectedExampleId}
            onChange={(e) => setSelectedExampleId(e.target.value as ExampleId | '')}
            className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs"
          >
            <option value="">Browse Examples by Layer...</option>
            {([0, 1, 2, 3, 4, 5, 6] as CircuitLayer[]).map((layer) => {
              const layerExamples = listExamplesByLayer(layer);
              if (layerExamples.length === 0) return null;
              return (
                <optgroup key={layer} label={`Layer ${layer}: ${getLayerDescription(layer)}`}>
                  {layerExamples.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.difficulty})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <button
            onClick={() => handleLoadExample(selectedExampleId)}
            disabled={!selectedExampleId}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load Example
          </button>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        {/* Chip Library Button */}
        {allChips.length > 0 && (
          <button
            onClick={() => setShowChipLibrary(true)}
            className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded"
            title="Browse Chip Library (Ctrl+L)"
          >
            Browse Chips ({allChips.length})
          </button>
        )}

        <div className="w-px h-6 bg-gray-600" />

        <button
          onClick={handleImport}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          Import
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          Export
        </button>
        <button
          onClick={handleShare}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded"
          title="Share circuit via link (Ctrl+Shift+C)"
        >
          Share
        </button>
        {recognizedPattern && (
          <button
            onClick={() => setShowSaveChipModal(true)}
            className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded"
            title={`Save ${recognizedPattern.name} as reusable chip`}
          >
            Save as Chip
          </button>
        )}

        <div className="w-px h-6 bg-gray-600" />

        <button
          onClick={isRunning ? handlePause : handleRun}
          className={`px-3 py-1 rounded ${
            isRunning
              ? 'bg-yellow-700 hover:bg-yellow-600'
              : 'bg-green-700 hover:bg-green-600'
          }`}
        >
          {isRunning ? 'Pause' : 'Run'}
        </button>
        <button
          onClick={handleStep}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded"
        >
          Step
        </button>

        <label className="flex items-center gap-2">
          <span>Hz:</span>
          <input
            type="range"
            min="1"
            max="60"
            value={currentHz}
            onChange={(e) => handleHzChange(parseInt(e.target.value, 10))}
            className="w-24"
          />
          <span className="w-8 text-right">{currentHz}</span>
        </label>

        <div className="w-px h-6 bg-gray-600" />

        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          className="px-3 py-1 bg-gray-700 rounded"
        >
          <option value="circuit">Circuit</option>
          <option value="schematic">Schematic</option>
          <option value="oscilloscope">Oscilloscope</option>
          <option value="3d">3D</option>
        </select>

        <button
          onClick={() => {
            setShowTraceViewer(!showTraceViewer);
            // Update snapshots when opening
            if (!showTraceViewer) {
              const recorder = tickEngine.getTraceRecorder();
              if (recorder) {
                setTraceSnapshots(recorder.getSnapshots());
              }
            }
          }}
          className={`px-3 py-1 rounded font-semibold ${
            showTraceViewer
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
          title="Show execution trace"
        >
          Trace
        </button>

        <div className="flex-1" />

        <button
          onClick={startTutorial}
          className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded font-bold"
          title="Start Tutorial"
        >
          ?
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Library */}
        <div className="w-48 border-r border-gray-700 overflow-y-auto p-2 bg-gray-850">
          <h3 className="text-xs font-semibold mb-2 text-gray-400">PRIMITIVES</h3>
          <div className="space-y-1 mb-4">
            {PRIMITIVE_NODES.map((type) => (
              <button
                key={type}
                draggable
                onDragStart={(e) => handleNodeDragStart(type, e)}
                className="w-full text-left px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded cursor-move transition-colors"
                title="Drag to canvas to add node"
              >
                {type}
              </button>
            ))}
          </div>

          <h3 className="text-xs font-semibold mb-2 text-gray-400">COMPOSITE</h3>
          <div className="space-y-1 mb-4">
            {COMPOSITE_NODES.map((type) => (
              <button
                key={type}
                draggable
                onDragStart={(e) => handleNodeDragStart(type, e)}
                className="w-full text-left px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded cursor-move transition-colors"
                title="Drag to canvas to add node"
              >
                {type}
              </button>
            ))}
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
                  title={`Drag to canvas to add ${chip.name} (${chip.description})`}
                >
                  {chip.name}
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
          {/* Drag preview indicator - temporarily disabled for debugging */}
          {null}

          {viewMode === '3d' ? (
            <Logic3DScene engine={engine} width={800} height={600} />
          ) : viewMode === 'schematic' ? (
            <SchematicView
              circuit={circuit}
              engine={engine}
              isRunning={isRunning}
              width={800}
              height={600}
            />
          ) : viewMode === 'oscilloscope' ? (
            <OscilloscopeView
              engine={engine}
              circuit={circuit}
              isRunning={isRunning}
              width={800}
              height={600}
            />
          ) : (
            <LogicCanvas
              engine={{
                getCircuit: () => circuit,
                setCircuit: (c: Circuit) => {
                  setCircuit(c);
                  engine.setCircuit(c);
                  // Only mark dirty if not currently loading a file
                  if (!isHydratingRef.current) {
                    setIsDirty(true);

                    // Debounced history push (1 second after last change)
                    if (historyDebounceRef.current) {
                      clearTimeout(historyDebounceRef.current);
                    }
                    historyDebounceRef.current = setTimeout(() => {
                      pushState(c);
                    }, 1000) as unknown as number;

                    // Debounced pattern recognition (2 seconds after last change)
                    if (patternRecognitionRef.current) {
                      clearTimeout(patternRecognitionRef.current);
                    }
                    patternRecognitionRef.current = setTimeout(() => {
                      const pattern = recognizePattern(c);
                      if (pattern && pattern.name !== lastRecognizedPatternRef.current) {
                        // Only show toast if this is a new pattern (not previously recognized)
                        lastRecognizedPatternRef.current = pattern.name;
                        setRecognizedPattern(pattern); // Save pattern for chip creation
                        addToast(
                          `You just built a ${pattern.name}! ${pattern.description}`,
                          'success',
                          5000
                        );
                      }
                    }, 2000) as unknown as number;
                  }
                },
                getEngine: () => engine,
              }}
              getChipMetadata={(nodeType) => {
                const chip = getChip(nodeType);
                if (!chip) return undefined;
                return {
                  name: chip.name,
                  inputs: chip.inputs.map((p) => ({ id: p.id, name: p.name })),
                  outputs: chip.outputs.map((p) => ({ id: p.id, name: p.name })),
                  color: chip.iconColor,
                  layer: chip.layer,
                };
              }}
              width={800}
              height={600}
              showToolbar={false}
            />
          )}

          {tutorialActive && <TutorialOverlay onLoadExample={handleLoadTutorialExample} />}
        </div>

        {/* Right Sidebar - Inspector */}
        <PropertyInspector
          circuit={circuit}
          engine={engine}
          isRunning={isRunning}
          onNodeUpdate={handleNodeUpdate}
          onConnectionDelete={handleConnectionDelete}
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
