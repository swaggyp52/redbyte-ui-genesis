import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useMemo } from 'react';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { useCircuitStore } from '../stores/circuitStore';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
import { useSystemLogStore } from '../stores/systemLogStore';
import { loadSnapshot } from '../utils/snapshotSystem';
import { useClassroomModeStore } from '../stores/classroomModeStore';
const StatusPanelComponent = ({ onOpenApp }) => {
    const project = useUnifiedProjectStore((s) => s.currentProject);
    const circuit = useCircuitStore((s) => s.circuit);
    const { bridge, sessions } = useHardwareSessionStore();
    const logs = useSystemLogStore((s) => s.entries);
    const { safeMode } = useClassroomModeStore();
    const lastSnapshot = loadSnapshot();
    const lastAutosave = lastSnapshot ? new Date(lastSnapshot.timestamp).toLocaleString() : 'Unknown';
    const nodeCount = circuit.nodes.length;
    const connectionCount = circuit.connections.length;
    const exportReady = nodeCount > 0;
    const logSummary = useMemo(() => {
        const errors = logs.filter((entry) => entry.level === 'error').length;
        const warnings = logs.filter((entry) => entry.level === 'warning').length;
        return { errors, warnings };
    }, [logs]);
    const hardwareStatus = sessions.basys3.status === 'connected'
        ? `Connected (${sessions.basys3.port ?? 'unknown'})`
        : sessions.basys3.status === 'connecting'
            ? 'Connecting'
            : sessions.basys3.status === 'reconnecting'
                ? 'Reconnecting'
                : sessions.basys3.status === 'error'
                    ? 'Error'
                    : 'Disconnected';
    return (_jsxs("div", { className: "h-full w-full bg-slate-950 text-slate-200 flex flex-col", children: [_jsxs("div", { className: "px-5 py-4 border-b border-slate-800", children: [_jsx("div", { className: "text-lg font-semibold text-white", children: "Status Panel" }), _jsx("div", { className: "text-xs text-slate-500 uppercase tracking-[0.2em]", children: "TA triage overview" })] }), _jsxs("div", { className: "flex-1 overflow-auto p-5 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-3", children: [_jsxs("div", { className: "rounded-lg border border-slate-800 bg-slate-900/40 p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Project" }), _jsx("div", { className: "text-sm text-slate-100 mt-1", children: project?.name ?? 'No project loaded' }), _jsxs("div", { className: "text-[11px] text-slate-400 mt-1", children: ["Nodes: ", nodeCount, " \u00B7 Connections: ", connectionCount] }), _jsxs("div", { className: "text-[11px] text-slate-400", children: ["Export ready: ", exportReady ? 'Yes' : 'No'] })] }), _jsxs("div", { className: "rounded-lg border border-slate-800 bg-slate-900/40 p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Autosave" }), _jsxs("div", { className: "text-sm text-slate-100 mt-1", children: ["Last snapshot: ", lastAutosave] }), _jsxs("div", { className: "text-[11px] text-slate-400", children: ["Safe Mode: ", safeMode ? 'On' : 'Off'] })] }), _jsxs("div", { className: "rounded-lg border border-slate-800 bg-slate-900/40 p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Hardware" }), _jsxs("div", { className: "text-sm text-slate-100 mt-1", children: ["Bridge: ", bridge.status] }), _jsxs("div", { className: "text-[11px] text-slate-400", children: ["Basys3: ", hardwareStatus] })] }), _jsxs("div", { className: "rounded-lg border border-slate-800 bg-slate-900/40 p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Warnings" }), _jsxs("div", { className: "text-sm text-slate-100 mt-1", children: ["Errors: ", logSummary.errors] }), _jsxs("div", { className: "text-[11px] text-slate-400", children: ["Warnings: ", logSummary.warnings] })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-2", children: [_jsx("button", { type: "button", onClick: () => onOpenApp?.('logic-playground'), className: "w-full px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold", children: "Open Logic Playground" }), _jsx("button", { type: "button", onClick: () => onOpenApp?.('hardware-panel'), className: "w-full px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold", children: "Open Hardware Panel" }), _jsx("button", { type: "button", onClick: () => onOpenApp?.('system-log'), className: "w-full px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold", children: "Open System Log" })] })] })] }));
};
export const StatusPanelApp = {
    manifest: {
        id: 'status-panel',
        name: 'Status Panel',
        iconId: 'log',
        defaultSize: { width: 420, height: 520 },
        minSize: { width: 360, height: 420 },
        singleton: true,
        category: 'system',
    },
    component: StatusPanelComponent,
};
