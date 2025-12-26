// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import { useSettingsStore, type ThemeVariant, type AccentColor, type WallpaperId } from '@redbyte/rb-utils';
import { FileAssociationsPanel } from './settings/FileAssociationsPanel';
import { FilesystemDataPanel } from './settings/FilesystemDataPanel';
import { SessionPanel } from './settings/SessionPanel';

interface SettingsProps {
  onClose?: () => void;
}

const WALLPAPERS: Array<{ id: WallpaperId; name: string; description: string }> = [
  { id: 'neon-circuit', name: 'Neon Circuit', description: 'Futuristic circuit board design' },
  { id: 'frost-grid', name: 'Frost Grid', description: 'Cool minimalist grid pattern' },
  { id: 'default', name: 'Gradient', description: 'Classic gradient background' },
  { id: 'solid', name: 'Solid', description: 'Clean solid color' },
];

type SettingsSection = 'appearance' | 'system' | 'files' | 'filesystem' | 'session';

const SettingsComponent: React.FC<SettingsProps> = ({ onClose }) => {
  const [selectedSection, setSelectedSection] = useState<SettingsSection>('appearance');
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    themeVariant,
    wallpaperId,
    accentColor,
    setThemeVariant,
    setWallpaperId,
    setAccentColor,
  } = useSettingsStore();

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="h-full flex bg-slate-950 text-white"
      style={{ outline: 'none' }}
    >
      {/* Sidebar */}
      <div className="w-52 bg-slate-900/50 border-r border-slate-700/50 flex flex-col backdrop-blur-sm">
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Settings
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {[
            { id: 'appearance', label: 'Appearance', icon: '🎨' },
            { id: 'system', label: 'System', icon: '⚙️' },
            { id: 'files', label: 'File Associations', icon: '📎' },
            { id: 'filesystem', label: 'Filesystem Data', icon: '💾' },
            { id: 'session', label: 'Session', icon: '🔄' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedSection(item.id as SettingsSection)}
              className={`w-full text-left px-3 py-2.5 mb-1 text-sm rounded-lg transition-all ${
                selectedSection === item.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/30">
          <h3 className="text-xl font-semibold text-white">
            {selectedSection === 'appearance'
              ? 'Appearance'
              : selectedSection === 'system'
              ? 'System'
              : selectedSection === 'files'
              ? 'File Associations'
              : selectedSection === 'filesystem'
              ? 'Filesystem Data'
              : 'Session'}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedSection === 'appearance' && (
            <div className="space-y-8 max-w-2xl">
              {/* Theme Section */}
              <div>
                <label className="block text-sm font-semibold mb-4 text-slate-200">Theme Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: 'Light', desc: 'Bright theme', icon: '☀️' },
                    { value: 'dark', label: 'Dark', desc: 'Dark theme', icon: '🌙' },
                    { value: 'midnight', label: 'Midnight', desc: 'Deep purple', icon: '🌌' },
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => setThemeVariant(theme.value as ThemeVariant)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        themeVariant === theme.value
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-2xl mb-2">{theme.icon}</div>
                      <div className="font-semibold text-white">{theme.label}</div>
                      <div className="text-xs text-slate-400 mt-1">{theme.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallpaper Section */}
              <div>
                <label className="block text-sm font-semibold mb-4 text-slate-200">Desktop Wallpaper</label>
                <div className="grid grid-cols-2 gap-4">
                  {WALLPAPERS.map((wallpaper) => (
                    <button
                      key={wallpaper.id}
                      onClick={() => setWallpaperId(wallpaper.id)}
                      className={`relative p-4 rounded-xl border-2 transition-all text-left overflow-hidden group ${
                        wallpaperId === wallpaper.id
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      {/* Preview */}
                      <div className="h-24 mb-3 rounded-lg overflow-hidden border border-slate-700">
                        {wallpaper.id === 'neon-circuit' && (
                          <div
                            className="h-full w-full"
                            style={{
                              backgroundImage: 'url(/wallpapers/neon-circuit.svg)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                        )}
                        {wallpaper.id === 'frost-grid' && (
                          <div
                            className="h-full w-full"
                            style={{
                              backgroundImage: 'url(/wallpapers/frost-grid.svg)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                        )}
                        {wallpaper.id === 'default' && (
                          <div
                            className="h-full w-full"
                            style={{
                              background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #1e1b4b 100%)',
                            }}
                          />
                        )}
                        {wallpaper.id === 'solid' && (
                          <div className="h-full w-full bg-slate-900" />
                        )}
                      </div>

                      <div className="font-semibold text-white">{wallpaper.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{wallpaper.description}</div>

                      {wallpaperId === wallpaper.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs">
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedSection === 'system' && (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-slate-400">System settings coming soon.</p>
              </div>
            </div>
          )}

          {selectedSection === 'files' && (
            <FileAssociationsPanel />
          )}

          {selectedSection === 'filesystem' && (
            <FilesystemDataPanel />
          )}

          {selectedSection === 'session' && (
            <SessionPanel />
          )}
        </div>

        <div className="p-3 border-t border-slate-700/50 bg-slate-900/30 text-xs text-slate-500">
          <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700">Esc</kbd> Close
        </div>
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
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 500 },
  },
  component: SettingsComponent,
};
