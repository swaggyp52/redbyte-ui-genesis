// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { category: 'File Operations', items: [
      { keys: `${modKey}+S`, description: 'Save current file' },
      { keys: `${modKey}+Shift+S`, description: 'Save as new file' },
      { keys: `${modKey}+O`, description: 'Open file' },
      { keys: `${modKey}+Shift+C`, description: 'Share circuit (copy link)' },
    ]},
    { category: 'Edit', items: [
      { keys: `${modKey}+Z`, description: 'Undo' },
      { keys: `${modKey}+Y` + (isMac ? '' : ' / Ctrl+Shift+Z'), description: 'Redo' },
      { keys: 'Delete / Backspace', description: 'Delete selected items' },
      { keys: 'Escape', description: 'Clear selection / Cancel wire' },
    ]},
    { category: 'View Controls', items: [
      { keys: `${modKey}+F`, description: 'Fit circuit to view' },
      { keys: `${modKey}+R`, description: 'Reset view position' },
      { keys: `${modKey}+0`, description: 'Reset zoom to 100%' },
      { keys: 'Scroll', description: 'Zoom in/out' },
      { keys: 'Shift+Drag', description: 'Pan view' },
    ]},
    { category: 'Circuit Interaction', items: [
      { keys: 'Click port → Click port', description: 'Connect components' },
      { keys: 'Drag node', description: 'Move component' },
      { keys: 'Shift+Click', description: 'Multi-select' },
      { keys: 'Space', description: 'Run/Pause simulation' },
    ]},
    { category: 'Help', items: [
      { keys: '?', description: 'Show this help dialog' },
    ]},
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {shortcuts.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-semibold text-cyan-400 mb-3 uppercase tracking-wide">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <kbd className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-white whitespace-nowrap">
                      {shortcut.keys}
                    </kbd>
                    <span className="text-gray-300 flex-1 text-right">
                      {shortcut.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-3 text-center text-xs text-gray-500">
          Press <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Esc</kbd> or click outside to close
        </div>
      </div>
    </div>
  );
};
