import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import {
  CircuitEngine,
  TickEngine,
  serialize,
  deserialize,
  NodeRegistry,
  type Circuit,
  type SerializedCircuitV1,
} from '@rb/rb-logic-core';
import { LogicCanvas } from '@rb/rb-logic-view';
import { ViewAdapter } from '@rb/rb-logic-adapter';
import { Logic3DScene } from '@rb/rb-logic-3d';
import { useSettingsStore } from '@rb/rb-utils';
import { loadExample, listExamples, type ExampleId } from '../examples';
import {
  getFile,
  updateFile,
  createFile,
  listFiles,
  type LogicFile,
} from '../stores/filesStore';

type ViewMode = 'circuit' | 'schematic' | 'isometric' | '3d';

interface LogicPlaygroundProps {
  initialFileId?: string;
  initialExampleId?: ExampleId;
}

const LogicPlaygroundComponent: React.FC<LogicPlaygroundProps> = ({
  initialFileId,
  initialExampleId,
}) => {
  const { tickRate } = useSettingsStore();
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

  const autosaveIntervalRef = useRef<number | null>(null);

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
        <div className="flex-1 relative">
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
