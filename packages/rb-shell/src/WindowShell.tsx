// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { memo } from 'react';

/**
 * Standard Window Shell — consistent app chrome across all apps
 *
 * Provides:
 * - Consistent padding/insets
 * - Titlebar styling
 * - Error state handling
 * - Loading state handling
 * - Overflow handling
 */

export interface WindowShellProps {
  /** Window title */
  title?: string;
  /** Whether window is focused */
  focused?: boolean;
  /** Content to render in the window */
  children: React.ReactNode;
  /** Optional error message */
  error?: string | null;
  /** Optional loading state */
  loading?: boolean;
  /** Error reset callback */
  onErrorReset?: () => void;
}

export const WindowShell: React.FC<WindowShellProps> = memo(({
  title,
  focused = true,
  children,
  error,
  loading,
  onErrorReset,
}) => {
  return (
    <div
      className="flex flex-col h-full w-full"
      style={{
        background: 'var(--rb-surface-0)',
        color: 'var(--rb-text-base)',
        overflow: 'hidden',
      }}
    >
      {/* Optional title bar for non-integrated apps */}
      {title && (
        <div
          className="flex items-center justify-between h-9 px-3 border-b bg-surface-1"
          style={{
            borderColor: focused ? 'var(--rb-border-strong)' : 'var(--rb-border)',
            background: focused ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
          }}
        >
          <span className="text-xs font-semibold text-text-2 truncate">
            {title}
          </span>
        </div>
      )}

      {/* Main content area */}
      <div
        className="flex-1 overflow-auto"
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Error state */}
        {error && (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="rounded border border-red-500/30 bg-red-500/10 p-4 max-w-sm text-center">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              {onErrorReset && (
                <button
                  onClick={onErrorReset}
                  className="text-xs px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && !error && (
          <div className="flex items-center justify-center flex-1">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
              <span className="text-xs text-text-2">Loading...</span>
            </div>
          </div>
        )}

        {/* Content */}
        {!error && !loading && children}
      </div>
    </div>
  );
});

WindowShell.displayName = 'WindowShell';
