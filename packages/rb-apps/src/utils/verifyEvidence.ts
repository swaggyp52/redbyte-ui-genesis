import { EvidenceBundle } from '../evidenceSchema';
import { canonicalizeEvidence, hashEvidence } from './evidenceHash';

export type VerificationStatus = 'PASS' | 'FAIL' | 'UNVERIFIED' | 'ERROR';

export interface VerificationResult {
  status: VerificationStatus;
  errorMessage?: string;
}

export function verifyEvidenceBundle(bundle: EvidenceBundle): VerificationResult {
  if (!bundle.schemaVersion || bundle.schemaVersion !== '1.0') {
    return { status: 'ERROR', errorMessage: 'Unsupported schemaVersion' };
  }
  if (!bundle.integrity || !bundle.integrity.integrityHash) {
    return { status: 'UNVERIFIED', errorMessage: 'Missing integrity hash' };
  }
  // Remove integrity for canonicalization
  const { integrity, ...withoutIntegrity } = bundle;
  const canonical = canonicalizeEvidence(withoutIntegrity as any);
  const { hash } = hashEvidence(canonical);
  if (hash === bundle.integrity.integrityHash) {
    return { status: 'PASS' };
  } else {
    return { status: 'FAIL', errorMessage: 'Integrity hash mismatch' };
  }
}
