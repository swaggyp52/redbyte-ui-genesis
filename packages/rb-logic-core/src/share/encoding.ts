/**
 * Circuit encoding utilities for shareable links
 * Serializes circuits to URL-safe base64 strings
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
 * Uses JSON + compression (stub for pako)
 */
export function encodeCircuit(circuit: Circuit): string {
  try {
    const json = JSON.stringify(circuit);
    // TODO: Add pako.deflate compression for smaller URLs
    const base64 = btoa(json);
    // Make URL-safe: replace + with -, / with _, remove =
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    throw new Error(`Failed to encode circuit: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decode a URL-safe base64 string to a circuit
 */
export function decodeCircuit(encoded: string): Circuit {
  try {
    // Restore standard base64: - to +, _ to /
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = atob(base64);
    // TODO: Add pako.inflate decompression
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Failed to decode circuit: ${error instanceof Error ? error.message : String(error)}`);
  }
}
