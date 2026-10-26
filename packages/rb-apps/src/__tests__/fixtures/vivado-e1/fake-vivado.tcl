# FAKE Vivado for RedByte E1 harness tests. This is NOT Vivado and proves nothing about
# xsim. It defines the Vivado Tcl commands redbyte-e1-certify.tcl uses, then sources the
# real script, so the harness's control flow, result file and the PowerShell wrapper's
# acceptance rules can be exercised with chosen tool outcomes.
#
# FAKE_SCENARIO selects the outcome. With FAKE_SCENARIO=ghdl and REDBYTE_GHDL set,
# launch_simulation really analyses, elaborates and runs the package's VHDL in GHDL
# (standing in for xsim), so the verdict comes from executing the generated testbench.

set scenario [expr {[info exists ::env(FAKE_SCENARIO)] ? $::env(FAKE_SCENARIO) : "pass"}]
set raw $argv
if {[lsearch -exact $raw -version] >= 0} { puts "Vivado v2024.2 (FAKE STUB for RedByte harness tests)"; exit 0 }
set src [lindex $raw [expr {[lsearch -exact $raw -source] + 1}]]
set logf [lindex $raw [expr {[lsearch -exact $raw -log] + 1}]]
set ti [lsearch -exact $raw -tclargs]
set ::argv [lrange $raw [expr {$ti + 1}] end]
set ::argc [llength $::argv]
file mkdir [file dirname $logf]
set ::LOG [open $logf w]
proc vlog {msg} { puts $msg; puts $::LOG $msg; flush $::LOG }
vlog "FAKE-VIVADO scenario=$scenario"

set ::xpr ""
set ::sim_top ""
set ::sim_runtime ""

proc proj_dir {} { return [file dirname $::xpr] }
proc proj_name {} { return [file rootname [file tail $::xpr]] }
proc xsim_dir {} { return [file join [proj_dir] "[proj_name].sim" sim_1 behav xsim] }

proc find_vhd {dir} {
  set out {}
  foreach f [glob -nocomplain -directory $dir -types f *.vhd] { lappend out [file normalize $f] }
  foreach d [glob -nocomplain -directory $dir -types d *] { set out [concat $out [find_vhd $d]] }
  return [lsort $out]
}

proc tb_path {} {
  foreach f [find_vhd [file join [proj_dir] "[proj_name].srcs" sim_1]] { return $f }
  return ""
}

proc tb_entity {} {
  set fh [open [tb_path] r]; set text [read $fh]; close $fh
  set name ""
  regexp -line -nocase {^\s*entity\s+([A-Za-z][A-Za-z0-9_]*)\s+is\y} $text -> name
  return $name
}

proc static_checks {} {
  # The pre-fix harness does not source the classifier; load its helpers for baseline replays.
  if {[info commands rb_e1c_count_static_checks] eq ""} { source [file join [file dirname $::src] redbyte-e1-classify.tcl] }
  set fh [open [tb_path] r]; set text [read $fh]; close $fh
  return [rb_e1c_count_static_checks $text]
}

proc write_tb_result {line} {
  file mkdir [xsim_dir]
  set fh [open [file join [xsim_dir] redbyte_tb_result.txt] w]; puts $fh $line; close $fh
}

proc write_sim_log {text} {
  file mkdir [xsim_dir]
  set fh [open [file join [xsim_dir] simulate.log] w]; puts $fh $text; close $fh
}

proc result_line {status checks failures {tb ""}} {
  if {$tb eq ""} { set tb [tb_entity] }
  return "REDBYTE_TB_RESULT v=1 tb=$tb status=$status checks=$checks failures=$failures"
}

proc open_project {p} {
  if {$::scenario eq "exit0-no-result"} { vlog "fake: exiting 0 before writing any result"; exit 0 }
  if {$::scenario eq "forged-result"} {
    set out [lindex $::argv 1]
    set fh [open [file join $out e1-result.json] w]
    puts $fh "{\"schema\": \"redbyte.vivado-e1.tcl-result.v2\", \"runId\": \"forged\", \"classification\": \"PASS_E1\", \"exitCode\": 0, \"stages\": {}}"
    close $fh
    exit 0
  }
  set ::xpr $p
  vlog "fake open_project $p"
}
proc current_project {} { return proj }
proc get_property {name obj} {
  switch -- $name {
    DIRECTORY { return [proj_dir] }
    NAME { return [proj_name] }
    TOP { if {$::scenario eq "harness-crash"} { error "fake: unexpected Tcl error outside any stage catch" }; return top }
    target_simulator { return XSim }
    STATUS {
      if {$obj eq "synth_1" && $::scenario eq "synth-fail"} { return "synth_design ERROR" }
      if {$obj eq "impl_1"} { return "route_design Complete!" }
      return "synth_design Complete!"
    }
  }
  return ""
}
proc get_filesets {args} {
  if {[lsearch -exact $args sim_1] >= 0} { if {$::scenario eq "no-sim"} { return "" }; return sim_1 }
  return [lindex $args end]
}
proc get_files {args} {
  if {[lsearch -exact $args sim_1] >= 0} { set tb [tb_path]; if {$tb eq ""} { return "" }; return [list $tb] }
  return ""
}
proc update_compile_order {args} {}
proc report_compile_order {args} {}
proc set_property {args} {
  if {[lindex $args 0] eq "top" && [lindex $args end] eq "sim_1"} { set ::sim_top [lindex $args 1] }
  if {[lindex $args 0] eq "-name" && [lindex $args 1] eq "xsim.simulate.runtime"} { set ::sim_runtime [lindex $args 3] }
  vlog "fake set_property $args"
}

proc run_ghdl {} {
  set ghdl $::env(REDBYTE_GHDL)
  set design [find_vhd [file join [proj_dir] "[proj_name].srcs" sources_1]]
  file mkdir [xsim_dir]
  set old [pwd]
  cd [xsim_dir]
  set log ""
  set status 0
  foreach step [list [concat [list -a --std=08] $design [list [tb_path]]] [list -e --std=08 $::sim_top] [list -r --std=08 $::sim_top]] {
    if {[catch {exec $ghdl {*}$step 2>@1} out opts]} {
      append log $out\n
      set status 1
      if {[lindex $step 0] ne "-r"} { cd $old; write_sim_log $log; error "ERROR: \[USF-XSim-62\] 'elaborate' step failed with error(s). (fake, ghdl $step)" }
      break
    }
    append log $out\n
  }
  cd $old
  write_sim_log $log
  if {$status} { error "ERROR: \[Simulator 45-1\] simulation stopped by a failure (fake, ghdl)" }
}

proc launch_simulation {args} {
  vlog "fake launch_simulation $args (sim top $::sim_top, runtime $::sim_runtime)"
  if {$::sim_top ne [tb_entity]} { error "ERROR: \[USF-XSim-62\] 'elaborate' step failed with error(s). (fake: top $::sim_top is not the testbench entity)" }
  set n [static_checks]
  switch -- $::scenario {
    ghdl { run_ghdl }
    pass - noisy - vivado-log-conflict - synth-fail - crash137 {
      write_tb_result [result_line PASS $n 0]
      write_sim_log "Note: [result_line PASS $n 0]"
      if {$::scenario eq "noisy"} { for {set i 0} {$i < 400} {incr i} { puts "INFO: \[Common 17-$i\] noisy fake console line $i" } }
      if {$::scenario eq "vivado-log-conflict"} { vlog "Failure: [result_line FAIL $n 1]" }
    }
    assertion { write_tb_result [result_line FAIL $n 1]; write_sim_log "Error: Vector 0 failed on LED: expected '1', got '0'\nFailure: [result_line FAIL $n 1]" }
    failure-as-error { write_tb_result [result_line FAIL $n 2]; error "ERROR: \[Simulator 45-1\] Failure: simulation stopped (fake)" }
    no-checks { write_tb_result [result_line NO_CHECKS 0 0] }
    elab-error { error "ERROR: \[USF-XSim-62\] 'elaborate' step failed with error(s). (fake)" }
    compile-error { error "ERROR: \[USF-XSim-62\] 'compile' step failed with error(s). (fake)" }
    hang { }
    wallclock-hang { vlog "fake: hanging"; after 600000 }
    silent { }
    wrong-tb { write_tb_result [result_line PASS $n 0 tb_other] }
    wrong-count { write_tb_result [result_line PASS [expr {$n + 1}] 0] }
    two-lines { write_tb_result "[result_line PASS $n 0]\n[result_line PASS $n 0]" }
    log-conflict { write_tb_result [result_line PASS $n 0]; write_sim_log "Failure: [result_line FAIL $n 1]" }
    pass-with-mismatch { write_tb_result [result_line PASS $n 0]; write_sim_log "Error: Vector 3 failed on LED: expected '1', got '0'" }
    control-chars { error "fake launch failure with ESC \x1b\[31m and form feed \f and \"quotes\"" }
  }
}
proc current_time {} {
  if {$::scenario eq "hang"} { return $::sim_runtime }
  return "40 ns"
}
proc get_value {args} { return 0 }
# Only the pre-fix harness called `run all`; kept so it can be replayed as a baseline.
proc run {args} {}
proc close_sim {args} {}
proc reset_run {args} {}
proc launch_runs {args} { if {$::scenario eq "crash137"} { vlog "fake: hard crash during synthesis (exit 137)"; exit 137 } }
proc wait_on_run {args} {}
proc get_runs {n} { return $n }
proc report_utilization {args} {}
proc report_timing_summary {args} {}
proc close_project {args} {}

source $src
