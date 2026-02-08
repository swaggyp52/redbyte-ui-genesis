import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const KeyboardShortcutsHelp = ({ isOpen, onClose }) => {
    if (!isOpen)
        return null;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';
    const shortcuts = [
        { category: 'File Operations', items: [
                { keys: `${modKey}+S`, description: 'Save current file' },
                { keys: `${modKey}+Shift+S`, description: 'Save as new file' },
                { keys: `${modKey}+O`, description: 'Open file' },
                { keys: `${modKey}+Shift+C`, description: 'Share circuit (copy link)' },
            ] },
        { category: 'Edit', items: [
                { keys: `${modKey}+Z`, description: 'Undo' },
                { keys: `${modKey}+Y` + (isMac ? '' : ' / Ctrl+Shift+Z'), description: 'Redo' },
                { keys: 'Delete / Backspace', description: 'Delete selected items' },
                { keys: 'Escape', description: 'Clear selection / Cancel wire' },
            ] },
        { category: 'View Controls', items: [
                { keys: `${modKey}+F`, description: 'Fit circuit to view' },
                { keys: `${modKey}+R`, description: 'Reset view position' },
                { keys: `${modKey}+0`, description: 'Reset zoom to 100%' },
                { keys: 'Scroll', description: 'Zoom in/out' },
                { keys: 'Shift+Drag', description: 'Pan view' },
                { keys: '1-5', description: 'Single-view layouts (Circuit/Schematic/Scope/3D/Code)' },
                { keys: 'Shift+1-5', description: 'Workflow layouts (Build/Explain/Analyze/Explore/Quad)' },
            ] },
        { category: 'Dock & Panels', items: [
                { keys: `${modKey}+1..6`, description: 'Switch right dock tabs' },
                { keys: 'Shift+P', description: 'Open Probes tab' },
            ] },
        { category: 'Circuit Interaction', items: [
                { keys: 'Click port → Click port', description: 'Connect components' },
                { keys: 'Drag node', description: 'Move component' },
                { keys: 'Shift+Click', description: 'Multi-select' },
                { keys: 'Space', description: 'Run/Pause simulation' },
            ] },
        { category: 'Help', items: [
                { keys: '?', description: 'Show this help dialog' },
            ] },
    ];
    return (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]", onClick: onClose, children: _jsxs("div", { className: "bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-xl font-bold text-white", children: "Keyboard Shortcuts" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-white transition-colors text-2xl leading-none", title: "Close (Esc)", children: "\u00D7" })] }), _jsx("div", { className: "p-6 space-y-6", children: shortcuts.map((section, idx) => (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-cyan-400 mb-3 uppercase tracking-wide", children: section.category }), _jsx("div", { className: "space-y-2", children: section.items.map((shortcut, itemIdx) => (_jsxs("div", { className: "flex items-start justify-between gap-4 text-sm", children: [_jsx("kbd", { className: "bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-white whitespace-nowrap", children: shortcut.keys }), _jsx("span", { className: "text-gray-300 flex-1 text-right", children: shortcut.description })] }, itemIdx))) })] }, idx))) }), _jsxs("div", { className: "sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-3 text-center text-xs text-gray-500", children: ["Press ", _jsx("kbd", { className: "bg-gray-700 px-1.5 py-0.5 rounded", children: "Esc" }), " or click outside to close"] })] }) }));
};
