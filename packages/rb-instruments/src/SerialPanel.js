import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const SerialPanel = ({ signalSource }) => {
    if (!signalSource?.getSerialLog) {
        return _jsx("div", { className: "text-xs text-gray-500", children: "No serial data available." });
    }
    const lines = signalSource.getSerialLog();
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-xs font-semibold text-gray-200", children: "Serial Output" }), signalSource.clearSerialLog && (_jsx("button", { onClick: () => signalSource.clearSerialLog?.(), className: "text-[10px] text-gray-400 hover:text-gray-200", type: "button", children: "Clear" }))] }), _jsx("pre", { className: "flex-1 bg-black/60 border border-gray-700 rounded p-2 text-[10px] text-green-200 font-mono overflow-auto whitespace-pre-wrap", children: lines.length > 0 ? lines.join('') : 'No output yet.' })] }));
};
