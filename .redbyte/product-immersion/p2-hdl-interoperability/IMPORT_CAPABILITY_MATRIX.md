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

## Current implementation (P2-3 findings — the code is the authority)

The language capability matrix now lives in code:
`packages/rb-apps/src/apps/ide/languageCapability.ts` (`LANGUAGE_CAPABILITIES`,
`capabilityFor`, `isReconstructable`, `neverExecuted`). It declares, per language,
the honest tier RedByte reaches **today** vs planned:

| Language | Tier | Status | Executes? | What the parser actually does |
|----------|------|--------|-----------|-------------------------------|
| VHDL | structural-subset | available | no | entity/ports (bit-blasted vectors), component instantiation, concurrent boolean assignments (→ gates), rising_edge+reset → register. Generics dropped. Import UI **blocks** behavioral (process/rising_edge) → effective surface is structural-combinational. |
| Verilog | structural-subset | available | no | module/ports, gate primitives, module instantiation; `assign` pass-through only. `always`/operator-`assign` blocked at import. |
| SystemVerilog | structural-subset | available | no | routed to the Verilog parser (no SV grammar); Verilog-compatible subset only. Interfaces/packages/always_ff/classes unsupported. |
| XDC | read-only | available | no | `set_property PACKAGE_PIN`/`IOSTANDARD`/`-dict`, `get_ports`, Basys3 pin validation (strong/weak) + line numbers. Other constraints ignored-with-warning. |
| Tcl | opaque-preserved | available | **never** | carried verbatim; parsed only for display; **never executed**. |
| VCD | read-only | planned | no | no parser today; imported waveform analysis is P2-6. |
| unknown | unsupported | available | no | opaque text, no capabilities. |

**Diagnostics/range model (new, P2-3).**
`packages/rb-apps/src/apps/ide/sourceDiagnostics.ts` adds the repo's first
`SourceRange`/`SourcePosition` model (there was none — existing diagnostics carried
line/column *points* only) with offset↔position conversion, containment, a stable
total-ordering sort, summary and formatting.

**Known integration gaps (for P2-5 Import program):** the existing parsers emit
positions only as first-match single points into `ParsedHdlWarning.{line,col}`;
`XdcPinEntry.line` and the behavioral-construct scan are dropped before reaching
the diagnostic model. Threading true ranges through `importCompiler`
(`normalizeParserDiagnostics`) and `diagnostics.ts` (`adaptImportDiagnostic`,
`IdeDiagnosticLocation`) is the follow-on wiring.

_(Module tiers realized in P2-4; import review realized in P2-5.)_
