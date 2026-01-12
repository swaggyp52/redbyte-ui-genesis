// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { shallow } from 'zustand/shallow';
import type { Circuit } from '@redbyte/rb-logic-core';
import { calculateFitToView, useLogicViewStore } from '@redbyte/rb-logic-view';

interface CircuitToolStripProps {
  circuit: Circuit;
  width: number;
  height: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const CircuitToolStrip: React.FC<CircuitToolStripProps> = ({
  circuit,
  width,
  height,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  // Use shallow comparison to only re-render when the selected state actually changes
  const {
    toolMode,
    setToolMode,
    snapToGrid,
    toggleSnapToGrid,
    setCamera,
  } = useLogicViewStore(
    (state) => ({
      toolMode: state.toolMode,
      setToolMode: state.setToolMode,
      snapToGrid: state.snapToGrid,
      toggleSnapToGrid: state.toggleSnapToGrid,
      setCamera: state.setCamera,
    }),
    shallow
  );

  const handleFit = () => {
    if (width <= 0 || height <= 0) return;
    const nextCamera = calculateFitToView(circuit.nodes, width, height);
    setCamera(nextCamera);
  };

  const handleReset = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  return (
    <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md border border-gray-700/70 bg-gray-900/80 px-2 py-1 text-[11px] text-gray-300 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setToolMode('select')}
          className={`px-2 py-1 rounded transition-colors ${
            toolMode === 'select'
              ? 'bg-cyan-700 text-white'
              : 'bg-gray-800/70 hover:bg-gray-700 text-gray-300'
          }`}
          title="Select tool (Esc)"
        >
          Select
        </button>
        <button
          type="button"
          onClick={() => setToolMode(toolMode === 'wire' ? 'select' : 'wire')}
          className={`px-2 py-1 rounded transition-colors ${
            toolMode === 'wire'
              ? 'bg-cyan-700 text-white'
              : 'bg-gray-800/70 hover:bg-gray-700 text-gray-300'
          }`}
          title="Wire tool (W)"
        >
          Wire
        </button>
      </div>

      <div className="h-4 w-px bg-gray-700/60" />

      <span className="text-[10px] text-gray-400" title="Hold Space to pan">
        Space: Pan
      </span>

      <button
        type="button"
        onClick={toggleSnapToGrid}
        className={`px-2 py-1 rounded transition-colors ${
          snapToGrid ? 'bg-gray-700 text-white' : 'bg-gray-800/70 hover:bg-gray-700 text-gray-300'
        }`}
        title="Toggle snap to grid (G)"
      >
        Snap {snapToGrid ? 'On' : 'Off'}
      </button>

      <div className="h-4 w-px bg-gray-700/60" />

      <button
        type="button"
        onClick={handleFit}
        className="px-2 py-1 rounded bg-gray-800/70 hover:bg-gray-700 transition-colors"
        title="Fit to view (F)"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={handleReset}
        className="px-2 py-1 rounded bg-gray-800/70 hover:bg-gray-700 transition-colors"
        title="Reset view (0)"
      >
        Reset
      </button>

      <div className="h-4 w-px bg-gray-700/60" />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className={`px-2 py-1 rounded transition-colors ${
          canUndo
            ? 'bg-gray-800/70 hover:bg-gray-700 text-gray-200'
            : 'bg-gray-800/40 text-gray-600 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className={`px-2 py-1 rounded transition-colors ${
          canRedo
            ? 'bg-gray-800/70 hover:bg-gray-700 text-gray-200'
            : 'bg-gray-800/40 text-gray-600 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Shift+Z)"
      >
        Redo
      </button>
    </div>
  );
};
