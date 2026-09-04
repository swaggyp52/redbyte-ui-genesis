import React, { useMemo } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';

/**
 * Architecture preview — a read-only, deterministic block view of the current
 * top circuit. Dependency-layered left→right (inputs, logic layers, outputs),
 * orthogonal nets, crisp block outlines, mono labels. It does not own layout
 * truth (the schematic document does); it renders enough topology to inspect
 * the architecture of a loaded project without opening Design.
 */

export interface ArchitecturePreviewProps {
  readonly circuit: Circuit;
  readonly ioLabelByNodeId: ReadonlyMap<string, string>;
  readonly moduleNameByNodeId: ReadonlyMap<string, string>;
  readonly selectedNodeId?: string | null;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onOpenDesign?: () => void;
}

interface Placed {
  id: string;
  label: string;
  sublabel: string;
  category: 'input' | 'output' | 'module' | 'sequential' | 'logic';
  x: number;
  y: number;
  w: number;
  h: number;
}

const COL_GAP = 72;
const ROW_GAP = 14;
const BLOCK_H = 26;
const CHAR_W = 6.6;

function endpointNode(endpoint: unknown): string {
  if (typeof endpoint === 'string') return endpoint.split(/[.:/]/)[0];
  if (endpoint && typeof endpoint === 'object' && 'nodeId' in endpoint) return String((endpoint as { nodeId: string }).nodeId);
  return '';
}

export const ArchitecturePreview: React.FC<ArchitecturePreviewProps> = ({
  circuit,
  ioLabelByNodeId,
  moduleNameByNodeId,
  selectedNodeId = null,
  onSelectNode,
  onOpenDesign,
}) => {
  const layout = useMemo(() => {
    const nodeIds = circuit.nodes.map((node) => node.id);
    const idSet = new Set(nodeIds);
    const edges = circuit.connections
      .map((connection) => ({ from: endpointNode(connection.from), to: endpointNode(connection.to) }))
      .filter((edge) => idSet.has(edge.from) && idSet.has(edge.to) && edge.from !== edge.to);
    const preds = new Map<string, string[]>();
    const succs = new Map<string, string[]>();
    for (const id of nodeIds) {
      preds.set(id, []);
      succs.set(id, []);
    }
    for (const edge of edges) {
      preds.get(edge.to)?.push(edge.from);
      succs.get(edge.from)?.push(edge.to);
    }
    // Longest-path layering with a bounded iteration count (feedback-safe).
    const layer = new Map<string, number>();
    for (const id of nodeIds) layer.set(id, 0);
    for (let iteration = 0; iteration < nodeIds.length + 1; iteration += 1) {
      let changed = false;
      for (const edge of edges) {
        const next = (layer.get(edge.from) ?? 0) + 1;
        if (next > (layer.get(edge.to) ?? 0) && next <= nodeIds.length) {
          layer.set(edge.to, next);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const categoryOf = (id: string, type: string): Placed['category'] => {
      if (moduleNameByNodeId.has(id)) return 'module';
      const t = type.toLowerCase();
      if (ioLabelByNodeId.has(id) && (preds.get(id)?.length ?? 0) === 0) return 'input';
      if (ioLabelByNodeId.has(id) && (succs.get(id)?.length ?? 0) === 0) return 'output';
      if (/^(input|switch|clock|button)$/.test(t)) return 'input';
      if (/^(output|lamp|led)$/.test(t)) return 'output';
      if (/flip|latch|counter|register|clock/.test(t)) return 'sequential';
      return 'logic';
    };
    const maxLayer = Math.max(0, ...Array.from(layer.values()));
    // Outputs sit in the last column regardless of depth so the boundary reads.
    const columns = new Map<number, string[]>();
    for (const node of circuit.nodes) {
      const category = categoryOf(node.id, String(node.type));
      const col = category === 'output' ? maxLayer + 1 : category === 'input' ? 0 : Math.max(1, layer.get(node.id) ?? 0);
      const list = columns.get(col) ?? [];
      list.push(node.id);
      columns.set(col, list);
    }
    const nodeById = new Map(circuit.nodes.map((node) => [node.id, node]));
    // Barycenter ordering within a column for fewer crossings.
    const order = new Map<string, number>();
    const sortedCols = Array.from(columns.keys()).sort((a, b) => a - b);
    for (const col of sortedCols) {
      const ids = columns.get(col) ?? [];
      const scored = ids.map((id) => {
        const upstream = preds.get(id) ?? [];
        const positions = upstream.map((p) => order.get(p)).filter((v): v is number => typeof v === 'number');
        return { id, score: positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : Number.POSITIVE_INFINITY };
      });
      scored.sort((a, b) => (a.score === b.score ? a.id.localeCompare(b.id) : a.score - b.score));
      scored.forEach((entry, index) => order.set(entry.id, index));
      columns.set(col, scored.map((entry) => entry.id));
    }
    const placed: Placed[] = [];
    let x = 8;
    let maxY = 0;
    for (const col of sortedCols) {
      const ids = columns.get(col) ?? [];
      let y = 8;
      let colWidth = 0;
      for (const id of ids) {
        const node = nodeById.get(id);
        if (!node) continue;
        const category = categoryOf(id, String(node.type));
        const label = ioLabelByNodeId.get(id) ?? moduleNameByNodeId.get(id) ?? String(node.type).replace(/Node$/i, '');
        const sublabel = category === 'module' ? String(node.label ?? node.id) : category === 'logic' || category === 'sequential' ? String(node.label ?? '') : '';
        const textLen = Math.max(label.length, sublabel.length);
        const w = Math.max(44, Math.round(textLen * CHAR_W) + 16);
        const h = sublabel && sublabel !== label ? BLOCK_H + 12 : BLOCK_H;
        placed.push({ id, label, sublabel: sublabel !== label ? sublabel : '', category, x, y, w, h });
        y += h + ROW_GAP;
        colWidth = Math.max(colWidth, w);
      }
      maxY = Math.max(maxY, y);
      x += colWidth + COL_GAP;
    }
    // Vertically center shorter columns.
    for (const col of sortedCols) {
      const ids = new Set(columns.get(col) ?? []);
      const items = placed.filter((p) => ids.has(p.id));
      const height = items.reduce((sum, p) => sum + p.h + ROW_GAP, 0);
      const offset = Math.max(0, (maxY - height) / 2);
      for (const item of items) item.y += offset;
    }
    const byId = new Map(placed.map((p) => [p.id, p]));
    // Each load pin gets its own landing row on the block; each net (driver)
    // gets its own vertical track in the column gap, so two nets never share
    // a segment and no vertical runs under a block body.
    const loadsByTarget = new Map<string, string[]>();
    for (const edge of edges) {
      const list = loadsByTarget.get(edge.to) ?? [];
      if (!list.includes(edge.from)) list.push(edge.from);
      loadsByTarget.set(edge.to, list);
    }
    const trackByNet = new Map<string, number>();
    const tracksPerGap = new Map<number, number>();
    for (const edge of edges) {
      if (trackByNet.has(edge.from)) continue;
      const from = byId.get(edge.from);
      if (!from) continue;
      const gapKey = Math.round(from.x + from.w);
      const track = tracksPerGap.get(gapKey) ?? 0;
      trackByNet.set(edge.from, track);
      tracksPerGap.set(gapKey, track + 1);
    }
    const TRACK_STEP = 7;
    const wires = edges.map((edge, index) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return null;
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const loads = loadsByTarget.get(edge.to) ?? [edge.from];
      const pinIndex = Math.max(0, loads.indexOf(edge.from));
      const y2 = to.y + (to.h * (pinIndex + 1)) / (loads.length + 1);
      const track = trackByNet.get(edge.from) ?? 0;
      const forward = x2 > x1 + 16;
      const midX = forward ? Math.min(x2 - 6, x1 + 10 + track * TRACK_STEP) : x1 + 10 + track * TRACK_STEP;
      const d = forward
        ? `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
        : `M ${x1} ${y1} H ${midX} V ${Math.min(from.y, to.y) - 12 - track * TRACK_STEP} H ${x2 - 10 - track * TRACK_STEP} V ${y2} H ${x2}`;
      return { key: `${edge.from}-${edge.to}-${index}`, d, from: edge.from, to: edge.to, midX, y1 };
    }).filter((wire): wire is NonNullable<typeof wire> => wire !== null);
    // Junctions: a driver with more than one load gets a dot where its net fans out.
    const fanout = new Map<string, number>();
    for (const wire of wires) fanout.set(wire.from, (fanout.get(wire.from) ?? 0) + 1);
    const junctions = placed
      .filter((p) => (fanout.get(p.id) ?? 0) > 1)
      .map((p) => {
        const first = wires.find((wire) => wire.from === p.id);
        return { id: p.id, x: first?.midX ?? p.x + p.w + 12, y: first?.y1 ?? p.y + p.h / 2 };
      });
    const width = Math.max(240, x - COL_GAP + 8);
    const height = Math.max(120, maxY);
    return { placed, wires, junctions, width, height };
  }, [circuit, ioLabelByNodeId, moduleNameByNodeId]);

  return (
    <figure className="rb-arch" data-testid="ide-project-circuit-preview">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Architecture of the current top module: ${circuit.nodes.length} components, ${circuit.connections.length} nets`}
        preserveAspectRatio="xMidYMid meet"
      >
        {layout.wires.map((wire) => (
          <path
            key={wire.key}
            className="rb-arch-wire"
            data-selected={selectedNodeId === wire.from || selectedNodeId === wire.to ? 'true' : undefined}
            d={wire.d}
          />
        ))}
        {layout.junctions.map((junction) => (
          <circle key={junction.id} className="rb-arch-junction" cx={junction.x} cy={junction.y} r="2.4" />
        ))}
        {layout.placed.map((block) => (
          <g
            key={block.id}
            className={`rb-arch-block is-${block.category}`}
            data-selected={selectedNodeId === block.id ? 'true' : undefined}
            data-testid={`ide-project-arch-${block.id}`}
            onClick={() => onSelectNode?.(block.id)}
            onDoubleClick={() => onOpenDesign?.()}
            role={onSelectNode ? 'button' : undefined}
            tabIndex={onSelectNode ? 0 : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectNode?.(block.id);
              }
            }}
          >
            {block.category === 'input' || block.category === 'output' ? (
              <path
                d={
                  block.category === 'input'
                    ? `M ${block.x} ${block.y} H ${block.x + block.w - 8} L ${block.x + block.w} ${block.y + block.h / 2} L ${block.x + block.w - 8} ${block.y + block.h} H ${block.x} Z`
                    : `M ${block.x + 8} ${block.y} H ${block.x + block.w} V ${block.y + block.h} H ${block.x + 8} L ${block.x} ${block.y + block.h / 2} Z`
                }
              />
            ) : (
              <rect x={block.x} y={block.y} width={block.w} height={block.h} rx={block.category === 'module' ? 1 : 2} />
            )}
            <text x={block.x + block.w / 2} y={block.y + (block.sublabel ? 15 : block.h / 2 + 4)} textAnchor="middle" className="rb-arch-label">
              {block.label}
            </text>
            {block.sublabel ? (
              <text x={block.x + block.w / 2} y={block.y + block.h - 6} textAnchor="middle" className="rb-arch-sublabel">
                {block.sublabel}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </figure>
  );
};
