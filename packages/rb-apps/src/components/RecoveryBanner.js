import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Recovery banner for abnormal shutdowns
import React from 'react';
import { loadSnapshot, clearFatalMarkers } from '../utils/snapshotSystem';
export const RecoveryBanner = ({ onRecover, onStartFresh }) => {
    const [showDetails, setShowDetails] = React.useState(false);
    const snapshot = loadSnapshot();
    return (_jsxs("div", { className: "bg-yellow-900 text-yellow-50 px-4 py-3 border-b border-yellow-700", "data-testid": "recovery-banner", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-lg", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-sm", children: "RedByte didn't close cleanly last time." }), _jsx("div", { className: "text-xs text-yellow-200 mt-0.5", children: snapshot ? 'Recover last session?' : 'No snapshot available.' })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [snapshot && (_jsx("button", { onClick: () => {
                                    onRecover();
                                    clearFatalMarkers();
                                }, className: "px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-semibold transition-all", "data-testid": "recovery-recover-button", children: "Recover" })), _jsx("button", { onClick: () => {
                                    onStartFresh();
                                    clearFatalMarkers();
                                }, className: "px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white rounded text-xs font-semibold transition-all", "data-testid": "recovery-start-fresh-button", children: "Start Fresh" }), _jsx("button", { onClick: () => setShowDetails(!showDetails), className: "px-3 py-1.5 bg-yellow-800 hover:bg-yellow-700 text-white rounded text-xs transition-all", "data-testid": "recovery-details-button", children: showDetails ? 'Hide Details' : 'Details' })] })] }), showDetails && snapshot && (_jsxs("div", { className: "mt-3 pt-3 border-t border-yellow-700 text-xs text-yellow-100 font-mono", children: [_jsxs("div", { children: [_jsx("strong", { children: "Timestamp:" }), " ", new Date(snapshot.timestamp).toLocaleString()] }), _jsxs("div", { children: [_jsx("strong", { children: "Reason:" }), " ", snapshot.reason] }), _jsxs("div", { children: [_jsx("strong", { children: "Schema:" }), " v", snapshot.schemaVersion] }), _jsxs("div", { children: [_jsx("strong", { children: "Safe Mode:" }), " ", snapshot.payload.flags.safeMode ? 'Yes' : 'No'] })] }))] }));
};
