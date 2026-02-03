import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Classroom guardrail feedback banners
import { useState } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { useClassroomModeStore } from '../stores/classroomModeStore';
export const ClassroomModeBanner = () => {
    const lastClampEvent = useCircuitStore((s) => s.lastClampEvent);
    const clearClampEvent = useCircuitStore((s) => s.clearClampEvent);
    const nodeCount = useClassroomModeStore((s) => s.nodeCount);
    const safeMode = useClassroomModeStore((s) => s.safeMode);
    const isStepOnlyMode = useClassroomModeStore((s) => s.isStepOnlyMode);
    const [showDetails, setShowDetails] = useState(false);
    // Auto-degrade banner: workspace exceeds limits (from undo or old save)
    const exceeds = nodeCount > 20;
    // Clamp banner: circuit was clamped during load/paste
    const showClampBanner = !!lastClampEvent;
    if (!exceeds && !showClampBanner) {
        return null;
    }
    if (showClampBanner && lastClampEvent) {
        const dropped = lastClampEvent.originalNodes - lastClampEvent.keptNodes;
        return (_jsxs("div", { className: "bg-yellow-900 text-yellow-50 px-4 py-2 text-sm border-b border-yellow-700", "data-testid": "clamp-banner", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { children: [_jsx("strong", { children: "\u26A0\uFE0F Circuit too large:" }), " Loaded ", lastClampEvent.keptNodes, " of ", lastClampEvent.originalNodes, " nodes (dropped ", dropped, ")."] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setShowDetails(!showDetails), className: "text-yellow-200 hover:text-yellow-100 underline text-xs", children: showDetails ? 'Hide' : 'Details' }), _jsx("button", { onClick: clearClampEvent, className: "text-yellow-200 hover:text-yellow-100 text-xs px-2 py-1 border border-yellow-600 rounded", children: "Dismiss" })] })] }), showDetails && (_jsxs("div", { className: "mt-2 text-xs bg-yellow-950 p-2 rounded border border-yellow-800", children: [_jsxs("div", { children: [_jsx("strong", { children: "Source:" }), " ", lastClampEvent.source] }), _jsxs("div", { children: [_jsx("strong", { children: "Original nodes:" }), " ", lastClampEvent.originalNodes] }), _jsxs("div", { children: [_jsx("strong", { children: "Kept nodes:" }), " ", lastClampEvent.keptNodes] }), _jsxs("div", { children: [_jsx("strong", { children: "Dropped:" }), " ", dropped] }), _jsx("div", { className: "mt-1 opacity-75", children: "Classroom limit is 20 nodes. First 20 nodes were kept; remaining nodes and orphaned connections were removed." })] }))] }));
    }
    if (exceeds) {
        return (_jsxs("div", { className: "bg-red-900 text-red-50 px-4 py-2 text-sm border-b border-red-700", "data-testid": "auto-degrade-banner", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { children: [_jsxs("strong", { children: ["\uD83D\uDEE1\uFE0F Workspace exceeds classroom limits (", nodeCount, " nodes)."] }), " Safe Mode + Step-only enabled."] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx("button", { onClick: () => setShowDetails(!showDetails), className: "text-red-200 hover:text-red-100 underline text-xs", children: showDetails ? 'Hide' : 'Details' }) })] }), showDetails && (_jsxs("div", { className: "mt-2 text-xs bg-red-950 p-2 rounded border border-red-800", children: [_jsxs("div", { children: [_jsx("strong", { children: "Current nodes:" }), " ", nodeCount] }), _jsxs("div", { children: [_jsx("strong", { children: "Classroom limit:" }), " 20 nodes"] }), _jsxs("div", { children: [_jsx("strong", { children: "Safe Mode:" }), " ", safeMode ? 'ON' : 'OFF'] }), _jsxs("div", { children: [_jsx("strong", { children: "Step-only:" }), " ", isStepOnlyMode ? 'ON' : 'OFF'] }), _jsx("div", { className: "mt-1 opacity-75", children: "This workspace has more than 20 nodes (likely from undo or an old saved circuit). Heavy features are disabled. Remove nodes to restore full functionality." })] }))] }));
    }
    return null;
};
