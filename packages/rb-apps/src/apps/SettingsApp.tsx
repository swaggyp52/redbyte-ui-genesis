// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import { useSettingsStore, type ThemeVariant, type AccentColor } from '@redbyte/rb-utils';
import { FileAssociationsPanel } from './settings/FileAssociationsPanel';
import { FilesystemDataPanel } from './settings/FilesystemDataPanel';
import { SessionPanel } from './settings/SessionPanel';

interface SettingsProps {
  onClose?: () => void;
}

const WALLPAPERS = [
  { id: 'default', name: 'Default' },
  { id: 'neon-circuit', name: 'Neon Circuit' },
  { id: 'frost-grid', name: 'Frost Grid' },
  { id: 'solid', name: 'Solid Color' },
];

type SettingsSection = 'appearance' | 'system' | 'files' | 'filesystem' | 'session';

const SettingsComponent: React.FC<SettingsProps> = ({ onClose }) => {
  const [selectedSection, setSelectedSection] = useState<SettingsSection>('appearance');
  const [selectedIndex, setSelectedIndex] = useState(0);
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
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, 2));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedSection === 'appearance') {
        if (selectedIndex === 0) {
          const themes: ThemeVariant[] = ['light', 'dark', 'system'];
          const currentIdx = themes.indexOf(themeVariant);
          const nextIdx = (currentIdx + 1) % themes.length;
          setThemeVariant(themes[nextIdx]);
        } else if (selectedIndex === 1) {
          const currentIdx = WALLPAPERS.findIndex((w) => w.id === wallpaperId);
          const nextIdx = (currentIdx + 1) % WALLPAPERS.length;
          setWallpaperId(WALLPAPERS[nextIdx].id);
        }
      }
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
      <div className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase">Settings</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setSelectedSection('appearance')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${
              selectedSection === 'appearance' ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'
            }`}
          >
            Appearance
          </button>
          <button
            onClick={() => setSelectedSection('system')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${
              selectedSection === 'system' ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'
            }`}
          >
            System
          </button>
          <button
            onClick={() => setSelectedSection('files')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${
              selectedSection === 'files' ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'
            }`}
          >
            File Associations
          </button>
          <button
            onClick={() => setSelectedSection('filesystem')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${
              selectedSection === 'filesystem' ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'
            }`}
          >
            Filesystem Data
          </button>
          <button
            onClick={() => setSelectedSection('session')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${
              selectedSection === 'session' ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'
            }`}
          >
            Session
          </button>
        </div>
      </div>

      {/* Main pane */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold">
            {selectedSection === 'appearance'
              ? 'Appearance'
              : selectedSection === 'system'
              ? 'System'
              : selectedSection === 'files'
              ? 'File Associations'
              : selectedSection === 'filesystem'
              ? 'Filesystem Data'
              : 'Session'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedSection === 'appearance' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3">Theme</label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-3 p-3 rounded cursor-pointer ${
                      selectedIndex === 0 ? 'bg-slate-800 ring-1 ring-cyan-400' : 'bg-slate-900 hover:bg-slate-850'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={themeVariant === 'light'}
                      onChange={() => setThemeVariant('light')}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Light</div>
                      <div className="text-xs text-slate-400">Light theme with cool frost tones</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded cursor-pointer ${
                      selectedIndex === 0 ? 'bg-slate-800 ring-1 ring-cyan-400' : 'bg-slate-900 hover:bg-slate-850'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={themeVariant === 'dark'}
                      onChange={() => setThemeVariant('dark')}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Dark</div>
                      <div className="text-xs text-slate-400">Dark theme with vibrant neon colors</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded cursor-pointer ${
                      selectedIndex === 0 ? 'bg-slate-800 ring-1 ring-cyan-400' : 'bg-slate-900 hover:bg-slate-850'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value="system"
                      checked={themeVariant === 'system'}
                      onChange={() => setThemeVariant('system')}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">System</div>
                      <div className="text-xs text-slate-400">Follow system preference</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Wallpaper</label>
                <div
                  className={`rounded p-3 ${
                    selectedIndex === 1 ? 'bg-slate-800 ring-1 ring-cyan-400' : 'bg-slate-900'
                  }`}
                >
                  <select
                    value={wallpaperId}
                    onChange={(e) => setWallpaperId(e.target.value)}
                    className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
                  >
                    {WALLPAPERS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedSection === 'system' && (
            <div className="space-y-4 text-sm text-slate-300">
              <p className="text-slate-400">System settings coming soon.</p>
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

        {selectedSection !== 'files' && selectedSection !== 'filesystem' && selectedSection !== 'session' && (
          <div className="p-2 border-t border-slate-800 text-xs text-slate-500">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Toggle{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close
          </div>
        )}
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
