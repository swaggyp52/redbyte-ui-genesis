import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
const GRID_SIZE = 20;
const WIRE_WIDTH = 2;
const WIRE_WIDTH_HOVER = 3;
const NODE_SIZE = 60;
export const CanvasRenderer = ({ circuit, evaluation, panX, panY, zoom, selectedNodeIds = new Set(), hoveredWireId, onCanvasClick, }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Clear canvas with dark background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        const gridStep = GRID_SIZE * zoom;
        for (let x = panX % gridStep; x < canvas.width; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = panY % gridStep; y < canvas.height; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        // Draw wires
        circuit.wires.forEach(wire => {
            const fromNode = circuit.nodes.find(n => n.id === wire.from.nodeId);
            const toNode = circuit.nodes.find(n => n.id === wire.to.nodeId);
            if (!fromNode || !toNode)
                return;
            const isHovered = wire.id === hoveredWireId;
            const isActive = evaluation.get(wire.from.nodeId) === true;
            // Calculate port positions
            // Output port: right side of node (center)
            const fromX = (fromNode.x + NODE_SIZE) * zoom + panX;
            const fromY = (fromNode.y + NODE_SIZE / 2) * zoom + panY;
            // Input port: left side of node (top-middle for now)
            const toX = toNode.x * zoom + panX;
            const toY = (toNode.y + NODE_SIZE / 2) * zoom + panY;
            // Draw wire with Bezier curve
            ctx.strokeStyle = isActive ? '#10b981' : '#64748b';
            ctx.lineWidth = (isHovered ? WIRE_WIDTH_HOVER : WIRE_WIDTH) * zoom;
            if (isActive) {
                ctx.shadowBlur = 8 * zoom;
                ctx.shadowColor = '#10b98180';
            }
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            // Cubic Bezier for smooth curve (Manhattan-style routing)
            const midX = (fromX + toX) / 2;
            ctx.bezierCurveTo(midX, fromY, midX, toY, toX, toY);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
    }, [circuit, evaluation, panX, panY, zoom, selectedNodeIds, hoveredWireId]);
    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - panX) / zoom;
        const y = (e.clientY - rect.top - panY) / zoom;
        onCanvasClick?.(x, y);
    };
    return (_jsx("canvas", { ref: canvasRef, width: typeof window !== 'undefined' ? window.innerWidth - 300 : 900, height: typeof window !== 'undefined' ? window.innerHeight - 100 : 600, onClick: handleCanvasClick, className: "absolute inset-0 bg-slate-950 cursor-crosshair" }));
};
