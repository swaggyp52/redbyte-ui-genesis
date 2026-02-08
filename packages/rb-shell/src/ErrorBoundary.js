import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { Component } from 'react';
import { getDiagnosticsSnapshot } from './sessionDiagnosticsStore';
import { toStudentFacingError } from '@redbyte/rb-utils';
/**
 * Top-level error boundary for RedByte OS.
 *
 * Catches unhandled errors and displays a minimal recovery UI instead of white-screen.
 * Provides two recovery paths:
 * 1. Reload (window.location.reload())
 * 2. Factory Reset hint (Settings -> Filesystem Data -> F -> type RESET)
 *
 * No timers or async operations; deterministic recovery flow.
 */
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
        };
    }
    componentDidCatch(error, errorInfo) {
        // Log error to console for debugging
        console.error('ErrorBoundary caught error:', error, errorInfo);
        try {
            localStorage.setItem('rb_error_boundary_hit', 'true');
        }
        catch {
            // Ignore storage failures
        }
    }
    handleReload = () => {
        window.location.reload();
    };
    handleExportRecovery = () => {
        try {
            const diagnostics = getDiagnosticsSnapshot();
            const payload = {
                schemaVersion: 1,
                timestamp: new Date().toISOString(),
                error: this.state.error?.message ?? 'Unknown error',
                stack: this.state.error?.stack ?? null,
                diagnostics,
                snapshot: (() => {
                    try {
                        return JSON.parse(localStorage.getItem('rb_workspace_latest') || 'null');
                    }
                    catch {
                        return null;
                    }
                })(),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `redbyte-recovery-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (err) {
            console.error('Failed to export recovery bundle:', err);
        }
    };
    handleCopyDiagnostics = async () => {
        try {
            const diagnostics = getDiagnosticsSnapshot();
            const payload = JSON.stringify(diagnostics, null, 2);
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(payload);
            }
            else {
                const textarea = document.createElement('textarea');
                textarea.value = payload;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
        }
        catch (err) {
            console.error('Failed to copy diagnostics:', err);
        }
    };
    handleSafeMode = () => {
        try {
            localStorage.setItem('rb_safe_mode', '1');
        }
        catch {
            // ignore storage errors
        }
        window.location.reload();
    };
    render() {
        if (this.state.hasError) {
            const studentError = toStudentFacingError(this.state.error);
            return (_jsx("div", { className: "min-h-screen bg-slate-950 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-slate-900 border border-red-700 rounded-lg shadow-xl max-w-md w-full p-6", children: [_jsx("h1", { className: "text-2xl font-semibold text-white mb-4", children: "Something went wrong" }), _jsx("p", { className: "text-slate-300 text-sm mb-4", children: "RedByte OS encountered an unexpected error. You can try reloading the page, or perform a factory reset to clear all data and start fresh." }), this.state.error && (_jsx("div", { className: "bg-slate-800 border border-slate-700 rounded p-3 mb-4", children: _jsx("p", { className: "text-xs font-mono text-red-400 break-all", children: studentError.message }) })), _jsxs("div", { className: "space-y-3", children: [_jsx("button", { onClick: this.handleReload, className: "w-full px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium", children: "Reload Page" }), _jsx("button", { onClick: this.handleExportRecovery, className: "w-full px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium", children: "Export Recovery Bundle" }), _jsx("button", { onClick: this.handleCopyDiagnostics, className: "w-full px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium", children: "Copy Diagnostics" }), _jsx("button", { onClick: this.handleSafeMode, className: "w-full px-4 py-2 text-sm rounded bg-amber-700 hover:bg-amber-600 text-white font-medium", children: "Restart in Safe Mode" }), _jsxs("div", { className: "bg-slate-800 border border-yellow-700/30 rounded p-3", children: [_jsx("p", { className: "text-xs text-yellow-400/90 mb-2", children: _jsx("strong", { children: "Factory Reset (clears all data):" }) }), _jsxs("ol", { className: "text-xs text-slate-400 space-y-1 list-decimal list-inside", children: [_jsx("li", { children: "Reload the page" }), _jsx("li", { children: "Open Settings (Ctrl+,)" }), _jsx("li", { children: "Go to Filesystem Data" }), _jsxs("li", { children: ["Press ", _jsx("kbd", { className: "px-1 py-0.5 bg-slate-700 rounded text-red-400", children: "F" })] }), _jsxs("li", { children: ["Type ", _jsx("strong", { className: "text-white", children: "RESET" }), " and confirm"] })] })] })] }), _jsx("p", { className: "text-xs text-slate-500 mt-4 text-center", children: "If this problem persists, please report it on GitHub." })] }) }));
        }
        return this.props.children;
    }
}
