import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useEffect } from 'react';
import { NodeView, WireView, renderGrid } from '@redbyte/rb-logic-view';
export const CircuitEditor2D = ({ nodes, connections, camera, width, height, onNodeMove, onNodeSelect, onWireSelect, onPortClick, onPortHover, onPortLeave, selectedNodeIds, selectedWireIds, wireStartPort, signals, readOnly = false, }) => {
    const gridSize = 20; // Standard grid size
    // Ghost wire refs (performance: avoid re-rendering entire tree on mouse move)
    const ghostLineRef = useRef(null);
    const svgRef = useRef(null);
    // Mouse tracking in WORLD coordinates
    useEffect(() => {
        if (!wireStartPort || !svgRef.current || !ghostLineRef.current)
            return;
        let animationFrameId;
        const handleMouseMove = (e) => {
            if (!svgRef.current || !ghostLineRef.current)
                return;
            // Convert screen -> world
            // WorldX = (ScreenX - PanX) / Zoom
            const rect = svgRef.current.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const worldX = (screenX - camera.x) / camera.zoom;
            const worldY = (screenY - camera.y) / camera.zoom;
            // Direct DOM update for performance
            ghostLineRef.current.setAttribute('x2', String(worldX));
            ghostLineRef.current.setAttribute('y2', String(worldY));
        };
        // Use rAF for throttling if needed, but direct attribute update is often fast enough for simple lines
        // For standard mouse events 60hz, direct update is usually fine. 
        // We'll stick to direct event handler for lowest input latency unless profiling shows issues.
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [wireStartPort, camera]); // Re-bind if camera changes (pan/zoom)
    // Helper for node movement
    const handleNodeMove = (nodeId, x, y) => {
        if (readOnly)
            return;
        onNodeMove(nodeId, x, y);
    };
    // Create a camera with identity transform for the children components
    // because we are applying the transform at the group level.
    // wait - NodeView/WireView expect camera prop to compute their own transforms?
    // Let's check NodeView.tsx: "transform={`translate(${screenX}, ${screenY}) ...`"
    // Yes, NodeView computes screen coords internally using camera prop.
    // IF we wrap in <g transform>, we must pass IDENTITY camera to children to avoid double transform.
    const identityCamera = useMemo(() => ({ x: 0, y: 0, zoom: 1 }), []);
    return (_jsx("div", { style: { width, height, overflow: 'hidden', background: '#0a0a0a', position: 'relative' }, children: _jsxs("svg", { ref: svgRef, width: width, height: height, style: { display: 'block' }, children: [renderGrid(camera, width, height, {
                    size: gridSize,
                    color: '#1a1a1a',
                    majorLineInterval: 5,
                    majorLineColor: '#2a2a2a',
                }), _jsxs("g", { transform: `translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`, children: [connections.map((conn) => {
                            const wireId = `${conn.from.nodeId}.${conn.from.portName}-${conn.to.nodeId}.${conn.to.portName}`;
                            return (_jsx(WireView, { connection: conn, nodes: nodes, camera: identityCamera, isSelected: selectedWireIds.has(wireId), onSelect: onWireSelect, signal: signals?.get(`${conn.from.nodeId}.${conn.from.portName}`) }, wireId));
                        }), wireStartPort && (() => {
                            const startNode = nodes.find(n => n.id === wireStartPort.nodeId);
                            if (!startNode)
                                return null;
                            // Calculate start position in WORLD space
                            // No zoom/pan applied here because we are inside the transformed group
                            const isOutput = wireStartPort.portName === 'Q' || wireStartPort.portName === 'out';
                            const offsetX = isOutput ? 24 : -24;
                            const startX = startNode.position.x + offsetX;
                            const startY = startNode.position.y;
                            return (_jsx("line", { ref: ghostLineRef, x1: startX, y1: startY, x2: startX, y2: startY, stroke: "#00ffff", strokeWidth: "2", strokeDasharray: "5,5", opacity: "0.6", pointerEvents: "none", vectorEffect: "non-scaling-stroke" // Keep line thickness constant despite zoom
                             }));
                        })(), nodes.map((node) => (_jsx(NodeView, { node: node, camera: identityCamera, isSelected: selectedNodeIds.has(node.id), onSelect: onNodeSelect, onMove: handleNodeMove, onPortClick: onPortClick ? (pid, pName) => onPortClick(pid, pName) : undefined, onPortHover: onPortHover ? (pName) => onPortHover(node.id, pName) : undefined, onPortLeave: onPortLeave, wireStartPort: wireStartPort ?? undefined }, node.id)))] })] }) }));
};
