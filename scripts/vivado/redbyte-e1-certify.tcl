# RedByte Vivado E1 certification flow.
#
# E1 boundary:
#   E1a import/open project
#   E1b VHDL compile order/elaboration readiness
#   E1c behavioral simulation/testbench, when a sim_1 testbench exists
#   E1d synthesis
#   E1e optional implementation dry run through route_design, without bitstream
#
# Usage:
#   vivado -mode batch -source scripts/vivado/redbyte-e1-certify.tcl -notrace -nojournal \
#     -log <design-out>/logs/vivado.log -tclargs <path-to.xpr> <design-out> [jobs] [includeImplementation]

proc json_escape {value} {
  set out $value
  regsub -all {\\} $out {\\\\} out
  regsub -all {"} $out {\\"} out
  regsub -all "\n" $out {\\n} out
  regsub -all "\r" $out {\\r} out
  regsub -all "\t" $out {\\t} out
  return $out
}

proc write_result {out_dir classification stage message} {
  file mkdir $out_dir
  set path [file join $out_dir "e1-result.json"]
  set fh [open $path "w"]
  puts $fh "{"
  puts $fh "  \"schema\": \"redbyte.vivado-e1.tcl-result.v1\","
  puts $fh "  \"generatedAt\": \"[clock format [clock seconds] -gmt true -format {%Y-%m-%dT%H:%M:%SZ}]\","
  puts $fh "  \"classification\": \"[json_escape $classification]\","
  puts $fh "  \"stage\": \"[json_escape $stage]\","
  puts $fh "  \"message\": \"[json_escape $message]\""
  puts $fh "}"
  close $fh
}

if {$argc < 2} {
  puts "ERROR: usage: redbyte-e1-certify.tcl <path-to.xpr> <design-out> \[jobs\] \[includeImplementation\]"
  exit 1
}

set xpr_path [file normalize [lindex $argv 0]]
set out_dir [file normalize [lindex $argv 1]]
set logs_dir [file join $out_dir "logs"]
file mkdir $logs_dir

set jobs 4
if {$argc >= 3} {
  set jobs [lindex $argv 2]
}

set include_impl false
if {$argc >= 4} {
  set include_impl_raw [string tolower [lindex $argv 3]]
  if {$include_impl_raw eq "true" || $include_impl_raw eq "1" || $include_impl_raw eq "yes"} {
    set include_impl true
  }
}

if {![file exists $xpr_path]} {
  set msg ".xpr not found: $xpr_path"
  puts "ERROR: $msg"
  write_result $out_dir "FAIL_IMPORT" "E1a-import" $msg
  exit 2
}

puts "RedByte E1: opening project $xpr_path"
if {[catch {open_project $xpr_path} err]} {
  puts "ERROR: open_project failed: $err"
  write_result $out_dir "FAIL_IMPORT" "E1a-import" $err
  exit 2
}

set project_dir [get_property DIRECTORY [current_project]]
set src_fs [get_filesets sources_1]
set top [get_property TOP $src_fs]
puts "RedByte E1: top module = $top"
puts "RedByte E1: project dir = $project_dir"

if {[catch {update_compile_order -fileset $src_fs} err]} {
  puts "ERROR: update_compile_order failed: $err"
  write_result $out_dir "FAIL_COMPILE" "E1b-compile-order" $err
  close_project
  exit 3
}

set compile_report [file join $out_dir "compile-order-sources_1.txt"]
if {[catch {report_compile_order -fileset $src_fs -file $compile_report -force} err]} {
  puts "WARN: report_compile_order failed: $err"
}

set sim_fs [get_filesets -quiet sim_1]
if {[llength $sim_fs] > 0} {
  puts "RedByte E1: launching behavioral simulation..."
  set_property top tb_top [get_filesets sim_1]
  if {[catch {
    launch_simulation -mode behavioral
    run all
    close_sim
  } err]} {
    puts "ERROR: behavioral simulation/testbench failed: $err"
    write_result $out_dir "FAIL_TESTBENCH" "E1c-behavioral-sim" $err
    close_project
    exit 4
  }
} else {
  puts "RedByte E1: no sim_1 fileset found; E1c skipped."
}

puts "RedByte E1: launching synth_1 (jobs=$jobs)..."
if {[catch {
  reset_run synth_1
  launch_runs synth_1 -jobs $jobs
  wait_on_run synth_1
} err]} {
  puts "ERROR: synth_1 launch failed: $err"
  write_result $out_dir "FAIL_SYNTH" "E1d-synthesis" $err
  close_project
  exit 5
}

set synth_run [get_runs synth_1]
set synth_status [get_property STATUS $synth_run]
puts "RedByte E1: synth_1 STATUS = $synth_status"

if {$synth_status ne "synth_design Complete!"} {
  set msg "synth_1 did not complete successfully: $synth_status"
  puts "ERROR: $msg"
  write_result $out_dir "FAIL_SYNTH" "E1d-synthesis" $msg
  close_project
  exit 5
}

catch {report_utilization -file [file join $out_dir "synth-utilization.rpt"] -force}
catch {report_timing_summary -file [file join $out_dir "synth-timing-summary.rpt"] -force}

if {$include_impl} {
  puts "RedByte E1: launching impl_1 through route_design (jobs=$jobs; no bitstream)..."
  if {[catch {
    reset_run impl_1
    launch_runs impl_1 -jobs $jobs -to_step route_design
    wait_on_run impl_1
  } err]} {
    puts "ERROR: impl_1 route dry run failed: $err"
    write_result $out_dir "FAIL_IMPL_DRY_RUN" "E1e-implementation-dry-run" $err
    close_project
    exit 6
  }

  set impl_run [get_runs impl_1]
  set impl_status [get_property STATUS $impl_run]
  puts "RedByte E1: impl_1 STATUS = $impl_status"
  if {![string match "*Complete!" $impl_status]} {
    set msg "impl_1 route dry run did not complete successfully: $impl_status"
    puts "ERROR: $msg"
    write_result $out_dir "FAIL_IMPL_DRY_RUN" "E1e-implementation-dry-run" $msg
    close_project
    exit 6
  }
}

puts "RedByte E1: PASS_E1"
write_result $out_dir "PASS_E1" "E1d-synthesis" "Import, compile order, behavioral simulation when present, and synthesis completed. No bitstream or board observation was attempted."
close_project
exit 0
