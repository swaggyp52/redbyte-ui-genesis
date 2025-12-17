// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState, useMemo } from 'react';

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
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #5b8cff',
          borderRadius: 8,
          padding: '1rem',
          minWidth: 400,
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Run Macro</h2>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to filter..."
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            backgroundColor: '#2a2a2a',
            border: '1px solid #5b8cff',
            borderRadius: 4,
            color: '#fff',
            outline: 'none',
          }}
        />

        {filteredMacros.length === 0 && (
          <div style={{ color: '#999', padding: '1rem', textAlign: 'center' }}>
            {query ? 'No macros found' : 'No macros available'}
          </div>
        )}

        {filteredMacros.map((macro, index) => {
          const isSelected = index === selectedIndex;
          const stepCount = macro.steps.length;

          return (
            <div
              key={macro.id}
              onClick={() => handleMacroClick(macro.id)}
              style={{
                padding: '0.75rem',
                margin: '0.25rem 0',
                backgroundColor: isSelected ? '#2a2a2a' : 'transparent',
                border: `1px solid ${isSelected ? '#5b8cff' : 'transparent'}`,
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 500 }}>{macro.name}</div>
              <div style={{ fontSize: '0.875rem', color: '#999', marginTop: '0.25rem' }}>
                {stepCount} step{stepCount !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: '1rem', color: '#999', fontSize: '0.875rem' }}>
          <div>↑↓: Navigate</div>
          <div>Enter: Execute</div>
          <div>Esc: Cancel</div>
        </div>
      </div>
    </div>
  );
};
