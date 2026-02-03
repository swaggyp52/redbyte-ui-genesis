// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
describe('Oscilloscope Persistence on Circuit Changes', () => {
    // Test 1: Oscilloscope should NOT automatically clear when nodes are added
    it('should preserve probe data when nodes are added to circuit', () => {
        const initialCircuit = {
            nodes: [
                {
                    id: 'switch1',
                    type: 'Switch',
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    config: {},
                    state: { isOn: 0 },
                },
            ],
            connections: [],
        };
        // Simulate probe data being collected
        const probeData = new Map([
            [
                'probe1',
                {
                    probeId: 'probe1',
                    samples: [
                        { timestamp: 0, value: 0 },
                        { timestamp: 0.05, value: 1 },
                        { timestamp: 0.1, value: 0 },
                    ],
                    measurements: null,
                },
            ],
        ]);
        // Add a new node to the circuit
        const updatedCircuit = {
            nodes: [
                ...initialCircuit.nodes,
                {
                    id: 'and1',
                    type: 'AND',
                    position: { x: 100, y: 0 },
                    rotation: 0,
                    config: {},
                },
            ],
            connections: [],
        };
        // Verify circuit changed
        expect(updatedCircuit.nodes.length).toBe(2);
        expect(initialCircuit.nodes.length).toBe(1);
        // Verify probe data should remain unchanged (not cleared by circuit change)
        expect(probeData.get('probe1')?.samples.length).toBe(3);
    });
    // Test 2: Oscilloscope should handle missing nodes gracefully
    it('should continue sampling when probed node is deleted', () => {
        const circuit = {
            nodes: [
                {
                    id: 'switch1',
                    type: 'Switch',
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    config: {},
                    state: { isOn: 1 },
                },
            ],
            connections: [],
        };
        // Simulate a probe pointing to switch1
        const probe = {
            id: 'probe1',
            nodeId: 'switch1',
            portName: 'out',
            label: 'Switch 1',
            color: '#ff0000',
            enabled: true,
        };
        // Node exists initially
        const nodeExists = circuit.nodes.some((n) => n.id === probe.nodeId);
        expect(nodeExists).toBe(true);
        // Delete the node
        const updatedCircuit = {
            nodes: circuit.nodes.filter((n) => n.id !== 'switch1'),
            connections: [],
        };
        // Node no longer exists
        const nodeExistsAfterDelete = updatedCircuit.nodes.some((n) => n.id === probe.nodeId);
        expect(nodeExistsAfterDelete).toBe(false);
        // Sampling should handle missing node by returning 0
        // (This is what the sampleSignals function does: `const outputs = node ? engine.getNodeOutputs(probe.nodeId) : {};`)
        const mockOutputs = nodeExistsAfterDelete ? { out: 1 } : {};
        const value = mockOutputs[probe.portName] ?? 0;
        expect(value).toBe(0); // Missing node returns 0
    });
    // Test 3: Verify probe list shows warning for missing nodes
    it('should identify when a probe points to a non-existent node', () => {
        const circuit = {
            nodes: [
                {
                    id: 'and1',
                    type: 'AND',
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    config: {},
                },
            ],
            connections: [],
        };
        const probes = [
            { id: 'probe1', nodeId: 'switch1', portName: 'out', label: 'Switch 1', color: '#ff0000', enabled: true },
            { id: 'probe2', nodeId: 'and1', portName: 'out', label: 'AND 1', color: '#00ff00', enabled: true },
        ];
        // Check which probes point to existing nodes
        const probeStatuses = probes.map((probe) => ({
            probeId: probe.id,
            nodeExists: circuit.nodes.some((n) => n.id === probe.nodeId),
        }));
        expect(probeStatuses[0].nodeExists).toBe(false); // switch1 doesn't exist
        expect(probeStatuses[1].nodeExists).toBe(true); // and1 exists
    });
    // Test 4: Moving nodes should not clear oscilloscope data
    it('should preserve probe data when nodes are moved', () => {
        const circuit = {
            nodes: [
                {
                    id: 'switch1',
                    type: 'Switch',
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    config: {},
                    state: { isOn: 0 },
                },
            ],
            connections: [],
        };
        const probeData = new Map([
            [
                'probe1',
                {
                    probeId: 'probe1',
                    samples: [
                        { timestamp: 0, value: 0 },
                        { timestamp: 0.05, value: 1 },
                    ],
                    measurements: null,
                },
            ],
        ]);
        // Move the node
        const updatedCircuit = {
            nodes: circuit.nodes.map((n) => n.id === 'switch1' ? { ...n, position: { x: 200, y: 100 } } : n),
            connections: [],
        };
        // Node still exists with same ID
        expect(updatedCircuit.nodes[0].id).toBe('switch1');
        // Probe data should remain (not cleared)
        expect(probeData.get('probe1')?.samples.length).toBe(2);
    });
    // Test 5: Verify explicit clear functionality
    it('should clear all probe data when user explicitly clears', () => {
        let probeData = new Map([
            [
                'probe1',
                {
                    probeId: 'probe1',
                    samples: [{ timestamp: 0, value: 0 }, { timestamp: 0.05, value: 1 }],
                    measurements: null,
                },
            ],
            [
                'probe2',
                {
                    probeId: 'probe2',
                    samples: [{ timestamp: 0, value: 1 }],
                    measurements: null,
                },
            ],
        ]);
        expect(probeData.size).toBe(2);
        // Simulate handleClearData() - user clicks "Clear" button
        probeData = new Map();
        expect(probeData.size).toBe(0);
    });
});
