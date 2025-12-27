// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';

interface ComponentInfo {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  color: string;
}

interface ComponentPaletteProps {
  onAddNode: (type: string) => void;
  onDragStart: (type: string, e: React.DragEvent) => void;
}

const COMPONENTS: ComponentInfo[] = [
  // Basic I/O
  { type: 'PowerSource', name: 'Power', description: 'Always ON - provides constant signal', icon: '⚡', category: 'Basic I/O', color: '#4ade80' },
  { type: 'Switch', name: 'Switch', description: 'Click to toggle ON/OFF', icon: '🔘', category: 'Basic I/O', color: '#60a5fa' },
  { type: 'INPUT', name: 'Input', description: 'External input port', icon: '📥', category: 'Basic I/O', color: '#60a5fa' },
  { type: 'Lamp', name: 'Lamp', description: 'Lights up when signal is ON', icon: '💡', category: 'Basic I/O', color: '#fbbf24' },
  { type: 'OUTPUT', name: 'Output', description: 'External output port', icon: '📤', category: 'Basic I/O', color: '#fbbf24' },

  // Logic Gates
  { type: 'AND', name: 'AND Gate', description: 'ON when both inputs are ON', icon: '∧', category: 'Logic Gates', color: '#c084fc' },
  { type: 'OR', name: 'OR Gate', description: 'ON when any input is ON', icon: '∨', category: 'Logic Gates', color: '#f472b6' },
  { type: 'NOT', name: 'NOT Gate', description: 'Inverts the input signal', icon: '¬', category: 'Logic Gates', color: '#fb923c' },
  { type: 'NAND', name: 'NAND Gate', description: 'NOT-AND - opposite of AND', icon: '⊼', category: 'Logic Gates', color: '#a78bfa' },
  { type: 'NOR', name: 'NOR Gate', description: 'NOT-OR - opposite of OR', icon: '⊽', category: 'Logic Gates', color: '#f472b6' },
  { type: 'XOR', name: 'XOR Gate', description: 'ON when inputs differ', icon: '⊕', category: 'Logic Gates', color: '#ec4899' },
  { type: 'XNOR', name: 'XNOR Gate', description: 'ON when inputs match', icon: '⊙', category: 'Logic Gates', color: '#ec4899' },

  // Timing
  { type: 'Clock', name: 'Clock', description: 'Oscillates ON/OFF rhythmically', icon: '🕐', category: 'Timing', color: '#22d3ee' },
  { type: 'Delay', name: 'Delay', description: 'Delays signal by one tick', icon: '⏱️', category: 'Timing', color: '#a3e635' },

  // Advanced
  { type: 'RSLatch', name: 'RS Latch', description: 'Memory cell - stores 1 bit', icon: '🔒', category: 'Advanced', color: '#f87171' },
  { type: 'DFlipFlop', name: 'D Flip-Flop', description: 'Clocked memory element', icon: '📊', category: 'Advanced', color: '#34d399' },
  { type: 'JKFlipFlop', name: 'JK Flip-Flop', description: 'Advanced flip-flop', icon: '📈', category: 'Advanced', color: '#fcd34d' },
  { type: 'FullAdder', name: 'Full Adder', description: 'Adds 3 binary digits', icon: '➕', category: 'Advanced', color: '#818cf8' },
  { type: 'Counter4Bit', name: '4-Bit Counter', description: 'Counts from 0 to 15', icon: '🔢', category: 'Advanced', color: '#e879f9' },
];

const CATEGORIES = ['Basic I/O', 'Logic Gates', 'Timing', 'Advanced'];

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onAddNode, onDragStart }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Basic I/O');
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredComponents = COMPONENTS.filter(comp => {
    const matchesCategory = selectedCategory === 'All' || comp.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-bold text-cyan-400 mb-2">Component Library</h3>

        {/* Search */}
        <input
          type="text"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-cyan-500 text-white"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-700 bg-gray-850">
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              selectedCategory === category
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Component Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-1 gap-2">
          {filteredComponents.map(comp => (
            <div
              key={comp.type}
              draggable
              onDragStart={(e) => onDragStart(comp.type, e)}
              onMouseEnter={() => setHoveredComponent(comp.type)}
              onMouseLeave={() => setHoveredComponent(null)}
              onClick={() => onAddNode(comp.type)}
              className={`
                relative p-3 rounded-lg border-2 cursor-pointer transition-all
                ${hoveredComponent === comp.type
                  ? 'border-cyan-400 bg-gray-800 shadow-lg shadow-cyan-500/20 scale-105'
                  : 'border-gray-700 bg-gray-850 hover:border-gray-600'
                }
              `}
              style={{
                borderLeftColor: hoveredComponent === comp.type ? comp.color : undefined,
                borderLeftWidth: hoveredComponent === comp.type ? '4px' : undefined,
              }}
            >
              <div className="flex items-start gap-2">
                {/* Icon */}
                <div
                  className="text-2xl flex-shrink-0"
                  style={{
                    filter: hoveredComponent === comp.type ? 'brightness(1.3)' : 'brightness(1)',
                    transition: 'filter 0.2s'
                  }}
                >
                  {comp.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white mb-0.5">{comp.name}</div>
                  <div className="text-xs text-gray-400 leading-tight">{comp.description}</div>
                </div>
              </div>

              {/* Hover indicator */}
              {hoveredComponent === comp.type && (
                <div className="absolute top-1 right-1 text-xs text-cyan-400 font-bold animate-pulse">
                  Drag or Click
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Tip */}
      <div className="p-2 border-t border-gray-700 bg-gray-850">
        <div className="text-xs text-gray-500">
          💡 <span className="text-gray-400">Drag components onto canvas or click to add at center</span>
        </div>
      </div>
    </div>
  );
};
