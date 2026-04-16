import type { HardwareMappingEntryV2 } from '@redbyte/rb-utils';
import type { ParsedPort } from '../../import/hdlToCircuit';
import { parseVhdl } from '../../import/vhdlImport';

export interface GuidedBoundaryOption {
  rowId: string;
  label: string;
  nodeId: string;
  port: string;
  direction: 'in' | 'out';
}

export type GuidedHdlCatalogEntry =
  | {
      kind: 'scalar';
      key: string;
      portName: string;
      direction: 'in' | 'out';
      displayLabel: string;
    }
  | {
      kind: 'vector';
      key: string;
      baseName: string;
      direction: 'in' | 'out';
      msb: number;
      lsb: number;
      displayLabel: string;
    };

export function buildGuidedBoundaryOptions(
  rows: Array<{ id: string; nodeId?: string; port?: string; label: string; direction: 'in' | 'out' }>,
): GuidedBoundaryOption[] {
  return rows
    .filter((r): r is typeof r & { nodeId: string } => Boolean(r.nodeId?.trim()))
    .map((r) => ({
      rowId: r.id,
      label: r.label,
      nodeId: r.nodeId,
      port: (r.port ?? '').trim(),
      direction: r.direction,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildGuidedHdlCatalogFromText(vhdlText: string | undefined): GuidedHdlCatalogEntry[] {
  if (!vhdlText?.trim()) return [];
  try {
    const parsed = parseVhdl(vhdlText);
    return groupParsedPortsToGuidedCatalog(parsed.ports);
  } catch {
    return [];
  }
}

function groupParsedPortsToGuidedCatalog(ports: ParsedPort[]): GuidedHdlCatalogEntry[] {
  const bitPattern = /^(\w+)\[(\d+)\]$/;
  const busMap = new Map<string, { direction: 'in' | 'out'; indices: Set<number> }>();
  const scalars: GuidedHdlCatalogEntry[] = [];

  for (const p of ports) {
    const m = p.name.match(bitPattern);
    if (m) {
      const base = m[1]!;
      const idx = Number(m[2]!);
      let g = busMap.get(base);
      if (!g) {
        g = { direction: p.direction, indices: new Set() };
        busMap.set(base, g);
      }
      g.indices.add(idx);
    } else {
      scalars.push({
        kind: 'scalar',
        key: `hdl:scalar:${p.name}:${p.direction}`,
        portName: p.name,
        direction: p.direction,
        displayLabel: `${p.name} — ${p.direction === 'in' ? 'input' : 'output'} (scalar)`,
      });
    }
  }

  const vectors: GuidedHdlCatalogEntry[] = [];
  for (const [baseName, acc] of busMap) {
    const sorted = [...acc.indices].sort((a, b) => b - a);
    const msb = sorted[0]!;
    const lsb = sorted[sorted.length - 1]!;
    vectors.push({
      kind: 'vector',
      key: `hdl:vector:${baseName}:${acc.direction}`,
      baseName,
      direction: acc.direction,
      msb,
      lsb,
      displayLabel: `${baseName} [${msb}:${lsb}] — ${acc.direction === 'in' ? 'input' : 'output'} (bus)`,
    });
  }

  return [...scalars, ...vectors].sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
}

export function suggestEntryIdFromHdl(entry: GuidedHdlCatalogEntry | undefined): string {
  if (!entry) return '';
  return entry.kind === 'scalar' ? entry.portName : entry.baseName;
}

export function buildBusEntryFromMemberRows(input: {
  entryId: string;
  portName: string;
  direction: 'in' | 'out';
  label?: string;
  alias?: string;
  memberRows: GuidedBoundaryOption[];
  pins?: string[];
}): HardwareMappingEntryV2 | null {
  const { entryId, portName, direction, memberRows, pins } = input;
  if (!entryId.trim() || !portName.trim() || memberRows.length === 0) return null;
  const width = memberRows.length;
  const bits = memberRows.map((row, index) => ({
    id: `${entryId.trim()}[${index}]`,
    bitIndex: index,
    nodeId: row.nodeId,
    port: row.port,
    pin: pins?.[index]?.trim() ?? '',
    label: row.label ? `${row.label}` : row.rowId,
  }));
  return {
    kind: 'bus',
    id: entryId.trim(),
    direction,
    portName: portName.trim(),
    width,
    label: input.label?.trim() || undefined,
    alias: input.alias?.trim() || undefined,
    bits,
  };
}
