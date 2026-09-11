import React from 'react';
import type { Node } from '@redbyte/rb-logic-core';
import type { Camera } from '../useLogicViewStore';
import type { SymbolGeometry } from '../symbols/portGeometry';
import type { SchematicLod } from './SchematicNodeView';

/**
 * Bus brackets — the honest bus visualization for a bit-level circuit model.
 *
 * The circuit stores one boundary node per bit (`A[0]`…`A[3]`); there is no
 * physical trunk wire to draw. What a reader needs is the grouping and the
 * width, so each bus gets a bracket along the outer edge of its bit symbols
 * with a tick per bit and a `NAME[hi:lo]` label. Inputs bracket on the left,
 * outputs on the right. Nothing here invents connectivity.
 */
export interface SchematicBusGroup {
  readonly name: string;
  readonly direction: 'in' | 'out';
  readonly bits: readonly { readonly nodeId: string; readonly bit: number }[];
}

export interface BusBracketLayout {
  readonly name: string;
  readonly direction: 'in' | 'out';
  readonly label: string;
  readonly width: number;
  /** World-space bracket x, and top/bottom y of the outermost bit centres. */
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
  readonly ticks: readonly { readonly y: number; readonly bit: number }[];
  /** 0 for the innermost bracket on its side; buses that share a side step outward. */
  readonly lane: number;
}

const GAP = 10;
const LANE = 18;

/** Pure layout: world-space bracket geometry for every group with ≥2 placed bits. */
export function layoutBusBrackets(
  groups: readonly SchematicBusGroup[],
  nodes: ReadonlyMap<string, Node>,
  geometry: ReadonlyMap<string, { readonly geometry: SymbolGeometry }>
): BusBracketLayout[] {
  const layouts: BusBracketLayout[] = [];
  const lanes: Record<'in' | 'out', number> = { in: 0, out: 0 };
  for (const group of groups) {
    const placed = group.bits
      .map((bit) => {
        const node = nodes.get(bit.nodeId);
        const entry = geometry.get(bit.nodeId);
        if (!node || !entry) return null;
        const pos = node.position ?? { x: node.x ?? 0, y: node.y ?? 0 };
        const bounds = entry.geometry.bounds;
        const edge = group.direction === 'in' ? pos.x + bounds.minX : pos.x + bounds.maxX;
        const centreY = pos.y + (bounds.minY + bounds.maxY) / 2;
        return { bit: bit.bit, edge, y: centreY };
      })
      .filter((entry): entry is { bit: number; edge: number; y: number } => entry !== null)
      .sort((left, right) => left.y - right.y);
    if (placed.length < 2) continue;
    const bits = placed.map((entry) => entry.bit);
    const hi = Math.max(...bits);
    const lo = Math.min(...bits);
    const lane = lanes[group.direction];
    lanes[group.direction] += 1;
    const x =
      group.direction === 'in'
        ? Math.min(...placed.map((entry) => entry.edge)) - GAP - lane * LANE
        : Math.max(...placed.map((entry) => entry.edge)) + GAP + lane * LANE;
    layouts.push({
      name: group.name,
      direction: group.direction,
      label: `${group.name}[${hi}:${lo}]`,
      width: placed.length,
      x,
      top: placed[0].y,
      bottom: placed[placed.length - 1].y,
      ticks: placed.map((entry) => ({ y: entry.y, bit: entry.bit })),
      lane,
    });
  }
  return layouts;
}

export interface SchematicBusBracketsProps {
  readonly groups: readonly SchematicBusGroup[];
  readonly nodes: ReadonlyMap<string, Node>;
  readonly geometry: ReadonlyMap<string, { readonly geometry: SymbolGeometry }>;
  readonly camera: Camera;
  readonly lod: SchematicLod;
}

const FONT_MONO = 'var(--rb-font-mono, Consolas, monospace)';

const SchematicBusBracketsComponent: React.FC<SchematicBusBracketsProps> = ({ groups, nodes, geometry, camera, lod }) => {
  const layouts = React.useMemo(() => layoutBusBrackets(groups, nodes, geometry), [geometry, groups, nodes]);
  if (layouts.length === 0) return null;
  const toScreenX = (x: number) => x * camera.zoom + camera.x;
  const toScreenY = (y: number) => y * camera.zoom + camera.y;
  const tickLen = lod === 'overview' ? 4 : 6;
  return (
    <g className="rb-bus-layer" data-testid="schematic-bus-layer" pointerEvents="none">
      {layouts.map((layout) => {
        const x = toScreenX(layout.x);
        const top = toScreenY(layout.top);
        const bottom = toScreenY(layout.bottom);
        const dir = layout.direction === 'in' ? -1 : 1;
        return (
          <g key={`${layout.direction}:${layout.name}`} className="rb-bus-bracket" data-bus={layout.name} data-direction={layout.direction} data-testid={`schematic-bus-${layout.name}`}>
            <path className="rb-bus-bracket-line" d={`M ${x} ${top - 8} V ${bottom + 8}`} />
            {layout.ticks.map((tick) => {
              const y = toScreenY(tick.y);
              return <path key={tick.bit} className="rb-bus-bracket-tick" d={`M ${x} ${y} h ${-dir * tickLen}`} />;
            })}
            <text
              className="rb-bus-bracket-label"
              x={x + dir * 4}
              y={top - 12 - layout.lane * 13}
              textAnchor={layout.direction === 'in' ? 'end' : 'start'}
              fontFamily={FONT_MONO}
              fontSize={lod === 'overview' ? 11 : 10}
              fontWeight={600}
            >
              {layout.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export const SchematicBusBrackets = React.memo(SchematicBusBracketsComponent);
