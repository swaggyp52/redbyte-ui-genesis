// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { CircuitEngine } from '../CircuitEngine';

/**
 * Phase 2 Task 2.1.3: Sequential Logic Verification
 * Tests for flip-flops, registers, and edge-triggered behavior
 */
describe('Sequential Logic (Phase 2 Task 2.1.3)', () => {
    describe('D Flip-Flop', () => {
        it('should capture input on rising clock edge (0→1)', () => {
            const circuit = {
                nodes: [
                    { id: 'data', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 1 } },
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 50 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'ff', type: 'D_FLIP_FLOP', position: { x: 100, y: 25 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                ],
                connections: [
                    { from: { nodeId: 'data', portName: 'out' }, to: { nodeId: 'ff', portName: 'd' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff', portName: 'clk' } },
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Initial state: clk=0, d=1, q=0
            engine.tick();
            let ffOutputs = engine.getNodeOutputs('ff');
            expect(ffOutputs.q).toBe(0); // No edge yet

            // Rising edge: clk 0→1
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            ffOutputs = engine.getNodeOutputs('ff');
            expect(ffOutputs.q).toBe(1); // Captured d=1

            // Hold clock high (no edge)
            engine.tick();
            ffOutputs = engine.getNodeOutputs('ff');
            expect(ffOutputs.q).toBe(1); // State preserved
        });

        it('should NOT capture on falling edge (1→0)', () => {
            const circuit = {
                nodes: [
                    { id: 'data', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 50 }, rotation: 0, state: { isOn: 1 } },
                    { id: 'ff', type: 'D_FLIP_FLOP', position: { x: 100, y: 25 }, rotation: 0, state: { q: 1, prevClk: 1 } },
                ],
                connections: [
                    { from: { nodeId: 'data', portName: 'out' }, to: { nodeId: 'ff', portName: 'd' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff', portName: 'clk' } },
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Change data to 0
            engine.setNodeState('data', { isOn: 0 });
            
            // Falling edge: clk 1→0
            engine.setNodeState('clk', { isOn: 0 });
            engine.tick();
            
            const ffOutputs = engine.getNodeOutputs('ff');
            expect(ffOutputs.q).toBe(1); // Should NOT change (rising edge only)
        });

        it('should output complementary qBar signal', () => {
            const circuit = {
                nodes: [
                    { id: 'data', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 1 } },
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 50 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'ff', type: 'D_FLIP_FLOP', position: { x: 100, y: 25 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                ],
                connections: [
                    { from: { nodeId: 'data', portName: 'out' }, to: { nodeId: 'ff', portName: 'd' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff', portName: 'clk' } },
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Rising edge: clk 0→1, d=1
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            
            const ffOutputs = engine.getNodeOutputs('ff');
            expect(ffOutputs.q).toBe(1);
            expect(ffOutputs.qBar).toBe(0); // Complement
        });
    });

    describe('Clock Synchronization', () => {
        it('should synchronize multiple flip-flops on same clock', () => {
            const circuit = {
                nodes: [
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'd1', type: 'SWITCH', position: { x: 0, y: 50 }, rotation: 0, state: { isOn: 1 } },
                    { id: 'd2', type: 'SWITCH', position: { x: 0, y: 100 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'ff1', type: 'D_FLIP_FLOP', position: { x: 100, y: 50 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                    { id: 'ff2', type: 'D_FLIP_FLOP', position: { x: 100, y: 100 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                ],
                connections: [
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff1', portName: 'clk' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff2', portName: 'clk' } },
                    { from: { nodeId: 'd1', portName: 'out' }, to: { nodeId: 'ff1', portName: 'd' } },
                    { from: { nodeId: 'd2', portName: 'out' }, to: { nodeId: 'ff2', portName: 'd' } },
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Rising edge: both should capture
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();

            const ff1Outputs = engine.getNodeOutputs('ff1');
            const ff2Outputs = engine.getNodeOutputs('ff2');
            
            expect(ff1Outputs.q).toBe(1); // d1=1
            expect(ff2Outputs.q).toBe(0); // d2=0
        });

        it('should implement shift register (cascaded flip-flops)', () => {
            const circuit = {
                nodes: [
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'data', type: 'SWITCH', position: { x: 0, y: 50 }, rotation: 0, state: { isOn: 1 } },
                    { id: 'ff1', type: 'D_FLIP_FLOP', position: { x: 100, y: 50 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                    { id: 'ff2', type: 'D_FLIP_FLOP', position: { x: 200, y: 50 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                    { id: 'ff3', type: 'D_FLIP_FLOP', position: { x: 300, y: 50 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                ],
                connections: [
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff1', portName: 'clk' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff2', portName: 'clk' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff3', portName: 'clk' } },
                    { from: { nodeId: 'data', portName: 'out' }, to: { nodeId: 'ff1', portName: 'd' } },
                    { from: { nodeId: 'ff1', portName: 'q' }, to: { nodeId: 'ff2', portName: 'd' } },
                    { from: { nodeId: 'ff2', portName: 'q' }, to: { nodeId: 'ff3', portName: 'd' } },
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Clock 1: data (1) → ff1
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            engine.setNodeState('clk', { isOn: 0 });
            engine.tick();

            expect(engine.getNodeOutputs('ff1').q).toBe(1);
            expect(engine.getNodeOutputs('ff2').q).toBe(0);
            expect(engine.getNodeOutputs('ff3').q).toBe(0);

            // Clock 2: ff1 (1) → ff2
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            engine.setNodeState('clk', { isOn: 0 });
            engine.tick();

            expect(engine.getNodeOutputs('ff1').q).toBe(1);
            expect(engine.getNodeOutputs('ff2').q).toBe(1);
            expect(engine.getNodeOutputs('ff3').q).toBe(0);

            // Clock 3: ff2 (1) → ff3
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            engine.setNodeState('clk', { isOn: 0 });
            engine.tick();

            expect(engine.getNodeOutputs('ff1').q).toBe(1);
            expect(engine.getNodeOutputs('ff2').q).toBe(1);
            expect(engine.getNodeOutputs('ff3').q).toBe(1);
        });
    });

    describe('Counter Circuit (4-bit)', () => {
        it('should increment on each clock pulse', () => {
            // Simple 2-bit counter using T flip-flops (toggle on clock)
            // Simulated with D flip-flops + XOR feedback
            const circuit = {
                nodes: [
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'ff0', type: 'D_FLIP_FLOP', position: { x: 100, y: 0 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                    { id: 'not0', type: 'NOT', position: { x: 150, y: 0 }, rotation: 0, config: {} },
                ],
                connections: [
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff0', portName: 'clk' } },
                    { from: { nodeId: 'ff0', portName: 'q' }, to: { nodeId: 'not0', portName: 'in' } },
                    { from: { nodeId: 'not0', portName: 'out' }, to: { nodeId: 'ff0', portName: 'd' } }, // Toggle: d = NOT q
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Initial: count = 0
            engine.tick();
            expect(engine.getNodeOutputs('ff0').q).toBe(0);

            // Clock pulse 1: count = 1
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            engine.setNodeState('clk', { isOn: 0 });
            engine.tick();
            expect(engine.getNodeOutputs('ff0').q).toBe(1);

            // Clock pulse 2: count = 0 (wraps)
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            engine.setNodeState('clk', { isOn: 0 });
            engine.tick();
            expect(engine.getNodeOutputs('ff0').q).toBe(0);
        });
    });

    describe('Clock Component', () => {
        it('should oscillate at configured period', () => {
            const circuit = {
                nodes: [
                    { id: 'clk', type: 'Clock', position: { x: 0, y: 0 }, rotation: 0, config: { period: 4 }, state: { tickCount: 0 } },
                ],
                connections: [],
            };

            const engine = new CircuitEngine(circuit);

            // Period = 4: high for 2 ticks, low for 2 ticks
            engine.tick(); // tick 0: high
            expect(engine.getNodeOutputs('clk').out).toBe(1);

            engine.tick(); // tick 1: high
            expect(engine.getNodeOutputs('clk').out).toBe(1);

            engine.tick(); // tick 2: low
            expect(engine.getNodeOutputs('clk').out).toBe(0);

            engine.tick(); // tick 3: low
            expect(engine.getNodeOutputs('clk').out).toBe(0);

            engine.tick(); // tick 4: high (cycle repeats)
            expect(engine.getNodeOutputs('clk').out).toBe(1);
        });
    });

    describe('Race Condition Prevention', () => {
        it('should evaluate in topological order to prevent races', () => {
            // Chain: input → gate → ff → output
            // All should update in same tick without race
            const circuit = {
                nodes: [
                    { id: 'in', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 1 } },
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 50 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'not', type: 'NOT', position: { x: 50, y: 0 }, rotation: 0, config: {} },
                    { id: 'ff', type: 'D_FLIP_FLOP', position: { x: 100, y: 0 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                    { id: 'out', type: 'OUTPUT', position: { x: 150, y: 0 }, rotation: 0, config: {} },
                ],
                connections: [
                    { from: { nodeId: 'in', portName: 'out' }, to: { nodeId: 'not', portName: 'in' } },
                    { from: { nodeId: 'not', portName: 'out' }, to: { nodeId: 'ff', portName: 'd' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff', portName: 'clk' } },
                    { from: { nodeId: 'ff', portName: 'q' }, to: { nodeId: 'out', portName: 'in' } },
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Setup: in=1 → not=0 → ff.d=0
            engine.tick();

            // Rising edge: should capture NOT(in) = 0
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();

            expect(engine.getNodeOutputs('ff').q).toBe(0);
            expect(engine.getNodeState('out')?.isOn).toBe(0);
        });
    });

    describe('State Persistence', () => {
        it('should maintain flip-flop state across multiple ticks', () => {
            const circuit = {
                nodes: [
                    { id: 'data', type: 'SWITCH', position: { x: 0, y: 0 }, rotation: 0, state: { isOn: 1 } },
                    { id: 'clk', type: 'SWITCH', position: { x: 0, y: 50 }, rotation: 0, state: { isOn: 0 } },
                    { id: 'ff', type: 'D_FLIP_FLOP', position: { x: 100, y: 25 }, rotation: 0, state: { q: 0, prevClk: 0 } },
                ],
                connections: [
                    { from: { nodeId: 'data', portName: 'out' }, to: { nodeId: 'ff', portName: 'd' } },
                    { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'ff', portName: 'clk' } },
                ],
            };

            const engine = new CircuitEngine(circuit);

            // Capture: clk 0→1, d=1
            engine.setNodeState('clk', { isOn: 1 });
            engine.tick();
            expect(engine.getNodeOutputs('ff').q).toBe(1);

            // Lower clock
            engine.setNodeState('clk', { isOn: 0 });

            // Change data input
            engine.setNodeState('data', { isOn: 0 });

            // Run 10 ticks with no clock edge
            for (let i = 0; i < 10; i++) {
                engine.tick();
                expect(engine.getNodeOutputs('ff').q).toBe(1); // State preserved
            }
        });
    });
});
