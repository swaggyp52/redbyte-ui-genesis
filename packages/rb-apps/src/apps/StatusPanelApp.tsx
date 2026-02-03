// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import type { RedByteApp } from '../types';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { useCircuitStore } from '../stores/circuitStore';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
import { useSystemLogStore } from '../stores/systemLogStore';
import { loadSnapshot } from '../utils/snapshotSystem';
import { useClassroomModeStore } from '../stores/classroomModeStore';

interface StatusPanelProps {
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
}

const StatusPanelComponent: React.FC<StatusPanelProps> = ({ onOpenApp }) => {
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

  return (
    <div className="h-full w-full bg-slate-950 text-slate-200 flex flex-col">
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="text-lg font-semibold text-white">Status Panel</div>
        <div className="text-xs text-slate-500 uppercase tracking-[0.2em]">TA triage overview</div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Project</div>
            <div className="text-sm text-slate-100 mt-1">{project?.name ?? 'No project loaded'}</div>
            <div className="text-[11px] text-slate-400 mt-1">Nodes: {nodeCount} · Connections: {connectionCount}</div>
            <div className="text-[11px] text-slate-400">Export ready: {exportReady ? 'Yes' : 'No'}</div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Autosave</div>
            <div className="text-sm text-slate-100 mt-1">Last snapshot: {lastAutosave}</div>
            <div className="text-[11px] text-slate-400">Safe Mode: {safeMode ? 'On' : 'Off'}</div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Hardware</div>
            <div className="text-sm text-slate-100 mt-1">Bridge: {bridge.status}</div>
            <div className="text-[11px] text-slate-400">Basys3: {hardwareStatus}</div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Warnings</div>
            <div className="text-sm text-slate-100 mt-1">Errors: {logSummary.errors}</div>
            <div className="text-[11px] text-slate-400">Warnings: {logSummary.warnings}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => onOpenApp?.('logic-playground')}
            className="w-full px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold"
          >
            Open Logic Playground
          </button>
          <button
            type="button"
            onClick={() => onOpenApp?.('hardware-panel')}
            className="w-full px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
          >
            Open Hardware Panel
          </button>
          <button
            type="button"
            onClick={() => onOpenApp?.('system-log')}
            className="w-full px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
          >
            Open System Log
          </button>
        </div>
      </div>
    </div>
  );
};

export const StatusPanelApp: RedByteApp = {
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
