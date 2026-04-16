import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../utils/digest';
import { stableSerialize } from '../../utils/stableSerialize';
import type { IdeExampleIoRow } from './examplesCatalog';

export function toProjectIoMapping(projectIoRows: IdeExampleIoRow[]): {
  inputs: Array<{ id: string; nodeId: string; port: string; label: string; pin: string }>;
  outputs: Array<{ id: string; nodeId: string; port: string; label: string; pin: string }>;
} {
  return {
    inputs: projectIoRows
      .filter((row) => row.direction === 'in')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? '',
        port: row.port ?? '',
        label: row.label,
        pin: row.pin,
      })),
    outputs: projectIoRows
      .filter((row) => row.direction === 'out')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? '',
        port: row.port ?? '',
        label: row.label,
        pin: row.pin,
      })),
  };
}

export function buildCurrentVerifyProjectHash(input: {
  circuit: Circuit;
  projectVectors: TestVector[];
  customVectors?: TestVector[];
  projectIoRows: IdeExampleIoRow[];
}): string {
  return digestValue(
    stableSerialize({
      circuit: input.circuit,
      vectors: [...input.projectVectors, ...(input.customVectors ?? [])].map((vector) => ({
        tick: vector.tick,
        inputs: { ...(vector.inputs ?? {}) },
        expected: { ...(vector.expected ?? {}) },
      })),
      mapping: toProjectIoMapping(input.projectIoRows),
    }),
  );
}
