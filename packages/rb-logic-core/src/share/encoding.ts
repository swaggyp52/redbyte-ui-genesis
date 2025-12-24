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

// Module-level cache for lazy-loaded compression module
let _compressedModule: typeof import('./encoding.compressed') | null = null;

/**
 * Preload the compressed encoding module
 * Call this during app initialization to avoid async overhead later
 */
export async function preloadCompressedCodec(): Promise<void> {
  if (!_compressedModule) {
    _compressedModule = await import('./encoding.compressed');
  }
}

/**
 * Decode a URL-safe base64 string to a circuit (synchronous, legacy format only)
 *
 * This function only handles legacy uncompressed format.
 * For compressed format (c1: prefix), use decodeCircuitAsync() or preload with preloadCompressedCodec().
 *
 * @throws Error if encoded string uses compressed format (c1:) and module not preloaded
 */
export function decodeCircuit(encoded: string): Circuit {
  // Check for compressed format prefix
  if (encoded.startsWith('c1:')) {
    if (_compressedModule) {
      // Module was preloaded, use it synchronously
      return _compressedModule.decodeCircuitCompressed(encoded);
    }
    throw new Error(
      'Compressed circuit format (c1:) requires async decoding. ' +
      'Use decodeCircuitAsync() or call preloadCompressedCodec() during initialization.'
    );
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
 * Decode a URL-safe base64 string to a circuit (async, supports all formats)
 *
 * Handles both legacy uncompressed format and compressed format (c1: prefix).
 * Automatically lazy-loads compression module if needed.
 *
 * @param encoded - URL-safe base64 encoded circuit string
 * @returns Promise resolving to decoded Circuit
 */
export async function decodeCircuitAsync(encoded: string): Promise<Circuit> {
  // Check for compressed format prefix
  if (encoded.startsWith('c1:')) {
    // Ensure compression module is loaded
    await preloadCompressedCodec();
    return _compressedModule!.decodeCircuitCompressed(encoded);
  }

  // Legacy uncompressed format (reuse sync implementation)
  return decodeCircuit(encoded);
}

/**
 * Encode a circuit to compressed format (async, lazy-loads compression module)
 *
 * This is a convenience wrapper that lazy-loads the compression module.
 * Use this for share/export functionality.
 *
 * @param circuit - Circuit to encode
 * @returns Promise resolving to compressed URL-safe string with c1: prefix
 */
export async function encodeCircuitCompressed(circuit: Circuit): Promise<string> {
  await preloadCompressedCodec();
  return _compressedModule!.encodeCircuitCompressed(circuit);
}

/**
 * Check if an encoded string uses compressed format
 * Useful for detecting format without loading compression module
 */
export function isCompressedFormat(encoded: string): boolean {
  return encoded.startsWith('c1:');
}
