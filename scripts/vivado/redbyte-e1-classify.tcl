# RedByte E1c classifier: pure Tcl, no Vivado commands.
#
# redbyte-e1-certify.tcl gathers facts about one behavioral-simulation attempt and
# calls rb_e1c_classify. Keeping the decision here lets it be tested with a plain
# tclsh (see packages/rb-apps/src/__tests__/vivado-e1-harness.test.ts).
#
# The authority is the generated testbench's own result line, written to
# redbyte_tb_result.txt in the simulator working directory (testbenchGenerator.ts):
#   REDBYTE_TB_RESULT v=1 tb=<entity> status=PASS|FAIL|NO_CHECKS checks=<n> failures=<m>
# <n> and <m> are VHDL integer'image values: decimal digits, no sign, no leading zero.
# A PASS is only returned when the result file holds exactly that one line and nothing
# else, it names this testbench, every marker seen in the logs is a well-formed copy of
# it, and its check count equals the number of checks the testbench source contains.
# Markers are counted, not lines: a line with two markers, a truncated marker or one with
# trailing text is malformed, and anything malformed is a named non-pass outcome.

namespace eval ::rb_e1c {
  variable outcomes {
    PASS NO_SIMULATOR NOT_CONFIGURED HDL_COMPILE_ERROR HDL_ELAB_ERROR SIM_LAUNCH_ERROR
    RUNTIME_ERROR TIMEOUT CONTRACT_VIOLATION ASSERTION_FAILED NO_CHECKS
  }
  # A result-file line is exactly one marker, start to end.
  variable file_line_re {^REDBYTE_TB_RESULT v=1 tb=([A-Za-z][A-Za-z0-9_]*) status=(PASS|FAIL|NO_CHECKS) checks=(0|[1-9][0-9]*) failures=(0|[1-9][0-9]*)$}
  # A log copy may carry a simulator prefix ("Note: ", "file:line:col:@40ns:(report note): ")
  # but the marker must run to the end of the line.
  variable log_copy_re {REDBYTE_TB_RESULT v=1 tb=([A-Za-z][A-Za-z0-9_]*) status=(PASS|FAIL|NO_CHECKS) checks=(0|[1-9][0-9]*) failures=(0|[1-9][0-9]*)$}
}

proc rb_e1c_marker_count {text} {
  return [regexp -all {REDBYTE_TB_RESULT} $text]
}

proc rb_e1c_parse_with {re line} {
  set line [string trim $line]
  if {[rb_e1c_marker_count $line] != 1 || ![regexp $re $line -> tb status checks failures]} {
    return {}
  }
  return [dict create tb $tb status $status checks $checks failures $failures]
}

# Parse one result-file line; returns a dict, or {} when it is not exactly one result line.
proc rb_e1c_parse_result {line} {
  return [rb_e1c_parse_with $::rb_e1c::file_line_re $line]
}

# Parse one log line holding a marker; returns a dict, or {} when the marker is malformed.
proc rb_e1c_parse_log_copy {line} {
  return [rb_e1c_parse_with $::rb_e1c::log_copy_re $line]
}

# Every line of a log that holds a marker.
proc rb_e1c_result_lines {text} {
  set found {}
  foreach line [split $text "\n"] {
    if {[string first REDBYTE_TB_RESULT $line] >= 0} {
      lappend found [string trim $line]
    }
  }
  return $found
}

# Every non-blank line of the result file, marker or not: the file must hold one line only.
proc rb_e1c_content_lines {text} {
  set found {}
  foreach line [split $text "\n"] {
    if {[string trim $line] ne ""} {
      lappend found [string trim $line]
    }
  }
  return $found
}

# Number of checks a generated testbench contains: one assert per resolved
# expectation plus one marker per expectation the generator could not resolve.
proc rb_e1c_count_static_checks {testbench_text} {
  set asserts [regexp -all -line {^\s*assert\s} $testbench_text]
  set unresolved [regexp -all {RB_UNRESOLVED_EXPECTATION} $testbench_text]
  return [expr {$asserts + $unresolved}]
}

proc rb_e1c_has_contract {testbench_text} {
  return [expr {[string first {REDBYTE_TB_RESULT v=1} $testbench_text] >= 0}]
}

# facts (all optional; missing means "not observed"):
#   target_simulator   string from the project (XSim expected)
#   sim_fileset        1 when sim_1 exists
#   tb_file            1 when a testbench file is in sim_1
#   tb_entity          entity parsed from the testbench file
#   tb_has_contract    1 when the testbench carries the REDBYTE_TB_RESULT contract
#   static_checks      checks counted in the testbench source
#   launch_error       launch_simulation error text
#   run_error          run command error text
#   fatal_lines        FATAL_ERROR lines seen in logs
#   mismatch_lines     per-vector "failed on" error lines seen in logs
#   bound_reached      1 when simulation time reached the bound without a result
#   file_lines         every non-blank line read from redbyte_tb_result.txt
#   log_lines          every simulator-log line holding a REDBYTE_TB_RESULT marker
# Returns {outcome reason}.
proc rb_e1c_classify {facts} {
  set f [dict merge [dict create \
      target_simulator "" sim_fileset 0 tb_file 0 tb_entity "" tb_has_contract 0 static_checks "" \
      launch_error "" run_error "" fatal_lines 0 mismatch_lines 0 bound_reached 0 \
      file_lines {} log_lines {}] $facts]

  if {[dict get $f target_simulator] ne "XSim"} {
    return [list NO_SIMULATOR "project target simulator is '[dict get $f target_simulator]', not XSim"]
  }
  if {![dict get $f sim_fileset] || ![dict get $f tb_file] || [dict get $f tb_entity] eq ""} {
    return [list NOT_CONFIGURED "no sim_1 testbench with a readable entity name"]
  }

  # A result line means the testbench ran to its end, so it outranks a launch error (a
  # simulator may surface the testbench's own severity failure that way). Without one,
  # the launch error is the explanation.
  set launch [dict get $f launch_error]
  set file_lines [dict get $f file_lines]
  if {[llength $file_lines] == 0} {
    if {$launch ne ""} {
      if {[string match {*'compile' step failed*} $launch]} { return [list HDL_COMPILE_ERROR $launch] }
      if {[string match {*'elaborate' step failed*} $launch]} { return [list HDL_ELAB_ERROR $launch] }
      return [list SIM_LAUNCH_ERROR $launch]
    }
    if {![dict get $f tb_has_contract]} {
      return [list CONTRACT_VIOLATION "testbench has no REDBYTE_TB_RESULT self-check; regenerate it with this RedByte version"]
    }
    if {[dict get $f run_error] ne "" || [dict get $f fatal_lines] > 0} {
      return [list RUNTIME_ERROR "simulation failed before the testbench wrote a result: [dict get $f run_error]"]
    }
    if {[dict get $f bound_reached]} {
      return [list TIMEOUT "simulation time bound reached before the testbench finished"]
    }
    return [list RUNTIME_ERROR "simulation ended without writing redbyte_tb_result.txt"]
  }
  set markers 0
  foreach line $file_lines { incr markers [rb_e1c_marker_count $line] }
  if {$markers != 1 || [llength $file_lines] != 1} {
    return [list CONTRACT_VIOLATION "expected exactly one result line, found $markers marker(s) on [llength $file_lines] line(s)"]
  }

  set line [lindex $file_lines 0]
  set result [rb_e1c_parse_result $line]
  if {$result eq {}} {
    return [list CONTRACT_VIOLATION "malformed result line: $line"]
  }
  if {![string equal -nocase [dict get $result tb] [dict get $f tb_entity]]} {
    return [list CONTRACT_VIOLATION "result names tb=[dict get $result tb], simulated [dict get $f tb_entity]"]
  }
  foreach seen [dict get $f log_lines] {
    set copy [rb_e1c_parse_log_copy $seen]
    if {$copy eq {}} {
      return [list CONTRACT_VIOLATION "malformed result marker in a simulator log: $seen"]
    }
    if {$copy ne $result} {
      return [list CONTRACT_VIOLATION "log line disagrees with result file: $seen"]
    }
  }

  set status [dict get $result status]
  set checks [dict get $result checks]
  set failures [dict get $result failures]
  if {$status eq "FAIL"} {
    return [list ASSERTION_FAILED "$failures of $checks checks failed"]
  }
  if {$status eq "NO_CHECKS"} {
    return [list NO_CHECKS "the testbench drives stimulus but checks no outputs"]
  }

  # status PASS: every independent signal must agree before it counts.
  if {$launch ne "" || [dict get $f run_error] ne "" || [dict get $f fatal_lines] > 0} {
    return [list RUNTIME_ERROR "result says PASS but the simulator reported an error: $launch[dict get $f run_error]"]
  }
  if {$failures != 0 || $checks == 0} {
    return [list CONTRACT_VIOLATION "PASS with checks=$checks failures=$failures"]
  }
  set static [dict get $f static_checks]
  if {$static eq "" || $checks != $static} {
    return [list CONTRACT_VIOLATION "PASS ran $checks checks; the testbench source contains $static"]
  }
  if {[dict get $f mismatch_lines] > 0} {
    return [list ASSERTION_FAILED "PASS line contradicted by [dict get $f mismatch_lines] mismatch report(s)"]
  }
  return [list PASS "$checks checks passed"]
}

# E1c outcome -> top-level E1 classification and process exit code.
proc rb_e1c_classification {outcome} {
  switch -- $outcome {
    PASS               { return {PASS_E1C 0} }
    NO_SIMULATOR       { return {BLOCKED_NO_SIM 20} }
    NOT_CONFIGURED     { return {BLOCKED_NO_TESTBENCH 21} }
    HDL_COMPILE_ERROR  { return {FAIL_TESTBENCH_COMPILE 22} }
    HDL_ELAB_ERROR     { return {FAIL_TESTBENCH_ELAB 23} }
    SIM_LAUNCH_ERROR   { return {FAIL_TESTBENCH_LAUNCH 24} }
    RUNTIME_ERROR      { return {FAIL_TESTBENCH_RUNTIME 25} }
    TIMEOUT            { return {FAIL_TESTBENCH_TIMEOUT 26} }
    CONTRACT_VIOLATION { return {FAIL_TESTBENCH_CONTRACT 27} }
    ASSERTION_FAILED   { return {FAIL_TESTBENCH_ASSERTION 28} }
    NO_CHECKS          { return {FAIL_TESTBENCH_NO_CHECKS 29} }
  }
  return {HARNESS_ERROR 10}
}
