// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * GenericIOGrid - Capabilities-driven I/O visualization
 *
 * Renders inputs (switches, buttons) and outputs (LEDs) based on
 * board capabilities, without hardcoding any specific board layout.
 */

import React, { useCallback } from 'react';
import type { IOGroup, IOSnapshot } from '../services/hardwareClient';

interface GenericIOGridProps {
  inputs: IOGroup[];
  outputs: IOGroup[];
  ioSnapshot: IOSnapshot | null;
  onSetOutput?: (signal: string, value: number) => void;
  readOnly?: boolean;
}

// Parse binary string or number to get individual bit values
function getBitValue(value: string | number | undefined, bitIndex: number, width: number): boolean {
  if (value === undefined) return false;

  if (typeof value === 'string') {
    // Binary string format: "0000000000000001" (MSB first)
    const idx = width - 1 - bitIndex;
    return value[idx] === '1';
  }

  // Numeric value
  return ((value >> bitIndex) & 1) === 1;
}

// Convert bit array to numeric value
function bitsToNumber(bits: boolean[]): number {
  return bits.reduce((acc, bit, idx) => acc | (bit ? 1 << idx : 0), 0);
}

interface IOBitProps {
  kind: 'switch' | 'button' | 'led' | '7segment';
  label: string;
  value: boolean;
  bitIndex: number;
  writable?: boolean;
  onToggle?: () => void;
}

const IOBit: React.FC<IOBitProps> = ({ kind, label, value, writable, onToggle }) => {
  const isInput = kind === 'switch' || kind === 'button';
  const isOutput = kind === 'led';

  // Base styles
  const baseClasses = 'flex flex-col items-center gap-1';

  // Indicator styles based on kind and value
  const getIndicatorStyle = () => {
    if (kind === 'led') {
      return value
        ? 'w-4 h-4 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]'
        : 'w-4 h-4 rounded-full bg-gray-700 border border-gray-600';
    }
    if (kind === 'switch') {
      return value
        ? 'w-3 h-6 rounded-sm bg-cyan-500 border border-cyan-400'
        : 'w-3 h-6 rounded-sm bg-gray-700 border border-gray-600';
    }
    if (kind === 'button') {
      return value
        ? 'w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-300'
        : 'w-5 h-5 rounded-full bg-gray-700 border-2 border-gray-600';
    }
    return 'w-4 h-4 bg-gray-600';
  };

  const handleClick = () => {
    if (writable && onToggle) {
      onToggle();
    }
  };

  return (
    <div
      className={`${baseClasses} ${writable ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={handleClick}
      title={`${label}: ${value ? 'ON' : 'OFF'}${writable ? ' (click to toggle)' : ''}`}
    >
      <div className={getIndicatorStyle()} />
      <span className="text-[10px] text-gray-500 font-mono">{label}</span>
    </div>
  );
};

interface IOGroupRowProps {
  group: IOGroup;
  values: string | number | undefined;
  isOutput?: boolean;
  onToggleBit?: (bitIndex: number, currentValue: boolean) => void;
}

const IOGroupRow: React.FC<IOGroupRowProps> = ({ group, values, isOutput, onToggleBit }) => {
  const bits: boolean[] = [];
  for (let i = group.width - 1; i >= 0; i--) {
    bits.push(getBitValue(values, i, group.width));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Group header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-300">{group.name}</span>
        <span className="text-[10px] text-gray-500">({group.width}-bit)</span>
      </div>

      {/* Bits grid */}
      <div className="flex flex-wrap gap-2">
        {bits.map((value, idx) => {
          const bitIndex = group.width - 1 - idx; // Convert back to LSB-indexed
          const label = group.labels?.[idx] || `${group.name}[${bitIndex}]`;

          return (
            <IOBit
              key={bitIndex}
              kind={group.kind}
              label={label}
              value={value}
              bitIndex={bitIndex}
              writable={isOutput && group.writable}
              onToggle={onToggleBit ? () => onToggleBit(bitIndex, value) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
};

export const GenericIOGrid: React.FC<GenericIOGridProps> = ({
  inputs,
  outputs,
  ioSnapshot,
  onSetOutput,
  readOnly = false,
}) => {
  // Handle toggling an output bit
  const handleToggleOutputBit = useCallback(
    (signal: string, width: number, bitIndex: number, currentValue: boolean) => {
      if (readOnly || !onSetOutput) return;

      // Get current value as number
      const currentRaw = ioSnapshot?.outputs[signal];
      let currentNum = 0;
      if (typeof currentRaw === 'string') {
        currentNum = parseInt(currentRaw, 2);
      } else if (typeof currentRaw === 'number') {
        currentNum = currentRaw;
      }

      // Toggle the bit
      const newValue = currentValue
        ? currentNum & ~(1 << bitIndex) // Clear bit
        : currentNum | (1 << bitIndex); // Set bit

      onSetOutput(signal, newValue);
    },
    [ioSnapshot, onSetOutput, readOnly]
  );

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg">
      {/* Inputs Section */}
      {inputs.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Inputs
          </h3>
          <div className="flex flex-col gap-4 pl-2">
            {inputs.map((group) => (
              <IOGroupRow
                key={group.name}
                group={group}
                values={ioSnapshot?.inputs[group.name]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {inputs.length > 0 && outputs.length > 0 && (
        <div className="border-t border-gray-700" />
      )}

      {/* Outputs Section */}
      {outputs.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Outputs
          </h3>
          <div className="flex flex-col gap-4 pl-2">
            {outputs.map((group) => (
              <IOGroupRow
                key={group.name}
                group={group}
                values={ioSnapshot?.outputs[group.name]}
                isOutput
                onToggleBit={
                  !readOnly && group.writable
                    ? (bitIndex, currentValue) =>
                        handleToggleOutputBit(group.name, group.width, bitIndex, currentValue)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {inputs.length === 0 && outputs.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No I/O capabilities defined
        </div>
      )}
    </div>
  );
};

export default GenericIOGrid;
