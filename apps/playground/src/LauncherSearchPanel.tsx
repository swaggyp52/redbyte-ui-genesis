import React, { useMemo, useState } from 'react';
import { executeLauncherAction, type LauncherActionId } from './launcherActions';

interface LauncherAction {
  id: LauncherActionId;
  label: string;
  description: string;
}

const ACTIONS: LauncherAction[] = [
  {
    id: 'open-settings',
    label: 'Open Settings',
    description: 'Launch the Settings app to adjust preferences.',
  },
  {
    id: 'open-docs',
    label: 'Open Docs',
    description: 'Read RedByte documentation in-app or in a new tab.',
  },
  {
    id: 'create-project',
    label: 'Create Project',
    description: 'Start a new project (coming soon).',
  },
];

export function LauncherSearchPanel() {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter(
      (action) =>
        action.label.toLowerCase().includes(q) ||
        action.description.toLowerCase().includes(q)
    );
  }, [query]);

  const handleExecute = (actionId: LauncherActionId) => {
    executeLauncherAction(actionId);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (filtered.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const action = filtered[activeIndex];
      if (action) {
        handleExecute(action.id);
      }
    }
  };

  return (
    <div className="fixed top-4 left-4 z-[1000] w-80 rounded-2xl border border-slate-800 bg-slate-950/90 text-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <span className="text-sm font-semibold">Launcher Search</span>
        <span className="ml-auto text-xs text-slate-400">Type + Enter</span>
      </div>
      <div className="p-4">
        <input
          aria-label="Launcher search"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          placeholder="Search actions..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="mt-3 flex flex-col gap-2" role="list">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">
              No matching actions.
            </div>
          )}
          {filtered.map((action, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={action.id}
                role="listitem"
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition focus:outline-none ${
                  isActive
                    ? 'border-sky-500 bg-slate-800 ring-2 ring-sky-500/40'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleExecute(action.id)}
                data-testid={`launcher-action-${action.id}`}
              >
                <div className="font-semibold leading-tight">{action.label}</div>
                <div className="text-xs text-slate-400">{action.description}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
