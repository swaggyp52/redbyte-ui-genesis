import { describe, it, expect } from 'vitest';
import { parseVhdl } from '../vhdlImport';

const ENTITY_WITH_PROCESS = `
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
entity top is
  Port ( clk : in STD_LOGIC; out_y : out STD_LOGIC);
end top;
architecture Behavioral of top is
begin
  process(clk)
  begin
    out_y <= clk;
  end process;
end Behavioral;
`;

const ENTITY_WITH_ASSIGNMENT = `
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
entity top is
  Port ( in_a : in STD_LOGIC; in_b : in STD_LOGIC; out_y : out STD_LOGIC);
end top;
architecture Behavioral of top is
  signal tmp : STD_LOGIC;
begin
  out_y <= in_a AND in_b;
  tmp <= in_a OR in_b;
end Behavioral;
`;

describe('parseVhdl diagnostics', () => {
  it('Tier A: no entity → warning has no line', () => {
    const result = parseVhdl('-- empty file\n');
    expect(result.warnings.length).toBeGreaterThan(0);
    const w = result.warnings[0];
    expect(w.message).toContain('No entity declaration found');
    expect(w.line).toBeUndefined();
  });

  it('Tier A: process block → warning has no line', () => {
    const result = parseVhdl(ENTITY_WITH_PROCESS);
    const w = result.warnings.find((x) => x.message.includes('PROCESS'));
    expect(w).toBeDefined();
    expect(w!.line).toBeUndefined();
  });

  it('Tier B: complex signal assignment → warning has line pointing to lhs', () => {
    const result = parseVhdl(ENTITY_WITH_ASSIGNMENT);
    const w = result.warnings.find((x) => x.message.includes('not fully supported'));
    expect(w).toBeDefined();
    // out_y is on line 10 (1-based) in the source above
    expect(typeof w!.line).toBe('number');
    expect(w!.line).toBeGreaterThan(0);
    // Verify the line actually contains out_y
    const lines = ENTITY_WITH_ASSIGNMENT.split('\n');
    expect(lines[(w!.line ?? 1) - 1]).toContain('out_y');
  });
});
