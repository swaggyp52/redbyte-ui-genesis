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
import { toStudentFacingError } from '@redbyte/rb-utils';
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
  resetNonce?: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetNonce: 0 };
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
    this.setState((prev) => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      resetNonce: (prev.resetNonce ?? 0) + 1,
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDetails = async (): Promise<void> => {
    try {
      const payload = {
        title: this.props.fallbackTitle || 'Application Error',
        error: this.state.error?.message ?? 'Unknown error',
        stack: this.state.error?.stack ?? null,
        componentStack: this.state.errorInfo?.componentStack ?? null,
      };
      const text = JSON.stringify(payload, null, 2);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const title = this.props.fallbackTitle || 'Application Error';
      const studentError = toStudentFacingError(this.state.error);

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorCard}>
            <div className={styles.errorIcon}>WARN</div>
            <h2 className={styles.errorTitle}>{title}</h2>
            <p className={styles.errorMessage}>
              {studentError.message}
            </p>
            
            <div className={styles.errorActions}>
              <button onClick={this.handleReset} className={styles.primaryButton}>
                Reload App
              </button>
              <button onClick={this.handleCopyDetails} className={styles.secondaryButton}>
                Copy Error Details
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

    return <div key={this.state.resetNonce}>{this.props.children}</div>;
  }
}
