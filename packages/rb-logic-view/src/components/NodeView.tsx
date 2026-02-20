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

export interface NodeIoPresentation {
  kind: 'switch' | 'button' | 'clock' | 'led' | 'generic';
  label?: string;
  pinAlias?: string;
}

export interface NodeViewProps {
  node: Node;
  camera: Camera;
  isSelected: boolean;
  isHighlighted?: boolean;
  isMismatchHighlighted?: boolean;
  mismatchPortKeys?: Set<string> | null;
  onSelect: (nodeId: string, addToSelection: boolean) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onPortClick?: (nodeId: string, portName: string) => void;
  onToggleSwitch?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onProbeToggle?: (nodeId: string, portName: string, label: string) => void;
  signals?: Map<string, 0 | 1>;
  chipMetadata?: ChipMetadata;
  wireStartPort?: PortRef;
  onPortHover?: (portName: string) => void;
  onPortLeave?: () => void;
  probedPorts?: Set<string>;
  validWireTargets?: Set<string> | null;
  hoveredWireTargetState?: 'valid' | 'invalid' | null;
  highlightedPort?: { nodeId: string; portName: string } | null;
  debugTick?: number | null;
  /** When provided by CanvasInputController, overrides node.position for rendering during drag. */
  dragPosition?: { x: number; y: number } | null;
  diagnosticBadge?: { error: number; warn: number; total: number };
  onDiagnosticBadgeClick?: (nodeId: string) => void;
  ioPresentation?: NodeIoPresentation;
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
  Clock: '#3B82F6',
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
  isMismatchHighlighted = false,
  mismatchPortKeys = null,
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
  validWireTargets,
  hoveredWireTargetState,
  highlightedPort,
  debugTick,
  dragPosition: externalDragPosition,
  diagnosticBadge,
  onDiagnosticBadgeClick,
  ioPresentation,
}) => {
  // Safe rotation: default to 0 if undefined to prevent rotate(undefined) SVG errors
  const safeRotation = Number.isFinite(node.rotation) ? node.rotation : 0;

  const isDragging = externalDragPosition != null;
  const [hoveredPort, setHoveredPort] = React.useState<string | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isToggleHovered, setIsToggleHovered] = React.useState(false);
  const [hoveredProbePort, setHoveredProbePort] = React.useState<{ portName: string; x: number; y: number } | null>(null);

  const getPortValue = React.useCallback(
    (portName: string) => {
      if (!signals) return 0;
      return (signals.get(`${node.id}.${portName}`) ?? 0) as 0 | 1;
    },
    [signals, node.id]
  );

  const isPortMismatch = React.useCallback(
    (portName: string) => {
      if (!mismatchPortKeys) return false;
      return mismatchPortKeys.has(`${node.id}:${portName}`);
    },
    [mismatchPortKeys, node.id]
  );

  const renderHoverBadge = (x: number, y: number, portName: string) => {
    if (!isHovered || hoveredPort !== portName) return null;
    const value = getPortValue(portName);
    const tickLabel = typeof debugTick === 'number' ? `t${debugTick}` : 't';
    return (
      <g>
        <rect
          x={x - 20}
          y={y - 10}
          width={36}
          height={16}
          rx={2}
          fill="#1e293b"
          stroke="#00ffff"
          strokeWidth={1}
          style={{ pointerEvents: 'none' }}
        />
        <text
          x={x - 2}
          y={y - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={value === 1 ? '#22c55e' : '#9ca3af'}
          fontSize={8}
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {tickLabel}:{value}
        </text>
      </g>
    );
  };

  const renderMismatchRing = (x: number, y: number, portName: string) => {
    if (!isPortMismatch(portName)) return null;
    return (
      <circle
        cx={x}
        cy={y}
        r={6}
        fill="none"
        stroke="#ef4444"
        strokeWidth={2}
        opacity={0.9}
        className="animate-pulse"
        style={{ pointerEvents: 'none' }}
      />
    );
  };

  const pos = externalDragPosition ?? node.position ?? { x: 0, y: 0 };
  const screenX = pos.x * camera.zoom + camera.x;
  const screenY = pos.y * camera.zoom + camera.y;
  const size = 48 * camera.zoom;
  const nodeScale = isDragging ? 1 : isSelected ? 1.03 : isHovered ? 1.018 : 1;
  const nodeTransform = `translate(${screenX}, ${screenY}) rotate(${safeRotation}) scale(${nodeScale})`;

  const isSwitch = node.type === 'Switch' || node.type === 'INPUT';
  const switchState = node.state?.isOn ?? 0;
  const toggleWidth = size * 0.75; // Increased from 0.66
  const toggleHeight = 16; // Increased from 14
  const toggleX = -toggleWidth / 2;
  const toggleY = -size / 2 - 20; // Moved slightly further up
  const toggleHitWidth = size * 1.0; // Increased hit area
  const toggleHitHeight = 28; // Increased hit area
  const toggleHitX = -toggleHitWidth / 2;
  const toggleHitY = toggleY - (toggleHitHeight - toggleHeight) / 2;


  const isIssueHighlighted = (portName: string) =>
    highlightedPort?.nodeId === node.id && highlightedPort.portName === portName;

  const isValidWireTarget = React.useCallback(
    (portName: string) => {
      if (!wireStartPort || !validWireTargets) return false;
      if (wireStartPort.nodeId === node.id && wireStartPort.portName === portName) return false;
      return validWireTargets.has(`${node.id}:${portName}`);
    },
    [wireStartPort, validWireTargets, node.id]
  );

  const getWireHighlightColor = React.useCallback(
    (portName: string, isHovered: boolean) => {
      const isStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === portName;
      if (isStart) return '#00ffff';
      if (!wireStartPort) return '#00ffff';

      if (isValidWireTarget(portName)) return '#22c55e';
      if (isHovered && hoveredWireTargetState === 'invalid') return '#ef4444';
      return '#00ffff';
    },
    [wireStartPort, node.id, hoveredWireTargetState, isValidWireTarget]
  );

  // Drag handling is now centralized in useCanvasInput (CanvasInputController).
  // NodeView only handles port clicks, toggle, and double-click.

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

  // No longer need global window listener because we have pointer capture!
  const color = NODE_COLORS[node.type] || '#94a3b8';
  const outputSignal = signals?.get(`${node.id}.out`) ?? 0;
  const inputSignal = signals?.get(`${node.id}.in`) ?? 0;
  const isActive =
    node.type === 'OUTPUT' || node.type === 'Lamp' ? inputSignal === 1 : outputSignal === 1;
  const ioKind = ioPresentation?.kind ?? inferDefaultIoKind(node.type);
  const ioDisplayLabel = (ioPresentation?.label?.trim() || node.label || node.type).toUpperCase();
  const ioPinAlias = ioPresentation?.pinAlias?.trim();
  const isChip = !!chipMetadata;
  const hasDiagnosticBadge = (diagnosticBadge?.total ?? 0) > 0;
  const diagnosticLabel =
    (diagnosticBadge?.error ?? 0) > 0
      ? `E${diagnosticBadge?.error ?? 0}`
      : `W${diagnosticBadge?.warn ?? 0}`;
  const diagnosticBadgeFill = (diagnosticBadge?.error ?? 0) > 0 ? '#dc2626' : '#d97706';

  const renderDiagnosticBadge = (x: number, y: number) => {
    if (!hasDiagnosticBadge) return null;
    return (
      <g
        data-testid={`logic-node-diagnostic-badge-${node.id}`}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onDiagnosticBadgeClick?.(node.id);
        }}
        style={{ cursor: 'pointer' }}
      >
        <circle cx={x} cy={y} r={8} fill={diagnosticBadgeFill} stroke="#f8fafc" strokeWidth={1.5} />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#f8fafc"
          fontSize={8}
          fontWeight="700"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {diagnosticLabel}
        </text>
      </g>
    );
  };

  // Render custom chip with black-box appearance
  if (isChip && chipMetadata) {
    const chipColor = chipMetadata.color || '#1e293b'; // Dark slate for chips
    const chipHeight = size * 1.5; // Taller for chips with multiple ports
    const portSpacing = chipHeight / (Math.max(chipMetadata.inputs.length, chipMetadata.outputs.length) + 1);

    return (
      <g
        transform={nodeTransform}
        data-node-id={node.id}
        data-node-selected={isSelected ? '1' : '0'}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        {/* Highlight ring */}
        {isHighlighted && (
          <rect
            x={-size / 2 - 4}
            y={-chipHeight / 2 - 4}
            width={size + 8}
            height={chipHeight + 8}
            fill="none"
            stroke="#3B82F6"
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
        {isMismatchHighlighted && (
          <rect
            x={-size / 2 - 4}
            y={-chipHeight / 2 - 4}
            width={size + 8}
            height={chipHeight + 8}
            fill="none"
            stroke="#f97316"
            strokeWidth={2}
            rx={8}
            opacity={0.8}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {renderDiagnosticBadge(size / 2 - 8, -chipHeight / 2 + 10)}

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
          const isValidTarget = isValidWireTarget(input.id);
          const isHovered = hoveredPort === input.id;
          const shouldGlow = isWireStart || isValidTarget || (isHovered && wireStartPort);
          const wireHighlightColor = getWireHighlightColor(input.id, isHovered);
          const isIssueHighlight = isIssueHighlighted(input.id);

          return (
            <g key={`input-${input.id}`}>
              {/* Enhanced hover glow - prominent for student-friendly wiring */}
              {isHovered && !wireStartPort && (
                <rect
                  x={-size / 2 - 14}
                  y={yPos - 14}
                  width={28}
                  height={28}
                  fill="#06B6D4"
                  opacity={0.25}
                  rx={4}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Valid target indicator - green highlight when wiring */}
              {wireStartPort && isValidTarget && (
                <>
                  <rect
                    x={-size / 2 - 14}
                    y={yPos - 14}
                    width={28}
                    height={28}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={3}
                    opacity={0.9}
                    rx={4}
                    style={{ pointerEvents: 'none' }}
                  />
                  <rect
                    x={-size / 2 - 14}
                    y={yPos - 14}
                    width={28}
                    height={28}
                    fill="#22c55e"
                    opacity={0.15}
                    rx={4}
                    style={{ pointerEvents: 'none' }}
                  />
                </>
              )}
              {/* Wire start indicator */}
              {isWireStart && (
                <rect
                  x={-size / 2 - 14}
                  y={yPos - 14}
                  width={28}
                  height={28}
                  fill="#00ffff"
                  opacity={0.3}
                  rx={4}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {isIssueHighlight && (
                <rect
                  x={-size / 2 - 6}
                  y={yPos - 6}
                  width={12}
                  height={12}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  rx={2}
                  opacity={0.8}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {renderMismatchRing(-size / 2, yPos, input.id)}
              {/* Invisible hit area (32×32px for student-friendly wiring) */}
              <rect
                x={-size / 2 - 16}
                y={yPos - 16}
                width={32}
                height={32}
                fill="transparent"
                data-port-id={input.id}
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  // P-click to toggle probe
                  if (e.shiftKey || (e.altKey && e.button === 0)) {
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
                fill={isWireStart ? "#00ffff" : isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.${input.id}`) ? "#00ffff" : "#3b82f6"}
                stroke={isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.${input.id}`) ? "#00ffff" : "#fff"}
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
              {renderHoverBadge(-size / 2 - 12, yPos, input.id)}
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
          const isValidTarget = isValidWireTarget(output.id);
          const isHovered = hoveredPort === output.id;
          const shouldGlow = isWireStart || isValidTarget || (isHovered && wireStartPort);
          const wireHighlightColor = getWireHighlightColor(output.id, isHovered);
          const isIssueHighlight = isIssueHighlighted(output.id);

          return (
            <g key={`output-${output.id}`}>
              {/* Enhanced hover glow - prominent for student-friendly wiring */}
              {isHovered && !wireStartPort && (
                <circle
                  cx={size / 2}
                  cy={yPos}
                  r={14}
                  fill="#06B6D4"
                  opacity={0.25}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Valid target indicator - green highlight when wiring */}
              {wireStartPort && isValidTarget && (
                <>
                  <circle
                    cx={size / 2}
                    cy={yPos}
                    r={14}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={3}
                    opacity={0.9}
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={size / 2}
                    cy={yPos}
                    r={14}
                    fill="#22c55e"
                    opacity={0.15}
                    style={{ pointerEvents: 'none' }}
                  />
                </>
              )}
              {/* Wire start indicator */}
              {isWireStart && (
                <circle
                  cx={size / 2}
                  cy={yPos}
                  r={14}
                  fill="#00ffff"
                  opacity={0.3}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {isIssueHighlight && (
                <circle
                  cx={size / 2}
                  cy={yPos}
                  r={7}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  opacity={0.8}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {renderMismatchRing(size / 2, yPos, output.id)}
              {/* Invisible hit area (16px radius circle = ~32px diameter for student-friendly wiring) */}
              <circle
                cx={size / 2}
                cy={yPos}
                r={16}
                fill="transparent"
                data-port-id={output.id}
                style={{ cursor: 'crosshair' }}
                onClick={(e) => {
                  e.stopPropagation();
                  // P-click to toggle probe
                  if (e.shiftKey || (e.altKey && e.button === 0)) {
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
                fill={isWireStart ? "#00ffff" : isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.${output.id}`) ? "#00ffff" : outputSignal ? '#22c55e' : '#6b7280'}
                stroke={isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.${output.id}`) ? "#00ffff" : "#fff"}
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
              {renderHoverBadge(size / 2 + 12, yPos, output.id)}
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
      transform={nodeTransform}
      data-node-id={node.id}
      data-node-selected={isSelected ? '1' : '0'}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      data-testid={`node-${node.type}-${node.id}`}
    >
      {/* Highlight ring */}
      {isHighlighted && (
        <rect
          x={-size / 2 - 4}
          y={-size / 2 - 4}
          width={size + 8}
          height={size + 8}
          fill="none"
          stroke="#3B82F6"
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
        fill={resolveNodeFill(node.type, ioKind, isActive, color)}
        stroke={isSelected ? '#3b82f6' : color}
        strokeWidth={isSelected ? 3 : 1}
        rx={4}
      />
      {isMismatchHighlighted && (
        <rect
          x={-size / 2 - 3}
          y={-size / 2 - 3}
          width={size + 6}
          height={size + 6}
          fill="none"
          stroke="#f97316"
          strokeWidth={2}
          rx={6}
          opacity={0.8}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {renderDiagnosticBadge(size / 2 - 8, -size / 2 + 10)}

      {node.type === 'INPUT' || node.type === 'Switch' ? (
        <g pointerEvents="none">
          {ioKind === 'button' ? (
            <>
              <rect
                x={-size * 0.18}
                y={-size * 0.18}
                width={size * 0.36}
                height={size * 0.36}
                rx={4}
                fill={isActive ? '#38bdf8' : '#1f2937'}
                stroke={isActive ? '#bae6fd' : '#64748b'}
                strokeWidth={1.2}
              />
              <text
                x={0}
                y={size * 0.34}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize={Math.max(6, 8 * camera.zoom)}
                fontWeight="600"
              >
                BTN
              </text>
            </>
          ) : ioKind === 'clock' ? (
            <>
              <rect
                x={-size * 0.26}
                y={-size * 0.12}
                width={size * 0.52}
                height={size * 0.24}
                rx={size * 0.08}
                fill={isActive ? '#0ea5e9' : '#1e3a5f'}
                stroke={isActive ? '#7dd3fc' : '#4f6f9a'}
                strokeWidth={1.2}
              />
              <text
                x={0}
                y={size * 0.34}
                textAnchor="middle"
                fill="#dbeafe"
                fontSize={Math.max(6, 8 * camera.zoom)}
                fontWeight="600"
              >
                CLK
              </text>
            </>
          ) : (
            <>
              <line
                x1={-size * 0.18}
                y1={size * 0.08}
                x2={size * 0.18}
                y2={size * 0.08}
                stroke="#93c5fd"
                strokeWidth={1.2}
                strokeLinecap="round"
              />
              <circle cx={-size * 0.1} cy={size * 0.08} r={2.2} fill="#dbeafe" />
              <circle cx={size * 0.1} cy={size * 0.08} r={2.2} fill="#dbeafe" />
            </>
          )}
        </g>
      ) : null}

      {(node.type === 'OUTPUT' || node.type === 'Lamp') && ioKind === 'led' ? (
        <g pointerEvents="none">
          <circle
            cx={0}
            cy={-size * 0.08}
            r={size * 0.17}
            fill={isActive ? '#34d399' : '#1f2937'}
            stroke={isActive ? '#a7f3d0' : '#64748b'}
            strokeWidth={1.4}
          />
          {isActive ? (
            <circle
              cx={0}
              cy={-size * 0.08}
              r={size * 0.24}
              fill="rgba(52, 211, 153, 0.22)"
            />
          ) : null}
        </g>
      ) : null}

      {/* Switch toggle control - DISABLED: now rendered in LogicCanvas overlay layer to avoid SVG clipping */}
      {/* Toggle is rendered in LogicCanvas.tsx <g id="rb-switch-overlay"> above all nodes */}

      {/* Node label */}
      <text
        x={0}
        y={node.type === 'OUTPUT' || node.type === 'Lamp' ? size * 0.18 : 0}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize={Math.max(10, 12 * camera.zoom)}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {ioDisplayLabel}
      </text>
      {ioPinAlias ? (
        <text
          x={0}
          y={size * 0.38}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#9fb6cf"
          fontSize={Math.max(6, 8 * camera.zoom)}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {ioPinAlias.toUpperCase()}
        </text>
      ) : null}

      {/* Input port */}
      {!['PowerSource', 'Clock'].includes(node.type) && (() => {
        const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'in';
        const isValidTarget = isValidWireTarget('in');
        const isHovered = hoveredPort === 'in';
        const shouldGlow = isWireStart || isValidTarget || (isHovered && wireStartPort);
        const wireHighlightColor = getWireHighlightColor('in', isHovered);
        const isIssueHighlight = isIssueHighlighted('in');

        return (
          <g>
            {shouldGlow && (
              <circle
                cx={-size / 2}
                cy={0}
                r={8}
                fill={wireHighlightColor}
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {isIssueHighlight && (
              <circle
                cx={-size / 2}
                cy={0}
                r={8}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2}
                opacity={0.8}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {renderMismatchRing(-size / 2, 0, 'in')}
            <circle
              cx={-size / 2}
              cy={0}
              r={5}
              fill={isWireStart ? "#00ffff" : isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#3b82f6"}
              stroke={isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#fff"}
              strokeWidth={probedPorts?.has(`${node.id}.in`) ? 2.5 : isHovered ? 2.5 : 1.5}
              data-port-id="in"
              style={{ cursor: 'crosshair' }}
              onClick={(e) => {
                e.stopPropagation();
                // P-click or right-click to toggle probe
                if ((e.shiftKey) || (e.altKey && e.button === 0)) {
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
            {renderHoverBadge(-size / 2 - 12, 0, 'in')}
          </g>
        );
      })()}

      {/* Output port */}
      {!['Lamp'].includes(node.type) && (() => {
        const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'out';
        const isValidTarget = isValidWireTarget('out');
        const isHovered = hoveredPort === 'out';
        const shouldGlow = isWireStart || isValidTarget || (isHovered && wireStartPort);
        const wireHighlightColor = getWireHighlightColor('out', isHovered);
        const isIssueHighlight = isIssueHighlighted('out');

        return (
          <g>
            {shouldGlow && (
              <circle
                cx={size / 2}
                cy={0}
                r={8}
                fill={wireHighlightColor}
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {isIssueHighlight && (
              <circle
                cx={size / 2}
                cy={0}
                r={8}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2}
                opacity={0.8}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {renderMismatchRing(size / 2, 0, 'out')}
            <circle
              cx={size / 2}
              cy={0}
              r={5}
              fill={isWireStart ? "#00ffff" : isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.out`) ? "#00ffff" : isActive ? '#22c55e' : '#9ca3af'}
              stroke={isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.out`) ? "#00ffff" : "#fff"}
              strokeWidth={probedPorts?.has(`${node.id}.out`) ? 2.5 : isHovered ? 2.5 : 1.5}
              data-port-id="out"
              style={{ cursor: 'crosshair' }}
              onClick={(e) => {
                e.stopPropagation();
                // P-click to toggle probe
                if (e.shiftKey || (e.altKey && e.button === 0)) {
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
            {renderHoverBadge(size / 2 + 12, 0, 'out')}
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
    prevProps.node.position?.x === nextProps.node.position?.x &&
    prevProps.node.position?.y === nextProps.node.position?.y &&
    prevProps.node.rotation === nextProps.node.rotation &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.camera.x === nextProps.camera.x &&
    prevProps.camera.y === nextProps.camera.y &&
    prevProps.camera.zoom === nextProps.camera.zoom &&
    prevProps.dragPosition?.x === nextProps.dragPosition?.x &&
    prevProps.dragPosition?.y === nextProps.dragPosition?.y &&
    prevProps.diagnosticBadge?.error === nextProps.diagnosticBadge?.error &&
    prevProps.diagnosticBadge?.warn === nextProps.diagnosticBadge?.warn &&
    prevProps.diagnosticBadge?.total === nextProps.diagnosticBadge?.total &&
    prevProps.ioPresentation?.kind === nextProps.ioPresentation?.kind &&
    prevProps.ioPresentation?.label === nextProps.ioPresentation?.label &&
    prevProps.ioPresentation?.pinAlias === nextProps.ioPresentation?.pinAlias &&
    JSON.stringify(prevProps.node.state) === JSON.stringify(nextProps.node.state) &&
    JSON.stringify(prevProps.chipMetadata) === JSON.stringify(nextProps.chipMetadata) &&
    prevProps.wireStartPort?.nodeId === nextProps.wireStartPort?.nodeId &&
    prevProps.wireStartPort?.portName === nextProps.wireStartPort?.portName &&
    prevProps.validWireTargets === nextProps.validWireTargets &&
    prevProps.hoveredWireTargetState === nextProps.hoveredWireTargetState &&
    // Check if relevant signals changed
    (() => {
      // Get all ports for this node
      const getPorts = (nodeType: string) => {
        if (nodeType === 'AND' || nodeType === 'NAND') return ['a', 'b', 'out'];
        if (nodeType === 'OR' || nodeType === 'NOR' || nodeType === 'XOR' || nodeType === 'XNOR') return ['a', 'b', 'out'];
        if (nodeType === 'NOT') return ['in', 'out'];
        if (nodeType === 'VoltageSource') return ['out'];
        if (nodeType === 'LDR') return ['resistance', 'v_out'];
        if (nodeType === 'FixedResistor') return ['resistance'];
        if (nodeType === 'VoltageDivider') return ['v_in', 'r1', 'r2', 'v_out'];
        if (nodeType === 'LM358') return ['V_plus', 'V_minus', 'out'];
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

function inferDefaultIoKind(nodeType: string): NodeIoPresentation['kind'] {
  if (nodeType === 'OUTPUT' || nodeType === 'Lamp') return 'led';
  if (nodeType === 'Clock') return 'clock';
  if (nodeType === 'INPUT' || nodeType === 'Switch') return 'switch';
  return 'generic';
}

function resolveNodeFill(
  nodeType: string,
  ioKind: NodeIoPresentation['kind'],
  isActive: boolean,
  fallbackColor: string
): string {
  if (nodeType === 'INPUT' || nodeType === 'Switch') {
    if (ioKind === 'button') return isActive ? '#0f3d57' : '#1f2937';
    if (ioKind === 'clock') return isActive ? '#0f4b7a' : '#1e3046';
    return isActive ? '#1f766f' : '#263241';
  }
  if (nodeType === 'OUTPUT' || nodeType === 'Lamp') {
    return isActive ? '#18473b' : '#1f2937';
  }
  return isActive ? fallbackColor : '#2a2a2a';
}
