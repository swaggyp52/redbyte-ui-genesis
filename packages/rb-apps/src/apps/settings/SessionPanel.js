import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useRef } from 'react';
export const SessionPanel = ({ onShowToast }) => {
    const [modal, setModal] = useState(null);
    const containerRef = useRef(null);
    const handleKeyDown = (event) => {
        // Guard: ignore if typing in textarea or input
        const target = event.target;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            return;
        }
        if (modal)
            return; // Modals handle their own keys
        if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            setModal({ type: 'reset-confirm' });
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
        else if (modalType === 'reset-confirm') {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleResetSession();
            }
        }
    };
    const handleResetSession = () => {
        try {
            // Clear window layout from localStorage
            if (typeof window !== 'undefined') {
                localStorage.removeItem('rb:window-layout');
            }
            // Verify key cleared
            if (typeof window !== 'undefined') {
                const layoutKey = localStorage.getItem('rb:window-layout');
                if (layoutKey) {
                    throw new Error('Session reset incomplete - localStorage key not cleared');
                }
            }
            onShowToast?.('Session reset complete - window layout cleared. Reload to apply.');
            setModal(null);
            requestAnimationFrame(() => {
                containerRef.current?.focus();
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            onShowToast?.(`Session reset failed: ${message}`);
        }
    };
    return (_jsxs("div", { ref: containerRef, tabIndex: 0, onKeyDown: handleKeyDown, className: "h-full flex flex-col", style: { outline: 'none' }, children: [_jsx("div", { className: "flex-1 overflow-y-auto p-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-white mb-2", children: "Session Management" }), _jsx("p", { className: "text-xs text-slate-400 mb-4", children: "Your window layout (open windows, positions, sizes, z-order) is automatically persisted to browser storage. Use the action below to reset your session layout." })] }), _jsx("div", { className: "bg-slate-900 rounded p-4 space-y-3", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("kbd", { className: "px-2 py-1 bg-slate-800 rounded text-red-400 font-mono text-xs shrink-0", children: "R" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-white", children: "Reset Session Layout" }), _jsx("div", { className: "text-xs text-slate-400 mt-1", children: "Clear all open windows and layout state (requires page reload)" })] })] }) }), _jsx("div", { className: "bg-slate-900 border border-yellow-900/30 rounded p-3", children: _jsxs("div", { className: "text-xs text-yellow-400/90", children: [_jsx("strong", { children: "Note:" }), " After resetting your session layout, you must reload the page for changes to take effect. On next boot, the system will start with a clean window layout."] }) })] }) }), _jsxs("div", { className: "p-3 border-t border-slate-800 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "R" }), " Reset Session Layout"] }), modal && modal.type === 'reset-confirm' && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", onClick: () => setModal(null), children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => handleModalKeyDown(e, 'reset-confirm'), tabIndex: 0, children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "Reset Session Layout?" }), _jsx("p", { className: "text-slate-300 text-sm mb-6", children: "This will clear your window layout state. All open windows will be closed on next boot, and the system will start fresh. This action cannot be undone." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => {
                                        setModal(null);
                                        requestAnimationFrame(() => {
                                            containerRef.current?.focus();
                                        });
                                    }, className: "px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white", children: "Cancel" }), _jsx("button", { onClick: handleResetSession, className: "px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white", children: "Reset Session" })] }), _jsxs("div", { className: "mt-3 text-xs text-slate-500 text-center", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Enter" }), " Confirm", ' ', _jsx("kbd", { className: "px-1.5 py-0.5 bg-slate-800 rounded", children: "Esc" }), " Cancel"] })] }) }))] }));
};
