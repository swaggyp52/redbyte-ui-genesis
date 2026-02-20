-- AND Gate (Basys3)
-- Simple 2-input AND gate demonstrating structural HDL import.
-- Input SW0, SW1 → Output LD0

library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    SW0 : in  std_logic;
    SW1 : in  std_logic;
    LD0 : out std_logic
  );
end entity top;

architecture rtl of top is
begin
  u0 : entity work.AND2 port map (A => SW0, B => SW1, Y => LD0);
end architecture rtl;
