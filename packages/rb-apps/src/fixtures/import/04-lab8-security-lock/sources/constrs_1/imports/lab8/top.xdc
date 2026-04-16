# RedByte Basys3 Constraints (deterministic)
# Generated for top module: top
# Timing: Sequential design (latch-based) — create_clock intentionally omitted.
# Vivado timing/power warnings for unconstrained paths are expected and non-blocking.
# CLOCK_BUFFER_TYPE NONE applied to all switch/button ports to prevent synthesis clock-buffer insertion.

## Switches
set_property PACKAGE_PIN V15 [get_ports {SW[5]}]
set_property IOSTANDARD LVCMOS33 [get_ports {SW[5]}]
set_property CLOCK_BUFFER_TYPE NONE [get_ports {SW[5]}]
set_property PACKAGE_PIN W14 [get_ports {SW[6]}]
set_property IOSTANDARD LVCMOS33 [get_ports {SW[6]}]
set_property CLOCK_BUFFER_TYPE NONE [get_ports {SW[6]}]
set_property PACKAGE_PIN W13 [get_ports {SW[7]}]
set_property IOSTANDARD LVCMOS33 [get_ports {SW[7]}]
set_property CLOCK_BUFFER_TYPE NONE [get_ports {SW[7]}]
set_property PACKAGE_PIN V2 [get_ports {SW[8]}]
set_property IOSTANDARD LVCMOS33 [get_ports {SW[8]}]
set_property CLOCK_BUFFER_TYPE NONE [get_ports {SW[8]}]
set_property PACKAGE_PIN W15 [get_ports {SW[4]}]
set_property IOSTANDARD LVCMOS33 [get_ports {SW[4]}]
set_property CLOCK_BUFFER_TYPE NONE [get_ports {SW[4]}]

## LEDs
set_property PACKAGE_PIN E19 [get_ports {LED1}]
set_property IOSTANDARD LVCMOS33 [get_ports {LED1}]

## Manual switch timing
# Treat switch/button driven state changes as asynchronous event sources in Vivado timing analysis.
# Human-speed ENTER/RESET activity should not be timed like an FPGA clock domain.
set_false_path -from [get_ports {SW[5]}]
set_false_path -from [get_ports {SW[6]}]
set_false_path -from [get_ports {SW[7]}]
set_false_path -from [get_ports {SW[8]}]
set_false_path -from [get_ports {SW[4]}]
