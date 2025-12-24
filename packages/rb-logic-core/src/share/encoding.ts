// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Circuit encoding utilities for shareable links
 * Serializes circuits to URL-safe base64 strings
 *
 * This module provides the legacy uncompressed format.
 * For compressed encoding, use encoding.compressed.ts (lazy-loaded to reduce bundle size)
 */

export interface Circuit {
  gates: any[];
  wires: any[];
  inputs: any[];
  outputs: any[];
  metadata?: Record<string, any>;
}

/**
 * Encode a circuit to a URL-safe base64 string (legacy uncompressed format)
 * For compressed encoding, use encoding.compressed.ts (lazy-loaded)
 */
export function encodeCircuit(circuit: Circuit): string {
  try {
    const json = JSON.stringify(circuit);
    const base64 = btoa(json);
    // Make URL-safe: replace + with -, / with _, remove =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    throw new Error(`Failed to encode circuit: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decode a URL-safe base64 string to a circuit
 *
 * Format detection:
 * - If starts with "c1:", uses compressed format (lazy-loads pako)
 * - Otherwise, uses legacy uncompressed format
 *
 * Returns a Promise to support dynamic import of compression module
 */
export async function decodeCircuit(encoded: string): Promise<Circuit> {
  // Check for compressed format prefix
  if (encoded.startsWith('c1:')) {
    // Lazy-load compressed decoder (pako is in this chunk, not main bundle)
    const { decodeCircuitCompressed } = await import('./encoding.compressed');
    return decodeCircuitCompressed(encoded);
  }

  // Legacy uncompressed format
  try {
    // Restore standard base64: - to +, _ to /
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = atob(base64);
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Failed to decode circuit: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if an encoded string uses compressed format
 * Useful for detecting format without loading compression module
 */
export function isCompressedFormat(encoded: string): boolean {
  return encoded.startsWith('c1:');
}
