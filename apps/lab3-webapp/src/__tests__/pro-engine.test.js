import { describe, test, expect } from 'vitest';
import { evaluateCircuit, addNode, connectWire, deleteNode, deleteWire, moveNode, setNodeValue } from '../circuit-designer-pro/engine';
describe('Circuit Designer Pro Engine', () => {
    test('should evaluate AND gate with two true inputs', () => {
        const circuit = {
            nodes: [
                { id: 'in1', type: 'INPUT', x: 0, y: 0, config: { value: true } },
                { id: 'in2', type: 'INPUT', x: 0, y: 50, config: { value: true } },
                { id: 'and1', type: 'AND', x: 100, y: 25, config: { inputCount: 2 } },
                { id: 'out1', type: 'OUTPUT', x: 200, y: 25 },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'in1', port: 0 }, to: { nodeId: 'and1', port: 1 } },
                { id: 'w2', from: { nodeId: 'in2', port: 0 }, to: { nodeId: 'and1', port: 2 } },
                { id: 'w3', from: { nodeId: 'and1', port: 0 }, to: { nodeId: 'out1', port: 1 } },
            ],
        };
        const result = evaluateCircuit(circuit);
        // AND(true, true) = true
        expect(result.get('and1')).toBe(true);
        expect(result.error).toBeUndefined();
    });
    test('should evaluate AND gate with mixed inputs (true, false)', () => {
        const circuit = {
            nodes: [
                { id: 'in1', type: 'INPUT', x: 0, y: 0, config: { value: true } },
                { id: 'in2', type: 'INPUT', x: 0, y: 50, config: { value: false } },
                { id: 'and1', type: 'AND', x: 100, y: 25, config: { inputCount: 2 } },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'in1', port: 0 }, to: { nodeId: 'and1', port: 1 } },
                { id: 'w2', from: { nodeId: 'in2', port: 0 }, to: { nodeId: 'and1', port: 2 } },
            ],
        };
        const result = evaluateCircuit(circuit);
        // AND(true, false) = false
        expect(result.get('and1')).toBe(false);
    });
    test('should evaluate OR gate', () => {
        const circuit = {
            nodes: [
                { id: 'in1', type: 'INPUT', x: 0, y: 0, config: { value: true } },
                { id: 'in2', type: 'INPUT', x: 0, y: 50, config: { value: false } },
                { id: 'or1', type: 'OR', x: 100, y: 25, config: { inputCount: 2 } },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'in1', port: 0 }, to: { nodeId: 'or1', port: 1 } },
                { id: 'w2', from: { nodeId: 'in2', port: 0 }, to: { nodeId: 'or1', port: 2 } },
            ],
        };
        const result = evaluateCircuit(circuit);
        // OR(true, false) = true
        expect(result.get('or1')).toBe(true);
    });
    test('should evaluate NOT gate', () => {
        const circuit = {
            nodes: [
                { id: 'in1', type: 'INPUT', x: 0, y: 0, config: { value: true } },
                { id: 'not1', type: 'NOT', x: 100, y: 25, config: { inputCount: 1 } },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'in1', port: 0 }, to: { nodeId: 'not1', port: 1 } },
            ],
        };
        const result = evaluateCircuit(circuit);
        // NOT(true) = false
        expect(result.get('not1')).toBe(false);
    });
    test('should evaluate XOR gate', () => {
        const circuit = {
            nodes: [
                { id: 'in1', type: 'INPUT', x: 0, y: 0, config: { value: true } },
                { id: 'in2', type: 'INPUT', x: 0, y: 50, config: { value: true } },
                { id: 'xor1', type: 'XOR', x: 100, y: 25, config: { inputCount: 2 } },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'in1', port: 0 }, to: { nodeId: 'xor1', port: 1 } },
                { id: 'w2', from: { nodeId: 'in2', port: 0 }, to: { nodeId: 'xor1', port: 2 } },
            ],
        };
        const result = evaluateCircuit(circuit);
        // XOR(true, true) = false
        expect(result.get('xor1')).toBe(false);
    });
    test('should detect combinational loops', () => {
        const circuit = {
            nodes: [
                { id: 'g1', type: 'OR', x: 0, y: 0 },
                { id: 'g2', type: 'AND', x: 100, y: 0 },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'g1', port: 0 }, to: { nodeId: 'g2', port: 1 } },
                { id: 'w2', from: { nodeId: 'g2', port: 0 }, to: { nodeId: 'g1', port: 1 } }, // Loop!
            ],
        };
        const result = evaluateCircuit(circuit);
        expect(result.error).toBeDefined();
        expect(result.error?.toLowerCase()).toContain('combinational loop');
    });
    test('should add node and return new CircuitDesignerDoc', () => {
        const circuit = { nodes: [], wires: [] };
        const newCircuit = addNode(circuit, 'AND', 100, 100);
        expect(newCircuit.nodes).toHaveLength(1);
        expect(newCircuit.nodes[0].type).toBe('AND');
        expect(newCircuit.nodes[0].x).toBe(100);
        expect(newCircuit.nodes[0].y).toBe(100);
        // Original should be unchanged
        expect(circuit.nodes).toHaveLength(0);
    });
    test('should connect two nodes with a wire', () => {
        const circuit = {
            nodes: [
                { id: 'g1', type: 'AND', x: 0, y: 0 },
                { id: 'g2', type: 'OR', x: 100, y: 0 },
            ],
            wires: [],
        };
        const newCircuit = connectWire(circuit, 'g1', 0, 'g2', 1);
        expect(newCircuit.wires).toHaveLength(1);
        expect(newCircuit.wires[0].from.nodeId).toBe('g1');
        expect(newCircuit.wires[0].from.port).toBe(0);
        expect(newCircuit.wires[0].to.nodeId).toBe('g2');
        expect(newCircuit.wires[0].to.port).toBe(1);
    });
    test('should delete node and all connected wires', () => {
        const circuit = {
            nodes: [
                { id: 'g1', type: 'AND', x: 0, y: 0 },
                { id: 'g2', type: 'OR', x: 100, y: 0 },
                { id: 'g3', type: 'NOT', x: 200, y: 0 },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'g1', port: 0 }, to: { nodeId: 'g2', port: 1 } },
                { id: 'w2', from: { nodeId: 'g2', port: 0 }, to: { nodeId: 'g3', port: 1 } },
            ],
        };
        const newCircuit = deleteNode(circuit, 'g2');
        expect(newCircuit.nodes).toHaveLength(2);
        expect(newCircuit.nodes.map(n => n.id)).toEqual(['g1', 'g3']);
        // Both wires involving g2 should be deleted
        expect(newCircuit.wires).toHaveLength(0);
    });
    test('should delete wire', () => {
        const circuit = {
            nodes: [
                { id: 'g1', type: 'AND', x: 0, y: 0 },
                { id: 'g2', type: 'OR', x: 100, y: 0 },
            ],
            wires: [
                { id: 'w1', from: { nodeId: 'g1', port: 0 }, to: { nodeId: 'g2', port: 1 } },
            ],
        };
        const newCircuit = deleteWire(circuit, 'w1');
        expect(newCircuit.wires).toHaveLength(0);
    });
    test('should move node', () => {
        const circuit = {
            nodes: [{ id: 'g1', type: 'AND', x: 0, y: 0 }],
            wires: [],
        };
        const newCircuit = moveNode(circuit, 'g1', 100, 200);
        expect(newCircuit.nodes[0].x).toBe(100);
        expect(newCircuit.nodes[0].y).toBe(200);
    });
    test('should set input node value', () => {
        const circuit = {
            nodes: [{ id: 'in1', type: 'INPUT', x: 0, y: 0, config: { value: false } }],
            wires: [],
        };
        const newCircuit = setNodeValue(circuit, 'in1', true);
        expect(newCircuit.nodes[0].config?.value).toBe(true);
    });
});
