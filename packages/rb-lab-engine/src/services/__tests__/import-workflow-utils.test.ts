import { describe, it, expect } from 'vitest';
import {
  convertCircuitV1ToCircuit,
  convertCircuitToCircuitV1,
  prepareImportedProjectState,
  getVirtualLabSimulationState,
  validateVirtualLabState,
  extractEvidenceData,
  validateEvidenceStructure,
  getUnifiedProjectStorePayload,
  validateUnifiedProjectStoreCompatibility,
  generateImportedProjectFilename,
  formatImportedProjectDisplayName,
  generateImportSummary,
  getImportWarnings,
} from '../importWorkflowUtils.js';
import type { LabProjectV1, CircuitV1, NodeV1, ConnectionV1 } from '../../schema/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestProject(overrides?: Partial<LabProjectV1>): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'test-id',
    name: 'Test Project',
    description: 'Test',
    createdAt: '2026-02-02T10:00:00Z',
    updatedAt: '2026-02-02T10:00:00Z',
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

// ============================================================================
// Test Suites
// ============================================================================

describe('Import Workflow Utilities', () => {
  // ============================================================================
  // Circuit Conversion (Suite 1)
  // ============================================================================

  describe('Circuit Format Conversion', () => {
    it('should convert CircuitV1 to Circuit format', () => {
      const circuitV1: CircuitV1 = {
        schemaVersion: '1.0',
        nodes: [
          {
            id: 'n1',
            type: 'and',
            x: 10,
            y: 20,
            rotation: 90,
            label: 'AND1',
            params: { foo: 'bar' },
            state: { output: false },
          } as NodeV1,
        ],
        connections: [],
        customChips: [],
      };

      const circuit = convertCircuitV1ToCircuit(circuitV1);

      expect(circuit.nodes).toHaveLength(1);
      expect(circuit.nodes[0].id).toBe('n1');
      expect(circuit.nodes[0].type).toBe('and');
      expect(circuit.nodes[0].x).toBe(10);
      expect(circuit.nodes[0].y).toBe(20);
      expect(circuit.nodes[0].rotation).toBe(90);
      expect(circuit.nodes[0].label).toBe('AND1');
      expect(circuit.nodes[0].config).toEqual({ foo: 'bar' });
      expect(circuit.nodes[0].state).toEqual({ output: false });
    });

    it('should convert Circuit back to CircuitV1 format', () => {
      const circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'and',
            x: 10,
            y: 20,
            rotation: 90,
            config: { foo: 'bar' },
            label: 'AND1',
            state: { output: false },
            inputs: {},
            outputs: {},
          },
        ],
        connections: [],
      };

      const circuitV1 = convertCircuitToCircuitV1(circuit);

      expect(circuitV1.nodes).toHaveLength(1);
      expect(circuitV1.nodes[0].id).toBe('n1');
      expect(circuitV1.nodes[0].params).toEqual({ foo: 'bar' });
      expect(circuitV1.nodes[0].state).toEqual({ output: false });
    });

    it('should handle connections in conversion', () => {
      const circuitV1: CircuitV1 = {
        schemaVersion: '1.0',
        nodes: [],
        connections: [
          {
            id: 'c1',
            fromNodeId: 'n1',
            fromPin: 'out',
            toNodeId: 'n2',
            toPin: 'in1',
          } as ConnectionV1,
        ],
        customChips: [],
      };

      const circuit = convertCircuitV1ToCircuit(circuitV1);

      expect(circuit.connections).toHaveLength(1);
      expect(circuit.connections[0].from).toBe('n1');
      expect(circuit.connections[0].fromPin).toBe('out');
      expect(circuit.connections[0].to).toBe('n2');
      expect(circuit.connections[0].toPin).toBe('in1');
    });

    it('should preserve schemaVersion when converting back', () => {
      const original: CircuitV1 = {
        schemaVersion: '1.0',
        nodes: [],
        connections: [],
        customChips: [],
      };

      const circuit = convertCircuitV1ToCircuit(original);
      const circuitV1 = convertCircuitToCircuitV1(circuit, original);

      expect(circuitV1.schemaVersion).toBe('1.0');
    });

    it('should handle missing params/state as empty objects', () => {
      const circuitV1: CircuitV1 = {
        schemaVersion: '1.0',
        nodes: [
          {
            id: 'n1',
            type: 'and',
            x: 0,
            y: 0,
            rotation: 0,
            label: '',
            // params and state omitted
          } as NodeV1,
        ],
        connections: [],
        customChips: [],
      };

      const circuit = convertCircuitV1ToCircuit(circuitV1);

      expect(circuit.nodes[0].config).toEqual({});
      expect(circuit.nodes[0].state).toEqual({});
    });
  });

  // ============================================================================
  // Import State Preparation (Suite 2)
  // ============================================================================

  describe('Import State Preparation', () => {
    it('should prepare state with correct source', () => {
      const project = createTestProject();
      const state = prepareImportedProjectState(project, 'user-file');

      expect(state.project).toBe(project);
      expect(state.metadata.source).toBe('user-file');
      expect(state.metadata.timestamp).toBeDefined();
    });

    it('should handle example source', () => {
      const project = createTestProject();
      const state = prepareImportedProjectState(project, 'example');

      expect(state.metadata.source).toBe('example');
    });

    it('should convert circuit during preparation', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            {
              id: 'n1',
              type: 'and',
              x: 10,
              y: 20,
              rotation: 0,
              label: 'A1',
              params: {},
              state: {},
            } as NodeV1,
          ],
          connections: [],
          customChips: [],
        },
      });

      const state = prepareImportedProjectState(project);

      expect(state.circuit.nodes).toHaveLength(1);
      expect(state.circuit.nodes[0].x).toBe(10);
    });
  });

  // ============================================================================
  // Virtual Lab State (Suite 3)
  // ============================================================================

  describe('Virtual Lab State Restoration', () => {
    it('should extract simulation state', () => {
      const project = createTestProject({
        simulation: {
          tickRate: 50,
          currentTick: 42,
          isRunning: true,
          breakpoints: [10, 20],
          probes: [{ id: 'p1', signal: 'n1', label: 'Test', color: '#ff0000' }],
        } as LabProjectV1['simulation'] & { isRunning: boolean },
      });

      const state = getVirtualLabSimulationState(project);

      expect(state.tickRate).toBe(50);
      expect(state.currentTick).toBe(42);
      expect(state.isRunning).toBe(true);
      expect(state.breakpoints).toEqual([10, 20]);
      expect(state.probes).toHaveLength(1);
    });

    it('should validate Virtual Lab state completeness', () => {
      const project = createTestProject();
      const validation = validateVirtualLabState(project);

      expect(validation.hasTickRate).toBe(true);
      expect(validation.hasCurrentTick).toBe(true);
      expect(validation.hasBreakpoints).toBe(true);
      expect(validation.hasProbes).toBe(true);
    });

    it('should detect missing Virtual Lab state', () => {
      const project = createTestProject();
      delete (project.simulation as any).tickRate;

      const validation = validateVirtualLabState(project);

      expect(validation.hasTickRate).toBe(false);
    });

    it('should provide defaults for missing simulation state', () => {
      const project = createTestProject();
      delete (project.simulation as any).tickRate;

      const state = getVirtualLabSimulationState(project);

      expect(state.tickRate).toBe(20); // Default
    });
  });

  // ============================================================================
  // Evidence Extraction (Suite 4)
  // ============================================================================

  describe('Evidence & Checkpoint Data', () => {
    it('should extract evidence data', () => {
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
          snapshots: [
            {
              timestamp: '2026-02-02T10:02:00Z',
              checkpointId: 'self-check',
              tick: 2,
              probeValues: {},
              circuitHash: 'sha256:test-circuit',
              projectHash: 'sha256:test-project',
            },
          ],
        },
      });

      const evidence = extractEvidenceData(project);

      expect(evidence.actionCount).toBe(2);
      expect(evidence.snapshotCount).toBe(1);
      expect(evidence.actions).toHaveLength(2);
      expect(evidence.snapshots).toHaveLength(1);
    });

    it('should validate evidence structure', () => {
      const project = createTestProject();
      const validation = validateEvidenceStructure(project);

      expect(validation.valid).toBe(true);
      expect(validation.message).toContain('valid');
    });

    it('should detect invalid evidence structure', () => {
      const project = createTestProject();
      (project.evidence as any).actions = null; // Invalid

      const validation = validateEvidenceStructure(project);

      expect(validation.valid).toBe(false);
    });

    it('should handle missing evidence', () => {
      const project = createTestProject();
      delete (project as any).evidence;

      const validation = validateEvidenceStructure(project);

      expect(validation.valid).toBe(false);
    });
  });

  // ============================================================================
  // Unified Store Compatibility (Suite 5)
  // ============================================================================

  describe('Unified Project Store Compatibility', () => {
    it('should extract payload for store', () => {
      const project = createTestProject({
        name: 'Store Test',
        description: 'Store payload test',
      });

      const payload = getUnifiedProjectStorePayload(project);

      expect(payload.projectId).toBe(project.projectId);
      expect(payload.name).toBe('Store Test');
      expect(payload.circuit).toBe(project.circuit);
      expect(payload.simulation).toBe(project.simulation);
      expect(payload.evidence).toBe(project.evidence);
    });

    it('should validate store compatibility', () => {
      const project = createTestProject();
      const validation = validateUnifiedProjectStoreCompatibility(project);

      expect(validation.compatible).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const project = createTestProject();
      delete (project as any).circuit;

      const validation = validateUnifiedProjectStoreCompatibility(project);

      expect(validation.compatible).toBe(false);
      expect(validation.missingFields).toContain('circuit');
    });

    it('should identify all missing fields', () => {
      const project = {
        schemaVersion: '1.0',
        projectId: 'test',
      } as any;

      const validation = validateUnifiedProjectStoreCompatibility(project);

      expect(validation.missingFields.length).toBeGreaterThan(5);
    });
  });

  // ============================================================================
  // Filename & Display Formatting (Suite 6)
  // ============================================================================

  describe('Filename & Display Formatting', () => {
    it('should generate safe filename from project name', () => {
      const project = createTestProject({ name: 'My Cool Circuit' });
      const filename = generateImportedProjectFilename(project);

      expect(filename).toMatch(/\.rblogic$/);
      expect(filename).toContain('my-cool-circuit');
    });

    it('should handle special characters in filename', () => {
      const project = createTestProject({ name: 'Circuit #1 (v2.0)' });
      const filename = generateImportedProjectFilename(project);

      expect(filename).not.toContain('#');
      expect(filename).not.toContain('(');
      expect(filename).not.toContain(')');
      expect(filename).toMatch(/\.rblogic$/);
    });

    it('should handle empty project name', () => {
      const project = createTestProject({ name: '' });
      const filename = generateImportedProjectFilename(project);

      expect(filename).toBe('imported-circuit.rblogic');
    });

    it('should truncate long project names in display', () => {
      const longName = 'A'.repeat(100);
      const project = createTestProject({ name: longName });
      const display = formatImportedProjectDisplayName(project);

      expect(display.length).toBeLessThanOrEqual(53); // 50 + "..."
    });

    it('should not truncate short project names', () => {
      const project = createTestProject({ name: 'Short' });
      const display = formatImportedProjectDisplayName(project);

      expect(display).toBe('Short');
    });

    it('should use default name when project has no name', () => {
      const project = createTestProject({ name: '' });
      const display = formatImportedProjectDisplayName(project);

      expect(display).toBe('Imported Project');
    });
  });

  // ============================================================================
  // Import Status Reporting (Suite 7)
  // ============================================================================

  describe('Import Status Reporting', () => {
    it('should generate success summary', () => {
      const project = createTestProject({
        name: 'Test Circuit',
        circuit: {
          schemaVersion: '1.0',
          nodes: [{ id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1],
          connections: [],
          customChips: [],
        },
      });

      const summary = generateImportSummary(project, true);

      expect(summary).toContain('✅');
      expect(summary).toContain('Test Circuit');
      expect(summary).toContain('1 components');
    });

    it('should include warnings in summary', () => {
      const project = createTestProject({ name: 'Test' });
      const summary = generateImportSummary(project, true, ['Warning 1', 'Warning 2']);

      expect(summary).toContain('⚠️');
      expect(summary).toContain('2 warnings');
    });

    it('should generate failure message', () => {
      const project = createTestProject();
      const summary = generateImportSummary(project, false);

      expect(summary).toContain('failed');
    });

    it('should collect import warnings', () => {
      const project = createTestProject({ name: '' });
      const warnings = getImportWarnings(project);

      expect(warnings.some((w) => w.includes('no name'))).toBe(true);
    });

    it('should warn about empty circuit', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [],
          connections: [],
          customChips: [],
        },
      });

      const warnings = getImportWarnings(project);

      expect(warnings.some((w) => w.includes('empty'))).toBe(true);
    });

    it('should warn about unconnected components', () => {
      const project = createTestProject({
        circuit: {
          schemaVersion: '1.0',
          nodes: [{ id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: '', params: {}, state: {} } as NodeV1],
          connections: [],
          customChips: [],
        },
      });

      const warnings = getImportWarnings(project);

      expect(warnings.some((w) => w.includes('not connected'))).toBe(true);
    });

    it('should not warn about valid projects', () => {
      const project = createTestProject({
        name: 'Valid Project',
        circuit: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: 'AND', params: {}, state: {} } as NodeV1,
            { id: 'n2', type: 'or', x: 100, y: 0, rotation: 0, label: 'OR', params: {}, state: {} } as NodeV1,
          ],
          connections: [
            { id: 'c1', fromNodeId: 'n1', fromPin: 'out', toNodeId: 'n2', toPin: 'in1' } as ConnectionV1,
          ],
          customChips: [],
        },
      });

      const warnings = getImportWarnings(project);

      expect(warnings).toHaveLength(0);
    });
  });
});
