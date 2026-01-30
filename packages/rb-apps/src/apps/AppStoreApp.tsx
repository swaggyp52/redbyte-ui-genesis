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
    <div
      className="h-full p-6 overflow-y-auto"
      style={{ background: 'var(--rb-surface-0)', color: 'var(--rb-text)' }}
    >
      <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--rb-text)' }}>Apps</h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--rb-text-2)' }}>Browse and launch installed applications.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {apps.map((app) => (
          <button
            type="button"
            key={app.manifest.id}
            className="group rounded-lg p-4 text-left transition-colors"
            style={{
              background: 'var(--rb-surface-1)',
              border: '1px solid var(--rb-border)',
            }}
            onClick={() => openApp(app)}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: 'var(--rb-surface-2)', border: '1px solid var(--rb-border)' }}
              >
                <Icon name={(app.manifest.iconId as IconName) ?? 'folder'} size={20} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: 'var(--rb-text)' }}>{app.manifest.name}</div>
                <div className="text-xs" style={{ color: 'var(--rb-text-3)' }}>{app.manifest.category}</div>
              </div>
              <span className="text-xs" style={{ color: 'var(--rb-accent)' }}>Launch</span>
            </div>
            {app.manifest.description && (
              <div className="mt-2 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--rb-text-2)' }}>
                {app.manifest.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const AppStoreApp: RedByteApp = {
  manifest: {
    id: 'app-store',
    name: 'Apps',
    iconId: 'grid',
    category: 'system',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 400 },
  },
  component: AppStoreComponent,
};
