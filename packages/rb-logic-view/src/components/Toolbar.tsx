// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { TickEngine } from '@redbyte/rb-logic-core';

export interface ToolbarProps {
  engine?: TickEngine;
  onAddNode?: (type: string) => void;
  onDelete?: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
}

const NODE_TYPES = [
  'PowerSource',
  'Switch',
  'Lamp',
  'Wire',
  'AND',
  'OR',
  'NOT',
  'NAND',
  'XOR',
  'Clock',
  'Delay',
];

export const Toolbar: React.FC<ToolbarProps> = ({
  engine,
  onAddNode,
  onDelete,
  snapToGrid,
  onToggleSnap,
}) => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [tickRate, setTickRate] = React.useState(engine?.getTickRate() ?? 20);
  const [tickCount, setTickCount] = React.useState(0);

  React.useEffect(() => {
    if (!engine) return;

    const interval = setInterval(() => {
      setIsRunning(engine.isRunning());
      setTickCount(engine.getTickCount());
    }, 100);

    return () => clearInterval(interval);
  }, [engine]);

  const handleRun = () => {
    if (!engine) return;
    if (isRunning) {
      engine.pause();
    } else {
      engine.start();
    }
    setIsRunning(!isRunning);
  };

  const handleStep = () => {
    engine?.stepOnce();
    setTickCount(engine?.getTickCount() ?? 0);
  };

  const handleTickRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseInt(e.target.value, 10);
    setTickRate(rate);
    engine?.setTickRate(rate);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 8,
        padding: '8px 12px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        color: '#fff',
        fontSize: 14,
        zIndex: 100,
      }}
    >
      {/* Simulation controls */}
      <div style={{ display: 'flex', gap: 8, borderRight: '1px solid #333', paddingRight: 12 }}>
        <button
          onClick={handleRun}
          style={{
            padding: '4px 12px',
            background: isRunning ? '#ef4444' : '#22c55e',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {isRunning ? 'Pause' : 'Run'}
        </button>
        <button
          onClick={handleStep}
          style={{
            padding: '4px 12px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Step
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label htmlFor="tickRate">Hz:</label>
          <input
            id="tickRate"
            type="range"
            min="1"
            max="60"
            value={tickRate}
            onChange={handleTickRateChange}
            style={{ width: 80 }}
          />
          <span style={{ width: 30, textAlign: 'right' }}>{tickRate}</span>
        </span>
        <span style={{ color: '#94a3b8' }}>Ticks: {tickCount}</span>
      </div>

      {/* Add node menu */}
      <div style={{ display: 'flex', gap: 8, borderRight: '1px solid #333', paddingRight: 12 }}>
        <select
          onChange={(e) => {
            if (e.target.value) {
              onAddNode?.(e.target.value);
              e.target.value = '';
            }
          }}
          style={{
            padding: '4px 8px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: 4,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <option value="">Add Node...</option>
          {NODE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        style={{
          padding: '4px 12px',
          background: '#ef4444',
          border: 'none',
          borderRadius: 4,
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Delete
      </button>

      {/* Snap to grid toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={snapToGrid} onChange={onToggleSnap} />
        Snap to Grid
      </label>
    </div>
  );
};
