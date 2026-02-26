# Archive

This directory contains historical artifacts that are no longer part of the active codebase.
Nothing here is imported by the current build. Files are preserved for historical reference only.

## Contents

### `os-era-apps/`
Legacy RedByte OS desktop applications from the original OS-era codebase:
- RedstoneLabApp, AnalyzerApp, LogicWorkspaceApp, TerminalApp, SystemMonitorApp, Calculator
- Not imported by any current package. Superseded by the IDE-first architecture in `packages/rb-apps/`.

### `ci-phase4/`
Phase 4 CI artifacts and codex patch sets:
- `_ci_phase4_artifacts/` — output files from Phase 4 CI runs
- `_ci_phase4_fixed/` — fixed fpga-proof artifacts
- `codex_patches_01/` — patch files from the Codex patching workflow
- `_functions_disabled/` — Cloudflare Functions that were disabled during migration

### `legacy-docs/`
Historical planning documents, session summaries, phase completion reports, enforcement
verification logs, and debug/test notes. Covers the OS-era, Phase 3/4, and early IDE builds.
Current documentation lives in `docs/`.

### `pdfs/`
Duplicate copies of reference PDFs. Canonical copies retained at root:
- `Deterministic Interactive Computation in the Browser.pdf`
- `RedByte OS & Logic Playground – Product and Systems Specification.pdf`
- `basys3_rm.pdf`
- `ECE348_GECE598_Refer_VHDL_quick_start.pdf`
- `vivado-getting-started-en-us-2025.1.pdf`
