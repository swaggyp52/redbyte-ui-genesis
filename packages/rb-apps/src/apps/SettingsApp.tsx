// Copyright © 2025 Connor Angel ("RedByte OS Genesis")
// All rights reserved. Unauthorized use, reproduction, or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import type { RedByteApp } from '../types';
import { useSettingsStore, type ThemeVariant, type WallpaperId } from '@redbyte/rb-utils';

interface SettingsProps {
  onThemeChange?: (theme: ThemeVariant) => void;
  onWallpaperChange?: (wallpaper: WallpaperId) => void;
}

const SettingsComponent: React.FC<SettingsProps> = ({
  onThemeChange,
  onWallpaperChange,
}) => {
  const {
    themeVariant,
    wallpaperId,
    tickRate,
    setThemeVariant,
    setWallpaperId,
    setTickRate,
  } = useSettingsStore();

  const [showLicense, setShowLicense] = useState(false);

  const handleThemeChange = (theme: ThemeVariant) => {
    setThemeVariant(theme);
    onThemeChange?.(theme);
  };

  const handleWallpaperChange = (wallpaper: WallpaperId) => {
    setWallpaperId(wallpaper);
    onWallpaperChange?.(wallpaper);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-white">
      <div className="p-6 space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">Appearance</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded bg-gray-800 hover:bg-gray-750 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value="dark-neon"
                    checked={themeVariant === 'dark-neon'}
                    onChange={() => handleThemeChange('dark-neon')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">Dark Neon</div>
                    <div className="text-xs text-gray-400">
                      Vibrant neon colors on dark background
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded bg-gray-800 hover:bg-gray-750 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value="light-frost"
                    checked={themeVariant === 'light-frost'}
                    onChange={() => handleThemeChange('light-frost')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">Light Frost</div>
                    <div className="text-xs text-gray-400">
                      Cool frost tones on light background
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Wallpaper</label>
              <select
                value={wallpaperId}
                onChange={(e) => handleWallpaperChange(e.target.value as WallpaperId)}
                className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
              >
                <option value="neon-circuit">Neon Circuit</option>
                <option value="frost-grid">Frost Grid</option>
                <option value="solid">Solid Color</option>
              </select>
              <div className="mt-2 h-24 rounded border-2 border-gray-700 bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900">
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  Preview: {wallpaperId}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">Simulation</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Default Tick Rate: {tickRate} Hz
              </label>
              <input
                type="range"
                min="1"
                max="60"
                value={tickRate}
                onChange={(e) => setTickRate(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 Hz (Slow)</span>
                <span>60 Hz (Fast)</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Sets the default simulation speed for new logic circuits
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">About & Legal</h2>
          <div className="space-y-4 text-sm">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-white mb-2">RedByte OS Genesis</h3>
              <div className="space-y-1 text-gray-300">
                <p>Version: 1.0.0</p>
                <p className="text-xs text-gray-400 mt-2">
                  A browser-native operating system for multi-representation logic design
                </p>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-white mb-2">Copyright & License</h3>
              <div className="space-y-2 text-gray-300">
                <p>© 2025 Connor Angel</p>
                <p className="text-xs text-gray-400">All rights reserved.</p>
                <p className="text-xs text-gray-400 mt-2">
                  This software is licensed under the RedByte Proprietary License (RPL-1.0).
                </p>
                <button
                  onClick={() => setShowLicense(!showLicense)}
                  className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline"
                >
                  {showLicense ? 'Hide License' : 'View License'}
                </button>
                {showLicense && (
                  <div className="mt-3 p-3 bg-gray-900 rounded text-xs text-gray-400 max-h-48 overflow-y-auto font-mono">
                    <p className="font-semibold text-white mb-2">RedByte Proprietary License v1.0 (RPL-1.0)</p>
                    <p className="mb-2">This software may be viewed for educational purposes only.</p>
                    <p className="mb-2">NO commercial use, redistribution, or derivative works permitted without explicit license.</p>
                    <p>For full license terms, see LICENSE file in source repository.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-white mb-2">Trademarks</h3>
              <div className="space-y-1 text-xs text-gray-400">
                <p>"RedByte", "RedByte OS", and "RedByte OS Genesis" are trademarks of Connor Angel.</p>
                <p>Unauthorized use is prohibited.</p>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="font-semibold text-white mb-2">Creator</h3>
              <div className="text-gray-300">
                <p>Created by Connor Angel</p>
                <p className="text-xs text-gray-400 mt-1">RedByte OS Genesis © 2025</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export const SettingsApp: RedByteApp = {
  manifest: {
    id: 'settings',
    name: 'Settings',
    iconId: 'settings',
    singleton: true,
    category: 'system',
    defaultSize: { width: 500, height: 600 },
    minSize: { width: 400, height: 400 },
  },
  component: SettingsComponent,
};
