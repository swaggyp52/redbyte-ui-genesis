set script_dir [file dirname [file normalize [info script]]]
set repo_root [file normalize [file join $script_dir .. .. ..]]
set src_file [file join $script_dir rb_wrapper_smoke.v]
set xdc_file [file join $repo_root packages board-models basys3 pinmap.vivado.xdc]
set out_bit [file join $script_dir rb_wrapper_smoke.bit]

create_project -in_memory -part xc7a35tcpg236-1
read_verilog $src_file
read_xdc $xdc_file
synth_design -top rb_wrapper_smoke_basys3 -part xc7a35tcpg236-1
opt_design
place_design
route_design
write_bitstream -force $out_bit
puts "Wrote bitstream: $out_bit"
exit
