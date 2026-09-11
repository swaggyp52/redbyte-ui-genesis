/**
 * Bridges legacy flat {@link IoMapping} rows with {@link HardwareMappingDocumentV2}
 * for Map Pins / runtime / export.
 */

import type { IoMapping } from '@redbyte/rb-utils';
import {
  cloneHardwareMappingDocumentV2,
  materializeIoMappingFromHardwareMappingV2,
  migrateIoMappingToHardwareMappingV2,
  type HardwareMappingEntryV2,
  type HardwareMappingDocumentV2,
  type HardwareMappingScalarV2,
} from '@redbyte/rb-utils';
import type { IdeExampleIoRow } from './examplesCatalog';
import { getBasys3BoardResource } from '../../fpga/boards/basys3/basys3Pins';

export { cloneHardwareMappingDocumentV2 };

/**
 * Reconciles scalar metadata with the physical resource the student just chose.
 * This prevents an old clock classification from surviving when that logical
 * row is deliberately rebound to a button or switch.
 */
export function applyScalarResourceMetadata(
  doc: HardwareMappingDocumentV2,
  rowId: string,
  pin: string
): HardwareMappingDocumentV2 {
  const next = cloneHardwareMappingDocumentV2(doc);
  const entry = next.entries.find(
    (candidate): candidate is HardwareMappingScalarV2 =>
      candidate.kind === 'scalar' && candidate.id === rowId
  );
  if (!entry) return next;

  const resource = getBasys3BoardResource(pin);
  const logicalToken = normalizeMappingToken(entry.label ?? entry.id);
  const isLogicalReset = /^(reset|rst|clear|clr)/.test(logicalToken);
  if (!resource) {
    entry.boardResourceType = inferBoardResourceFromLabel(entry.label ?? entry.id);
    entry.timingRole = isLogicalReset
      ? 'reset'
      : entry.boardResourceType === 'clock_pin'
        ? 'clock'
        : undefined;
    return next;
  }

  entry.boardResourceType =
    resource.category === 'clock'
      ? 'clock_pin'
      : resource.category === 'switch'
        ? 'switch'
        : resource.category === 'button'
          ? 'button'
          : resource.category === 'led'
            ? 'led'
            : resource.category === 'seven_seg'
              ? 'seven_seg'
              : 'generic';
  entry.timingRole =
    isLogicalReset
      ? 'reset'
      : resource.category === 'clock'
        ? 'clock'
        : undefined;
  return next;
}

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

/**
 * Resource kind from a label. Resource names are matched as whole tokens —
 * `CARRY` is not a cathode because it starts with `CA`, and `UNCLOCKED` is not a
 * clock — while a parenthesised alias such as `Reset (BTNC)` still counts.
 */
function inferBoardResourceFromLabel(label: string): IdeExampleIoRow['boardResourceType'] | undefined {
  const t = label.trim().toUpperCase();
  const hasToken = (pattern: string) => new RegExp(`(^|[^A-Z0-9])(${pattern})([^A-Z0-9]|$)`).test(t);
  if (/^SW\d|^SW\[/.test(t) || /^SW$/.test(t)) return 'switch';
  if (/^LD\d|^LD\[/.test(t) || /^LED/.test(t)) return 'led';
  if (hasToken('BTN[UDLRC]?')) return 'button';
  if (hasToken('CLK\\d*|CLOCK|CLK100MHZ')) return 'clock_pin';
  if (hasToken('SEG\\d*|AN\\d|C[A-G]|DP')) return 'seven_seg';
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

function normalizeMappingToken(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '');
}

function scoreScalarEntryMatch(
  entry: HardwareMappingScalarV2,
  row: IdeExampleIoRow
): number {
  let score = 0;
  if (
    normalizeMappingToken(entry.nodeId).length > 0 &&
    normalizeMappingToken(entry.nodeId) === normalizeMappingToken(row.nodeId)
  ) {
    score += 1000;
  }
  if (normalizeMappingToken(entry.id) === normalizeMappingToken(row.id)) {
    score += 400;
  }
  if (normalizeMappingToken(entry.label) === normalizeMappingToken(row.label)) {
    score += 200;
  }
  if (
    normalizeMappingToken(entry.portName) === normalizeMappingToken(row.label) ||
    normalizeMappingToken(entry.portName) === normalizeMappingToken(row.id)
  ) {
    score += 150;
  }
  if (entry.direction === row.direction) {
    score += 50;
  }
  if ((entry.pin ?? '').trim().length > 0) {
    score += 10;
  }
  return score;
}

function updateGroupMemberIds(
  entry: HardwareMappingEntryV2,
  scalarRekeyMap: ReadonlyMap<string, string>
): HardwareMappingEntryV2 {
  if (entry.kind !== 'group') {
    return entry;
  }
  return {
    ...entry,
    memberIds: entry.memberIds.map((memberId) => {
      const remapped = scalarRekeyMap.get(normalizeMappingToken(memberId));
      return remapped ?? memberId;
    }),
  };
}

/**
 * Realigns scalar V2 entries with the current live boundary rows after boundary rename/delete churn.
 *
 * This preserves canonical pin truth while ensuring the authoritative document uses the same ids,
 * labels, and node ownership that Project / Hardware / Export now present to the student.
 */
export function synchronizeScalarHardwareMappingV2WithProjectIoRows(
  doc: HardwareMappingDocumentV2,
  rows: IdeExampleIoRow[]
): HardwareMappingDocumentV2 {
  const next = cloneHardwareMappingDocumentV2(doc);
  const scalarEntries = next.entries.filter(
    (entry): entry is HardwareMappingScalarV2 => entry.kind === 'scalar'
  );

  const liveScalarRows = rows.filter((row) => (row.mappingKind ?? 'scalar') === 'scalar');
  const usedScalarIndexes = new Set<number>();
  const scalarRekeyMap = new Map<string, string>();
  const synchronizedScalars: HardwareMappingScalarV2[] = [];

  for (const row of liveScalarRows) {
    let bestIndex = -1;
    let bestScore = -1;

    for (let index = 0; index < scalarEntries.length; index += 1) {
      if (usedScalarIndexes.has(index)) continue;
      const score = scoreScalarEntryMatch(scalarEntries[index]!, row);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    // Direction is only a compatibility hint. It must not, by itself, transfer
    // a clock/reset resource role onto a newly duplicated boundary signal.
    const hasMeaningfulMatch = bestIndex >= 0 && bestScore > 50;
    const matchedEntry =
      hasMeaningfulMatch ? scalarEntries[bestIndex] : undefined;
    if (hasMeaningfulMatch) {
      usedScalarIndexes.add(bestIndex);
      const previousId = normalizeMappingToken(matchedEntry?.id);
      const nextId = row.id.trim();
      if (previousId.length > 0 && nextId.length > 0 && previousId !== normalizeMappingToken(nextId)) {
        scalarRekeyMap.set(previousId, nextId);
      }
    }

    const inferredBoardResource =
      row.boardResourceType ??
      matchedEntry?.boardResourceType ??
      inferBoardResourceFromLabel(row.label ?? row.id);

    synchronizedScalars.push({
      kind: 'scalar',
      width: 1,
      id: row.id,
      direction: row.direction,
      nodeId: row.nodeId ?? matchedEntry?.nodeId ?? '',
      port: row.port ?? matchedEntry?.port ?? (row.direction === 'in' ? 'out' : 'in'),
      label: row.label,
      alias: matchedEntry?.alias,
      portName: (row.label ?? row.id).trim() || row.id,
      timingRole: row.timingRole ?? matchedEntry?.timingRole,
      boardResourceType: inferredBoardResource,
      pin: row.pin?.trim() ?? matchedEntry?.pin ?? '',
    });
  }

  const preservedEntries = next.entries
    .filter((entry) => entry.kind !== 'scalar')
    .map((entry) => updateGroupMemberIds(entry, scalarRekeyMap));

  return {
    ...next,
    entries: [...synchronizedScalars, ...preservedEntries],
  };
}
