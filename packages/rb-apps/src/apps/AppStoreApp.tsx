import React from 'react';
import { listApps, type RedByteApp } from '../AppRegistry';
import type { RedByteApp as RedByteAppType } from '../types';

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {apps.map((app) => (
          <div key={app.manifest.id} className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{app.manifest.name}</div>
                <div className="text-xs text-slate-400">{app.manifest.id}</div>
              </div>
              <button
                onClick={() => openApp(app)}
                className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-sm"
              >
                Launch
              </button>
            </div>
            <pre className="mt-3 rounded bg-black/40 p-3 text-xs text-slate-200 overflow-x-auto">
              {JSON.stringify(app.manifest, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AppStoreApp: RedByteAppType = {
  manifest: {
    id: 'app-store',
    name: 'App Store',
    iconId: 'folder',
    category: 'system',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 400 },
  },
  component: AppStoreComponent,
};
