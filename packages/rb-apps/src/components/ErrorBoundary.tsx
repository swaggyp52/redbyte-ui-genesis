/**
 * ERROR BOUNDARY for PHASE 2A
 * 
 * Catches errors thrown by the runaway loop watchdog and displays them
 * with diagnostic information. Ensures test failures are explicit and fast,
 * not timeout-based.
 */

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for Playwright to capture with RB_FATAL prefix
    const msg = `RB_FATAL: ${error.message}`;
    console.error(msg);
    console.error('Stack:', error.stack);
    
    // If this is a watchdog error, mark it clearly
    if (error.message.includes('RB_RUNAWAY_LOOP_DETECTED')) {
      console.error('[WATCHDOG_CAUGHT]', error.message);
    }
    
    // Set global flag for test inspection
    if (typeof window !== 'undefined') {
      (window as any).__RB_ERROR_BOUNDARY_HIT__ = {
        timestamp: Date.now(),
        error: error.message,
        errorInfo,
      };
    }
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      
      return (
        <div className="h-full flex items-center justify-center bg-gray-900 text-white p-8">
          <div className="max-w-lg text-center">
            <h2 className="text-2xl font-bold mb-4 text-red-400">
              Application Error
            </h2>
            {isDev && this.state.error && (
              <>
                <p className="mb-2 text-sm font-mono bg-gray-800 p-4 rounded text-left overflow-auto max-h-40">
                  {this.state.error.message}
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  Check console for full stack trace
                </p>
              </>
            )}
            {!isDev && (
              <p className="mb-4">
                An unexpected error occurred. Please refresh the page.
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
