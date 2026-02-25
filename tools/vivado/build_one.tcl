# build_one.tcl — RedByte Vivado smoke build script.
#
# Usage (Vivado 2024.2 batch mode):
#   vivado -mode batch -nolog -nojournal \
#          -source build_one.tcl \
#          -tclargs <proj> <part> <top> <src> <xdc> <outdir>
#
# Arguments:
#   proj   Project name (used as Vivado project name and bitstream base name)
#   part   Xilinx part string  (e.g. xc7a35tcpg236-1)
#   top    Top module/entity name (e.g. top)
#   src    Absolute path to the Verilog source file (top.v)
#   xdc    Absolute path to the constraints file (constraints.xdc)
#   outdir Absolute output directory (receives .bit + reports + vivado_proj)
#
# Exit codes:
#   0  = bitstream written successfully (REDBYTE_PASS printed to stdout)
#   2  = wrong number of arguments
#   3  = src file not found
#   4  = xdc file not found
#   10 = synthesis failed
#   11 = implementation or bitstream step failed
#   12 = bitstream file not found after successful run

proc die {msg code} {
  puts stderr "REDBYTE_FAIL: $msg"
  exit $code
}

if {[llength $argv] < 6} {
  die "Expected 6 args: <proj> <part> <top> <src> <xdc> <outdir>" 2
}

set proj   [lindex $argv 0]
set part   [lindex $argv 1]
set top    [lindex $argv 2]
set src    [file normalize [lindex $argv 3]]
set xdc    [file normalize [lindex $argv 4]]
set outdir [file normalize [lindex $argv 5]]

puts "REDBYTE_ARGS: proj=$proj part=$part top=$top"
puts "REDBYTE_ARGS: src=$src"
puts "REDBYTE_ARGS: xdc=$xdc"
puts "REDBYTE_ARGS: outdir=$outdir"
puts "REDBYTE_VIVADO_VERSION: [version -short]"

# Create output directories
file mkdir $outdir
set rptdir [file join $outdir reports]
file mkdir $rptdir

# Vivado project lands inside outdir to keep artifacts out of repo
set projdir [file join $outdir vivado_proj]
file mkdir $projdir

# Validate inputs
if {![file exists $src]} { die "Missing src: $src" 3 }
if {![file exists $xdc]} { die "Missing xdc: $xdc" 4 }

# ── Create project ────────────────────────────────────────────────────────────
catch { close_project } _
create_project $proj $projdir -part $part -force

add_files -norecurse $src
add_files -fileset constrs_1 -norecurse $xdc

set_property top $top [current_fileset]
update_compile_order -fileset sources_1

# ── Synthesis ─────────────────────────────────────────────────────────────────
launch_runs synth_1 -jobs 4
wait_on_run synth_1

set synth_status [get_property STATUS [get_runs synth_1]]
puts "REDBYTE_SYNTH_STATUS: $synth_status"

if {[string match "*Failed*" $synth_status]} {
  die "Synthesis failed — STATUS: $synth_status" 10
}

# ── Implementation + bitstream ────────────────────────────────────────────────
launch_runs impl_1 -to_step write_bitstream -jobs 4
wait_on_run impl_1

set impl_status [get_property STATUS [get_runs impl_1]]
puts "REDBYTE_IMPL_STATUS: $impl_status"

if {[string match "*Failed*" $impl_status]} {
  die "Implementation failed — STATUS: $impl_status" 11
}

# ── Locate and copy bitstream ─────────────────────────────────────────────────
# Constructed path is more reliable than get_property BITSTREAM.FILE
set bitfile [file join $projdir "${proj}.runs" impl_1 "${top}.bit"]
if {![file exists $bitfile]} {
  # Fallback: query Vivado property
  set bitfile [get_property BITSTREAM.FILE [get_runs impl_1]]
}
if {$bitfile eq "" || ![file exists $bitfile]} {
  die "Bitstream not found at expected path after successful run" 12
}

set destbit [file join $outdir "${proj}.bit"]
file copy -force $bitfile $destbit

# ── Reports ───────────────────────────────────────────────────────────────────
report_timing_summary -file [file join $rptdir timing_summary.rpt]
report_utilization    -file [file join $rptdir utilization.rpt]
report_drc            -file [file join $rptdir drc.rpt]

puts "REDBYTE_PASS: bitstream=$destbit"
exit 0
