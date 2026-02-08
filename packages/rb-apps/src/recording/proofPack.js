// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { normalizeCircuit } from './runRecordUtils';
export const buildProofPack = (record, circuit, meta) => ({
    kind: 'rb-proof-pack',
    version: 1,
    createdAt: new Date().toISOString(),
    runRecord: record,
    normalizedCircuit: normalizeCircuit(circuit),
    meta,
});
export const encodeProofPack = (pack) => JSON.stringify(pack, null, 2);
export const isProofPack = (value) => {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return candidate.kind === 'rb-proof-pack' && candidate.version === 1 && !!candidate.runRecord;
};
export const decodeProofPack = (raw) => {
    const parsed = JSON.parse(raw);
    if (!isProofPack(parsed)) {
        throw new Error('Invalid proof pack: missing kind/version/runRecord');
    }
    return parsed;
};
