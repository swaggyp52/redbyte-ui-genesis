// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import pako from 'pako';
import type { Circuit } from './encoding';

/**
 * Compressed circuit encoding using pako.deflate
 * Lazy-loaded to avoid bloating initial bundle
 *
 * Format: "c1:" + base64url(deflateRaw(json))
 * Version prefix allows detection and future format evolution
 */

const FORMAT_VERSION = 'c1:';

/**
 * Encode a circuit to a compressed, versioned, URL-safe string
 * Uses deflate (zlib) compression via pako for smaller share URLs
 */
export function encodeCircuitCompressed(circuit: Circuit): string {
  try {
    const json = JSON.stringify(circuit);
    // Compress with pako.deflate
    const compressed = pako.deflate(json);
    // Convert Uint8Array to binary string
    const binaryString = Array.from(compressed)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    const base64 = btoa(binaryString);
    // Make URL-safe: replace + with -, / with _, remove =
    const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return FORMAT_VERSION + urlSafe;
  } catch (error) {
    throw new Error(`Failed to encode circuit (compressed): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decode a compressed circuit string (must start with "c1:")
 * Throws if prefix is missing (caller should check prefix before calling)
 */
export function decodeCircuitCompressed(encoded: string): Circuit {
  if (!encoded.startsWith(FORMAT_VERSION)) {
    throw new Error('Invalid compressed format: missing c1: prefix');
  }

  try {
    const payload = encoded.slice(FORMAT_VERSION.length);
    // Restore standard base64: - to +, _ to /
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (base64.length % 4) {
      base64 += '=';
    }
    const binaryString = atob(base64);

    // Convert binary string to Uint8Array
    const compressed = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressed[i] = binaryString.charCodeAt(i);
    }

    // Decompress
    const decompressed = pako.inflate(compressed, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    throw new Error(`Failed to decode circuit (compressed): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if an encoded string uses compressed format
 */
export function isCompressedFormat(encoded: string): boolean {
  return encoded.startsWith(FORMAT_VERSION);
}
