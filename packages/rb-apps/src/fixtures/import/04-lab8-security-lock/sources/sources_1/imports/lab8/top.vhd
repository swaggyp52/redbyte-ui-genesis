library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity top is
  Port (
    SW : in  STD_LOGIC_VECTOR(8 downto 4);
    LED1 : out STD_LOGIC
  );
end entity top;

architecture Behavioral of top is
  signal and_0 : STD_LOGIC;
  signal and_1 : STD_LOGIC;
  signal and_2 : STD_LOGIC;
  signal and_3 : STD_LOGIC;
  signal and_4 : STD_LOGIC;
  signal and_5 : STD_LOGIC;
  signal and_6 : STD_LOGIC;
  signal and_7 : STD_LOGIC;
  signal dff_0 : STD_LOGIC;
  signal dff_0_inv : STD_LOGIC;
  signal dff_1 : STD_LOGIC;
  signal dff_1_inv : STD_LOGIC;
  signal dff_2 : STD_LOGIC;
  signal dff_2_inv : STD_LOGIC;
  signal dff_3 : STD_LOGIC;
  signal dff_3_inv : STD_LOGIC;
  signal dff_4 : STD_LOGIC;
  signal dff_4_inv : STD_LOGIC;
  signal dff_5 : STD_LOGIC;
  signal dff_5_inv : STD_LOGIC;
  signal dff_6 : STD_LOGIC;
  signal dff_6_inv : STD_LOGIC;
  signal dff_7 : STD_LOGIC;
  signal dff_7_inv : STD_LOGIC;
  signal not_0 : STD_LOGIC;
  signal not_1 : STD_LOGIC;
  signal not_2 : STD_LOGIC;
  signal not_3 : STD_LOGIC;
  signal or_0 : STD_LOGIC;
  signal xor_0 : STD_LOGIC;
begin
  and_0 <= not_2 and not_3;
  and_1 <= dff_6 and not_3;
  and_2 <= not_2 and dff_7;
  and_3 <= and_2 and not_1;
  and_4 <= and_3 and xor_0;
  and_5 <= dff_2 and and_4;
  and_6 <= dff_3 and and_4;
  and_7 <= dff_4 and and_4;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_0 <= '0';
    elsif rising_edge(SW(5)) then
      if and_0 = '1' then
        dff_0 <= SW(6);
      end if;
    end if;
  end process;
  dff_0_inv <= not dff_0;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_1 <= '0';
    elsif rising_edge(SW(5)) then
      if and_1 = '1' then
        dff_1 <= SW(6);
      end if;
    end if;
  end process;
  dff_1_inv <= not dff_1;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_2 <= '0';
    elsif rising_edge(SW(5)) then
      if and_2 = '1' then
        dff_2 <= and_4;
      end if;
    end if;
  end process;
  dff_2_inv <= not dff_2;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_3 <= '0';
    elsif rising_edge(SW(5)) then
      if and_2 = '1' then
        dff_3 <= and_5;
      end if;
    end if;
  end process;
  dff_3_inv <= not dff_3;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_4 <= '0';
    elsif rising_edge(SW(5)) then
      if and_2 = '1' then
        dff_4 <= and_6;
      end if;
    end if;
  end process;
  dff_4_inv <= not dff_4;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_5 <= '0';
    elsif rising_edge(SW(5)) then
      if and_2 = '1' then
        dff_5 <= and_7;
      end if;
    end if;
  end process;
  dff_5_inv <= not dff_5;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_6 <= '0';
    elsif rising_edge(SW(5)) then
      dff_6 <= not_0;
    end if;
  end process;
  dff_6_inv <= not dff_6;
  process (SW(5), SW(4))
  begin
    if SW(4) = '1' then
      dff_7 <= '0';
    elsif rising_edge(SW(5)) then
      dff_7 <= dff_6;
    end if;
  end process;
  dff_7_inv <= not dff_7;
  not_0 <= not or_0;
  not_1 <= not SW(6);
  not_2 <= not dff_6;
  not_3 <= not dff_7;
  or_0 <= dff_6 or dff_7;
  xor_0 <= dff_0 xor dff_1;
  LED1 <= dff_5;
end architecture Behavioral;
