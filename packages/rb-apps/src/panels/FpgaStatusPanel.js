import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';
import { FPGA_PRESET_DEFS } from '@redbyte/rb-logic-3d/presets';
export const FpgaStatusPanel = () => {
    const isRunning = useLabStore(state => state.simulation.isRunning);
    const playbackMode = useLabStore(state => state.simulation.playbackMode);
    const graph = useLabStore(state => state.graph);
    const fpgaNode = graph.nodes.find(n => n.type === 'fpga-basys3');
    const partState = useLabStore(state => fpgaNode ? state.simulation.partStates[fpgaNode.id] : undefined);
    // We need to access the store getters directly or add a selector?
    // Since getTransportStatus is a function, we can't select it easily for reactivity if it's not state.
    // The store needs a 'transportStatus' field if we want reactive updates.
    // For now, let's just force a re-render or assume it doesn't change often.
    // Or we can use a "tick" effect to poll it?
    // Better: Add `transportType` to `LabStoreState` properly?
    // Plan B: Just call `useLabStore.getState().getTransportStatus()` on mount/interval.
    const [activeTransportStatus, setTransportStatus] = useState(useLabStore.getState().getTransportStatus());
    useEffect(() => {
        const interval = setInterval(() => {
            const status = useLabStore.getState().getTransportStatus();
            setTransportStatus(prev => {
                if (prev.type !== status.type || prev.connected !== status.connected)
                    return status;
                return prev;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    const [selectedPreset, setSelectedPreset] = useState(FPGA_PRESET_DEFS[0].id);
    const [target, setTarget] = useState('arduino-uno');
    const [port, setPort] = useState('COM6');
    // Sync selected preset with active if available
    const activePresetId = partState?.preset;
    const activePresetName = activePresetId ? FPGA_PRESET_DEFS.find((d) => d.id === activePresetId)?.name : 'Passthrough (Default)';
    const handleLoad = () => {
        if (fpgaNode && selectedPreset) {
            useLabStore.getState().loadFpgaPreset(fpgaNode.id, selectedPreset);
        }
    };
    // Simple auto-update for visual flair
    const [blink, setBlink] = useState(false);
    useEffect(() => {
        if (!isRunning)
            return;
        const interval = setInterval(() => setBlink(b => !b), 500);
        return () => clearInterval(interval);
    }, [isRunning]);
    if (!fpgaNode)
        return null;
    return (_jsxs("div", { className: "absolute top-16 right-4 w-64 bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 text-xs shadow-xl select-none", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-gray-700 pb-2 mb-2", children: [_jsx("span", { className: "font-bold text-gray-300", children: "Basys3 FPGA Status" }), isRunning && (_jsx("div", { className: `w-2 h-2 rounded-full ${blink ? 'bg-green-500' : 'bg-green-800'}` }))] }), _jsxs("div", { className: "space-y-1 text-gray-400", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Clock:" }), _jsx("span", { className: "font-mono text-gray-200", children: "100 MHz (Sim)" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Model:" }), _jsx("span", { className: "font-mono text-gray-200", children: "XC7A35T-1CPG236C" })] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "State:" }), _jsx("span", { className: `font-mono ${playbackMode === 'replay' ? 'text-amber-500' : isRunning ? 'text-green-500' : 'text-gray-500'}`, children: playbackMode === 'replay' ? 'REPLAY' : isRunning ? 'RUNNING' : 'IDLE' })] }), _jsxs("div", { className: "space-y-2 border-t border-gray-700 pt-2 mt-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-500 uppercase text-[9px] font-bold", children: "Transport Mode" }), _jsxs("div", { className: "flex bg-black p-0.5 rounded border border-gray-700", children: [_jsx("button", { className: `px-2 py-0.5 rounded text-[10px] ${activeTransportStatus.type === 'sim' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`, onClick: () => useLabStore.getState().setTransport('sim'), children: "SIM" }), _jsx("button", { className: `px-2 py-0.5 rounded text-[10px] ${activeTransportStatus.type === 'bridge' ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:text-gray-300'}`, onClick: () => useLabStore.getState().setTransport('bridge'), children: "HARDWARE" })] })] }), activeTransportStatus.type === 'bridge' && (_jsxs("div", { className: "flex flex-col gap-1 bg-black/50 p-2 rounded border border-gray-800", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex justify-between items-center text-[10px]", children: [_jsx("span", { className: "text-gray-500", children: "Target:" }), _jsxs("select", { className: "bg-black border border-gray-700 rounded px-1 text-gray-300 outline-none h-5", value: target, onChange: (e) => setTarget(e.target.value), disabled: activeTransportStatus.connected, title: "Select Hardware Target", children: [_jsx("option", { value: "basys3", children: "Basys3 (Mock)" }), _jsx("option", { value: "arduino-uno", children: "Arduino UNO" })] })] }), target === 'arduino-uno' && (_jsxs("div", { className: "flex justify-between items-center text-[10px]", children: [_jsx("span", { className: "text-gray-500", children: "Port:" }), _jsx("input", { type: "text", className: "bg-black border border-gray-700 rounded px-1 text-gray-300 outline-none h-5 w-20 text-right", value: port, onChange: (e) => setPort(e.target.value), disabled: activeTransportStatus.connected, title: "Serial Port (e.g. COM6)" })] }))] }), _jsxs("div", { className: "flex justify-between items-center mt-1 border-t border-gray-800 pt-1", children: [_jsx("span", { className: "text-gray-400", children: "Status:" }), _jsx("span", { className: `font-mono ${activeTransportStatus.connected ? 'text-green-400' : 'text-red-400'}`, children: activeTransportStatus.connected ? 'CONNECTED' : 'DISCONNECTED' })] }), activeTransportStatus.error && (_jsx("span", { className: "text-[10px] text-red-500 leading-tight", children: activeTransportStatus.error })), _jsx("button", { className: `mt-1 py-1 rounded text-[10px] font-bold transition-colors ${activeTransportStatus.connected
                                    ? 'bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700/50'
                                    : 'bg-cyan-900/50 hover:bg-cyan-800 text-cyan-200 border border-cyan-700/50'}`, onClick: () => {
                                    if (activeTransportStatus.connected) {
                                        useLabStore.getState().activeTransport.disconnect();
                                    }
                                    else {
                                        useLabStore.getState().activeTransport.connect({ target, port });
                                    }
                                }, children: activeTransportStatus.connected ? 'DISCONNECT' : 'CONNECT' })] }))] }), _jsx("div", { className: "mt-3 pt-2 border-t border-gray-700", children: _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("label", { className: "text-[10px] text-gray-500 uppercase font-bold tracking-wider", children: "Design Loader" }), _jsx("select", { className: "bg-black border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500", value: selectedPreset, onChange: (e) => setSelectedPreset(e.target.value), disabled: playbackMode === 'replay', title: "Select FPGA Design", children: FPGA_PRESET_DEFS.map((def) => (_jsx("option", { value: def.id, children: def.name }, def.id))) }), _jsx("button", { className: `px-3 py-1 rounded text-white font-bold transition-colors ${playbackMode === 'replay' ? 'bg-gray-700 cursor-not-allowed text-gray-500' :
                                'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'}`, onClick: handleLoad, disabled: playbackMode === 'replay', children: "Load Bitstream" }), !fpgaNode && _jsx("span", { className: "text-red-500 text-[10px]", children: "No FPGA Found" }), playbackMode === 'replay' && _jsx("span", { className: "text-amber-500 text-[10px]", children: "Disabled in Replay" })] }) })] }));
};
