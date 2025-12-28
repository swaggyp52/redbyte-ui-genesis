// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, Input } from '@redbyte/rb-primitives';

export interface Macro {
  id: string;
  name: string;
  steps: unknown[];
}

interface MacroRunnerProps {
  macros: Macro[];
  onExecute: (macroId: string) => void;
  onClose: () => void;
}

export const MacroRunner: React.FC<MacroRunnerProps> = ({
  macros,
  onExecute,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMacros = useMemo(() => {
    if (!query) return macros;
    const lowerQuery = query.toLowerCase();
    return macros.filter((m) => m.name.toLowerCase().includes(lowerQuery));
  }, [macros, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredMacros.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = filteredMacros[selectedIndex];
      if (!selected) return;
      onExecute(selected.id);
      onClose();
      return;
    }
  };

  const handleMacroClick = (macroId: string) => {
    onExecute(macroId);
    onClose();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Run Macro"
      variant="center"
      size="md"
      closeOnEsc={true}
      closeOnBackdrop={true}
      initialFocusRef={inputRef}
    >
      <div className="space-y-4">
        {/* Search Input */}
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to filter..."
          size="md"
          aria-label="Filter macros"
        />

        {/* Macro List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredMacros.length === 0 && (
            <div className="text-gray-400 text-center py-8">
              {query ? 'No macros found' : 'No macros available'}
            </div>
          )}

          {filteredMacros.map((macro, index) => {
            const isSelected = index === selectedIndex;
            const stepCount = macro.steps.length;

            return (
              <button
                key={macro.id}
                onClick={() => handleMacroClick(macro.id)}
                className={`
                  w-full text-left px-3 py-2 my-1 rounded
                  transition-colors
                  ${isSelected ? 'bg-slate-700 border border-cyan-500' : 'border border-transparent hover:bg-slate-700/50'}
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                `}
                role="option"
                aria-selected={isSelected}
              >
                <div className="text-gray-100 font-medium">{macro.name}</div>
                <div className="text-sm text-gray-400 mt-1">
                  {stepCount} step{stepCount !== 1 ? 's' : ''}
                </div>
              </button>
            );
          })}
        </div>

        {/* Keyboard Hints */}
        <div className="text-gray-400 text-sm space-y-1 pt-3 border-t border-slate-700">
          <div>↑↓: Navigate</div>
          <div>Enter: Execute</div>
          <div>Esc: Cancel</div>
        </div>
      </div>
    </Modal>
  );
};
