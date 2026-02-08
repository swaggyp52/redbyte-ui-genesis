import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Visual representation of chip I/O boundary when viewing chip internals
 * Shows the "doorway" between external ports and internal circuit
 */
export const PortBoundary = ({ inputs, outputs, chipName, width, height, }) => {
    const inputSpacing = height / (inputs.length + 1);
    const outputSpacing = height / (outputs.length + 1);
    return (_jsxs("g", { className: "port-boundary", children: [_jsx("line", { x1: 0, y1: 0, x2: 0, y2: height, stroke: "#8b5cf6", strokeWidth: 3, strokeDasharray: "10,5", opacity: 0.6 }), inputs.map((input, i) => {
                const y = inputSpacing * (i + 1);
                return (_jsxs("g", { children: [_jsx("circle", { cx: 0, cy: y, r: 12, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }), _jsx("text", { x: -20, y: y, textAnchor: "end", dominantBaseline: "middle", fill: "#c4b5fd", fontSize: 14, fontWeight: "bold", children: input.name }), _jsx("path", { d: `M -15,${y} L 0,${y}`, stroke: "#c4b5fd", strokeWidth: 2, markerEnd: "url(#arrowhead-in)" })] }, input.id));
            }), _jsx("line", { x1: width, y1: 0, x2: width, y2: height, stroke: "#8b5cf6", strokeWidth: 3, strokeDasharray: "10,5", opacity: 0.6 }), outputs.map((output, i) => {
                const y = outputSpacing * (i + 1);
                return (_jsxs("g", { children: [_jsx("circle", { cx: width, cy: y, r: 12, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }), _jsx("text", { x: width + 20, y: y, textAnchor: "start", dominantBaseline: "middle", fill: "#c4b5fd", fontSize: 14, fontWeight: "bold", children: output.name }), _jsx("path", { d: `M ${width},${y} L ${width + 15},${y}`, stroke: "#c4b5fd", strokeWidth: 2, markerEnd: "url(#arrowhead-out)" })] }, output.id));
            }), _jsxs("text", { x: width / 2, y: -30, textAnchor: "middle", fill: "#8b5cf6", fontSize: 18, fontWeight: "bold", children: ["Inside: ", chipName] }), _jsxs("defs", { children: [_jsx("marker", { id: "arrowhead-in", markerWidth: "10", markerHeight: "10", refX: "5", refY: "5", orient: "auto", children: _jsx("polygon", { points: "0 0, 10 5, 0 10", fill: "#c4b5fd" }) }), _jsx("marker", { id: "arrowhead-out", markerWidth: "10", markerHeight: "10", refX: "5", refY: "5", orient: "auto", children: _jsx("polygon", { points: "0 0, 10 5, 0 10", fill: "#c4b5fd" }) })] })] }));
};
