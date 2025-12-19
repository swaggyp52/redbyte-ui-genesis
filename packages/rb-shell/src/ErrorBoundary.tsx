// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { Component, ErrorInfo, ReactNode } from 'react';

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
 * 2. Factory Reset hint (Settings → Filesystem Data → F → type RESET)
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
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
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
                  {this.state.error.message}
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
