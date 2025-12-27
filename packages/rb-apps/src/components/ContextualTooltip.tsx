// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';

interface TooltipData {
  title: string;
  description: string;
  tips?: string[];
  keyboardShortcut?: string;
}

interface ContextualTooltipProps {
  nodeType?: string;
  isWiring?: boolean;
  selectedCount?: number;
  position: { x: number; y: number };
}

const NODE_TOOLTIPS: Record<string, TooltipData> = {
  PowerSource: {
    title: 'Power Source',
    description: 'Constantly outputs a HIGH (1) signal',
    tips: ['Use this to test circuits', 'Acts as a constant TRUE value'],
  },
  Switch: {
    title: 'Switch',
    description: 'Click to toggle between ON and OFF',
    tips: ['Interactive input control', 'Click the node to flip state'],
    keyboardShortcut: 'Click node',
  },
  Lamp: {
    title: 'Lamp',
    description: 'Lights up when receiving a HIGH signal',
    tips: ['Visual output indicator', 'Glows green when active'],
  },
  AND: {
    title: 'AND Gate',
    description: 'Outputs HIGH only when ALL inputs are HIGH',
    tips: ['Logic: A AND B', 'Both inputs must be 1'],
  },
  OR: {
    title: 'OR Gate',
    description: 'Outputs HIGH when ANY input is HIGH',
    tips: ['Logic: A OR B', 'At least one input must be 1'],
  },
  NOT: {
    title: 'NOT Gate',
    description: 'Inverts the input signal',
    tips: ['Logic: NOT A', 'Outputs opposite of input'],
  },
  XOR: {
    title: 'XOR Gate',
    description: 'Outputs HIGH when inputs are DIFFERENT',
    tips: ['Logic: A XOR B', 'Exclusive OR - inputs must differ'],
  },
  Clock: {
    title: 'Clock',
    description: 'Oscillates between HIGH and LOW automatically',
    tips: ['Provides timing signal', 'Frequency set in properties'],
  },
  RSLatch: {
    title: 'RS Latch',
    description: 'Memory element - stores one bit of data',
    tips: ['S=Set, R=Reset', 'Remembers state', 'Basic memory building block'],
  },
  DFlipFlop: {
    title: 'D Flip-Flop',
    description: 'Stores input value on clock edge',
    tips: ['D=Data, CLK=Clock', 'Updates on clock rising edge', 'Synchronized memory'],
  },
};

export const ContextualTooltip: React.FC<ContextualTooltipProps> = ({
  nodeType,
  isWiring,
  selectedCount = 0,
  position,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, [nodeType, isWiring, selectedCount]);

  if (!visible) return null;

  let content: React.ReactNode = null;

  if (isWiring) {
    content = (
      <div>
        <div className="font-bold text-cyan-400 mb-1">🔌 Wiring Mode</div>
        <div className="text-sm text-gray-300 mb-2">Click a port to complete the connection</div>
        <div className="text-xs text-gray-400">Press ESC to cancel</div>
      </div>
    );
  } else if (selectedCount > 1) {
    content = (
      <div>
        <div className="font-bold text-cyan-400 mb-1">📦 {selectedCount} Items Selected</div>
        <div className="text-xs text-gray-400 space-y-1">
          <div>• Press DELETE to remove</div>
          <div>• Drag to move together</div>
          <div>• Click background to deselect</div>
        </div>
      </div>
    );
  } else if (nodeType && NODE_TOOLTIPS[nodeType]) {
    const tooltip = NODE_TOOLTIPS[nodeType];
    content = (
      <div>
        <div className="font-bold text-cyan-400 mb-1">{tooltip.title}</div>
        <div className="text-sm text-gray-300 mb-2">{tooltip.description}</div>
        {tooltip.tips && (
          <div className="text-xs text-gray-400 space-y-0.5">
            {tooltip.tips.map((tip, i) => (
              <div key={i}>• {tip}</div>
            ))}
          </div>
        )}
        {tooltip.keyboardShortcut && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">{tooltip.keyboardShortcut}</kbd>
          </div>
        )}
      </div>
    );
  }

  if (!content) return null;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: position.x + 20,
        top: position.y,
      }}
    >
      <div className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg shadow-2xl p-3 max-w-xs animate-in fade-in slide-in-from-left-2 duration-200">
        {content}
        <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-cyan-500/30" />
      </div>
    </div>
  );
};
