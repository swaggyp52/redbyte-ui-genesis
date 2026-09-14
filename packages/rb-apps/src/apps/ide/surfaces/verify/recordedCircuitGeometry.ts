import type { Circuit } from '@redbyte/rb-logic-core';
import { buildGeometryIndex, connectionEndpoints, findPin, unionBounds } from '@redbyte/rb-logic-view';
import { getDesignChipMetadata } from '../../designChipMetadata';
import { getDesignChipMetadataForNode } from '../../registerFamilyChipMetadata';

/** The same primitive/register pin contract used by Design. Run snapshots are flattened,
 * so module instances already carry their concrete instance-owned primitive nodes. */
export function buildRecordedCircuitGeometry(nodes: Circuit['nodes']) {
  return buildGeometryIndex(nodes, (type, node) => node
    ? getDesignChipMetadataForNode(node) ?? getDesignChipMetadata(type)
    : getDesignChipMetadata(type));
}

/** An instance keeps its recorded layout. Actual neighbours sit outside it, so
 * repeated module-definition coordinates cannot conceal one node behind another. */
export function buildRecordedInstanceDrawing(circuit: Circuit, scope: string): Circuit {
  const owned = new Set(circuit.nodes.filter((node) => (node.config?.hierarchyPath ?? 'top') === scope).map((node) => node.id));
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  for (const wire of circuit.connections) {
    const { from, to } = connectionEndpoints(wire);
    if (!owned.has(from.nodeId) && owned.has(to.nodeId)) incoming.add(from.nodeId);
    if (owned.has(from.nodeId) && !owned.has(to.nodeId)) outgoing.add(to.nodeId);
  }
  const visible = new Set([...owned, ...incoming, ...outgoing]);
  const geometry = buildRecordedCircuitGeometry(circuit.nodes.filter((node) => visible.has(node.id)));
  const ownedBounds = unionBounds(Array.from(geometry.values()).filter((entry) => owned.has(entry.node.id)));
  const positions = new Map<string, { x: number; y: number }>();
  if (ownedBounds) {
    const targetY = (id: string) => {
      const neighbours = circuit.connections.map(connectionEndpoints).flatMap(({ from, to }) =>
        from.nodeId === id && owned.has(to.nodeId) ? [to.nodeId] : to.nodeId === id && owned.has(from.nodeId) ? [from.nodeId] : []);
      const ys = neighbours.map((id) => geometry.get(id)?.y ?? 0);
      return ys.reduce((sum, value) => sum + value, 0) / Math.max(1, ys.length);
    };
    for (const side of ['incoming', 'outgoing'] as const) {
      const ids = Array.from(side === 'incoming' ? incoming : outgoing).filter((id) => side === 'incoming' || !incoming.has(id));
      ids.sort((a, b) => targetY(a) - targetY(b) || a.localeCompare(b));
      const entries = ids.flatMap((id) => { const entry = geometry.get(id); return entry ? [entry] : []; });
      const totalHeight = entries.reduce((height, entry) => height + entry.geometry.bounds.maxY - entry.geometry.bounds.minY, 0) + Math.max(0, entries.length - 1) * 40;
      let top = (ownedBounds.minY + ownedBounds.maxY - totalHeight) / 2;
      for (const entry of entries) {
        const { bounds } = entry.geometry;
        positions.set(entry.node.id, {
          x: side === 'incoming' ? ownedBounds.minX - 120 - bounds.maxX : ownedBounds.maxX + 120 - bounds.minX,
          y: top - bounds.minY,
        });
        top += bounds.maxY - bounds.minY + 40;
      }
    }
  }
  return {
    nodes: circuit.nodes.filter((node) => visible.has(node.id)).map((node) => positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node),
    connections: circuit.connections.filter((wire) => { const { from, to } = connectionEndpoints(wire); return visible.has(from.nodeId) && visible.has(to.nodeId); }),
  };
}

/** One topology/port resolver for the time instrument, recorded wires and board readback.
 * Aliases are supplied by the existing presentation projection; an absent sample stays absent.
 * Ambiguous drivers never borrow a value from another net or module instance. */
export function createRecordedPortResolver(
  circuit: Circuit | null | undefined,
  samples: readonly { signals: Readonly<Record<string, unknown>> }[],
  alias: (endpoint: string) => string | undefined = endpoint => endpoint,
) {
  const geometry = buildRecordedCircuitGeometry(circuit?.nodes ?? []);
  const keys = new Set(samples.flatMap(sample => Object.keys(sample.signals)));
  const canonicalPort = (id: string, port: string) => {
    const entry = geometry.get(id)?.geometry;
    return entry ? findPin(entry, port)?.id ?? port : port;
  };
  const lookup = (id: string, port: string) => {
    for (const endpoint of [id + '.' + canonicalPort(id, port), id + '.' + port]) {
      const key = alias(endpoint);
      if (key && keys.has(key)) return key;
      if (keys.has(endpoint)) return endpoint;
    }
    return null;
  };
  return (nodeId: string, port: string): string | null => {
    const own = lookup(nodeId, port);
    if (own) return own;
    const incoming = circuit?.connections.map(connectionEndpoints).filter(connection =>
      connection.to.nodeId === nodeId && canonicalPort(nodeId, connection.to.port) === canonicalPort(nodeId, port)) ?? [];
    return incoming.length === 1 ? lookup(incoming[0].from.nodeId, incoming[0].from.port) : null;
  };
}
