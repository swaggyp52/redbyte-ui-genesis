// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { EvidenceBundle } from '../evidenceSchema';
import { stableStringify } from '../export/stableStringify';
import { fnv1a32 } from './fnv1a32';
import { downloadBlob } from './bundleExport';

// Build the evidence bundle (excluding integrity)
export function buildEvidenceBundle({
    circuitSnapshot,
    simulationSnapshot,
    probesSnapshot,
    oscilloscopeSnapshot,
    context,
    app
}: Omit<EvidenceBundle, 'schemaVersion' | 'exportedAtIso' | 'integrity'>): Omit<EvidenceBundle, 'integrity'> {
    return {
        schemaVersion: '1.0',
        exportedAtIso: new Date().toISOString(),
        app,
        context,
        circuitSnapshot,
        simulationSnapshot,
        probesSnapshot,
        oscilloscopeSnapshot
    };
}

// Canonicalize evidence bundle (stable key ordering)
export function canonicalizeEvidence(bundle: Omit<EvidenceBundle, 'integrity'>): string {
    return stableStringify(bundle);
}

// FNV-1a 32-bit hash of canonical JSON
export function hashEvidence(canonicalJson: string): { hash: string; bytes: number } {
    const hash = fnv1a32(canonicalJson);
    return { hash, bytes: canonicalJson.length };
}

// Export evidence: build, canonicalize, hash, finalize, download
export async function exportEvidence(bundle: Omit<EvidenceBundle, 'integrity'>) {
    const canonicalJson = canonicalizeEvidence(bundle);
    const { hash, bytes } = hashEvidence(canonicalJson);
    const evidence: EvidenceBundle = {
        ...bundle,
        integrity: {
            hashAlg: 'fnv1a32',
            integrityHash: hash,
            hashedBytes: bytes
        }
    };
    const finalJson = stableStringify(evidence);
    const filename = `lab-evidence-${bundle.exportedAtIso.replace(/[:.]/g, '').replace(/[-T]/g, '').slice(0,15)}.json`;
    downloadBlob(new Blob([finalJson], { type: 'application/json' }), filename);
}
