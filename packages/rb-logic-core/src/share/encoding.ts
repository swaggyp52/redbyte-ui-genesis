// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import pako from 'pako';

/**
 * Circuit encoding utilities for shareable links
 * Serializes circuits to URL-safe base64 strings with compression
 */

export interface Circuit {
  gates: any[];
  wires: any[];
  inputs: any[];
  outputs: any[];
  metadata?: Record<string, any>;
}

/**
 * Encode a circuit to a URL-safe base64 string
 * Uses JSON + pako.deflate compression for smaller URLs
 */
export function encodeCircuit(circuit: Circuit): string {
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
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    throw new Error(`Failed to encode circuit: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decode a URL-safe base64 string to a circuit
 * Supports both compressed (pako.inflate) and legacy uncompressed formats
 */
export function decodeCircuit(encoded: string): Circuit {
  try {
    // Restore standard base64: - to +, _ to /
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (base64.length % 4) {
      base64 += '=';
    }
    const binaryString = atob(base64);

    // Try decompression first (new format)
    try {
      const compressed = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        compressed[i] = binaryString.charCodeAt(i);
      }
      const decompressed = pako.inflate(compressed, { to: 'string' });
      return JSON.parse(decompressed);
    } catch {
      // Fallback to uncompressed (legacy format for backward compatibility)
      return JSON.parse(binaryString);
    }
  } catch (error) {
    throw new Error(`Failed to decode circuit: ${error instanceof Error ? error.message : String(error)}`);
  }
}
