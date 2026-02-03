import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const stateConfig = {
    disconnected: {
        color: 'text-gray-400',
        bgColor: 'bg-gray-600',
        label: 'Disconnected',
    },
    discovering: {
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500',
        label: 'Discovering...',
        pulse: true,
    },
    connecting: {
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500',
        label: 'Connecting...',
        pulse: true,
    },
    ready: {
        color: 'text-green-400',
        bgColor: 'bg-green-500',
        label: 'Ready',
    },
    error: {
        color: 'text-red-400',
        bgColor: 'bg-red-500',
        label: 'Error',
    },
};
export const ConnectionStatusBadge = ({ state, className = '', showLabel = true, }) => {
    const config = stateConfig[state];
    return (_jsxs("div", { className: `flex items-center gap-2 ${className}`, children: [_jsx("span", { className: `
          inline-block w-2.5 h-2.5 rounded-full
          ${config.bgColor}
          ${config.pulse ? 'animate-pulse' : ''}
        `, "aria-hidden": "true" }), showLabel && (_jsx("span", { className: `text-xs font-medium ${config.color}`, children: config.label }))] }));
};
export default ConnectionStatusBadge;
