// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { buildProofPack, decodeProofPack, encodeProofPack } from '../recording/proofPack';
import { normalizeCircuit, digestCircuit } from '../recording/runRecordUtils';
describe('proof pack', () => {
    it('round-trips proof packs and preserves circuit digest', () => {
        const circuit = {
            nodes: [{ id: 'sw1', type: 'Switch', position: { x: 0, y: 0 } }],
            connections: [],
        };
        const record = {
            version: 2,
            createdAt: new Date().toISOString(),
            appVersion: 'test',
            circuitSnapshot: circuit,
            circuitSummary: { nodeCount: 1, connectionCount: 0, nodeIds: ['sw1'] },
            circuitDigest: digestCircuit(circuit),
            engineConfig: { tickRate: 10 },
            stimulus: [],
            probes: [],
            trace: [],
            summary: { tickCount: 0, startTick: 0, durationTicks: 0, missingNodes: [] },
        };
        const pack = buildProofPack(record, circuit, { appVersion: 'test' });
        const encoded = encodeProofPack(pack);
        const decoded = decodeProofPack(encoded);
        expect(decoded.runRecord.circuitDigest).toBe(record.circuitDigest);
        expect(decoded.normalizedCircuit).toEqual(normalizeCircuit(circuit));
    });
});
