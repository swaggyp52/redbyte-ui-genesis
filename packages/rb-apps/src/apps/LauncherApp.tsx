// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useState, useEffect } from 'react';
import { Launcher } from '../Launcher';
import { getAppsForLauncher } from '../launcherData';
import type { RedByteApp } from '../types';

interface LauncherComponentProps {
  onOpenApp?: (id: string, props?: any) => void;
  onClose?: () => void;
  recentAppIds?: string[];
  pinnedAppIds?: string[];
  onTogglePin?: (id: string) => void;
  runningAppIds?: string[];
}

const LauncherComponent: React.FC<LauncherComponentProps> = ({
  onOpenApp,
  onClose,
  recentAppIds,
  pinnedAppIds,
  onTogglePin,
  runningAppIds,
}) => {
  const [apps, setApps] = useState<Array<{ id: string; name: string }>>([]);

  // Lazy load app list from registry to avoid circular imports
  useEffect(() => {
    (async () => {
      const launcherApps = await getAppsForLauncher();
      setApps(launcherApps);
    })();
  }, []);

  const recentApps = useMemo(() => {
    if (!recentAppIds?.length) return [];

    const lookup = new Map(apps.map((app) => [app.id, app]));
    return recentAppIds
      .map((id) => lookup.get(id))
      .filter((app): app is { id: string; name: string } => !!app);

  }, [apps, recentAppIds]);

  const pinnedApps = useMemo(() => {
    if (!pinnedAppIds?.length) return [];

    const lookup = new Map(apps.map((app) => [app.id, app]));
    return pinnedAppIds
      .map((id) => lookup.get(id))
      .filter((app): app is { id: string; name: string } => !!app)
      .filter((app) => app.id !== 'launcher');
  }, [apps, pinnedAppIds]);

  return (
    <Launcher
      apps={apps}
      recentApps={recentApps}
      pinnedApps={pinnedApps}
      runningAppIds={runningAppIds}
      onTogglePin={onTogglePin}
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
