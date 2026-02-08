import { verifyEvidenceBundle } from '../verifyEvidence';
import { canonicalizeEvidence, hashEvidence } from '../evidenceExport';
describe('Evidence Verification', () => {
    const validEvidence = {
        schemaVersion: '1.0',
        exportedAtIso: '2026-01-22T12:00:00.000Z',
        app: {},
        context: {},
        circuitSnapshot: {},
        simulationSnapshot: { isRunning: false, tick: 0 },
        probesSnapshot: [],
        oscilloscopeSnapshot: { settings: {}, traces: {} },
        integrity: { hashAlg: 'fnv1a32', integrityHash: '', hashedBytes: 0 },
    };
    it('passes verification for valid evidence', () => {
        // Compute correct hash
        const { integrity, ...withoutIntegrity } = validEvidence;
        const canonical = canonicalizeEvidence(withoutIntegrity);
        const { hash, bytes } = hashEvidence(canonical);
        validEvidence.integrity.integrityHash = hash;
        validEvidence.integrity.hashedBytes = bytes;
        expect(verifyEvidenceBundle(validEvidence).status).toBe('PASS');
    });
    it('fails verification for tampered evidence', () => {
        const { integrity, ...withoutIntegrity } = validEvidence;
        const canonical = canonicalizeEvidence(withoutIntegrity);
        const { hash, bytes } = hashEvidence(canonical);
        const seeded = {
            ...validEvidence,
            integrity: { ...validEvidence.integrity, integrityHash: hash, hashedBytes: bytes },
        };
        const tampered = { ...seeded, app: { version: 'tampered' } };
        expect(verifyEvidenceBundle(tampered).status).toBe('FAIL');
    });
    it('errors for unsupported schemaVersion', () => {
        const unsupported = { ...validEvidence, schemaVersion: '0.9' };
        expect(verifyEvidenceBundle(unsupported).status).toBe('ERROR');
    });
});
