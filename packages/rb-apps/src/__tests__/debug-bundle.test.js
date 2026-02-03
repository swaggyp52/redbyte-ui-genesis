// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { buildDebugBundle } from '../export/debugBundle';
import { createRBProject } from '../export/projectFormat';
describe('debug bundle export', () => {
    it('includes project, netlist, and verilog', () => {
        const circuit = {
            nodes: [
                { id: 'lamp', type: 'Lamp', position: { x: 0, y: 0 }, rotation: 0, config: {} },
                {
                    id: 'switch',
                    type: 'Switch',
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    config: {},
                    state: { isOn: 0 },
                },
            ],
            connections: [
                { from: { nodeId: 'switch', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } },
            ],
        };
        const project = createRBProject({
            createdAt: '2026-01-01T00:00:00.000Z',
            name: 'Debug Bundle',
            circuit,
        });
        const bundle = buildDebugBundle({ project, circuit });
        expect(bundle.kind).toBe('rb-debug-bundle');
        expect(bundle.project.kind).toBe('rb-project');
        expect(bundle.netlist.kind).toBe('rb-netlist');
        expect(bundle.verilog).toContain('module top();');
    });
});
