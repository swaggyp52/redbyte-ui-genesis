-- Full Adder (Basys3)
-- 1-bit full adder: inputs A, B, Cin → outputs Sum, Cout
-- SW0=A, SW1=B, SW2=Cin → LD0=Sum, LD1=Cout

library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    SW0 : in  std_logic;  -- A
    SW1 : in  std_logic;  -- B
    SW2 : in  std_logic;  -- Cin
    LD0 : out std_logic;  -- Sum
    LD1 : out std_logic   -- Cout
  );
end entity top;

architecture rtl of top is
begin
  u0 : entity work.FullAdder port map (
    A   => SW0,
    B   => SW1,
    Cin => SW2,
    Sum => LD0,
    Cout => LD1
  );
end architecture rtl;
