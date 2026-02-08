import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLabStore } from '../lab-model/store';
// Trust Levels
// 0: Simulating (Blue) - Pure software
// 1: Connected (Yellow) - Bridge active, hardware talking
// 2: Verified (Green) - Replay hash matches signature (Cryptographic proof)
export const TruthHud = () => {
    // Check if active transport is bridge-based (router or direct)
    // We can check the type string returned by getStatus() or the class instance
    const isConnected = useLabStore(state => {
        const status = state.activeTransport.getStatus();
        return status.type === 'bridge' && status.connected;
    });
    // In a real implementation we would check the 'Verification' store.
    // For specific A+++ tasks, we will mock 'Verified' if the user is in a "Verified Replay" mode.
    const isVerified = false; // TODO: Connect to verification store
    let statusColor = 'bg-blue-600';
    let statusText = 'SIMULATING';
    let statusIcon = '⚡';
    if (isConnected) {
        statusColor = 'bg-yellow-600';
        statusText = 'HARDWARE LIVE';
        statusIcon = '🔌';
    }
    if (isVerified) {
        statusColor = 'bg-green-600';
        statusText = 'VERIFIED';
        statusIcon = '🔒';
    }
    return (_jsxs("div", { className: "absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 border border-gray-700 rounded-full shadow-xl backdrop-blur-sm z-50 pointer-events-none select-none", children: [_jsxs("div", { className: `flex items-center gap-2 px-2 py-0.5 rounded-full ${statusColor} text-white text-[10px] font-bold tracking-wider`, children: [_jsx("span", { children: statusIcon }), _jsx("span", { children: statusText })] }), _jsx("div", { className: "h-3 w-px bg-gray-700 mx-1" }), _jsxs("div", { className: "text-[10px] text-gray-400 font-mono flex gap-2", children: [_jsxs("span", { children: ["TICK: ", useLabStore.getState().simulation.tick || 0] }), isConnected && _jsx("span", { className: "text-yellow-500", children: "UART: 115200" })] })] }));
};
