import { describe, expect, it, vi } from 'vitest';
const runDeterministicSequence = async () => {
    localStorage.clear();
    window.__RB_AUDIT__ = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2000-01-01T00:00:00.000Z'));
    try {
        const { createFile, updateFile } = await import('../stores/filesStore');
        const { getAuditLog } = await import('../utils/audit');
        const { hashString, stableStringify } = await import('../utils/digest');
        const baseCircuit = { version: 'v1', nodes: [], connections: [] };
        const updatedCircuit = {
            version: 'v1',
            nodes: [
                {
                    id: 'node-1',
                    type: 'INPUT',
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    config: { label: 'A' },
                },
            ],
            connections: [],
        };
        const file = createFile('Audit Demo', baseCircuit, {
            kind: 'source',
            schema_version: 'v1',
            created_by: 'audit-test',
        });
        updateFile(file.id, updatedCircuit, {
            kind: 'source',
            schema_version: 'v1',
            created_by: 'audit-test',
            derived_from: file.id,
        });
        const payload = {
            schema_version: 'audit_v1',
            entries: getAuditLog(),
        };
        return hashString(stableStringify(payload));
    }
    finally {
        vi.useRealTimers();
        delete window.__RB_AUDIT__;
    }
};
describe('audit determinism', () => {
    it('produces identical hashes for identical transitions', async () => {
        const first = await runDeterministicSequence();
        vi.resetModules();
        const second = await runDeterministicSequence();
        expect(first).toBe(second);
    });
});
