import React from 'react';
import type { Camera } from '../useLogicViewStore';
import { polylinePath, type RoutedWire } from '../routing/orthogonalRouter';

/**
 * Schematic wire renderer — one orthogonal polyline per wire, drawn from the
 * router's world-space points. Keeps the data-wire-* contract used by the
 * canvas input controller, context menus, and trace-dim tests. No glow, no
 * particles: value is ink weight, state is one accent.
 */
export interface SchematicWireViewProps {
  wire: RoutedWire;
  camera: Camera;
  isSelected: boolean;
  isHovered?: boolean;
  isBeingRewired?: boolean;
  isNetHighlighted?: boolean;
  isTraced?: boolean;
  isMismatch?: boolean;
  isProbed?: boolean;
  unrelatedInTraceScope?: boolean;
  signal?: 0 | 1 | 'X' | 'Z';
  onSelect: (wireId: string, addToSelection: boolean) => void;
  onHover?: (wireId: string | null) => void;
  onContextMenu?: (wireId: string, event: React.MouseEvent<SVGGElement>) => void;
}

const SchematicWireViewComponent: React.FC<SchematicWireViewProps> = ({
  wire,
  camera,
  isSelected,
  isHovered = false,
  isBeingRewired = false,
  isNetHighlighted = false,
  isTraced = false,
  isMismatch = false,
  isProbed = false,
  unrelatedInTraceScope = false,
  signal,
  onSelect,
  onHover,
  onContextMenu,
}) => {
  const d = React.useMemo(
    () => polylinePath(wire.points, (p) => ({ x: p.x * camera.zoom + camera.x, y: p.y * camera.zoom + camera.y })),
    [camera.x, camera.y, camera.zoom, wire.points]
  );
  const tone = isMismatch ? 'mismatch' : isSelected ? 'selected' : isTraced || isProbed ? 'traced' : isNetHighlighted ? 'net' : isHovered ? 'hover' : 'idle';
  return (
    <g
      className={`rb-net${wire.degenerate ? ' is-degenerate' : ''}`}
      data-wire-id={wire.wireId}
      data-net-id={wire.netId}
      data-wire-hovered={isHovered ? '1' : '0'}
      data-wire-selected={isSelected ? '1' : '0'}
      data-wire-being-rewired={isBeingRewired ? '1' : '0'}
      data-wire-trace-dim={unrelatedInTraceScope ? '1' : '0'}
      data-tone={tone}
      data-signal={signal === undefined ? undefined : String(signal)}
      data-testid={`wire-${wire.wireId}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(wire.wireId, event.shiftKey);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(wire.wireId, event);
      }}
      onMouseEnter={() => onHover?.(wire.wireId)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: 'pointer', opacity: isBeingRewired ? 0.35 : unrelatedInTraceScope ? 0.4 : undefined }}
    >
      <path className="rb-net-hit" d={d} fill="none" stroke="transparent" strokeWidth={12} />
      <path className="rb-net-line" d={d} fill="none" />
      {isBeingRewired ? <path className="rb-net-rewire" d={d} fill="none" strokeDasharray="6 5" /> : null}
    </g>
  );
};

export const SchematicWireView = React.memo(SchematicWireViewComponent);
