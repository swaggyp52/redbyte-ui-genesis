// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Hardware mapping V2 — canonical structured board mapping for Basys3-class flows.
 *
 * Legacy {@link IoMapping} remains for migration and engines that consume a flat
 * scalar list. When `hardwareMappingV2` is present on a project, it is authoritative;
 * materialize to {@link IoMapping} for simulation/export paths that are not yet
 * slice-aware end-to-end.
 */

import type { IoMapping, IoMappingEntry } from './labProjectSchema';

export type HardwareMappingSchemaVersion = '2.0';

export type HardwareBoardId = 'basys3';

/** How this signal participates in timing / lab workflows (optional metadata). */
export type HardwareTimingRole =
  | 'generic'
  | 'clock'
  | 'reset'
  | 'manual_step'
  | 'enable';

/** Physical board resource classification (optional metadata). */
export type HardwareBoardResourceType =
  | 'generic'
  | 'switch'
  | 'button'
  | 'led'
  | 'clock_pin'
  | 'seven_seg';

export interface HardwareMappingDocumentV2 {
  schemaVersion: HardwareMappingSchemaVersion;
  boardId: HardwareBoardId;
  /** Ordered list; group entries reference other entries by id. */
  entries: HardwareMappingEntryV2[];
}

export type HardwareMappingEntryV2 =
  | HardwareMappingScalarV2
  | HardwareMappingBitV2
  | HardwareMappingSliceV2
  | HardwareMappingBusV2
  | HardwareMappingGroupV2;

interface HardwareMappingEntryBase {
  id: string;
  direction: 'in' | 'out';
  label?: string;
  alias?: string;
  /** HDL / top-level port or logical signal name for documentation */
  portName: string;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
}

/** Single 1-bit boundary mapping (legacy IoMapping row equivalent). */
export interface HardwareMappingScalarV2 extends HardwareMappingEntryBase {
  kind: 'scalar';
  width: 1;
  nodeId: string;
  port: string;
  pin?: string;
}

/** Explicit single bit of a vector or bus (metadata richer than scalar). */
export interface HardwareMappingBitV2 extends HardwareMappingEntryBase {
  kind: 'bit';
  nodeId: string;
  port: string;
  bitIndex: number;
  pin?: string;
  /** Optional parent bus/slice id for UI grouping */
  parentId?: string;
}

/** Contiguous index slice (inclusive msb/lsb). pins[0] = lsb bit. */
export interface HardwareMappingSliceV2 extends HardwareMappingEntryBase {
  kind: 'slice';
  nodeId: string;
  port: string;
  msb: number;
  lsb: number;
  pins: string[];
}

/**
 * Named bus: ordered bit bindings (e.g. SW bank). Materializes to one IoMapping row per bit.
 */
export interface HardwareMappingBusV2 extends HardwareMappingEntryBase {
  kind: 'bus';
  width: number;
  bits: HardwareMappingBusBitV2[];
}

export interface HardwareMappingBusBitV2 {
  id: string;
  bitIndex: number;
  nodeId: string;
  port: string;
  pin?: string;
  label?: string;
}

/** Grouped board resources (e.g. switch bank) — expands to member entries in order. */
export interface HardwareMappingGroupV2 extends HardwareMappingEntryBase {
  kind: 'group';
  groupRole?: 'switch_bank' | 'led_bank' | 'button_row' | 'custom';
  memberIds: string[];
}

// ─── Migration / materialization ───────────────────────────────────────────

function toIoEntry(partial: Omit<IoMappingEntry, 'id'> & { id: string }): IoMappingEntry {
  return {
    id: partial.id,
    nodeId: partial.nodeId,
    port: partial.port,
    label: partial.label,
    pin: partial.pin,
  };
}

function expandSlice(entry: HardwareMappingSliceV2): IoMappingEntry[] {
  const span = entry.msb - entry.lsb + 1;
  if (span <= 0 || entry.pins.length !== span) {
    throw new Error(
      `hardwareMappingV2: slice "${entry.id}" has inconsistent msb/lsb/pins (expected ${span} pins)`
    );
  }
  const out: IoMappingEntry[] = [];
  for (let i = 0; i < span; i += 1) {
    const bitIndex = entry.lsb + i;
    out.push(
      toIoEntry({
        id: `${entry.id}[${bitIndex}]`,
        nodeId: entry.nodeId,
        port: entry.port,
        label: entry.label ? `${entry.label}[${bitIndex}]` : undefined,
        pin: entry.pins[i],
      })
    );
  }
  return out;
}

function materializeOne(
  entry: HardwareMappingEntryV2,
  inputs: IoMappingEntry[],
  outputs: IoMappingEntry[]
): void {
  const push = (row: IoMappingEntry, direction: 'in' | 'out') => {
    if (direction === 'in') inputs.push(row);
    else outputs.push(row);
  };

  switch (entry.kind) {
    case 'scalar':
      push(
        toIoEntry({
          id: entry.id,
          nodeId: entry.nodeId,
          port: entry.port,
          label: entry.label,
          pin: entry.pin,
        }),
        entry.direction
      );
      return;
    case 'bit':
      push(
        toIoEntry({
          id: entry.id,
          nodeId: entry.nodeId,
          port: entry.port,
          label: entry.label,
          pin: entry.pin,
        }),
        entry.direction
      );
      return;
    case 'slice':
      for (const row of expandSlice(entry)) {
        push(row, entry.direction);
      }
      return;
    case 'bus':
      if (entry.bits.length !== entry.width) {
        throw new Error(`hardwareMappingV2: bus "${entry.id}" width/bits mismatch`);
      }
      for (const bit of entry.bits) {
        push(
          toIoEntry({
            id: bit.id,
            nodeId: bit.nodeId,
            port: bit.port,
            label: bit.label,
            pin: bit.pin,
          }),
          entry.direction
        );
      }
      return;
    case 'group':
      return;
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}

/**
 * Flatten structured mapping to legacy {@link IoMapping} for engines and Basys3 export.
 * Group members referenced only through a group are emitted when processing that group.
 */
export function materializeIoMappingFromHardwareMappingV2(doc: HardwareMappingDocumentV2): IoMapping {
  const inputs: IoMappingEntry[] = [];
  const outputs: IoMappingEntry[] = [];
  const byId = new Map(doc.entries.map((e) => [e.id, e]));
  const groupMemberIds = new Set<string>();
  for (const e of doc.entries) {
    if (e.kind === 'group') {
      for (const mid of e.memberIds) groupMemberIds.add(mid);
    }
  }

  const emitSubtree = (entry: HardwareMappingEntryV2): void => {
    if (entry.kind === 'group') {
      for (const mid of entry.memberIds) {
        const child = byId.get(mid);
        if (!child) continue;
        if (child.kind === 'group') emitSubtree(child);
        else materializeOne(child, inputs, outputs);
      }
      return;
    }
    materializeOne(entry, inputs, outputs);
  };

  for (const entry of doc.entries) {
    if (entry.kind !== 'group' && groupMemberIds.has(entry.id)) {
      continue;
    }
    if (entry.kind === 'group') {
      emitSubtree(entry);
    } else {
      materializeOne(entry, inputs, outputs);
    }
  }

  return { inputs, outputs };
}

/**
 * Promote legacy scalar IoMapping to a V2 document (one scalar entry per row).
 */
export function migrateIoMappingToHardwareMappingV2(io: IoMapping): HardwareMappingDocumentV2 {
  const entries: HardwareMappingEntryV2[] = [];
  for (const e of io.inputs) {
    entries.push({
      kind: 'scalar',
      id: e.id,
      direction: 'in',
      width: 1,
      portName: (e.label ?? e.id).trim() || e.id,
      nodeId: e.nodeId,
      port: e.port,
      label: e.label,
      pin: e.pin,
    });
  }
  for (const e of io.outputs) {
    entries.push({
      kind: 'scalar',
      id: e.id,
      direction: 'out',
      width: 1,
      portName: (e.label ?? e.id).trim() || e.id,
      nodeId: e.nodeId,
      port: e.port,
      label: e.label,
      pin: e.pin,
    });
  }
  return {
    schemaVersion: '2.0',
    boardId: 'basys3',
    entries,
  };
}

export interface ProjectMappingFields {
  ioMapping?: IoMapping;
  hardwareMappingV2?: HardwareMappingDocumentV2 | null;
}

/**
 * Resolve effective legacy IoMapping: V2 is canonical when present and non-empty.
 */
export function resolveIoMappingFromProjectFields(project: ProjectMappingFields): IoMapping | undefined {
  const v2 = project.hardwareMappingV2;
  if (v2 && Array.isArray(v2.entries) && v2.entries.length > 0) {
    return materializeIoMappingFromHardwareMappingV2(v2);
  }
  return project.ioMapping;
}

export function cloneHardwareMappingDocumentV2(doc: HardwareMappingDocumentV2): HardwareMappingDocumentV2 {
  return structuredClone(doc);
}

/**
 * Apply a pin assignment to the canonical V2 document using a **materialized** row id
 * (same ids produced by {@link materializeIoMappingFromHardwareMappingV2}).
 */
export function applyMaterializedPinToHardwareMappingV2(
  doc: HardwareMappingDocumentV2,
  materializedRowId: string,
  pin: string
): HardwareMappingDocumentV2 {
  const next = cloneHardwareMappingDocumentV2(doc);
  const trimmedPin = pin.trim();

  for (const entry of next.entries) {
    if (entry.kind === 'scalar' && entry.id === materializedRowId) {
      entry.pin = trimmedPin;
      return next;
    }
    if (entry.kind === 'bit' && entry.id === materializedRowId) {
      entry.pin = trimmedPin;
      return next;
    }
    if (entry.kind === 'slice') {
      const sliceRowMatch = /^(.+)\[(\d+)\]$/.exec(materializedRowId);
      if (sliceRowMatch?.[1] === entry.id) {
        const bitIndex = Number.parseInt(sliceRowMatch[2] ?? '', 10);
        if (!Number.isFinite(bitIndex)) return next;
        const span = entry.msb - entry.lsb + 1;
        if (span <= 0 || entry.pins.length !== span) return next;
        const slot = bitIndex - entry.lsb;
        if (slot >= 0 && slot < entry.pins.length) {
          entry.pins[slot] = trimmedPin;
        }
        return next;
      }
    }
    if (entry.kind === 'bus') {
      for (const bit of entry.bits) {
        if (bit.id === materializedRowId) {
          bit.pin = trimmedPin;
          return next;
        }
      }
    }
  }

  return next;
}
