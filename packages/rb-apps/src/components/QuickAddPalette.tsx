// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';

interface Component {
  type: string;
  name: string;
  keywords: string[];
  icon: string;
  color: string;
}

interface QuickAddPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectComponent: (type: string) => void;
  position?: { x: number; y: number };
}

const COMPONENTS: Component[] = [
  { type: 'PowerSource', name: 'Power Source', keywords: ['power', 'on', 'high', 'constant'], icon: '⚡', color: '#4ade80' },
  { type: 'Switch', name: 'Switch', keywords: ['switch', 'toggle', 'input', 'button'], icon: '🔘', color: '#60a5fa' },
  { type: 'INPUT', name: 'Input', keywords: ['input', 'in', 'port'], icon: '📥', color: '#60a5fa' },
  { type: 'Lamp', name: 'Lamp', keywords: ['lamp', 'light', 'led', 'output', 'indicator'], icon: '💡', color: '#fbbf24' },
  { type: 'OUTPUT', name: 'Output', keywords: ['output', 'out', 'port'], icon: '📤', color: '#fbbf24' },
  { type: 'AND', name: 'AND Gate', keywords: ['and', 'gate', 'logic', 'all'], icon: '∧', color: '#c084fc' },
  { type: 'OR', name: 'OR Gate', keywords: ['or', 'gate', 'logic', 'any'], icon: '∨', color: '#f472b6' },
  { type: 'NOT', name: 'NOT Gate', keywords: ['not', 'inverter', 'gate', 'logic', 'negate'], icon: '¬', color: '#fb923c' },
  { type: 'NAND', name: 'NAND Gate', keywords: ['nand', 'gate', 'logic'], icon: '⊼', color: '#a78bfa' },
  { type: 'NOR', name: 'NOR Gate', keywords: ['nor', 'gate', 'logic'], icon: '⊽', color: '#f472b6' },
  { type: 'XOR', name: 'XOR Gate', keywords: ['xor', 'exclusive', 'gate', 'logic', 'different'], icon: '⊕', color: '#ec4899' },
  { type: 'XNOR', name: 'XNOR Gate', keywords: ['xnor', 'gate', 'logic', 'same'], icon: '⊙', color: '#ec4899' },
  { type: 'Clock', name: 'Clock', keywords: ['clock', 'oscillator', 'timer', 'pulse'], icon: '🕐', color: '#22d3ee' },
  { type: 'Delay', name: 'Delay', keywords: ['delay', 'buffer', 'wait'], icon: '⏱️', color: '#a3e635' },
  { type: 'RSLatch', name: 'RS Latch', keywords: ['rs', 'latch', 'memory', 'flip', 'flop'], icon: '🔒', color: '#f87171' },
  { type: 'DFlipFlop', name: 'D Flip-Flop', keywords: ['d', 'flip', 'flop', 'memory', 'register'], icon: '📊', color: '#34d399' },
  { type: 'JKFlipFlop', name: 'JK Flip-Flop', keywords: ['jk', 'flip', 'flop', 'memory'], icon: '📈', color: '#fcd34d' },
  { type: 'FullAdder', name: 'Full Adder', keywords: ['adder', 'add', 'sum', 'arithmetic'], icon: '➕', color: '#818cf8' },
  { type: 'Counter4Bit', name: '4-Bit Counter', keywords: ['counter', 'count', '4bit', 'register'], icon: '🔢', color: '#e879f9' },
];

export const QuickAddPalette: React.FC<QuickAddPaletteProps> = ({
  isOpen,
  onClose,
  onSelectComponent,
  position,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredComponents = COMPONENTS.filter(comp => {
    const query = searchQuery.toLowerCase();
    return (
      comp.name.toLowerCase().includes(query) ||
      comp.keywords.some(k => k.includes(query))
    );
  });

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredComponents.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredComponents.length) % filteredComponents.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredComponents[selectedIndex]) {
        onSelectComponent(filteredComponents[selectedIndex].type);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const style = position
    ? { left: position.x, top: position.y }
    : { left: '50%', top: '20%', transform: 'translateX(-50%)' };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[200]"
        onClick={onClose}
      />

      {/* Palette */}
      <div
        className="fixed z-[201] w-full max-w-2xl"
        style={style}
      >
        <div className="bg-gray-900 border-2 border-cyan-500 rounded-lg shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="p-4 border-b border-gray-700">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type to search components... (e.g., 'and', 'switch', 'memory')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-cyan-500 text-white text-lg"
            />
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredComponents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No components found for "{searchQuery}"
              </div>
            ) : (
              <div>
                {filteredComponents.map((comp, index) => (
                  <div
                    key={comp.type}
                    onClick={() => {
                      onSelectComponent(comp.type);
                      onClose();
                    }}
                    className={`
                      p-4 cursor-pointer border-b border-gray-800 transition-colors
                      ${index === selectedIndex
                        ? 'bg-cyan-600/20 border-l-4 border-l-cyan-400'
                        : 'hover:bg-gray-800'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{comp.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{comp.name}</div>
                        <div className="text-xs text-gray-400">
                          {comp.keywords.slice(0, 3).join(' • ')}
                        </div>
                      </div>
                      {index === selectedIndex && (
                        <div className="text-xs text-cyan-400">
                          Press Enter ↵
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 bg-gray-850 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between">
            <div>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">↑↓</kbd> Navigate
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded ml-2">Enter</kbd> Select
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded ml-2">Esc</kbd> Close
            </div>
            <div className="text-cyan-400">
              {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
