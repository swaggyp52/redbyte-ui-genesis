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
  return (
    <div style={{ padding: '1rem', color: '#fff' }}>
      <h2>App Launcher</h2>
      {apps.length === 0 && <p>No apps registered</p>}
      {apps.map(app => (
        <button
          key={app.id}
          style={{ margin: '0.5rem 0', display: 'block', textAlign: 'left' }}
          onClick={() => onLaunch?.(app.id)}
        >
          {app.name}
        </button>
      ))}
    </div>
  );
};
