// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { TickEngine } from '@redbyte/rb-logic-core';
import type { ToolMode } from '../useLogicViewStore';

export interface ToolbarProps {
  engine?: TickEngine;
  onAddNode?: (type: string) => void;
  onDelete?: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  toolMode?: ToolMode;
  onToolModeChange?: (mode: ToolMode) => void;
  onFitToView?: () => void;
  onResetView?: () => void;
}

const NODE_TYPES = [
  'PowerSource',
  'Switch',
  'Lamp',
  'Wire',
  'AND',
  'OR',
  'NOT',
  'NAND',
  'XOR',
  'Clock',
  'Delay',
];

export const Toolbar: React.FC<ToolbarProps> = ({
  engine,
  onAddNode,
  onDelete,
  snapToGrid,
  onToggleSnap,
  toolMode = 'select',
  onToolModeChange,
  onFitToView,
  onResetView,
}) => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [tickRate, setTickRate] = React.useState(engine?.getTickRate() ?? 20);
  const [tickCount, setTickCount] = React.useState(0);

  React.useEffect(() => {
    if (!engine) return;

    const interval = setInterval(() => {
      setIsRunning(engine.isRunning());
      setTickCount(engine.getTickCount());
    }, 100);

    return () => clearInterval(interval);
  }, [engine]);

  const handleRun = () => {
    if (!engine) return;
    if (isRunning) {
      engine.pause();
    } else {
      engine.start();
    }
    setIsRunning(!isRunning);
  };

  const handleStep = () => {
    engine?.stepOnce();
    setTickCount(engine?.getTickCount() ?? 0);
  };

  const handleTickRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseInt(e.target.value, 10);
    setTickRate(rate);
    engine?.setTickRate(rate);
  };

  return (
    <div className="absolute top-3 left-3 bg-neutral-900/95 backdrop-blur border border-neutral-800 rounded-lg p-2 flex items-center gap-2 z-50 text-sm text-neutral-200 shadow-xl">
      {/* Simulation controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRun}
          className={`px-3 py-1.5 rounded text-white font-medium transition-colors ${isRunning ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
            }`}
        >
          {isRunning ? 'Pause' : 'Run'}
        </button>
        <button
          onClick={handleStep}
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          Step
        </button>
        <div className="flex items-center gap-2 px-2 text-neutral-400">
          <label htmlFor="tickRate" className="text-xs uppercase tracking-wider font-bold">Hz</label>
          <input
            id="tickRate"
            type="range"
            min="1"
            max="60"
            value={tickRate}
            onChange={handleTickRateChange}
            className="w-20 accent-cyan-500"
          />
          <span className="w-6 text-right font-mono text-neutral-300">{tickRate}</span>
        </div>
        <span className="text-neutral-500 font-mono text-xs border-l border-neutral-800 pl-3 ml-1">
          {tickCount} ticks
        </span>
      </div>

      {/* Tool mode toggle */}
      {onToolModeChange && (
        <div className="ml-2 pl-2 border-l border-neutral-800">
          <button
            type="button"
            onClick={() => onToolModeChange(toolMode === 'wire' ? 'select' : 'wire')}
            className={`px-3 py-1.5 rounded font-medium transition-all ${toolMode === 'wire'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
              }`}
            title="Toggle Wire Mode (W)"
          >
            {toolMode === 'wire' ? '⚡ Wire' : '🔌 Wire'}
          </button>
        </div>
      )}

      {/* Add node menu */}
      <div className="ml-2">
        <select
          onChange={(e) => {
            if (e.target.value) {
              onAddNode?.(e.target.value);
              e.target.value = '';
            }
          }}
          className="bg-neutral-800 border-none text-neutral-200 text-sm rounded px-3 py-1.5 hover:bg-neutral-700 cursor-pointer focus:ring-2 focus:ring-cyan-500/50 outline-none"
          aria-label="Add Node"
        >
          <option value="">Add Node...</option>
          {NODE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="ml-2 px-3 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        title="Delete Selected (Backspace)"
      >
        Delete
      </button>

      {/* Snap to grid toggle */}
      <label className="ml-3 flex items-center gap-2 cursor-pointer text-xs text-neutral-400 hover:text-neutral-300">
        <input type="checkbox" checked={snapToGrid} onChange={onToggleSnap} className="rounded border-neutral-700 bg-neutral-800 text-cyan-500 focus:ring-0" />
        Snap
      </label>

      {/* View controls */}
      <div className="ml-3 pl-3 border-l border-neutral-800 flex gap-1">
        {onFitToView && (
          <button
            onClick={onFitToView}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Fit to View (F)"
          >
            🔍
          </button>
        )}
        {onResetView && (
          <button
            onClick={onResetView}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Reset View (0)"
          >
            ⟲
          </button>
        )}
      </div>
    </div>
  );
};
