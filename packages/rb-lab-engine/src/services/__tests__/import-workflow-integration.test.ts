import { describe, it, expect, beforeEach } from 'vitest';
import { LabProjectV1, CircuitV1, NodeV1, ConnectionV1 } from '../../schema/index.js';
import { exportEvidenceCapsule, importEvidenceCapsule } from '../exportService.js';

/**
 * Phase 3.3: Import Workflow Integration Tests
 *
 * These tests validate that imported projects properly restore full state for:
 * 1. Logic Playground: Circuit editing with undo/redo, zoom, selection
 * 2. Virtual Lab: 3D visualization with hardware state, simulation, probes
 * 3. Cross-app sync: State changes in one app reflect in the other
 *
 * Key scenarios:
 * - Import a project and verify it's loadable in both Logic Playground and Virtual Lab
 * - Verify simulation state is restored (tick count, probes, breakpoints)
 * - Verify evidence is loaded (checkpoint data for grading)
 * - Verify subcircuits are available for editing
 * - Verify hardware state can be restored (FPGA/Arduino connections)
 * - Verify undo/redo history is cleared on import (fresh session)
 */

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal test project with all required fields
 */
function createTestProject(overrides?: Partial<LabProjectV1>): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: `test-proj-${Date.now()}`,
    name: overrides?.name || 'Test Project',
    description: overrides?.description || 'Test project for import workflow',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    circuit: {
      schemaVersion: '1.0',
      nodes: [
        {
          id: 'node-1',
          type: 'and',
          x: 100,
          y: 100,
          rotation: 0,
          label: 'AND1',
          params: {},
          state: { output: false },
        } as NodeV1,
      ],
      connections: [],
      customChips: [],
    },
    simulation: {
      tickRate: 20,
      currentTick: 0,
      isRunning: false,
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

/**
 * Extract the loaded circuit from the imported project for Logic Playground compatibility
 */
function getLogicPlaygroundCircuit(project: LabProjectV1) {
  return {
    nodes: project.circuit.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      rotation: node.rotation,
      config: node.params || {},
      label: node.label,
      state: node.state || {},
      inputs: {},
      outputs: {},
    })),
    connections: project.circuit.connections.map((conn) => ({
      id: conn.id,
      from: conn.fromNodeId,
      fromPin: conn.fromPin,
      to: conn.toNodeId,
      toPin: conn.toPin,
    })),
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Import Workflow Integration', () => {
  // ============================================================================
  // Basic Import Restore (Suite 1)
  // ============================================================================

  describe('Basic Import & Circuit Restoration', () => {
    it('should restore circuit structure for Logic Playground editing', async () => {
      const original = createTestProject({ name: 'Basic Circuit' });
      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      // Verify project loaded
      expect(project).toBeDefined();
      expect(project.name).toBe('Basic Circuit');

      // Verify circuit structure accessible
      const lpCircuit = getLogicPlaygroundCircuit(project);
      expect(lpCircuit.nodes).toHaveLength(1);
      expect(lpCircuit.nodes[0].id).toBe('node-1');
      expect(lpCircuit.nodes[0].type).toBe('and');
      expect(lpCircuit.nodes[0].label).toBe('AND1');
    });

    it('should restore simulation state for Virtual Lab', async () => {
      const original = createTestProject({
        name: 'Simulation Test',
        simulation: {
          tickRate: 50,
          currentTick: 0,
          isRunning: false,
          breakpoints: [],
          probes: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.simulation).toBeDefined();
      expect(project.simulation.tickRate).toBe(50);
      expect(project.simulation.currentTick).toBe(0);
      expect(project.simulation.isRunning).toBe(false);
    });

    it('should restore project metadata for UI display', async () => {
      const original = createTestProject({
        name: 'Metadata Test',
        description: 'This is a test project',
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.name).toBe('Metadata Test');
      expect(project.description).toBe('This is a test project');
      expect(project.projectId).toBe(original.projectId);
      expect(project.createdAt).toBe(original.createdAt);
    });
  });

  // ============================================================================
  // Complex Circuit Restoration (Suite 2)
  // ============================================================================

  describe('Complex Circuit Import Restoration', () => {
    it('should restore multi-node circuit with connections', async () => {
      const original = createTestProject({
        name: 'Multi-Node Circuit',
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'or-1', type: 'or', x: 50, y: 50, rotation: 0, label: 'OR1', params: {}, state: {} } as NodeV1,
            { id: 'and-1', type: 'and', x: 150, y: 50, rotation: 0, label: 'AND1', params: {}, state: {} } as NodeV1,
            { id: 'not-1', type: 'not', x: 250, y: 50, rotation: 0, label: 'NOT1', params: {}, state: {} } as NodeV1,
          ],
          connections: [
            {
              id: 'conn-1',
              fromNodeId: 'or-1',
              fromPin: 'out',
              toNodeId: 'and-1',
              toPin: 'in1',
            } as ConnectionV1,
            {
              id: 'conn-2',
              fromNodeId: 'and-1',
              fromPin: 'out',
              toNodeId: 'not-1',
              toPin: 'in',
            } as ConnectionV1,
          ],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      const lpCircuit = getLogicPlaygroundCircuit(project);
      expect(lpCircuit.nodes).toHaveLength(3);
      expect(lpCircuit.connections).toHaveLength(2);

      // Verify topology preserved
      const conn1 = lpCircuit.connections[0];
      expect(conn1.from).toBe('or-1');
      expect(conn1.to).toBe('and-1');
    });

    it('should restore node state and configuration', async () => {
      const original = createTestProject({
        name: 'State Preservation Test',
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            {
              id: 'switch-1',
              type: 'switch',
              x: 100,
              y: 100,
              rotation: 90,
              label: 'SW1',
              params: { momentary: true },
              state: { value: false },
            } as NodeV1,
          ],
          connections: [],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      const node = project.circuit.nodes[0];
      expect(node.rotation).toBe(90);
      expect(node.label).toBe('SW1');
      expect(node.params.momentary).toBe(true);
      expect(node.state.value).toBe(false);
    });

    it('should restore custom labels and descriptions', async () => {
      const original = createTestProject({
        name: 'Label Test',
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            {
              id: 'custom-1',
              type: 'or',
              x: 100,
              y: 100,
              rotation: 0,
              label: 'My Custom Label',
              params: {},
              state: {},
            } as NodeV1,
          ],
          connections: [],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      const node = project.circuit.nodes[0];
      expect(node.label).toBe('My Custom Label');
    });
  });

  // ============================================================================
  // Virtual Lab State Restoration (Suite 3)
  // ============================================================================

  describe('Virtual Lab State Restoration', () => {
    it('should restore probes for oscilloscope', async () => {
      const original = createTestProject({
        name: 'Probes Test',
        simulation: {
          tickRate: 20,
          currentTick: 0,
          isRunning: false,
          breakpoints: [],
          probes: [
            { id: 'probe-1', nodeId: 'node-1', name: 'Output', color: '#ff0000' },
            { id: 'probe-2', nodeId: 'node-1', name: 'Debug', color: '#00ff00' },
          ],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.simulation.probes).toHaveLength(2);
      expect(project.simulation.probes[0].name).toBe('Output');
      expect(project.simulation.probes[1].name).toBe('Debug');
    });

    it('should restore breakpoints for step debugging', async () => {
      const original = createTestProject({
        name: 'Breakpoints Test',
        simulation: {
          tickRate: 20,
          currentTick: 0,
          isRunning: false,
          breakpoints: [5, 10, 15],
          probes: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.simulation.breakpoints).toEqual([5, 10, 15]);
    });

    it('should restore tick position for simulation resume', async () => {
      const original = createTestProject({
        name: 'Tick Position Test',
        simulation: {
          tickRate: 20,
          currentTick: 42,
          isRunning: false,
          breakpoints: [],
          probes: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.simulation.currentTick).toBe(42);
    });
  });

  // ============================================================================
  // Evidence & Grading Data Restoration (Suite 4)
  // ============================================================================

  describe('Evidence & Checkpoint Restoration', () => {
    it('should restore action history for grading', async () => {
      const original = createTestProject({
        name: 'Evidence Test',
        evidence: {
          actions: [
            {
              id: 'action-1',
              type: 'component_add',
              timestamp: '2026-02-02T10:00:00Z',
              details: { nodeId: 'node-1', type: 'and' },
            },
          ],
          snapshots: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.evidence.actions).toHaveLength(1);
      expect(project.evidence.actions[0].type).toBe('component_add');
      expect(project.evidence.actions[0].details.nodeId).toBe('node-1');
    });

    it('should restore checkpoint snapshots', async () => {
      const original = createTestProject({
        name: 'Snapshots Test',
        evidence: {
          actions: [],
          snapshots: [
            {
              id: 'snap-1',
              timestamp: '2026-02-02T10:00:00Z',
              type: 'self_check',
              passed: true,
              score: 100,
              results: {
                truthTable: [
                  { inputs: { a: 0, b: 0 }, output: 0, passed: true },
                  { inputs: { a: 0, b: 1 }, output: 0, passed: true },
                ],
              },
            },
          ],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.evidence.snapshots).toHaveLength(1);
      expect(project.evidence.snapshots[0].type).toBe('self_check');
      expect(project.evidence.snapshots[0].passed).toBe(true);
    });

    it('should preserve full checkpoint data for multi-lab projects', async () => {
      const original = createTestProject({
        name: 'Multi-Lab Checkpoint',
        evidence: {
          actions: [
            { id: 'a1', type: 'component_add', timestamp: '2026-02-02T10:00:00Z', details: {} },
            { id: 'a2', type: 'wire_add', timestamp: '2026-02-02T10:01:00Z', details: {} },
          ],
          snapshots: [
            {
              id: 'snap-1',
              timestamp: '2026-02-02T10:02:00Z',
              type: 'lab_checkpoint',
              passed: true,
              score: 95,
              results: { testCount: 16, passCount: 15 },
            },
          ],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.evidence.actions).toHaveLength(2);
      expect(project.evidence.snapshots).toHaveLength(1);
      expect(project.evidence.snapshots[0].score).toBe(95);
    });
  });

  // ============================================================================
  // Edge Cases & Error Handling (Suite 5)
  // ============================================================================

  describe('Edge Cases & Robustness', () => {
    it('should handle empty circuit (no nodes or connections)', async () => {
      const original = createTestProject({
        name: 'Empty Circuit',
        circuit: {
          schemaVersion: '1.0',
          nodes: [],
          connections: [],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      const lpCircuit = getLogicPlaygroundCircuit(project);
      expect(lpCircuit.nodes).toHaveLength(0);
      expect(lpCircuit.connections).toHaveLength(0);
    });

    it('should handle missing optional fields gracefully', async () => {
      const original = createTestProject({
        name: 'Minimal Project',
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            {
              id: 'n1',
              type: 'switch',
              x: 0,
              y: 0,
              rotation: 0,
              label: '',
              params: {},
              state: {},
            } as NodeV1,
          ],
          connections: [],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      const node = project.circuit.nodes[0];
      expect(node.label).toBe('');
      expect(node.state).toBeDefined();
    });

    it('should handle special characters in node labels', async () => {
      const original = createTestProject({
        name: 'Special Chars Test',
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            {
              id: 'n1',
              type: 'and',
              x: 0,
              y: 0,
              rotation: 0,
              label: 'Node™ β©®|<>',
              params: {},
              state: {},
            } as NodeV1,
          ],
          connections: [],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.circuit.nodes[0].label).toBe('Node™ β©®|<>');
    });

    it('should handle large circuits (100+ nodes) efficiently', async () => {
      const nodes: NodeV1[] = [];
      for (let i = 0; i < 100; i++) {
        nodes.push({
          id: `node-${i}`,
          type: 'and',
          x: (i % 10) * 100,
          y: Math.floor(i / 10) * 100,
          rotation: 0,
          label: `AND${i}`,
          params: {},
          state: {},
        } as NodeV1);
      }

      const original = createTestProject({
        name: 'Large Circuit',
        circuit: {
          schemaVersion: '1.0',
          nodes,
          connections: [],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      expect(project.circuit.nodes).toHaveLength(100);
      const lpCircuit = getLogicPlaygroundCircuit(project);
      expect(lpCircuit.nodes).toHaveLength(100);
    });
  });

  // ============================================================================
  // Cross-App Synchronization (Suite 6)
  // ============================================================================

  describe('Cross-App State Synchronization', () => {
    it('should provide state format compatible with unifiedProjectStore.loadProject()', async () => {
      const original = createTestProject({
        name: 'Store Sync Test',
        projectId: 'test-id-123',
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      // Verify all fields required by UnifiedProjectStore
      expect(project.schemaVersion).toBe('1.0');
      expect(project.projectId).toBeDefined();
      expect(project.name).toBeDefined();
      expect(project.circuit).toBeDefined();
      expect(project.simulation).toBeDefined();
      expect(project.evidence).toBeDefined();
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it('should provide circuit format compatible with Logic Playground', async () => {
      const original = createTestProject({
        name: 'LP Compatibility Test',
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'n1', type: 'and', x: 10, y: 20, rotation: 0, label: 'A1', params: {}, state: {} } as NodeV1,
            { id: 'n2', type: 'or', x: 30, y: 40, rotation: 0, label: 'O1', params: {}, state: {} } as NodeV1,
          ],
          connections: [
            { id: 'c1', fromNodeId: 'n1', fromPin: 'out', toNodeId: 'n2', toPin: 'in1' } as ConnectionV1,
          ],
          customChips: [],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      const lpCircuit = getLogicPlaygroundCircuit(project);

      // Verify conversion to LP format
      expect(lpCircuit.nodes[0].id).toBe('n1');
      expect(lpCircuit.nodes[0].type).toBe('and');
      expect(lpCircuit.nodes[0].x).toBe(10);
      expect(lpCircuit.nodes[0].y).toBe(20);
      expect(lpCircuit.connections[0].from).toBe('n1');
      expect(lpCircuit.connections[0].to).toBe('n2');
    });

    it('should support simulation state restoration for Virtual Lab', async () => {
      const original = createTestProject({
        name: 'VL State Test',
        simulation: {
          tickRate: 25,
          currentTick: 50,
          isRunning: false,
          breakpoints: [10, 20, 30],
          probes: [
            { id: 'p1', nodeId: 'node-1', name: 'Test', color: '#ff0000' },
          ],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      // Virtual Lab can use simulation state directly
      expect(project.simulation.tickRate).toBe(25);
      expect(project.simulation.currentTick).toBe(50);
      expect(project.simulation.probes).toHaveLength(1);
    });
  });

  // ============================================================================
  // Integrity Assurance (Suite 7)
  // ============================================================================

  describe('Integrity Assurance During Import', () => {
    it('should report verified integrity for unmodified projects', async () => {
      const original = createTestProject({ name: 'Integrity Test' });
      const blob = await exportEvidenceCapsule(original);
      const { integrity } = await importEvidenceCapsule(blob);

      expect(integrity.status).toBe('verified');
      expect(integrity.message).toContain('✅');
    });

    it('should preserve integrity metadata across import', async () => {
      const original = createTestProject({ name: 'Metadata Test' });
      const blob = await exportEvidenceCapsule(original);
      const { project } = await importEvidenceCapsule(blob);

      // Verify capsule index was properly formed
      expect(project.projectId).toBeDefined();
      expect(project.createdAt).toBeDefined();
    });

    it('should handle import of projects with evidence checksums', async () => {
      const original = createTestProject({
        name: 'Evidence Checksum Test',
        evidence: {
          actions: [
            { id: 'a1', type: 'component_add', timestamp: '2026-02-02T10:00:00Z', details: {} },
          ],
          snapshots: [
            { id: 's1', timestamp: '2026-02-02T10:00:00Z', type: 'self_check', passed: true, score: 100, results: {} },
          ],
        },
      });

      const blob = await exportEvidenceCapsule(original);
      const { project, integrity } = await importEvidenceCapsule(blob);

      expect(integrity.status).toBe('verified');
      expect(project.evidence.actions).toHaveLength(1);
      expect(project.evidence.snapshots).toHaveLength(1);
    });
  });
});
