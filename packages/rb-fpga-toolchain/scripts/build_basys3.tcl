# Build script for RedByte Basys 3 Firmware
# Run with: vivado -mode batch -source build_basys3.tcl

set outputDir ./build_basys3
file mkdir $outputDir

create_project -force redbyte_basys3 $outputDir -part xc7a35tcpg236-1

# Add Source Files
add_files ../hdl/rb_crc16.v
add_files ../hdl/rb_uart_tx.v
add_files ../hdl/rb_uart_telemetry.v
add_files ../hdl/redbyte_basys3_top.v

# Add Constraints
add_files -fileset constrs_1 ../constraints/basys3.xdc

# Set Top
set_property top redbyte_basys3_top [current_fileset]

# Synthesis
launch_runs synth_1 -jobs 4
wait_on_run synth_1

# Implementation
launch_runs impl_1 -to_step write_bitstream -jobs 4
wait_on_run impl_1

# Check for success
if {[get_property PROGRESS [get_runs impl_1]] != "100%"} {
    puts "ERROR: Implementation failed."
    exit 1
}

puts "SUCCESS: Bitstream generated at $outputDir/redbyte_basys3.runs/impl_1/redbyte_basys3_top.bit"
