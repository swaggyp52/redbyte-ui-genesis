import { describe, test, expect } from 'vitest';
import { generateWrapperVerilog, buildSampleTemplate } from '../src/wrapper.js';
describe('Timestamp Protocol Compatibility', () => {
    describe('Wrapper Generator (wrapper.js)', () => {
        test('JSON template includes t_ms field', () => {
            const { template } = buildSampleTemplate();
            expect(template).toContain('"t_ms":"0x');
            const parsed = JSON.parse(template);
            expect(parsed).toHaveProperty('t_ms');
            expect(parsed.t_ms).toMatch(/^0x[0-9a-fA-F]+$/);
        });
        test('Verilog update logic includes t_ms update', () => {
            const verilog = generateWrapperVerilog({
                boardModelId: 'basys3',
                clockHz: 100000000,
                pinmapHash: '123',
                designHash: 'abc',
                buildId: 'test',
                studentTop: 'module top(); endmodule'
            });
            // Verify t_ms calculation exists
            // Verify t_ms calculation exists
            expect(verilog).toContain('localparam integer CYCLES_PER_MS = CLK_HZ / 1000;');
            expect(verilog).toContain('time_ms = ms_counter;');
            // Verify standard hex assignment lines exist
            expect(verilog).toContain('hex_char(time_ms[31:28])');
            expect(verilog).toContain('hex_char(time_ms[3:0])');
        });
        test('Determinism check', () => {
            const v1 = generateWrapperVerilog({
                boardModelId: 'basys3',
                clockHz: 100000000,
                pinmapHash: '123',
                designHash: 'abc',
                buildId: 'test',
                studentTop: 'module top(); endmodule'
            });
            const v2 = generateWrapperVerilog({
                boardModelId: 'basys3',
                clockHz: 100000000,
                pinmapHash: '123',
                designHash: 'abc',
                buildId: 'test',
                studentTop: 'module top(); endmodule'
            });
            expect(v1).toBe(v2);
        });
    });
});
