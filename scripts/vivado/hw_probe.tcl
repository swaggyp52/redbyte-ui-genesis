# RedByte — quick Hardware Manager probe (no bitstream required)
#
# Usage:
#   vivado -mode batch -source scripts/vivado/hw_probe.tcl -notrace -nojournal -log out/vivado-cert/hw_probe.log
#
# Optional remote:
#   ... -tclargs "host:3121"
#
# Exit: 0 if at least one hw_target exists; 2 if none; 1 on usage error

open_hw_manager

if {$argc >= 1 && [string length [lindex $argv 0]] > 0} {
  puts "hw_probe: connect_hw_server -url [lindex $argv 0]"
  connect_hw_server -url [lindex $argv 0]
} else {
  puts {hw_probe: connect_hw_server (local)}
  connect_hw_server
}

if {[catch {refresh_hw_server} e]} {
  puts "hw_probe: refresh_hw_server note: $e"
} else {
  puts {hw_probe: refresh_hw_server ok}
}

set servers [get_hw_servers]
puts "hw_probe: hw_servers = [llength $servers]"
set total_targets 0
foreach s $servers {
  if {[catch {get_hw_targets -of_objects $s} tgts]} {
    puts "hw_probe: get_hw_targets failed for $s"
    continue
  }
  puts "hw_probe: targets on $s = [llength $tgts]"
  set total_targets [expr {$total_targets + [llength $tgts]}]
}

if {$total_targets < 1} {
  puts "hw_probe: FAIL — no targets (Basys3 not visible to hw_server)"
  exit 2
}

puts "hw_probe: PASS — JTAG chain visible"
exit 0
