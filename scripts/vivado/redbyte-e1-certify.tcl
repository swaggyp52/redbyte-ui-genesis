# RedByte Vivado E1 certification flow.
#
# E1 boundary:
#   E1a import/open project
#   E1b VHDL compile order/elaboration readiness
#   E1c behavioral simulation of the generated self-checking testbench (required)
#   E1d synthesis
#   E1e optional implementation dry run through route_design, without bitstream
#
# Usage:
#   vivado -mode batch -source scripts/vivado/redbyte-e1-certify.tcl -notrace -nojournal \
#     -log <design-out>/logs/vivado.log -tclargs <path-to.xpr> <design-out> <runId> \
#     [jobs] [includeImplementation] [simBoundNs]
#
# Fail-closed rules:
#   - Any previous e1-result.json / e1-progress.json in <design-out> is deleted first, so a
#     crashed run can never be read as an earlier pass.
#   - Every stage runs inside one catch; an unexpected Tcl error is HARNESS_ERROR, never a
#     stage verdict.
#   - E1c passes only when the testbench's own REDBYTE_TB_RESULT line says PASS, is the result
#     file's only line, matches the exact grammar, and every marker in the logs is a well-formed
#     copy of it, and it agrees with the testbench source (see redbyte-e1-classify.tcl). No sim_1 testbench
#     is BLOCKED_NO_TESTBENCH, not a pass.
#   - The result is written atomically as redbyte.vivado-e1.tcl-result.v2 and carries the runId
#     the wrapper generated, plus one exit code per classification.
#
# xsim behaviour (where report lines land, whether severity failure raises a Tcl error) has
# not been observed on a real Vivado 2024.2 run yet; the result file makes the verdict
# independent of log routing.

source [file join [file dirname [file normalize [info script]]] redbyte-e1-classify.tcl]

set ::rb_result_schema "redbyte.vivado-e1.tcl-result.v2"
set ::rb_tb_result_file "redbyte_tb_result.txt"
set ::rb_stage "E0-start"
set ::rb_exit 10
set ::rb_stages [dict create \
  E1a {status pending detail ""} \
  E1b {status pending detail ""} \
  E1c {status pending detail ""} \
  E1d {status pending detail ""} \
  E1e {status not-requested detail ""}]
set ::rb_e1c [dict create outcome "" reason "" tbEntity "" checks "" failures "" resultLine "" simTime "" getValue {} logs {}]

proc json_escape {value} {
  set out ""
  foreach char [split $value ""] {
    scan $char %c code
    if {$char eq "\\"} {
      append out "\\\\"
    } elseif {$char eq "\""} {
      append out "\\\""
    } elseif {$code < 0x20} {
      append out [format "\\u%04x" $code]
    } else {
      append out $char
    }
  }
  return $out
}

proc json_str {value} {
  return "\"[json_escape $value]\""
}

proc json_list {values} {
  set parts {}
  foreach value $values { lappend parts [json_str $value] }
  return "\[[join $parts {, }]\]"
}

proc write_json_atomic {path text} {
  file mkdir [file dirname $path]
  set tmp "$path.tmp"
  set fh [open $tmp w]
  fconfigure $fh -encoding utf-8 -translation lf
  puts -nonewline $fh $text
  close $fh
  file rename -force $tmp $path
}

proc rb_progress {stage} {
  set ::rb_stage $stage
  write_json_atomic [file join $::out_dir "e1-progress.json"] \
    "{\n  \"schema\": \"redbyte.vivado-e1.progress.v1\",\n  \"runId\": [json_str $::run_id],\n  \"stage\": [json_str $stage]\n}\n"
}

proc rb_stage_set {key status detail} {
  dict set ::rb_stages $key [dict create status $status detail $detail]
}

proc write_result {classification exit_code message} {
  set stage_parts {}
  foreach key {E1a E1b E1c E1d E1e} {
    set entry [dict get $::rb_stages $key]
    lappend stage_parts "    [json_str $key]: {\"status\": [json_str [dict get $entry status]], \"detail\": [json_str [dict get $entry detail]]}"
  }
  set e1c $::rb_e1c
  set value_parts {}
  dict for {name raw} [dict get $e1c getValue] { lappend value_parts "[json_str $name]: [json_str $raw]" }
  set text "{\n"
  append text "  \"schema\": [json_str $::rb_result_schema],\n"
  append text "  \"runId\": [json_str $::run_id],\n"
  append text "  \"generatedAt\": [json_str [clock format [clock seconds] -gmt true -format {%Y-%m-%dT%H:%M:%SZ}]],\n"
  append text "  \"classification\": [json_str $classification],\n"
  append text "  \"exitCode\": $exit_code,\n"
  append text "  \"failedStage\": [json_str [expr {$classification eq "PASS_E1" ? "" : $::rb_stage}]],\n"
  append text "  \"message\": [json_str $message],\n"
  append text "  \"stages\": {\n[join $stage_parts ",\n"]\n  },\n"
  append text "  \"e1c\": {\n"
  append text "    \"outcome\": [json_str [dict get $e1c outcome]],\n"
  append text "    \"reason\": [json_str [dict get $e1c reason]],\n"
  append text "    \"tbEntity\": [json_str [dict get $e1c tbEntity]],\n"
  append text "    \"checks\": [json_str [dict get $e1c checks]],\n"
  append text "    \"failures\": [json_str [dict get $e1c failures]],\n"
  append text "    \"resultLine\": [json_str [dict get $e1c resultLine]],\n"
  append text "    \"simTime\": [json_str [dict get $e1c simTime]],\n"
  append text "    \"getValue\": {[join $value_parts {, }]},\n"
  append text "    \"logs\": [json_list [dict get $e1c logs]]\n"
  append text "  }\n}\n"
  write_json_atomic [file join $::out_dir "e1-result.json"] $text
}

proc rb_conclude {classification exit_code message} {
  puts "RedByte E1: $classification - $message"
  write_result $classification $exit_code $message
  set ::rb_exit $exit_code
}

proc rb_read_text {path} {
  set fh [open $path r]
  fconfigure $fh -encoding utf-8
  set text [read $fh]
  close $fh
  return $text
}

# Files under dir (recursive) whose tail matches pattern.
proc rb_find_files {dir pattern} {
  set found {}
  if {![file isdirectory $dir]} { return $found }
  foreach path [glob -nocomplain -directory $dir -types f $pattern] { lappend found [file normalize $path] }
  foreach sub [glob -nocomplain -directory $dir -types d *] {
    set found [concat $found [rb_find_files $sub $pattern]]
  }
  return [lsort $found]
}

proc rb_time_to_ns {text} {
  if {![regexp {([0-9]+(?:\.[0-9]+)?)\s*(fs|ps|ns|us|ms|s)\y} $text -> value unit]} { return "" }
  set scale [dict get {fs 0.000001 ps 0.001 ns 1 us 1000 ms 1000000 s 1000000000} $unit]
  return [expr {$value * $scale}]
}

# Behavioral simulation of the sim_1 testbench. Gathers facts, never decides by itself.
proc rb_run_e1c {sim_bound_ns} {
  set facts [dict create]
  set target ""
  catch {set target [get_property target_simulator [current_project]]}
  dict set facts target_simulator $target

  set sim_fs [get_filesets -quiet sim_1]
  dict set facts sim_fileset [expr {[llength $sim_fs] > 0}]
  if {[llength $sim_fs] == 0} { return [rb_e1c_classify $facts] }

  set tb_files [get_files -quiet -of_objects $sim_fs *testbench.vhd]
  if {[llength $tb_files] == 0} { set tb_files [get_files -quiet -of_objects $sim_fs *.vhd] }
  dict set facts tb_file [expr {[llength $tb_files] > 0}]
  if {[llength $tb_files] == 0} { return [rb_e1c_classify $facts] }

  set tb_text [rb_read_text [lindex $tb_files 0]]
  set tb_entity ""
  regexp -line -nocase {^\s*entity\s+([A-Za-z][A-Za-z0-9_]*)\s+is\y} $tb_text -> tb_entity
  dict set facts tb_entity $tb_entity
  dict set facts tb_has_contract [rb_e1c_has_contract $tb_text]
  dict set facts static_checks [rb_e1c_count_static_checks $tb_text]
  dict set ::rb_e1c tbEntity $tb_entity
  if {$tb_entity eq ""} { return [rb_e1c_classify $facts] }

  set project_dir [get_property DIRECTORY [current_project]]
  set sim_root [file join $project_dir "[get_property NAME [current_project]].sim"]
  foreach stale [rb_find_files $sim_root $::rb_tb_result_file] { file delete -force $stale }

  # Never trust a hard-coded or stale sim top: elaborate the entity the testbench declares.
  # The run length is bounded; a testbench that never finishes is a TIMEOUT, not a hang.
  set launch_error ""
  if {[catch {
    set_property top $tb_entity $sim_fs
    set_property top_lib xil_defaultlib $sim_fs
  } err]} {
    set launch_error "could not set sim_1 top to $tb_entity: $err"
  }
  catch {set_property -name {xsim.simulate.runtime} -value "${sim_bound_ns}ns" -objects $sim_fs}
  if {$launch_error eq "" && [catch {launch_simulation -mode behavioral} err]} { set launch_error $err }
  dict set facts launch_error $launch_error

  if {$launch_error eq ""} {
    set sim_time ""
    catch {set sim_time [current_time]}
    dict set ::rb_e1c simTime $sim_time
    set reached [rb_time_to_ns $sim_time]
    dict set facts bound_reached [expr {$reached ne "" && $reached >= $sim_bound_ns}]
    set values [dict create]
    foreach name {rb_tb_done rb_tb_checks rb_tb_failures} {
      set raw ""
      catch {set raw [get_value -radix unsigned "/$tb_entity/$name"]}
      dict set values $name $raw
    }
    dict set ::rb_e1c getValue $values
  }
  catch {close_sim -force}

  # Every non-blank line, not only marker lines: the result file must hold exactly one line.
  set file_lines {}
  foreach path [rb_find_files $sim_root $::rb_tb_result_file] {
    set file_lines [concat $file_lines [rb_e1c_content_lines [rb_read_text $path]]]
  }
  dict set facts file_lines $file_lines

  set log_lines {}
  set mismatches 0
  set fatals 0
  set logs {}
  foreach log [concat [rb_find_files $sim_root simulate.log] [rb_find_files $sim_root elaborate.log] [rb_find_files $sim_root compile.log]] {
    lappend logs $log
    set text [rb_read_text $log]
    set log_lines [concat $log_lines [rb_e1c_result_lines $text]]
    incr mismatches [regexp -all {Vector [0-9]+ failed on } $text]
    incr fatals [regexp -all {FATAL_ERROR} $text]
  }
  dict set facts log_lines $log_lines
  dict set facts mismatch_lines $mismatches
  dict set facts fatal_lines $fatals
  dict set ::rb_e1c logs $logs

  if {[llength $file_lines] == 1} {
    set parsed [rb_e1c_parse_result [lindex $file_lines 0]]
    dict set ::rb_e1c resultLine [lindex $file_lines 0]
    if {$parsed ne {}} {
      dict set ::rb_e1c checks [dict get $parsed checks]
      dict set ::rb_e1c failures [dict get $parsed failures]
    }
  }
  return [rb_e1c_classify $facts]
}

proc rb_e1_main {} {
  rb_progress "E1a-import"
  if {![file exists $::xpr_path]} {
    rb_stage_set E1a fail ".xpr not found: $::xpr_path"
    rb_conclude FAIL_IMPORT 2 ".xpr not found: $::xpr_path"
    return
  }
  puts "RedByte E1: opening project $::xpr_path"
  if {[catch {open_project $::xpr_path} err]} {
    rb_stage_set E1a fail $err
    rb_conclude FAIL_IMPORT 2 "open_project failed: $err"
    return
  }
  rb_stage_set E1a pass "opened [get_property NAME [current_project]]"

  rb_progress "E1b-compile-order"
  set src_fs [get_filesets sources_1]
  puts "RedByte E1: top module = [get_property TOP $src_fs]"
  if {[catch {update_compile_order -fileset $src_fs} err]} {
    rb_stage_set E1b fail $err
    rb_conclude FAIL_COMPILE 3 "update_compile_order failed: $err"
    return
  }
  catch {report_compile_order -fileset $src_fs -file [file join $::out_dir "compile-order-sources_1.txt"] -force}
  rb_stage_set E1b pass "compile order resolved"

  rb_progress "E1c-behavioral-sim"
  puts "RedByte E1: behavioral simulation (bound ${::sim_bound_ns} ns)..."
  lassign [rb_run_e1c $::sim_bound_ns] outcome reason
  dict set ::rb_e1c outcome $outcome
  dict set ::rb_e1c reason $reason
  lassign [rb_e1c_classification $outcome] e1c_class e1c_code
  if {$outcome ne "PASS"} {
    rb_stage_set E1c [expr {[string match BLOCKED_* $e1c_class] ? "blocked" : "fail"}] "$outcome: $reason"
    rb_conclude $e1c_class $e1c_code "behavioral simulation $outcome: $reason"
    return
  }
  rb_stage_set E1c pass $reason

  rb_progress "E1d-synthesis"
  puts "RedByte E1: launching synth_1 (jobs=$::jobs)..."
  if {[catch {
    reset_run synth_1
    launch_runs synth_1 -jobs $::jobs
    wait_on_run synth_1
  } err]} {
    rb_stage_set E1d fail $err
    rb_conclude FAIL_SYNTH 5 "synth_1 launch failed: $err"
    return
  }
  set synth_status [get_property STATUS [get_runs synth_1]]
  if {$synth_status ne "synth_design Complete!"} {
    rb_stage_set E1d fail $synth_status
    rb_conclude FAIL_SYNTH 5 "synth_1 did not complete: $synth_status"
    return
  }
  rb_stage_set E1d pass $synth_status
  catch {report_utilization -file [file join $::out_dir "synth-utilization.rpt"] -force}
  catch {report_timing_summary -file [file join $::out_dir "synth-timing-summary.rpt"] -force}

  if {$::include_impl} {
    rb_progress "E1e-implementation-dry-run"
    puts "RedByte E1: launching impl_1 through route_design (jobs=$::jobs; no bitstream)..."
    if {[catch {
      reset_run impl_1
      launch_runs impl_1 -jobs $::jobs -to_step route_design
      wait_on_run impl_1
    } err]} {
      rb_stage_set E1e fail $err
      rb_conclude FAIL_IMPL_DRY_RUN 6 "impl_1 route dry run failed: $err"
      return
    }
    set impl_status [get_property STATUS [get_runs impl_1]]
    if {$impl_status ne "route_design Complete!"} {
      rb_stage_set E1e fail $impl_status
      rb_conclude FAIL_IMPL_DRY_RUN 6 "impl_1 route dry run did not complete: $impl_status"
      return
    }
    rb_stage_set E1e pass $impl_status
  }

  rb_progress "E1-complete"
  rb_conclude PASS_E1 0 "Import, compile order, self-checking behavioral simulation ([dict get $::rb_e1c reason]) and synthesis completed. No bitstream or board observation was attempted."
}

if {$argc < 3} {
  puts "ERROR: usage: redbyte-e1-certify.tcl <path-to.xpr> <design-out> <runId> \[jobs\] \[includeImplementation\] \[simBoundNs\]"
  exit 1
}

set ::xpr_path [file normalize [lindex $argv 0]]
set ::out_dir [file normalize [lindex $argv 1]]
set ::run_id [lindex $argv 2]
set ::jobs [expr {$argc >= 4 ? [lindex $argv 3] : 4}]
set ::include_impl [expr {$argc >= 5 && [string tolower [lindex $argv 4]] in {true 1 yes}}]
set ::sim_bound_ns [expr {$argc >= 6 ? [lindex $argv 5] : 100000}]
if {$::include_impl} { rb_stage_set E1e pending "" }

file mkdir [file join $::out_dir "logs"]
foreach stale {e1-result.json e1-result.json.tmp e1-progress.json e1-progress.json.tmp} {
  file delete -force [file join $::out_dir $stale]
}

if {[catch {rb_e1_main} err]} {
  puts "ERROR: RedByte E1 harness error at $::rb_stage: $err"
  catch {write_result HARNESS_ERROR 10 "harness error at $::rb_stage: $err"}
  set ::rb_exit 10
}
catch {close_project}
exit $::rb_exit
