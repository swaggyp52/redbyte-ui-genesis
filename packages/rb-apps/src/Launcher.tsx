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
  onLaunch?: (id: string) => void;
}

export const Launcher: React.FC<LauncherProps> = ({ apps = [], onLaunch }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  const filteredApps = useMemo(() => {
    if (!query) return apps;

    const lowered = query.toLowerCase();
    return apps.filter(app => app.name.toLowerCase().includes(lowered));
  }, [apps, query]);

  useEffect(() => {
    if (filteredApps.length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex(prev => {
      if (query) return 0;
      return Math.min(prev, filteredApps.length - 1);
    });
  }, [filteredApps.length, query]);

  useEffect(() => {
    selectedRef.current?.focus();
  }, [selectedIndex, filteredApps.length]);

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
    }

    if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
      setQuery(prev => prev + key);
      return;
    }

    if (filteredApps.length === 0) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredApps.length - 1));
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      const selected = filteredApps[selectedIndex];
      if (selected) {
        onLaunch?.(selected.id);
      }
    }
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
      {filteredApps.length === 0 && <p>No matches</p>}
      {!query && apps.length === 0 && <p>No apps registered</p>}
      {filteredApps.map((app, index) => {
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
      })}
    </div>
  );
};
