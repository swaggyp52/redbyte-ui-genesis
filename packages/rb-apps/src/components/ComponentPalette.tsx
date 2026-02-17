// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import {
  PowerButtonIcon,
  SwitchIcon,
  InputPortIcon,
  OutputPortIcon,
  LampIcon,
  LogicAndIcon,
  LogicOrIcon,
  LogicNotIcon,
  LogicNandIcon,
  LogicNorIcon,
  LogicXorIcon,
  LogicXnorIcon,
  ClockIcon,
  DelayIcon,
  LatchIcon,
  FlipFlopIcon,
  AdderIcon,
  CounterIcon,
} from '@redbyte/rb-icons';

interface ComponentInfo {
  type: string;
  name: string;
  description: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  category: string;
  color: string;
}

interface ComponentPaletteProps {
  onAddNode: (type: string) => void;
  onDragStart: (type: string, e: React.DragEvent) => void;
}

const COMPONENTS: ComponentInfo[] = [
  // Basic I/O
  { type: 'PowerSource', name: 'Power', description: 'Always ON - provides constant signal', Icon: PowerButtonIcon, category: 'Basic I/O', color: '#4ade80' },
  { type: 'Switch', name: 'Switch', description: 'Click to toggle ON/OFF', Icon: SwitchIcon, category: 'Basic I/O', color: '#60a5fa' },
  { type: 'INPUT', name: 'Input', description: 'External input port', Icon: InputPortIcon, category: 'Basic I/O', color: '#60a5fa' },
  { type: 'Lamp', name: 'Lamp', description: 'Lights up when signal is ON', Icon: LampIcon, category: 'Basic I/O', color: '#fbbf24' },
  { type: 'OUTPUT', name: 'Output', description: 'External output port', Icon: OutputPortIcon, category: 'Basic I/O', color: '#fbbf24' },

  // Logic Gates
  { type: 'AND', name: 'AND Gate', description: 'ON when both inputs are ON', Icon: LogicAndIcon, category: 'Logic Gates', color: '#c084fc' },
  { type: 'OR', name: 'OR Gate', description: 'ON when any input is ON', Icon: LogicOrIcon, category: 'Logic Gates', color: '#f472b6' },
  { type: 'NOT', name: 'NOT Gate', description: 'Inverts the input signal', Icon: LogicNotIcon, category: 'Logic Gates', color: '#fb923c' },
  { type: 'NAND', name: 'NAND Gate', description: 'NOT-AND - opposite of AND', Icon: LogicNandIcon, category: 'Logic Gates', color: '#a78bfa' },
  { type: 'NOR', name: 'NOR Gate', description: 'NOT-OR - opposite of OR', Icon: LogicNorIcon, category: 'Logic Gates', color: '#f472b6' },
  { type: 'XOR', name: 'XOR Gate', description: 'ON when inputs differ', Icon: LogicXorIcon, category: 'Logic Gates', color: '#ec4899' },
  { type: 'XNOR', name: 'XNOR Gate', description: 'ON when inputs match', Icon: LogicXnorIcon, category: 'Logic Gates', color: '#ec4899' },

  // Timing
  { type: 'Clock', name: 'Clock', description: 'Oscillates ON/OFF rhythmically', Icon: ClockIcon, category: 'Timing', color: '#3B82F6' },
  { type: 'Delay', name: 'Delay', description: 'Delays signal by one tick', Icon: DelayIcon, category: 'Timing', color: '#a3e635' },

  // Advanced
  { type: 'RSLatch', name: 'RS Latch', description: 'Memory cell - stores 1 bit', Icon: LatchIcon, category: 'Advanced', color: '#f87171' },
  { type: 'DFlipFlop', name: 'D Flip-Flop', description: 'Clocked memory element', Icon: FlipFlopIcon, category: 'Advanced', color: '#34d399' },
  { type: 'JKFlipFlop', name: 'JK Flip-Flop', description: 'Advanced flip-flop', Icon: FlipFlopIcon, category: 'Advanced', color: '#fcd34d' },
  { type: 'FullAdder', name: 'Full Adder', description: 'Adds 3 binary digits', Icon: AdderIcon, category: 'Advanced', color: '#818cf8' },
  { type: 'Counter4Bit', name: '4-Bit Counter', description: 'Counts from 0 to 15', Icon: CounterIcon, category: 'Advanced', color: '#e879f9' },
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
      <div 
        className="border-b border-gray-700"
        style={{
          padding: 'var(--rb-space-3, 0.75rem)'
        }}
      >
        <h3 
          className="font-bold text-cyan-400"
          style={{
            fontSize: 'var(--rb-text-sm, 0.875rem)',
            marginBottom: 'var(--rb-space-2, 0.5rem)'
          }}
        >Component Library</h3>

        {/* Search */}
        <input
          type="text"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-cyan-500 text-white"
          style={{
            paddingLeft: 'var(--rb-space-2, 0.5rem)',
            paddingRight: 'var(--rb-space-2, 0.5rem)',
            paddingTop: 'calc(0.375rem * var(--rb-ui-scale, 1))',
            paddingBottom: 'calc(0.375rem * var(--rb-ui-scale, 1))',
            fontSize: 'var(--rb-text-xs, 0.75rem)'
          }}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-700 bg-gray-850">
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`whitespace-nowrap border-b-2 transition-colors ${
              selectedCategory === category
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              paddingTop: 'var(--rb-space-2, 0.5rem)',
              paddingBottom: 'var(--rb-space-2, 0.5rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)',
              fontWeight: 500
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Component Grid */}
      <div 
        className="flex-1 overflow-y-auto"
        style={{
          padding: 'var(--rb-space-2, 0.5rem)'
        }}
      >
        <div 
          className="grid grid-cols-1"
          style={{
            gap: 'var(--rb-space-2, 0.5rem)'
          }}
        >
          {filteredComponents.map(comp => {
            const IconComponent = comp.Icon;
            const isHovered = hoveredComponent === comp.type;
            return (
              <div
                key={comp.type}
                data-testid={`palette-${comp.type.toLowerCase()}`}
                draggable
                onDragStart={(e) => onDragStart(comp.type, e)}
                onMouseEnter={() => setHoveredComponent(comp.type)}
                onMouseLeave={() => setHoveredComponent(null)}
                onClick={() => onAddNode(comp.type)}
                className={`
                  relative rounded-lg border-2 cursor-pointer transition-all
                  ${isHovered
                    ? 'border-cyan-400 bg-gray-800 shadow-lg shadow-cyan-500/20 scale-105'
                    : 'border-gray-700 bg-gray-850 hover:border-gray-600'
                  }
                `}
                style={{
                  padding: 'var(--rb-space-3, 0.75rem)',
                  borderLeftColor: isHovered ? comp.color : undefined,
                  borderLeftWidth: isHovered ? '4px' : undefined,
                }}
              >
                <div 
                  className="flex items-start"
                  style={{
                    gap: 'var(--rb-space-3, 0.75rem)'
                  }}
                >
                  {/* SVG Icon */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-md"
                    style={{
                      width: 'var(--rb-icon-md, 32px)',
                      height: 'var(--rb-icon-md, 32px)',
                      backgroundColor: `${comp.color}20`,
                      color: comp.color,
                    }}
                  >
                    <IconComponent
                      style={{
                        width: 'calc(20px * var(--rb-ui-scale, 1))',
                        height: 'calc(20px * var(--rb-ui-scale, 1))',
                        filter: isHovered ? 'brightness(1.3)' : 'brightness(1)',
                        transition: 'filter 0.2s',
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div 
                      className="font-semibold text-white"
                      style={{
                        fontSize: 'var(--rb-text-sm,  0.875rem)',
                        marginBottom: 'calc(0.125rem * var(--rb-ui-scale, 1))'
                      }}
                    >{comp.name}</div>
                    <div 
                      className="text-gray-400 leading-tight"
                      style={{
                        fontSize: 'var(--rb-text-xs, 0.75rem)'
                      }}
                    >{comp.description}</div>
                  </div>
                </div>

                {/* Hover indicator */}
                {isHovered && (
                  <div 
                    className="absolute font-bold animate-pulse" 
                    style={{
                      top: 'calc(0.25rem * var(--rb-ui-scale, 1))',
                      right: 'calc(0.25rem * var(--rb-ui-scale, 1))',
                      fontSize: 'var(--rb-text-xs, 0.75rem)',
                      color: '#22d3ee'
                    }}
                  >
                    Drag or Click
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Tip */}
      <div 
        className="border-t border-gray-700 bg-gray-850"
        style={{
          padding: 'var(--rb-space-2, 0.5rem)'
        }}
      >
        <div 
          className="flex items-center"
          style={{
            fontSize: 'var(--rb-text-xs, 0.75rem)',
            gap: 'calc(0.25rem * var(--rb-ui-scale, 1))'
          }}
        >
          <LampIcon 
            className="text-yellow-400"
            style={{
              width: 'calc(12px * var(--rb-ui-scale, 1))',
              height: 'calc(12px * var(--rb-ui-scale, 1))'
            }}
          />
          <span className="text-gray-400">Drag components onto canvas or click to add at center</span>
        </div>
      </div>
    </div>
  );
};
