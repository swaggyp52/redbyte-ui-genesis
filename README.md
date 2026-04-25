# RedByte

**A deterministic FPGA educational IDE for digital logic design and Basys3 deployment**

---

## What is RedByte?

RedByte is a browser-based IDE for designing, simulating, and verifying digital logic circuits, then exporting them as Vivado-ready project packages for the Digilent Basys3 FPGA board.

It provides:

- Schematic circuit editor with combinational and sequential components
- Deterministic tick-based simulation (topological sort, integer-only signals)
- Verification engine with pass/fail semantics, waveform viewer, and diagnostic hints
- Interactive Basys3 hardware pin mapping
- Vivado Kit export (VHDL, XDC constraints, testbench, TCL project script)
- VHDL import with fidelity reporting

**Live:** [redbyteapps.dev](https://redbyteapps.dev)

---

## Quick Start

For Windows, double-click:

```text
run.bat
```

The launcher checks Node.js and pnpm, installs workspace dependencies with pnpm if
they are missing, then opens the local RedByte IDE.

From a terminal, the same startup path is:

```bash
pnpm start
```

Developer shortcuts:

```bash
pnpm dev                 # Vite dev server
pnpm start:production    # Build and preview the /os/ production bundle
pnpm build:unified       # Full production build path
```

Run tests:

```bash
pnpm -w exec vitest run
```

---

## IDE Surfaces

RedByte uses a six-surface workflow inside a single IDE shell:

| Surface | Purpose |
|---------|---------|
| **Project** | Student identity, lab metadata, starter examples, readiness checklist |
| **Design** | Schematic editor — place, wire, and configure circuit components |
| **Verify** | Run test scenarios, view pass/fail results, inspect waveforms |
| **Hardware** | Map circuit I/O to Basys3 pins (switches, LEDs, buttons, 7-segment) |
| **Export** | Generate and download a Vivado Kit ZIP for synthesis and programming |
| **Import** | Paste VHDL to import circuits with fidelity reporting |

---

## Student Workflow

1. Open or create a project on the **Project** surface
2. Build a circuit on the **Design** surface
3. Verify behavior on the **Verify** surface
4. Map I/O to Basys3 pins on the **Hardware** surface
5. Export a Vivado Kit ZIP on the **Export** surface
6. Open the exported project in AMD Vivado, synthesize, and program the board

RedByte generates the Vivado project files. Synthesis and board programming happen inside Vivado (requires AMD Vivado WebPACK, free for Basys3).

---

## Instructor Workflow

- Students export submission archives from the **Export** surface
- Import student projects via the **Project** surface or **Import** surface
- Submissions include SHA-256 integrity hashes for verification

---

## Documentation

### Product Manual

The canonical product reference is maintained in `docs/manuals/`:

| File | Description |
|------|-------------|
| [RedByte_Product_Manual.md](./docs/manuals/RedByte_Product_Manual.md) | Canonical reference (Markdown) |
| [RedByte_Product_Manual_print.html](./docs/manuals/RedByte_Product_Manual_print.html) | Print-polished HTML |
| [RedByte_Product_Manual.pdf](./docs/manuals/RedByte_Product_Manual.pdf) | Generated PDF |
| [MANUAL_CLAIM_AUDIT.md](./docs/manuals/MANUAL_CLAIM_AUDIT.md) | Fact-audit — claims verified against source |
| [MANUAL_TRACEABILITY_MATRIX.md](./docs/manuals/MANUAL_TRACEABILITY_MATRIX.md) | Claim → source file mapping |
| [MANUAL_CONFORMANCE.md](./docs/manuals/MANUAL_CONFORMANCE.md) | Rules for keeping the manual accurate |

### Architecture & Specs

| File | Description |
|------|-------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Five-layer architecture (A–E) |
| [docs/STUDENT_UX_LAYER.md](./docs/STUDENT_UX_LAYER.md) | Student-facing content rules |
| [docs/VIVADO_INTEGRATION.md](./docs/VIVADO_INTEGRATION.md) | Vivado export workflow and generated files |
| [docs/DOC_INDEX.md](./docs/DOC_INDEX.md) | Full documentation navigation hub |

### Product Contract & Gap Audit

| File | Description |
|------|-------------|
| [docs/contracts/RedByte_Product_Contract.md](./docs/contracts/RedByte_Product_Contract.md) | Target-state blueprint — what RedByte must become |
| [docs/roadmap/RedByte_Gap_Audit.md](./docs/roadmap/RedByte_Gap_Audit.md) | Honest product-legitimacy audit |

---

## Project Structure

Monorepo using pnpm workspaces:

```
redbyte-ui/
├── apps/
│   └── playground/              # Dev entry point
├── packages/
│   ├── rb-apps/                 # IDE application (IdeApp + 6 surfaces)
│   ├── rb-logic-core/           # Circuit simulation engine
│   ├── rb-logic-view/           # 2D circuit canvas
│   ├── rb-fpga-toolchain/       # VHDL/XDC generation
│   ├── rb-fpga-bridge/          # Hardware bridge (in development)
│   ├── rb-primitives/           # Shared UI primitives
│   ├── rb-tokens/               # Design tokens
│   └── ...                      # Other packages
├── docs/                        # Documentation
├── scripts/                     # Build and CI scripts
└── CLAUDE.md                    # AI agent instructions
```

The primary package under active development is `packages/rb-apps`.

---

## Technology Stack

- **React 19** — UI framework
- **TypeScript 5** — Strict mode throughout
- **Vite** — Build tooling
- **Zustand** — State management
- **Vitest** — Testing (220 tests across 21 suites)

---

## Testing

```bash
pnpm -w exec vitest run              # Run all tests
pnpm --filter rb-apps test           # Run rb-apps tests only
pnpm rc:check                        # Release candidate gate (tests + verify:gates)
```

Test baseline: 168 pure-logic tests + 52 render tests = 220 total, all green.

---

## License

**RedByte Proprietary License (RPL-1.0)**

Copyright 2025-2026 Connor Angiel.

---

## Contact

**Owner:** Connor Angiel
**Repository:** [github.com/swaggyp52/redbyte-ui-genesis](https://github.com/swaggyp52/redbyte-ui-genesis)
**Live:** [redbyteapps.dev](https://redbyteapps.dev)
