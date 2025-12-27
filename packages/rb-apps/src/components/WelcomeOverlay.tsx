// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';

interface WelcomeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
  onLoadExample?: (exampleId: string) => void;
}

const QUICK_START_EXAMPLES = [
  {
    id: '01_wire-lamp',
    title: '💡 Your First Circuit',
    description: 'Power source connected to a lamp - see electricity flow',
    difficulty: 'Beginner',
    time: '30 seconds',
  },
  {
    id: '02_and-gate',
    title: '∧ Logic Gates',
    description: 'Learn how AND gates work with switches and lamps',
    difficulty: 'Beginner',
    time: '2 minutes',
  },
  {
    id: '03_or-xor',
    title: '⊕ Comparing Gates',
    description: 'See the difference between OR and XOR gates',
    difficulty: 'Intermediate',
    time: '3 minutes',
  },
];

const FEATURES = [
  { icon: '🎨', title: 'Drag & Drop', description: 'Build circuits by dragging components onto the canvas' },
  { icon: '⚡', title: 'Live Simulation', description: 'Watch signals flow through your circuit in real-time' },
  { icon: '🔌', title: 'Easy Wiring', description: 'Click port → Click port to connect components' },
  { icon: '📊', title: 'Multiple Views', description: 'See your circuit in 2D, 3D, schematic, and oscilloscope' },
  { icon: '💾', title: 'Auto-Save', description: 'Your work is automatically saved and crash-protected' },
  { icon: '⌨️', title: 'Power User', description: 'Keyboard shortcuts for everything - press ? for help' },
];

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({
  isOpen,
  onClose,
  onStartTutorial,
  onLoadExample,
}) => {
  const [currentPage, setCurrentPage] = useState<'welcome' | 'examples'>('welcome');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-cyan-500 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {currentPage === 'welcome' ? (
          <>
            {/* Header */}
            <div className="p-8 border-b border-gray-800 bg-gradient-to-r from-cyan-900/20 to-purple-900/20">
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-2">
                Welcome to Logic Playground
              </h1>
              <p className="text-gray-300 text-lg">
                Build, simulate, and understand digital logic circuits - visually and interactively
              </p>
            </div>

            {/* Features Grid */}
            <div className="p-8 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {FEATURES.map((feature, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all"
                  >
                    <div className="text-3xl mb-2">{feature.icon}</div>
                    <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                    <p className="text-gray-400 text-sm">{feature.description}</p>
                  </div>
                ))}
              </div>

              {/* Quick Tips */}
              <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-6">
                <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
                  <span>💡</span> Pro Tips
                </h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Press <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">Space</kbd> to quickly add components anywhere</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Use <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">?</kbd> to see all keyboard shortcuts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Click switches to toggle them, watch signals flow through wires</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>Your circuits auto-save every 5 seconds - no manual saving needed!</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex gap-3">
              {onStartTutorial && (
                <button
                  onClick={() => {
                    onStartTutorial();
                    onClose();
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-lg font-semibold text-white transition-all shadow-lg"
                >
                  🎓 Start Interactive Tutorial
                </button>
              )}
              <button
                onClick={() => setCurrentPage('examples')}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all"
              >
                📚 Try an Example
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold text-gray-300 transition-all"
              >
                Start Building
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Examples Page */}
            <div className="p-8 border-b border-gray-800">
              <button
                onClick={() => setCurrentPage('welcome')}
                className="text-cyan-400 hover:text-cyan-300 mb-4 flex items-center gap-2"
              >
                ← Back
              </button>
              <h2 className="text-3xl font-bold text-white mb-2">Quick Start Examples</h2>
              <p className="text-gray-400">Load a pre-built circuit to see how it works</p>
            </div>

            <div className="p-8 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {QUICK_START_EXAMPLES.map((example) => (
                  <div
                    key={example.id}
                    onClick={() => {
                      if (onLoadExample) {
                        onLoadExample(example.id);
                        onClose();
                      }
                    }}
                    className="p-6 bg-gray-800 rounded-lg border-2 border-gray-700 hover:border-cyan-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-semibold text-white">{example.title}</h3>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-cyan-600/20 text-cyan-400 text-xs rounded">
                          {example.difficulty}
                        </span>
                        <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">
                          {example.time}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-400">{example.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-900/50">
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
