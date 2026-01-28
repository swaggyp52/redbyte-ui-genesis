// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { PerspectiveId } from '../stores/layoutStore';
import { useClassroomModeStore, isSafeMode } from '../stores/classroomModeStore';
import { Button, Tooltip, Menu } from '@redbyte/rb-primitives';
import { cn } from '../utils/cn'; // Assuming we have a cn utility, or I'll inline it if not exists. I'll assume cn is needed.
// Wait, I saw earlier I failed to import cn from primitives.
// Let's use a simple util or clsx if available.
// I will assume I can just use template literals or inline logic to avoid dependency issues for now, or check for a util.
// The previous file didn't import cn. It used template strings.
// I'll stick to template strings or a local helper.

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
  projectName?: string;
  onNew?: () => void;
  onNewProject?: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onExportProject?: () => void;
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
  onStep: (count?: number) => void;
  onReset?: () => void;
  tickCount: number;
  tickRate: number;
  onTickRateChange: (hz: number) => void;
  onResetTickCount?: () => void;

  // Layout + Help
  perspective: PerspectiveId;
  onPerspectiveChange: (perspective: PerspectiveId) => void;
  schematicMiniEnabled?: boolean;
  onToggleSchematicMini?: () => void;
  onHelp: () => void;
  onStartHere?: () => void;
  onManual?: () => void;
  onExportEvidence?: () => void;
  onOpenEvidence?: () => void;

  // Classroom: Reset callbacks
  onResetWorkspace?: () => void;
  onResetLayout?: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  projectName,
  onNew,
  onNewProject,
  onSaveProject,
  onOpenProject,
  onExportProject,
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
  onStartHere,
  onManual,
  onExportEvidence,
  onOpenEvidence,
  onResetWorkspace,
  onResetLayout,
}) => {
  const { safeMode, setSafeMode, isComplexityWarning } = useClassroomModeStore();
  const [showResetMenu, setShowResetMenu] = React.useState(false);

  const handleSafeModeToggle = () => {
    setSafeMode(!safeMode);
  };

  const handleResetWorkspace = () => {
    if (onResetWorkspace) {
      onResetWorkspace();
    } else {
      if (confirm('Clear all circuits and reset to blank workspace?')) {
        localStorage.removeItem('rb_circuit');
        localStorage.removeItem('rb_layout');
        window.location.reload();
      }
    }
    setShowResetMenu(false);
  };

  const handleResetLayout = () => {
    if (onResetLayout) {
      onResetLayout();
    } else {
      localStorage.removeItem('rb_layout');
      window.location.reload();
    }
    setShowResetMenu(false);
  };

  // PHASE 2C: Mount breadcrumb
  if (import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver)) {
    if (typeof window !== 'undefined' && window.__RB_MOUNT_TRACE__) {
      const timestamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now();
      window.__RB_MOUNT_TRACE__.push(`${timestamp} TopCommandBar:render`);
    }
  }

  return (
    <div
      className="min-h-[48px] border-b border-slate-700 bg-slate-900 px-4 py-2 flex flex-wrap items-center justify-between gap-4 sticky top-0 left-0 right-0 z-[100]"
      style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100 }}
      data-testid="top-command-bar"
      role="toolbar"
      aria-label="Main Toolbar"
    >
      {/* LEFT: Project */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="text-xs text-gray-500 uppercase tracking-wide mr-2">Project</span>
        {projectName && (
          <div className="text-xs text-slate-300 font-medium px-2 py-1 bg-slate-800/60 border border-slate-700/60 rounded">
            {projectName}
            {isDirty ? <span className="ml-1 text-cyan-400">*</span> : null}
          </div>
        )}
        {onNewProject && (
          <button
            onClick={onNewProject}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="New Project"
          >
            New Project
          </button>
        )}
        {onOpenProject && (
          <button
            onClick={onOpenProject}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="Open Project"
          >
            Open Project
          </button>
        )}
        {onSaveProject && (
          <button
            onClick={onSaveProject}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="Save Project"
          >
            Save Project
          </button>
        )}
        {onExportProject && (
          <button
            onClick={onExportProject}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="Export Project Artifacts"
          >
            Export...
          </button>
        )}
        {onNew && (
          <button
            onClick={onNew}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="New Circuit"
          >
            New Circuit
          </button>
        )}
        {onExamples && (
          <button
            onClick={onExamples}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="Load Example"
            data-testid="logic-playground-examples"
          >
            📚 Examples
          </button>
        )}
        {onExportEvidence && (
          <button
            onClick={onExportEvidence}
            className="px-3 py-1.5 text-sm bg-purple-700 hover:bg-purple-600 rounded transition-colors"
            title="Export evidence for grading – includes circuit snapshot, probes, and integrity hash."
            data-testid="export-evidence-button"
          >
            📋 Export Lab Evidence
          </button>
        )}
        {onOpenEvidence && (
          <button
            onClick={onOpenEvidence}
            className="px-3 py-1.5 text-sm bg-emerald-700 hover:bg-emerald-600 rounded transition-colors"
            title="Open Lab Evidence (checks integrity hash - look for PASS badge)"
            data-testid="open-evidence-button"
          >
            🗂️ Open Lab Evidence…
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            className={`px-3 py-1.5 text-sm rounded transition-all ${isDirty
              ? 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/30'
              : 'bg-slate-800 hover:bg-slate-700'
              }`}
            title="Save (Ctrl+S)"
          >
            {isDirty ? '● Save' : 'Save'}
          </button>
        )}
        {onSaveAs && (
          <button
            onClick={onSaveAs}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            title="Save As"
          >
            Save As
          </button>
        )}
        {onShare && (
          <button
            onClick={onShare}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
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
            className={`px-2 py-1.5 text-sm rounded transition-colors ${canUndo
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
            className={`px-2 py-1.5 text-sm rounded transition-colors ${canRedo
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
      <div className="flex flex-wrap items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-1.5 border border-gray-700/50 min-w-0">
        <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Simulate</span>

        {/* STEP - First-class, prominent */}
        <button
          onClick={() => onStep(1)}
          data-testid="logic-playground-step"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold text-sm transition-all shadow-lg flex items-center gap-2"
          title="Step Once (Space)"
        >
          <span className="text-lg">⏭</span>
          <span>Step</span>
        </button>

        {/* RUN/PAUSE - Secondary but still prominent */}
        <button
          onClick={isRunning ? onPause : onRun}
          data-testid="logic-playground-run"
          className={`px-4 py-2 rounded font-medium text-sm transition-all flex items-center gap-2 ${isRunning
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
            aria-label="Tick rate"
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
                  className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-400' : 'bg-gray-500'
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

      {/* RIGHT: Layout + Help (with Overflow) */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Desktop View */}
        <div className="hidden xl:flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Layout</span>

          <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
            <Tooltip content="Standard View">
              <button
                onClick={() => onPerspectiveChange('standard')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${perspective === 'standard'
                    ? 'bg-slate-700 text-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
              >
                Editor
              </button>
            </Tooltip>
            <Tooltip content="Split View (Circuit + Scope)">
              <button
                onClick={() => onPerspectiveChange('split')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${perspective === 'split'
                    ? 'bg-slate-700 text-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
              >
                Split
              </button>
            </Tooltip>
          </div>

          {/* Safe Mode Toggle */}
          <button
            onClick={handleSafeModeToggle}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${safeMode
              ? 'bg-green-700 hover:bg-green-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            title="Toggle Safe Mode (disables 3D, quad, animations)"
          >
            🛡 {safeMode ? 'Safe' : 'Normal'}
          </button>

          {/* Reset Menu */}
          <div className="relative">
            <button
              onClick={() => setShowResetMenu(!showResetMenu)}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all"
              title="Reset workspace or layout"
            >
              ↻
            </button>
            {showResetMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg z-50">
                <button
                  onClick={handleResetWorkspace}
                  className="block w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
                >
                  Reset Workspace
                </button>
                <button
                  onClick={handleResetLayout}
                  className="block w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white border-t border-gray-700 transition-all"
                >
                  Reset Layout
                </button>
              </div>
            )}
          </div>

          {onManual && (
            <button
              onClick={onManual}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold transition-all"
              title="Open Guide"
            >
              Guide
            </button>
          )}
          <button
            onClick={onHelp}
            className="px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded font-bold transition-all text-sm"
            title="Help (?)"
          >
            ?
          </button>
        </div>

        {/* Mobile/Tight View: Overflow Menu */}
        <div className="xl:hidden">
          <Menu label="Layout & Help" align="right">
            <Menu.Item onClick={() => onPerspectiveChange('standard')}>Editor View</Menu.Item>
            <Menu.Item onClick={() => onPerspectiveChange('split')}>Split View</Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={handleSafeModeToggle}>{safeMode ? 'Disable Safe Mode' : 'Enable Safe Mode'}</Menu.Item>
            <Menu.Item onClick={handleResetLayout}>Reset Layout</Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={onHelp}>Shortcuts</Menu.Item>
            {onManual && <Menu.Item onClick={onManual}>Documentation</Menu.Item>}
            {onExamples && <Menu.Item onClick={onExamples}>Examples</Menu.Item>}
          </Menu>
        </div>
      </div>
    </div>
  );
};
