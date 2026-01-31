// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Canonical stable serialization for RedByte OS.
 *
 * Contract:
 * - Object keys are sorted recursively (alphabetical)
 * - Arrays preserve order (deterministic by design — array order IS the data)
 * - Ephemeral fields (prefixed with `_` or listed in EPHEMERAL_KEYS) are stripped
 * - `undefined` values are stripped (matches JSON.stringify behavior)
 * - Output is identical for identical inputs (hash-stable)
 */

const EPHEMERAL_KEYS = new Set([
  '_dirty',
  '_ephemeral',
  '_cached',
  '_transient',
  '_lastRenderTime',
]);

function isEphemeral(key: string): boolean {
  return key.startsWith('_') || EPHEMERAL_KEYS.has(key);
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (isEphemeral(key)) continue;
    const v = obj[key];
    if (v === undefined) continue;
    result[key] = canonicalize(v);
  }
  return result;
}

/**
 * Deterministic JSON serialization. Same input always produces identical output.
 * Strips ephemeral fields (prefixed with `_`) for clean hashing.
 */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * SHA-256 hash of a stable-serialized value.
 * Returns hex string. Falls back to DJB2 if Web Crypto is unavailable.
 */
export async function stableHash(value: unknown): Promise<string> {
  const json = stableSerialize(value);
  const data = new TextEncoder().encode(json);

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback: DJB2
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) + json.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * SHA-256 hash of raw bytes (for file integrity in evidence manifests).
 */
export async function hashBytes(data: ArrayBuffer): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback: DJB2 on bytes
  const view = new Uint8Array(data);
  let hash = 5381;
  for (let i = 0; i < view.length; i++) {
    hash = ((hash << 5) + hash) + view[i];
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
