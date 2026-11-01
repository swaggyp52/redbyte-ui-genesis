import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { compareCodepoint } from '../../export/codepointSort';
import { digestValue } from '../../utils/digest';
import { stableSerialize } from '../../utils/stableSerialize';
import type { ProjectIoRow } from './projectRuntime';
import { buildVerifyCircuitEvidenceHash, toProjectIoMapping } from './verifyProjectHash';
import { computeVectorStimulusHash } from './verifyScenario';

/**
 * The replay identity Simulate stamps on a Run request (`deterministicHash`). Moved verbatim
 * from IdeApp so every Run owner (the workbench and the studio) computes it the same way;
 * IdeApp re-exports it unchanged.
 */
export function buildCurrentVerifyReplayHash(input: {
  circuit: Circuit;
  projectVectors: TestVector[];
  customVectors?: TestVector[];
  projectIoRows: ProjectIoRow[];
}): string {
  return digestValue(
    stableSerialize({
      circuitEvidenceHash: buildVerifyCircuitEvidenceHash(input.circuit),
      stimulusHash: computeVectorStimulusHash([
        ...input.projectVectors,
        ...(input.customVectors ?? []),
      ].map((vector) => ({
        tick: vector.tick,
        inputs: canonicalizeVerifyReplayInputs(vector.inputs ?? {}, input.projectIoRows),
      }))),
      mapping: toProjectIoMapping(input.projectIoRows),
    })
  );
}

function canonicalizeVerifyReplayInputs(
  inputs: Record<string, boolean | number>,
  projectIoRows: ProjectIoRow[]
): Record<string, boolean | number> {
  const inputAliasMap = buildVerifyReplayInputAliasMap(projectIoRows);
  return Object.fromEntries(
    Object.entries(inputs)
      .map(([key, value]): [string, boolean | number] => [inputAliasMap.get(normalizeVerifyReplayKey(key)) ?? key, value])
      .sort(([left], [right]) => compareCodepoint(left, right))
  );
}

function buildVerifyReplayInputAliasMap(projectIoRows: ProjectIoRow[]): Map<string, string> {
  const aliasMap = new Map<string, string>();
  for (const row of projectIoRows) {
    if (row.direction !== 'in') continue;
    const aliases = [row.id, row.label, row.nodeId ?? '', `${row.nodeId ?? ''}.${row.port ?? ''}`];
    for (const alias of aliases) {
      const normalized = normalizeVerifyReplayKey(alias);
      if (!normalized) continue;
      aliasMap.set(normalized, row.id);
    }
  }
  return aliasMap;
}

function normalizeVerifyReplayKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}
