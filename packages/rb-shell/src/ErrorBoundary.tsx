// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getDiagnosticsSnapshot } from './sessionDiagnosticsStore';
import { toStudentFacingError } from '@redbyte/rb-utils';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

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
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    console.error('[LP_SIM_CRASH] ErrorBoundary caught error:', error, errorInfo);
    if (typeof window !== 'undefined') {
      const debug = (window as any).__RB_DEBUG__ ?? {};
      debug.lastSimError = {
        message: error.message,
        stack: error.stack ?? null,
        componentStack: errorInfo?.componentStack ?? null,
      };
      (window as any).__RB_DEBUG__ = debug;
    }
    try {
      localStorage.setItem('rb_error_boundary_hit', 'true');
    } catch {
      // Ignore storage failures
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleExportRecovery = (): void => {
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
          } catch {
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
    } catch (err) {
      console.error('Failed to export recovery bundle:', err);
    }
  };

  handleCopyDiagnostics = async (): Promise<void> => {
    try {
      const diagnostics = getDiagnosticsSnapshot();
      const payload = JSON.stringify(diagnostics, null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = payload;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (err) {
      console.error('Failed to copy diagnostics:', err);
    }
  };

  handleSafeMode = (): void => {
    try {
      localStorage.setItem('rb_safe_mode', '1');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const studentError = toStudentFacingError(this.state.error);
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-700 rounded-lg shadow-xl max-w-md w-full p-6">
            <h1 className="text-2xl font-semibold text-white mb-4">Something went wrong</h1>

            <p className="text-slate-300 text-sm mb-4">
              RedByte OS encountered an unexpected error. You can try reloading the page, or perform a factory reset to clear all data and start fresh.
            </p>

            {this.state.error && (
              <div className="bg-slate-800 border border-slate-700 rounded p-3 mb-4">
                <p className="text-xs font-mono text-red-400 break-all">
                  {studentError.message}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleExportRecovery}
                className="w-full px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
              >
                Export Recovery Bundle
              </button>
              <button
                onClick={this.handleCopyDiagnostics}
                className="w-full px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
              >
                Copy Diagnostics
              </button>
              <button
                onClick={this.handleSafeMode}
                className="w-full px-4 py-2 text-sm rounded bg-amber-700 hover:bg-amber-600 text-white font-medium"
              >
                Restart in Safe Mode
              </button>

              <div className="bg-slate-800 border border-yellow-700/30 rounded p-3">
                <p className="text-xs text-yellow-400/90 mb-2">
                  <strong>Factory Reset (clears all data):</strong>
                </p>
                <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                  <li>Reload the page</li>
                  <li>Open Settings (Ctrl+,)</li>
                  <li>Go to Filesystem Data</li>
                  <li>Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-red-400">F</kbd></li>
                  <li>Type <strong className="text-white">RESET</strong> and confirm</li>
                </ol>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4 text-center">
              If this problem persists, please report it on GitHub.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
