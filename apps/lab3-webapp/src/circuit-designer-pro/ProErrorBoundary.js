import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { CircuitEditor } from '../circuit-editor';
import useLabStore from '../store/labStore';
/**
 * ProErrorBoundary: Error boundary for Circuit Designer Pro
 * Falls back to Classic circuit editor if Pro crashes
 * Emits pro_crash_fallback event on error
 */
export class ProErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, _errorInfo) {
        // Emit event to store
        const store = useLabStore.getState();
        store.emitEvent('pro_crash_fallback', {
            error: error.toString(),
            message: error.message,
        });
        console.error('Pro crashed:', error);
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { className: "flex flex-col h-full bg-slate-950", children: [_jsxs("div", { className: "bg-red-900 border-b border-red-700 px-4 py-3 text-red-200 text-sm font-tech", children: [_jsx("span", { className: "font-bold", children: "\u26A0\uFE0F Pro crashed" }), " \u2014 fell back to Classic. Error: ", this.state.error?.message] }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsx(CircuitEditor, {}) })] }));
        }
        return _jsx(_Fragment, { children: this.props.children });
    }
}
