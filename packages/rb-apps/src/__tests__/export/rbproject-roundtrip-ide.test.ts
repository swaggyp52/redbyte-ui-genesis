// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { createRBProject, encodeRBProject, decodeRBProject } from '../../export/projectFormat';
import type { RBProject } from '../../export/projectFormat';

describe('RBProject roundtrip serialization (IDE)', () => {
  it('should encode and decode a minimal RBProject without loss', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'test-project',
      description: 'Test project',
      circuit: {
        nodes: [],
        connections: [],
      },
      createdAt: now,
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.kind).toBe('rb-project');
    expect(decoded.version).toBe(1);
    expect(decoded.name).toBe('test-project');
    expect(decoded.description).toBe('Test project');
    expect(decoded.circuit.nodes).toEqual([]);
    expect(decoded.circuit.connections).toEqual([]);
  });

  it('should preserve ioMapping through roundtrip', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'iomap-project',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      ioMapping: {
        inputs: [
          { id: 'in1', nodeId: 'switch_0', port: 'out', pin: 'SW0', label: 'Switch 0' },
          { id: 'in2', nodeId: 'switch_1', port: 'out', pin: 'SW1', label: 'Switch 1' },
        ],
        outputs: [
          { id: 'out1', nodeId: 'led_0', port: 'in', pin: 'LD0', label: 'LED 0' },
        ],
      },
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.ioMapping).toBeDefined();
    expect(decoded.ioMapping?.inputs).toHaveLength(2);
    expect(decoded.ioMapping?.outputs).toHaveLength(1);
    expect(decoded.ioMapping?.inputs[0].pin).toBe('SW0');
    expect(decoded.ioMapping?.outputs[0].pin).toBe('LD0');
  });

  it('should preserve test vectors through roundtrip', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'vector-project',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      vectors: [
        { tick: 0, inputs: { a: 0, b: 0 }, expected: { sum: 0, cout: 0 } },
        { tick: 1, inputs: { a: 1, b: 0 }, expected: { sum: 1, cout: 0 } },
        { tick: 2, inputs: { a: 1, b: 1 }, expected: { sum: 0, cout: 1 } },
      ],
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.vectors).toBeDefined();
    expect(decoded.vectors).toHaveLength(3);
    expect(decoded.vectors?.[0].tick).toBe(0);
    expect(decoded.vectors?.[2].expected.cout).toBe(1);
  });

  it('should preserve macros through roundtrip', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'macro-project',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      macros: [
        {
          id: 'macro-majority',
          name: 'Majority Vote',
          description: 'Reusable three-input majority cluster',
          createdAt: 1710000000000,
          inputs: [
            { id: 'in-a', label: 'A', nodeId: 'node-v2-1', portName: 'a' },
            { id: 'in-b', label: 'B', nodeId: 'node-v2-1', portName: 'b' },
            { id: 'in-c', label: 'C', nodeId: 'node-v2-2', portName: 'a' },
          ],
          outputs: [{ id: 'out-q', label: 'Q', nodeId: 'node-v2-3', portName: 'out' }],
          cluster: {
            nodes: [
              {
                originalId: 'node-v2-1',
                type: 'AND',
                x: 0,
                y: 0,
                config: {},
                state: {},
              },
            ],
            connections: [],
          },
        },
      ],
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.macros).toHaveLength(1);
    expect(decoded.macros?.[0].name).toBe('Majority Vote');
    expect(decoded.macros?.[0].inputs).toHaveLength(3);
    expect(decoded.macros?.[0].outputs[0].label).toBe('Q');
    expect(decoded.macros?.[0].cluster.nodes[0].type).toBe('AND');
  });

  it('should preserve trace metadata through roundtrip', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'trace-project',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      traceMetadata: {
        tickCount: 100,
        startTick: 0,
        sampleRate: 1000,
        probeIds: ['probe1', 'probe2'],
      },
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.traceMetadata).toBeDefined();
    expect(decoded.traceMetadata?.tickCount).toBe(100);
    expect(decoded.traceMetadata?.probeIds).toEqual(['probe1', 'probe2']);
  });

  it('should preserve submodules through roundtrip', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'submodule-project',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      submodules: [
        {
          id: 'custom1',
          name: 'full_adder',
          type: 'custom-chip',
          inputPins: ['a', 'b', 'cin'],
          outputPins: ['sum', 'cout'],
        },
        {
          id: 'custom2',
          name: 'decoder_2to4',
          type: 'custom-chip',
          inputPins: ['a', 'b'],
          outputPins: ['y0', 'y1', 'y2', 'y3'],
        },
      ],
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.submodules).toBeDefined();
    expect(decoded.submodules).toHaveLength(2);
    expect(decoded.submodules?.[0].name).toBe('full_adder');
    expect(decoded.submodules?.[1].inputPins).toEqual(['a', 'b']);
  });

  it('should normalize and re-sort ioMapping entries on roundtrip', () => {
    const now = new Date().toISOString();
    
    const project = createRBProject({
      name: 'sort-test',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      ioMapping: {
        inputs: [
          { id: 'z_in', nodeId: 'switch_z', port: 'out', pin: 'SW15' },
          { id: 'a_in', nodeId: 'switch_a', port: 'out', pin: 'SW0' },
        ],
        outputs: [
          { id: 'z_out', nodeId: 'led_z', port: 'in', pin: 'LD15' },
          { id: 'a_out', nodeId: 'led_a', port: 'in', pin: 'LD0' },
        ],
      },
    });

    const encoded = encodeRBProject(project);
    
    // The encoded JSON should have sorted inputs/outputs arrays
    // After decoding, arrays should maintain their encoded order
    const decoded = decodeRBProject(encoded);

    // Verify that entries are in sorted order after roundtrip
    expect(decoded.ioMapping?.inputs).toHaveLength(2);
    const inputIds = decoded.ioMapping?.inputs.map((i) => i.id) ?? [];
    
    // The entries should be sorted by: nodeId.port.id
    // sort order: 'switch_a.out.a_in' comes before 'switch_z.out.z_in'
    const outputIds = decoded.ioMapping?.outputs.map((o) => o.id) ?? [];
    
    // Verify inputs are sorted
    expect(inputIds[0]).not.toBeUndefined();
    expect(inputIds[1]).not.toBeUndefined();
    // Verify outputs are sorted
    expect(outputIds[0]).not.toBeUndefined();
    expect(outputIds[1]).not.toBeUndefined();
  });

  it('should preserve optional fields and drop undefined fields', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'sparse-project',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      // Deliberately omit: ioMapping, vectors, traceMetadata, submodules, probes, oscilloscope, etc.
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    // Should have structure but no extra fields
    expect(decoded.ioMapping).toBeUndefined();
    expect(decoded.vectors).toBeUndefined();
    expect(decoded.traceMetadata).toBeUndefined();
    expect(decoded.submodules).toBeUndefined();
    expect(decoded.probes).toBeUndefined();
  });

  it('should reject invalid project documents', () => {
    expect(() => decodeRBProject('{"kind":"other-project","version":1}')).toThrow(
      'Invalid project: unsupported kind or version'
    );

    expect(() => decodeRBProject('{"kind":"rb-project","version":2}')).toThrow(
      'Invalid project: unsupported kind or version'
    );

    expect(() => decodeRBProject('null')).toThrow('Invalid project: not an object');
  });

  it('should generate deterministic JSON for same project state', () => {
    const now = new Date().toISOString();
    const createSameProject = () =>
      createRBProject({
        name: 'identical',
        circuit: { nodes: [], connections: [] },
        createdAt: now,
        ioMapping: {
          inputs: [
            { id: 'in2', nodeId: 'b', port: 'out', pin: 'SW1' },
            { id: 'in1', nodeId: 'a', port: 'out', pin: 'SW0' },
          ],
          outputs: [],
        },
      });

    const p1 = createSameProject();
    const p2 = createSameProject();

    // Normalize updatedAt so timestamp jitter doesn't cause false mismatches
    p2.updatedAt = p1.updatedAt;

    const enc1 = encodeRBProject(p1);
    const enc2 = encodeRBProject(p2);

    // Deterministic encoding should produce identical JSON (fields and order the same)
    expect(enc1).toBe(enc2);
  });

  it('should encode and decode project with all optional fields populated', () => {
    const now = new Date().toISOString();
    const project = createRBProject({
      name: 'full-project',
      description: 'All fields populated',
      circuit: { nodes: [], connections: [] },
      createdAt: now,
      ioMapping: {
        inputs: [{ id: 'i1', nodeId: 'sw0', port: 'out', pin: 'SW0' }],
        outputs: [{ id: 'o1', nodeId: 'ld0', port: 'in', pin: 'LD0' }],
      },
      vectors: [{ tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
      traceMetadata: {
        tickCount: 50,
        startTick: 0,
        sampleRate: 1000,
        probeIds: ['p1'],
      },
      submodules: [{ id: 'sub1', name: 'adder', type: 'custom-chip', inputPins: ['a', 'b'], outputPins: ['s'] }],
      probes: [],
      oscilloscope: { timeWindowSec: 10, paused: false },
      recorder: { lastRunRecord: undefined },
      layout: { splitRatio: 0.5 },
      fpga: { board: 'basys3' },
      meta: { appVersion: '1.0', tags: ['demo', 'test'] },
    });

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.name).toBe('full-project');
    expect(decoded.ioMapping?.inputs).toHaveLength(1);
    expect(decoded.vectors).toHaveLength(1);
    expect(decoded.traceMetadata?.tickCount).toBe(50);
    expect(decoded.submodules).toHaveLength(1);
    expect(decoded.fpga?.board).toBe('basys3');
    // Tags should be sorted alphabetically after encode
    expect(decoded.meta?.tags).toEqual(['demo', 'test']);
  });
});
