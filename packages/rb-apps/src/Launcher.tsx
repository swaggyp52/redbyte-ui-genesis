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
  onLaunch?: (id: string) => void;
  onClose?: () => void;
  onTogglePin?: (id: string) => void;
}

export const Launcher: React.FC<LauncherProps> = ({
  apps = [],
  recentApps = [],
  pinnedApps = [],
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
    const { key, ctrlKey, metaKey, altKey } = event;

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
        role="option"
        aria-selected={isSelected}
        ref={isSelected ? selectedRef : undefined}
        tabIndex={-1}
        style={{
          margin: '0.5rem 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          textAlign: 'left',
          backgroundColor: isSelected ? '#1b1b1b' : 'transparent',
          borderColor: isSelected ? '#5b8cff' : undefined,
          padding: '0.5rem',
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: 4,
        }}
        onClick={() => handleLaunch(app.id)}
      >
        <span>{app.name}</span>
        {onTogglePin && (
          <button
            type="button"
            aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${app.name}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onTogglePin(app.id);
            }}
            style={{
              background: 'transparent',
              color: '#9fb0ff',
              border: '1px solid #9fb0ff',
              borderRadius: 4,
              padding: '0.15rem 0.35rem',
              cursor: 'pointer',
            }}
          >
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      role="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ padding: '1rem', color: '#fff' }}
    >
      <h2>App Launcher</h2>
      {showHelp && (
        <div style={{ marginBottom: '0.75rem' }}>
          <h3>Help</h3>
          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
            <li>Up / Down: Move selection</li>
            <li>Enter: Launch selected app (closes launcher)</li>
            <li>Escape: Clear search or close launcher</li>
            <li>Typing: Filter apps by name</li>
            <li>Backspace: Remove last search character</li>
            <li>Pin buttons: Pin or unpin without launching</li>
            <li>?: Toggle this help</li>
          </ul>
        </div>
      )}
      {query && <p>Search: {query}</p>}
      {pinnedList.length > 0 && (
        <div>
          <h3>Pinned</h3>
          {pinnedList.map((app, index) => renderAppButton(app, index, true))}
        </div>
      )}

      {showRecents && (
        <div>
          <h3>Recent</h3>
          {recentList.map((app, index) => renderAppButton(app, index + pinnedList.length, false))}
        </div>
      )}

      <div>
        <h3>All apps</h3>
        {hasQuery && pinnedList.length === 0 && filteredAllApps.length === 0 && <p>No matches</p>}
        {!hasQuery && apps.length === 0 && pinnedList.length === 0 && recentList.length === 0 && (
          <p>No apps registered</p>
        )}
        {filteredAllApps.map((app, index) =>
          renderAppButton(
            app,
            index + pinnedList.length + (showRecents ? recentList.length : 0),
            pinnedIds.has(app.id)
          )
        )}
      </div>
    </div>
  );
};
