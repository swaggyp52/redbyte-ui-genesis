import { describe, it, expect } from 'vitest';
import { parseVerilog } from '../verilogImport';

const MODULE_WITH_ALWAYS = `
module top(input clk, output reg out_y);
  always @(posedge clk) begin
    out_y <= 1;
  end
endmodule
`;

const MODULE_WITH_COMPLEX_ASSIGN = `
module top(input in_a, input in_b, output out_y);
  assign out_y = in_a & in_b;
endmodule
`;

describe('parseVerilog diagnostics', () => {
  it('Tier A: no module → warning has no line', () => {
    const result = parseVerilog('// empty\n');
    expect(result.warnings.length).toBeGreaterThan(0);
    const w = result.warnings[0];
    expect(w.message).toContain('No module declaration found');
    expect(w.line).toBeUndefined();
  });

  it('Tier A: always block → warning has no line', () => {
    const result = parseVerilog(MODULE_WITH_ALWAYS);
    const w = result.warnings.find((x) => x.message.includes('always'));
    expect(w).toBeDefined();
    expect(w!.line).toBeUndefined();
  });

  it('Tier B: complex assign → warning carries line pointing to lhs', () => {
    const result = parseVerilog(MODULE_WITH_COMPLEX_ASSIGN);
    const w = result.warnings.find((x) => x.message.includes('operator expression'));
    expect(w).toBeDefined();
    expect(typeof w!.line).toBe('number');
    expect(w!.line).toBeGreaterThan(0);
    const lines = MODULE_WITH_COMPLEX_ASSIGN.split('\n');
    expect(lines[(w!.line ?? 1) - 1]).toContain('out_y');
  });
});
