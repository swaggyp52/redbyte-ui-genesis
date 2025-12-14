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
  onLaunch?: (id: string) => void;
  onClose?: () => void;
}

export const Launcher: React.FC<LauncherProps> = ({ apps = [], recentApps = [], onLaunch, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  const hasQuery = Boolean(query);

  const filteredApps = useMemo(() => {
    if (!hasQuery) return apps;

    const lowered = query.toLowerCase();
    return apps.filter((app) => app.name.toLowerCase().includes(lowered));
  }, [apps, hasQuery, query]);

  const recentList = useMemo(() => {
    const deduped = new Map<string, LauncherAppInfo>();

    recentApps.forEach((app) => {
      if (app.id === 'launcher') return;
      deduped.set(app.id, app);
    });

    return Array.from(deduped.values());
  }, [recentApps]);

  const showRecents = !hasQuery && recentList.length > 0;

  const allAppsList = useMemo(() => {
    if (!showRecents) return filteredApps;

    const recentIds = new Set(recentList.map((app) => app.id));
    return filteredApps.filter((app) => !recentIds.has(app.id));
  }, [filteredApps, recentList, showRecents]);

  const navigableApps = useMemo(() => {
    if (showRecents) {
      return [...recentList, ...allAppsList];
    }

    return allAppsList;
  }, [allAppsList, recentList, showRecents]);

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key, ctrlKey, metaKey, altKey } = event;

    if (key === 'Backspace') {
      if (query) {
        event.preventDefault();
        setQuery(prev => prev.slice(0, -1));
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
      setQuery(prev => prev + key);
      return;
    }

    if (navigableApps.length === 0) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, navigableApps.length - 1));
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      const selected = navigableApps[selectedIndex];
      if (selected) {
        onLaunch?.(selected.id);
      }
    }
  };

  const renderAppButton = (app: LauncherAppInfo, index: number) => {
    const isSelected = index === selectedIndex;
    return (
      <button
        key={app.id}
        role="option"
        aria-selected={isSelected}
        ref={isSelected ? selectedRef : undefined}
        style={{
          margin: '0.5rem 0',
          display: 'block',
          textAlign: 'left',
          backgroundColor: isSelected ? '#1b1b1b' : 'transparent',
          borderColor: isSelected ? '#5b8cff' : undefined,
        }}
        onClick={() => onLaunch?.(app.id)}
      >
        {app.name}
      </button>
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
      {query && <p>Search: {query}</p>}
      {showRecents && (
        <div>
          <h3>Recent</h3>
          {recentList.map((app, index) => renderAppButton(app, index))}
        </div>
      )}

      <div>
        <h3>All apps</h3>
        {hasQuery && allAppsList.length === 0 && <p>No matches</p>}
        {!hasQuery && apps.length === 0 && <p>No apps registered</p>}
        {(!hasQuery || allAppsList.length > 0) &&
          allAppsList.map((app, index) =>
            renderAppButton(app, showRecents ? index + recentList.length : index)
          )}
      </div>
    </div>
  );
};
