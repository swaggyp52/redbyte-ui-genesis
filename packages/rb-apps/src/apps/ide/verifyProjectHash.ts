import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../utils/digest';
import { stableSerialize } from '../../utils/stableSerialize';
import { normalizeCircuit } from '../../recording/runRecordUtils';
import type { IdeExampleIoRow } from './examplesCatalog';

/**
 * Canonical circuit evidence hash shared by Runtime Verify and Export.
 *
 * IdeApp projects the live circuit into RBProject form by materializing
 * position/x/y/config/state defaults. Canonicalizing those same defaults here
 * keeps a just-completed run current across that projection while preserving
 * every authored node/connection field and every real Design edit.
 */
export function buildVerifyCircuitEvidenceHash(circuit: Circuit): string {
  return digestValue(stableSerialize(normalizeVerifySemanticCircuit(circuit)));
}

function normalizeVerifySemanticCircuit(circuit: Circuit) {
  const normalized = normalizeCircuit(circuit);
  return {
    nodes: normalized.nodes.map(({ state: _state, ...node }) => node),
    connections: normalized.connections,
  };
}

/**
 * Canonical IO mapping evidence shared by Runtime Verify and Export.
 *
 * Pin assignment is part of the generated FPGA handoff even though it does not
 * change simulator behavior. Keep this proof separate from circuit evidence so
 * a Map Pins edit can invalidate exported Verify rows without pretending the
 * circuit itself changed.
 */
export function buildVerifyMappingEvidenceHash(mapping: IoMapping | undefined): string {
  const normalizeEntries = (entries: IoMapping['inputs'] | undefined) =>
    (entries ?? [])
      .map((entry) => ({
        id: entry.id ?? '',
        nodeId: entry.nodeId ?? '',
        port: entry.port ?? '',
        label: entry.label ?? '',
        pin: entry.pin ?? '',
      }))
      .sort((left, right) => {
        const leftKey = [left.id, left.nodeId, left.port, left.label, left.pin].join('\u0000');
        const rightKey = [right.id, right.nodeId, right.port, right.label, right.pin].join('\u0000');
        if (leftKey < rightKey) return -1;
        if (leftKey > rightKey) return 1;
        return 0;
      });

  return digestValue(
    stableSerialize({
      inputs: normalizeEntries(mapping?.inputs),
      outputs: normalizeEntries(mapping?.outputs),
    })
  );
}

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
      // Canvas placement is presentation state. Verify authority changes only
      // when electrical structure/configuration or the logical IO contract does.
      circuit: normalizeVerifySemanticCircuit(input.circuit),
      vectors: [...input.projectVectors, ...(input.customVectors ?? [])].map((vector) => ({
        tick: vector.tick,
        inputs: { ...(vector.inputs ?? {}) },
        expected: { ...(vector.expected ?? {}) },
      })),
      mapping: toProjectIoMapping(input.projectIoRows),
    }),
  );
}
