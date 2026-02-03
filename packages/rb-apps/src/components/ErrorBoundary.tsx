/**
 * ERROR BOUNDARY for Production Robustness (Phase 8)
 * 
 * Provides graceful error handling across all RedByte OS applications.
 * Features:
 * - User-friendly fallback UI with reset/reload options
 * - Development-mode error details with stack traces
 * - Global error flag for test inspection
 * - Runaway loop watchdog detection
 */

import React from 'react';
import { setErrorBoundaryMarker } from '../utils/snapshotSystem';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
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
    console.error('Component stack:', errorInfo.componentStack);

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
      try {
        setErrorBoundaryMarker();
      } catch {
        // Ignore marker failures
      }
    }

    // Store error info for details panel
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const title = this.props.fallbackTitle || 'Application Error';

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorCard}>
            <div className={styles.errorIcon}>WARN</div>
            <h2 className={styles.errorTitle}>{title}</h2>
            <p className={styles.errorMessage}>
              {isDev && this.state.error
                ? 'An error occurred during rendering. See details below.'
                : 'An unexpected error occurred. Please try resetting or reloading the application.'}
            </p>
            
            <div className={styles.errorActions}>
              <button onClick={this.handleReset} className={styles.primaryButton}>
                Reset
              </button>
              <button onClick={this.handleReload} className={styles.secondaryButton}>
                Reload Page
              </button>
            </div>

            {isDev && this.state.error && (
              <details className={styles.errorDetails}>
                <summary>Error Details (Dev Mode)</summary>
                <div className={styles.errorStack}>
                  <strong>Message:</strong>
                  {this.state.error.message}
                  
                  {this.state.error.stack && (
                    <>
                      <br /><br />
                      <strong>Stack Trace:</strong>
                      {this.state.error.stack}
                    </>
                  )}
                  
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <br /><br />
                      <strong>Component Stack:</strong>
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
