// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Node, PortRef } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';

export interface ChipMetadata {
  name: string;
  inputs: Array<{ id: string; name: string }>;
  outputs: Array<{ id: string; name: string }>;
  color?: string;
  layer?: number;
}

export interface NodeViewProps {
  node: Node;
  camera: Camera;
  isSelected: boolean;
  isHighlighted?: boolean;
  onSelect: (nodeId: string, addToSelection: boolean) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onPortClick?: (nodeId: string, portName: string) => void;
  onToggleSwitch?: (nodeId: string) => void; // Toggle switch state
  onNodeDoubleClick?: (nodeId: string) => void; // Double-click to drill into chip
  onProbeToggle?: (nodeId: string, portName: string, label: string) => void; // Toggle probe on port
  signals?: Map<string, 0 | 1>;
  chipMetadata?: ChipMetadata; // Metadata for custom chips
  wireStartPort?: PortRef; // Port where wire drawing started
  onPortHover?: (portName: string) => void; // Port hover for wire validation
  onPortLeave?: () => void; // Port leave for wire validation
  probedPorts?: Set<string>; // Set of probed port keys (e.g., "nodeId.portName")
}

const NODE_COLORS: Record<string, string> = {
  PowerSource: '#4ade80',
  Switch: '#60a5fa',
  Lamp: '#fbbf24',
  Wire: '#94a3b8',
  AND: '#c084fc',
  OR: '#f472b6',
  NOT: '#fb923c',
  NAND: '#a78bfa',
  XOR: '#ec4899',
  Clock: '#22d3ee',
  Delay: '#a3e635',
  FullAdder: '#818cf8',
  RSLatch: '#f87171',
  DFlipFlop: '#34d399',
  JKFlipFlop: '#fcd34d',
  Counter4Bit: '#e879f9',
};

const NodeViewComponent: React.FC<NodeViewProps> = ({
  node,
  camera,
  isSelected,
  isHighlighted = false,
  onSelect,
  onMove,
  onPortClick,
  onToggleSwitch,
  onNodeDoubleClick,
  onProbeToggle,
  signals,
  chipMetadata,
  wireStartPort,
  onPortHover,
  onPortLeave,
  probedPorts,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = React.useState({ x: node.position.x, y: node.position.y });
  const [hoveredPort, setHoveredPort] = React.useState<string | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isToggleHovered, setIsToggleHovered] = React.useState(false);
  const [hoveredProbePort, setHoveredProbePort] = React.useState<{portName: string; x: number; y: number} | null>(null);

  const screenX = (isDragging ? dragPosition.x : node.position.x) * camera.zoom + camera.x;
  const screenY = (isDragging ? dragPosition.y : node.position.y) * camera.zoom + camera.y;
  const size = 48 * camera.zoom;

  const isSwitch = node.type === 'Switch' || node.type === 'INPUT';
  const switchState = node.state?.isOn ?? 0;
  const toggleWidth = size * 0.66;
  const toggleHeight = 14;
  const toggleX = -toggleWidth / 2;
  const toggleY = -size / 2 - 18;
  const toggleHitWidth = size * 0.9;
  const toggleHitHeight = 24;
  const toggleHitX = -toggleHitWidth / 2;
  const toggleHitY = toggleY - (toggleHitHeight - toggleHeight) / 2;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    // Don't start drag yet - wait for movement
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragPosition({ x: node.position.x, y: node.position.y });

    onSelect(node.id, e.shiftKey);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only toggle if NOT drawing a wire
    if (!wireStartPort && onToggleSwitch) {
      onToggleSwitch(node.id);
    }
  };

  const handleToggleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Double-click for chip drill-down only (not switches)
    if (!isSwitch && onNodeDoubleClick) {
      onNodeDoubleClick(node.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Only start drag if mouse moved more than 3px (prevents accidental drag on click)
    if (!isDragging && dragStart.x !== 0) {
      const dx = Math.abs(e.clientX - dragStart.x);
      const dy = Math.abs(e.clientY - dragStart.y);
      if (dx > 3 || dy > 3) {
        setIsDragging(true);
      }
    }

    if (!isDragging) return;

    const dx = (e.clientX - dragStart.x) / camera.zoom;
    const dy = (e.clientY - dragStart.y) / camera.zoom;

    // Update local position immediately for smooth dragging
    setDragPosition({
      x: node.position.x + dx,
      y: node.position.y + dy,
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Commit the final position when drag ends
      onMove(node.id, dragPosition.x, dragPosition.y);
      setIsDragging(false);
      setDragStart({ x: 0, y: 0 });
    } else if (dragStart.x !== 0) {
      // Click without drag - but we no longer toggle here (moved to dedicated toggle button)
      setDragStart({ x: 0, y: 0 });
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        // Commit the final position when drag ends
        onMove(node.id, dragPosition.x, dragPosition.y);
        setIsDragging(false);
        setDragStart({ x: 0, y: 0 });
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, dragPosition, node.id, onMove]);

  const color = NODE_COLORS[node.type] || '#94a3b8';
  const isActive = signals?.get(`${node.id}.out`) === 1;
  const isChip = !!chipMetadata;

  // Render custom chip with black-box appearance
  if (isChip && chipMetadata) {
    const chipColor = chipMetadata.color || '#1e293b'; // Dark slate for chips
    const chipHeight = size * 1.5; // Taller for chips with multiple ports
    const portSpacing = chipHeight / (Math.max(chipMetadata.inputs.length, chipMetadata.outputs.length) + 1);

    return (
      <g
        transform={`translate(${screenX}, ${screenY}) rotate(${node.rotation})`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Highlight ring */}
        {isHighlighted && (
          <rect
            x={-size / 2 - 4}
            y={-chipHeight / 2 - 4}
            width={size + 8}
            height={chipHeight + 8}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2}
            rx={8}
            className="animate-pulse"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Chip body - black box appearance */}
        <rect
          x={-size / 2}
          y={-chipHeight / 2}
          width={size}
          height={chipHeight}
          fill={chipColor}
          stroke={isSelected ? '#3b82f6' : isHovered ? '#8b5cf6' : '#475569'}
          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
          rx={6}
        />

        {/* Hover hint - double-click to drill down */}
        {isHovered && onNodeDoubleClick && (
          <text
            x={0}
            y={-chipHeight / 2 - 8}
            textAnchor="middle"
            fill="#8b5cf6"
            fontSize={9}
            fontWeight="500"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            Double-click to explore
          </text>
        )}

        {/* Chip icon - small circuit pattern */}
        <circle cx={0} cy={-chipHeight / 4} r={3} fill="#64748b" opacity={0.5} />
        <circle cx={-6} cy={chipHeight / 4} r={2} fill="#64748b" opacity={0.5} />
        <circle cx={6} cy={chipHeight / 4} r={2} fill="#64748b" opacity={0.5} />
        <line x1={0} y1={-chipHeight / 4 + 3} x2={-6} y2={chipHeight / 4 - 2} stroke="#64748b" strokeWidth={1} opacity={0.3} />
        <line x1={0} y1={-chipHeight / 4 + 3} x2={6} y2={chipHeight / 4 - 2} stroke="#64748b" strokeWidth={1} opacity={0.3} />

        {/* Chip label */}
        <text
          x={0}
          y={chipHeight / 2 + 12}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={Math.max(8, 10 * camera.zoom)}
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {chipMetadata.name}
        </text>

        {/* Layer badge */}
        {chipMetadata.layer !== undefined && (
          <text
            x={0}
            y={-chipHeight / 2 - 8}
            textAnchor="middle"
            fill="#64748b"
            fontSize={Math.max(7, 8 * camera.zoom)}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            L{chipMetadata.layer}
          </text>
        )}

        {/* Input ports */}
        {chipMetadata.inputs.map((input, i) => {
          const yPos = -chipHeight / 2 + portSpacing * (i + 1);
          const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === input.id;
          const isHovered = hoveredPort === input.id;
          const shouldGlow = isWireStart || (isHovered && wireStartPort);

          return (
            <g key={`input-${input.id}`}>
              {shouldGlow && (
                <circle
                  cx={-size / 2}
                  cy={yPos}
                  r={8}
                  fill="#00ffff"
                  opacity={0.4}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Larger invisible hit area for easier clicking */}
              <rect
                x={-size / 2 - 10}
                y={yPos - 10}
                width={20}
                height={20}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  // P-click to toggle probe
                  if ((e.shiftKey && e.key === 'P') || (e.altKey && e.button === 0)) {
                    const label = `${chipMetadata?.name || node.type} ${input.name || input.id}`;
                    onProbeToggle?.(node.id, input.id, label);
                  } else {
                    onPortClick?.(node.id, input.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Right-click to toggle probe
                  const label = `${chipMetadata?.name || node.type} ${input.name || input.id}`;
                  onProbeToggle?.(node.id, input.id, label);
                }}
                onMouseEnter={() => {
                  setHoveredPort(input.id);
                  if (wireStartPort) {
                    onPortHover?.(input.id);
                  }
                }}
                onMouseLeave={() => {
                  setHoveredPort(null);
                  if (wireStartPort) {
                    onPortLeave?.();
                  }
                }}
              />
              {/* Visual port */}
              <rect
                x={-size / 2 - 4}
                y={yPos - 4}
                width={8}
                height={8}
                fill={isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.${input.id}`) ? "#00ffff" : "#3b82f6"}
                stroke={probedPorts?.has(`${node.id}.${input.id}`) ? "#00ffff" : "#fff"}
                strokeWidth={probedPorts?.has(`${node.id}.${input.id}`) ? 2 : isHovered ? 2 : 1}
                rx={1}
                style={{ pointerEvents: 'none' }}
              />
              {/* Cyan glow for probed port */}
              {probedPorts?.has(`${node.id}.${input.id}`) && (
                <>
                  <rect
                    x={-size / 2 - 4}
                    y={yPos - 4}
                    width={8}
                    height={8}
                    fill="none"
                    stroke="#00ffff"
                    strokeWidth={3}
                    rx={1}
                    opacity={0.4}
                    style={{ pointerEvents: 'none' }}
                    className="animate-pulse"
                  />
                  {/* Signal value readout on hover */}
                  {isHovered && hoveredPort === input.id && (
                    <g>
                      <rect
                        x={-size / 2 - 28}
                        y={yPos - 8}
                        width={16}
                        height={14}
                        rx={2}
                        fill="#1e293b"
                        stroke="#00ffff"
                        strokeWidth={1}
                        style={{ pointerEvents: 'none' }}
                      />
                      <text
                        x={-size / 2 - 20}
                        y={yPos}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={signals?.get(`${node.id}.${input.id}`) === 1 ? '#22c55e' : '#9ca3af'}
                        fontSize={9}
                        fontWeight="600"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {signals?.get(`${node.id}.${input.id}`) ?? 0}
                      </text>
                    </g>
                  )}
                </>
              )}
              <text
                x={-size / 2 - 8}
                y={yPos}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#94a3b8"
                fontSize={Math.max(6, 8 * camera.zoom)}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {input.name}
              </text>
            </g>
          );
        })}

        {/* Output ports */}
        {chipMetadata.outputs.map((output, i) => {
          const yPos = -chipHeight / 2 + portSpacing * (i + 1);
          const outputSignal = signals?.get(`${node.id}.${output.id}`) === 1;
          const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === output.id;
          const isHovered = hoveredPort === output.id;
          const shouldGlow = isWireStart || (isHovered && wireStartPort);

          return (
            <g key={`output-${output.id}`}>
              {shouldGlow && (
                <circle
                  cx={size / 2}
                  cy={yPos}
                  r={8}
                  fill="#00ffff"
                  opacity={0.4}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Larger invisible hit area for easier clicking */}
              <circle
                cx={size / 2}
                cy={yPos}
                r={10}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  // P-click to toggle probe
                  if ((e.shiftKey && e.key === 'P') || (e.altKey && e.button === 0)) {
                    const label = `${chipMetadata?.name || node.type} ${output.name || output.id}`;
                    onProbeToggle?.(node.id, output.id, label);
                  } else {
                    onPortClick?.(node.id, output.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Right-click to toggle probe
                  const label = `${chipMetadata?.name || node.type} ${output.name || output.id}`;
                  onProbeToggle?.(node.id, output.id, label);
                }}
                onMouseEnter={() => {
                  setHoveredPort(output.id);
                  if (wireStartPort) {
                    onPortHover?.(output.id);
                  }
                }}
                onMouseLeave={() => {
                  setHoveredPort(null);
                  if (wireStartPort) {
                    onPortLeave?.();
                  }
                }}
              />
              {/* Visual port */}
              <circle
                cx={size / 2}
                cy={yPos}
                r={4}
                fill={isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.${output.id}`) ? "#00ffff" : outputSignal ? '#22c55e' : '#6b7280'}
                stroke={probedPorts?.has(`${node.id}.${output.id}`) ? "#00ffff" : "#fff"}
                strokeWidth={probedPorts?.has(`${node.id}.${output.id}`) ? 2 : isHovered ? 2 : 1}
                style={{ pointerEvents: 'none' }}
              />
              {/* Cyan glow for probed port */}
              {probedPorts?.has(`${node.id}.${output.id}`) && (
                <>
                  <circle
                    cx={size / 2}
                    cy={yPos}
                    r={6}
                    fill="none"
                    stroke="#00ffff"
                    strokeWidth={3}
                    opacity={0.4}
                    style={{ pointerEvents: 'none' }}
                    className="animate-pulse"
                  />
                  {/* Signal value readout on hover */}
                  {isHovered && hoveredPort === output.id && (
                    <g>
                      <rect
                        x={size / 2 + 12}
                        y={yPos - 8}
                        width={16}
                        height={14}
                        rx={2}
                        fill="#1e293b"
                        stroke="#00ffff"
                        strokeWidth={1}
                        style={{ pointerEvents: 'none' }}
                      />
                      <text
                        x={size / 2 + 20}
                        y={yPos}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={outputSignal ? '#22c55e' : '#9ca3af'}
                        fontSize={9}
                        fontWeight="600"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {outputSignal ? '1' : '0'}
                      </text>
                    </g>
                  )}
                </>
              )}
              <text
                x={size / 2 + 8}
                y={yPos}
                textAnchor="start"
                dominantBaseline="middle"
                fill="#94a3b8"
                fontSize={Math.max(6, 8 * camera.zoom)}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {output.name}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  // Standard node rendering
  return (
    <g
      transform={`translate(${screenX}, ${screenY}) rotate(${node.rotation})`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Highlight ring */}
      {isHighlighted && (
        <rect
          x={-size / 2 - 4}
          y={-size / 2 - 4}
          width={size + 8}
          height={size + 8}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={2}
          rx={6}
          className="animate-pulse"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Node body */}
      <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        fill={isActive ? color : '#2a2a2a'}
        stroke={isSelected ? '#3b82f6' : color}
        strokeWidth={isSelected ? 3 : 1}
        rx={4}
      />

      {/* Switch toggle control - dedicated interactive area */}
      {isSwitch && (
        <g>
          {/* Larger hit target to avoid drag/selection conflicts */}
          <rect
            x={toggleHitX}
            y={toggleHitY}
            width={toggleHitWidth}
            height={toggleHitHeight}
            rx={toggleHitHeight / 2}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseDown={handleToggleMouseDown}
            onClick={handleToggleClick}
            onMouseEnter={() => setIsToggleHovered(true)}
            onMouseLeave={() => setIsToggleHovered(false)}
          />
          {/* Toggle pill background */}
          <rect
            x={toggleX}
            y={toggleY}
            width={toggleWidth}
            height={toggleHeight}
            rx={toggleHeight / 2}
            fill={switchState ? '#22c55e' : '#374151'}
            stroke={isToggleHovered ? '#8b5cf6' : '#fff'}
            strokeWidth={isToggleHovered ? 2 : 1}
            style={{ pointerEvents: 'none', transition: 'all 0.15s ease' }}
          />
          {/* Toggle pill knob */}
          <circle
            cx={switchState ? toggleX + toggleWidth - 8 : toggleX + 8}
            cy={toggleY + toggleHeight / 2}
            r={5}
            fill="#fff"
            style={{
              transition: 'cx 0.15s ease, fill 0.15s ease',
              pointerEvents: 'none'
            }}
          />
          {/* ON/OFF label */}
          <text
            x={0}
            y={-size / 2 - 25}
            textAnchor="middle"
            fill={switchState ? '#22c55e' : '#9ca3af'}
            fontSize={Math.max(7, 9 * camera.zoom)}
            fontWeight="600"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {switchState ? 'ON' : 'OFF'}
          </text>
        </g>
      )}

      {/* Node label */}
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize={Math.max(10, 12 * camera.zoom)}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.type}
      </text>

      {/* Input port */}
      {!['PowerSource', 'Clock'].includes(node.type) && (() => {
        const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'in';
        const isHovered = hoveredPort === 'in';
        const shouldGlow = isWireStart || (isHovered && wireStartPort);

        return (
          <g>
            {shouldGlow && (
              <circle
                cx={-size / 2}
                cy={0}
                r={8}
                fill="#00ffff"
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <circle
              cx={-size / 2}
              cy={0}
              r={5}
              fill={isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#3b82f6"}
              stroke={probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#fff"}
              strokeWidth={probedPorts?.has(`${node.id}.in`) ? 2.5 : isHovered ? 2.5 : 1.5}
              style={{ cursor: 'crosshair' }}
              onClick={(e) => {
                e.stopPropagation();
                // P-click or right-click to toggle probe
                if ((e.shiftKey && e.key === 'P') || (e.altKey && e.button === 0)) {
                  const label = `${node.type} in`;
                  onProbeToggle?.(node.id, 'in', label);
                } else {
                  onPortClick?.(node.id, 'in');
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const label = `${node.type} in`;
                onProbeToggle?.(node.id, 'in', label);
              }}
              onMouseEnter={() => setHoveredPort('in')}
              onMouseLeave={() => setHoveredPort(null)}
            />
            {/* Cyan glow for probed port */}
            {probedPorts?.has(`${node.id}.in`) && (
              <>
                <circle
                  cx={-size / 2}
                  cy={0}
                  r={7}
                  fill="none"
                  stroke="#00ffff"
                  strokeWidth={3}
                  opacity={0.4}
                  style={{ pointerEvents: 'none' }}
                  className="animate-pulse"
                />
                {/* Signal value readout on hover */}
                {isHovered && hoveredPort === 'in' && (
                  <g>
                    <rect
                      x={-size / 2 - 26}
                      y={-8}
                      width={16}
                      height={14}
                      rx={2}
                      fill="#1e293b"
                      stroke="#00ffff"
                      strokeWidth={1}
                      style={{ pointerEvents: 'none' }}
                    />
                    <text
                      x={-size / 2 - 18}
                      y={0}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={signals?.get(`${node.id}.in`) === 1 ? '#22c55e' : '#9ca3af'}
                      fontSize={9}
                      fontWeight="600"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {signals?.get(`${node.id}.in`) ?? 0}
                    </text>
                  </g>
                )}
              </>
            )}
          </g>
        );
      })()}

      {/* Output port */}
      {!['Lamp'].includes(node.type) && (() => {
        const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'out';
        const isHovered = hoveredPort === 'out';
        const shouldGlow = isWireStart || (isHovered && wireStartPort);

        return (
          <g>
            {shouldGlow && (
              <circle
                cx={size / 2}
                cy={0}
                r={8}
                fill="#00ffff"
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <circle
              cx={size / 2}
              cy={0}
              r={5}
              fill={isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.out`) ? "#00ffff" : isActive ? '#22c55e' : '#9ca3af'}
              stroke={probedPorts?.has(`${node.id}.out`) ? "#00ffff" : "#fff"}
              strokeWidth={probedPorts?.has(`${node.id}.out`) ? 2.5 : isHovered ? 2.5 : 1.5}
              style={{ cursor: 'crosshair' }}
              onClick={(e) => {
                e.stopPropagation();
                // P-click to toggle probe
                if ((e.shiftKey && e.key === 'P') || (e.altKey && e.button === 0)) {
                  const label = `${node.type} out`;
                  onProbeToggle?.(node.id, 'out', label);
                } else {
                  onPortClick?.(node.id, 'out');
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const label = `${node.type} out`;
                onProbeToggle?.(node.id, 'out', label);
              }}
              onMouseEnter={() => setHoveredPort('out')}
              onMouseLeave={() => setHoveredPort(null)}
            />
            {/* Cyan glow for probed port */}
            {probedPorts?.has(`${node.id}.out`) && (
              <>
                <circle
                  cx={size / 2}
                  cy={0}
                  r={7}
                  fill="none"
                  stroke="#00ffff"
                  strokeWidth={3}
                  opacity={0.4}
                  style={{ pointerEvents: 'none' }}
                  className="animate-pulse"
                />
                {/* Signal value readout on hover */}
                {isHovered && hoveredPort === 'out' && (
                  <g>
                    <rect
                      x={size / 2 + 10}
                      y={-8}
                      width={16}
                      height={14}
                      rx={2}
                      fill="#1e293b"
                      stroke="#00ffff"
                      strokeWidth={1}
                      style={{ pointerEvents: 'none' }}
                    />
                    <text
                      x={size / 2 + 18}
                      y={0}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isActive ? '#22c55e' : '#9ca3af'}
                      fontSize={9}
                      fontWeight="600"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {isActive ? '1' : '0'}
                    </text>
                  </g>
                )}
              </>
            )}
          </g>
        );
      })()}
    </g>
  );
};

// Memoize NodeView to prevent unnecessary re-renders
export const NodeView = React.memo(NodeViewComponent, (prevProps, nextProps) => {
  // Only re-render if relevant props change
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.type === nextProps.node.type &&
    prevProps.node.position.x === nextProps.node.position.x &&
    prevProps.node.position.y === nextProps.node.position.y &&
    prevProps.node.rotation === nextProps.node.rotation &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.camera.x === nextProps.camera.x &&
    prevProps.camera.y === nextProps.camera.y &&
    prevProps.camera.zoom === nextProps.camera.zoom &&
    JSON.stringify(prevProps.node.state) === JSON.stringify(nextProps.node.state) &&
    JSON.stringify(prevProps.chipMetadata) === JSON.stringify(nextProps.chipMetadata) &&
    prevProps.wireStartPort?.nodeId === nextProps.wireStartPort?.nodeId &&
    prevProps.wireStartPort?.portName === nextProps.wireStartPort?.portName &&
    // Check if relevant signals changed
    (() => {
      // Get all ports for this node
      const getPorts = (nodeType: string) => {
        if (nodeType === 'AND' || nodeType === 'NAND') return ['a', 'b', 'out'];
        if (nodeType === 'OR' || nodeType === 'NOR' || nodeType === 'XOR' || nodeType === 'XNOR') return ['a', 'b', 'out'];
        if (nodeType === 'NOT') return ['in', 'out'];
        return ['in', 'out'];
      };

      const ports = getPorts(prevProps.node.type);
      for (const port of ports) {
        const prevSignal = prevProps.signals?.get(`${prevProps.node.id}.${port}`);
        const nextSignal = nextProps.signals?.get(`${nextProps.node.id}.${port}`);
        if (prevSignal !== nextSignal) return false;
      }
      return true;
    })()
  );
});
