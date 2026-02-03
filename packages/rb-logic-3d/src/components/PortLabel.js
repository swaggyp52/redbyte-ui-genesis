import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Html } from '@react-three/drei';
export const PortLabel = ({ position, portName, signalValue, isOutput, }) => {
    const valueColor = signalValue === 1 ? 'text-green-400' : 'text-gray-500';
    const bgColor = signalValue === 1 ? 'bg-green-500/10' : 'bg-gray-900/80';
    return (_jsx(Html, { position: position, center: true, distanceFactor: 10, children: _jsxs("div", { className: `${bgColor} px-1.5 py-0.5 rounded text-[10px] ${valueColor} whitespace-nowrap border border-gray-700/50 backdrop-blur-sm pointer-events-none select-none font-mono`, children: [portName, ": ", signalValue] }) }));
};
