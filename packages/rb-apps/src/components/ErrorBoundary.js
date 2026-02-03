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
import styles from './ErrorBoundary.module.css';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
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
            return (_jsx("div", { className: styles.errorBoundary, children: _jsxs("div", { className: styles.errorCard, children: [_jsx("div", { className: styles.errorIcon, children: "\u26A0\uFE0F" }), _jsx("h2", { className: styles.errorTitle, children: title }), _jsx("p", { className: styles.errorMessage, children: isDev && this.state.error
                                ? 'An error occurred during rendering. See details below.'
                                : 'An unexpected error occurred. Please try resetting or reloading the application.' }), _jsxs("div", { className: styles.errorActions, children: [_jsx("button", { onClick: this.handleReset, className: styles.primaryButton, children: "Reset" }), _jsx("button", { onClick: this.handleReload, className: styles.secondaryButton, children: "Reload Page" })] }), isDev && this.state.error && (_jsxs("details", { className: styles.errorDetails, children: [_jsx("summary", { children: "Error Details (Dev Mode)" }), _jsxs("div", { className: styles.errorStack, children: [_jsx("strong", { children: "Message:" }), this.state.error.message, this.state.error.stack && (_jsxs(_Fragment, { children: [_jsx("br", {}), _jsx("br", {}), _jsx("strong", { children: "Stack Trace:" }), this.state.error.stack] })), this.state.errorInfo?.componentStack && (_jsxs(_Fragment, { children: [_jsx("br", {}), _jsx("br", {}), _jsx("strong", { children: "Component Stack:" }), this.state.errorInfo.componentStack] }))] })] }))] }) }));
        }
        return this.props.children;
    }
}
