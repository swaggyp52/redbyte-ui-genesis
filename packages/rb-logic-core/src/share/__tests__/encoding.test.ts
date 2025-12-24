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

  it('compresses large circuits effectively', () => {
    // Create a large circuit with repetitive data
    const largeCircuit: Circuit = {
      gates: Array.from({ length: 100 }, (_, i) => ({
        id: `gate${i}`,
        type: 'AND',
        position: { x: i * 50, y: i * 50 },
      })),
      wires: Array.from({ length: 99 }, (_, i) => ({
        from: `gate${i}:out`,
        to: `gate${i + 1}:in0`,
      })),
      inputs: [{ id: 'in1', position: { x: 0, y: 0 } }],
      outputs: [{ id: 'out1', position: { x: 5000, y: 5000 } }],
      metadata: {
        name: 'Large Circuit',
        description: 'A circuit with many repeated structures',
      },
    };

    const json = JSON.stringify(largeCircuit);
    const jsonBase64 = btoa(json);
    const encoded = encodeCircuit(largeCircuit);

    // Compressed version should be significantly smaller than uncompressed
    expect(encoded.length).toBeLessThan(jsonBase64.length);
    // But should still decode correctly
    const decoded = decodeCircuit(encoded);
    expect(decoded).toEqual(largeCircuit);
  });

  it('decodes legacy uncompressed circuits (backward compatibility)', () => {
    // Encode a circuit using old uncompressed format
    const legacyCircuit: Circuit = {
      gates: [{ id: 'gate1', type: 'NOT', position: { x: 50, y: 50 } }],
      wires: [],
      inputs: [{ id: 'in1', position: { x: 0, y: 50 } }],
      outputs: [{ id: 'out1', position: { x: 100, y: 50 } }],
    };

    const json = JSON.stringify(legacyCircuit);
    const base64 = btoa(json);
    const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // Should decode legacy format successfully
    const decoded = decodeCircuit(urlSafe);
    expect(decoded).toEqual(legacyCircuit);
  });
});
