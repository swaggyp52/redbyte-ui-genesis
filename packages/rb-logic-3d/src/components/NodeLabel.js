import { jsx as _jsx } from "react/jsx-runtime";
import { Html } from '@react-three/drei';
export const NodeLabel = ({ position, type, nodeId }) => {
    // Position label above the node
    const labelPosition = [
        position[0],
        position[1] + 0.8,
        position[2],
    ];
    return (_jsx(Html, { position: labelPosition, center: true, distanceFactor: 8, children: _jsx("div", { className: "bg-gray-900/80 px-2 py-1 rounded text-xs text-white whitespace-nowrap border border-gray-700 backdrop-blur-sm pointer-events-none select-none", children: type }) }));
};
