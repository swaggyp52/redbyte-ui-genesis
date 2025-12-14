// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (apps.length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex(prev => Math.min(prev, apps.length - 1));
  }, [apps.length]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (apps.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, apps.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = apps[selectedIndex];
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
      {apps.length === 0 && <p>No apps registered</p>}
      {apps.map((app, index) => {
        const isSelected = index === selectedIndex;
        return (
        <button
          key={app.id}
          role="option"
          aria-selected={isSelected}
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
