# RedByte — canonical non-interactive Vivado flow (synth_1 → impl_1 incl. write_bitstream)
#
# Usage (PowerShell, from repo root or any cwd):
#   & "C:\Xilinx\Vivado\2024.2\bin\vivado.bat" -mode batch -source scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl -notrace -nojournal -log out/vivado-cert/vivado_batch.log -tclargs "C:\path\to\project\slug\slug.xpr" 4
#
# Args:
#   argv0 — absolute or relative path to the RedByte Open-Project .xpr
#   argv1 — optional parallel job count (default 4)
#
# Exit codes:
#   0 — success; bitstream found under <project_dir>/*.runs/impl_1/
#   1 — bad usage or missing .xpr
#   3 — synthesis did not report synth_design Complete!
#   4 — implementation did not route/write_bitstream successfully
#   5 — flow reported complete but no .bit file found

if {$argc < 1} {
  puts "ERROR: usage: vivado -mode batch -source redbyte_batch_synth_impl_bitstream.tcl -tclargs <path-to.xpr> \[jobs\]"
  exit 1
}

set xpr_path [file normalize [lindex $argv 0]]
set jobs 4
if {$argc >= 2} {
  set jobs [lindex $argv 1]
}

if {![file exists $xpr_path]} {
  puts "ERROR: .xpr not found: $xpr_path"
  exit 1
}

puts "RedByte batch: opening $xpr_path"
open_project $xpr_path

set src_fs [get_filesets sources_1]
set top [get_property TOP $src_fs]
puts "RedByte batch: top module = $top"

update_compile_order -fileset $src_fs

puts "RedByte batch: launching synth_1 (jobs=$jobs)..."
reset_run synth_1
launch_runs synth_1 -jobs $jobs
wait_on_run synth_1

set synth_run [get_runs synth_1]
set synth_status [get_property STATUS $synth_run]
puts "RedByte batch: synth_1 STATUS = $synth_status"

if {$synth_status ne "synth_design Complete!"} {
  puts "ERROR: synthesis did not complete successfully (see Vivado logs under project .runs)"
  exit 3
}

puts "RedByte batch: launching impl_1 through write_bitstream (jobs=$jobs)..."
reset_run impl_1
launch_runs impl_1 -jobs $jobs -to_step write_bitstream
wait_on_run impl_1

set impl_run [get_runs impl_1]
set impl_status [get_property STATUS $impl_run]
puts "RedByte batch: impl_1 STATUS = $impl_status"

if {$impl_status ne "write_bitstream Complete!"} {
  puts "ERROR: implementation / bitstream did not complete successfully"
  exit 4
}

set proj_dir [get_property DIRECTORY [current_project]]
set glob_pattern [file join $proj_dir *runs impl_1 *.bit]
set candidates [glob -nocomplain -type f $glob_pattern]

if {[llength $candidates] < 1} {
  puts "ERROR: no .bit under $proj_dir/*runs/impl_1/"
  exit 5
}

set bit_path [lindex $candidates 0]
puts "RedByte batch: BITSTREAM = $bit_path"
puts "RedByte batch: SUCCESS"

close_project
exit 0
