import React from 'react';
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
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">About</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <p>RedByte OS Genesis - Stage E</p>
            <p>Version: 0.0.1</p>
            <p className="text-xs text-gray-500 mt-4">
              A modular desktop environment for logic circuit simulation
            </p>
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
