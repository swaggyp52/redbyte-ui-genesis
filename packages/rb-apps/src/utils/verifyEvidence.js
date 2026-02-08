import { canonicalizeEvidence, hashEvidence } from '../utils/evidenceExport';
export function verifyEvidenceBundle(bundle) {
    if (!bundle.schemaVersion || bundle.schemaVersion !== '1.0') {
        return { status: 'ERROR', errorMessage: 'Unsupported schemaVersion' };
    }
    if (!bundle.integrity || !bundle.integrity.integrityHash) {
        return { status: 'UNVERIFIED', errorMessage: 'Missing integrity hash' };
    }
    // Remove integrity for canonicalization
    const { integrity, ...withoutIntegrity } = bundle;
    const canonical = canonicalizeEvidence(withoutIntegrity);
    const { hash } = hashEvidence(canonical);
    if (hash === bundle.integrity.integrityHash) {
        return { status: 'PASS' };
    }
    else {
        return { status: 'FAIL', errorMessage: 'Integrity hash mismatch' };
    }
}
