// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { createRBProject, decodeRBProject, encodeRBProject } from '../export/projectFormat';
describe('project format', () => {
    it('encodes a deterministic circuit while preserving node data', () => {
        const circuit = {
            nodes: [
                {
                    id: 'b',
                    type: 'Switch',
                    position: { x: 10, y: 20 },
                    rotation: 0,
                    config: { foo: 1 },
                    state: { isOn: 1 },
                },
                {
                    id: 'a',
                    type: 'Lamp',
                    position: { x: 30, y: 40 },
                    rotation: 0,
                    config: {},
                    state: {},
                },
            ],
            connections: [
                {
                    from: { nodeId: 'b', portName: 'out' },
                    to: { nodeId: 'a', portName: 'in' },
                },
            ],
        };
        const project = createRBProject({
            createdAt: '2026-01-01T00:00:00.000Z',
            name: 'Test Project',
            circuit,
        });
        const encoded = encodeRBProject(project);
        const parsed = decodeRBProject(encoded);
        expect(parsed.kind).toBe('rb-project');
        expect(parsed.circuit.nodes[0].id).toBe('a');
        expect(parsed.circuit.nodes[1].id).toBe('b');
        expect(parsed.circuit.nodes[1].position).toEqual({ x: 10, y: 20 });
        expect(parsed.circuit.nodes[1].state).toEqual({ isOn: 1 });
    });
    it('rejects unsupported project versions', () => {
        expect(() => decodeRBProject('{"kind":"rb-project","version":2}')).toThrow();
    });
});
