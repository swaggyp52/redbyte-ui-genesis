// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { encodeCircuit, decodeCircuit, type Circuit } from '../encoding';

describe('Circuit Encoding', () => {
  const sampleCircuit: Circuit = {
    gates: [
      { id: 'and1', type: 'AND', position: { x: 100, y: 100 } },
      { id: 'or1', type: 'OR', position: { x: 200, y: 100 } },
    ],
    wires: [
      { from: 'and1:out', to: 'or1:in0' },
    ],
    inputs: [
      { id: 'in1', position: { x: 0, y: 50 } },
      { id: 'in2', position: { x: 0, y: 150 } },
    ],
    outputs: [
      { id: 'out1', position: { x: 300, y: 100 } },
    ],
    metadata: {
      name: 'Test Circuit',
      version: '1.0.0',
    },
  };

  it('encodes circuit to URL-safe string', () => {
    const encoded = encodeCircuit(sampleCircuit);

    expect(encoded).toBeTypeOf('string');
    expect(encoded.length).toBeGreaterThan(0);
    // Should not contain +, /, or =
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('decodes circuit from URL-safe string', () => {
    const encoded = encodeCircuit(sampleCircuit);
    const decoded = decodeCircuit(encoded);

    expect(decoded).toEqual(sampleCircuit);
  });

  it('round-trip encoding preserves data', () => {
    const encoded = encodeCircuit(sampleCircuit);
    const decoded = decodeCircuit(encoded);
    const reEncoded = encodeCircuit(decoded);

    expect(reEncoded).toBe(encoded);
  });

  it('handles empty circuit', () => {
    const emptyCircuit: Circuit = {
      gates: [],
      wires: [],
      inputs: [],
      outputs: [],
    };

    const encoded = encodeCircuit(emptyCircuit);
    const decoded = decodeCircuit(encoded);

    expect(decoded).toEqual(emptyCircuit);
  });

  it('throws error on invalid encoded string', () => {
    expect(() => decodeCircuit('invalid-base64!')).toThrow('Failed to decode circuit');
  });

  it('preserves circuit metadata', () => {
    const encoded = encodeCircuit(sampleCircuit);
    const decoded = decodeCircuit(encoded);

    expect(decoded.metadata?.name).toBe('Test Circuit');
    expect(decoded.metadata?.version).toBe('1.0.0');
  });
});
