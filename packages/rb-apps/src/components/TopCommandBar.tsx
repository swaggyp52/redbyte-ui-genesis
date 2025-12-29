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

  // Simulation controls (primary)
  isRunning: boolean;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset?: () => void;
  tickRate: number;
  onTickRateChange: (hz: number) => void;

  // Mode + Help
  viewMode: 'build' | 'analyze' | 'learn' | 'quad';
  onViewModeChange: (mode: 'build' | 'analyze' | 'learn' | 'quad') => void;
  onHelp: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  onNew,
  onSave,
  onSaveAs,
  onExamples,
  onShare,
  isDirty = false,
  isRunning,
  onRun,
  onPause,
  onStep,
  onReset,
  tickRate,
  onTickRateChange,
  viewMode,
  onViewModeChange,
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

      {/* RIGHT: Mode + Help */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Mode</span>

        {/* View Mode Selector */}
        <div className="flex items-center gap-1 bg-gray-800/50 rounded p-0.5">
          {(['build', 'analyze', 'learn', 'quad'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-3 py-1.5 text-sm rounded capitalize transition-all ${
                viewMode === mode
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`}
            >
              {mode === 'build' && '🔧'}
              {mode === 'analyze' && '📊'}
              {mode === 'learn' && '📖'}
              {mode === 'quad' && '▦'}
              <span className="ml-1.5">{mode}</span>
            </button>
          ))}
        </div>

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
