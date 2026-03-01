import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
export class AppErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { hasError: false, error: null }
        });
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen bg-slate-950 flex items-center justify-center p-8", children: _jsxs("div", { className: "max-w-lg text-center space-y-4", children: [_jsx("h1", { className: "text-2xl font-bold text-red-400", children: "Something went wrong" }), _jsx("p", { className: "text-slate-300 text-sm font-mono", children: this.state.error?.message }), _jsx("p", { className: "text-slate-400 text-sm", children: "Your work is auto-saved. Try refreshing the page." }), _jsx("button", { onClick: () => window.location.reload(), className: "px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold", children: "Reload App" })] }) }));
        }
        return _jsx(_Fragment, { children: this.props.children });
    }
}
