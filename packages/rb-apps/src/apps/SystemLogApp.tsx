// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useState } from 'react';
import type { RedByteApp } from '../types';
import { useSystemLogStore } from '../stores/systemLogStore';
import { Icon } from '@redbyte/rb-icons';

type LogFilter = 'all' | 'action' | 'info' | 'warning' | 'error';

const levelStyles: Record<string, string> = {
  action: 'text-cyan-300',
  info: 'text-slate-300',
  warning: 'text-amber-300',
  error: 'text-red-300',
};

const SystemLogComponent: React.FC = () => {
  const entries = useSystemLogStore((state) => state.entries);
  const markRead = useSystemLogStore((state) => state.markRead);
  const exportLog = useSystemLogStore((state) => state.exportLog);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    markRead();
  }, [markRead]);

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.level !== filter) return false;
      if (!lowered) return true;
      return (
        entry.message.toLowerCase().includes(lowered) ||
        entry.source.toLowerCase().includes(lowered) ||
        (entry.data ? JSON.stringify(entry.data).toLowerCase().includes(lowered) : false)
      );
    });
  }, [entries, filter, query]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-white">System Log</div>
          <div className="text-xs text-slate-500 uppercase tracking-[0.2em]">Append-only audit surface</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportLog}
            className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-semibold hover:border-slate-500"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by source, message, or data..."
            className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            aria-label="Filter system log"
          />
          <span className="absolute right-3 top-2.5 text-slate-500">
            <Icon name="search" size={16} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'action', 'info', 'warning', 'error'] as LogFilter[]).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2.5 py-1 rounded-md text-[11px] uppercase tracking-[0.12em] border ${
                filter === level
                  ? 'border-cyan-500 text-cyan-200 bg-cyan-500/10'
                  : 'border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No log entries yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-900">
            {filtered.map((entry) => (
              <div key={entry.id} className="px-5 py-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono">#{entry.seq.toString().padStart(4, '0')}</span>
                  <span className={`font-semibold uppercase tracking-[0.12em] ${levelStyles[entry.level]}`}>
                    {entry.level}
                  </span>
                  <span className="text-slate-500 font-mono">{entry.ts_wall}</span>
                  <span className="text-slate-400">[{entry.source}]</span>
                </div>
                <div className="mt-1 text-slate-200">{entry.message}</div>
                {entry.data && (
                  <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-500 bg-slate-900/60 border border-slate-800 rounded-md p-2">
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const SystemLogApp: RedByteApp = {
  manifest: {
    id: 'system-log',
    name: 'System Log',
    iconId: 'log',
    singleton: true,
    category: 'system',
    defaultSize: { width: 760, height: 520 },
    minSize: { width: 620, height: 420 },
  },
  component: SystemLogComponent,
};
