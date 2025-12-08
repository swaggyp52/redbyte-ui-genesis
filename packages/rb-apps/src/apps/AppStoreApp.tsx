// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { listApps, type RedByteApp } from '../AppRegistry';
import type { RedByteApp as RedByteAppType } from '../types';
import {
  TerminalIcon,
  SettingsIcon,
  FilesIcon,
  LogicIcon,
  NeonWaveIcon,
  CpuIcon,
  ChipIcon,
  FolderIcon,
} from '@redbyte/rb-icons';

interface AppStoreProps {
  onOpenApp?: (id: string, props?: any) => void;
}

const AppStoreComponent: React.FC<AppStoreProps> = ({ onOpenApp }) => {
  const apps = listApps();

  const openApp = (app: RedByteApp) => {
    onOpenApp?.(app.manifest.id);
  };

  return (
    <div className="h-full bg-slate-950 text-white p-6 overflow-y-auto">
      <h1 className="text-2xl font-semibold mb-4">RedByte App Store</h1>
      <p className="mb-6 text-sm text-slate-300">Browse and launch installed experiences.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <button
            key={app.manifest.id}
            className="group rounded-xl border border-white/10 bg-white/5 p-4 shadow-lg text-left transition hover:border-cyan-400/60 hover:shadow-cyan-500/20"
            onClick={() => openApp(app)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/40 border border-white/10">
                {iconFor(app)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base group-hover:text-cyan-200">{app.manifest.name}</div>
                <div className="text-xs text-slate-400">{app.manifest.category}</div>
              </div>
              <span className="text-cyan-400 text-sm">Launch</span>
            </div>
            <div className="mt-3 text-xs text-slate-300 leading-relaxed line-clamp-3">
              {app.manifest.description ?? 'System application'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const AppStoreApp: RedByteAppType = {
  manifest: {
    id: 'app-store',
    name: 'App Store',
    iconId: 'neon-wave',
    category: 'system',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 400 },
  },
  component: AppStoreComponent,
};

function iconFor(app: RedByteApp) {
  const size = 26;
  switch (app.manifest.iconId) {
    case 'terminal':
      return <TerminalIcon width={size} height={size} />;
    case 'settings':
      return <SettingsIcon width={size} height={size} />;
    case 'files':
      return <FilesIcon width={size} height={size} />;
    case 'logic':
      return <LogicIcon width={size} height={size} />;
    case 'neon-wave':
      return <NeonWaveIcon width={size} height={size} />;
    case 'cpu':
      return <CpuIcon width={size} height={size} />;
    case 'chip':
      return <ChipIcon width={size} height={size} />;
    default:
      return <FolderIcon width={size} height={size} />;
  }
}
