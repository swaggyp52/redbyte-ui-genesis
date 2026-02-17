
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import { CircuitEditor2D } from './CircuitEditor2D';
import { Minimap } from './Minimap';
import {
  useViewportControls,
  useViewportWheel,
  useViewportPan,
  useViewportKeyboard,
} from '../utils/viewportControls';
import type { Node, Connection } from '@redbyte/rb-logic-core';
import { registerCompositeNode } from '@redbyte/rb-logic-core';
import { toast } from '@redbyte/rb-primitives';
import type { CircuitNode, CircuitConnection } from '@redbyte/rb-utils/labProjectSchema';

export type InteractionMode = 'idle' | 'panning' | 'dragging-node' | 'wiring';

export const DesignMode: React.FC<{ windowId: string }> = () => {
  const { project, dispatch } = useLabEngineStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [palette, setPalette] = useState<string[]>(['AND', 'OR', 'NOT', 'XOR', 'FullAdder', 'SWITCH', 'LED']);
  const [selectedType, setSelectedType] = useState<string>('AND');

  // Interaction State Machine
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [wireStartPort, setWireStartPort] = useState<{ nodeId: string; portName: string } | null>(null);

  // Interaction conflict prevention
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Selection State
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedWireIds, setSelectedWireIds] = useState<Set<string>>(new Set());

  // Initialize Viewport Controls
  const viewport = useViewportControls({
    containerWidth: size.width,
    containerHeight: size.height,
    minZoom: 0.1,
    maxZoom: 4,
    defaultZoom: 1,
  });

  // Calculate content bounds for Fit functionality
  const getContentBounds = useCallback(() => {
    if (!project || project.circuit.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    // Bounds from Nodes
    project.circuit.nodes.forEach((node) => {
      minX = Math.min(minX, node.x - 50);
      maxX = Math.max(maxX, node.x + 50);
      minY = Math.min(minY, node.y - 50);
      maxY = Math.max(maxY, node.y + 50);
    });

    // Bounds from Wires (using endpoint node positions)
    // Theoretically nodes cover it, but if nodes are deleted but wires remain? (Shouldn't happen in valid state)
    // Keep it simple: nodes define the bounds. Margin handles the rest.

    return { minX, minY, maxX, maxY };
  }, [project]);

  // Viewport hooks
  useViewportWheel(containerRef, viewport);
  useViewportPan(containerRef, viewport);
  useViewportKeyboard(viewport, getContentBounds);

  // Track resizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard listeners (Space + Delete + Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for panning
      if (e.code === 'Space' && !e.repeat) {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          setIsSpacePressed(true);
          setInteractionMode('panning');
        }
      }

      // Escape to cancel wiring or clear selection
      if (e.key === 'Escape') {
        if (interactionMode === 'wiring') {
          setWireStartPort(null);
          setInteractionMode('idle');
        } else {
          setSelectedNodeIds(new Set());
          setSelectedWireIds(new Set());
        }
      }

      // Delete for removing selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          if (selectedNodeIds.size > 0) {
            selectedNodeIds.forEach(id => {
              dispatch({ v: 1, t: 'circuit/deleteNode', p: { nodeId: id } });
            });
            setSelectedNodeIds(new Set());
          }
          if (selectedWireIds.size > 0) {
            selectedWireIds.forEach(id => {
              dispatch({ v: 1, t: 'circuit/deleteConnection', p: { connectionId: id } });
            });
            setSelectedWireIds(new Set());
          }
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setInteractionMode(prev => prev === 'panning' ? 'idle' : prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeIds, selectedWireIds, interactionMode, dispatch]);


  // --- Actions ---
  const handleAddNode = () => {
    const nodeId = `node-${Date.now()}`;
    const center = viewport.toWorldCoords(size.width / 2, size.height / 2);
    const x = center.x + (Math.random() - 0.5) * 40;
    const y = center.y + (Math.random() - 0.5) * 40;

    dispatch({
      v: 1,
      t: 'circuit/addNode',
      p: {
        nodeId,
        componentType: selectedType,
        x,
        y,
      },
    });
  };

  // --- Data Mapping ---
  const logicalNodes: Node[] = useMemo(() => {
    if (!project) return [];
    return project.circuit.nodes.map((n: CircuitNode) => ({
      id: n.id,
      type: n.type,
      position: { x: n.x, y: n.y },
      rotation: n.rotation || 0,
      config: n.params || {},
      state: n.state,
    }));
  }, [project?.circuit.nodes]);

  const logicalConnections: Connection[] = useMemo(() => {
    if (!project) return [];
    return project.circuit.connections.map((c: CircuitConnection) => ({
      id: c.id,
      from: { nodeId: c.fromNodeId, portName: c.fromPin },
      to: { nodeId: c.toNodeId, portName: c.toPin },
    }));
  }, [project?.circuit.connections]);

  // --- Callbacks ---
  const handleNodeMove = (nodeId: string, x: number, y: number) => {
    dispatch({
      v: 1,
      t: 'circuit/moveNode',
      p: { nodeId, x, y },
    });
  };

  const handleNodeSelect = (nodeId: string, addToSelection: boolean) => {
    setSelectedNodeIds(prev => {
      const next = new Set(addToSelection ? prev : []);
      if (addToSelection && prev.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleWireSelect = (wireId: string, addToSelection: boolean) => {
    setSelectedWireIds(prev => {
      const next = new Set(addToSelection ? prev : []);
      if (addToSelection && prev.has(wireId)) {
        next.delete(wireId);
      } else {
        next.add(wireId);
      }
      return next;
    });
  };

  const handlePortClick = (nodeId: string, portName: string) => {
    // ... existing implementation
  };

  const handleCreateMacro = () => {
    if (selectedNodeIds.size === 0) return;

    const name = window.prompt('Enter Macro Name:', 'FULL_ADDER');
    if (!name) return;

    // Filter nodes and connections for the subcircuit
    const subNodes = project.circuit.nodes.filter(n => selectedNodeIds.has(n.id));
    const subConns = project.circuit.connections.filter(c =>
      selectedNodeIds.has(c.fromNodeId) && selectedNodeIds.has(c.toNodeId)
    );

    // Draft the CompositeNodeDef
    // Strategy: Any Switch node is an Input, any Lamp node is an Output
    const inputMapping: Record<string, string> = {};
    const outputMapping: Record<string, string> = {};

    subNodes.forEach(n => {
      if (n.type === 'Switch' || n.type === 'SWITCH' || n.type === 'INPUT') {
        inputMapping[n.id.toUpperCase()] = `${n.id}.isOn`;
      }
      if (n.type === 'Lamp' || n.type === 'LAMP' || n.type === 'LED' || n.type === 'OUTPUT') {
        outputMapping[n.id.toUpperCase()] = `${n.id}.out`;
      }
    });

    const def = {
      name,
      subcircuit: { nodes: subNodes as any, connections: subConns as any },
      inputMapping,
      outputMapping
    } as any;

    try {
      registerCompositeNode(def);
      setPalette(prev => [...new Set([...prev, name])]);
      toast.success({ message: `Macro '${name}' created and added to palette.` });
    } catch (e) {
      toast.error({ message: "Failed to create macro." });
    }
  };

  if (!project) return (
    <div className="flex items-center justify-center h-full bg-gray-950 text-slate-500">
      Initializing Logic Engine...
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      {/* Toolbar / Palette */}
      <div className="h-10 border-b border-gray-800 bg-gray-900 flex items-center px-4 gap-4 shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-2">Palette</span>
          {palette.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2 py-1 text-[10px] rounded border ${selectedType === type
                ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors'
                }`}
            >
              {type}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-700 mx-2" />
          <button
            onClick={handleAddNode}
            className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-1 shadow-sm"
          >
            <span>+ Add</span>
            <span className="opacity-75">{selectedType}</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className={`text-[10px] ${interactionMode === 'wiring' ? 'text-cyan-400 font-bold' : 'text-gray-500'}`}>
            {interactionMode === 'wiring' ? 'Select Destination Port' : 'Ready'}
          </div>
          <button
            onClick={handleCreateMacro}
            disabled={selectedNodeIds.size === 0}
            className={`px-3 py-1 text-[10px] font-bold rounded bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 transition-all ${selectedNodeIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📦 Create Macro
          </button>
          <div className="text-[10px] text-gray-500">Space+Drag to Pan</div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        style={{ cursor: isSpacePressed ? 'grab' : interactionMode === 'wiring' ? 'crosshair' : 'default' }}
      >
        {/* Minimap UI (Top Right) */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end pointer-events-none">
          {/* HUD Tools */}
          <div className="bg-gray-800/90 backdrop-blur border border-gray-700 rounded-lg p-1.5 shadow-lg pointer-events-auto flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-mono text-cyan-400 min-w-[2.5rem] text-center">
              {Math.round(viewport.state.zoom * 100)}%
            </span>
            <div className="w-px h-3 bg-gray-600"></div>
            <button
              className="p-1 hover:bg-gray-700 rounded text-gray-300 transition-colors"
              title="Fit to Content (F)"
              onClick={() => viewport.fitToContent(getContentBounds())}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </button>
            <button
              className="p-1 hover:bg-gray-700 rounded text-gray-300 transition-colors"
              title="Reset View (Shift+F)"
              onClick={() => viewport.reset()}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </button>
          </div>

          {/* Minimap Box */}
          <div className="pointer-events-auto">
            <Minimap
              nodes={logicalNodes}
              viewport={viewport}
              containerWidth={size.width}
              containerHeight={size.height}
            />
          </div>
        </div>

        {/* Editor component with pointer event gating */}
        <div style={{ pointerEvents: isSpacePressed ? 'none' : 'auto' }} className="h-full w-full">
          <CircuitEditor2D
            width={size.width}
            height={size.height}
            camera={viewport.state}
            nodes={logicalNodes}
            connections={logicalConnections}
            onNodeMove={handleNodeMove}
            onNodeSelect={handleNodeSelect}
            onWireSelect={handleWireSelect}
            onPortClick={handlePortClick}
            selectedNodeIds={selectedNodeIds}
            selectedWireIds={selectedWireIds}
            wireStartPort={wireStartPort}
          />
        </div>

        {/* Wiring Status Pill - "Signature Interaction" */}
        {wireStartPort && (
          <div 
            className="absolute z-50 rounded-full font-mono font-bold uppercase tracking-wide pointer-events-none"
            style={{
              top: 'calc(80px * var(--rb-ui-scale, 1))',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: 'calc(8px * var(--rb-ui-scale, 1)) calc(16px * var(--rb-ui-scale, 1))',
              fontSize: 'calc(11px * var(--rb-ui-scale, 1))',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1.5px solid rgba(6, 182, 212, 0.5)',
              color: '#06B6D4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 20px rgba(6, 182, 212, 0.2)',
              letterSpacing: '0.05em'
            }}
          >
            WIRING — click target • Esc cancel
          </div>
        )}

        {/* Empty State Overlay */}
        {logicalNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-gray-600 text-sm font-medium">
              Canvas Empty
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
