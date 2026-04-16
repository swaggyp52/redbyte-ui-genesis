import type { Node } from '@redbyte/rb-logic-core';
import type { ChipMetadata } from '@redbyte/rb-logic-view';
import { getDesignChipMetadata } from './designChipMetadata';

export const REGISTER_FAMILY_TYPES = new Set(['Register1', 'RegisterBus', 'StateBank']);

export function normalizeRegisterWidth(
  nodeType: string,
  config: Record<string, unknown> | undefined
): number {
  const raw = config?.width;
  const fallback = nodeType === 'Register1' ? 1 : 8;
  const w = Number.isFinite(raw) ? Math.floor(Number(raw)) : fallback;
  if (!Number.isFinite(w) || w < 1) return fallback;
  return Math.min(32, w);
}

/**
 * Chip metadata for canvas + wiring, including per-bit D[i] / Q[i] ports for bus registers.
 */
export function getDesignChipMetadataForNode(node: Node): ChipMetadata | undefined {
  const base = getDesignChipMetadata(node.type);
  if (!base) return undefined;
  if (!REGISTER_FAMILY_TYPES.has(node.type)) return base;
  return expandRegisterFamilyChipMetadata(base, node);
}

function expandRegisterFamilyChipMetadata(base: ChipMetadata, node: Node): ChipMetadata {
  const cfg = (node.config ?? {}) as Record<string, unknown>;
  const width = normalizeRegisterWidth(node.type, cfg);
  const inputs = [...base.inputs];
  const outputs = [...base.outputs];

  if (node.type === 'RegisterBus' || node.type === 'StateBank') {
    for (let i = 0; i < width; i += 1) {
      const dBit = `D[${i}]`;
      const qBit = `Q[${i}]`;
      if (!inputs.some((p) => p.id === dBit)) {
        inputs.push({ id: dBit, name: dBit });
      }
      if (!outputs.some((p) => p.id === qBit)) {
        outputs.push({ id: qBit, name: qBit });
      }
    }
  }

  const kind = node.type === 'StateBank' ? 'state bank' : node.type === 'RegisterBus' ? 'bus register' : 'register';
  return {
    ...base,
    inputs,
    outputs,
    name: `${base.name} · ${width}b ${kind}`,
  };
}
