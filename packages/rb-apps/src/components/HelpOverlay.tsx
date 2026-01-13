/**
 * Classroom Edition Help Overlay
 * 
 * 5-step quickstart + keyboard shortcuts cheat sheet
 * Toggleable via '?' key
 */

import React, { useEffect, useState } from 'react';

interface HelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpOverlay: React.FC<HelpOverlayProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'shortcuts'>('quickstart');

  // Listen for '?' key to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '?' || e.key === '/') && !e.ctrlKey && !e.metaKey) {
        // Only toggle if not typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-600 p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-cyan-400">RedByte Logic Playground</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-600 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('quickstart')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'quickstart'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Quickstart
            </button>
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'shortcuts'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Keyboard Shortcuts
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-cyan-300 mb-4">5-Step Quickstart</h2>

              {/* Step 1 */}
              <div className="border-l-4 border-cyan-500 pl-4">
                <h3 className="font-bold text-lg text-white mb-2">
                  1. Load an Example (or Start Blank)
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  Click <code className="bg-gray-900 px-2 py-1 rounded">Examples</code> in the
                  top menu to choose from 6 pre-built circuits, or start with an empty workspace.
                </p>
                <p className="text-gray-400 text-xs italic">
                  Your work auto-saves every 3 seconds, so you won't lose progress!
                </p>
              </div>

              {/* Step 2 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-bold text-lg text-white mb-2">2. Build Your Circuit</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Drag components from the palette on the left. Connect them with wires. Use the
                  <code className="bg-gray-900 px-2 py-1 rounded ml-1">Delete</code> key to remove
                  selected items.
                </p>
                <p className="text-gray-400 text-xs italic">
                  Pro tip: Right-click to pan the view. Scroll to zoom.
                </p>
              </div>

              {/* Step 3 */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-bold text-lg text-white mb-2">3. Run a Simulation</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Click <code className="bg-gray-900 px-2 py-1 rounded">Run</code> to start
                  simulating. Flip switches to change inputs. Watch lamps light up as outputs
                  change.
                </p>
                <p className="text-gray-400 text-xs italic">
                  Use <code className="bg-gray-900 px-2 py-1 rounded">Step</code> to advance one
                  tick at a time.
                </p>
              </div>

              {/* Step 4 */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-bold text-lg text-white mb-2">4. Analyze Results</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Switch to <code className="bg-gray-900 px-2 py-1 rounded">Analyze</code> view
                  to see signal traces over time. Click on nodes to add probes to the oscilloscope.
                </p>
                <p className="text-gray-400 text-xs italic">
                  This helps you debug timing issues and verify logic correctness.
                </p>
              </div>

              {/* Step 5 */}
              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="font-bold text-lg text-white mb-2">5. Export & Submit</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Click <code className="bg-gray-900 px-2 py-1 rounded">Export</code> to download
                  your circuit as JSON. Submit it to your professor or LMS.
                </p>
                <p className="text-gray-400 text-xs italic">
                  Your autosaved work is safe in the browser until you reset.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-cyan-300 mb-4">Keyboard Shortcuts</h2>

              <div className="space-y-3">
                {[
                  { key: 'Ctrl/Cmd+Z', action: 'Undo' },
                  { key: 'Ctrl/Cmd+Y', action: 'Redo' },
                  { key: 'Delete', action: 'Delete selected item' },
                  { key: 'Ctrl/Cmd+S', action: 'Save project' },
                  { key: 'Space', action: 'Play/Pause simulation' },
                  { key: 'R', action: 'Reset simulation' },
                  { key: 'S', action: 'Step one tick' },
                  { key: '?', action: 'Toggle this help' },
                  { key: 'Tab', action: 'Cycle perspectives' },
                  { key: 'Right-Click + Drag', action: 'Pan view' },
                  { key: 'Scroll', action: 'Zoom in/out' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between bg-gray-900/50 p-3 rounded border border-gray-700"
                  >
                    <code className="bg-gray-800 px-3 py-1 rounded text-cyan-400 font-mono text-sm">
                      {item.key}
                    </code>
                    <span className="text-gray-300 text-sm ml-4">{item.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-600 bg-gray-900 p-4 text-center text-sm text-gray-400">
          Press <code className="bg-gray-800 px-2 py-1 rounded">?</code> anytime to open this help
        </div>
      </div>
    </div>
  );
};
