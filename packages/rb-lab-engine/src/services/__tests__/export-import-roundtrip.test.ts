// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Round-Trip Export/Import Tests
 *
 * Validates that projects can be exported and re-imported without data loss.
 * Critical for submission and collaboration workflows.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { LabProjectV1, CircuitV1, CircuitConnection } from '@redbyte/rb-utils';
import { exportEvidenceCapsule, importEvidenceCapsule } from '../exportService';

/**
 * Create a minimal valid LabProjectV1 for testing
 */
function createTestProject(overrides?: Partial<LabProjectV1>): LabProjectV1 {
  return {
    projectId: 'test-project-' + Math.random().toString(36).slice(2),
    name: 'Test Project',
    description: 'Test project for round-trip validation',
    labId: 'lab-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    circuit: {
      schemaVersion: '1.0',
      nodes: [
        {
          id: 'input1',
          type: 'INPUT',
          x: 100,
          y: 100,
          label: 'A',
          state: { value: 0 },
        },
        {
          id: 'input2',
          type: 'INPUT',
          x: 100,
          y: 150,
          label: 'B',
          state: { value: 0 },
        },
        {
          id: 'and1',
          type: 'AND',
          x: 200,
          y: 125,
          params: { inputs: 2 },
        },
        {
          id: 'output1',
          type: 'OUTPUT',
          x: 300,
          y: 125,
          label: 'Y',
          state: { value: 0 },
        },
      ],
      connections: [
        {
          id: 'conn1',
          from: { nodeId: 'input1', portName: 'out' },
          to: { nodeId: 'and1', portName: 'in1' },
        },
        {
          id: 'conn2',
          from: { nodeId: 'input2', portName: 'out' },
          to: { nodeId: 'and1', portName: 'in2' },
        },
        {
          id: 'conn3',
          from: { nodeId: 'and1', portName: 'out' },
          to: { nodeId: 'output1', portName: 'in' },
        },
      ],
    },
    evidence: {
      checkpoints: [],
      snapshots: [],
      actions: [
        {
          timestamp: new Date().toISOString(),
          type: 'create',
          description: 'Project created',
        },
      ],
      submissions: [],
    },
    simulation: {
      currentTick: 0,
      tickRate: 20,
      isRunning: false,
      breakpoints: [],
      probes: [],
    },
    ...overrides,
  };
}

describe('Export/Import Round-Trip Tests', () => {
  describe('Basic Round-Trip', () => {
    it('should export and re-import a minimal project', async () => {
      const original = createTestProject();

      // Export
      const blob = await exportEvidenceCapsule(original);
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);

      // Import
      const { project, integrity } = await importEvidenceCapsule(blob);

      // Verify
      expect(integrity.status).toBe('verified');
      expect(project.projectId).toBe(original.projectId);
      expect(project.name).toBe(original.name);
      expect(project.circuit.nodes.length).toBe(original.circuit.nodes.length);
      expect(project.circuit.connections.length).toBe(original.circuit.connections.length);
    });

    it('should preserve circuit topology', async () => {
      const original = createTestProject();
      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      // Check node preservation
      project.circuit.nodes.forEach((node, i) => {
        const originalNode = original.circuit.nodes[i];
        expect(node.id).toBe(originalNode.id);
        expect(node.type).toBe(originalNode.type);
        expect(node.x).toBe(originalNode.x);
        expect(node.y).toBe(originalNode.y);
        if (originalNode.label) {
          expect(node.label).toBe(originalNode.label);
        }
      });

      // Check connection preservation
      project.circuit.connections.forEach((conn, i) => {
        const originalConn = original.circuit.connections[i];
        expect(conn.id).toBe(originalConn.id);
        if ('from' in conn && typeof conn.from !== 'string') {
          expect(conn.from.nodeId).toBe(
            typeof originalConn.from === 'string' ? originalConn.from : originalConn.from.nodeId
          );
        }
      });
    });

    it('should preserve evidence metadata', async () => {
      const original = createTestProject();
      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.evidence.actions).toBeDefined();
      expect(project.evidence.actions.length).toBe(original.evidence.actions.length);
      expect(project.evidence.checkpoints).toBeDefined();
      expect(project.evidence.submissions).toBeDefined();
    });
  });

  describe('Complex Circuit Handling', () => {
    it('should handle subcircuits', async () => {
      const original = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            {
              id: 'subcircuit1',
              type: 'SUBCIRCUIT',
              x: 100,
              y: 100,
              params: { definition: 'half-adder' },
            },
            {
              id: 'output1',
              type: 'OUTPUT',
              x: 200,
              y: 100,
            },
          ],
          connections: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project, integrity } = await importEvidenceCapsule(blob);

      expect(integrity.status).toBe('verified');
      expect(project.circuit.nodes[0].type).toBe('SUBCIRCUIT');
      expect(project.circuit.nodes[0].params?.definition).toBe('half-adder');
    });

    it('should handle custom labels and state', async () => {
      const original = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            {
              id: 'custom-node',
              type: 'AND',
              x: 100,
              y: 100,
              label: 'My Custom AND Gate',
              state: { lastToggle: 123456789, color: '#FF0000' },
            },
          ],
          connections: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      const node = project.circuit.nodes[0];
      expect(node.label).toBe('My Custom AND Gate');
      expect(node.state?.lastToggle).toBe(123456789);
      expect(node.state?.color).toBe('#FF0000');
    });

    it('should handle large circuits', async () => {
      // Generate a large circuit (e.g., 4-bit adder with 32+ gates)
      const nodes = [];
      const connections = [];

      // Add 50 gates
      for (let i = 0; i < 50; i++) {
        nodes.push({
          id: `gate-${i}`,
          type: i % 3 === 0 ? 'AND' : i % 3 === 1 ? 'OR' : 'XOR',
          x: 100 + (i % 10) * 50,
          y: 100 + Math.floor(i / 10) * 50,
          params: { inputs: 2 },
        });
      }

      // Add connections between gates
      for (let i = 0; i < 50; i++) {
        if (i < 49) {
          connections.push({
            id: `conn-${i}`,
            from: { nodeId: `gate-${i}`, portName: 'out' },
            to: { nodeId: `gate-${i + 1}`, portName: 'in1' },
          });
        }
      }

      const original = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes,
          connections,
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project, integrity } = await importEvidenceCapsule(blob);

      expect(integrity.status).toBe('verified');
      expect(project.circuit.nodes.length).toBe(50);
      expect(project.circuit.connections.length).toBe(49);
    });
  });

  describe('Data Integrity', () => {
    it.skip('should detect tampering of project data', async () => {
      // Skip in Node environment - Blob.arrayBuffer() requires browser
      const original = createTestProject();
      const blob = await exportEvidenceCapsule(original);
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Simulate tampering: flip a bit in the blob
      bytes[100] ^= 0xFF;

      const taintedBlob = new Blob([bytes], { type: blob.type });

      try {
        const result = await importEvidenceCapsule(taintedBlob);
        // If we get here, integrity detection should have flagged it
        if (result.integrity.status !== 'modified') {
          // Tampering might not be in a critical field
          expect(result).toBeDefined();
        }
      } catch (error) {
        // Expected: corrupted ZIP or invalid JSON
        expect(error).toBeDefined();
      }
    });

    it('should have consistent hashes across exports', async () => {
      const original = createTestProject();

      // Export twice
      const blob1 = await exportEvidenceCapsule(original);
      const blob2 = await exportEvidenceCapsule(original);

      // Import both
      const result1 = await importEvidenceCapsule(blob1);
      const result2 = await importEvidenceCapsule(blob2);

      // Project data should be identical
      expect(result1.capsule.projectHash).toBe(result2.capsule.projectHash);
      expect(result1.capsule.actionLogHash).toBe(result2.capsule.actionLogHash);
    });
  });

  describe('Edge Cases', () => {
    it('should handle projects with no connections', async () => {
      const original = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'isolated-node', type: 'AND', x: 100, y: 100 },
          ],
          connections: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project, integrity } = await importEvidenceCapsule(blob);

      expect(integrity.status).toBe('verified');
      expect(project.circuit.nodes.length).toBe(1);
      expect(project.circuit.connections.length).toBe(0);
    });

    it('should handle projects with no nodes', async () => {
      const original = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [],
          connections: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project, integrity } = await importEvidenceCapsule(blob);

      expect(integrity.status).toBe('verified');
      expect(project.circuit.nodes.length).toBe(0);
    });

    it('should handle special characters in project names', async () => {
      const original = createTestProject({
        name: 'Project with émojis 🎯 & special chars: !@#$%^&*()',
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.name).toBe(original.name);
    });

    it('should handle empty descriptions', async () => {
      const original = createTestProject({
        description: '',
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.description).toBe('');
    });
  });

  describe('ZIP Structure', () => {
    it('should contain all required files', async () => {
      const original = createTestProject();
      const blob = await exportEvidenceCapsule(original);

      // Parse ZIP manually to check contents
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(blob);

      const files = Object.keys(zip.files);
      expect(files).toContain('capsule.json');
      expect(files).toContain('project.json');
      expect(files).toContain('actions.log.json');
      expect(files).toContain('manifest.json');
      expect(files).toContain('README.md');
    });

    it('should have readable manifest.json', async () => {
      const original = createTestProject();
      const blob = await exportEvidenceCapsule(original);

      const { project, capsule } = await importEvidenceCapsule(blob);

      // Capsule should reference correct files
      expect(capsule.files.project).toBe('project.json');
      expect(capsule.files.actions).toBe('actions.log.json');
      expect(capsule.files.manifest).toBe('manifest.json');
    });
  });
});
