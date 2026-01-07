// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

/**
 * Logic Playground vNext Top Command Bar
 *
 * Layout: [Project] [Simulation (primary)] [Mode + Help]
 *
 * Design principles:
 * - Thin, structured, calm
 * - Step Mode is FIRST-CLASS (more prominent than Run)
 * - Clear visual hierarchy
 */

interface TopCommandBarProps {
  // Project controls
  onNew?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onExamples?: () => void;
  onShare?: () => void;
  isDirty?: boolean;

  // Undo/Redo controls
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  // Simulation controls (primary)
  isRunning: boolean;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset?: () => void;
  tickCount: number;
  tickRate: number;
  onTickRateChange: (hz: number) => void;
  onResetTickCount?: () => void;

  // Layout + Help
  perspective: string; // PerspectiveId from layoutStore
  onPerspectiveChange: (perspective: string) => void;
  schematicMiniEnabled?: boolean;
  onToggleSchematicMini?: () => void;
  onHelp: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  onNew,
  onSave,
  onSaveAs,
  onExamples,
  onShare,
  isDirty = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isRunning,
  onRun,
  onPause,
  onStep,
  onReset,
  tickCount,
  tickRate,
  onTickRateChange,
  onResetTickCount,
  perspective,
  onPerspectiveChange,
  schematicMiniEnabled,
  onToggleSchematicMini,
  onHelp,
}) => {
  return (
    <div className="h-12 border-b border-gray-700 bg-gray-900 px-4 flex items-center justify-between gap-6">
      {/* LEFT: Project */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide mr-2">Project</span>
        {onNew && (
          <button
            onClick={onNew}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            title="New Circuit"
          >
            New
          </button>
        )}
        {onExamples && (
          <button
            onClick={onExamples}
            className="px-3 py-1.5 text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded font-medium transition-all shadow-lg"
            title="Load Example"
          >
            📚 Examples
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            className={`px-3 py-1.5 text-sm rounded transition-all ${
              isDirty
                ? 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/30'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            title="Save (Ctrl+S)"
          >
            {isDirty ? '● Save' : 'Save'}
          </button>
        )}
        {onSaveAs && (
          <button
            onClick={onSaveAs}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            title="Save As"
          >
            Save As
          </button>
        )}
        {onShare && (
          <button
            onClick={onShare}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
            title="Share via link"
          >
            Share
          </button>
        )}

        {/* Undo/Redo buttons */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`px-2 py-1.5 text-sm rounded transition-colors ${
              canUndo
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
        )}
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`px-2 py-1.5 text-sm rounded transition-colors ${
              canRedo
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
        )}
      </div>

      {/* CENTER: Simulation (PRIMARY - Step-first design) */}
      <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-1.5 border border-gray-700/50">
        <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Simulate</span>

        {/* STEP - First-class, prominent */}
        <button
          onClick={onStep}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold text-sm transition-all shadow-lg flex items-center gap-2"
          title="Step Once (Space)"
        >
          <span className="text-lg">⏭</span>
          <span>Step</span>
        </button>

        {/* RUN/PAUSE - Secondary but still prominent */}
        <button
          onClick={isRunning ? onPause : onRun}
          className={`px-4 py-2 rounded font-medium text-sm transition-all flex items-center gap-2 ${
            isRunning
              ? 'bg-yellow-600 hover:bg-yellow-500 shadow-lg'
              : 'bg-green-600 hover:bg-green-500 shadow-lg'
          }`}
          title={isRunning ? 'Pause' : 'Run'}
        >
          {isRunning ? (
            <>
              <span className="text-lg">⏸</span>
              <span>Pause</span>
            </>
          ) : (
            <>
              <span className="text-lg">▶</span>
              <span>Run</span>
            </>
          )}
        </button>

        {/* Tick Rate */}
        <div className="flex items-center gap-2 ml-2 border-l border-gray-700 pl-3">
          <input
            type="range"
            min="1"
            max="60"
            value={tickRate}
            onChange={(e) => onTickRateChange(parseInt(e.target.value, 10))}
            className="w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            title="Tick rate"
          />
          <span className="text-sm font-mono text-cyan-400 w-11 text-right">{tickRate}Hz</span>
        </div>

        {/* Clock Widget */}
        <div className="flex items-center gap-3 border-l border-gray-700 pl-3 text-xs text-gray-300">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-wide text-gray-500">Clock</span>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-cyan-300" title="A tick is one discrete simulation step.">
                T+{tickCount}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isRunning ? 'bg-green-400' : 'bg-gray-500'
                  }`}
                />
                {isRunning ? `${tickRate}Hz` : 'Paused'}
              </span>
            </div>
          </div>
          {onResetTickCount && (
            <button
              onClick={onResetTickCount}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[10px] uppercase tracking-wide text-gray-300"
              title="Reset tick counter"
            >
              Reset
            </button>
          )}
        </div>

        {/* Reset */}
        {onReset && (
          <button
            onClick={onReset}
            className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Reset Circuit"
          >
            <span className="text-lg">↺</span>
          </button>
        )}
      </div>

      {/* RIGHT: Layout + Help */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Layout</span>

        {/* Layout Selector - Dropdown */}
        <select
          value={perspective}
          onChange={(e) => onPerspectiveChange(e.target.value)}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 focus:border-cyan-500 focus:outline-none transition-colors cursor-pointer"
          title="Switch layout (1-5, Shift+1-4)"
        >
          <optgroup label="Workflow Layouts">
            <option value="build">🔧 Build</option>
            <option value="analyze">📊 Analyze</option>
            <option value="explain">📐 Explain</option>
            <option value="explore">🧊 Explore</option>
            <option value="quad">▦ Quad</option>
          </optgroup>
          <optgroup label="Single View">
            <option value="circuit-only">⚡ Circuit Only</option>
            <option value="schematic-only">📐 Schematic Only</option>
            <option value="scope-only">📊 Scope Only</option>
            <option value="3d-only">🧊 3D Only</option>
          </optgroup>
          <optgroup label="Legacy">
            <option value="inspect">🔍 Inspect</option>
            <option value="debug">🐛 Debug</option>
            <option value="schematic">📐 Schematic</option>
            <option value="learn">📖 Learn</option>
          </optgroup>
        </select>

        {perspective === 'schematic' && onToggleSchematicMini && (
          <button
            onClick={onToggleSchematicMini}
            className={`px-3 py-2 rounded text-xs transition-all ${
              schematicMiniEnabled
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
            }`}
            title="Toggle circuit mini view"
          >
            Circuit mini
          </button>
        )}

        {/* Help */}
        <button
          onClick={onHelp}
          className="px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded font-bold transition-all"
          title="Help (?)"
        >
          ?
        </button>
      </div>
    </div>
  );
};
