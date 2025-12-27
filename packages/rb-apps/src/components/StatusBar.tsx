// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

interface StatusBarProps {
  nodeCount: number;
  connectionCount: number;
  selectedCount: number;
  isRunning: boolean;
  tickRate: number;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  viewMode: string;
  zoom?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  nodeCount,
  connectionCount,
  selectedCount,
  isRunning,
  tickRate,
  isDirty,
  canUndo,
  canRedo,
  viewMode,
  zoom = 1,
}) => {
  return (
    <div className="h-7 bg-gray-950 border-t border-gray-800 flex items-center justify-between px-3 text-xs text-gray-400">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Node Count */}
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400">📦</span>
          <span>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Connection Count */}
        <div className="flex items-center gap-1.5">
          <span className="text-green-400">🔌</span>
          <span>{connectionCount} wire{connectionCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Selection */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5 text-purple-400">
            <span>✓</span>
            <span>{selectedCount} selected</span>
          </div>
        )}

        {/* Dirty Indicator */}
        {isDirty && (
          <div className="flex items-center gap-1.5 text-orange-400 animate-pulse">
            <span>●</span>
            <span>Unsaved</span>
          </div>
        )}
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-4">
        {/* Simulation Status */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <>
              <span className="text-green-400 animate-pulse">●</span>
              <span className="text-green-400">Running @ {tickRate}Hz</span>
            </>
          ) : (
            <>
              <span className="text-gray-600">●</span>
              <span>Paused</span>
            </>
          )}
        </div>

        {/* View Mode */}
        <div className="px-2 py-0.5 bg-gray-800 rounded text-cyan-400 capitalize">
          {viewMode}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Undo/Redo Status */}
        <div className="flex items-center gap-2">
          <span className={canUndo ? 'text-gray-400' : 'text-gray-700'}>
            ↶ Undo
          </span>
          <span className={canRedo ? 'text-gray-400' : 'text-gray-700'}>
            ↷ Redo
          </span>
        </div>

        {/* Zoom Level */}
        {viewMode === 'circuit' && (
          <div className="flex items-center gap-1.5">
            <span>🔍</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        )}

        {/* Quick Tip */}
        <div className="text-gray-600 border-l border-gray-800 pl-4">
          Press <kbd className="bg-gray-800 px-1 py-0.5 rounded text-gray-500">?</kbd> for shortcuts
        </div>
      </div>
    </div>
  );
};
