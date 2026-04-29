/**
 * Recursively sort object keys to ensure deterministic JSON serialization.
 */
export function canonicalizeEvidence(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeEvidence);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalizeEvidence(obj[key]);
  }
  return result;
}

/**
 * Generate a SHA-256 hash of the evidence object for integrity checks.
 * Falls back to DJB2 if Web Crypto API is unavailable.
 */
export async function hashEvidenceAsync(
  evidence: any
): Promise<{ hash: string; hashedBytes: number; hashAlg: string }> {
  const json = JSON.stringify(evidence);
  const hashedBytes = new TextEncoder().encode(json).byteLength;
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const data = new TextEncoder().encode(json);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(buffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { hash: hex, hashedBytes, hashAlg: 'sha256' };
  }

  return hashEvidence(evidence);
}

/**
 * Synchronous DJB2 hash fallback for non-async contexts.
 */
export function hashEvidence(
  evidence: any
): { hash: string; hashedBytes: number; hashAlg: string } {
  const json = JSON.stringify(evidence);
  const hashedBytes = new TextEncoder().encode(json).byteLength;
  let hash = 5381;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash << 5) + hash + json.charCodeAt(i);
  }
  return { hash: (hash >>> 0).toString(16), hashedBytes, hashAlg: 'djb2' };
}
