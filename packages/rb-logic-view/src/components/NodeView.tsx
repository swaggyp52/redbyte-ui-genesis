// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Node, PortRef } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';
import { wirePortState } from '../tools/wireGuidance';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

type NodeLodBand = 'full' | 'compact' | 'minimal';

function resolveNodeLod(zoom: number): NodeLodBand {
  // 50% is the lowest authored Design zoom preset. Keep circuit identity
  // visible there; the minimal band is reserved for free-wheel overview zoom.
  if (zoom < 0.5) return 'minimal';
  if (zoom < 0.85) return 'compact';
  return 'full';
}

function compactNodeLabel(label: string, maxCharacters = 18): string {
  const characters = Array.from(label.trim());
  if (characters.length <= maxCharacters) return characters.join('');
  return `${characters.slice(0, maxCharacters - 1).join('')}…`;
}

function estimateLabelWidth(label: string, fontSize: number): number {
  return Math.min(144, Math.max(56, Math.round(Array.from(label).length * fontSize * 0.58 + 18)));
}

export interface ChipMetadata {
  name: string;
  inputs: Array<{ id: string; name: string }>;
  outputs: Array<{ id: string; name: string }>;
  color?: string;
  layer?: number;
}

export interface PortClusterChoice {
  id: string;
  name: string;
}

export interface NodeIoPresentation {
  kind: 'switch' | 'button' | 'clock' | 'led' | 'generic';
  label?: string;
  pinAlias?: string;
}

export type LogicDisplayValue = 0 | 1 | 'X' | 'Z';

export interface NodeViewProps {
  node: Node;
  camera: Camera;
  presentationZoomMode?: 'dense' | 'classroom';
  /** Canvas color language. Defaults to 'dark' to preserve legacy rendering. */
  appearance?: 'light' | 'dark';
  isSelected: boolean;
  isHighlighted?: boolean;
  isMismatchHighlighted?: boolean;
  mismatchPortKeys?: Set<string> | null;
  onSelect: (nodeId: string, addToSelection: boolean) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onPortClick?: (nodeId: string, portName: string) => void;
  onPortClusterClick?: (
    nodeId: string,
    side: 'input' | 'output',
    ports: PortClusterChoice[],
    anchor: { x: number; y: number }
  ) => void;
  onToggleSwitch?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeContextMenu?: (nodeId: string, clientX: number, clientY: number) => void;
  onProbeToggle?: (nodeId: string, portName: string, label: string) => void;
  signals?: Map<string, LogicDisplayValue>;
  chipMetadata?: ChipMetadata;
  wireStartPort?: PortRef;
  onPortHover?: (portName: string) => void;
  onPortLeave?: () => void;
  probedPorts?: Set<string>;
  validWireTargets?: Set<string> | null;
  hoveredWireTargetState?: 'valid' | 'invalid' | null;
  highlightedPort?: { nodeId: string; portName: string } | null;
  highlightedPortKeys?: Set<string> | null;
  debugTick?: number | null;
  /** When provided by CanvasInputController, overrides node.position for rendering during drag. */
  dragPosition?: { x: number; y: number } | null;
  diagnosticBadge?: { error: number; warn: number; total: number };
  onDiagnosticBadgeClick?: (nodeId: string) => void;
  ioPresentation?: NodeIoPresentation;
  /** B1: Eval order step number (1-based). Shown as #N badge when node is hovered. */
  evalSequence?: number | null;
  /** Phase 3: real-time canvas error glow. 'error' = red, 'warn' = amber. */
  issueGlow?: 'error' | 'warn' | null;
  /** Batch 1: explicit per-port issue severity. */
  issuePortSeverities?: Map<string, 'error' | 'warn'> | null;
}

interface NodePalette {
  /** Body fill for logic/gate chips (accent tints live in resolveNodeFill). */
  body: string;
  bodyStroke: string;
  bodyStrokeHover: string;
  /** Header band across the top of the node. */
  header: string;
  headerStroke: string;
  /** Floating identity nameplate above the node. */
  nameplate: string;
  nameplateStroke: string;
  /** Primary label ink (instance / IO name). */
  label: string;
  /** Secondary metadata ink (type · layer, sub labels). */
  metadata: string;
  /** Text-halo stroke so labels stay legible over the body. */
  labelHalo: string;
}

const DARK_NODE_PALETTE: NodePalette = {
  body: '#1b2b3f',
  bodyStroke: '#475569',
  bodyStrokeHover: '#8b5cf6',
  header: 'rgba(10, 22, 37, 0.92)',
  headerStroke: 'rgba(142, 199, 255, 0.3)',
  nameplate: 'rgba(6, 15, 25, 0.96)',
  nameplateStroke: 'rgba(103, 232, 249, 0.55)',
  label: '#f4f8ff',
  metadata: '#b9cee3',
  labelHalo: '#07111b',
};

// Light technical schematic: light card, dark ink, restrained borders. Value
// and selection color still come from state (resolveNodeFill / stroke), so the
// node communicates through color rather than decoration.
const LIGHT_NODE_PALETTE: NodePalette = {
  body: '#ffffff',
  bodyStroke: '#cbd5e1',
  bodyStrokeHover: '#7c3aed',
  header: '#eef2f7',
  headerStroke: 'rgba(100, 116, 139, 0.35)',
  nameplate: '#ffffff',
  nameplateStroke: 'rgba(100, 116, 139, 0.45)',
  label: '#0f172a',
  metadata: '#475569',
  labelHalo: '#ffffff',
};

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
  AND3: '#c084fc',
  OR3: '#f472b6',
  NAND3: '#a78bfa',
  NOR3: '#a78bfa',
  XOR3: '#ec4899',
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
  presentationZoomMode = 'dense',
  appearance = 'dark',
  isSelected,
  isHighlighted = false,
  isMismatchHighlighted = false,
  mismatchPortKeys = null,
  onSelect,
  onMove,
  onPortClick,
  onPortClusterClick,
  onNodeDoubleClick,
  onNodeContextMenu,
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
  highlightedPortKeys,
  debugTick,
  dragPosition: externalDragPosition,
  diagnosticBadge,
  onDiagnosticBadgeClick,
  ioPresentation,
  evalSequence,
  issueGlow,
  issuePortSeverities = null,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Safe rotation: default to 0 if undefined to prevent rotate(undefined) SVG errors
  const safeRotation = Number.isFinite(node.rotation) ? node.rotation : 0;

  const isDragging = externalDragPosition != null;
  const [hoveredPort, setHoveredPort] = React.useState<string | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [hoveredProbePort, setHoveredProbePort] = React.useState<{ portName: string; x: number; y: number } | null>(null);
  const [flashState, setFlashState] = React.useState<{ key: number; color: string } | null>(null);
  const prevOutputRef = React.useRef<LogicDisplayValue | -1>(-1);

  const getPortValue = React.useCallback(
    (portName: string) => {
      if (!signals) return 0;
      return signals.get(`${node.id}.${portName}`) ?? 0;
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
  // Appearance palette. 'dark' reproduces the legacy inline colors exactly so
  // nothing changes for callers that do not opt in; 'light' renders compact
  // schematic nodes — light card, dark ink, colored accent header — on the
  // light technical canvas.
  const pal = appearance === 'light' ? LIGHT_NODE_PALETTE : DARK_NODE_PALETTE;
  const presentationScale = presentationZoomMode === 'classroom' ? 1.15 : 1;
  const size = 48 * camera.zoom * presentationScale;
  const inlinePortRadius = presentationZoomMode === 'classroom' ? 6.4 : 5;
  const inlinePortGlowRadius = presentationZoomMode === 'classroom' ? 9.5 : 8;
  const nodeLabelFont = Math.max(12, (presentationZoomMode === 'classroom' ? 14 : 13) * camera.zoom);
  const pinAliasFont = Math.max(12, (presentationZoomMode === 'classroom' ? 13 : 12) * camera.zoom);
  const pinNameFont = Math.max(12, (presentationZoomMode === 'classroom' ? 13 : 12) * camera.zoom);
  const nodeScale = isDragging ? 1 : isSelected ? 1.03 : isHovered ? 1.018 : 1;
  const nodeCornerRadius = presentationZoomMode === 'classroom' ? 10 : 8;
  const nodeHeaderHeight = Math.max(14, size * (presentationZoomMode === 'classroom' ? 0.3 : 0.28));
  const chipHeaderHeight = Math.max(16, size * (presentationZoomMode === 'classroom' ? 0.28 : 0.24));
  const nodeTransform = `translate(${screenX}, ${screenY}) rotate(${safeRotation}) scale(${nodeScale})`;
  const lod = resolveNodeLod(camera.zoom);
  const shouldShowPortLabels = lod === 'full' && (isHovered || isSelected || wireStartPort != null);

  const isSwitch = node.type === 'Switch' || node.type === 'INPUT';


  const isTraceHighlighted = (portName: string) =>
    (highlightedPort?.nodeId === node.id && highlightedPort.portName === portName) ||
    highlightedPortKeys?.has(`${node.id}:${portName}`) === true;

  const getIssuePortSeverity = React.useCallback(
    (portName: string) => issuePortSeverities?.get(`${node.id}:${portName}`) ?? null,
    [issuePortSeverities, node.id]
  );

  const getIssueColor = React.useCallback((severity: 'error' | 'warn' | null) => {
    if (severity === 'error') return '#ef4444';
    if (severity === 'warn') return '#f59e0b';
    return '#f59e0b';
  }, []);

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Double-click for chip drill-down only (not switches)
    if (!isSwitch && onNodeDoubleClick) {
      onNodeDoubleClick(node.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onNodeContextMenu) return;
    e.preventDefault();
    e.stopPropagation();
    onNodeContextMenu(node.id, e.clientX, e.clientY);
  };

  // No longer need global window listener because we have pointer capture!
  const color = NODE_COLORS[node.type] || '#94a3b8';
  const outputSignal = signals?.get(`${node.id}.out`) ?? 0;
  const inputSignal = signals?.get(`${node.id}.in`) ?? 0;
  const isActive =
    node.type === 'OUTPUT' || node.type === 'Lamp' ? inputSignal === 1 : outputSignal === 1;
  const nodeOutputValue = node.type === 'OUTPUT' || node.type === 'Lamp' ? inputSignal : outputSignal;
  const nodeOutputIsUnknown = nodeOutputValue === 'X' || nodeOutputValue === 'Z';

  // Gate flash: briefly overlay green on rising edge, orange on falling edge
  React.useEffect(() => {
    const prev = prevOutputRef.current;
    const curr = nodeOutputValue;
    if (
      prev !== -1 &&
      prev !== curr &&
      (prev === 0 || prev === 1) &&
      (curr === 0 || curr === 1)
    ) {
      setFlashState({
        key: Date.now(),
        color: curr === 1 ? 'rgba(34,197,94,0.55)' : 'rgba(249,115,22,0.4)',
      });
    }
    prevOutputRef.current = curr;
  }, [nodeOutputValue]);

  const ioKind = ioPresentation?.kind ?? inferDefaultIoKind(node.type);
  const ioDisplayLabel = (ioPresentation?.label?.trim() || node.label || node.type).toUpperCase();
  const ioPinAlias = ioPresentation?.pinAlias?.trim();
  const shouldShowPinAlias = lod === 'full' && !!ioPinAlias && (isHovered || isSelected);
  const showOutputStateBadge =
    !isSwitch &&
    node.type !== 'OUTPUT' &&
    node.type !== 'Lamp' &&
    node.type !== 'Clock';
  const isChip = !!chipMetadata;
  const authoredChipLabel = isChip ? node.label?.trim() : '';
  const chipLogicalName = authoredChipLabel || chipMetadata?.name || node.type;
  const chipDisplayLabel = compactNodeLabel(chipLogicalName);
  const chipLogicalNameFont = Math.min(15, Math.max(12, 13.5 * camera.zoom));
  const chipMetadataFont = Math.min(14, Math.max(8, 12.5 * camera.zoom));
  const chipNameplateWidth = estimateLabelWidth(chipDisplayLabel, chipLogicalNameFont);
  const chipNameplateHeight = 18;
  const chipTypeLabel = (chipMetadata?.name ?? node.type).toUpperCase();
  const chipTypeLayerLabel =
    nodeOutputIsUnknown && (node.type === 'OUTPUT' || node.type === 'Lamp')
      ? `${chipTypeLabel} · ${nodeOutputValue}`
      : authoredChipLabel
        ? chipMetadata?.layer === undefined
          ? chipTypeLabel
          : `${chipTypeLabel} · L${chipMetadata.layer}`
        : chipMetadata?.layer === undefined
          ? ''
          : `L${chipMetadata.layer}`;
  const hasExternalIoIdentity =
    node.type === 'INPUT' ||
    node.type === 'Switch' ||
    node.type === 'OUTPUT' ||
    node.type === 'Lamp';
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
    const isDenseInputSide = chipMetadata.inputs.length > 1 && portSpacing < 24;
    const isDenseOutputSide = chipMetadata.outputs.length > 1 && portSpacing < 24;
    const directHitSizeFor = (count: number) =>
      count <= 1 ? 32 : Math.max(24, Math.min(32, portSpacing));
    const inputPortHitSize = directHitSizeFor(chipMetadata.inputs.length);
    const outputPortHitSize = directHitSizeFor(chipMetadata.outputs.length);
    const inputPortHitHalf = inputPortHitSize / 2;
    const outputPortHitHalf = outputPortHitSize / 2;
    const clusterPadding = 12;
    const inputClusterTop = -chipHeight / 2 + portSpacing - clusterPadding;
    const inputClusterHeight =
      portSpacing * Math.max(0, chipMetadata.inputs.length - 1) + clusterPadding * 2;
    const outputClusterTop = -chipHeight / 2 + portSpacing - clusterPadding;
    const outputClusterHeight =
      portSpacing * Math.max(0, chipMetadata.outputs.length - 1) + clusterPadding * 2;
    const openPortCluster = (
      side: 'input' | 'output',
      ports: PortClusterChoice[],
      anchorX: number
    ) => {
      onPortClusterClick?.(node.id, side, ports, {
        x: screenX + anchorX,
        y: screenY,
      });
    };
    const clusterWireState = (ports: PortClusterChoice[]) => {
      const states = ports.map((port) =>
        wirePortState(wireStartPort, node.id, port.id, validWireTargets)
      );
      if (states.includes('source')) return 'source';
      if (states.includes('valid-target')) return 'valid-target';
      return wireStartPort ? 'invalid-target' : 'idle';
    };
    const inputClusterWireState = clusterWireState(chipMetadata.inputs);
    const outputClusterWireState = clusterWireState(chipMetadata.outputs);
    return (
      <g
        transform={nodeTransform}
        data-node-id={node.id}
        data-node-type={node.type}
        data-sim-value={nodeOutputValue}
        data-lod={lod}
        data-node-selected={isSelected ? '1' : '0'}
        data-testid={`node-${node.type}-${node.id}`}
        onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        {authoredChipLabel ? <title>{`${authoredChipLabel} · ${chipMetadata.name}`}</title> : null}
        {/* Highlight ring */}
        {isHighlighted && (
          <>
            <rect
              x={-size / 2 - 7}
              y={-chipHeight / 2 - 7}
              width={size + 14}
              height={chipHeight + 14}
              fill="rgba(56, 189, 248, 0.08)"
              stroke="rgba(125, 211, 252, 0.28)"
              strokeWidth={1.5}
              rx={10}
              style={{ pointerEvents: 'none' }}
            />
            <rect
              x={-size / 2 - 4}
              y={-chipHeight / 2 - 4}
              width={size + 8}
              height={chipHeight + 8}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2.5}
              rx={8}
              className="animate-pulse"
              style={{ pointerEvents: 'none' }}
            />
          </>
        )}

        {/* B1: Eval sequence badge — shown on hover when eval order is active */}
        {isHovered && evalSequence != null && (
          <g data-testid={`logic-node-eval-badge-${node.id}`} style={{ pointerEvents: 'none' }}>
            <rect x={-size / 2} y={-chipHeight / 2 - 36} width={28} height={13} rx={3} fill="#0f172a" stroke="#38bdf8" strokeWidth={1} />
            <text x={-size / 2 + 14} y={-chipHeight / 2 - 29.5} textAnchor="middle" dominantBaseline="middle" fill="#38bdf8" fontSize={8} fontWeight="700">
              {`#${evalSequence}`}
            </text>
          </g>
        )}

        {/* Chip body. Light: white card with the type color as its border, so
            the type is signaled without a saturated fill. Dark: legacy look. */}
        <rect
          className="logic-node-body"
          x={-size / 2}
          y={-chipHeight / 2}
          width={size}
          height={chipHeight}
          fill={appearance === 'light' ? pal.body : chipColor}
          stroke={
            isSelected
              ? '#3b82f6'
              : isHovered
                ? pal.bodyStrokeHover
                : appearance === 'light'
                  ? chipColor
                  : pal.bodyStroke
          }
          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
          rx={nodeCornerRadius}
        />
        {/* Edge-triggered flash overlay */}
        {flashState && !prefersReducedMotion && (
          <rect
            key={flashState.key}
            x={-size / 2}
            y={-chipHeight / 2}
            width={size}
            height={chipHeight}
            rx={nodeCornerRadius}
            fill={flashState.color}
            opacity={0}
            style={{ pointerEvents: 'none' }}
          >
            <animate attributeName="opacity" values="1;0" dur="0.4s" fill="freeze" />
          </rect>
        )}
        <rect
          className="logic-node-header"
          x={-size / 2}
          y={-chipHeight / 2}
          width={size}
          height={chipHeaderHeight}
          rx={nodeCornerRadius}
          fill={pal.header}
          stroke={pal.headerStroke}
          strokeWidth={0.8}
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
        {showOutputStateBadge ? (
          <g data-testid={`logic-node-output-indicator-${node.id}`}>
            <circle
              cx={-size / 2 + 10}
              cy={-chipHeight / 2 + 10}
              r={8}
              fill={nodeOutputIsUnknown ? '#5b4512' : nodeOutputValue === 1 ? '#166534' : '#1e293b'}
              stroke={nodeOutputIsUnknown ? '#fbbf24' : nodeOutputValue === 1 ? '#86efac' : '#94a3b8'}
              strokeWidth={1.4}
            />
            <text
              x={-size / 2 + 10}
              y={-chipHeight / 2 + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={nodeOutputIsUnknown ? '#fde68a' : nodeOutputValue === 1 ? '#dcfce7' : '#cbd5e1'}
              fontSize={12}
              fontWeight="700"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {nodeOutputValue}
            </text>
          </g>
        ) : null}

        {/* Logical instance identity lives outside the narrow status header so
            authored names cannot collide with output/diagnostic indicators. */}
        {lod !== 'minimal' && !hasExternalIoIdentity && (
          <g
            data-testid={`logic-node-identity-${node.id}`}
            data-label-role="logical-name"
            data-full-label={chipLogicalName}
            style={{ pointerEvents: 'none' }}
          >
            <rect
              data-testid={`logic-node-identity-plate-${node.id}`}
              x={-chipNameplateWidth / 2}
              y={-chipHeight / 2 - 22}
              width={chipNameplateWidth}
              height={chipNameplateHeight}
              rx={5}
              fill={pal.nameplate}
              stroke={pal.nameplateStroke}
              strokeWidth={1}
            />
            <text
              className="logic-node-label"
              data-node-label="1"
              x={0}
              y={-chipHeight / 2 - 13}
              dominantBaseline="middle"
              textAnchor="middle"
              fill={pal.label}
              fontSize={chipLogicalNameFont}
              fontWeight="700"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {chipDisplayLabel}
            </text>
          </g>
        )}

        {/* Type/layer remains secondary to the authored instance name. Compact
            zooms retain the identity at a reduced scale without competing with
            the primary nameplate. */}
        {lod !== 'minimal' && chipTypeLayerLabel && (
          <text
            className="logic-node-metadata"
            data-testid={`logic-node-type-layer-${node.id}`}
            data-label-role="type-layer"
            x={0}
            y={chipHeight / 2 - Math.max(6, chipMetadataFont * 0.75)}
            dominantBaseline="middle"
            textAnchor="middle"
            fill={pal.metadata}
            fontSize={chipMetadataFont}
            fontWeight="650"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              paintOrder: 'stroke fill',
              stroke: pal.labelHalo,
              strokeWidth: 2.4,
              strokeLinejoin: 'round',
            }}
          >
            {chipTypeLayerLabel}
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
          const isTraceHighlight = isTraceHighlighted(input.id);
          const issueSeverity = getIssuePortSeverity(input.id);
          const issueColor = getIssueColor(issueSeverity);
          const portWireState = wirePortState(wireStartPort, node.id, input.id, validWireTargets);

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
              {isTraceHighlight && (
                <rect
                  x={-size / 2 - 10}
                  y={yPos - 10}
                  width={20}
                  height={20}
                  fill="none"
                  stroke="#67e8f9"
                  strokeWidth={2}
                  rx={3}
                  opacity={0.78}
                  style={{ pointerEvents: 'none' }}
                  data-testid={`logic-node-trace-port-${node.id}-${input.id}`}
                />
              )}
              {issueSeverity && (
                <rect
                  x={-size / 2 - 6}
                  y={yPos - 6}
                  width={12}
                  height={12}
                  fill="none"
                  stroke={issueColor}
                  strokeWidth={2}
                  rx={2}
                  opacity={0.88}
                  style={{ pointerEvents: 'none' }}
                  data-testid={`logic-node-issue-port-${node.id}-${input.id}`}
                />
              )}
              {renderMismatchRing(-size / 2, yPos, input.id)}
              {/* Invisible hit area scales with pin spacing and stays biased outside the chip body. */}
              <rect
                x={-size / 2 - (inputPortHitSize - 4)}
                y={yPos - inputPortHitHalf}
                width={inputPortHitSize}
                height={inputPortHitSize}
                fill="transparent"
                data-port-id={isDenseInputSide ? undefined : input.id}
                data-port-density={isDenseInputSide ? 'dense' : 'sparse'}
                data-wire-port-state={portWireState}
                style={{ cursor: 'crosshair', pointerEvents: isDenseInputSide ? 'none' : 'auto' }}
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
              {shouldShowPortLabels && (
                <text
                  className="logic-port-label"
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
              )}
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
          const isTraceHighlight = isTraceHighlighted(output.id);
          const issueSeverity = getIssuePortSeverity(output.id);
          const issueColor = getIssueColor(issueSeverity);
          const portWireState = wirePortState(wireStartPort, node.id, output.id, validWireTargets);

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
              {isTraceHighlight && (
                <circle
                  cx={size / 2}
                  cy={yPos}
                  r={9}
                  fill="none"
                  stroke="#67e8f9"
                  strokeWidth={2}
                  opacity={0.78}
                  style={{ pointerEvents: 'none' }}
                  data-testid={`logic-node-trace-port-${node.id}-${output.id}`}
                />
              )}
              {issueSeverity && (
                <circle
                  cx={size / 2}
                  cy={yPos}
                  r={7}
                  fill="none"
                  stroke={issueColor}
                  strokeWidth={2}
                  opacity={0.88}
                  style={{ pointerEvents: 'none' }}
                  data-testid={`logic-node-issue-port-${node.id}-${output.id}`}
                />
              )}
              {renderMismatchRing(size / 2, yPos, output.id)}
              {/* Invisible hit area scales with pin spacing and stays biased outside the chip body. */}
              <rect
                x={size / 2 - 4}
                y={yPos - outputPortHitHalf}
                width={outputPortHitSize}
                height={outputPortHitSize}
                rx={outputPortHitHalf}
                fill="transparent"
                data-port-id={isDenseOutputSide ? undefined : output.id}
                data-port-density={isDenseOutputSide ? 'dense' : 'sparse'}
                data-wire-port-state={portWireState}
                style={{ cursor: 'crosshair', pointerEvents: isDenseOutputSide ? 'none' : 'auto' }}
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
                r={presentationZoomMode === 'classroom' ? 4.8 : 4}
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
              {shouldShowPortLabels && (
                <text
                  className="logic-port-label"
                  x={size / 2 + 8}
                  y={yPos}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill="#94a3b8"
                  fontSize={pinNameFont}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {output.name}
                </text>
              )}
            </g>
          );
        })}
        {isDenseInputSide ? (
          <rect
            x={-size / 2 - 28}
            y={inputClusterTop}
            width={32}
            height={inputClusterHeight}
            rx={6}
            fill="rgba(14, 165, 233, 0.08)"
            stroke="rgba(125, 211, 252, 0.5)"
            strokeWidth={1}
            strokeDasharray="3 3"
            role="button"
            tabIndex={0}
            aria-label={`Choose one of ${chipMetadata.inputs.length} input ports on ${chipMetadata.name}${inputClusterWireState === 'valid-target' ? '; compatible wire targets available' : ''}`}
            data-port-cluster="input"
            data-port-ids={chipMetadata.inputs.map((port) => port.id).join(' ')}
            data-port-density="dense"
            data-wire-port-state={inputClusterWireState}
            data-testid={`logic-port-cluster-${node.id}-input`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              openPortCluster('input', chipMetadata.inputs, -size / 2 - 12);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              openPortCluster('input', chipMetadata.inputs, -size / 2 - 12);
            }}
          />
        ) : null}
        {isDenseOutputSide ? (
          <rect
            x={size / 2 - 4}
            y={outputClusterTop}
            width={32}
            height={outputClusterHeight}
            rx={6}
            fill="rgba(14, 165, 233, 0.08)"
            stroke="rgba(125, 211, 252, 0.5)"
            strokeWidth={1}
            strokeDasharray="3 3"
            role="button"
            tabIndex={0}
            aria-label={`Choose one of ${chipMetadata.outputs.length} output ports on ${chipMetadata.name}${outputClusterWireState === 'valid-target' ? '; compatible wire targets available' : ''}`}
            data-port-cluster="output"
            data-port-ids={chipMetadata.outputs.map((port) => port.id).join(' ')}
            data-port-density="dense"
            data-wire-port-state={outputClusterWireState}
            data-testid={`logic-port-cluster-${node.id}-output`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              openPortCluster('output', chipMetadata.outputs, size / 2 + 12);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              openPortCluster('output', chipMetadata.outputs, size / 2 + 12);
            }}
          />
        ) : null}
      </g>
    );
  }

  // Standard node rendering
  return (
    <g
      transform={nodeTransform}
      data-node-id={node.id}
      data-node-type={node.type}
      data-sim-value={nodeOutputValue}
      data-lod={lod}
      data-node-selected={isSelected ? '1' : '0'}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      data-testid={`node-${node.type}-${node.id}`}
    >
      {/* Highlight ring */}
      {isHighlighted && (
        <>
          <rect
            x={-size / 2 - 7}
            y={-size / 2 - 7}
            width={size + 14}
            height={size + 14}
            fill="rgba(56, 189, 248, 0.08)"
            stroke="rgba(125, 211, 252, 0.28)"
            strokeWidth={1.5}
            rx={9}
            style={{ pointerEvents: 'none' }}
          />
          <rect
            x={-size / 2 - 4}
            y={-size / 2 - 4}
            width={size + 8}
            height={size + 8}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2.5}
            rx={6}
            className="animate-pulse"
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}
      {/* Issue glow ring (Phase 3 real-time canvas errors) */}
      {issueGlow && (
        <rect
          data-testid={`node-issue-glow-${node.id}`}
          x={-size / 2 - 3}
          y={-size / 2 - 3}
          width={size + 6}
          height={size + 6}
          fill="none"
          stroke={issueGlow === 'error' ? '#ef4444' : '#f59e0b'}
          strokeWidth={2.5}
          rx={6}
          opacity={0.85}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* B1: Eval sequence badge — shown on hover when eval order is active */}
      {isHovered && evalSequence != null && (
        <g data-testid={`logic-node-eval-badge-${node.id}`} style={{ pointerEvents: 'none' }}>
          <rect x={-size / 2} y={-size / 2 - 14} width={28} height={13} rx={3} fill="#0f172a" stroke="#38bdf8" strokeWidth={1} />
          <text x={-size / 2 + 14} y={-size / 2 - 7} textAnchor="middle" dominantBaseline="middle" fill="#38bdf8" fontSize={8} fontWeight="700">
            {`#${evalSequence}`}
          </text>
        </g>
      )}

      {/* Node body */}
      <rect
        className="logic-node-body"
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        fill={resolveNodeFill(node.type, ioKind, isActive, color, appearance)}
        stroke={isSelected ? '#3b82f6' : color}
        strokeWidth={isSelected ? 3 : 1}
        rx={nodeCornerRadius}
      />
      {/* Edge-triggered flash overlay */}
      {flashState && !prefersReducedMotion && (
        <rect
          key={flashState.key}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          rx={nodeCornerRadius}
          fill={flashState.color}
          opacity={0}
          style={{ pointerEvents: 'none' }}
        >
          <animate attributeName="opacity" values="1;0" dur="0.4s" fill="freeze" />
        </rect>
      )}
      <rect
        className="logic-node-header"
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={nodeHeaderHeight}
        rx={nodeCornerRadius}
        fill={pal.header}
        stroke={pal.headerStroke}
        strokeWidth={0.8}
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
      {showOutputStateBadge ? (
        <g data-testid={`logic-node-output-indicator-${node.id}`}>
          <circle
            cx={-size / 2 + 10}
            cy={-size / 2 + 10}
            r={8}
            fill={nodeOutputIsUnknown ? '#5b4512' : nodeOutputValue === 1 ? '#166534' : '#1e293b'}
            stroke={nodeOutputIsUnknown ? '#fbbf24' : nodeOutputValue === 1 ? '#86efac' : '#94a3b8'}
            strokeWidth={1.4}
          />
          <text
            x={-size / 2 + 10}
            y={-size / 2 + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={nodeOutputIsUnknown ? '#fde68a' : nodeOutputValue === 1 ? '#dcfce7' : '#cbd5e1'}
            fontSize={8}
            fontWeight="700"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {nodeOutputValue}
          </text>
        </g>
      ) : null}

      {(node.type === 'INPUT' || node.type === 'Switch' || node.type === 'Clock' || node.type === 'OUTPUT' || node.type === 'Lamp') ? (
        <g pointerEvents="none">
          <circle
            cx={0}
            cy={size * 0.08}
            r={Math.max(5, size * 0.11)}
            fill={nodeOutputIsUnknown ? '#5b4512' : isActive ? '#22c55e' : '#1e293b'}
            stroke={nodeOutputIsUnknown ? '#fbbf24' : isActive ? '#a7f3d0' : '#64748b'}
            strokeWidth={1.4}
          />
          {isActive ? (
            <circle
              cx={0}
              cy={size * 0.08}
              r={Math.max(8, size * 0.18)}
              fill="rgba(34, 197, 94, 0.22)"
            />
          ) : null}
          {lod === 'full' ? (
            <text
              className="logic-node-sub-label"
              x={0}
              y={size * 0.36}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={appearance === 'light' ? pal.metadata : '#9fb6cf'}
              fontSize={Math.max(12, 12 * camera.zoom)}
              fontWeight="600"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {nodeOutputValue}
            </text>
          ) : null}
        </g>
      ) : null}

      {/* Switch toggle control - DISABLED: now rendered in LogicCanvas overlay layer to avoid SVG clipping */}
      {/* Toggle is rendered in LogicCanvas.tsx <g id="rb-switch-overlay"> above all nodes */}

      {/* Node label */}
      {lod !== 'minimal' &&
      node.type !== 'INPUT' &&
      node.type !== 'Switch' &&
      node.type !== 'Clock' &&
      node.type !== 'OUTPUT' &&
      node.type !== 'Lamp' && (
        <text
          className="logic-node-label"
          data-node-label="1"
          x={0}
          y={-size / 2 + nodeHeaderHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={appearance === 'light' ? pal.label : '#fff'}
          fontSize={nodeLabelFont}
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {ioDisplayLabel}
        </text>
      )}
      {shouldShowPinAlias ? (
        <text
          className="logic-node-sub-label"
          x={0}
          y={size * 0.38}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={pal.metadata}
          fontSize={pinAliasFont}
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
        const isTraceHighlight = isTraceHighlighted('in');
        const issueSeverity = getIssuePortSeverity('in');
        const issueColor = getIssueColor(issueSeverity);
        const portWireState = wirePortState(wireStartPort, node.id, 'in', validWireTargets);

        return (
          <g>
            {isHovered && !wireStartPort ? (
              <circle
                cx={-size / 2}
                cy={0}
                r={13}
                fill="#0ea5e9"
                opacity={0.28}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
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
            {isTraceHighlight && (
              <circle
                cx={-size / 2}
                cy={0}
                r={10}
                fill="none"
                stroke="#67e8f9"
                strokeWidth={2}
                opacity={0.78}
                style={{ pointerEvents: 'none' }}
                data-testid={`logic-node-trace-port-${node.id}-in`}
              />
            )}
            {issueSeverity && (
              <circle
                cx={-size / 2}
                cy={0}
                r={8}
                fill="none"
                stroke={issueColor}
                strokeWidth={2}
                opacity={0.88}
                style={{ pointerEvents: 'none' }}
                data-testid={`logic-node-issue-port-${node.id}-in`}
              />
            )}
            {renderMismatchRing(-size / 2, 0, 'in')}
            <circle
              cx={-size / 2}
              cy={0}
                r={inlinePortRadius}
              fill={isWireStart ? "#00ffff" : isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#3b82f6"}
              stroke={isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#fff"}
              strokeWidth={probedPorts?.has(`${node.id}.in`) ? 2.5 : isHovered ? 2.5 : 1.5}
              data-port-id="in"
              data-wire-port-state={portWireState}
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
              onMouseEnter={() => {
                setHoveredPort('in');
                if (wireStartPort) {
                  onPortHover?.('in');
                }
              }}
              onMouseLeave={() => {
                setHoveredPort(null);
                if (wireStartPort) {
                  onPortLeave?.();
                }
              }}
            />
            {/* Cyan glow for probed port */}
            {probedPorts?.has(`${node.id}.in`) && (
              <>
                <circle
                  cx={-size / 2}
                  cy={0}
                  r={inlinePortGlowRadius}
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
        const isTraceHighlight = isTraceHighlighted('out');
        const issueSeverity = getIssuePortSeverity('out');
        const issueColor = getIssueColor(issueSeverity);
        const portWireState = wirePortState(wireStartPort, node.id, 'out', validWireTargets);

        return (
          <g>
            {isHovered && !wireStartPort ? (
              <circle
                cx={size / 2}
                cy={0}
                r={13}
                fill="#0ea5e9"
                opacity={0.28}
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
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
            {isTraceHighlight && (
              <circle
                cx={size / 2}
                cy={0}
                r={10}
                fill="none"
                stroke="#67e8f9"
                strokeWidth={2}
                opacity={0.78}
                style={{ pointerEvents: 'none' }}
                data-testid={`logic-node-trace-port-${node.id}-out`}
              />
            )}
            {issueSeverity && (
              <circle
                cx={size / 2}
                cy={0}
                r={8}
                fill="none"
                stroke={issueColor}
                strokeWidth={2}
                opacity={0.88}
                style={{ pointerEvents: 'none' }}
                data-testid={`logic-node-issue-port-${node.id}-out`}
              />
            )}
            {renderMismatchRing(size / 2, 0, 'out')}
            <circle
              cx={size / 2}
              cy={0}
                r={inlinePortRadius}
              fill={isWireStart ? "#00ffff" : isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.out`) ? "#00ffff" : isActive ? '#22c55e' : '#9ca3af'}
              stroke={isValidTarget ? "#22c55e" : probedPorts?.has(`${node.id}.out`) ? "#00ffff" : "#fff"}
              strokeWidth={probedPorts?.has(`${node.id}.out`) ? 2.5 : isHovered ? 2.5 : 1.5}
              data-port-id="out"
              data-wire-port-state={portWireState}
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
              onMouseEnter={() => {
                setHoveredPort('out');
                if (wireStartPort) {
                  onPortHover?.('out');
                }
              }}
              onMouseLeave={() => {
                setHoveredPort(null);
                if (wireStartPort) {
                  onPortLeave?.();
                }
              }}
            />
            {/* Cyan glow for probed port */}
            {probedPorts?.has(`${node.id}.out`) && (
              <>
                <circle
                  cx={size / 2}
                  cy={0}
                  r={inlinePortGlowRadius}
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
    prevProps.node.label === nextProps.node.label &&
    prevProps.node.position?.x === nextProps.node.position?.x &&
    prevProps.node.position?.y === nextProps.node.position?.y &&
    prevProps.node.rotation === nextProps.node.rotation &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.camera.x === nextProps.camera.x &&
    prevProps.camera.y === nextProps.camera.y &&
    prevProps.camera.zoom === nextProps.camera.zoom &&
    prevProps.presentationZoomMode === nextProps.presentationZoomMode &&
    prevProps.dragPosition?.x === nextProps.dragPosition?.x &&
    prevProps.dragPosition?.y === nextProps.dragPosition?.y &&
    prevProps.diagnosticBadge?.error === nextProps.diagnosticBadge?.error &&
    prevProps.diagnosticBadge?.warn === nextProps.diagnosticBadge?.warn &&
    prevProps.diagnosticBadge?.total === nextProps.diagnosticBadge?.total &&
    prevProps.ioPresentation?.kind === nextProps.ioPresentation?.kind &&
    prevProps.ioPresentation?.label === nextProps.ioPresentation?.label &&
    prevProps.ioPresentation?.pinAlias === nextProps.ioPresentation?.pinAlias &&
    prevProps.issueGlow === nextProps.issueGlow &&
    prevProps.issuePortSeverities === nextProps.issuePortSeverities &&
    prevProps.onPortClusterClick === nextProps.onPortClusterClick &&
    prevProps.isMismatchHighlighted === nextProps.isMismatchHighlighted &&
    prevProps.mismatchPortKeys === nextProps.mismatchPortKeys &&
    prevProps.highlightedPort?.nodeId === nextProps.highlightedPort?.nodeId &&
    prevProps.highlightedPort?.portName === nextProps.highlightedPort?.portName &&
    prevProps.highlightedPortKeys === nextProps.highlightedPortKeys &&
    prevProps.probedPorts === nextProps.probedPorts &&
    prevProps.debugTick === nextProps.debugTick &&
    shallowObjectEqual(prevProps.node.state as Record<string, unknown>, nextProps.node.state as Record<string, unknown>) &&
    chipMetadataEqual(prevProps.chipMetadata, nextProps.chipMetadata) &&
    prevProps.wireStartPort?.nodeId === nextProps.wireStartPort?.nodeId &&
    prevProps.wireStartPort?.portName === nextProps.wireStartPort?.portName &&
    prevProps.validWireTargets === nextProps.validWireTargets &&
    prevProps.hoveredWireTargetState === nextProps.hoveredWireTargetState &&
    // Check if relevant signals changed
    (() => {
      const getPorts = (nodeType: string, metadata?: ChipMetadata) => {
        if (metadata) {
          return Array.from(
            new Set([
              ...metadata.inputs.map((input) => input.id),
              ...metadata.outputs.map((output) => output.id),
            ])
          );
        }
        if (nodeType === 'PowerSource' || nodeType === 'Switch' || nodeType === 'INPUT' || nodeType === 'Clock') return ['out'];
        if (nodeType === 'Lamp' || nodeType === 'OUTPUT') return ['in'];
        if (nodeType === 'AND' || nodeType === 'NAND') return ['a', 'b', 'out'];
        if (nodeType === 'OR' || nodeType === 'NOR' || nodeType === 'XOR' || nodeType === 'XNOR') return ['a', 'b', 'out'];
        if (nodeType === 'AND3' || nodeType === 'NAND3' || nodeType === 'OR3' || nodeType === 'NOR3' || nodeType === 'XOR3') return ['a', 'b', 'c', 'out'];
        if (nodeType === 'NOT') return ['in', 'out'];
        if (nodeType === 'DFlipFlop') return ['D', 'CLK', 'Q', 'out'];
        if (nodeType === 'JKFlipFlop') return ['J', 'K', 'CLK', 'Q', 'out'];
        if (nodeType === 'RSLatch') return ['R', 'S', 'Q', 'Q_inv'];
        if (nodeType === 'FullAdder') return ['A', 'B', 'Cin', 'Sum', 'Cout'];
        if (nodeType === 'Counter4Bit') return ['CLK', 'Q0', 'Q1', 'Q2', 'Q3'];
        if (nodeType === 'VoltageSource') return ['out'];
        if (nodeType === 'LDR') return ['resistance', 'v_out'];
        if (nodeType === 'FixedResistor') return ['resistance'];
        if (nodeType === 'VoltageDivider') return ['v_in', 'r1', 'r2', 'v_out'];
        if (nodeType === 'LM358') return ['V_plus', 'V_minus', 'out'];
        return ['in', 'out'];
      };

      const ports = Array.from(
        new Set([
          ...getPorts(prevProps.node.type, prevProps.chipMetadata),
          ...getPorts(nextProps.node.type, nextProps.chipMetadata),
        ])
      );
      for (const port of ports) {
        const prevSignal = prevProps.signals?.get(`${prevProps.node.id}.${port}`);
        const nextSignal = nextProps.signals?.get(`${nextProps.node.id}.${port}`);
        if (prevSignal !== nextSignal) return false;
      }
      return true;
    })() &&
    prevProps.evalSequence === nextProps.evalSequence
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
  fallbackColor: string,
  appearance: 'light' | 'dark' = 'dark'
): string {
  if (appearance === 'light') {
    // Light technical: white when idle, a restrained state tint when active,
    // so the value reads at a glance without a dark card.
    const idle = '#ffffff';
    if (nodeType === 'INPUT' || nodeType === 'Switch') {
      if (ioKind === 'button') return isActive ? '#dbeafe' : idle;
      if (ioKind === 'clock') return isActive ? '#dbeafe' : idle;
      return isActive ? '#dcfce7' : idle;
    }
    if (nodeType === 'OUTPUT' || nodeType === 'Lamp') {
      return isActive ? '#dcfce7' : idle;
    }
    return isActive ? '#eef2ff' : idle;
  }
  const inactiveBase = '#162333';
  const activeBase = '#1f3146';
  if (nodeType === 'INPUT' || nodeType === 'Switch') {
    if (ioKind === 'button') return isActive ? '#1f3f56' : inactiveBase;
    if (ioKind === 'clock') return isActive ? '#1c4365' : inactiveBase;
    return isActive ? '#1f3e4f' : inactiveBase;
  }
  if (nodeType === 'OUTPUT' || nodeType === 'Lamp') {
    return isActive ? '#1c3f37' : inactiveBase;
  }
  return isActive ? activeBase : fallbackColor ? '#1b2b3f' : inactiveBase;
}

function shallowObjectEqual(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined
): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left ?? {});
  const rightKeys = Object.keys(right ?? {});
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if ((left?.[key] ?? undefined) !== (right?.[key] ?? undefined)) {
      return false;
    }
  }
  return true;
}

function chipMetadataEqual(left?: ChipMetadata, right?: ChipMetadata): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.name !== right.name) return false;
  if (left.color !== right.color) return false;
  if (left.layer !== right.layer) return false;
  if (left.inputs.length !== right.inputs.length || left.outputs.length !== right.outputs.length) {
    return false;
  }
  for (let index = 0; index < left.inputs.length; index += 1) {
    const l = left.inputs[index];
    const r = right.inputs[index];
    if (!l || !r) return false;
    if (l.id !== r.id || l.name !== r.name) return false;
  }
  for (let index = 0; index < left.outputs.length; index += 1) {
    const l = left.outputs[index];
    const r = right.outputs[index];
    if (!l || !r) return false;
    if (l.id !== r.id || l.name !== r.name) return false;
  }
  return true;
}
