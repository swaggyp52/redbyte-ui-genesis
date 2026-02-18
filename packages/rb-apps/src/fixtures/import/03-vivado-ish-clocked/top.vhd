-- 4-bit Counter (Basys3, Clocked)
-- Demonstrates sequential design: count input, clock, reset.
-- Inputs: clk, rst, count_en → Outputs: q0, q1, q2, q3
-- Real HDL subset pattern: entity port, architecture with clock/reset logic.

library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    clk      : in  std_logic;
    rst      : in  std_logic;
    count_en : in  std_logic;
    q0       : out std_logic;
    q1       : out std_logic;
    q2       : out std_logic;
    q3       : out std_logic
  );
end entity top;

architecture rtl of top is
  signal count_reg  : std_logic_vector(3 downto 0);
  signal count_next : std_logic_vector(3 downto 0);
begin
  -- Combinational: compute next count
  count_next <= count_reg + 1 when count_en = '1' else count_reg;
  
  -- Sequential: register with reset
  process (clk, rst)
  begin
    if rst = '1' then
      count_reg <= (others => '0');
    elsif rising_edge(clk) then
      count_reg <= count_next;
    end if;
  end process;
  
  -- Drive outputs
  q0 <= count_reg(0);
  q1 <= count_reg(1);
  q2 <= count_reg(2);
  q3 <= count_reg(3);
end architecture rtl;

