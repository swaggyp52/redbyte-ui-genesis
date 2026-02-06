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
        background: 'var(--rb-ui-bg)',
        color: 'var(--rb-ui-text)',
        overflow: 'hidden',
      }}
    >
      {/* Optional title bar for non-integrated apps */}
      {title && (
        <div
          className="flex items-center justify-between h-9 px-3 border-b bg-surface-1"
          style={{
            borderColor: focused ? 'var(--rb-ui-border-strong)' : 'var(--rb-ui-border)',
            background: focused ? 'var(--rb-ui-surface-2)' : 'var(--rb-ui-surface-1)',
          }}
        >
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--rb-ui-text-2)' }}>
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
            <div
              className="rounded p-4 max-w-sm text-center"
              style={{
                border: '1px solid var(--rb-ui-danger)',
                background: 'var(--rb-ui-surface-2)',
              }}
            >
              <p className="text-sm mb-2" style={{ color: 'var(--rb-ui-danger)' }}>
                {error}
              </p>
              {onErrorReset && (
                <button
                  onClick={onErrorReset}
                  className="text-xs px-3 py-1 rounded transition-colors"
                  style={{
                    background: 'var(--rb-ui-surface-3)',
                    color: 'var(--rb-ui-danger)',
                  }}
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
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{
                  borderColor: 'var(--rb-ui-border)',
                  borderTopColor: 'var(--rb-ui-accent)',
                }}
              />
              <span className="text-xs" style={{ color: 'var(--rb-ui-text-2)' }}>
                Loading...
              </span>
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
