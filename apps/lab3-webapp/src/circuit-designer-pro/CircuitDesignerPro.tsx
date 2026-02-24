import React, { useState, useEffect, useRef, useMemo } from 'react';
import useLabStore from '../store/labStore';
import type { CircuitDesignerDoc, CircuitNode, LabDocV2 } from '../plugins/LabDoc';
import { evaluateCircuit, addNode, deleteNode, connectWire, deleteWire, moveNode, setNodeValue, cycleNodeGateType } from './engine';
import { validateCircuitAgainstTruthTable } from './validation';
import { CanvasRenderer } from './CanvasRenderer';
import { Toolbar } from './Toolbar';
import { generateHdlFromCircuit, roundTripCheck, type HdlWarning, type RoundTripResult } from './circuitToVhdl';

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
  const updateCircuitDesigner = useLabStore((s) => s.updateCircuitDesigner);
  const emitEvent = useLabStore((s) => s.emitEvent);

  // Extract circuit from doc (safe cast since we initialize as v2)
  const circuit = doc.circuitDesigner;

  // Canvas view — in Zustand so it survives tab switches and window close/reopen
  const { panX, panY, zoom } = useLabStore((s) => s.canvasView);
  const setCanvasView = useLabStore((s) => s.setCanvasView);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredWireId, setHoveredWireId] = useState<string>();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [wireConnection, setWireConnection] = useState<WireConnectionState | null>(null);
  const [history, setHistory] = useState<CircuitDesignerDoc[]>([circuit]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [validationResult, setValidationResult] = useState<{ passed: boolean; passedTests: number; totalTests: number } | null>(null);
  const [showHdl, setShowHdl] = useState(false);
  const [rtResult, setRtResult] = useState<RoundTripResult | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Evaluate circuit
  const evaluation = evaluateCircuit(circuit);

  // Generate HDL from circuit (memoised — only recomputes when circuit changes)
  const hdl = useMemo(() => generateHdlFromCircuit(circuit), [circuit]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Cmd+Y for redo (or Ctrl+Shift+Z)
      else if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
      // Delete key for delete selected
      else if (e.key === 'Delete' && selectedNodeIds.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
      // Escape key to deselect
      else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedNodeIds(new Set());
      }
      // Tab to cycle gate type (only if single node selected)
      else if (e.key === 'Tab' && selectedNodeIds.size === 1) {
        e.preventDefault();
        const selectedNodeId = Array.from(selectedNodeIds)[0];
        const newCircuit = cycleNodeGateType(circuit, selectedNodeId);
        updateCircuitDesigner(newCircuit);
        emitEvent('circuit.cycleGateType', {
          nodeId: selectedNodeId,
          oldType: circuit.nodes.find(n => n.id === selectedNodeId)?.type,
          newType: newCircuit.nodes.find(n => n.id === selectedNodeId)?.type,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, selectedNodeIds]);

  // Handlers
  const handleAddNode = (gateType: CircuitNode['type']) => {
    // Add at center of viewport
    const x = -panX / zoom + 200;
    const y = -panY / zoom + 200;
    const newCircuit = addNode(circuit, gateType, x, y);
    updateCircuitDesigner(newCircuit);
    emitEvent('circuit.addNode', { type: gateType, x, y });
  };

  const handleDeleteSelected = () => {
    let removed = circuit;
    const nodeIds: string[] = [];
    selectedNodeIds.forEach(nodeId => {
      removed = deleteNode(removed, nodeId);
      nodeIds.push(nodeId);
    });
    updateCircuitDesigner(removed);
    setSelectedNodeIds(new Set());
    emitEvent('circuit.deleteNode', { nodeIds });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      updateCircuitDesigner(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      updateCircuitDesigner(history[newIndex]);
    }
  };

  const handleValidate = () => {
    const result = validateCircuitAgainstTruthTable(circuit, doc);
    emitEvent('circuit.validate', {
      passed: result.passed,
      passedTests: result.passedTests,
      failedTests: result.failedTests,
      totalTests: result.totalTests,
    });
    console.log('Validation result:', result);
    setValidationResult({
      passed: result.passed,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
    });
    // Clear validation result after 5 seconds
    setTimeout(() => setValidationResult(null), 5000);
  };

  // Wheel zoom — zoom toward cursor position
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(3, Math.max(0.25, zoom * factor));
    // Adjust pan so the point under the cursor stays fixed
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const newPanX = cursorX - (cursorX - panX) * (newZoom / zoom);
      const newPanY = cursorY - (cursorY - panY) * (newZoom / zoom);
      setCanvasView(newPanX, newPanY, newZoom);
    } else {
      setCanvasView(panX, panY, newZoom);
    }
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
        updateCircuitDesigner(newCircuit);
        emitEvent('circuit.connectWire', {
          fromNodeId: wireConnection.fromNodeId,
          toNodeId: clickedNode.id,
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
            updateCircuitDesigner(newCircuit);
            emitEvent('circuit.moveNode', {
              nodeId: node.id,
              x: drag.offsetX + deltaX,
              y: drag.offsetY + deltaY,
            });
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
              updateCircuitDesigner(newCircuit);
            }}
          >
            {node.config?.value ? '1' : '0'}
          </button>
        )}
      </div>
    );
  });

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col" ref={canvasContainerRef} onWheel={handleWheel}>
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
      <div className="shrink-0 bg-slate-900 border-t border-slate-700 px-4 py-2 text-xs text-slate-400 flex items-center gap-4">
        <span>Nodes: {circuit.nodes.length} | Wires: {circuit.wires.length} | Zoom: {(zoom * 100).toFixed(0)}%</span>
        {evaluation.error && <span className="text-red-400">⚠️ {evaluation.error}</span>}
        {validationResult && (
          <span className={`font-semibold ${validationResult.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {validationResult.passed ? '✓' : '✗'} Validation: {validationResult.passedTests}/{validationResult.totalTests} tests passed
          </span>
        )}
      </div>

      {/* Generated HDL Panel */}
      <div className="shrink-0 bg-slate-900 border-t border-slate-700/50">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => setShowHdl(v => !v)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="font-tech font-semibold text-slate-300">Generated HDL</span>
            {hdl.warnings.length > 0 && (
              <span className="text-amber-400 text-xs">{hdl.warnings.length} warning{hdl.warnings.length !== 1 ? 's' : ''}</span>
            )}
            <span className="text-slate-500">{showHdl ? '▲' : '▼'}</span>
          </button>
          <button
            onClick={() => setRtResult(roundTripCheck(circuit, doc))}
            className="text-xs px-3 py-1 rounded border border-slate-600 hover:border-cyan-500/70 text-slate-400 hover:text-slate-200 transition-colors"
            title="Verify: circuit ↔ HDL ↔ truth table"
          >
            Round-Trip Check
          </button>
        </div>

        {showHdl && (
          <div className="px-4 pb-4">
            <div className="grid lg:grid-cols-2 gap-3">
              {/* VHDL */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-cyan-400 text-xs font-tech font-semibold">VHDL</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(hdl.vhdl)}
                    disabled={!hdl.vhdl}
                    className="text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-slate-950/80 rounded p-3 text-xs font-mono overflow-auto max-h-48 text-slate-200 whitespace-pre-wrap border border-slate-800">
                  {hdl.vhdl || '-- Add INPUT and OUTPUT nodes to generate VHDL'}
                </pre>
              </div>
              {/* Verilog */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-green-400 text-xs font-tech font-semibold">Verilog</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(hdl.verilog)}
                    disabled={!hdl.verilog}
                    className="text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-slate-950/80 rounded p-3 text-xs font-mono overflow-auto max-h-48 text-slate-200 whitespace-pre-wrap border border-slate-800">
                  {hdl.verilog || '// Add INPUT and OUTPUT nodes to generate Verilog'}
                </pre>
              </div>
            </div>
            {/* Warnings */}
            {hdl.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {hdl.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                    <span className="shrink-0">⚠</span>
                    <span>{hdlWarningMessage(w)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Round-Trip Check result */}
        {rtResult && (
          <div className={`mx-4 mb-3 p-3 rounded border ${rtResult.pass ? 'border-green-600/60 bg-green-950/40' : 'border-red-600/60 bg-red-950/40'}`}>
            <div className={`font-semibold text-sm mb-2 ${rtResult.pass ? 'text-green-400' : 'text-red-400'}`}>
              {rtResult.pass ? '✓ PASS — Circuit verified end-to-end' : '✗ FAIL — Verification incomplete'}
            </div>
            <div className="space-y-1">
              {rtResult.steps.map((s, i) => (
                <div key={i} className="text-xs flex items-start gap-2">
                  <span className={`shrink-0 ${s.pass ? 'text-green-400' : 'text-red-400'}`}>{s.pass ? '✓' : '✗'}</span>
                  <span className="text-slate-300">{s.label}</span>
                  {s.detail && <span className="text-slate-500 truncate">— {s.detail}</span>}
                </div>
              ))}
            </div>
            {rtResult.firstMismatch && (
              <div className="mt-2 text-xs text-amber-400">First mismatch: {rtResult.firstMismatch}</div>
            )}
            <button
              onClick={() => setRtResult(null)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
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
    NAND: 'bg-teal-800 text-teal-100',
    NOR: 'bg-cyan-800 text-cyan-100',
    XNOR: 'bg-purple-800 text-purple-100',
    BUF: 'bg-slate-600 text-slate-100',
    OUTPUT: 'bg-red-900 text-red-100',
    CONST_0: 'bg-slate-700 text-slate-100',
    CONST_1: 'bg-slate-600 text-slate-100',
  };
  return colors[type] || 'bg-slate-700 text-slate-100';
}

function hdlWarningMessage(w: HdlWarning): string {
  switch (w.kind) {
    case 'empty': return w.description;
    case 'cycle': return w.description;
    case 'undriven': return `${w.signal} is undriven — connect a gate to this output`;
    case 'multi-driver': return `Multiple gates drive the same wire on ${w.signal}`;
    default: return 'Unknown HDL warning';
  }
}
