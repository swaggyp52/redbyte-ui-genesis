import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Render enhanced ports with hover states
 */
export const EnhancedPort = ({ port, isHovered, isCompatible, onClick, onMouseEnter, onMouseLeave }) => {
    // vNext spec: "Ports slightly bigger + higher contrast"
    const radius = 5; // Increased from typical 3px
    let fill = '#6b7280'; // default gray
    let stroke = '#9ca3af';
    let strokeWidth = 1.5;
    if (isHovered) {
        fill = '#3b82f6'; // blue
        stroke = '#60a5fa';
        strokeWidth = 2.5;
    }
    else if (isCompatible) {
        fill = '#22c55e'; // green (compatible)
        stroke = '#4ade80';
        strokeWidth = 2;
    }
    return (_jsx("circle", { cx: port.x, cy: port.y, r: radius, fill: fill, stroke: stroke, strokeWidth: strokeWidth, className: "cursor-pointer transition-all duration-150", onClick: (e) => {
            e.stopPropagation();
            onClick();
        }, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, style: { pointerEvents: 'all' } }));
};
/**
 * Render ghost wire following cursor
 */
export const GhostWire = ({ start, end }) => {
    // Manhattan routing for ghost wire
    const midX = (start.x + end.x) / 2;
    const path = `
    M ${start.x} ${start.y}
    L ${midX} ${start.y}
    L ${midX} ${end.y}
    L ${end.x} ${end.y}
  `;
    return (_jsxs("g", { className: "ghost-wire pointer-events-none", children: [_jsx("path", { d: path, stroke: "#3b82f6", strokeWidth: "2", strokeDasharray: "5,5", fill: "none", opacity: "0.6" }), _jsx("circle", { cx: end.x, cy: end.y, r: "4", fill: "#3b82f6", opacity: "0.4" })] }));
};
/**
 * Check if two ports are compatible for wiring
 */
export const arePortsCompatible = (startPort, endPort, startType, endType) => {
    // Can't connect port to itself
    if (startPort.nodeId === endPort.nodeId && startPort.portName === endPort.portName) {
        return false;
    }
    // Must connect output to input
    if (startType === 'output' && endType === 'input') {
        return true;
    }
    if (startType === 'input' && endType === 'output') {
        return true;
    }
    return false;
};
