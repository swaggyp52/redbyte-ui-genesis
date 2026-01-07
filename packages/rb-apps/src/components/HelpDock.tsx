// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Help Dock for PR4 - Learn Mode Integration
 *
 * Dockable Help panel that appears in Learn mode
 * - Shows current lesson/track
 * - Breadcrumb navigation
 * - "Back to lesson" button
 * - Load example integration with highlighting
 */

import React, { useState } from 'react';
import type { ExampleId } from '../examples';

export interface HelpDockProps {
  visible: boolean;
  onClose?: () => void;
  onLoadExample?: (exampleId: ExampleId, highlightComponents?: string[]) => void;
  width?: number;
  focusSection?: HelpSectionId | null;
}

interface Lesson {
  id: string;
  title: string;
  content: React.ReactNode;
  example?: ExampleId;
  highlightComponents?: string[];
}

export type HelpSectionId =
  | 'circuit-controls'
  | 'schematic-controls'
  | 'scope-controls'
  | '3d-controls';

const CONTROL_SECTIONS: Record<
  HelpSectionId,
  { title: string; summary: string; items: string[] }
> = {
  'circuit-controls': {
    title: 'Circuit Controls',
    summary: 'Build, wire, and inspect with precise input control.',
    items: [
      'Click switches to toggle inputs instantly',
      'W: Toggle wire tool, click ports to connect',
      'G: Toggle snap to grid (Alt to temporarily disable)',
      'F: Fit circuit to view, 0: Reset view',
      'Drag to move, Shift+Click to multi-select, Delete to remove',
      'Ctrl/Cmd+Z: Undo, Ctrl/Cmd+Shift+Z: Redo',
    ],
  },
  'schematic-controls': {
    title: 'Schematic Controls',
    summary: 'Inspect IEEE/ANSI symbols with clean pan/zoom.',
    items: [
      'Shift+Drag to pan, Scroll to zoom',
      'Drag nodes to reposition in schematic view',
      'F: Fit to view, 0: Reset view',
    ],
  },
  'scope-controls': {
    title: 'Scope Controls',
    summary: 'Inspect signals over time without losing data.',
    items: [
      'Pause Scroll keeps sampling while view stops auto-follow',
      'Wheel pan while paused to inspect history',
      'Clear resets the scope display only when you request it',
      'Time cursor shows current time; toggle if needed',
      'Trace labels show probe name and latest value',
    ],
  },
  '3d-controls': {
    title: '3D Controls',
    summary: 'See live signals with spatial context.',
    items: [
      'Click nodes to select (syncs to other views)',
      'Follow Selection keeps camera centered on selection',
      'Animate signal flow emphasizes active connections',
      'Use Fit to re-center the scene',
    ],
  },
};

const COMMON_SHORTCUTS = [
  'Layout: 1-5 presets, Shift+1-4 single views',
  'Probes: Right-click ports to toggle, Shift+P opens Probes tab',
];

const SAMPLE_LESSONS: Lesson[] = [
  {
    id: 'intro-1',
    title: 'Your First Circuit',
    example: '01_wire-lamp',
    highlightComponents: ['Wire', 'Lamp'],
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Welcome to RedByte Logic!</h3>
        <p className="text-sm text-gray-300">
          Let's start with the simplest circuit: a wire connected to a lamp.
        </p>
        <div className="bg-cyan-900/20 border border-cyan-700/30 rounded p-3">
          <div className="text-xs font-semibold text-cyan-400 mb-2">🎯 Learning Goals</div>
          <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
            <li>Understand signal flow</li>
            <li>See how wires carry electricity</li>
            <li>Use the Step button</li>
          </ul>
        </div>
        <div className="bg-blue-900/20 border border-blue-700/30 rounded p-3">
          <div className="text-xs font-semibold text-blue-400 mb-2">👉 Try This</div>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Load the example below</li>
            <li>Click the <strong>Step</strong> button</li>
            <li>Watch the lamp light up!</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: 'intro-2',
    title: 'Interactive Control',
    example: '02_switch-lamp',
    highlightComponents: ['Switch', 'Lamp'],
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Adding a Switch</h3>
        <p className="text-sm text-gray-300">
          Now let's add control! A switch lets you turn the circuit on and off.
        </p>
        <div className="bg-cyan-900/20 border border-cyan-700/30 rounded p-3">
          <div className="text-xs font-semibold text-cyan-400 mb-2">🎯 Learning Goals</div>
          <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
            <li>Control signal flow</li>
            <li>Toggle switches interactively</li>
            <li>Understand binary: ON (1) and OFF (0)</li>
          </ul>
        </div>
        <div className="bg-blue-900/20 border border-blue-700/30 rounded p-3">
          <div className="text-xs font-semibold text-blue-400 mb-2">👉 Try This</div>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Load the example</li>
            <li>Click the switch to toggle it</li>
            <li>Press Step to see the change</li>
            <li>Watch the lamp respond!</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: 'gates-1',
    title: 'Logic Gates: AND',
    example: '03_and-gate',
    highlightComponents: ['AND', 'Switch'],
    content: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">The AND Gate</h3>
        <p className="text-sm text-gray-300">
          An AND gate outputs 1 (HIGH) only when <strong>both</strong> inputs are 1.
        </p>
        <div className="bg-purple-900/20 border border-purple-700/30 rounded p-3">
          <div className="text-xs font-semibold text-purple-400 mb-2">📊 Truth Table</div>
          <table className="text-xs text-gray-300 w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-1 text-left">A</th>
                <th className="py-1 text-left">B</th>
                <th className="py-1 text-left">Output</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr><td>0</td><td>0</td><td className="text-red-400">0</td></tr>
              <tr><td>0</td><td>1</td><td className="text-red-400">0</td></tr>
              <tr><td>1</td><td>0</td><td className="text-red-400">0</td></tr>
              <tr><td>1</td><td>1</td><td className="text-green-400">1</td></tr>
            </tbody>
          </table>
        </div>
        <div className="bg-blue-900/20 border border-blue-700/30 rounded p-3">
          <div className="text-xs font-semibold text-blue-400 mb-2">👉 Experiment</div>
          <p className="text-sm text-gray-300">
            Try all 4 combinations of switch positions. Notice the lamp only lights when both switches are ON!
          </p>
        </div>
      </div>
    ),
  },
];

export const HelpDock: React.FC<HelpDockProps> = ({
  visible,
  onClose,
  onLoadExample,
  width = 400,
  focusSection,
}) => {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!visible) return null;

  const focusedSection = focusSection ? CONTROL_SECTIONS[focusSection] : null;
  const currentLesson = SAMPLE_LESSONS[currentLessonIndex];
  const hasPrev = currentLessonIndex > 0;
  const hasNext = currentLessonIndex < SAMPLE_LESSONS.length - 1;

  const handleLoadExample = () => {
    if (currentLesson.example && onLoadExample) {
      onLoadExample(currentLesson.example, currentLesson.highlightComponents);
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 border-l border-gray-700 bg-gray-900 flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded hover:bg-gray-800 transition-colors"
          title="Expand Help"
        >
          <span className="text-xl">📖</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="border-l border-gray-700 bg-gray-900 flex flex-col transition-all duration-200"
      style={{ width: `${width}px` }}
    >
      {/* Header with Breadcrumb */}
      <div className="h-12 border-b border-gray-700 bg-gray-850 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📖</span>
          <div className="flex flex-col">
            <div className="text-xs text-gray-500">
              {focusedSection ? 'Controls' : 'Learn Mode'}
            </div>
            <div className="text-sm font-semibold text-white">
              {focusedSection ? focusedSection.title : currentLesson.title}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(true)}
            className="px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm"
            title="Collapse"
          >
            →
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-sm"
              title="Close (Exit Learn Mode)"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb - "You are here" */}
      <div className="px-4 py-2 bg-cyan-900/10 border-b border-gray-700">
        <div className="text-xs text-cyan-400 flex items-center gap-1">
          <span>dY"?</span>
          {focusedSection ? (
            <span>{focusedSection.title}</span>
          ) : (
            <>
              <span>Track A</span>
                <span className="text-gray-600">&gt;</span>
              <span>Lesson {currentLessonIndex + 1} of {SAMPLE_LESSONS.length}</span>
            </>
          )}
        </div>
      </div>

      {/* Lesson Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {focusedSection ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">{focusedSection.summary}</p>
            <div className="bg-gray-800/60 border border-gray-700 rounded p-3">
              <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                {focusedSection.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded p-3">
              <div className="text-xs font-semibold text-slate-300 uppercase mb-2">
                Global Shortcuts
              </div>
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                {COMMON_SHORTCUTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            {currentLesson.content}

            {/* Load Example Button */}
            {currentLesson.example && (
              <button
                onClick={handleLoadExample}
                className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <span className="text-lg">dY"s</span>
                Load Example
              </button>
            )}
          </>
        )}
      </div>

      {/* Navigation Footer */}
      {!focusedSection && (
        <div className="border-t border-gray-700 bg-gray-850 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentLessonIndex(Math.max(0, currentLessonIndex - 1))}
            disabled={!hasPrev}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              hasPrev
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            Previous
          </button>

          <div className="text-xs text-gray-400">
            {currentLessonIndex + 1} / {SAMPLE_LESSONS.length}
          </div>

          <button
            onClick={() => setCurrentLessonIndex(Math.min(SAMPLE_LESSONS.length - 1, currentLessonIndex + 1))}
            disabled={!hasNext}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              hasNext
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
};
