// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { ChipPort } from '../stores/chipStore';

interface PortBoundaryProps {
  inputs: ChipPort[];
  outputs: ChipPort[];
  chipName: string;
  width: number;
  height: number;
}

/**
 * Visual representation of chip I/O boundary when viewing chip internals
 * Shows the "doorway" between external ports and internal circuit
 */
export const PortBoundary: React.FC<PortBoundaryProps> = ({
  inputs,
  outputs,
  chipName,
  width,
  height,
}) => {
  const inputSpacing = height / (inputs.length + 1);
  const outputSpacing = height / (outputs.length + 1);

  return (
    <g className="port-boundary">
      {/* Left boundary - Inputs */}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={height}
        stroke="#8b5cf6"
        strokeWidth={3}
        strokeDasharray="10,5"
        opacity={0.6}
      />

      {inputs.map((input, i) => {
        const y = inputSpacing * (i + 1);
        return (
          <g key={input.id}>
            {/* Port indicator */}
            <circle
              cx={0}
              cy={y}
              r={12}
              fill="#8b5cf6"
              stroke="#fff"
              strokeWidth={2}
            />
            {/* Port label */}
            <text
              x={-20}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#c4b5fd"
              fontSize={14}
              fontWeight="bold"
            >
              {input.name}
            </text>
            {/* Arrow pointing in */}
            <path
              d={`M -15,${y} L 0,${y}`}
              stroke="#c4b5fd"
              strokeWidth={2}
              markerEnd="url(#arrowhead-in)"
            />
          </g>
        );
      })}

      {/* Right boundary - Outputs */}
      <line
        x1={width}
        y1={0}
        x2={width}
        y2={height}
        stroke="#8b5cf6"
        strokeWidth={3}
        strokeDasharray="10,5"
        opacity={0.6}
      />

      {outputs.map((output, i) => {
        const y = outputSpacing * (i + 1);
        return (
          <g key={output.id}>
            {/* Port indicator */}
            <circle
              cx={width}
              cy={y}
              r={12}
              fill="#8b5cf6"
              stroke="#fff"
              strokeWidth={2}
            />
            {/* Port label */}
            <text
              x={width + 20}
              y={y}
              textAnchor="start"
              dominantBaseline="middle"
              fill="#c4b5fd"
              fontSize={14}
              fontWeight="bold"
            >
              {output.name}
            </text>
            {/* Arrow pointing out */}
            <path
              d={`M ${width},${y} L ${width + 15},${y}`}
              stroke="#c4b5fd"
              strokeWidth={2}
              markerEnd="url(#arrowhead-out)"
            />
          </g>
        );
      })}

      {/* Chip name label at top */}
      <text
        x={width / 2}
        y={-30}
        textAnchor="middle"
        fill="#8b5cf6"
        fontSize={18}
        fontWeight="bold"
      >
        Inside: {chipName}
      </text>

      {/* Arrow markers */}
      <defs>
        <marker
          id="arrowhead-in"
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="5"
          orient="auto"
        >
          <polygon points="0 0, 10 5, 0 10" fill="#c4b5fd" />
        </marker>
        <marker
          id="arrowhead-out"
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="5"
          orient="auto"
        >
          <polygon points="0 0, 10 5, 0 10" fill="#c4b5fd" />
        </marker>
      </defs>
    </g>
  );
};
