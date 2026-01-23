// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface LauncherAppInfo {
  id: string;
  name: string;
}

export interface LauncherProps {
  apps?: LauncherAppInfo[];
  recentApps?: LauncherAppInfo[];
  pinnedApps?: LauncherAppInfo[];
  runningAppIds?: string[];
  onLaunch?: (id: string) => void;
  onClose?: () => void;
  onTogglePin?: (id: string) => void;
}

export const Launcher: React.FC<LauncherProps> = ({
  apps = [],
  recentApps = [],
  pinnedApps = [],
  runningAppIds = [],
  onLaunch,
  onClose,
  onTogglePin,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const selectedRef = useRef<HTMLDivElement | null>(null);

  const hasQuery = Boolean(query);

  const filteredApps = useMemo(() => {
    if (!hasQuery) return apps;

    const lowered = query.toLowerCase();
    return apps.filter((app) => app.name.toLowerCase().includes(lowered));
  }, [apps, hasQuery, query]);

  const hasSettings = useMemo(() => apps.some((app) => app.id === 'settings'), [apps]);
  const runningIds = useMemo(() => new Set(runningAppIds), [runningAppIds]);

  const pinnedList = useMemo(() => {
    const deduped = new Map<string, LauncherAppInfo>();

    pinnedApps.forEach((app) => {
      if (app.id === 'launcher') return;
      if (hasQuery && !app.name.toLowerCase().includes(query.toLowerCase())) return;
      deduped.set(app.id, app);
    });

    return Array.from(deduped.values());
  }, [hasQuery, pinnedApps, query]);

  const pinnedIds = useMemo(() => new Set(pinnedList.map((app) => app.id)), [pinnedList]);

  const recentList = useMemo(() => {
    if (hasQuery) return [];

    const deduped = new Map<string, LauncherAppInfo>();

    recentApps.forEach((app) => {
      if (app.id === 'launcher') return;
      if (pinnedIds.has(app.id)) return;
      deduped.set(app.id, app);
    });

    return Array.from(deduped.values());
  }, [hasQuery, pinnedIds, recentApps]);

  const filteredAllApps = useMemo(() => {
    const recentIds = new Set(recentList.map((app) => app.id));
    return filteredApps.filter((app) => !pinnedIds.has(app.id) && !recentIds.has(app.id));
  }, [filteredApps, pinnedIds, recentList]);

  const showRecents = recentList.length > 0;

  const navigableApps = useMemo(() => {
    const combined = [...pinnedList];
    if (showRecents) {
      combined.push(...recentList);
    }
    combined.push(...filteredAllApps);
    return combined;
  }, [filteredAllApps, pinnedList, recentList, showRecents]);

  useEffect(() => {
    if (navigableApps.length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex((prev) => {
      if (hasQuery) return 0;
      return Math.min(prev, navigableApps.length - 1);
    });
  }, [hasQuery, navigableApps.length]);

  useEffect(() => {
    selectedRef.current?.focus();
  }, [selectedIndex, navigableApps.length]);

  const handleLaunch = (id: string) => {
    onLaunch?.(id);
    if (onClose) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const isEditable =
      tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;

    if (key === '?' && !ctrlKey && !metaKey && !altKey) {
      event.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }

    if (key === 'Backspace') {
      if (query) {
        event.preventDefault();
        setQuery((prev) => prev.slice(0, -1));
      }
      return;
    }

    if ((ctrlKey || metaKey) && key === ',' && hasSettings && !altKey && !shiftKey) {
      if (isEditable) return;
      event.preventDefault();
      handleLaunch('settings');
      return;
    }

    if (key === 'Escape') {
      if (query) {
        event.preventDefault();
        setQuery('');
        return;
      }

      onClose?.();
      return;
    }

    if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
      setQuery((prev) => prev + key);
      return;
    }

    if (navigableApps.length === 0) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, navigableApps.length - 1));
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      const selected = navigableApps[selectedIndex];
      if (selected) {
        handleLaunch(selected.id);
      }
    }
  };

  const renderAppButton = (app: LauncherAppInfo, index: number, isPinned: boolean) => {
    const isSelected = index === selectedIndex;
    return (
      <div
        key={app.id}
        className={`flex items-center justify-between gap-2 p-2 rounded mb-1 border border-transparent transition-colors ${isSelected
          ? 'bg-slate-800 border-blue-500/50'
          : 'hover:bg-slate-800/50'
          }`}
      >
        <button
          ref={isSelected ? selectedRef : undefined}
          tabIndex={isSelected ? 0 : -1}
          onClick={() => handleLaunch(app.id)}
          className="flex-1 text-left bg-transparent border-0 outline-none focus:outline-none cursor-pointer"
          aria-current={isSelected ? 'true' : undefined}
        >
          <span className="text-sm font-medium text-slate-200">
            {app.name} {runningIds.has(app.id) && <span className="text-xs text-blue-400 ml-2">(Running)</span>}
          </span>
        </button>
        {onTogglePin && (
          <button
            type="button"
            aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${app.name}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onTogglePin(app.id);
            }}
            tabIndex={isSelected ? 0 : -1}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${isPinned
              ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 hover:bg-blue-500/20'
              : 'border-slate-600 text-slate-500 hover:border-slate-500 hover:text-slate-400'
              }`}
          >
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="App Launcher"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="p-4 h-full overflow-y-auto bg-slate-900 text-slate-200 focus:outline-none"
    >
      <h2 className="text-lg font-bold text-white mb-4">App Launcher</h2>

      {showHelp && (
        <div className="mb-4 bg-slate-800 p-3 rounded border border-slate-700">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Keyboard Shortcuts</h3>
          <ul className="text-xs space-y-1 text-slate-300">
            <li><kbd className="bg-slate-700 px-1 rounded">↑</kbd> <kbd className="bg-slate-700 px-1 rounded">↓</kbd> Move selection</li>
            <li><kbd className="bg-slate-700 px-1 rounded">Enter</kbd> Launch app</li>
            <li><kbd className="bg-slate-700 px-1 rounded">Esc</kbd> Clear search / Close</li>
            <li><kbd className="bg-slate-700 px-1 rounded">?</kbd> Toggle help</li>
          </ul>
        </div>
      )}

      {query && (
        <div className="mb-4 px-2 py-1.5 bg-slate-800 border border-blue-500 rounded text-sm text-white">
          <span className="text-slate-500 mr-2">Search:</span>
          {query}
        </div>
      )}

      {pinnedList.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pinned</h3>
          {pinnedList.map((app, index) => renderAppButton(app, index, true))}
        </div>
      )}

      {showRecents && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent</h3>
          {recentList.map((app, index) => renderAppButton(app, index + pinnedList.length, false))}
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">All Apps</h3>
        {hasQuery && pinnedList.length === 0 && filteredAllApps.length === 0 && (
          <p className="text-sm text-slate-500 italic px-2">No matches found</p>
        )}
        {!hasQuery && apps.length === 0 && pinnedList.length === 0 && recentList.length === 0 && (
          <p className="text-sm text-slate-500 italic px-2">No apps registered</p>
        )}
        {filteredAllApps.map((app, index) =>
          renderAppButton(
            app,
            index + pinnedList.length + (showRecents ? recentList.length : 0),
            pinnedIds.has(app.id)
          )
        )}

        {hasSettings && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <button
              type="button"
              title="Open Settings (Ctrl+, / Cmd+,)"
              aria-label="Open Settings"
              onClick={() => handleLaunch('settings')}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded text-sm text-slate-300 transition-colors"
            >
              <span>Open Settings</span>
              <span className="text-xs text-slate-500">Ctrl+,</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
