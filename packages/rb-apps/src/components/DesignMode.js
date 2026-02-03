import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import { CircuitEditor2D } from './CircuitEditor2D';
import { Minimap } from './Minimap';
import { useViewportControls, useViewportWheel, useViewportPan, useViewportKeyboard, } from '../utils/viewportControls';
import { registerCompositeNode } from '@redbyte/rb-logic-core';
import { toast } from '@redbyte/rb-primitives';
export const DesignMode = () => {
    const { project, dispatch } = useLabEngineStore();
    const containerRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [palette, setPalette] = useState(['AND', 'OR', 'NOT', 'XOR', 'FullAdder', 'SWITCH', 'LED']);
    const [selectedType, setSelectedType] = useState('AND');
    // Interaction State Machine
    const [interactionMode, setInteractionMode] = useState('idle');
    const [wireStartPort, setWireStartPort] = useState(null);
    // Interaction conflict prevention
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    // Selection State
    const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
    const [selectedWireIds, setSelectedWireIds] = useState(new Set());
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
        if (!containerRef.current)
            return;
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
        const handleKeyDown = (e) => {
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
                }
                else {
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
        const handleKeyUp = (e) => {
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
    const logicalNodes = useMemo(() => {
        if (!project)
            return [];
        return project.circuit.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: { x: n.x, y: n.y },
            rotation: n.rotation || 0,
            config: n.params || {},
            state: n.state,
        }));
    }, [project?.circuit.nodes]);
    const logicalConnections = useMemo(() => {
        if (!project)
            return [];
        return project.circuit.connections.map((c) => ({
            id: c.id,
            from: { nodeId: c.fromNodeId, portName: c.fromPin },
            to: { nodeId: c.toNodeId, portName: c.toPin },
        }));
    }, [project?.circuit.connections]);
    // --- Callbacks ---
    const handleNodeMove = (nodeId, x, y) => {
        dispatch({
            v: 1,
            t: 'circuit/moveNode',
            p: { nodeId, x, y },
        });
    };
    const handleNodeSelect = (nodeId, addToSelection) => {
        setSelectedNodeIds(prev => {
            const next = new Set(addToSelection ? prev : []);
            if (addToSelection && prev.has(nodeId)) {
                next.delete(nodeId);
            }
            else {
                next.add(nodeId);
            }
            return next;
        });
    };
    const handleWireSelect = (wireId, addToSelection) => {
        setSelectedWireIds(prev => {
            const next = new Set(addToSelection ? prev : []);
            if (addToSelection && prev.has(wireId)) {
                next.delete(wireId);
            }
            else {
                next.add(wireId);
            }
            return next;
        });
    };
    const handlePortClick = (nodeId, portName) => {
        // ... existing implementation
    };
    const handleCreateMacro = () => {
        if (selectedNodeIds.size === 0)
            return;
        const name = window.prompt('Enter Macro Name:', 'FULL_ADDER');
        if (!name)
            return;
        // Filter nodes and connections for the subcircuit
        const subNodes = project.circuit.nodes.filter(n => selectedNodeIds.has(n.id));
        const subConns = project.circuit.connections.filter(c => selectedNodeIds.has(c.fromNodeId) && selectedNodeIds.has(c.toNodeId));
        // Draft the CompositeNodeDef
        // Strategy: Any Switch node is an Input, any Lamp node is an Output
        const inputMapping = {};
        const outputMapping = {};
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
            subcircuit: { nodes: subNodes, connections: subConns },
            inputMapping,
            outputMapping
        };
        try {
            registerCompositeNode(def);
            setPalette(prev => [...new Set([...prev, name])]);
            toast.success({ message: `Macro '${name}' created and added to palette.` });
        }
        catch (e) {
            toast.error({ message: "Failed to create macro." });
        }
    };
    if (!project)
        return (_jsx("div", { className: "flex items-center justify-center h-full bg-gray-950 text-slate-500", children: "Initializing Logic Engine..." }));
    return (_jsxs("div", { className: "flex flex-col h-full bg-gray-950 overflow-hidden", children: [_jsxs("div", { className: "h-10 border-b border-gray-800 bg-gray-900 flex items-center px-4 gap-4 shrink-0 justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs font-bold text-gray-500 uppercase tracking-widest mr-2", children: "Palette" }), palette.map((type) => (_jsx("button", { onClick: () => setSelectedType(type), className: `px-2 py-1 text-[10px] rounded border ${selectedType === type
                                    ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors'}`, children: type }, type))), _jsx("div", { className: "w-px h-4 bg-gray-700 mx-2" }), _jsxs("button", { onClick: handleAddNode, className: "px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-1 shadow-sm", children: [_jsx("span", { children: "+ Add" }), _jsx("span", { className: "opacity-75", children: selectedType })] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: `text-[10px] ${interactionMode === 'wiring' ? 'text-cyan-400 font-bold' : 'text-gray-500'}`, children: interactionMode === 'wiring' ? 'Select Destination Port' : 'Ready' }), _jsx("button", { onClick: handleCreateMacro, disabled: selectedNodeIds.size === 0, className: `px-3 py-1 text-[10px] font-bold rounded bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 transition-all ${selectedNodeIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`, children: "\uD83D\uDCE6 Create Macro" }), _jsx("div", { className: "text-[10px] text-gray-500", children: "Space+Drag to Pan" })] })] }), _jsxs("div", { ref: containerRef, className: "flex-1 min-h-0 relative overflow-hidden", style: { cursor: isSpacePressed ? 'grab' : interactionMode === 'wiring' ? 'crosshair' : 'default' }, children: [_jsxs("div", { className: "absolute top-4 right-4 z-10 flex flex-col gap-2 items-end pointer-events-none", children: [_jsxs("div", { className: "bg-gray-800/90 backdrop-blur border border-gray-700 rounded-lg p-1.5 shadow-lg pointer-events-auto flex items-center gap-1.5 mb-2", children: [_jsxs("span", { className: "text-[10px] font-mono text-cyan-400 min-w-[2.5rem] text-center", children: [Math.round(viewport.state.zoom * 100), "%"] }), _jsx("div", { className: "w-px h-3 bg-gray-600" }), _jsx("button", { className: "p-1 hover:bg-gray-700 rounded text-gray-300 transition-colors", title: "Fit to Content (F)", onClick: () => viewport.fitToContent(getContentBounds()), children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" }) }) }), _jsx("button", { className: "p-1 hover:bg-gray-700 rounded text-gray-300 transition-colors", title: "Reset View (Shift+F)", onClick: () => viewport.reset(), children: _jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M12 8v8M8 12h8" })] }) })] }), _jsx("div", { className: "pointer-events-auto", children: _jsx(Minimap, { nodes: logicalNodes, viewport: viewport, containerWidth: size.width, containerHeight: size.height }) })] }), _jsx("div", { style: { pointerEvents: isSpacePressed ? 'none' : 'auto' }, className: "h-full w-full", children: _jsx(CircuitEditor2D, { width: size.width, height: size.height, camera: viewport.state, nodes: logicalNodes, connections: logicalConnections, onNodeMove: handleNodeMove, onNodeSelect: handleNodeSelect, onWireSelect: handleWireSelect, onPortClick: handlePortClick, selectedNodeIds: selectedNodeIds, selectedWireIds: selectedWireIds, wireStartPort: wireStartPort }) }), logicalNodes.length === 0 && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none", children: _jsx("div", { className: "text-gray-600 text-sm font-medium", children: "Canvas Empty" }) }))] })] }));
};
