/**
 * Bridges legacy flat {@link IoMapping} rows with {@link HardwareMappingDocumentV2}
 * for Map Pins / runtime / export.
 */

import type { IoMapping } from '@redbyte/rb-utils';
import {
  cloneHardwareMappingDocumentV2,
  materializeIoMappingFromHardwareMappingV2,
  migrateIoMappingToHardwareMappingV2,
  type HardwareMappingDocumentV2,
} from '@redbyte/rb-utils';
import type { IdeExampleIoRow } from './examplesCatalog';

export { cloneHardwareMappingDocumentV2 };

/** Insert or update a scalar boundary entry (Design / board IO flows). */
export function upsertScalarMappingEntry(
  doc: HardwareMappingDocumentV2,
  row: IdeExampleIoRow
): HardwareMappingDocumentV2 {
  const next = cloneHardwareMappingDocumentV2(doc);
  const portName = (row.label ?? row.id).trim() || row.id;
  const matchIdx = next.entries.findIndex((e) => e.id === row.id && e.kind === 'scalar');
  if (matchIdx >= 0) {
    const e = next.entries[matchIdx];
    if (e.kind === 'scalar') {
      e.nodeId = row.nodeId;
      e.port = row.port;
      e.label = row.label;
      e.pin = row.pin?.trim() ?? '';
      e.direction = row.direction;
      e.portName = portName;
    }
    return next;
  }
  next.entries.push({
    kind: 'scalar',
    id: row.id,
    direction: row.direction,
    width: 1,
    portName,
    nodeId: row.nodeId,
    port: row.port,
    label: row.label,
    pin: row.pin?.trim() ?? '',
  });
  return next;
}

export function toIoMappingFromProjectIoRows(rows: IdeExampleIoRow[]): IoMapping {
  return {
    inputs: rows
      .filter((row) => row.direction === 'in')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId,
        port: row.port,
        label: row.label,
        pin: row.pin,
      })),
    outputs: rows
      .filter((row) => row.direction === 'out')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId,
        port: row.port,
        label: row.label,
        pin: row.pin,
      })),
  };
}

type V2RowMeta = {
  mappingKind: IdeExampleIoRow['mappingKind'];
  timingRole?: IdeExampleIoRow['timingRole'];
  boardResourceType?: IdeExampleIoRow['boardResourceType'];
};

/** Build id → metadata from structured V2 entries (including bus bits and slice expansion ids). */
export function buildV2MetaByRowId(doc: HardwareMappingDocumentV2): Map<string, V2RowMeta> {
  const m = new Map<string, V2RowMeta>();
  for (const e of doc.entries) {
    if (e.kind === 'scalar') {
      m.set(e.id, {
        mappingKind: 'scalar',
        timingRole: e.timingRole,
        boardResourceType: e.boardResourceType,
      });
      continue;
    }
    if (e.kind === 'bit') {
      m.set(e.id, {
        mappingKind: 'bit',
        timingRole: e.timingRole,
        boardResourceType: e.boardResourceType,
      });
      continue;
    }
    if (e.kind === 'slice') {
      const span = e.msb - e.lsb + 1;
      if (span <= 0 || e.pins.length !== span) continue;
      for (let i = 0; i < span; i += 1) {
        const bitIndex = e.lsb + i;
        const syntheticId = `${e.id}[${bitIndex}]`;
        m.set(syntheticId, {
          mappingKind: 'slice',
          timingRole: e.timingRole,
          boardResourceType: e.boardResourceType,
        });
      }
      continue;
    }
    if (e.kind === 'bus') {
      for (const b of e.bits) {
        m.set(b.id, {
          mappingKind: 'bus',
          timingRole: e.timingRole,
          boardResourceType: e.boardResourceType,
        });
      }
      continue;
    }
    if (e.kind === 'group') {
      m.set(e.id, {
        mappingKind: 'group',
        timingRole: e.timingRole,
        boardResourceType: e.boardResourceType,
      });
    }
  }
  return m;
}

export function enrichProjectIoRowsWithV2Metadata(
  rows: IdeExampleIoRow[],
  v2: HardwareMappingDocumentV2 | undefined
): IdeExampleIoRow[] {
  if (!v2?.entries?.length) {
    return rows.map((r) => ({
      ...r,
      mappingKind: r.mappingKind ?? 'scalar',
    }));
  }
  const metaById = buildV2MetaByRowId(v2);
  return rows.map((row) => {
    const meta = metaById.get(row.id);
    if (!meta) {
      return {
        ...row,
        mappingKind: row.mappingKind ?? 'scalar',
      };
    }
    return {
      ...row,
      mappingKind: meta.mappingKind,
      timingRole: meta.timingRole ?? row.timingRole,
      boardResourceType: meta.boardResourceType ?? row.boardResourceType,
    };
  });
}

function inferBoardResourceFromLabel(label: string): IdeExampleIoRow['boardResourceType'] | undefined {
  const t = label.trim().toUpperCase();
  if (/^SW\d|^SW\[/.test(t) || /^SW$/.test(t)) return 'switch';
  if (/^LD\d|^LD\[/.test(t) || /^LED/.test(t)) return 'led';
  if (/BTN|^BTN/.test(t)) return 'button';
  if (/CLK|CLOCK|CLK100/.test(t)) return 'clock_pin';
  if (/SEG|AN\d|CA|CB|CC|CD|CE|CF|CG|DP/.test(t)) return 'seven_seg';
  return undefined;
}

/**
 * Persist canonical hardwareMappingV2 from current Map Pins rows (scalar migration + row metadata overlay).
 */
export function buildHardwareMappingV2FromProjectIoRows(rows: IdeExampleIoRow[]): HardwareMappingDocumentV2 {
  const doc = migrateIoMappingToHardwareMappingV2(toIoMappingFromProjectIoRows(rows));
  for (const entry of doc.entries) {
    if (entry.kind !== 'scalar') continue;
    const row = rows.find((r) => r.id === entry.id);
    if (!row) continue;
    if (row.timingRole) {
      entry.timingRole = row.timingRole;
    }
    if (row.boardResourceType) {
      entry.boardResourceType = row.boardResourceType;
    } else {
      const inferred = inferBoardResourceFromLabel(row.label ?? row.id);
      if (inferred) {
        entry.boardResourceType = inferred;
      }
    }
  }
  return doc;
}

/**
 * Flat materialized rows from V2 (same ids as {@link materializeIoMappingFromHardwareMappingV2}),
 * with V2 metadata for Map Pins. Caller should run {@link synchronizeProjectIoRows} against the live circuit.
 */
export function materializedIoRowsFromHardwareMappingV2(doc: HardwareMappingDocumentV2): IdeExampleIoRow[] {
  const io = materializeIoMappingFromHardwareMappingV2(doc);
  const rows: IdeExampleIoRow[] = [];
  for (const entry of io.inputs ?? []) {
    rows.push({
      id: entry.id,
      nodeId: entry.nodeId,
      port: entry.port,
      label: (entry.label ?? entry.id).trim() || entry.id,
      direction: 'in',
      pin: entry.pin ?? '',
      required: true,
    });
  }
  for (const entry of io.outputs ?? []) {
    rows.push({
      id: entry.id,
      nodeId: entry.nodeId,
      port: entry.port,
      label: (entry.label ?? entry.id).trim() || entry.id,
      direction: 'out',
      pin: entry.pin ?? '',
      required: true,
    });
  }
  return enrichProjectIoRowsWithV2Metadata(rows, doc);
}

export function deriveMappingCompleteness(row: {
  required: boolean;
  pin: string;
}): 'unmapped' | 'partial' | 'complete' {
  const hasPin = row.pin.trim().length > 0;
  if (!row.required) {
    return hasPin ? 'complete' : 'partial';
  }
  return hasPin ? 'complete' : 'unmapped';
}
