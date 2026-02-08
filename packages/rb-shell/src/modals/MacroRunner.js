import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, Input } from '@redbyte/rb-primitives';
export const MacroRunner = ({ macros, onExecute, onClose, }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const filteredMacros = useMemo(() => {
        if (!query)
            return macros;
        const lowerQuery = query.toLowerCase();
        return macros.filter((m) => m.name.toLowerCase().includes(lowerQuery));
    }, [macros, query]);
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);
    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, filteredMacros.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const selected = filteredMacros[selectedIndex];
            if (!selected)
                return;
            onExecute(selected.id);
            onClose();
            return;
        }
    };
    const handleMacroClick = (macroId) => {
        onExecute(macroId);
        onClose();
    };
    return (_jsx(Modal, { isOpen: true, onClose: onClose, title: "Run Macro", variant: "center", size: "md", closeOnEsc: true, closeOnBackdrop: true, initialFocusRef: inputRef, children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { ref: inputRef, type: "text", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: handleKeyDown, placeholder: "Type to filter...", size: "md", "aria-label": "Filter macros" }), _jsxs("div", { className: "max-h-96 overflow-y-auto", children: [filteredMacros.length === 0 && (_jsx("div", { className: "text-gray-400 text-center py-8", children: query ? 'No macros found' : 'No macros available' })), filteredMacros.map((macro, index) => {
                            const isSelected = index === selectedIndex;
                            const stepCount = macro.steps.length;
                            return (_jsxs("button", { onClick: () => handleMacroClick(macro.id), className: `
                  w-full text-left px-3 py-2 my-1 rounded
                  transition-colors
                  ${isSelected ? 'bg-slate-700 border border-cyan-500' : 'border border-transparent hover:bg-slate-700/50'}
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                `, role: "option", "aria-selected": isSelected, children: [_jsx("div", { className: "text-gray-100 font-medium", children: macro.name }), _jsxs("div", { className: "text-sm text-gray-400 mt-1", children: [stepCount, " step", stepCount !== 1 ? 's' : ''] })] }, macro.id));
                        })] }), _jsxs("div", { className: "text-gray-400 text-sm space-y-1 pt-3 border-t border-slate-700", children: [_jsx("div", { children: "\u2191\u2193: Navigate" }), _jsx("div", { children: "Enter: Execute" }), _jsx("div", { children: "Esc: Cancel" })] })] }) }));
};
