// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { Launcher } from '../Launcher';
import { getAppsForLauncher } from '../launcherData';
import type { RedByteApp } from '../types';

interface LauncherComponentProps {
  onOpenApp?: (id: string, props?: any) => void;
}

const LauncherComponent: React.FC<LauncherComponentProps> = ({ onOpenApp }) => {
  const apps = useMemo(() => getAppsForLauncher(), []);
  return <Launcher apps={apps} onLaunch={(id) => onOpenApp?.(id)} />;
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
