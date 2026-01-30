// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Icon } from '@redbyte/rb-icons';

export interface TopBarProps {
  isRecording: boolean;
  modeLabel: 'live' | 'recording' | 'replay';
  tickCount: number;
  versionLabel?: string;
  unreadCount?: number;
  onOpenLog: () => void;
  onOpenLauncher: () => void;
  onOpenSettings?: () => void;
  onOpenDeterminism?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isRecording,
  modeLabel,
  tickCount,
  versionLabel,
  unreadCount = 0,
  onOpenLog,
  onOpenLauncher,
  onOpenSettings,
  onOpenDeterminism,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="h-10 px-4 flex items-center justify-between backdrop-blur-md border-b"
        style={{
          background: 'var(--rb-glass)',
          borderColor: 'var(--rb-border)',
        }}
      >
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            className="flex items-center gap-2 text-sm text-slate-200 hover:text-white transition-colors"
            onClick={onOpenLauncher}
            title="Open Launcher (Ctrl/Cmd+K)"
            aria-label="Open Launcher"
          >
            <Icon name="browser" size={16} />
            <span className="font-semibold tracking-wide">RedByte OS</span>
          </button>
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">Instrument</span>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={onOpenDeterminism}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] border ${
              isRecording
                ? 'border-red-500/60 text-red-300 bg-red-500/10'
                : modeLabel === 'replay'
                ? 'border-purple-500/50 text-purple-300 bg-purple-500/10'
                : 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
            }`}
            title="Determinism Status"
            aria-label="Determinism Status"
          >
            {isRecording && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
            <span>{isRecording ? 'REC' : modeLabel.toUpperCase()}</span>
            <span className="font-mono text-[10px] text-slate-400">T{tickCount.toString().padStart(4, '0')}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {versionLabel && (
            <div className="px-2 py-1 rounded-full border border-slate-700/70 bg-slate-900/50 text-[10px] font-mono text-slate-400 uppercase tracking-[0.14em]">
              {versionLabel}
            </div>
          )}
          <button
            onClick={onOpenLog}
            className="relative h-8 px-2.5 rounded-md border text-slate-200 hover:text-white transition-colors"
            aria-label="Open System Log"
            title="Open System Log"
            style={{
              borderColor: 'var(--rb-border)',
              background: 'var(--rb-surface-2)',
            }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-semibold">
              <Icon name="log" size={16} />
              LOG
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                {Math.min(unreadCount, 99)}
              </span>
            )}
          </button>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="h-8 w-8 rounded-md border text-slate-300 hover:text-white transition-colors flex items-center justify-center"
              aria-label="Open Settings"
              title="Open Settings (Ctrl/Cmd+,)"
              style={{
                borderColor: 'var(--rb-border)',
                background: 'var(--rb-surface-2)',
              }}
            >
              <Icon name="settings" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
