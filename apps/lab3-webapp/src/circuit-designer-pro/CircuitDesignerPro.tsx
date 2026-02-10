import React, { useState, useEffect, useRef } from 'react';
import useLabStore from '../store/labStore';
import type { CircuitDesignerDoc, CircuitNode, LabDocV2 } from '../plugins/LabDoc';
import { evaluateCircuit, addNode, deleteNode, connectWire, deleteWire, moveNode, setNodeValue } from './engine';
import { CanvasRenderer } from './CanvasRenderer';
import { Toolbar } from './Toolbar';

const NODE_SIZE = 60;
const PORT_RADIUS = 6;

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

interface WireConnectionState {
  fromNodeId: string;
  fromPort: number;
  currentX: number;
  currentY: number;
}

/**
 * Circuit Designer Pro: Main component for the new Pro UI
 * Features:
 * - Canvas-based wire rendering (no SVG)
 * - DOM nodes for gates (draggable)
 * - Click ports to connect wires
 * - Live output values on nodes
 * - Undo/redo
 * - Validation against truth table
 */
export const CircuitDesignerPro: React.FC = () => {
  const doc = useLabStore((s) => s.doc) as LabDocV2;
  const setDoc = useLabStore((s) => s.setDoc);
  const emitEvent = useLabStore((s) => s.emitEvent);

  // Extract circuit from doc (safe cast since we initialize as v2)
  const circuit = doc.circuitDesigner;

  // UI state
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredWireId, setHoveredWireId] = useState<string>();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [wireConnection, setWireConnection] = useState<WireConnectionState | null>(null);
  const [history, setHistory] = useState<CircuitDesignerDoc[]>([circuit]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Evaluate circuit
  const evaluation = evaluateCircuit(circuit);

  // Push to history on circuit change
  useEffect(() => {
    // Only push if this is a new state (not from undo/redo)
    if (history[historyIndex] !== circuit) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(circuit);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [circuit]);

  // Update doc when circuit changes
  useEffect(() => {
    if (setDoc && 'circuitDesigner' in doc) {
      setDoc({
        ...doc,
        circuitDesigner: circuit,
      });
    }
  }, [circuit, doc, setDoc]);

  // Handlers
  const handleAddNode = (gateType: CircuitNode['type']) => {
    // Add at center of viewport
    const x = -panX / zoom + 200;
    const y = -panY / zoom + 200;
    const newCircuit = addNode(circuit, gateType, x, y);
    setDoc({ ...doc, circuitDesigner: newCircuit });
    emitEvent('circuit.addNode', { type: gateType, x, y });
  };

  const handleDeleteSelected = () => {
    let removed = circuit;
    selectedNodeIds.forEach(nodeId => {
      removed = deleteNode(removed, nodeId);
    });
    setDoc({ ...doc, circuitDesigner: removed });
    setSelectedNodeIds(new Set());
    emitEvent('circuit.deleteNode', { nodeIds: Array.from(selectedNodeIds) });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setDoc({ ...doc, circuitDesigner: history[newIndex] });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setDoc({ ...doc, circuitDesigner: history[newIndex] });
    }
  };

  const handleValidate = () => {
    // Placeholder for task 6
    console.log('Validate button clicked');
    emitEvent('circuit.validate', { nodeCount: circuit.nodes.length, wireCount: circuit.wires.length });
  };

  // Mouse event handlers for canvas
  const handleCanvasClick = (x: number, y: number) => {
    // Check if clicked on a node
    const clickedNode = circuit.nodes.find(
      n => x >= n.x && x <= n.x + NODE_SIZE && y >= n.y && y <= n.y + NODE_SIZE
    );

    if (clickedNode) {
      // Clicked on a node - check if it's close to a port
      const isOutputPort =
        x >= clickedNode.x + NODE_SIZE - PORT_RADIUS &&
        x <= clickedNode.x + NODE_SIZE + PORT_RADIUS &&
        y >= clickedNode.y + NODE_SIZE / 2 - PORT_RADIUS &&
        y <= clickedNode.y + NODE_SIZE / 2 + PORT_RADIUS;

      if (isOutputPort && !wireConnection) {
        // Start wire connection from output
        setWireConnection({
          fromNodeId: clickedNode.id,
          fromPort: 0,
          currentX: x,
          currentY: y,
        });
      } else if (wireConnection && !isOutputPort) {
        // Complete wire connection to input
        // Find which input port (simplified: just port 1)
        const newCircuit = connectWire(
          circuit,
          wireConnection.fromNodeId,
          wireConnection.fromPort,
          clickedNode.id,
          1
        );
        setDoc({ ...doc, circuitDesigner: newCircuit });
        emitEvent('circuit.connect', {
          from: wireConnection.fromNodeId,
          to: clickedNode.id,
        });
        setWireConnection(null);
      } else {
        // Select node
        if (selectedNodeIds.has(clickedNode.id)) {
          selectedNodeIds.delete(clickedNode.id);
          setSelectedNodeIds(new Set(selectedNodeIds));
        } else {
          setSelectedNodeIds(new Set([clickedNode.id]));
        }
      }
    } else {
      // Clicked on canvas - deselect all
      setSelectedNodeIds(new Set());
      if (wireConnection) {
        setWireConnection(null);
      }
    }
  };

  // Node DOM rendering
  const nodeElements = circuit.nodes.map(node => {
    const isSelected = selectedNodeIds.has(node.id);
    const isInput = node.type === 'INPUT';
    const value = evaluation.get(node.id);

    return (
      <div
        key={node.id}
        draggable
        onDragStart={(e) => {
          setDrag({
            nodeId: node.id,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: node.x,
            offsetY: node.y,
          });
        }}
        onDragEnd={(e) => {
          if (drag) {
            const deltaX = (e.clientX - drag.startX) / zoom;
            const deltaY = (e.clientY - drag.startY) / zoom;
            const newCircuit = moveNode(circuit, node.id, drag.offsetX + deltaX, drag.offsetY + deltaY);
            setDoc({ ...doc, circuitDesigner: newCircuit });
            setDrag(null);
          }
        }}
        className={`absolute w-[60px] h-[60px] rounded flex items-center justify-center text-xs font-bold cursor-move transition-all ${
          isSelected ? 'ring-2 ring-cyan-400' : ''
        } ${getNodeColor(node.type)}`}
        style={{
          left: `${node.x * zoom + panX}px`,
          top: `${node.y * zoom + panY}px`,
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (selectedNodeIds.has(node.id)) {
            selectedNodeIds.delete(node.id);
            setSelectedNodeIds(new Set(selectedNodeIds));
          } else {
            setSelectedNodeIds(new Set([node.id]));
          }
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <span>{node.type}</span>
          {value !== undefined && <span className={value ? 'text-green-200' : 'text-red-200'}>●</span>}
        </div>

        {/* Input toggle for INPUT nodes */}
        {isInput && (
          <button
            className="absolute -top-6 right-0 text-xs px-1 py-0 bg-green-800 hover:bg-green-700 rounded"
            onClick={(e) => {
              e.stopPropagation();
              const newValue = !(node.config?.value === true);
              const newCircuit = setNodeValue(circuit, node.id, newValue);
              setDoc({ ...doc, circuitDesigner: newCircuit });
            }}
          >
            {node.config?.value ? '1' : '0'}
          </button>
        )}
      </div>
    );
  });

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col" ref={canvasContainerRef}>
      {/* Toolbar */}
      <Toolbar
        onAddNode={handleAddNode}
        onDelete={handleDeleteSelected}
        onValidate={handleValidate}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        selectedNodeCount={selectedNodeIds.size}
      />

      {/* Canvas container */}
      <div className="relative flex-1 mt-16">
        {/* Canvas for wires */}
        <CanvasRenderer
          circuit={circuit}
          evaluation={evaluation}
          panX={panX}
          panY={panY}
          zoom={zoom}
          selectedNodeIds={selectedNodeIds}
          hoveredWireId={hoveredWireId}
          onCanvasClick={handleCanvasClick}
        />

        {/* DOM nodes for gates */}
        {nodeElements}

        {/* Wire preview during connection */}
        {wireConnection && (
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            <line
              x1={(circuit.nodes.find(n => n.id === wireConnection.fromNodeId)?.x || 0) * zoom + panX + NODE_SIZE}
              y1={(circuit.nodes.find(n => n.id === wireConnection.fromNodeId)?.y || 0) * zoom + panY + NODE_SIZE / 2}
              x2={wireConnection.currentX * zoom + panX}
              y2={wireConnection.currentY * zoom + panY}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 text-xs text-slate-400">
        Nodes: {circuit.nodes.length} | Wires: {circuit.wires.length} | Zoom: {(zoom * 100).toFixed(0)}%
        {evaluation.error && <span className="ml-4 text-red-400">⚠️ {evaluation.error}</span>}
      </div>
    </div>
  );
};

function getNodeColor(type: CircuitNode['type']): string {
  const colors: Record<CircuitNode['type'], string> = {
    INPUT: 'bg-green-900 text-green-100',
    AND: 'bg-teal-900 text-teal-100',
    OR: 'bg-cyan-900 text-cyan-100',
    NOT: 'bg-orange-900 text-orange-100',
    XOR: 'bg-purple-900 text-purple-100',
    OUTPUT: 'bg-red-900 text-red-100',
    CONST_0: 'bg-slate-700 text-slate-100',
    CONST_1: 'bg-slate-600 text-slate-100',
  };
  return colors[type] || 'bg-slate-700 text-slate-100';
}
