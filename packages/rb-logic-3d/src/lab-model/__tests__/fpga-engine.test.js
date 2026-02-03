import { describe, it, expect, beforeEach } from 'vitest';
import { FpgaSimEngine } from '../fpga-sim/engine';
describe('FpgaSimEngine', () => {
    let engine;
    beforeEach(() => {
        engine = new FpgaSimEngine('passthrough');
    });
    it('should initialize with empty state', () => {
        expect(engine.getState().outputs).toEqual({});
        expect(engine.getState().internal).toEqual({});
    });
    it('passthrough preset should map SW to LED immediately', () => {
        // Tick 1: Set SW0 high
        const changes = engine.tick({ 'SW0': 1 });
        expect(changes['LED0']).toBe(1);
        expect(engine.getState().outputs['LED0']).toBe(1);
        // Tick 2: Set SW0 low
        const changes2 = engine.tick({ 'SW0': 0 });
        expect(changes2['LED0']).toBe(0);
        expect(engine.getState().outputs['LED0']).toBe(0);
    });
    it('blink preset should toggle LED0 every 10 ticks', () => {
        engine.setPreset('blink');
        // 0-9: LED0 ON
        let changes = engine.tick({});
        expect(engine.getState().outputs['LED0']).toBe(1);
        // Advance 9 more ticks (total 10)
        for (let i = 0; i < 9; i++)
            engine.tick({});
        // Tick 10: Should flip to OFF
        changes = engine.tick({});
        expect(changes['LED0']).toBe(0); // Changed to 0
        expect(engine.getState().outputs['LED0']).toBe(0);
        // Advance 9 more ticks (total 20)
        for (let i = 0; i < 9; i++)
            engine.tick({});
        // Tick 20: Should flip back to ON
        changes = engine.tick({});
        expect(changes['LED0']).toBe(1);
    });
    it('counter preset should count on BTN0 rising edge', () => {
        engine.setPreset('counter');
        // Initial state: 0
        engine.tick({ 'BTN0': 0 });
        expect(engine.getState().internal.count).toBe(0);
        // Press BTN0 (Rising Edge) -> Count 1
        engine.tick({ 'BTN0': 1 });
        expect(engine.getState().internal.count).toBe(1);
        expect(engine.getState().outputs['LED0']).toBe(1);
        // Hold BTN0 -> Count stays 1
        engine.tick({ 'BTN0': 1 });
        expect(engine.getState().internal.count).toBe(1);
        // Release BTN0 -> Count stays 1
        engine.tick({ 'BTN0': 0 });
        expect(engine.getState().internal.count).toBe(1);
        // Press BTN0 again -> Count 2
        engine.tick({ 'BTN0': 1 });
        expect(engine.getState().internal.count).toBe(2);
        expect(engine.getState().outputs['LED0']).toBe(0);
        expect(engine.getState().outputs['LED1']).toBe(1);
    });
});
