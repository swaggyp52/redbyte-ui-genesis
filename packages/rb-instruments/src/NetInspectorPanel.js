import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
const formatMembers = (meta) => {
    const members = meta?.members;
    if (typeof members === 'number')
        return `${members} pins`;
    return 'Unknown';
};
export const NetInspectorPanel = ({ signalSource, currentTick, selectedSignalId, onSelectSignalId, }) => {
    const nets = useMemo(() => {
        if (!signalSource)
            return [];
        return signalSource.listSignals().filter((signal) => signal.kind === 'net');
    }, [signalSource]);
    if (!signalSource) {
        return (_jsx("div", { className: "text-xs text-gray-500", children: "No signal source available." }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "text-[10px] text-gray-500", children: [nets.length, " nets"] }), _jsx("div", { className: "max-h-52 overflow-auto space-y-1", children: nets.length === 0 ? (_jsx("div", { className: "text-[10px] text-gray-500", children: "No nets yet." })) : (nets.map((net) => {
                    const meta = signalSource.getMetadata?.(net);
                    const isSelected = selectedSignalId === net.id;
                    return (_jsxs("button", { onClick: () => onSelectSignalId(net.id), className: `w-full text-left text-[10px] px-2 py-1 rounded border ${isSelected
                            ? 'border-blue-400 text-blue-200 bg-blue-900/20'
                            : 'border-gray-800 text-gray-300 hover:text-blue-200'}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "truncate", children: net.label }), _jsx("span", { className: "text-[10px] text-gray-500", children: formatMembers(meta) })] }), _jsxs("div", { className: "text-[9px] text-gray-500", children: ["t=", currentTick] })] }, net.id));
                })) }), selectedSignalId && signalSource.locate && (_jsx("button", { onClick: () => {
                    const signal = signalSource.resolveSignal(selectedSignalId);
                    if (signal)
                        signalSource.locate?.(signal);
                }, className: "text-[10px] text-blue-300 hover:text-blue-200 text-left", children: "Locate selection" }))] }));
};
