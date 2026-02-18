## Basys3 XDC for 4-bit Counter (Vivado-ish formatting)

# Clock (common Vivado style—no space before brace)
set_property PACKAGE_PIN W5 [get_ports{clk}]
set_property IOSTANDARD LVCMOS33 [get_ports {clk}]

# Clock constraint (v1 will warn/ignore, but should not crash)
create_clock -add -name sys_clk_pin -period 10.00 -waveform {0 5} [get_ports clk]

# Reset (normal spacing)
set_property PACKAGE_PIN L19 [get_ports {rst}]
set_property IOSTANDARD LVCMOS33 [get_ports {rst}]

# Counter enable
set_property PACKAGE_PIN L20 [get_ports {count_en}]
set_property IOSTANDARD LVCMOS33 [get_ports {count_en}]

# Outputs (individual bits)
set_property PACKAGE_PIN U16 [get_ports {q0}]
set_property IOSTANDARD LVCMOS33 [get_ports {q0}]

set_property PACKAGE_PIN E19 [get_ports {q1}]
set_property IOSTANDARD LVCMOS33 [get_ports {q1}]

set_property PACKAGE_PIN U19 [get_ports {q2}]
set_property IOSTANDARD LVCMOS33 [get_ports {q2}]

set_property PACKAGE_PIN V19 [get_ports {q3}]
set_property IOSTANDARD LVCMOS33 [get_ports {q3}]
