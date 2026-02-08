import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, Input } from '@redbyte/rb-primitives';
export const WorkspaceSwitcher = ({ workspaces, currentWorkspaceId, onSelect, onClose, }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const filteredWorkspaces = useMemo(() => {
        if (!query)
            return workspaces;
        const lowerQuery = query.toLowerCase();
        return workspaces.filter((w) => w.name.toLowerCase().includes(lowerQuery));
    }, [workspaces, query]);
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);
    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, filteredWorkspaces.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const selected = filteredWorkspaces[selectedIndex];
            if (!selected)
                return;
            onSelect(selected.id);
            onClose();
            return;
        }
    };
    const handleWorkspaceClick = (workspaceId) => {
        onSelect(workspaceId);
        onClose();
    };
    return (_jsx(Modal, { isOpen: true, onClose: onClose, title: "Switch Workspace", variant: "center", size: "md", closeOnEsc: true, closeOnBackdrop: true, initialFocusRef: inputRef, children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { ref: inputRef, type: "text", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: handleKeyDown, placeholder: "Type to filter...", size: "md", "aria-label": "Filter workspaces" }), _jsxs("div", { className: "max-h-96 overflow-y-auto", children: [filteredWorkspaces.length === 0 && (_jsx("div", { className: "text-gray-400 text-center py-8", children: "No workspaces found" })), filteredWorkspaces.map((workspace, index) => {
                            const isSelected = index === selectedIndex;
                            const isCurrent = workspace.id === currentWorkspaceId;
                            return (_jsxs("button", { onClick: () => handleWorkspaceClick(workspace.id), className: `
                  w-full text-left px-3 py-2 my-1 rounded flex items-center justify-between
                  transition-colors
                  ${isSelected ? 'bg-slate-700 border border-cyan-500' : 'border border-transparent hover:bg-slate-700/50'}
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                `, role: "option", "aria-selected": isSelected, children: [_jsx("span", { className: "text-gray-100", children: workspace.name }), isCurrent && _jsx("span", { className: "text-cyan-400 text-sm", children: "(Current)" })] }, workspace.id));
                        })] }), _jsxs("div", { className: "text-gray-400 text-sm space-y-1 pt-3 border-t border-slate-700", children: [_jsx("div", { children: "\u2191\u2193: Navigate" }), _jsx("div", { children: "Enter: Switch" }), _jsx("div", { children: "Esc: Cancel" })] })] }) }));
};
