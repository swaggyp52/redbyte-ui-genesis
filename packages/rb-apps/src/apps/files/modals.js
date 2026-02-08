import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useRef, useState } from 'react';
import { useFileAssociationsStore } from '../../stores/fileAssociationsStore';
export const TextInputModal = ({ title, label, value, error, onValueChange, onConfirm, onCancel, confirmDisabled = false, }) => {
    const inputRef = useRef(null);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
        }
        else if (event.key === 'Enter' && !confirmDisabled) {
            event.preventDefault();
            onConfirm();
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: onCancel, children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: handleKeyDown, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: title }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm text-slate-300 mb-2", children: label }), _jsx("input", { ref: inputRef, type: "text", value: value, onChange: (e) => onValueChange(e.target.value), className: "w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500" }), error && (_jsx("p", { className: "text-red-400 text-sm mt-2", children: error }))] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors", children: "Cancel" }), _jsx("button", { onClick: onConfirm, disabled: confirmDisabled, className: "px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: "Confirm" })] })] }) }));
};
export const ConfirmModal = ({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, }) => {
    const confirmRef = useRef(null);
    useEffect(() => {
        confirmRef.current?.focus();
    }, []);
    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
        }
        else if (event.key === 'Enter') {
            event.preventDefault();
            onConfirm();
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: onCancel, children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: handleKeyDown, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: title }), _jsx("p", { className: "text-slate-300 text-sm mb-6", children: message }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors", children: "Cancel" }), _jsx("button", { ref: confirmRef, onClick: onConfirm, className: "px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white transition-colors", children: confirmLabel })] })] }) }));
};
export const OpenWithModal = ({ targets, resourceType, extension, onSelect, onCancel, }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [preferNewWindow, setPreferNewWindow] = useState(false); // PHASE_AC: N key toggle
    const { getDefaultTarget, setDefaultTarget, clearDefaultTarget } = useFileAssociationsStore();
    // Get current default target for this file type
    const defaultTargetId = getDefaultTarget(resourceType, extension);
    useEffect(() => {
        // Clamp selection if targets change
        if (selectedIndex >= targets.length) {
            setSelectedIndex(Math.max(0, targets.length - 1));
        }
    }, [targets.length, selectedIndex]);
    const handleKeyDown = (event) => {
        // Guard: ignore if event target is input/textarea (for future search functionality)
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
        }
        else if (event.key === 'Enter') {
            event.preventDefault();
            if (targets[selectedIndex]) {
                onSelect(targets[selectedIndex], preferNewWindow);
            }
        }
        else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, targets.length - 1));
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        else if (event.key === 'n' || event.key === 'N') {
            // N: Toggle new window mode (PHASE_AC)
            event.preventDefault();
            setPreferNewWindow((prev) => !prev);
        }
        else if (event.key === 'D' && event.shiftKey) {
            // Shift+D: Clear default
            event.preventDefault();
            clearDefaultTarget(resourceType, extension);
            // Don't close modal (user can still select a target)
        }
        else if (event.key === 'd' && !event.shiftKey) {
            // D: Set default (case-insensitive, check lowercase)
            event.preventDefault();
            const selectedTarget = targets[selectedIndex];
            if (selectedTarget) {
                setDefaultTarget(resourceType, extension, selectedTarget.id);
                // Close modal and open with this target (same as Enter)
                onSelect(selectedTarget, preferNewWindow);
            }
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: onCancel, children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: handleKeyDown, tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Open With..." }), preferNewWindow && (_jsx("div", { className: "mb-3 px-3 py-2 bg-cyan-900/30 border border-cyan-700/50 rounded text-xs text-cyan-300", children: "Will open in new window" })), targets.length === 0 ? (_jsx("p", { className: "text-slate-400 text-sm mb-4", children: "No available targets" })) : (_jsx("div", { className: "mb-4 max-h-64 overflow-y-auto", children: targets.map((target, index) => {
                        const isDefault = target.id === defaultTargetId;
                        return (_jsxs("button", { onClick: () => onSelect(target, preferNewWindow), className: `w-full text-left px-3 py-2 rounded text-sm transition-colors ${index === selectedIndex
                                ? 'bg-cyan-600 text-white'
                                : 'text-slate-300 hover:bg-slate-800'}`, children: [target.name, isDefault && (_jsx("span", { className: "ml-2 text-xs font-semibold opacity-70", children: "[DEFAULT]" }))] }, target.id));
                    }) })), _jsx("div", { className: "flex justify-end gap-2", children: _jsx("button", { onClick: onCancel, className: "px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors", children: "Cancel" }) }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "N" }), " New Window", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "D" }), " Set Default", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Shift+D" }), " Clear Default", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Open", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) }));
};
