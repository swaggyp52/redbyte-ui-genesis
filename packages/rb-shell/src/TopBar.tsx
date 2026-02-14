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
  onOpenLog?: () => void;
  onOpenLauncher: () => void;
  onOpenSettings?: () => void;
  onOpenDeterminism?: () => void;
}

export const TopBar: React.FC<TopBarProps> = React.memo(({
  isRecording,
  modeLabel,
  tickCount,
  unreadCount = 0,
  onOpenLog,
  onOpenLauncher,
  onOpenSettings,
  onOpenDeterminism,
}) => {
  return (
    <header role="banner" aria-label="System Bar" className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="h-8 px-3 flex items-center justify-between border-b"
        style={{
          background: 'var(--rb-ui-surface-1)',
          borderColor: 'var(--rb-ui-border)',
        }}
      >
        {/* Left: Logo + workspace */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <button
            className="flex items-center gap-2 text-xs font-semibold tracking-wide transition-colors"
            onClick={onOpenLauncher}
            title="Open Launcher (Ctrl/Cmd+K)"
            aria-label="Open Launcher"
            style={{ color: 'var(--rb-ui-text)' }}
          >
            <div
              className="h-5 w-5 rounded flex items-center justify-center"
              style={{ background: 'var(--rb-ui-accent)' }}
            >
              <span className="text-[10px] font-bold text-white leading-none">R</span>
            </div>
            <span>RedByte</span>
          </button>
        </div>

        {/* Center: Determinism status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onOpenDeterminism}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider"
            style={{
              background: isRecording
                ? 'var(--rb-ui-accent-soft)'
                : modeLabel === 'replay'
                  ? 'var(--rb-ui-accent-soft)'
                  : 'var(--rb-ui-surface-2)',
              color: isRecording
                ? 'var(--rb-ui-danger)'
                : modeLabel === 'replay'
                  ? 'var(--rb-ui-accent)'
                  : 'var(--rb-ui-text-2)',
            }}
            title="Determinism Status"
            aria-label="Determinism Status"
          >
            {isRecording && (
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--rb-ui-danger)' }}
              />
            )}
            <span>{isRecording ? 'REC' : modeLabel}</span>
            <span style={{ color: 'var(--rb-ui-text-3)' }}>
              T{tickCount.toString().padStart(4, '0')}
            </span>
          </button>
        </div>

        {/* Right: Log + Settings */}
        <div className="flex items-center gap-1 pointer-events-auto">
          {onOpenLog && (
            <button
              onClick={onOpenLog}
              className="relative h-6 px-2 rounded flex items-center gap-1.5 text-[11px] font-medium transition-colors"
              aria-label="Open System Log"
              title="Open System Log"
              style={{ color: 'var(--rb-ui-text-2)' }}
            >
              <Icon name="log" size={14} />
              <span>Log</span>
              {unreadCount > 0 && (
                <span
                  className="h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ background: 'var(--rb-ui-danger)' }}
                >
                  {Math.min(unreadCount, 99)}
                </span>
              )}
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="h-6 w-6 rounded flex items-center justify-center transition-colors"
              aria-label="Open Settings"
              title="Open Settings (Ctrl/Cmd+,)"
              style={{ color: 'var(--rb-ui-text-3)' }}
            >
              <Icon name="settings" size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
});
TopBar.displayName = 'TopBar';
