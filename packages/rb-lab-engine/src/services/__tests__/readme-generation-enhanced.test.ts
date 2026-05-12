import { describe, it, expect } from 'vitest';
import { generateReadme } from '../readmeGenerator.js';
import type { LabProjectV1, NodeV1, ConnectionV1 } from '../../schema/index.js';

/**
 * Phase 3.4: Human-Readable Export Enhancement Tests
 *
 * Tests for README generation covering:
 * - Project metadata and headers
 * - Circuit statistics and component breakdown
 * - Simulation parameters
 * - Probes and monitoring
 * - Evidence tracking
 */

function createTestProject(overrides?: Partial<LabProjectV1>): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'test-id',
    name: 'Test Project',
    description: 'Test project for README generation',
    createdAt: '2026-02-02T10:00:00Z',
    updatedAt: '2026-02-02T11:00:00Z',
    circuit: {
      schemaVersion: '1.0',
      nodes: [],
      connections: [],
      customChips: [],
    },
    simulation: {
      tickRate: 20,
      currentTick: 0,
      breakpoints: [],
      probes: [],
    },
    evidence: {
      actions: [],
      snapshots: [],
    },
    ...overrides,
  };
}

describe('README Generation (Phase 3.4)', () => {
  describe('Basic README Generation', () => {
    it('should generate README with project header', () => {
      const project = createTestProject({ name: 'My Circuit' });
      const readme = generateReadme(project);

      expect(readme).toContain('# My Circuit');
      expect(readme).toContain('## Project Info');
    });

    it('should include project metadata', () => {
      const project = createTestProject({
        projectId: 'proj-123',
        schemaVersion: '1.0',
      });
      const readme = generateReadme(project);

      expect(readme).toContain('proj-123');
      expect(readme).toContain('1.0');
      expect(readme).toContain('Created');
      expect(readme).toContain('Updated');
    });

    it('should include description when provided', () => {
      const project = createTestProject({
        description: 'This is a test description',
      });
      const readme = generateReadme(project);

      expect(readme).toContain('This is a test description');
    });
  });

  describe('Circuit Statistics', () => {
    it('should report circuit stats', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: 'A1', params: {}, state: {} } as NodeV1,
            { id: 'n2', type: 'or', x: 100, y: 0, rotation: 0, label: 'O1', params: {}, state: {} } as NodeV1,
          ],
          connections: [
            { id: 'c1', fromNodeId: 'n1', fromPin: 'out', toNodeId: 'n2', toPin: 'in1' } as ConnectionV1,
          ],
          customChips: [],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('## Circuit');
      expect(readme).toContain('**Nodes**: 2');
      expect(readme).toContain('**Connections**: 1');
    });

    it('should break down components by type', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1,
            { id: 'n2', type: 'and', x: 100, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1,
            { id: 'n3', type: 'or', x: 200, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1,
          ],
          connections: [],
          customChips: [],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('### Components');
      expect(readme).toContain('and: 2');
      expect(readme).toContain('or: 1');
    });

    it('should report custom chips', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [],
          connections: [],
          customChips: [
            {
              id: 'chip1',
              name: 'Full Adder',
              inputPins: ['a', 'b', 'c'],
              outputPins: ['sum', 'cout'],
              internalCircuit: { schemaVersion: '1.0', nodes: [], connections: [] },
            },
          ],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('### Custom Chips');
      expect(readme).toContain('Full Adder');
      expect(readme).toContain('Inputs: a, b, c');
      expect(readme).toContain('Outputs: sum, cout');
    });
  });

  describe('Simulation Information', () => {
    it('should include simulation parameters', () => {
      const project = createTestProject({
        simulation: {
          tickRate: 50,
          currentTick: 0,
          breakpoints: [],
          probes: [],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('## Simulation');
      expect(readme).toContain('**Tick Rate**: 50 Hz');
      expect(readme).toContain('**Current Tick**: 0');
    });

    it('should include breakpoints when present', () => {
      const project = createTestProject({
        simulation: {
          tickRate: 20,
          currentTick: 0,
          breakpoints: [10, 20, 30],
          probes: [],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('**Breakpoints**: 10, 20, 30');
    });
  });

  describe('Probes and Signals', () => {
    it('should include probes section when present', () => {
      const project = createTestProject({
        simulation: {
          tickRate: 20,
          currentTick: 0,
          breakpoints: [],
          probes: [
            { id: 'p1', label: 'Output A', signal: 'sig_a', color: '#ff0000' },
            { id: 'p2', label: 'Output B', signal: 'sig_b', color: '#00ff00' },
          ],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('### Probes');
      expect(readme).toContain('Output A');
      expect(readme).toContain('Output B');
    });

    it('should not include probes section when empty', () => {
      const project = createTestProject({
        simulation: {
          tickRate: 20,
          currentTick: 0,
          breakpoints: [],
          probes: [],
        },
      });

      const readme = generateReadme(project);

      expect(readme).not.toContain('### Probes');
    });
  });

  describe('Evidence and Test Results', () => {
    it('should include evidence section', () => {
      const project = createTestProject({
        evidence: {
          actions: [
            {
              timestamp: '2026-02-02T10:00:00Z',
              sessionId: 'test-session',
              action: { v: 1, t: 'circuit/addNode', p: { nodeId: 'a1', componentType: 'and', x: 0, y: 0 } },
            },
            {
              timestamp: '2026-02-02T10:01:00Z',
              sessionId: 'test-session',
              action: {
                v: 1,
                t: 'circuit/addConnection',
                p: { id: 'c1', fromNodeId: 'n1', fromPin: 'out', toNodeId: 'n2', toPin: 'in1' },
              },
            },
          ],
          snapshots: [],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('## Evidence');
      expect(readme).toContain('**Actions Logged**: 2');
      expect(readme).toContain('**Snapshots**: 0');
    });
  });

  describe('Large Circuits', () => {
    it('should handle large circuits efficiently', () => {
      const nodes: NodeV1[] = [];
      for (let i = 0; i < 100; i++) {
        nodes.push({
          id: `n${i}`,
          type: i % 3 === 0 ? 'and' : i % 3 === 1 ? 'or' : 'not',
          x: (i % 10) * 100,
          y: Math.floor(i / 10) * 100,
          rotation: 0,
          label: `Node${i}`,
          params: {},
          state: {},
        } as NodeV1);
      }

      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes,
          connections: [],
          customChips: [],
        },
      });

      const readme = generateReadme(project);

      expect(readme).toContain('**Nodes**: 100');
      expect(readme).toContain('and:');
      expect(readme).toContain('or:');
      expect(readme).toContain('not:');
    });
  });

  describe('Markdown Formatting', () => {
    it('should use proper markdown formatting', () => {
      const project = createTestProject();
      const readme = generateReadme(project);

      // Check for markdown headers
      expect(readme).toMatch(/^# /m);
      expect(readme).toMatch(/^## /m);

      // Check for markdown lists
      expect(readme).toMatch(/^- /m);

      // Check for code blocks
      expect(readme).toMatch(/`[^`]+`/);
    });

    it('should include footer with generation info', () => {
      const project = createTestProject();
      const readme = generateReadme(project);

      expect(readme).toContain('---');
      expect(readme).toContain('Generated by RedByte Lab Engine');
      expect(readme).toContain('Export date:');
    });
  });

  describe('Statistics and Summaries', () => {
    it('should include summary statistics in footer', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1,
            { id: 'n2', type: 'and', x: 100, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1,
            { id: 'n3', type: 'or', x: 200, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1,
          ],
          connections: [
            { id: 'c1', fromNodeId: 'n1', fromPin: 'out', toNodeId: 'n2', toPin: 'in1' } as ConnectionV1,
            { id: 'c2', fromNodeId: 'n2', fromPin: 'out', toNodeId: 'n3', toPin: 'in1' } as ConnectionV1,
          ],
          customChips: [],
        },
        evidence: {
          actions: [
            {
              timestamp: '2026-02-02T10:00:00Z',
              sessionId: 'test-session',
              action: { v: 1, t: 'circuit/addNode', p: { nodeId: 'a1', componentType: 'and', x: 0, y: 0 } },
            },
          ],
          snapshots: [],
        },
      });

      const readme = generateReadme(project);

      // Should have summary of project composition
      expect(readme).toContain('3 nodes');
      expect(readme).toContain('2 connections');
      expect(readme).toContain('1 action');
    });
  });

  describe('Custom Options', () => {
    it('should respect includeCircuitStats option', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1,
          ],
          connections: [],
          customChips: [],
        },
      });

      const readmeWith = generateReadme(project, { includeCircuitStats: true });
      const readmeWithout = generateReadme(project, { includeCircuitStats: false });

      expect(readmeWith).toContain('### Components');
      expect(readmeWithout).not.toContain('### Components');
    });

    it('should respect includeProbes option', () => {
      const project = createTestProject({
        simulation: {
          tickRate: 20,
          currentTick: 0,
          breakpoints: [],
          probes: [
            { id: 'p1', label: 'Output A', signal: 'sig_a', color: '#ff0000' },
          ],
        },
      });

      const readmeWith = generateReadme(project, { includeProbes: true });
      const readmeWithout = generateReadme(project, { includeProbes: false });

      expect(readmeWith).toContain('### Probes');
      expect(readmeWithout).not.toContain('### Probes');
    });
  });
});
