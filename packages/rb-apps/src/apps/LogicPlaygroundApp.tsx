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
import { loadExample, listExamples, type ExampleId } from '../examples';
import {
  getFile,
  updateFile,
  createFile,
  listFiles,
  type LogicFile,
} from '../stores/filesStore';
import { useTutorialStore } from '../tutorial/tutorialStore';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

type ViewMode = 'circuit' | 'schematic' | 'isometric' | '3d';

interface LogicPlaygroundProps {
  initialFileId?: string;
  initialExampleId?: ExampleId;
  resourceId?: string;
  resourceType?: 'file' | 'folder';
}

const LogicPlaygroundComponent: React.FC<LogicPlaygroundProps> = ({
  initialFileId,
  initialExampleId,
  resourceId,
  resourceType,
}) => {
  const { tickRate } = useSettingsStore();
  const { addToast } = useToastStore();
  const { active: tutorialActive, start: startTutorial } = useTutorialStore();
  const examples = useRef(listExamples());
  const [availableFiles, setAvailableFiles] = useState<LogicFile[]>(listFiles());
  const [selectedFileId, setSelectedFileId] = useState<string | ''>(initialFileId ?? '');
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleId | ''>(
    initialExampleId ?? ''
  );

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
  const [shareFallbackURL, setShareFallbackURL] = useState<string | null>(null);
  const [showDecodeErrorModal, setShowDecodeErrorModal] = useState(false);
  const [isLoadingSharedCircuit, setIsLoadingSharedCircuit] = useState(false);

  const autosaveIntervalRef = useRef<number | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const hasLoadedFromURL = useRef(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+C or Cmd+Shift+C for share
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handleShare();
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
          const newFile = createFile(resourceId, serialized);
          setCurrentFileId(newFile.id);
          setAvailableFiles(listFiles());
          setSelectedFileId(newFile.id);
          setIsDirty(false);
          addToast(`Created new circuit: ${resourceId}`, 'success');
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

  // Autosave every 5 seconds when dirty
  useEffect(() => {
    if (autosaveIntervalRef.current) {
      clearInterval(autosaveIntervalRef.current);
    }

    if (isDirty && currentFileId) {
      autosaveIntervalRef.current = setInterval(() => {
        const serialized = serialize(circuit);
        updateFile(currentFileId, serialized);
      }, 5000) as unknown as number;
    }

    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
      }
    };
  }, [isDirty, currentFileId, circuit]);

  const handleNew = () => {
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
  };

  const handleSave = () => {
    const serialized = serialize(circuit);

    if (currentFileId) {
      updateFile(currentFileId, serialized);
      setAvailableFiles(listFiles());
      setIsDirty(false);
    } else {
      const name = prompt('Enter circuit name:');
      if (name) {
        const newFile = createFile(name, serialized);
        setCurrentFileId(newFile.id);
        setAvailableFiles(listFiles());
        setSelectedFileId(newFile.id);
        setIsDirty(false);
      }
    }
  };

  const handleLoadFile = async (fileId: string | null) => {
    if (!fileId) return;
    const file = getFile(fileId);
    if (!file) {
      alert('File not found');
      return;
    }
    const loadedCircuit = deserialize(file.circuit);
    setCircuit(loadedCircuit);
    const newEngine = new CircuitEngine(loadedCircuit);
    setEngine(newEngine);
    setTickEngine(new TickEngine(newEngine, tickRate));
    setCurrentFileId(file.id);
    setSelectedFileId(file.id);
    setSelectedExampleId('');
    setIsDirty(false);
  };

  const handleLoadExample = async (exampleId: ExampleId | '') => {
    if (!exampleId) return;
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
            const json = JSON.parse(evt.target?.result as string);
            const loadedCircuit = deserialize(json);
            setCircuit(loadedCircuit);
            const newEngine = new CircuitEngine(loadedCircuit);
            setEngine(newEngine);
            setTickEngine(new TickEngine(newEngine, currentHz));
            setCurrentFileId(null);
            setIsDirty(true);
          } catch (err) {
            alert('Failed to import circuit: ' + err);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleRun = () => {
    tickEngine.start();
    setIsRunning(true);
  };

  const handlePause = () => {
    tickEngine.pause();
    setIsRunning(false);
  };

  const handleStep = () => {
    tickEngine.stepOnce();
  };

  const handleHzChange = (hz: number) => {
    setCurrentHz(hz);
    tickEngine.setTickRate(hz);
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

  const primitiveNodes = [
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
  ];

  const compositeNodes = [
    'RSLatch',
    'DFlipFlop',
    'JKFlipFlop',
    'FullAdder',
    'Counter4Bit',
  ];

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
            <option value="">Select example...</option>
            {examples.current.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleLoadExample(selectedExampleId)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Load Example
          </button>
        </div>

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
          <option value="isometric">Isometric</option>
          <option value="3d">3D</option>
        </select>

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
            {primitiveNodes.map((type) => (
              <button
                key={type}
                onClick={() => {
                  alert(`Add ${type} node (drag-to-add not yet implemented)`);
                }}
                className="w-full text-left px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded"
              >
                {type}
              </button>
            ))}
          </div>

          <h3 className="text-xs font-semibold mb-2 text-gray-400">COMPOSITE</h3>
          <div className="space-y-1">
            {compositeNodes.map((type) => (
              <button
                key={type}
                onClick={() => {
                  alert(`Add ${type} node (drag-to-add not yet implemented)`);
                }}
                className="w-full text-left px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded"
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Center - Canvas */}
        <div ref={canvasAreaRef} tabIndex={-1} className="flex-1 relative outline-none">
          {viewMode === '3d' ? (
            <Logic3DScene engine={engine} width={800} height={600} />
          ) : (
            <LogicCanvas
              engine={{
                getCircuit: () => circuit,
                setCircuit: (c: Circuit) => {
                  setCircuit(c);
                  engine.setCircuit(c);
                  setIsDirty(true);
                },
                getEngine: () => engine,
              }}
              width={800}
              height={600}
              showToolbar={false}
            />
          )}

          {tutorialActive && <TutorialOverlay onLoadExample={handleLoadTutorialExample} />}
        </div>

        {/* Right Sidebar - Inspector */}
        <div className="w-64 border-l border-gray-700 overflow-y-auto p-4 bg-gray-850">
          <h3 className="text-sm font-semibold mb-3">Inspector</h3>
          <div className="text-xs text-gray-400">
            <p>Select a node to view properties</p>
            <p className="mt-4">Circuit Stats:</p>
            <p>Nodes: {circuit.nodes.length}</p>
            <p>Connections: {circuit.connections.length}</p>
          </div>
        </div>
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
