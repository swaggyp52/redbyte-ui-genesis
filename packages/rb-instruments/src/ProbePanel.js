import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
const getWindowStart = (currentTick, windowTicks) => Math.max(0, currentTick - windowTicks);
export const ProbePanel = ({ signalSource, currentTick, selectedSignalId, }) => {
    const [windowTicks, setWindowTicks] = useState(200);
    const signal = useMemo(() => {
        if (!signalSource || !selectedSignalId)
            return null;
        return signalSource.resolveSignal(selectedSignalId);
    }, [signalSource, selectedSignalId]);
    const history = useMemo(() => {
        if (!signalSource || !signal)
            return [];
        const tickFrom = getWindowStart(currentTick, windowTicks);
        return signalSource.getHistory(signal, tickFrom, currentTick, 1);
    }, [signalSource, signal, currentTick, windowTicks]);
    const currentValue = useMemo(() => {
        if (!signalSource || !signal)
            return null;
        return signalSource.sample(signal, currentTick);
    }, [signalSource, signal, currentTick]);
    const lastChangeTick = history.length > 0 ? history[history.length - 1].tick : null;
    if (!signalSource) {
        return _jsx("div", { className: "text-xs text-gray-500", children: "No signal source available." });
    }
    if (!signal) {
        return _jsx("div", { className: "text-xs text-gray-500", children: "Select a net or pin to inspect." });
    }
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("div", { className: "text-xs font-semibold text-gray-200", children: signal.label }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-[10px]", children: [_jsxs("div", { className: "bg-[#111] border border-gray-800 rounded px-2 py-1", children: [_jsx("div", { className: "text-gray-500 uppercase", children: "Value" }), _jsx("div", { className: "text-white font-mono", children: currentValue ?? 0 })] }), _jsxs("div", { className: "bg-[#111] border border-gray-800 rounded px-2 py-1", children: [_jsx("div", { className: "text-gray-500 uppercase", children: "Last Change" }), _jsx("div", { className: "text-white font-mono", children: lastChangeTick ?? '-' })] }), _jsxs("div", { className: "bg-[#111] border border-gray-800 rounded px-2 py-1", children: [_jsx("div", { className: "text-gray-500 uppercase", children: "Toggles" }), _jsx("div", { className: "text-white font-mono", children: history.length })] }), _jsxs("div", { className: "bg-[#111] border border-gray-800 rounded px-2 py-1", children: [_jsx("div", { className: "text-gray-500 uppercase", children: "Window" }), _jsx("input", { value: windowTicks, onChange: (e) => setWindowTicks(Math.max(10, Number(e.target.value) || 200)), className: "w-full bg-transparent text-white font-mono text-[10px]" })] })] }), _jsx("div", { className: "text-[10px] text-gray-500", children: "Recent changes" }), _jsx("div", { className: "max-h-32 overflow-auto space-y-1", children: history.length === 0 ? (_jsx("div", { className: "text-[10px] text-gray-500", children: "No transitions recorded." })) : (history.slice(-12).map((entry) => (_jsxs("div", { className: "text-[10px] text-gray-300", children: ["Tick ", entry.tick, ": ", entry.value] }, `${entry.tick}-${entry.value}`)))) })] }));
};
