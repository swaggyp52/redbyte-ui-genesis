# Import Capability Matrix

What RedByte can do with each imported artifact kind. Import is **review-before-apply**:
inspect → understand → the user explicitly applies. No silent replacement, no Tcl
execution, no source mutation during inspection.

| Artifact | Detect | Parse tier | Becomes | Notes |
|----------|--------|-----------|---------|-------|
| VHDL (`.vhd`/`.vhdl`) | ext + header | bounded subset: entity/ports/generics + ranges | Source-backed module (Source Editable or Structural Read-Only) | Full behavioral bodies beyond the subset → Opaque Preserved |
| Verilog (`.v`) | ext | bounded subset: module/ports/params | Source-backed module | as above |
| SystemVerilog (`.sv`) | ext | bounded subset (shared w/ Verilog) | Source-backed module | interfaces/classes → Opaque Preserved |
| Constraints (`.xdc`) | ext | bounded subset: `set_property PACKAGE_PIN`/`IOSTANDARD`, `get_ports` | Constraint fileset entry | multiple constraint sets supported |
| Tcl (`.tcl`) | ext | **read-only, never executed** | Utility fileset entry (opaque) | parsed only for display; never run |
| Waveform (`.vcd`) | ext + header | signal/timescale headers + value changes | Imported VCD Provider source | see Provider Matrix |
| Vivado snapshot envelope | manifest | versioned digital-twin metadata | Imported evidence (external) | never presented as in-browser synthesis |

## Module tiers (result of import/parse)

| Tier | Meaning | Editable | Simulatable |
|------|---------|----------|-------------|
| Native Visual Editable | authored in RedByte's visual hierarchy | yes (visual) | yes (Browser Logic) |
| Source Editable | parsed source within the bounded subset | yes (source) | yes where derivable |
| Structural Read-Only | parsed structure, body outside subset | no | structurally only |
| Opaque Preserved | recognized but unparseable; kept byte-exact | no | no (evidence only) |
| Missing | referenced but absent | no | no; flagged as a diagnostic |

_(Filled in during P2-3 / P2-5.)_
