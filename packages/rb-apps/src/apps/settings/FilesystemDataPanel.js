import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useRef, useEffect } from 'react';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useFileAssociationsStore } from '../../stores/fileAssociationsStore';
export const FilesystemDataPanel = ({ onShowToast }) => {
    const { exportJson, importJson, resetAll } = useFileSystemStore();
    const [modal, setModal] = useState(null);
    const [importValue, setImportValue] = useState('');
    const [factoryResetInput, setFactoryResetInput] = useState('');
    const containerRef = useRef(null);
    const factoryResetInputRef = useRef(null);
    // Autofocus factory reset input when modal opens
    useEffect(() => {
        if (modal?.type === 'factory-reset') {
            requestAnimationFrame(() => {
                factoryResetInputRef.current?.focus();
            });
        }
    }, [modal]);
    const handleKeyDown = (event) => {
        // Guard: ignore if typing in textarea or input
        const target = event.target;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            return;
        }
        if (modal)
            return; // Modals handle their own keys
        if (event.key === 'e' || event.key === 'E') {
            event.preventDefault();
            setModal({ type: 'export' });
        }
        else if (event.key === 'i' || event.key === 'I') {
            event.preventDefault();
            setModal({ type: 'import' });
            setImportValue('');
        }
        else if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            setModal({ type: 'reset-confirm' });
        }
        else if (event.key === 'f' || event.key === 'F') {
            event.preventDefault();
            setModal({ type: 'factory-reset' });
            setFactoryResetInput('');
        }
    };
    const handleModalKeyDown = (event, modalType) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setModal(null);
            requestAnimationFrame(() => {
                containerRef.current?.focus();
            });
        }
        else if (modalType === 'import') {
            // Guard: only handle Enter when not typing in textarea
            const target = event.target;
            if (target.tagName === 'TEXTAREA')
                return;
            if (event.key === 'Enter') {
                event.preventDefault();
                try {
                    importJson(importValue);
                    onShowToast?.('Filesystem imported successfully');
                    setModal(null);
                    requestAnimationFrame(() => {
                        containerRef.current?.focus();
                    });
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    onShowToast?.(`Import failed: ${message}`);
                }
            }
        }
        else if (modalType === 'reset-confirm') {
            if (event.key === 'Enter') {
                event.preventDefault();
                resetAll();
                onShowToast?.('Filesystem reset to default');
                setModal(null);
                requestAnimationFrame(() => {
                    containerRef.current?.focus();
                });
            }
        }
        else if (modalType === 'factory-reset') {
            // Guard: only handle Enter when not typing in input
            const target = event.target;
            if (target.tagName === 'INPUT')
                return;
            if (event.key === 'Enter' && factoryResetInput === 'RESET') {
                event.preventDefault();
                handleFactoryReset();
            }
        }
    };
    const handleFactoryReset = () => {
        try {
            // Reset in deterministic order
            useFileAssociationsStore.getState().resetAll();
            useFileSystemStore.getState().resetAll();
            // Explicitly clear localStorage keys (stores may persist empty objects)
            if (typeof window !== 'undefined') {
                localStorage.removeItem('rb:file-associations');
                localStorage.removeItem('rb:file-system');
                localStorage.removeItem('rb:window-layout');
            }
            // Verify all keys cleared
            if (typeof window !== 'undefined') {
                const fsKey = localStorage.getItem('rb:file-system');
                const assocKey = localStorage.getItem('rb:file-associations');
                const layoutKey = localStorage.getItem('rb:window-layout');
                if (fsKey || assocKey || layoutKey) {
                    throw new Error('Factory reset incomplete - localStorage keys not cleared');
                }
            }
            onShowToast?.('Factory reset complete - all data cleared');
            setModal(null);
            requestAnimationFrame(() => {
                containerRef.current?.focus();
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            onShowToast?.(`Factory reset failed: ${message}`);
        }
    };
    return (_jsxs("div", { ref: containerRef, tabIndex: 0, onKeyDown: handleKeyDown, className: "h-full flex flex-col", style: { outline: 'none' }, children: [_jsx("div", { className: "flex-1 overflow-y-auto p-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-white mb-2", children: "Filesystem Persistence" }), _jsx("p", { className: "text-xs text-slate-400 mb-4", children: "Your filesystem state is automatically persisted to browser storage. Use the actions below to export, import, or reset your filesystem data." })] }), _jsxs("div", { className: "bg-slate-900 rounded p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("kbd", { className: "px-2 py-1 bg-slate-800 rounded text-cyan-400 font-mono text-xs shrink-0", children: "E" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-white", children: "Export Filesystem" }), _jsx("div", { className: "text-xs text-slate-400 mt-1", children: "View canonical JSON snapshot of your filesystem state" })] })] }), _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("kbd", { className: "px-2 py-1 bg-slate-800 rounded text-cyan-400 font-mono text-xs shrink-0", children: "I" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-white", children: "Import Filesystem" }), _jsx("div", { className: "text-xs text-slate-400 mt-1", children: "Restore filesystem from JSON snapshot" })] })] }), _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("kbd", { className: "px-2 py-1 bg-slate-800 rounded text-red-400 font-mono text-xs shrink-0", children: "R" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-white", children: "Reset Filesystem" }), _jsx("div", { className: "text-xs text-slate-400 mt-1", children: "Clear all data and restore default filesystem" })] })] }), _jsxs("div", { className: "border-t border-slate-800 pt-3 mt-3 flex items-start gap-3", children: [_jsx("kbd", { className: "px-2 py-1 bg-slate-800 rounded text-red-600 font-mono text-xs shrink-0", children: "F" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-white", children: "Factory Reset" }), _jsx("div", { className: "text-xs text-slate-400 mt-1", children: "Clear ALL data: filesystem + file associations (requires typing RESET)" })] })] })] }), _jsx("div", { className: "bg-slate-900 border border-yellow-900/30 rounded p-3", children: _jsxs("div", { className: "text-xs text-yellow-400/90", children: [_jsx("strong", { children: "Warning:" }), " Import and Reset operations will replace your current filesystem. Factory Reset will permanently delete all files, folders, and file associations. Export your data first to create a backup."] }) })] }) }), _jsxs("div", { className: "p-3 border-t border-slate-800 text-xs text-slate-500 text-center space-y-1", children: [_jsxs("div", { children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "E" }), " Export", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "I" }), " Import", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "R" }), " Reset"] }), _jsxs("div", { children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded text-red-400", children: "F" }), " Factory Reset (filesystem + associations)"] })] }), modal && modal.type === 'export' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[600px] p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'export'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Export Filesystem" }), _jsx("p", { className: "text-sm text-slate-400 mb-4", children: "Copy JSON below to save your filesystem state:" }), _jsx("textarea", { readOnly: true, value: exportJson(), className: "w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-96", onClick: (e) => e.target.select(), "aria-label": "Exported filesystem JSON" }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: ["Click to select all \u00B7 ", _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Close"] })] }) })), modal && modal.type === 'import' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[600px] p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'import'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Import Filesystem" }), _jsx("p", { className: "text-sm text-slate-400 mb-4", children: "Paste JSON to restore your filesystem state:" }), _jsx("textarea", { value: importValue, onChange: (e) => setImportValue(e.target.value), placeholder: '{"version":1,"state":{"folders":{...},"roots":[...],"nextId":...}}', className: "w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-96", autoFocus: true, "aria-label": "Import filesystem JSON" }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Apply", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) })), modal && modal.type === 'reset-confirm' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'reset-confirm'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Reset Filesystem?" }), _jsx("p", { className: "text-slate-300 text-sm mb-6", children: "This will clear all your files and folders and restore the default filesystem. This action cannot be undone." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => {
                                        setModal(null);
                                        requestAnimationFrame(() => {
                                            containerRef.current?.focus();
                                        });
                                    }, className: "px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white", children: "Cancel" }), _jsx("button", { onClick: () => {
                                        resetAll();
                                        onShowToast?.('Filesystem reset to default');
                                        setModal(null);
                                        requestAnimationFrame(() => {
                                            containerRef.current?.focus();
                                        });
                                    }, className: "px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white", children: "Reset Filesystem" })] }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Confirm", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) })), modal && modal.type === 'factory-reset' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-red-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'factory-reset'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Factory Reset?" }), _jsx("p", { className: "text-slate-300 text-sm mb-4", children: "This will permanently delete all files, folders, and file associations. This action cannot be undone." }), _jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "block text-sm text-slate-400 mb-2", children: ["Type ", _jsx("strong", { className: "text-white", children: "RESET" }), " to confirm:"] }), _jsx("input", { ref: factoryResetInputRef, value: factoryResetInput, onChange: (e) => setFactoryResetInput(e.target.value), placeholder: "Type RESET", className: "w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => {
                                        setModal(null);
                                        requestAnimationFrame(() => {
                                            containerRef.current?.focus();
                                        });
                                    }, className: "px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white", children: "Cancel" }), _jsx("button", { disabled: factoryResetInput !== 'RESET', onClick: handleFactoryReset, className: `px-4 py-2 text-sm rounded text-white transition-opacity ${factoryResetInput === 'RESET'
                                        ? 'bg-red-600 hover:bg-red-500'
                                        : 'bg-slate-700 opacity-50 cursor-not-allowed'}`, children: "Factory Reset" })] }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [factoryResetInput === 'RESET' && (_jsxs(_Fragment, { children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Confirm", ' '] })), _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) }))] }));
};
