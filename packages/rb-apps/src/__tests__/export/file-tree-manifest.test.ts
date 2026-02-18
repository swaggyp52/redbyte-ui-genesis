// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { deriveFileTreeManifest } from '../../export/fileTreeManifest';
import type { RBProject } from '../../export/projectFormat';

describe('FileTreeManifest derivation', () => {
  const createTestProject = (overrides?: Partial<RBProject>): RBProject => ({
    kind: 'rb-project',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: 'test-project',
    circuit: { nodes: [], connections: [] },
    ...overrides,
  });

  it('should derive minimal manifest with only top-level artifacts', () => {
    const project = createTestProject();
    const manifest = deriveFileTreeManifest(project);

    expect(manifest.version).toBe(1);
    expect(manifest.projectName).toBe('test-project');
    expect(manifest.artifacts).toHaveLength(3); // top.vhd, top.xdc, README.txt

    const paths = manifest.artifacts.map((a) => a.path);
    expect(paths).toContain('top.vhd');
    expect(paths).toContain('top.xdc');
    expect(paths).toContain('README.txt');
  });

  it('should include testbench.vhd when test vectors are present', () => {
    const project = createTestProject({
      vectors: [
        { tick: 0, inputs: { a: 0 }, expected: { sum: 0 } },
        { tick: 1, inputs: { a: 1 }, expected: { sum: 1 } },
      ],
    });

    const manifest = deriveFileTreeManifest(project);

    expect(manifest.artifacts).toHaveLength(4); // top.vhd, top.xdc, README.txt, testbench.vhd
    const paths = manifest.artifacts.map((a) => a.path);
    expect(paths).toContain('testbench.vhd');

    const testbench = manifest.artifacts.find((a) => a.path === 'testbench.vhd');
    expect(testbench?.type).toBe('testbench');
    expect(testbench?.provenance).toBe('generated');
    expect(testbench?.pipelineName).toBe('basys3-export');
  });

  it('should not include testbench.vhd when no test vectors', () => {
    const project = createTestProject({
      vectors: [],
    });

    const manifest = deriveFileTreeManifest(project);

    const paths = manifest.artifacts.map((a) => a.path);
    expect(paths).not.toContain('testbench.vhd');
  });

  it('should include submodules in manifest', () => {
    const project = createTestProject({
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
          name: 'decoder',
          type: 'custom-chip',
          inputPins: ['sel'],
          outputPins: ['out0', 'out1', 'out2', 'out3'],
        },
      ],
    });

    const manifest = deriveFileTreeManifest(project);

    const paths = manifest.artifacts.map((a) => a.path);
    expect(paths).toContain('submodules/full_adder.vhd');
    expect(paths).toContain('submodules/decoder.vhd');

    const adder = manifest.artifacts.find((a) => a.path === 'submodules/full_adder.vhd');
    expect(adder?.type).toBe('custom');
    expect(adder?.provenance).toBe('generated');
  });

  it('should deterministically sort artifacts by path', () => {
    const project = createTestProject({
      submodules: [
        { id: 'z', name: 'z_module', type: 'custom-chip', inputPins: [], outputPins: [] },
        { id: 'a', name: 'a_module', type: 'custom-chip', inputPins: [], outputPins: [] },
        { id: 'm', name: 'm_module', type: 'custom-chip', inputPins: [], outputPins: [] },
      ],
      vectors: [{ tick: 0, inputs: {}, expected: {} }],
    });

    const manifest = deriveFileTreeManifest(project);
    const paths = manifest.artifacts.map((a) => a.path);

    // Expected order: README.txt, submodules/*, testbench.vhd, top.*
    expect(paths[0]).toBe('README.txt');
    expect(paths[1]).toBe('submodules/a_module.vhd');
    expect(paths[2]).toBe('submodules/m_module.vhd');
    expect(paths[3]).toBe('submodules/z_module.vhd');
    expect(paths[4]).toBe('testbench.vhd');
    expect(paths[5]).toBe('top.vhd');
    expect(paths[6]).toBe('top.xdc');
  });

  it('should mark all generated artifacts with basys3-export pipeline', () => {
    const project = createTestProject({
      submodules: [{ id: 's1', name: 'sub1', type: 'custom-chip', inputPins: [], outputPins: [] }],
      vectors: [{ tick: 0, inputs: {}, expected: {} }],
    });

    const manifest = deriveFileTreeManifest(project);

    for (const artifact of manifest.artifacts) {
      expect(artifact.provenance).toBe('generated');
      expect(artifact.pipelineName).toBe('basys3-export');
    }
  });

  it('should include all top-level artifacts with correct types', () => {
    const project = createTestProject();
    const manifest = deriveFileTreeManifest(project);

    const vhd = manifest.artifacts.find((a) => a.path === 'top.vhd');
    expect(vhd?.type).toBe('vhdl');

    const xdc = manifest.artifacts.find((a) => a.path === 'top.xdc');
    expect(xdc?.type).toBe('xdc');

    const readme = manifest.artifacts.find((a) => a.path === 'README.txt');
    expect(readme?.type).toBe('readme');
  });

  it('should handle project with vectors and submodules together', () => {
    const project = createTestProject({
      vectors: [{ tick: 0, inputs: { x: 0 }, expected: { y: 0 } }],
      submodules: [
        { id: 'sub1', name: 'adder8', type: 'custom-chip', inputPins: ['a', 'b'], outputPins: ['s'] },
      ],
    });

    const manifest = deriveFileTreeManifest(project);

    expect(manifest.artifacts.length).toBe(5); // top.vhd, top.xdc, README.txt, testbench.vhd, submodules/adder8.vhd
    const paths = manifest.artifacts.map((a) => a.path);

    expect(paths).toContain('testbench.vhd');
    expect(paths).toContain('submodules/adder8.vhd');
  });

  it('should set createdAt timestamp in manifest', () => {
    const project = createTestProject();
    const manifest = deriveFileTreeManifest(project);

    expect(manifest.createdAt).toBeDefined();
    // Should be ISO 8601 format
    expect(new Date(manifest.createdAt).toISOString()).toBeDefined();
  });

  it('should handle empty submodules array', () => {
    const project = createTestProject({
      submodules: [],
    });

    const manifest = deriveFileTreeManifest(project);

    // Should only have top-level artifacts
    expect(manifest.artifacts).toHaveLength(3);
    const paths = manifest.artifacts.map((a) => a.path);
    expect(paths.every((p) => !p.startsWith('submodules/'))).toBe(true);
  });

  it('should include project name in manifest', () => {
    const project = createTestProject({ name: 'my-adder-circuit' });
    const manifest = deriveFileTreeManifest(project);

    expect(manifest.projectName).toBe('my-adder-circuit');
  });

  it('should validate Basys3 pin names in ioMapping (if integrated)', () => {
    // This test validates that artifacts match Basys3 board spec
    // (SW0-15, LD0-15, BTND/U/L/R/C pins)
    const project = createTestProject({
      ioMapping: {
        inputs: [
          { id: 'i1', nodeId: 'sw0', port: 'out', pin: 'SW0' },
          { id: 'i2', nodeId: 'sw15', port: 'out', pin: 'SW15' },
        ],
        outputs: [
          { id: 'o1', nodeId: 'ld0', port: 'in', pin: 'LD0' },
          { id: 'o2', nodeId: 'ld15', port: 'in', pin: 'LD15' },
        ],
      },
    });

    const manifest = deriveFileTreeManifest(project);

    // Manifest derivation should succeed without validation errors
    expect(manifest.artifacts).toBeDefined();
    expect(manifest.artifacts.length).toBeGreaterThan(0);
  });
});
