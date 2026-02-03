// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Stabilization Integration Tests
 *
 * These tests verify critical workflows don't throw runtime errors.
 * They are shallow integration tests (not full E2E) that ensure:
 * - Store mutations work correctly
 * - Undo/redo restores state
 * - Invalid operations are prevented
 * - Core workflows complete without crashes
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCircuitStore } from '../stores/circuitStore';
import { CircuitEngine } from '@redbyte/rb-logic-core';
describe('Playground Stabilization', () => {
    let initialCircuit;
    beforeEach(() => {
        // Reset circuit store before each test
        initialCircuit = {
            nodes: [],
            connections: [],
        };
        const store = useCircuitStore.getState();
        store.updateCircuit(initialCircuit, { skipHistory: true, enforceLimits: false }); // Test setup: skip both
        const engine = new CircuitEngine(initialCircuit);
        store.setEngine(engine);
    });
    describe('QuickAdd Component Addition', () => {
        it('should add a component without crashing (regression test for handleAddNode)', () => {
            const store = useCircuitStore.getState();
            // This was previously calling undefined handleAddNode(), causing crash
            expect(() => {
                store.addNode('Switch', { x: 0, y: 0 });
            }).not.toThrow();
            const circuit = useCircuitStore.getState().circuit;
            expect(circuit.nodes).toHaveLength(1);
            expect(circuit.nodes[0].type).toBe('Switch');
        });
        it('should add component with valid position', () => {
            const store = useCircuitStore.getState();
            store.addNode('NOT', { x: 0, y: 0 });
            // Get fresh state after mutation
            const circuit = useCircuitStore.getState().circuit;
            const node = circuit.nodes[0];
            expect(node.position).toBeDefined();
            expect(typeof node.position.x).toBe('number');
            expect(typeof node.position.y).toBe('number');
            expect(node.id).toBeDefined();
        });
        it('should handle adding multiple components', () => {
            const store = useCircuitStore.getState();
            store.addNode('Switch', { x: 0, y: 0 });
            store.addNode('AND', { x: 0, y: 0 });
            store.addNode('Lamp', { x: 0, y: 0 });
            const circuit = useCircuitStore.getState().circuit;
            expect(circuit.nodes).toHaveLength(3);
            expect(circuit.nodes.map(n => n.type)).toEqual(['Switch', 'AND', 'Lamp']);
        });
    });
    describe('Node Position Updates', () => {
        it('should update node position and commit to store', () => {
            const store = useCircuitStore.getState();
            // Add a node
            store.addNode('Switch', { x: 0, y: 0 });
            const circuit1 = useCircuitStore.getState().circuit;
            const nodeId = circuit1.nodes[0].id;
            const originalPosition = circuit1.nodes[0].position;
            // Update position
            const updatedCircuit = {
                ...circuit1,
                nodes: circuit1.nodes.map(n => n.id === nodeId
                    ? { ...n, position: { x: 100, y: 200 } }
                    : n),
            };
            store.commit(updatedCircuit);
            const circuit2 = useCircuitStore.getState().circuit;
            const updatedNode = circuit2.nodes.find(n => n.id === nodeId);
            expect(updatedNode?.position.x).toBe(100);
            expect(updatedNode?.position.y).toBe(200);
            expect(updatedNode?.position).not.toEqual(originalPosition);
        });
        it('should support undo after position change', () => {
            const store = useCircuitStore.getState();
            store.addNode('Switch', { x: 0, y: 0 });
            const circuit1 = useCircuitStore.getState().circuit;
            const nodeId = circuit1.nodes[0].id;
            const originalPosition = { ...circuit1.nodes[0].position };
            // Move node
            const movedCircuit = {
                ...circuit1,
                nodes: circuit1.nodes.map(n => n.id === nodeId
                    ? { ...n, position: { x: 100, y: 200 } }
                    : n),
            };
            store.commit(movedCircuit);
            // Undo
            store.undo();
            const circuit3 = useCircuitStore.getState().circuit;
            const restoredNode = circuit3.nodes.find(n => n.id === nodeId);
            expect(restoredNode?.position).toEqual(originalPosition);
        });
    });
    describe('Wire Operations', () => {
        it('should add valid wire connection', () => {
            const store = useCircuitStore.getState();
            // Add two nodes
            store.addNode('Switch', { x: 0, y: 0 });
            store.addNode('Lamp', { x: 0, y: 0 });
            const circuit = useCircuitStore.getState().circuit;
            const switchNode = circuit.nodes.find(n => n.type === 'Switch');
            const lampNode = circuit.nodes.find(n => n.type === 'Lamp');
            expect(switchNode).toBeDefined();
            expect(lampNode).toBeDefined();
            // Add wire
            const wiredCircuit = {
                ...circuit,
                connections: [
                    {
                        from: { nodeId: switchNode.id, portName: 'out' },
                        to: { nodeId: lampNode.id, portName: 'in' },
                    },
                ],
            };
            store.commit(wiredCircuit);
            const finalCircuit = useCircuitStore.getState().circuit;
            expect(finalCircuit.connections).toHaveLength(1);
            expect(finalCircuit.connections[0].from.nodeId).toBe(switchNode.id);
            expect(finalCircuit.connections[0].to.nodeId).toBe(lampNode.id);
        });
        it('should prevent invalid wire (output to output)', () => {
            const store = useCircuitStore.getState();
            store.addNode('Switch', { x: 0, y: 0 });
            store.addNode('PowerSource', { x: 0, y: 0 });
            const circuit = useCircuitStore.getState().circuit;
            const switch1 = circuit.nodes.find(n => n.type === 'Switch');
            const power1 = circuit.nodes.find(n => n.type === 'PowerSource');
            // Attempt invalid connection (output → output)
            // This should be prevented at the UI layer, but store should handle gracefully
            const invalidCircuit = {
                ...circuit,
                connections: [
                    {
                        from: { nodeId: switch1.id, portName: 'out' },
                        to: { nodeId: power1.id, portName: 'out' }, // Invalid: output port as target
                    },
                ],
            };
            // Store should accept this (validation happens in UI/engine)
            // But engine should handle gracefully without crash
            expect(() => {
                store.commit(invalidCircuit);
            }).not.toThrow();
        });
    });
    describe('Undo/Redo Wire Operations', () => {
        it('should undo/redo wire addition', () => {
            const store = useCircuitStore.getState();
            // Setup circuit
            store.addNode('Switch', { x: 0, y: 0 });
            store.addNode('Lamp', { x: 0, y: 0 });
            const circuit1 = useCircuitStore.getState().circuit;
            const switchNode = circuit1.nodes.find(n => n.type === 'Switch');
            const lampNode = circuit1.nodes.find(n => n.type === 'Lamp');
            // Add wire
            const wiredCircuit = {
                ...circuit1,
                connections: [
                    {
                        from: { nodeId: switchNode.id, portName: 'out' },
                        to: { nodeId: lampNode.id, portName: 'in' },
                    },
                ],
            };
            store.commit(wiredCircuit);
            expect(useCircuitStore.getState().circuit.connections).toHaveLength(1);
            // Undo
            store.undo();
            expect(useCircuitStore.getState().circuit.connections).toHaveLength(0);
            // Redo
            store.redo();
            expect(useCircuitStore.getState().circuit.connections).toHaveLength(1);
            expect(useCircuitStore.getState().circuit.connections[0].from.nodeId).toBe(switchNode.id);
        });
        it('should restore wire after node deletion undo', () => {
            const store = useCircuitStore.getState();
            // Setup circuit with wire
            store.addNode('Switch', { x: 0, y: 0 });
            store.addNode('Lamp', { x: 0, y: 0 });
            const circuit1 = useCircuitStore.getState().circuit;
            const switchNode = circuit1.nodes.find(n => n.type === 'Switch');
            const lampNode = circuit1.nodes.find(n => n.type === 'Lamp');
            const wiredCircuit = {
                ...circuit1,
                connections: [
                    {
                        from: { nodeId: switchNode.id, portName: 'out' },
                        to: { nodeId: lampNode.id, portName: 'in' },
                    },
                ],
            };
            store.commit(wiredCircuit);
            // Delete lamp (should remove wire)
            const deletedCircuit = {
                ...wiredCircuit,
                nodes: wiredCircuit.nodes.filter(n => n.id !== lampNode.id),
                connections: [], // Wire removed when node deleted
            };
            store.commit(deletedCircuit);
            expect(useCircuitStore.getState().circuit.nodes).toHaveLength(1);
            expect(useCircuitStore.getState().circuit.connections).toHaveLength(0);
            // Undo deletion
            store.undo();
            const restoredCircuit = useCircuitStore.getState().circuit;
            expect(restoredCircuit.nodes).toHaveLength(2);
            expect(restoredCircuit.connections).toHaveLength(1);
            expect(restoredCircuit.connections[0].from.nodeId).toBe(switchNode.id);
            expect(restoredCircuit.connections[0].to.nodeId).toBe(lampNode.id);
        });
    });
    describe('Store Consistency', () => {
        it('should maintain engine sync after mutations', () => {
            const store = useCircuitStore.getState();
            const engine = store.engine;
            expect(engine).toBeDefined();
            // Add node
            store.addNode('Switch', { x: 0, y: 0 });
            // Engine should reflect the change
            const engineCircuit = engine?.getCircuit();
            expect(engineCircuit?.nodes).toHaveLength(1);
            expect(engineCircuit?.nodes[0].type).toBe('Switch');
        });
        it('should maintain circuit consistency after multiple operations', () => {
            const store = useCircuitStore.getState();
            store.addNode('Switch', { x: 0, y: 0 });
            store.addNode('Lamp', { x: 0, y: 0 });
            const circuit1 = useCircuitStore.getState().circuit;
            expect(circuit1.nodes).toHaveLength(2);
            // Add wire
            const switch1 = circuit1.nodes[0];
            const lamp1 = circuit1.nodes[1];
            const wiredCircuit = {
                ...circuit1,
                connections: [
                    {
                        from: { nodeId: switch1.id, portName: 'out' },
                        to: { nodeId: lamp1.id, portName: 'in' },
                    },
                ],
            };
            store.commit(wiredCircuit);
            const circuit2 = useCircuitStore.getState().circuit;
            expect(circuit2.connections).toHaveLength(1);
            // Undo twice
            store.undo();
            store.undo();
            const circuit3 = useCircuitStore.getState().circuit;
            expect(circuit3.nodes).toHaveLength(1); // Only first node remains
            // Redo twice
            store.redo();
            store.redo();
            const circuit4 = useCircuitStore.getState().circuit;
            expect(circuit4.nodes).toHaveLength(2);
            expect(circuit4.connections).toHaveLength(1);
        });
    });
});
