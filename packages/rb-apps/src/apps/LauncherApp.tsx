// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { Launcher } from '../Launcher';
import { getAppsForLauncher } from '../launcherData';
import type { RedByteApp } from '../types';

interface LauncherComponentProps {
  onOpenApp?: (id: string, props?: any) => void;
  onClose?: () => void;
  recentAppIds?: string[];
}

const LauncherComponent: React.FC<LauncherComponentProps> = ({ onOpenApp, onClose, recentAppIds }) => {
  const apps = useMemo(() => getAppsForLauncher(), []);

  const recentApps = useMemo(() => {
    if (!recentAppIds?.length) return [];

    const lookup = new Map(apps.map((app) => [app.id, app]));
    return recentAppIds.map((id) => lookup.get(id)).filter(Boolean);
  }, [apps, recentAppIds]);

  return (
    <Launcher
      apps={apps}
      recentApps={recentApps}
      onLaunch={(id) => onOpenApp?.(id)}
      onClose={onClose}
    />
  );
};

export const LauncherApp: RedByteApp = {
  manifest: {
    id: 'launcher',
    name: 'Launcher',
    iconId: 'browser',
    category: 'system',
    singleton: true,
    defaultSize: { width: 640, height: 480 },
    minSize: { width: 480, height: 360 },
  },
  component: LauncherComponent,
};
