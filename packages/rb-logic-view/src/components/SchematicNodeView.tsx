import React from 'react';
import type { Node, PortRef } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';
import { wirePortState } from '../tools/wireGuidance';
import { outlineFor } from '../symbols/ansiSymbols';
import { GRID, STUB, type SymbolGeometry, type SymbolPin } from '../symbols/portGeometry';
import type { LogicDisplayValue, NodeIoPresentation } from './NodeView';

/**
 * Schematic node renderer — ANSI symbols, explicit pins, mono labels, one
 * blue selection accent. Replaces the chip/card rendering for the Design
 * schematic instrument while keeping the DOM contract the canvas input
 * controller and tests rely on:
 *   root  <g data-node-id data-node-type data-sim-value data-lod data-node-selected data-testid="node-{type}-{id}">
 *   pins  <rect data-port-id data-wire-port-state> hit targets
 *   input symbols carry data-testid="switch-toggle-{id}" on their body.
 * Everything is drawn in world units inside a translate+scale group so one
 * path serves every zoom; strokes stay 1.5px via vector-effect.
 */

export type SchematicLod = 'overview' | 'read' | 'edit' | 'detail';

/**
 * Presentation layers a document can switch on and off. They never change
 * what the circuit is — only which facts are drawn beside it.
 */
export interface SchematicLayers {
  /** Signal / net names beside symbols. */
  readonly netLabels: boolean;
  /** Live and replay values at pins and I/O tips. */
  readonly values: boolean;
  /** Board resource / package pin under boundary I/O. */
  readonly boardBindings: boolean;
  /** Diagnostic badges on symbols. */
  readonly diagnostics: boolean;
  /** Dashed frames around module instances. */
  readonly hierarchy: boolean;
  /** Bus brackets and width labels at the boundary. */
  readonly buses: boolean;
}

export const DEFAULT_SCHEMATIC_LAYERS: SchematicLayers = Object.freeze({
  netLabels: true,
  values: true,
  boardBindings: true,
  diagnostics: true,
  hierarchy: true,
  buses: true,
});

export function schematicLodForZoom(zoom: number): SchematicLod {
  if (zoom < 0.45) return 'overview';
  if (zoom < 0.85) return 'read';
  if (zoom < 1.6) return 'edit';
  return 'detail';
}

export interface SchematicNodeViewProps {
  node: Node;
  geometry: SymbolGeometry;
  camera: Camera;
  lod: SchematicLod;
  isSelected: boolean;
  isTraced?: boolean;
  isChanged?: boolean;
  isMismatchHighlighted?: boolean;
  mismatchPortKeys?: Set<string> | null;
  signals?: Map<string, LogicDisplayValue>;
  wireStartPort?: PortRef;
  validWireTargets?: Set<string> | null;
  hoveredWireTargetState?: 'valid' | 'invalid' | null;
  probedPorts?: Set<string>;
  highlightedPortKeys?: Set<string> | null;
  highlightedPort?: { nodeId: string; portName: string } | null;
  dragPosition?: { x: number; y: number } | null;
  diagnosticBadge?: { error: number; warn: number; total: number };
  onDiagnosticBadgeClick?: (nodeId: string) => void;
  issueGlow?: 'error' | 'warn' | null;
  issuePortSeverities?: Map<string, 'error' | 'warn'> | null;
  ioPresentation?: NodeIoPresentation;
  onPortClick?: (nodeId: string, portName: string) => void;
  onPortHover?: (portName: string) => void;
  onPortLeave?: () => void;
  onToggleSwitch?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeContextMenu?: (nodeId: string, clientX: number, clientY: number) => void;
  onProbeToggle?: (nodeId: string, portName: string, label: string) => void;
  /** Show the value beside every pin (detail LOD) or only for interesting pins. */
  showAllValues?: boolean;
  layers?: SchematicLayers;
}

const FONT_MONO = 'var(--rb-font-mono, Consolas, monospace)';

function valueText(value: LogicDisplayValue | undefined): string {
  if (value === undefined) return '';
  return String(value);
}

const SchematicNodeViewComponent: React.FC<SchematicNodeViewProps> = ({
  node,
  geometry,
  camera,
  lod,
  isSelected,
  isTraced = false,
  isChanged = false,
  isMismatchHighlighted = false,
  mismatchPortKeys = null,
  signals,
  wireStartPort,
  validWireTargets,
  hoveredWireTargetState,
  probedPorts,
  highlightedPortKeys,
  highlightedPort,
  dragPosition,
  diagnosticBadge,
  onDiagnosticBadgeClick,
  issueGlow,
  issuePortSeverities,
  ioPresentation,
  onPortClick,
  onPortHover,
  onPortLeave,
  onToggleSwitch,
  onNodeDoubleClick,
  onNodeContextMenu,
  onProbeToggle,
  showAllValues = false,
  layers = DEFAULT_SCHEMATIC_LAYERS,
}) => {
  const [hovered, setHovered] = React.useState(false);
  const pos = dragPosition ?? node.position ?? { x: node.x ?? 0, y: node.y ?? 0 };
  const screenX = pos.x * camera.zoom + camera.x;
  const screenY = pos.y * camera.zoom + camera.y;
  const zoom = camera.zoom;
  const outline = outlineFor(geometry);
  const isInputSymbol = geometry.kind === 'io-in' || geometry.kind === 'clock';
  const isOutputSymbol = geometry.kind === 'io-out';
  const isBlock = geometry.kind === 'module' || geometry.kind === 'block' || geometry.kind === 'register';
  const outputPin = geometry.pins.find((pin) => pin.direction === 'out');
  const inputPin = geometry.pins.find((pin) => pin.direction === 'in');
  const outputValue = outputPin ? signals?.get(`${node.id}.${outputPin.id}`) : undefined;
  const inputValue = inputPin ? signals?.get(`${node.id}.${inputPin.id}`) : undefined;
  const simValue = isOutputSymbol ? inputValue : outputValue;
  const simText = valueText(simValue);
  const showPinNames = isBlock && lod !== 'overview';
  const isModuleInstance = geometry.kind === 'module';
  const showGateType = !isBlock && !isInputSymbol && !isOutputSymbol && lod === 'detail';
  const title = geometry.title;
  const typeLabel = geometry.typeLabel;
  const { minX, minY, maxX, maxY } = geometry.body;
  const bodyW = maxX - minX;
  const bodyH = maxY - minY;
  const tone = issueGlow === 'error' ? 'error' : issueGlow === 'warn' ? 'warn' : isMismatchHighlighted ? 'mismatch' : isSelected ? 'selected' : isTraced ? 'traced' : isChanged ? 'changed' : hovered ? 'hover' : 'idle';
  const pinLabel = (pin: SymbolPin) => (pin.width > 1 ? `${pin.name}` : pin.name);
  const ioLabel = (ioPresentation?.label?.trim() || title || node.id);
  const pinAlias = ioPresentation?.pinAlias?.trim() ?? '';

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isInputSymbol) return;
    onNodeDoubleClick?.(node.id);
  };
  const handleContextMenu = (event: React.MouseEvent) => {
    if (!onNodeContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    onNodeContextMenu(node.id, event.clientX, event.clientY);
  };

  return (
    <g
      className={`rb-sym rb-sym--${geometry.kind}`}
      data-node-id={node.id}
      data-node-type={node.type}
      data-sim-value={simValue ?? ''}
      data-lod={lod}
      data-node-selected={isSelected ? '1' : '0'}
      data-tone={tone}
      data-testid={`node-${node.type}-${node.id}`}
      transform={`translate(${screenX}, ${screenY}) scale(${zoom})`}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: dragPosition ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      {title || typeLabel ? <title>{title ? `${title} · ${typeLabel}` : typeLabel}</title> : null}

      {/* Selection / trace / issue outline: one 2px accent, offset from the body. */}
      {tone !== 'idle' && tone !== 'hover' ? (
        <rect
          className="rb-sym-ring"
          x={geometry.bounds.minX - 4}
          y={geometry.bounds.minY - 4}
          width={geometry.bounds.maxX - geometry.bounds.minX + 8}
          height={geometry.bounds.maxY - geometry.bounds.minY + 8}
          rx={2}
          pointerEvents="none"
        />
      ) : null}

      {/* Hierarchy boundary: a dashed frame says "another module lives here". */}
      {layers.hierarchy && isModuleInstance ? (
        <rect
          className="rb-sym-hier"
          x={minX - 3}
          y={minY - 3}
          width={bodyW + 6}
          height={bodyH + 6}
          rx={1}
          pointerEvents="none"
          data-testid={`sym-hier-${node.id}`}
        />
      ) : null}

      {/* Pin stubs (drawn before the body so the body covers their inner end). */}
      {geometry.pins.map((pin) => (
        <line
          key={`stub-${pin.id}`}
          className={`rb-sym-stub${pin.width > 1 ? ' is-bus' : ''}`}
          x1={pin.x}
          y1={pin.y}
          x2={pin.bodyX}
          y2={pin.bodyY}
          pointerEvents="none"
        />
      ))}

      {/* Body outline. */}
      <path
        className="rb-sym-body"
        d={outline.d}
        data-testid={isInputSymbol ? `switch-toggle-${node.id}` : undefined}
        onClick={(event) => {
          if (!isInputSymbol || !onToggleSwitch) return;
          if (wireStartPort) return;
          event.stopPropagation();
          onToggleSwitch(node.id);
        }}
        style={isInputSymbol && onToggleSwitch ? { cursor: 'pointer' } : undefined}
      />
      {outline.extra ? <path className="rb-sym-body-extra" d={outline.extra} pointerEvents="none" /> : null}
      {outline.bubble ? <circle className="rb-sym-bubble" cx={outline.bubble.cx} cy={outline.bubble.cy} r={outline.bubble.r} pointerEvents="none" /> : null}
      {outline.wedge ? <path className="rb-sym-wedge" d={outline.wedge} pointerEvents="none" /> : null}

      {/* Block header: instance name + type. Gates: type label only at detail. */}
      {isBlock ? (
        <>
          {title ? (
            <text className="rb-sym-title" x={0} y={minY + 13} textAnchor="middle" fontFamily={FONT_MONO} fontSize={11} fontWeight={600} pointerEvents="none">
              {title}
            </text>
          ) : null}
          <text
            className="rb-sym-type"
            x={0}
            y={title ? minY + 25 : minY + 12}
            textAnchor="middle"
            fontFamily={FONT_MONO}
            fontSize={9.5}
            pointerEvents="none"
          >
            {typeLabel}
          </text>
        </>
      ) : isInputSymbol || isOutputSymbol ? (
        <>
          <text
            className="rb-sym-title"
            x={isInputSymbol ? minX + 8 : minX + bodyH / 2 + 4}
            y={4}
            textAnchor="start"
            fontFamily={FONT_MONO}
            fontSize={11}
            fontWeight={600}
            pointerEvents="none"
          >
            {ioLabel}
          </text>
          {/* Value cell at the tip. */}
          {layers.values ? (
          <text
            className={`rb-sym-value${simText === '1' ? ' is-high' : simText === 'X' || simText === 'Z' ? ' is-unknown' : ''}`}
            x={isInputSymbol ? maxX - bodyH / 2 - 2 : maxX - 6}
            y={4}
            textAnchor="end"
            fontFamily={FONT_MONO}
            fontSize={11}
            fontWeight={700}
            pointerEvents="none"
            data-testid={`sym-value-${node.id}`}
          >
            {simText}
          </text>
          ) : null}
          {pinAlias && layers.boardBindings && lod !== 'overview' ? (
            <text className="rb-sym-alias" x={0} y={maxY + 11} textAnchor="middle" fontFamily={FONT_MONO} fontSize={9} pointerEvents="none">
              {pinAlias}
            </text>
          ) : null}
        </>
      ) : (
        <>
          {title && layers.netLabels && lod !== 'overview' ? (
            <text className="rb-sym-title" x={0} y={minY - 5} textAnchor="middle" fontFamily={FONT_MONO} fontSize={10} fontWeight={600} pointerEvents="none">
              {title}
            </text>
          ) : null}
          {showGateType ? (
            <text className="rb-sym-type" x={(minX + maxX) / 2 - 2} y={maxY + 11} textAnchor="middle" fontFamily={FONT_MONO} fontSize={9} pointerEvents="none">
              {typeLabel}
            </text>
          ) : null}
        </>
      )}

      {/* Pins: name inside the block, hit target on the stub, value beside the pin. */}
      {geometry.pins.map((pin) => {
        const key = `${node.id}.${pin.id}`;
        const colonKey = `${node.id}:${pin.id}`;
        const state = wirePortState(wireStartPort, node.id, pin.id, validWireTargets);
        const isProbed = probedPorts?.has(key) ?? false;
        const isHighlighted = (highlightedPort?.nodeId === node.id && highlightedPort.portName === pin.id) || (highlightedPortKeys?.has(colonKey) ?? false);
        const isMismatch = mismatchPortKeys?.has(colonKey) ?? false;
        const issue = issuePortSeverities?.get(colonKey) ?? null;
        const value = signals?.get(key);
        const showValue =
          layers.values &&
          (lod === 'detail' || lod === 'edit') &&
          (showAllValues || isProbed || isHighlighted || isMismatch || isSelected || hovered);
        const hitX = pin.side === 'left' ? pin.x - 6 : Math.min(pin.x, pin.bodyX) - 2;
        const hitW = STUB + 8;
        return (
          <g key={pin.id} className="rb-sym-pin" data-pin-side={pin.side}>
            {showPinNames ? (
              <text
                className="rb-sym-pin-name"
                x={pin.side === 'left' ? pin.bodyX + 5 : pin.bodyX - 5}
                y={pin.y + 3.5}
                textAnchor={pin.side === 'left' ? 'start' : 'end'}
                fontFamily={FONT_MONO}
                fontSize={9.5}
                pointerEvents="none"
              >
                {pinLabel(pin)}
              </text>
            ) : null}
            {pin.width > 1 ? (
              <path className="rb-sym-bus-slash" d={`M ${(pin.x + pin.bodyX) / 2 - 3} ${pin.y + 4} L ${(pin.x + pin.bodyX) / 2 + 3} ${pin.y - 4}`} pointerEvents="none" />
            ) : null}
            {/* Pin end marker: filled when connected state is interesting, hollow otherwise (drawn by CSS). */}
            <circle
              className="rb-sym-pin-dot"
              data-state={state}
              data-probed={isProbed ? '1' : '0'}
              data-highlighted={isHighlighted ? '1' : '0'}
              data-mismatch={isMismatch ? '1' : '0'}
              data-issue={issue ?? undefined}
              cx={pin.x}
              cy={pin.y}
              r={2.4}
              pointerEvents="none"
            />
            <rect
              className="rb-sym-pin-hit"
              data-port-id={pin.id}
              data-port-name={pin.id}
              data-wire-port-state={state}
              data-testid={`port-${node.id}-${pin.id}`}
              x={hitX}
              y={pin.y - 8}
              width={hitW}
              height={16}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (event.altKey && onProbeToggle) {
                  onProbeToggle(node.id, pin.id, `${title || node.id}.${pin.id}`);
                  return;
                }
                onPortClick?.(node.id, pin.id);
              }}
              onMouseEnter={() => onPortHover?.(pin.id)}
              onMouseLeave={() => onPortLeave?.()}
            />
            {showValue && value !== undefined ? (
              <text
                className={`rb-sym-pin-value${value === 1 ? ' is-high' : value === 'X' || value === 'Z' ? ' is-unknown' : ''}`}
                x={pin.side === 'left' ? pin.x - 4 : pin.x + 4}
                y={pin.y - 4}
                textAnchor={pin.side === 'left' ? 'end' : 'start'}
                fontFamily={FONT_MONO}
                fontSize={9}
                pointerEvents="none"
              >
                {valueText(value)}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Diagnostics: a small glyph at the top-right corner, click opens the problem. */}
      {layers.diagnostics && (diagnosticBadge?.total ?? 0) > 0 ? (
        <g
          className="rb-sym-diag"
          data-severity={(diagnosticBadge?.error ?? 0) > 0 ? 'error' : 'warn'}
          data-testid={`logic-node-diagnostic-badge-${node.id}`}
          transform={`translate(${maxX - 6}, ${minY - 6})`}
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
          <circle r={6} />
          <text x={0} y={3} textAnchor="middle" fontFamily={FONT_MONO} fontSize={8} fontWeight={700} pointerEvents="none">
            {(diagnosticBadge?.error ?? 0) > 0 ? 'E' : 'W'}
          </text>
        </g>
      ) : null}
      {/* Keep a body-relative grid anchor for tests that inspect bounds. */}
      <rect className="rb-sym-bounds" x={minX} y={minY} width={bodyW} height={bodyH} fill="none" stroke="none" pointerEvents="none" data-grid={GRID} />
    </g>
  );
};

export const SchematicNodeView = React.memo(SchematicNodeViewComponent);
