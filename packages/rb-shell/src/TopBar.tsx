// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Icon } from '@redbyte/rb-icons';
import { useTheme } from '@redbyte/rb-theme';

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
  versionLabel,
  unreadCount = 0,
  onOpenLog,
  onOpenLauncher,
  onOpenSettings,
  onOpenDeterminism,
}) => {
  const { variant, setVariant } = useTheme();

  const toggleTheme = () => {
    const next = variant === 'light' ? 'dark' : 'light';
    setVariant(next);
  };

  return (
    <header role="banner" aria-label="System Bar" className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="flex items-center justify-between border-b"
        style={{
          height: 'var(--rb-topbar-height, 32px)',
          paddingLeft: 'var(--rb-space-3, 0.75rem)',
          paddingRight: 'var(--rb-space-3, 0.75rem)',
          background: 'var(--rb-ui-surface-1)',
          borderColor: 'var(--rb-ui-border)',
        }}
      >
        {/* Left: Logo + workspace */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <button
            className="flex items-center gap-2 font-semibold tracking-wide transition-colors"
            onClick={onOpenLauncher}
            title="Open Launcher (Ctrl/Cmd+K)"
            aria-label="Open Launcher"
            style={{ color: 'var(--rb-ui-text)', fontSize: 'var(--rb-text-xs, 0.75rem)' }}
          >
            <div
              className="rounded flex items-center justify-center"
              style={{
                width: 'calc(20px * var(--rb-ui-scale, 1))',
                height: 'calc(20px * var(--rb-ui-scale, 1))',
                background: 'var(--rb-ui-accent)'
              }}
            >
              <span className="font-bold text-white leading-none" style={{ fontSize: 'calc(10px * var(--rb-ui-scale, 1))' }}>R</span>
            </div>
            <span>RedByte</span>
          </button>
        </div>

        {/* Center: Determinism status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onOpenDeterminism}
            className="flex items-center rounded-full font-mono font-medium uppercase tracking-wider"
            style={{
              paddingLeft: 'var(--rb-space-2, 0.5rem)',
              paddingRight: 'var(--rb-space-2, 0.5rem)',
              paddingTop: 'calc(0.125rem * var(--rb-ui-scale, 1))',
              paddingBottom: 'calc(0.125rem * var(--rb-ui-scale, 1))',
              gap: 'var(--rb-space-1, 0.25rem)',
              fontSize: 'var(--rb-text-xs, 0.625rem)',
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
                className="rounded-full animate-pulse"
                style={{ 
                  height: 'calc(0.375rem * var(--rb-ui-scale, 1))',
                  width: 'calc(0.375rem * var(--rb-ui-scale, 1))',
                  background: 'var(--rb-ui-danger)'
                }}
              />
            )}
            <span>{isRecording ? 'REC' : modeLabel}</span>
            <span style={{ color: 'var(--rb-ui-text-3)' }}>
              T{tickCount.toString().padStart(4, '0')}
            </span>
          </button>
        </div>

        {/* Right: Theme + Log + Settings */}
        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            onClick={toggleTheme}
            className="rounded flex items-center justify-center transition-colors hover:opacity-75"
            aria-label={`Switch to ${variant === 'light' ? 'dark' : 'light'} mode`}
            title={`${variant === 'light' ? 'Dark' : 'Light'} mode`}
            style={{ 
              height: 'var(--rb-icon-md, 24px)',
              width: 'var(--rb-icon-md, 24px)',
              color: 'var(--rb-ui-text-3)'
            }}
          >
            <Icon name={variant === 'light' ? 'moon' : 'sun'} size={14} />
          </button>
          {onOpenLog && (
            <button
              onClick={onOpenLog}
              className="relative rounded flex items-center font-medium transition-colors"
              aria-label="Open System Log"
              title="Open System Log"
              style={{ 
                height: 'var(--rb-icon-md, 24px)',
                paddingLeft: 'var(--rb-space-2, 0.5rem)',
                paddingRight: 'var(--rb-space-2, 0.5rem)',
                gap: 'var(--rb-space-1, 0.375rem)',
                fontSize: 'var(--rb-text-xs, 0.6875rem)',
                color: 'var(--rb-ui-text-2)'
              }}
            >
              <Icon name="log" size={14} />
              <span>Log</span>
              {unreadCount > 0 && (
                <span
                  className="rounded-full font-bold text-white flex items-center justify-center"
                  style={{ 
                    height: 'calc(16px * var(--rb-ui-scale, 1))',
                    minWidth: 'calc(16px * var(--rb-ui-scale, 1))',
                    paddingLeft: 'calc(0.25rem * var(--rb-ui-scale, 1))',
                    paddingRight: 'calc(0.25rem * var(--rb-ui-scale, 1))',
                    fontSize: 'calc(9px * var(--rb-ui-scale, 1))',
                    background: 'var(--rb-ui-danger)'
                  }}
                >
                  {Math.min(unreadCount, 99)}
                </span>
              )}
            </button>
          )}
          {versionLabel && (
            <span
              className="font-mono tracking-wide select-none"
              style={{ 
                fontSize: 'calc(9px * var(--rb-ui-scale, 1))',
                color: 'var(--rb-ui-text-3)', 
                opacity: 0.6 
              }}
              title="Build version (Ctrl+/ for details)"
            >
              {versionLabel}
            </span>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="rounded flex items-center justify-center transition-colors"
              aria-label="Open Settings"
              title="Open Settings (Ctrl/Cmd+,)"
              style={{ 
                height: 'var(--rb-icon-md, 24px)',
                width: 'var(--rb-icon-md, 24px)',
                color: 'var(--rb-ui-text-3)'
              }}
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
