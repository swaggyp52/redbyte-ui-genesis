import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import useLabStore from '../store/labStore';
import { evaluateCircuit, addNode, deleteNode, connectWire, moveNode, setNodeValue, cycleNodeGateType } from './engine';
import { validateCircuitAgainstTruthTable } from './validation';
import { CanvasRenderer } from './CanvasRenderer';
import { Toolbar } from './Toolbar';
const NODE_SIZE = 60;
const PORT_RADIUS = 6;
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
export const CircuitDesignerPro = () => {
    const doc = useLabStore((s) => s.doc);
    const updateCircuitDesigner = useLabStore((s) => s.updateCircuitDesigner);
    const emitEvent = useLabStore((s) => s.emitEvent);
    // Extract circuit from doc (safe cast since we initialize as v2)
    const circuit = doc.circuitDesigner;
    // UI state
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
    const [hoveredWireId, setHoveredWireId] = useState();
    const [drag, setDrag] = useState(null);
    const [wireConnection, setWireConnection] = useState(null);
    const [history, setHistory] = useState([circuit]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [validationResult, setValidationResult] = useState(null);
    const canvasContainerRef = useRef(null);
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
        if (updateCircuitDesigner && 'circuitDesigner' in doc) {
            updateCircuitDesigner(circuit);
        }
    }, [circuit, doc, updateCircuitDesigner]);
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
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
    const handleAddNode = (gateType) => {
        // Add at center of viewport
        const x = -panX / zoom + 200;
        const y = -panY / zoom + 200;
        const newCircuit = addNode(circuit, gateType, x, y);
        updateCircuitDesigner(newCircuit);
        emitEvent('circuit.addNode', { type: gateType, x, y });
    };
    const handleDeleteSelected = () => {
        let removed = circuit;
        const nodeIds = [];
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
    // Mouse event handlers for canvas
    const handleCanvasClick = (x, y) => {
        // Check if clicked on a node
        const clickedNode = circuit.nodes.find(n => x >= n.x && x <= n.x + NODE_SIZE && y >= n.y && y <= n.y + NODE_SIZE);
        if (clickedNode) {
            // Clicked on a node - check if it's close to a port
            const isOutputPort = x >= clickedNode.x + NODE_SIZE - PORT_RADIUS &&
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
            }
            else if (wireConnection && !isOutputPort) {
                // Complete wire connection to input
                // Find which input port (simplified: just port 1)
                const newCircuit = connectWire(circuit, wireConnection.fromNodeId, wireConnection.fromPort, clickedNode.id, 1);
                updateCircuitDesigner(newCircuit);
                emitEvent('circuit.connectWire', {
                    fromNodeId: wireConnection.fromNodeId,
                    toNodeId: clickedNode.id,
                });
                setWireConnection(null);
            }
            else {
                // Select node
                if (selectedNodeIds.has(clickedNode.id)) {
                    selectedNodeIds.delete(clickedNode.id);
                    setSelectedNodeIds(new Set(selectedNodeIds));
                }
                else {
                    setSelectedNodeIds(new Set([clickedNode.id]));
                }
            }
        }
        else {
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
        return (_jsxs("div", { draggable: true, onDragStart: (e) => {
                setDrag({
                    nodeId: node.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    offsetX: node.x,
                    offsetY: node.y,
                });
            }, onDragEnd: (e) => {
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
            }, className: `absolute w-[60px] h-[60px] rounded flex items-center justify-center text-xs font-bold cursor-move transition-all ${isSelected ? 'ring-2 ring-cyan-400' : ''} ${getNodeColor(node.type)}`, style: {
                left: `${node.x * zoom + panX}px`,
                top: `${node.y * zoom + panY}px`,
                transform: 'translate(-50%, -50%)',
            }, onClick: (e) => {
                e.stopPropagation();
                if (selectedNodeIds.has(node.id)) {
                    selectedNodeIds.delete(node.id);
                    setSelectedNodeIds(new Set(selectedNodeIds));
                }
                else {
                    setSelectedNodeIds(new Set([node.id]));
                }
            }, children: [_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("span", { children: node.type }), value !== undefined && _jsx("span", { className: value ? 'text-green-200' : 'text-red-200', children: "\u25CF" })] }), isInput && (_jsx("button", { className: "absolute -top-6 right-0 text-xs px-1 py-0 bg-green-800 hover:bg-green-700 rounded", onClick: (e) => {
                        e.stopPropagation();
                        const newValue = !(node.config?.value === true);
                        const newCircuit = setNodeValue(circuit, node.id, newValue);
                        updateCircuitDesigner(newCircuit);
                    }, children: node.config?.value ? '1' : '0' }))] }, node.id));
    });
    return (_jsxs("div", { className: "relative w-full h-full bg-slate-950 overflow-hidden flex flex-col", ref: canvasContainerRef, children: [_jsx(Toolbar, { onAddNode: handleAddNode, onDelete: handleDeleteSelected, onValidate: handleValidate, onUndo: handleUndo, onRedo: handleRedo, canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1, selectedNodeCount: selectedNodeIds.size }), _jsxs("div", { className: "relative flex-1 mt-16", children: [_jsx(CanvasRenderer, { circuit: circuit, evaluation: evaluation, panX: panX, panY: panY, zoom: zoom, selectedNodeIds: selectedNodeIds, hoveredWireId: hoveredWireId, onCanvasClick: handleCanvasClick }), nodeElements, wireConnection && (_jsx("svg", { className: "absolute inset-0 pointer-events-none", width: "100%", height: "100%", children: _jsx("line", { x1: (circuit.nodes.find(n => n.id === wireConnection.fromNodeId)?.x || 0) * zoom + panX + NODE_SIZE, y1: (circuit.nodes.find(n => n.id === wireConnection.fromNodeId)?.y || 0) * zoom + panY + NODE_SIZE / 2, x2: wireConnection.currentX * zoom + panX, y2: wireConnection.currentY * zoom + panY, stroke: "#3b82f6", strokeWidth: "2", strokeDasharray: "5,5" }) }))] }), _jsxs("div", { className: "bg-slate-900 border-t border-slate-700 px-4 py-2 text-xs text-slate-400 flex items-center gap-4", children: [_jsxs("span", { children: ["Nodes: ", circuit.nodes.length, " | Wires: ", circuit.wires.length, " | Zoom: ", (zoom * 100).toFixed(0), "%"] }), evaluation.error && _jsxs("span", { className: "text-red-400", children: ["\u26A0\uFE0F ", evaluation.error] }), validationResult && (_jsxs("span", { className: `font-semibold ${validationResult.passed ? 'text-emerald-400' : 'text-red-400'}`, children: [validationResult.passed ? '✓' : '✗', " Validation: ", validationResult.passedTests, "/", validationResult.totalTests, " tests passed"] }))] })] }));
};
function getNodeColor(type) {
    const colors = {
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
