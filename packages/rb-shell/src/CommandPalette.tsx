// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState } from 'react';

export type Command =
  | 'focus-next-window'
  | 'close-focused-window'
  | 'minimize-focused-window'
  | 'snap-left'
  | 'snap-right'
  | 'snap-top'
  | 'snap-bottom'
  | 'center-window'
  | 'create-workspace'
  | 'switch-workspace'
  | 'delete-workspace'
  | 'run-macro';

interface CommandItem {
  id: Command;
  label: string;
  description: string;
}

const COMMANDS: CommandItem[] = [
  {
    id: 'focus-next-window',
    label: 'Focus Next Window',
    description: 'Cycle to the next window',
  },
  {
    id: 'close-focused-window',
    label: 'Close Window',
    description: 'Close the currently focused window',
  },
  {
    id: 'minimize-focused-window',
    label: 'Minimize Window',
    description: 'Minimize the currently focused window',
  },
  {
    id: 'snap-left',
    label: 'Snap Left',
    description: 'Snap window to left half of screen',
  },
  {
    id: 'snap-right',
    label: 'Snap Right',
    description: 'Snap window to right half of screen',
  },
  {
    id: 'snap-top',
    label: 'Snap Top',
    description: 'Snap window to top half of screen',
  },
  {
    id: 'snap-bottom',
    label: 'Snap Bottom',
    description: 'Snap window to bottom half of screen',
  },
  {
    id: 'center-window',
    label: 'Center Window',
    description: 'Center window on screen',
  },
  {
    id: 'create-workspace',
    label: 'Create Workspace',
    description: 'Save current windows as named workspace',
  },
  {
    id: 'switch-workspace',
    label: 'Switch Workspace',
    description: 'Switch to a different workspace',
  },
  {
    id: 'delete-workspace',
    label: 'Delete Workspace',
    description: 'Delete a workspace',
  },
  {
    id: 'run-macro',
    label: 'Run Macro',
    description: 'Execute a saved macro sequence',
  },
];

interface CommandPaletteProps {
  onExecute: (command: Command) => void;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onExecute, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, COMMANDS.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const command = COMMANDS[selectedIndex];
      onExecute(command.id);
      onClose();
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center pt-32 z-[9999]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-cyan-500/30 rounded-lg shadow-2xl w-[500px] overflow-hidden"
        style={{ outline: 'none' }}
      >
        <div className="p-3 border-b border-slate-800 bg-slate-950">
          <div className="text-xs font-semibold text-slate-400 uppercase">Command Palette</div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {COMMANDS.map((command, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={command.id}
                onClick={() => {
                  onExecute(command.id);
                  onClose();
                }}
                className={`w-full text-left p-3 border-b border-slate-800 transition-colors ${
                  isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-medium text-sm">{command.label}</div>
                <div className="text-xs text-slate-500 mt-1">{command.description}</div>
              </button>
            );
          })}
        </div>

        <div className="p-2 border-t border-slate-800 text-xs text-slate-500 bg-slate-950">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Execute{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close
        </div>
      </div>
    </div>
  );
};
