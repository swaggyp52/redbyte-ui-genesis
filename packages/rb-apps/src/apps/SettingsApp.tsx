// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import { useSettingsStore, type ThemeVariant, type WallpaperId, type DensityMode } from '@redbyte/rb-utils';
import { Icon, type IconName } from '@redbyte/rb-icons';
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
type SettingsSectionId = SettingsSection | 'shortcuts';

const SettingsComponent: React.FC<SettingsProps> = ({ onClose }) => {
  const [selectedSection, setSelectedSection] = useState<SettingsSectionId>('appearance');
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    themeVariant,
    wallpaperId,
    setThemeVariant,
    setWallpaperId,
    tickRate,
    setTickRate,
    reduceMotion,
    setReduceMotion,
    density,
    setDensity,
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
      <div className="w-56 bg-slate-950/70 border-r border-slate-700/50 flex flex-col backdrop-blur-sm">
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold tracking-wide text-slate-100">
            Settings
          </h2>
          <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">Deterministic Control</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {([
            { id: 'appearance', label: 'Appearance', icon: 'image' },
            { id: 'system', label: 'System', icon: 'settings' },
            { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
            { id: 'files', label: 'File Associations', icon: 'files' },
            { id: 'filesystem', label: 'Filesystem Data', icon: 'document' },
            { id: 'session', label: 'Session', icon: 'power' },
          ] as Array<{ id: SettingsSectionId; label: string; icon: IconName }>).map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedSection(item.id)}
              className={`w-full text-left px-3 py-2.5 mb-1 text-sm rounded-lg transition-all ${
                selectedSection === item.id
                  ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span className="mr-2 inline-flex items-center">
                <Icon name={item.icon} size={16} />
              </span>
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
              : selectedSection === 'shortcuts'
              ? 'Keyboard Shortcuts'
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
                <label className="block text-sm font-semibold mb-4 text-slate-200">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'redbyte-dark', label: 'RedByte Dark', desc: 'Deep cockpit contrast', icon: 'neon-wave' },
                    { value: 'instrument', label: 'Instrument', desc: 'High-clarity control mode', icon: 'cpu' },
                  ] as Array<{ value: ThemeVariant; label: string; desc: string; icon: IconName }>).map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => setThemeVariant(theme.value)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        themeVariant === theme.value
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                          : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-2xl mb-2">
                        <Icon name={theme.icon} size={20} />
                      </div>
                      <div className="font-semibold text-white">{theme.label}</div>
                      <div className="text-xs text-slate-400 mt-1">{theme.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-4 text-slate-200">Density</label>
                <div className="flex gap-3">
                  {([
                    { value: 'compact', label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                  ] as Array<{ value: DensityMode; label: string }>).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDensity(option.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        density === option.value
                          ? 'border-cyan-500 text-cyan-200 bg-cyan-500/10'
                          : 'border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Adjusts spacing and panel density across the OS.
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3 text-slate-200">Motion</label>
                <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-100">Reduce Motion</div>
                    <div className="text-xs text-slate-500">Disable non-essential animation</div>
                  </div>
                  <button
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      reduceMotion ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                    aria-label="Toggle reduced motion"
                    type="button"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-slate-900 transition-transform ${
                        reduceMotion ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
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
            <div className="space-y-6 text-sm text-slate-300 max-w-2xl">
              <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">⚙️</div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-white mb-2">Simulation Timing</h4>
                    <p className="text-slate-400 mb-4">
                      Sets the default tick rate for new and live-running circuits.
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={60}
                        value={tickRate}
                        onChange={(e) => setTickRate(parseInt(e.target.value, 10))}
                        className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        aria-label="Simulation tick rate"
                      />
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={tickRate}
                        onChange={(e) => setTickRate(parseInt(e.target.value, 10))}
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm font-mono"
                        aria-label="Simulation tick rate value"
                      />
                      <span className="text-xs text-slate-400">Hz</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedSection === 'shortcuts' && (
            <div className="space-y-4 text-sm text-slate-300 max-w-3xl">
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">Global</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { keys: 'Ctrl/Cmd + K', label: 'Open Launcher' },
                    { keys: 'Ctrl/Cmd + ,', label: 'Open Settings' },
                    { keys: 'Ctrl/Cmd + Shift + P', label: 'Command Palette' },
                    { keys: 'Ctrl/Cmd + Space', label: 'System Search' },
                    { keys: 'Ctrl/Cmd + `', label: 'Cycle Windows' },
                    { keys: 'Ctrl/Cmd + W', label: 'Close Focused Window' },
                    { keys: 'Ctrl/Cmd + M', label: 'Minimize Focused Window' },
                    { keys: 'Ctrl/Cmd + Alt + Arrows', label: 'Snap Window' },
                  ].map((shortcut) => (
                    <div key={shortcut.label} className="flex items-center justify-between rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
                      <span className="text-xs font-mono text-slate-200">{shortcut.keys}</span>
                      <span className="text-xs text-slate-400">{shortcut.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">Files</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { keys: 'Alt + ← / →', label: 'Back / Forward' },
                    { keys: 'Ctrl/Cmd + N', label: 'New File' },
                    { keys: 'Ctrl/Cmd + Shift + N', label: 'New Folder' },
                    { keys: 'Ctrl/Cmd + Shift + Enter', label: 'Open With...' },
                    { keys: 'F2', label: 'Rename' },
                    { keys: 'Del', label: 'Delete' },
                  ].map((shortcut) => (
                    <div key={shortcut.label} className="flex items-center justify-between rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
                      <span className="text-xs font-mono text-slate-200">{shortcut.keys}</span>
                      <span className="text-xs text-slate-400">{shortcut.label}</span>
                    </div>
                  ))}
                </div>
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
