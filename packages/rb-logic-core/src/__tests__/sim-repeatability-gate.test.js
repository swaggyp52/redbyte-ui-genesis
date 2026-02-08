import { describe, it, expect } from 'vitest';
// Ensure NodeRegistry is populated for CircuitEngine.
import '../index';
import { CircuitEngine } from '../CircuitEngine';
function snapshotSignals(engine) {
    return Array.from(engine.getAllSignals().entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
function runFixture() {
    const circuit = {
        nodes: [
            { id: 'clk', type: 'Clock', config: { period: 4 }, state: { tickCount: 0 } },
            { id: 'd1', type: 'Delay', config: { delay: 2 }, state: { buffer: [] } },
            { id: 'out', type: 'OUTPUT', state: {} },
        ],
        connections: [
            { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'd1', portName: 'in' } },
            { from: { nodeId: 'd1', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
        ],
    };
    const engine = new CircuitEngine(circuit);
    const trace = [];
    for (let t = 0; t < 12; t++) {
        engine.tick();
        trace.push({
            tick: t,
            signals: snapshotSignals(engine),
            out: engine.getNodeState('out')?.isOn ?? 0,
        });
    }
    return trace;
}
describe('sim:repeatability-gate', () => {
    it('produces identical trace on repeated run', () => {
        const a = runFixture();
        const b = runFixture();
        expect(a).toEqual(b);
    });
    it('matches expected delayed clock pattern (sanity)', () => {
        const trace = runFixture();
        const outs = trace.map((e) => e.out);
        expect(outs).toEqual([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
    });
});
