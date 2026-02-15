// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import { useSettingsStore, type ThemeVariant, type WallpaperId, type DensityMode, type SnapAssistMode, type UiScalePreset } from '@redbyte/rb-utils';
import { Icon, type IconName } from '@redbyte/rb-icons';
import { FileAssociationsPanel } from './settings/FileAssociationsPanel';
import { FilesystemDataPanel } from './settings/FilesystemDataPanel';
import { SessionPanel } from './settings/SessionPanel';

interface SettingsProps {
  onClose?: () => void;
}

const WALLPAPERS: Array<{ id: WallpaperId; name: string; description: string }> = [
  { id: 'default', name: 'Gradient', description: 'Subtle dark gradient' },
  { id: 'redbyte-field', name: 'RedByte Field', description: 'Animated grid drift' },
  { id: 'neon-circuit', name: 'Deep', description: 'Solid dark surface' },
  { id: 'frost-grid', name: 'Grid', description: 'Faint blue gridlines' },
  { id: 'solid', name: 'Solid', description: 'Pure dark background' },
];

type SettingsSection = 'appearance' | 'system' | 'windowing' | 'files' | 'filesystem' | 'session';
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
	    performanceMode,
	    setPerformanceMode,
	    density,
	    setDensity,
      uiScale,
      setUiScale,
	    snapAssist,
	    setSnapAssist,
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
      className="h-full flex"
      style={{ background: 'var(--rb-surface-0)', color: 'var(--rb-text)', outline: 'none' }}
    >
      {/* Sidebar */}
      <div
        className="w-52 flex flex-col"
        style={{ background: 'var(--rb-surface-0)', borderRight: '1px solid var(--rb-border)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid var(--rb-border)' }}>
          <h2 className="text-base font-semibold tracking-wide" style={{ color: 'var(--rb-text)' }}>
            Settings
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {([
            { id: 'appearance', label: 'Appearance', icon: 'image' },
            { id: 'system', label: 'System', icon: 'settings' },
            { id: 'windowing', label: 'Windowing', icon: 'grid' },
            { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
            { id: 'files', label: 'File Associations', icon: 'files' },
            { id: 'filesystem', label: 'Filesystem Data', icon: 'document' },
            { id: 'session', label: 'Session', icon: 'power' },
          ] as Array<{ id: SettingsSectionId; label: string; icon: IconName }>).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setSelectedSection(item.id)}
              className="w-full text-left px-3 py-2 mb-0.5 text-sm rounded-md transition-colors"
              style={{
                background: selectedSection === item.id ? 'var(--rb-accent-muted)' : 'transparent',
                color: selectedSection === item.id ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                border: selectedSection === item.id ? '1px solid var(--rb-accent-border)' : '1px solid transparent',
              }}
            >
              <span className="mr-2 inline-flex items-center">
                <Icon name={item.icon} size={14} />
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4" style={{ borderBottom: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--rb-text)' }}>
            {selectedSection === 'appearance'
              ? 'Appearance'
              : selectedSection === 'system'
              ? 'System'
              : selectedSection === 'windowing'
              ? 'Windowing'
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
                <label className="block text-sm font-semibold mb-4" style={{ color: 'var(--rb-text)' }}>Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'dark' as ThemeVariant, label: 'Dark', desc: 'Default dark surface' },
                    { value: 'light' as ThemeVariant, label: 'Light', desc: 'High-clarity light mode' },
                    { value: 'midnight' as ThemeVariant, label: 'Midnight', desc: 'Deep blue-black' },
                  ]).map((theme) => (
                    <button
                      type="button"
                      key={theme.value}
                      onClick={() => setThemeVariant(theme.value)}
                      className="p-4 rounded-lg transition-all text-left"
                      style={{
                        border: themeVariant === theme.value
                          ? '2px solid var(--rb-accent)'
                          : '2px solid var(--rb-border)',
                        background: themeVariant === theme.value
                          ? 'var(--rb-accent-muted)'
                          : 'var(--rb-surface-1)',
                      }}
                    >
                      <div className="font-semibold text-sm" style={{ color: 'var(--rb-text)' }}>{theme.label}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--rb-text-3)' }}>{theme.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-4" style={{ color: 'var(--rb-text)' }}>Density</label>
                <div className="flex gap-3">
                  {([
                    { value: 'compact', label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                  ] as Array<{ value: DensityMode; label: string }>).map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setDensity(option.value)}
                      className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      style={{
                        border: density === option.value
                          ? '1px solid var(--rb-accent)'
                          : '1px solid var(--rb-border)',
                        color: density === option.value ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                        background: density === option.value ? 'var(--rb-accent-muted)' : 'transparent',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--rb-text-3)' }}>
                  Adjusts spacing and panel density across the OS.
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-4" style={{ color: 'var(--rb-text)' }}>Scale</label>
                <div className="flex gap-3">
                  {([
                    { value: 100 as UiScalePreset, label: '100%' },
                    { value: 110 as UiScalePreset, label: '110%' },
                    { value: 125 as UiScalePreset, label: '125%' },
                  ]).map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setUiScale(option.value)}
                      className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      style={{
                        border: uiScale === option.value
                          ? '1px solid var(--rb-accent)'
                          : '1px solid var(--rb-border)',
                        color: uiScale === option.value ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                        background: uiScale === option.value ? 'var(--rb-accent-muted)' : 'transparent',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--rb-text-3)' }}>
                  Controls global UI text and control scaling.
                </div>
              </div>

	              <div>
	                <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--rb-text)' }}>Motion</label>
	                <div
	                  className="flex items-center justify-between rounded-lg px-4 py-3"
	                  style={{ border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }}
	                >
	                  <div>
	                    <div className="text-sm font-medium" style={{ color: 'var(--rb-text)' }}>Reduce Motion</div>
	                    <div className="text-xs" style={{ color: 'var(--rb-text-3)' }}>Disable non-essential animation</div>
	                  </div>
	                  <button
	                    type="button"
	                    onClick={() => setReduceMotion(!reduceMotion)}
	                    className="relative h-6 w-11 rounded-full transition-colors"
	                    style={{ background: reduceMotion ? 'var(--rb-accent)' : 'var(--rb-surface-3)' }}
	                    aria-label="Toggle reduced motion"
	                  >
	                    <span
	                      className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
	                      style={{
	                        background: 'var(--rb-surface-0)',
	                        transform: reduceMotion ? 'translateX(20px)' : 'translateX(2px)',
	                      }}
	                    />
	                  </button>
	                </div>
	                <div
	                  className="flex items-center justify-between rounded-lg px-4 py-3 mt-2"
	                  style={{ border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }}
	                >
	                  <div>
	                    <div className="text-sm font-medium" style={{ color: 'var(--rb-text)' }}>Performance Mode</div>
	                    <div className="text-xs" style={{ color: 'var(--rb-text-3)' }}>
	                      Reduce rendering load (may disable 3D and throttle instruments)
	                    </div>
	                  </div>
	                  <button
	                    type="button"
	                    onClick={() => setPerformanceMode(!performanceMode)}
	                    className="relative h-6 w-11 rounded-full transition-colors"
	                    style={{ background: performanceMode ? 'var(--rb-accent)' : 'var(--rb-surface-3)' }}
	                    aria-label="Toggle performance mode"
	                  >
	                    <span
	                      className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
	                      style={{
	                        background: 'var(--rb-surface-0)',
	                        transform: performanceMode ? 'translateX(20px)' : 'translateX(2px)',
	                      }}
	                    />
	                  </button>
	                </div>
	              </div>

              {/* Wallpaper Section */}
              <div>
                <label className="block text-sm font-semibold mb-4" style={{ color: 'var(--rb-text)' }}>Desktop Wallpaper</label>
                <div className="grid grid-cols-2 gap-3">
                  {WALLPAPERS.map((wallpaper) => (
                    <button
                      type="button"
                      key={wallpaper.id}
                      onClick={() => setWallpaperId(wallpaper.id)}
                      className="relative p-3 rounded-lg transition-all text-left overflow-hidden"
                      style={{
                        border: wallpaperId === wallpaper.id
                          ? '2px solid var(--rb-accent)'
                          : '2px solid var(--rb-border)',
                        background: wallpaperId === wallpaper.id
                          ? 'var(--rb-accent-muted)'
                          : 'var(--rb-surface-1)',
                      }}
                    >
                      {/* Preview */}
                      <div
                        className="h-20 mb-2 rounded overflow-hidden"
                        style={{ border: '1px solid var(--rb-border)' }}
                      >
                        <div
                          className="h-full w-full"
                          style={{
                            background: wallpaper.id === 'default'
                              ? 'linear-gradient(145deg, #09090B 0%, #18181B 50%, #09090B 100%)'
                              : wallpaper.id === 'redbyte-field'
                              ? 'linear-gradient(140deg, #09090B 0%, #111318 55%, #09090B 100%)'
                              : wallpaper.id === 'frost-grid'
                              ? `linear-gradient(rgba(59, 130, 246, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.02) 1px, transparent 1px), #09090B`
                              : '#09090B',
                            backgroundSize: wallpaper.id === 'frost-grid' ? '20px 20px' : undefined,
                          }}
                        />
                      </div>

                      <div className="font-medium text-sm" style={{ color: 'var(--rb-text)' }}>{wallpaper.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--rb-text-3)' }}>{wallpaper.description}</div>

                      {wallpaperId === wallpaper.id && (
                        <div
                          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
                          style={{ background: 'var(--rb-accent)' }}
                        >
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
            <div className="space-y-6 text-sm max-w-2xl" style={{ color: 'var(--rb-text-2)' }}>
              <div
                className="p-5 rounded-lg"
                style={{ background: 'var(--rb-surface-1)', border: '1px solid var(--rb-border)' }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h4 className="text-base font-semibold mb-2" style={{ color: 'var(--rb-text)' }}>Simulation Timing</h4>
                    <p className="mb-4" style={{ color: 'var(--rb-text-3)' }}>
                      Sets the default tick rate for new and live-running circuits.
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={60}
                        value={tickRate}
                        onChange={(e) => setTickRate(parseInt(e.target.value, 10))}
                        className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
                        style={{ background: 'var(--rb-surface-3)' }}
                        aria-label="Simulation tick rate"
                      />
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={tickRate}
                        onChange={(e) => setTickRate(parseInt(e.target.value, 10))}
                        className="w-16 px-2 py-1 rounded text-sm font-mono"
                        style={{
                          background: 'var(--rb-surface-0)',
                          border: '1px solid var(--rb-border)',
                          color: 'var(--rb-text)',
                        }}
                        aria-label="Simulation tick rate value"
                      />
                      <span className="text-xs" style={{ color: 'var(--rb-text-3)' }}>Hz</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedSection === 'windowing' && (
            <div className="space-y-6 text-sm max-w-2xl" style={{ color: 'var(--rb-text-2)' }}>
              <div
                className="p-5 rounded-lg"
                style={{ background: 'var(--rb-surface-1)', border: '1px solid var(--rb-border)' }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="text-base font-semibold mb-2" style={{ color: 'var(--rb-text)' }}>Snap Assist</h4>
                      <p style={{ color: 'var(--rb-text-3)' }}>
                        Controls edge snapping behavior while dragging windows.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {([
                        { value: 'off', label: 'Off', desc: 'No snap previews' },
                        { value: 'manual', label: 'Manual (Shift)', desc: 'Hold Shift to preview' },
                        { value: 'auto', label: 'Auto (Hover)', desc: 'Hover 250ms to preview' },
                      ] as Array<{ value: SnapAssistMode; label: string; desc: string }>).map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() => setSnapAssist(option.value)}
                          className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          style={{
                            border: snapAssist === option.value
                              ? '1px solid var(--rb-accent)'
                              : '1px solid var(--rb-border)',
                            color: snapAssist === option.value ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                            background: snapAssist === option.value ? 'var(--rb-accent-muted)' : 'transparent',
                          }}
                        >
                          <div>{option.label}</div>
                          <div className="text-[10px] mt-1" style={{ color: 'var(--rb-text-3)' }}>{option.desc}</div>
                        </button>
                      ))}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--rb-text-3)' }}>
                      Snap previews only apply on release. Resizing never triggers snap.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedSection === 'shortcuts' && (
            <div className="space-y-4 text-sm max-w-3xl" style={{ color: 'var(--rb-text-2)' }}>
              <div className="rounded-lg p-4" style={{ border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }}>
                <div className="text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--rb-text-3)' }}>Global</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { keys: 'Ctrl/Cmd + K', label: 'Open Launcher' },
                    { keys: 'Ctrl/Cmd + ,', label: 'Open Settings' },
                    { keys: 'Ctrl/Cmd + Shift + P', label: 'Command Palette' },
                    { keys: 'Ctrl/Cmd + Space', label: 'System Search' },
                    { keys: 'Ctrl/Cmd + Tab', label: 'Window Switcher' },
                    { keys: 'Ctrl/Cmd + `', label: 'Cycle Windows' },
                    { keys: 'Ctrl/Cmd + W', label: 'Close Focused Window' },
                    { keys: 'Ctrl/Cmd + M', label: 'Minimize Focused Window' },
                    { keys: 'Ctrl/Cmd + Alt + Arrows', label: 'Snap Window' },
                    { keys: 'Shift + Drag (edge)', label: 'Snap Preview (Manual)' },
                  ].map((shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex items-center justify-between rounded-md px-3 py-1.5"
                      style={{ background: 'var(--rb-surface-0)', border: '1px solid var(--rb-border)' }}
                    >
                      <span className="text-xs font-mono" style={{ color: 'var(--rb-text)' }}>{shortcut.keys}</span>
                      <span className="text-xs" style={{ color: 'var(--rb-text-3)' }}>{shortcut.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-4" style={{ border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }}>
                <div className="text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--rb-text-3)' }}>Files</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { keys: 'Alt + ← / →', label: 'Back / Forward' },
                    { keys: 'Ctrl/Cmd + N', label: 'New File' },
                    { keys: 'Ctrl/Cmd + Shift + N', label: 'New Folder' },
                    { keys: 'Ctrl/Cmd + Shift + Enter', label: 'Open With...' },
                    { keys: 'F2', label: 'Rename' },
                    { keys: 'Del', label: 'Delete' },
                  ].map((shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex items-center justify-between rounded-md px-3 py-1.5"
                      style={{ background: 'var(--rb-surface-0)', border: '1px solid var(--rb-border)' }}
                    >
                      <span className="text-xs font-mono" style={{ color: 'var(--rb-text)' }}>{shortcut.keys}</span>
                      <span className="text-xs" style={{ color: 'var(--rb-text-3)' }}>{shortcut.label}</span>
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

        <div className="p-3 text-xs" style={{ borderTop: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)', color: 'var(--rb-text-3)' }}>
          <kbd
            className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--rb-surface-0)', border: '1px solid var(--rb-border)' }}
          >Esc</kbd> Close
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
