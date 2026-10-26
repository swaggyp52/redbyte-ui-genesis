# Table test for scripts/vivado/redbyte-e1-classify.tcl. Prints one "case outcome" line per
# case; the vitest harness test compares them with the expected outcomes.
# usage: tclsh classify-cases.tcl <path-to-redbyte-e1-classify.tcl>
source [lindex $argv 0]

set line {REDBYTE_TB_RESULT v=1 tb=tb_top status=PASS checks=4 failures=0}
set ok [dict create target_simulator XSim sim_fileset 1 tb_file 1 tb_entity tb_top tb_has_contract 1 \
  static_checks 4 file_lines [list $line] log_lines [list "Note: $line"]]

set cases [list \
  pass $ok \
  no-simulator [dict replace $ok target_simulator ModelSim] \
  no-sim-fileset [dict replace $ok sim_fileset 0] \
  no-testbench-file [dict replace $ok tb_file 0] \
  no-entity [dict replace $ok tb_entity ""] \
  compile-error [dict replace $ok file_lines {} launch_error {ERROR: [USF-XSim-62] 'compile' step failed with error(s).}] \
  elab-error [dict replace $ok file_lines {} launch_error {ERROR: [USF-XSim-62] 'elaborate' step failed with error(s).}] \
  launch-error [dict replace $ok file_lines {} launch_error {ERROR: license checkout failed}] \
  legacy-testbench [dict replace $ok file_lines {} tb_has_contract 0] \
  runtime-error [dict replace $ok file_lines {} run_error {FATAL_ERROR: kernel crash}] \
  timeout [dict replace $ok file_lines {} bound_reached 1] \
  silent-end [dict replace $ok file_lines {}] \
  two-lines [dict replace $ok file_lines [list $line $line]] \
  garbled-line [dict replace $ok file_lines {{REDBYTE_TB_RESULT v=1 tb=tb_top status=MAYBE}}] \
  wrong-tb [dict replace $ok file_lines {{REDBYTE_TB_RESULT v=1 tb=tb_other status=PASS checks=4 failures=0}}] \
  log-disagrees [dict replace $ok log_lines {{Failure: REDBYTE_TB_RESULT v=1 tb=tb_top status=FAIL checks=4 failures=1}}] \
  fail [dict replace $ok file_lines {{REDBYTE_TB_RESULT v=1 tb=tb_top status=FAIL checks=4 failures=1}} log_lines {}] \
  fail-surfaced-as-launch-error [dict replace $ok file_lines {{REDBYTE_TB_RESULT v=1 tb=tb_top status=FAIL checks=4 failures=2}} log_lines {} launch_error {ERROR: [Simulator 45-1] Failure}] \
  no-checks [dict replace $ok file_lines {{REDBYTE_TB_RESULT v=1 tb=tb_top status=NO_CHECKS checks=0 failures=0}} log_lines {}] \
  pass-with-launch-error [dict replace $ok launch_error {ERROR: something}] \
  pass-with-fatal [dict replace $ok fatal_lines 1] \
  pass-zero-checks [dict replace $ok file_lines {{REDBYTE_TB_RESULT v=1 tb=tb_top status=PASS checks=0 failures=0}} log_lines {} static_checks 0] \
  pass-count-drift [dict replace $ok static_checks 5] \
  pass-unknown-static-count [dict replace $ok static_checks ""] \
  pass-with-mismatch-report [dict replace $ok mismatch_lines 1] \
  pass-failures-nonzero [dict replace $ok file_lines {{REDBYTE_TB_RESULT v=1 tb=tb_top status=PASS checks=4 failures=1}} log_lines {}] \
]

foreach {name facts} $cases {
  lassign [rb_e1c_classify $facts] outcome reason
  lassign [rb_e1c_classification $outcome] classification code
  puts "$name $outcome $classification $code"
}

set tb {
entity tb_top is
    assert LED = '1'
  assert SW = '0'
    -- RB_UNRESOLVED_EXPECTATION vector=1 key="x" reason=unmapped
  report "REDBYTE_TB_RESULT v=1 tb=" & status;
}
puts "static-checks [rb_e1c_count_static_checks $tb]"
puts "has-contract [rb_e1c_has_contract $tb]"
