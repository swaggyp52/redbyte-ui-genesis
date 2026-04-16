import type {
  HardwareBoardResourceType,
  HardwareMappingBusBitV2,
  HardwareMappingDocumentV2,
  HardwareMappingEntryV2,
  HardwareTimingRole,
} from '@redbyte/rb-utils';
import { cloneHardwareMappingDocumentV2 } from '@redbyte/rb-utils';

export type HardwareMappingEntryKind = HardwareMappingEntryV2['kind'];
export type StructuredCompleteness = 'unmapped' | 'partial' | 'complete';

export interface StructuredHardwareEntryView {
  id: string;
  kind: HardwareMappingEntryKind;
  direction: 'in' | 'out';
  portName: string;
  alias?: string;
  label?: string;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
  mappedBits: number;
  totalBits: number;
  completeness: StructuredCompleteness;
  memberIds?: string[];
}

export type HardwareMappingV2EditOperation =
  | {
      type: 'upsert_entry';
      entry: HardwareMappingEntryV2;
    }
  | {
      type: 'remove_entry';
      entryId: string;
    }
  | {
      type: 'set_entry_meta';
      entryId: string;
      label?: string;
      alias?: string;
      timingRole?: HardwareTimingRole;
      boardResourceType?: HardwareBoardResourceType;
    }
  | {
      type: 'map_entry_pins';
      entryId: string;
      pins: string[];
    }
  | {
      type: 'clear_entry_pins';
      entryId: string;
    };

export function buildStructuredHardwareEntryViews(
  doc: HardwareMappingDocumentV2
): StructuredHardwareEntryView[] {
  return doc.entries.map((entry) => {
    const { mappedBits, totalBits } = summarizeEntryPins(entry);
    return {
      id: entry.id,
      kind: entry.kind,
      direction: entry.direction,
      portName: entry.portName,
      alias: entry.alias,
      label: entry.label,
      timingRole: entry.timingRole,
      boardResourceType: entry.boardResourceType,
      mappedBits,
      totalBits,
      completeness: deriveStructuredCompleteness(mappedBits, totalBits),
      memberIds: entry.kind === 'group' ? [...entry.memberIds] : undefined,
    };
  });
}

export function applyHardwareMappingV2Edit(
  doc: HardwareMappingDocumentV2,
  operation: HardwareMappingV2EditOperation
): HardwareMappingDocumentV2 {
  const next = cloneHardwareMappingDocumentV2(doc);
  switch (operation.type) {
    case 'upsert_entry': {
      const index = next.entries.findIndex((entry) => entry.id === operation.entry.id);
      if (index >= 0) {
        next.entries[index] = structuredClone(operation.entry);
      } else {
        next.entries.push(structuredClone(operation.entry));
      }
      return next;
    }
    case 'remove_entry': {
      next.entries = next.entries.filter((entry) => entry.id !== operation.entryId);
      for (const entry of next.entries) {
        if (entry.kind === 'group') {
          entry.memberIds = entry.memberIds.filter((memberId) => memberId !== operation.entryId);
        }
      }
      return next;
    }
    case 'set_entry_meta': {
      const entry = next.entries.find((candidate) => candidate.id === operation.entryId);
      if (!entry) return next;
      entry.label = operation.label;
      entry.alias = operation.alias;
      entry.timingRole = operation.timingRole;
      entry.boardResourceType = operation.boardResourceType;
      return next;
    }
    case 'map_entry_pins': {
      const entry = next.entries.find((candidate) => candidate.id === operation.entryId);
      if (!entry) return next;
      applyPinsToEntry(entry, operation.pins);
      return next;
    }
    case 'clear_entry_pins': {
      const entry = next.entries.find((candidate) => candidate.id === operation.entryId);
      if (!entry) return next;
      clearPinsOnEntry(entry);
      return next;
    }
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }
}

export function parsePinsInput(value: string): string[] {
  return value
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length > 0);
}

export function buildSequentialPins(prefix: string, startIndex: number, count: number): string[] {
  const normalizedPrefix = prefix.trim().toUpperCase();
  if (!normalizedPrefix || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => `${normalizedPrefix}${startIndex + index}`);
}

function applyPinsToEntry(entry: HardwareMappingEntryV2, pins: string[]): void {
  const normalizedPins = pins.map((pin) => pin.trim()).filter((pin) => pin.length > 0);
  if (entry.kind === 'scalar' || entry.kind === 'bit') {
    entry.pin = normalizedPins[0] ?? '';
    return;
  }
  if (entry.kind === 'slice') {
    const nextPins = [...entry.pins];
    for (let index = 0; index < nextPins.length; index += 1) {
      nextPins[index] = normalizedPins[index] ?? '';
    }
    entry.pins = nextPins;
    return;
  }
  if (entry.kind === 'bus') {
    entry.bits = entry.bits.map((bit, index) => ({
      ...bit,
      pin: normalizedPins[index] ?? '',
    }));
  }
}

function clearPinsOnEntry(entry: HardwareMappingEntryV2): void {
  if (entry.kind === 'scalar' || entry.kind === 'bit') {
    entry.pin = '';
    return;
  }
  if (entry.kind === 'slice') {
    entry.pins = entry.pins.map(() => '');
    return;
  }
  if (entry.kind === 'bus') {
    entry.bits = entry.bits.map((bit) => ({ ...bit, pin: '' }));
  }
}

function summarizeEntryPins(entry: HardwareMappingEntryV2): { mappedBits: number; totalBits: number } {
  if (entry.kind === 'group') return { mappedBits: 0, totalBits: 0 };
  if (entry.kind === 'scalar' || entry.kind === 'bit') {
    return {
      mappedBits: entry.pin?.trim().length ? 1 : 0,
      totalBits: 1,
    };
  }
  if (entry.kind === 'slice') {
    const pins = entry.pins ?? [];
    return {
      mappedBits: pins.filter((pin) => pin.trim().length > 0).length,
      totalBits: pins.length,
    };
  }
  const bits: HardwareMappingBusBitV2[] = entry.bits ?? [];
  return {
    mappedBits: bits.filter((bit) => bit.pin?.trim().length).length,
    totalBits: bits.length,
  };
}

function deriveStructuredCompleteness(mappedBits: number, totalBits: number): StructuredCompleteness {
  if (totalBits <= 0) return 'partial';
  if (mappedBits <= 0) return 'unmapped';
  if (mappedBits >= totalBits) return 'complete';
  return 'partial';
}
