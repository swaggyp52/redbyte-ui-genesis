## RedByte Basys 3 XDC Preset — Minimal LEDs
## Board: Basys 3 (xc7a35tcpg236-1)
## Teaching-first ports: clk, led[0]

## Clock signal (100 MHz)
set_property -dict { PACKAGE_PIN W5   IOSTANDARD LVCMOS33 } [get_ports clk]
create_clock -add -name sys_clk_pin -period 10.00 -waveform {0 5} [get_ports clk]

## LED
set_property -dict { PACKAGE_PIN U16  IOSTANDARD LVCMOS33 } [get_ports {led[0]}]

