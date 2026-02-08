import { describe, expect, it, vi, beforeEach } from 'vitest';
import { labReducer } from '../reducer/labReducer';
function makeBaseProject() {
    return {
        schemaVersion: '1.0',
        projectId: 'proj-undo-redo-gate',
        name: 'Undo/Redo Gate',
        description: 'Deterministic fixture for core edit reversibility',
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
        circuit: {
            schemaVersion: '1.0',
            nodes: [],
            connections: [],
            customChips: [],
        },
        simulation: {
            tickRate: 1,
            currentTick: 0,
            probes: [],
        },
        evidence: {
            actions: [],
            snapshots: [],
        },
    };
}
function normalizeForGate(project) {
    const { createdAt: _c, updatedAt: _u, ...rest } = project;
    return rest;
}
function invertAction(stateBefore, action) {
    switch (action.t) {
        case 'circuit/addNode':
            return [{ v: 1, t: 'circuit/deleteNode', p: { nodeId: action.p.nodeId } }];
        case 'circuit/moveNode': {
            const prev = stateBefore.circuit.nodes.find((n) => n.id === action.p.nodeId);
            return prev
                ? [{ v: 1, t: 'circuit/moveNode', p: { nodeId: prev.id, x: prev.x, y: prev.y } }]
                : [];
        }
        case 'circuit/addConnection':
            return [{ v: 1, t: 'circuit/deleteConnection', p: { connectionId: action.p.id } }];
        case 'circuit/deleteConnection': {
            const prev = stateBefore.circuit.connections.find((c) => c.id === action.p.connectionId);
            return prev ? [{ v: 1, t: 'circuit/addConnection', p: prev }] : [];
        }
        case 'circuit/deleteNode': {
            const prevNode = stateBefore.circuit.nodes.find((n) => n.id === action.p.nodeId);
            if (!prevNode)
                return [];
            const prevConnections = stateBefore.circuit.connections.filter((c) => c.fromNodeId === prevNode.id || c.toNodeId === prevNode.id);
            const inverses = [];
            for (const c of prevConnections) {
                inverses.push({ v: 1, t: 'circuit/addConnection', p: c });
            }
            inverses.push({
                v: 1,
                t: 'circuit/addNode',
                p: {
                    nodeId: prevNode.id,
                    componentType: prevNode.type,
                    x: prevNode.x,
                    y: prevNode.y,
                    rotation: prevNode.rotation ?? 0,
                },
            });
            return inverses;
        }
        default:
            // Gate scope: core circuit edits only.
            return [];
    }
}
describe('Undo/redo gate (core labReducer circuit edits are reversible)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-01T12:00:00.000Z'));
    });
    it('can undo and redo a core edit sequence without corrupting circuit references', () => {
        const initial = makeBaseProject();
        const conn = {
            id: 'c1',
            fromNodeId: 'sw1',
            fromPin: 'OUT',
            toNodeId: 'led1',
            toPin: 'IN',
        };
        const actions = [
            { v: 1, t: 'circuit/addNode', p: { nodeId: 'sw1', componentType: 'SWITCH', x: 0, y: 0 } },
            { v: 1, t: 'circuit/addNode', p: { nodeId: 'led1', componentType: 'LED', x: 64, y: 0 } },
            { v: 1, t: 'circuit/addConnection', p: conn },
            { v: 1, t: 'circuit/moveNode', p: { nodeId: 'led1', x: 96, y: 16 } },
            { v: 1, t: 'circuit/deleteNode', p: { nodeId: 'sw1' } },
            { v: 1, t: 'circuit/deleteNode', p: { nodeId: 'led1' } },
        ];
        const inverses = [];
        let state = initial;
        for (const action of actions) {
            const undoActions = invertAction(state, action);
            for (const u of undoActions)
                inverses.push(u);
            state = labReducer(state, action);
        }
        const finalState = state;
        // Undo: pop inverses in LIFO order.
        while (inverses.length > 0) {
            const action = inverses.pop();
            state = labReducer(state, action);
        }
        expect(normalizeForGate(state)).toEqual(normalizeForGate(initial));
        expect(state.circuit.connections.length).toBe(0);
        expect(state.circuit.nodes.length).toBe(0);
        // Redo: apply original sequence again (should match).
        let redoState = initial;
        for (const action of actions) {
            redoState = labReducer(redoState, action);
        }
        expect(normalizeForGate(redoState)).toEqual(normalizeForGate(finalState));
    });
});
