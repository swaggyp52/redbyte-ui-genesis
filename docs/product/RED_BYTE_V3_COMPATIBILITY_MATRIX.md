---
doc_status: current
last_validated: 2026-08-01
owner: Connor Angiel
used_by_claude: true
role: conservative RedByte v3 compatibility and ownership matrix
---

# RedByte v3 Compatibility Matrix

## Ownership tiers

1. **Native visual**: RedByte edits, simulates, validates, and exports the supported construct.
2. **Code-backed module**: RedByte preserves HDL and exposes declared ports visually; unsupported internals stay code-owned.
3. **Pass-through asset**: RedByte preserves/packages the asset without editing or simulation claims.
4. **External / unsupported**: RedByte blocks precisely or delegates to Vivado.

`Target` is architecture unless the current-status column explicitly says implemented. The matrix is Browser-E0 authority only.

| Capability | Current status | v3 target | Tier | Import | Edit | Export | Failure behavior | Proof required |
|---|---|---|---:|---|---|---|---|---|
| Supported structural VHDL | Reconstructed subset; generated subset round-trips with manifest for full project fidelity | Native supported subset plus code-backed escape hatch | 1/2 | Parse supported structure; otherwise partial/blocked | Visual for supported graph; code later | Generated VHDL today | Report unsupported constructs without fake schematic | parser, graph, runtime, artifact, Vivado E1 corpus |
| Arbitrary/behavioral VHDL | Ports-only or blocked; source may exist in project input | Preserve as code-backed module | 2 | Preserve source and declared ports | Code, not visual internals | Unchanged source | Precise unsupported-internals notice | representative import/export plus Vivado E1 |
| Verilog | Parser/import paths exist but current visual/export parity is not broadly certified | Code-backed preservation first | 2 | Conservative parse/preserve | Code | Pass source unchanged | Block visual reconstruction when uncertain | language corpus and Vivado E1 |
| SystemVerilog | Not a current supported visual workflow | Pass-through/code-backed after explicit source-set support | 2/3 | Preserve only when implemented | Code/external | Preserve | Explain unavailable support | source fidelity plus Vivado E1 |
| VHDL packages | Not modeled as visual project assets | Pass-through design source | 3 | Preserve | External/code | Preserve/order correctly | Report unresolved dependency/order | package dependency corpus and Vivado E1 |
| VHDL generics | Not a general visual contract | Code-backed parameters, then proven native cases | 2 | Parse declarations later | Code/parameter panel later | Preserve | Reject unsupported binding precisely | parameter round-trip plus E1 |
| Verilog parameters | Not a general visual contract | Code-backed parameters | 2 | Parse declarations later | Code/parameter panel later | Preserve | Reject unsupported binding precisely | parameter round-trip plus E1 |
| Scalar wires | Implemented for supported components | Remain native | 1 | Reconstruct supported nets | Visual | Generate | Existing diagnostics | focused runtime/export tests |
| Vectors and buses | Vector-bit identities preserved in defined paths; no complete bus authoring model | Native typed buses/named nets | 1 target | Preserve identities conservatively | Not yet | Limited current projection | Block width ambiguity | width/type/runtime/export corpus |
| Hierarchical modules | Macros/custom components exist; no general nested module editor | Native hierarchy plus code-backed modules | 1/2 target | Limited supported reconstruction | Flat/current custom paths only | Current supported output only | No fake nested hierarchy | hierarchy cycles, parameter, export, E1 |
| Custom components/macros | Implemented project data with bounded behavior | Versioned native definitions | 1 | Manifest/project restore | Visual bounded support | Supported subset | Mark unsupported capability | preservation and semantic parity tests |
| XDC single generated constraints | Implemented Basys3 semantic projection | Native board/constraint set | 1 | Parse supported pins; manifest is authoritative | Board assignment | Generate `top.xdc` | Row-level missing/conflict diagnostics | preview/package/manifest agreement and E1 |
| Multiple XDC files/constraint sets | Not implemented as a project model | Native/pass-through constraint sets | 1/3 target | Preserve later | Board/global editor later | Ordered preservation | Explain single-set limitation | ordering/scoping corpus and E1 |
| Simulation testbenches | RedByte generates current supported VHDL testbench | Native generated plus pass-through external sources | 1/3 | Not a general testbench importer | Scenario authoring, not arbitrary HDL editing | Generate/preserve by ownership | Separate generated vs external support | runtime/testbench agreement and E1 simulation |
| Tcl project scripts | RedByte generates a bounded Vivado import/program handoff | Generated native plus pass-through user Tcl later | 1/3 | Not generally interpreted | Preview only | Generate/preserve | Never claim Tcl was executed | deterministic bytes and Vivado E1 |
| XCI | Not supported | Pass-through asset | 3 | Preserve later | Vivado | Preserve with manifest | Explain IP remains Vivado-owned | byte fidelity and Vivado E1 |
| DCP | Not supported | Pass-through asset | 3 | Preserve later | Vivado | Preserve with manifest | Explain checkpoint remains Vivado-owned | byte fidelity and Vivado compatibility |
| EDIF/netlists | Not supported | Pass-through asset where safe | 3 | Preserve later | Vivado | Preserve with manifest | Explain no RedByte simulation/edit | byte fidelity and Vivado compatibility |
| Vivado block designs | Not supported | Pass-through external asset | 3/4 | Preserve only when safe | Vivado | Preserve | Delegate clearly | project reconstruction in Vivado |
| AMD IP catalog/IP Integrator | Not supported | External with XCI/pass-through seam | 3/4 | Preserve references later | Vivado | Preserve later | Delegate clearly | Vivado project proof |
| Synthesis | External; no current execution claim | Remains Vivado-owned | 4 | N/A | Vivado | Handoff only | State E1 pending | exact-package Vivado synthesis evidence |
| Implementation | External | Remains Vivado-owned | 4 | N/A | Vivado | Handoff only | State E1 pending | exact-package implementation evidence |
| Timing analysis/closure | External | Remains Vivado-owned | 4 | N/A | Vivado | Constraints handoff only | Never infer timing closure | exact-package reports |
| Bitstream generation | External | Remains Vivado-owned | 4 | N/A | Vivado | No `.bit` from RedByte | State E1 pending | exact-package bitstream evidence |
| Hardware programming | External | Remains Vivado/Hardware Manager-owned | 4 | N/A | Vivado | Procedure only | State E2 pending | named board/programming evidence |
| Physical observation/debug | External | Remains human/Vivado-owned | 4 | N/A | Hardware/Vivado | Procedure/evidence only | State E3 pending | explicit observation procedure and record |

## Official compatibility baseline

The source titles, versions, retrieval date, and affected contracts are recorded in `RED_BYTE_V3_PRODUCT_SYSTEM.md`. AMD 2024.2 is the compatibility baseline; newer documentation does not silently change that target.

## Unresolved decisions

- Exact code-backed module schema and compile-order ownership.
- Whether SystemVerilog begins as pure pass-through or declared-port code-backed source.
- Constraint-set ordering/scoping representation.
- Safe packaging rules for XCI/DCP/EDIF and block-design dependency graphs.
- Native bus type system and VHDL/Verilog signedness mapping.

## Attribution

Connor Angiel
