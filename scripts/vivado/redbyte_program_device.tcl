# RedByte — batch program Basys3 (or any detected xc7a*) via Vivado Hardware Manager
#
# Prerequisites:
#   - Board powered, USB-JTAG connected, Basys3 JP1 = JTAG if applicable
#   - Vivado hw_server reachable (local default, or remote URL)
#   - Valid .bit from synth/impl (e.g. after redbyte_batch_synth_impl_bitstream.tcl)
#
# Usage (PowerShell):
#   & "C:\Xilinx\Vivado\2024.2\bin\vivado.bat" -mode batch -source scripts/vivado/redbyte_program_device.tcl -notrace -nojournal -log out/vivado-cert/vivado_program.log -tclargs "C:\path\to\top.bit"
#
# Remote hw_server (optional second arg):
#   ... -tclargs "C:\path\to\top.bit" "192.168.1.10:3121"
#
# Exit codes:
#   0 — program_hw_devices completed
#   1 — bad usage or missing .bit
#   2 — no hardware device found
#   3 — programming failed

if {$argc < 1} {
  puts "ERROR: usage: vivado -mode batch -source redbyte_program_device.tcl -tclargs <path-to.bit> \[hw_server_url\]"
  exit 1
}

set bit_path [file normalize [lindex $argv 0]]
if {![file exists $bit_path]} {
  puts "ERROR: bitstream not found: $bit_path"
  exit 1
}

puts "RedByte program: bitstream = $bit_path"

open_hw_manager

if {$argc >= 2 && [string length [lindex $argv 1]] > 0} {
  set srv [lindex $argv 1]
  puts "RedByte program: connect_hw_server -url $srv"
  connect_hw_server -url $srv
} else {
  puts {RedByte program: connect_hw_server (local)}
  connect_hw_server
}

# Lab machines: cable enumeration can lag; refresh before querying targets.
puts {RedByte program: refresh_hw_server}
if {[catch {refresh_hw_server} rerr]} {
  puts "WARNING: refresh_hw_server: $rerr"
}

set servers [get_hw_servers]
puts "RedByte program: hw_servers = [llength $servers]"
if {[llength $servers] < 1} {
  puts "ERROR: no hw_servers after connect — check Vivado cable drivers / installation"
  exit 2
}

set srv0 [lindex $servers 0]
if {[catch {get_hw_targets -of_objects $srv0} hw_targets]} {
  puts "ERROR: get_hw_targets failed on $srv0 — no cable/target visible. Connect Basys3 USB, power, JP1=JTAG; run scripts/vivado/hw_probe.tcl"
  exit 2
}
puts "RedByte program: hw_targets found = [llength $hw_targets]"
if {[llength $hw_targets] < 1} {
  puts "ERROR: no JTAG hw_targets on $srv0 — same checklist as above"
  exit 2
}

puts {RedByte program: open_hw_target (first target)}
set tgt [lindex $hw_targets 0]
if {[catch {open_hw_target $tgt} oht_err]} {
  puts "ERROR: open_hw_target failed: $oht_err"
  exit 2
}

set devices [get_hw_devices]
if {[llength $devices] < 1} {
  puts "ERROR: no hw_devices — check USB cable, drivers, and that hw_server sees the target"
  exit 2
}

set dev [lindex $devices 0]
puts "RedByte program: selected device: $dev"

current_hw_device $dev
refresh_hw_device $dev

set_property PROGRAM.FILE $bit_path $dev
puts "RedByte program: programming..."
if {[catch {program_hw_devices $dev} err]} {
  puts "ERROR: program_hw_devices failed: $err"
  exit 3
}

puts "RedByte program: SUCCESS"
exit 0
