import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useRef, useEffect } from 'react';
import { useFileAssociationsStore } from '../../stores/fileAssociationsStore';
import { FILE_ACTION_TARGETS } from '../files/fileActionTargets';
export const FileAssociationsPanel = ({ onShowToast }) => {
    const { listAssociations, setDefaultTarget, clearDefaultTarget, resetAll, exportJson, importJson } = useFileAssociationsStore();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [modal, setModal] = useState(null);
    const [targetPickerIndex, setTargetPickerIndex] = useState(0);
    const [importValue, setImportValue] = useState('');
    const containerRef = useRef(null);
    const associations = listAssociations();
    useEffect(() => {
        setSelectedIndex((prev) => Math.min(prev, Math.max(0, associations.length - 1)));
    }, [associations.length]);
    const handleKeyDown = (event) => {
        // Guard: ignore if typing in input/textarea
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }
        if (modal)
            return; // Modals handle their own keys
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, associations.length - 1));
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        else if (event.key === 'Enter' && associations.length > 0) {
            event.preventDefault();
            const selected = associations[selectedIndex];
            setModal({ type: 'target-picker', extension: selected.extension, resourceType: selected.resourceType });
            setTargetPickerIndex(0);
        }
        else if ((event.key === 'Delete' || event.key === 'Backspace') && associations.length > 0) {
            event.preventDefault();
            const selected = associations[selectedIndex];
            clearDefaultTarget(selected.resourceType, selected.extension);
        }
        else if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            setModal({ type: 'reset-confirm' });
        }
        else if (event.key === 'e' || event.key === 'E') {
            event.preventDefault();
            setModal({ type: 'export' });
        }
        else if (event.key === 'i' || event.key === 'I') {
            event.preventDefault();
            setModal({ type: 'import' });
            setImportValue('');
        }
    };
    const handleModalKeyDown = (event, modalType) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setModal(null);
            containerRef.current?.focus();
        }
        else if (modalType === 'target-picker') {
            const eligible = getEligibleTargets(modal.extension, modal.resourceType);
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setTargetPickerIndex((prev) => Math.min(prev + 1, eligible.length - 1));
            }
            else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setTargetPickerIndex((prev) => Math.max(prev - 1, 0));
            }
            else if (event.key === 'Enter' && eligible.length > 0) {
                event.preventDefault();
                const selected = eligible[targetPickerIndex];
                setDefaultTarget(modal.resourceType, modal.extension, selected.id);
                setModal(null);
                containerRef.current?.focus();
            }
        }
        else if (modalType === 'reset-confirm') {
            if (event.key === 'Enter') {
                event.preventDefault();
                resetAll();
                setModal(null);
                setSelectedIndex(0);
                containerRef.current?.focus();
            }
        }
        else if (modalType === 'import') {
            // Guard: only handle Enter when not typing
            const target = event.target;
            if (target.tagName === 'TEXTAREA')
                return;
            if (event.key === 'Enter') {
                event.preventDefault();
                const result = importJson(importValue);
                if (result.success) {
                    if (result.unknownTargets && result.unknownTargets.length > 0) {
                        onShowToast?.(`Filtered unknown apps: ${result.unknownTargets.join(', ')}`);
                    }
                    setModal(null);
                    containerRef.current?.focus();
                }
                else {
                    onShowToast?.('Invalid JSON format');
                }
            }
        }
    };
    const getEligibleTargets = (extension, resourceType) => {
        // Simulate filename with extension to test eligibility
        const testName = `test.${extension}`;
        return FILE_ACTION_TARGETS.filter((target) => target.isEligible(resourceType, testName));
    };
    const getTargetName = (targetId) => {
        const target = FILE_ACTION_TARGETS.find((t) => t.id === targetId);
        return target ? target.name : targetId;
    };
    return (_jsxs("div", { ref: containerRef, tabIndex: 0, onKeyDown: handleKeyDown, className: "h-full flex flex-col", style: { outline: 'none' }, children: [_jsx("div", { className: "flex-1 overflow-y-auto p-4", children: associations.length === 0 ? (_jsx("p", { className: "text-slate-400 text-sm", children: "No file associations configured" })) : (_jsx("div", { className: "space-y-2", children: associations.map((assoc, index) => (_jsx("div", { className: `p-3 rounded ${index === selectedIndex ? 'bg-slate-800 ring-1 ring-cyan-400' : 'bg-slate-900'}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("span", { className: "font-mono text-sm text-cyan-300", children: [".", assoc.extension] }), _jsxs("span", { className: "text-xs text-slate-500 ml-2", children: ["(", assoc.resourceType, ")"] })] }), _jsxs("div", { className: "text-sm text-slate-300", children: [getTargetName(assoc.targetId), _jsx("span", { className: "ml-2 text-xs text-slate-500", children: "[DEFAULT]" })] })] }) }, `${assoc.resourceType}-${assoc.extension}`))) })) }), _jsxs("div", { className: "p-3 border-t border-slate-800 text-xs text-slate-500 text-center space-y-1", children: [_jsxs("div", { children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Edit", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Del" }), " Clear", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "R" }), " Reset All"] }), _jsxs("div", { children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "E" }), " Export", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "I" }), " Import"] })] }), modal && modal.type === 'target-picker' && modal.extension && modal.resourceType && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'target-picker'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Select Default Target" }), _jsxs("p", { className: "text-sm text-slate-400 mb-4", children: ["For .", modal.extension, " files:"] }), (() => {
                            const eligible = getEligibleTargets(modal.extension, modal.resourceType);
                            return eligible.length === 0 ? (_jsx("p", { className: "text-slate-400 text-sm", children: "No available targets" })) : (_jsx("div", { className: "mb-4 max-h-64 overflow-y-auto", children: eligible.map((target, index) => (_jsx("button", { onClick: () => {
                                        setDefaultTarget(modal.resourceType, modal.extension, target.id);
                                        setModal(null);
                                        containerRef.current?.focus();
                                    }, className: `w-full text-left px-3 py-2 rounded text-sm transition-colors ${index === targetPickerIndex ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`, children: target.name }, target.id))) }));
                        })(), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "\u2191\u2193" }), " Navigate", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Select", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) })), modal && modal.type === 'reset-confirm' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'reset-confirm'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Reset All Associations?" }), _jsx("p", { className: "text-slate-300 text-sm mb-6", children: "This will clear all default targets for all file types." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => setModal(null), className: "px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white", children: "Cancel" }), _jsx("button", { onClick: () => {
                                        resetAll();
                                        setModal(null);
                                        setSelectedIndex(0);
                                        containerRef.current?.focus();
                                    }, className: "px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white", children: "Reset All" })] }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Confirm", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) })), modal && modal.type === 'export' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'export'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Export File Associations" }), _jsx("p", { className: "text-sm text-slate-400 mb-4", children: "Copy JSON below to save file associations:" }), _jsx("textarea", { readOnly: true, value: exportJson(), className: "w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-48", onClick: (e) => e.target.select(), "aria-label": "Exported file associations JSON" }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Close"] })] }) })), modal && modal.type === 'import' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'import'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Import File Associations" }), _jsx("p", { className: "text-sm text-slate-400 mb-4", children: "Paste JSON to import file associations:" }), _jsx("textarea", { value: importValue, onChange: (e) => setImportValue(e.target.value), placeholder: '{"associations":{"file":{"txt":"text-viewer"}}}', className: "w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-48", autoFocus: true, "aria-label": "Import file associations JSON" }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Apply", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) }))] }));
};
