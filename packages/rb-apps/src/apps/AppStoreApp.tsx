// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';
import type { RedByteApp } from '../types';
import { Icon, type IconName } from '@redbyte/rb-icons';

interface AppStoreProps {
  onOpenApp?: (id: string, props?: any) => void;
}

const AppStoreComponent: React.FC<AppStoreProps> = ({ onOpenApp }) => {
  const [apps, setApps] = useState<RedByteApp[]>([]);

  // Lazy load apps from registry to avoid circular import
  useEffect(() => {
    (async () => {
      const { listApps } = await import('../AppRegistry');
      setApps(listApps());
    })();
  }, []);

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
                <Icon name={(app.manifest.iconId as IconName) ?? 'folder'} size={24} />
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
