// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { ProofPack, RunRecord } from './runRecord';
import { normalizeCircuit } from './runRecordUtils';

export const buildProofPack = (
  record: RunRecord,
  circuit: Circuit,
  meta?: ProofPack['meta']
): ProofPack => ({
  kind: 'rb-proof-pack',
  version: 1,
  createdAt: new Date().toISOString(),
  runRecord: record,
  normalizedCircuit: normalizeCircuit(circuit),
  meta,
});

export const encodeProofPack = (pack: ProofPack) => JSON.stringify(pack, null, 2);

export const isProofPack = (value: unknown): value is ProofPack => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ProofPack;
  return candidate.kind === 'rb-proof-pack' && candidate.version === 1 && !!candidate.runRecord;
};

export const decodeProofPack = (raw: string): ProofPack => {
  const parsed = JSON.parse(raw);
  if (!isProofPack(parsed)) {
    throw new Error('Invalid proof pack: missing kind/version/runRecord');
  }
  return parsed;
};
