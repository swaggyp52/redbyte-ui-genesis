import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, resetNonce: 0 };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
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
            window.__RB_ERROR_BOUNDARY_HIT__ = {
                timestamp: Date.now(),
                error: error.message,
                errorInfo,
            };
            try {
                setErrorBoundaryMarker();
            }
            catch {
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
    handleCopyDetails = async () => {
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
        }
        catch (err) {
            console.error('Failed to copy error details:', err);
        }
    };
    render() {
        if (this.state.hasError) {
            const isDev = import.meta.env.DEV;
            const title = this.props.fallbackTitle || 'Application Error';
            const studentError = toStudentFacingError(this.state.error);
            return (_jsx("div", { className: styles.errorBoundary, children: _jsxs("div", { className: styles.errorCard, children: [_jsx("div", { className: styles.errorIcon, children: "WARN" }), _jsx("h2", { className: styles.errorTitle, children: title }), _jsx("p", { className: styles.errorMessage, children: studentError.message }), _jsxs("div", { className: styles.errorActions, children: [_jsx("button", { onClick: this.handleReset, className: styles.primaryButton, children: "Reload App" }), _jsx("button", { onClick: this.handleCopyDetails, className: styles.secondaryButton, children: "Copy Error Details" }), _jsx("button", { onClick: this.handleReload, className: styles.secondaryButton, children: "Reload Page" })] }), isDev && this.state.error && (_jsxs("details", { className: styles.errorDetails, children: [_jsx("summary", { children: "Error Details (Dev Mode)" }), _jsxs("div", { className: styles.errorStack, children: [_jsx("strong", { children: "Message:" }), this.state.error.message, this.state.error.stack && (_jsxs(_Fragment, { children: [_jsx("br", {}), _jsx("br", {}), _jsx("strong", { children: "Stack Trace:" }), this.state.error.stack] })), this.state.errorInfo?.componentStack && (_jsxs(_Fragment, { children: [_jsx("br", {}), _jsx("br", {}), _jsx("strong", { children: "Component Stack:" }), this.state.errorInfo.componentStack] }))] })] }))] }) }));
        }
        return _jsx("div", { children: this.props.children }, this.state.resetNonce);
    }
}
